"""
NEXUS CORE OS - MULTI-LOCATION INVENTORY & STOCK MUTATION API
File: apps/core-api/app/api/v1/inventory.py

Menangani manajemen inventaris multi-lokasi (Gudang Pusat, Toko Cabang),
monitoring posisi stok real-time, dan mutasi transfer barang antar cabang.

🧠 ATURAN ARSITEKTUR EMAS:
1. TENANCY ISOLATION: Setiap query SQL WAJIB menyertakan `WHERE tenant_id = :tenant_id`.
2. INTEGER MINOR UNITS: Seluruh kuantitas stok bertipe integer (BIGINT di DB).
3. ATOMIC STOCK TRANSFER: Pemindahan stok dari lokasi A ke lokasi B dilakukan
   dalam satu transaksi atomik dengan pencatatan mutasi ke tabel append-only `stock_movements`.
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.schemas.inventory import (
    LocationResponse,
    StockItemResponse,
    StockTransferRequest,
    StockTransferResponse,
    GRNCreatePayload,
    GRNResponse,
    GRNItemResult,
    ReturnToSupplierPayload,
    ReturnToSupplierResponse,
    QuarantineTransferPayload
)
from app.services.journal_service import create_auto_journal, get_or_create_default_accounts

router = APIRouter(prefix="/inventory", tags=["Multi-Location Inventory"])

# Data lokasi default untuk inisialisasi tenant baru (termasuk Gudang Karantina / Defect)
DEFAULT_LOCATIONS = [
    {"name": "Gudang Pusat", "type": "warehouse"},
    {"name": "Toko Cabang A (Mall)", "type": "store"},
    {"name": "Toko Cabang B (Ruko)", "type": "store"},
    {"name": "Gudang Karantina / Defect", "type": "warehouse"},
]

# ==============================================================================
# ENDPOINT 1: LIST LOKASI / GUDANG CABANG
# ==============================================================================
@router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil seluruh daftar lokasi inventaris (gudang pusat dan toko cabang) milik tenant aktif.
    Jika tenant belum memiliki lokasi, otomatis menginisialisasi 1 Gudang Pusat dan 2 Toko Cabang.
    """
    try:
        query = text("""
            SELECT id, tenant_id, name, type, is_active, created_at
            FROM public.locations
            WHERE tenant_id = :tenant_id
            ORDER BY type DESC, name ASC
        """)
        result = await db.execute(query, {"tenant_id": str(current_tenant_id)})
        rows = result.mappings().all()

        # Inisialisasi otomatis jika belum ada lokasi sama sekali
        if not rows:
            for loc in DEFAULT_LOCATIONS:
                await db.execute(
                    text("""
                        INSERT INTO public.locations (id, tenant_id, name, type, is_active, created_at)
                        VALUES (:id, :tenant_id, :name, :type, true, timezone('utc'::text, now()))
                    """),
                    {
                        "id": str(uuid4()),
                        "tenant_id": str(current_tenant_id),
                        "name": loc["name"],
                        "type": loc["type"]
                    }
                )
            await db.commit()

            # Ambil ulang setelah di-seed
            result = await db.execute(query, {"tenant_id": str(current_tenant_id)})
            rows = result.mappings().all()

        return [
            LocationResponse(
                id=r["id"],
                tenant_id=r["tenant_id"],
                name=r["name"],
                type=r["type"],
                is_active=r["is_active"],
                created_at=r["created_at"]
            )
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar lokasi inventaris: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 2: LIST STOK BARANG PER LOKASI
# ==============================================================================
@router.get("/stock", response_model=List[StockItemResponse])
async def list_stock(
    location_id: Optional[UUID] = Query(None, description="Filter stok pada lokasi/cabang tertentu"),
    q: Optional[str] = Query(None, description="Pencarian nama produk atau SKU"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil posisi stok barang fisik di seluruh lokasi atau pada lokasi tertentu.
    Mengembalikan data item, SKU, kategori, nama lokasi, kuantitas on-hand, dan stok siap jual.
    """
    try:
        # Cek apakah kolom location_id sudah ada di tabel stock_levels
        col_check = await db.execute(
            text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'stock_levels' AND column_name = 'location_id'
            """)
        )
        has_location_col = col_check.first() is not None

        if has_location_col:
            sql = """
                SELECT 
                    i.id AS item_id,
                    i.sku,
                    i.name,
                    i.item_type,
                    COALESCE(i.attributes->>'category', 'Sparepart') AS category,
                    i.base_price,
                    l.id AS location_id,
                    COALESCE(l.name, 'Gudang Pusat') AS location_name,
                    COALESCE(s.on_hand, 0) AS on_hand,
                    COALESCE(s.reserved, 0) AS reserved,
                    COALESCE(s.on_hand - s.reserved, 0) AS available
                FROM public.items i
                LEFT JOIN public.stock_levels s ON s.item_id = i.id AND s.tenant_id = :tenant_id
                LEFT JOIN public.locations l ON l.id = s.location_id AND l.tenant_id = :tenant_id
                WHERE i.tenant_id = :tenant_id AND i.item_type = 'stocked'
            """
            params: dict = {"tenant_id": str(current_tenant_id)}

            if location_id:
                sql += " AND s.location_id = :loc_id"
                params["loc_id"] = str(location_id)

            if q:
                sql += " AND (i.name ILIKE :search OR i.sku ILIKE :search)"
                params["search"] = f"%{q.strip()}%"

            sql += " ORDER BY i.name ASC, l.name ASC"

        else:
            # Fallback jika schema lama stock_levels belum memiliki location_id
            sql = """
                SELECT 
                    i.id AS item_id,
                    i.sku,
                    i.name,
                    i.item_type,
                    COALESCE(i.attributes->>'category', 'Sparepart') AS category,
                    i.base_price,
                    NULL::uuid AS location_id,
                    'Gudang Utama' AS location_name,
                    COALESCE(s.on_hand, 0) AS on_hand,
                    COALESCE(s.reserved, 0) AS reserved,
                    COALESCE(s.on_hand - s.reserved, 0) AS available
                FROM public.items i
                LEFT JOIN public.stock_levels s ON s.item_id = i.id AND s.tenant_id = :tenant_id
                WHERE i.tenant_id = :tenant_id AND i.item_type = 'stocked'
            """
            params = {"tenant_id": str(current_tenant_id)}
            if q:
                sql += " AND (i.name ILIKE :search OR i.sku ILIKE :search)"
                params["search"] = f"%{q.strip()}%"
            sql += " ORDER BY i.name ASC"

        result = await db.execute(text(sql), params)
        rows = result.mappings().all()

        return [
            StockItemResponse(
                item_id=r["item_id"],
                sku=r["sku"],
                name=r["name"],
                item_type=r["item_type"],
                category=r["category"],
                base_price=int(r["base_price"]),
                location_id=r["location_id"],
                location_name=r["location_name"],
                on_hand=int(r["on_hand"]),
                reserved=int(r["reserved"]),
                available=int(r["available"])
            )
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data stok barang: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 3: TRANSFER STOK ANTAR LOKASI (GUDANG / CABANG)
# ==============================================================================
@router.post("/stock-movements", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
async def transfer_stock(
    payload: StockTransferRequest,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Melakukan transfer stok fisik dari satu lokasi ke lokasi lain secara atomik.
    
    🧠 ATURAN BISNIS:
    1. Lokasi asal dan lokasi tujuan tidak boleh sama.
    2. Kuantitas transfer harus > 0.
    3. Stok siap jual (on_hand - reserved) pada lokasi asal harus mencukupi (mencegah stok minus).
    4. Mengurangi stok di lokasi asal dan menambah stok di lokasi tujuan.
    5. Mencatat mutasi keluar dan masuk di tabel append-only `stock_movements`.
    """
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lokasi asal dan lokasi tujuan transfer tidak boleh sama!"
        )

    if payload.qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jumlah kuantitas transfer harus lebih besar dari 0."
        )

    try:
        # 1. Validasi Keberadaan Item
        item_res = await db.execute(
            text("SELECT id, name, sku, item_type FROM public.items WHERE id = :iid AND tenant_id = :tenant_id"),
            {"iid": str(payload.item_id), "tenant_id": str(current_tenant_id)}
        )
        item_row = item_res.mappings().first()
        if not item_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item dengan ID '{payload.item_id}' tidak ditemukan."
            )

        # 2. Validasi Keberadaan Lokasi Asal & Tujuan
        locs_res = await db.execute(
            text("""
                SELECT id, name, type 
                FROM public.locations 
                WHERE id IN (:from_id, :to_id) AND tenant_id = :tenant_id
            """),
            {
                "from_id": str(payload.from_location_id),
                "to_id": str(payload.to_location_id),
                "tenant_id": str(current_tenant_id)
            }
        )
        found_locs = {str(l["id"]): l["name"] for l in locs_res.mappings().all()}
        from_loc_name = found_locs.get(str(payload.from_location_id))
        to_loc_name = found_locs.get(str(payload.to_location_id))

        if not from_loc_name or not to_loc_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lokasi asal atau lokasi tujuan tidak valid pada tenant aktif Anda."
            )

        # 3. Cek Ketersediaan Stok di Lokasi Asal
        from_stock_res = await db.execute(
            text("""
                SELECT id, on_hand, reserved, (on_hand - reserved) AS available
                FROM public.stock_levels
                WHERE tenant_id = :tenant_id 
                  AND item_id = :item_id 
                  AND location_id = :loc_id
            """),
            {
                "tenant_id": str(current_tenant_id),
                "item_id": str(payload.item_id),
                "loc_id": str(payload.from_location_id)
            }
        )
        from_stock_row = from_stock_res.mappings().first()
        available_qty = int(from_stock_row["available"]) if from_stock_row else 0

        if available_qty < payload.qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Stok di '{from_loc_name}' tidak mencukupi! "
                    f"Tersedia siap transfer: {available_qty} unit, diminta: {payload.qty} unit."
                )
            )

        # 4. Kurangi Stok di Lokasi Asal
        new_from_on_hand = int(from_stock_row["on_hand"]) - payload.qty
        await db.execute(
            text("""
                UPDATE public.stock_levels
                SET on_hand = :new_on_hand, updated_at = timezone('utc'::text, now())
                WHERE id = :sl_id AND tenant_id = :tenant_id
            """),
            {
                "new_on_hand": new_from_on_hand,
                "sl_id": from_stock_row["id"],
                "tenant_id": str(current_tenant_id)
            }
        )

        # 5. Tambah Stok di Lokasi Tujuan (Upsert)
        to_stock_res = await db.execute(
            text("""
                INSERT INTO public.stock_levels (
                    id, tenant_id, item_id, location_id, on_hand, reserved, updated_at
                ) VALUES (
                    gen_random_uuid(), :tenant_id, :item_id, :loc_id, :qty, 0, timezone('utc'::text, now())
                )
                ON CONFLICT (tenant_id, item_id, location_id)
                DO UPDATE SET 
                    on_hand = public.stock_levels.on_hand + EXCLUDED.on_hand,
                    updated_at = timezone('utc'::text, now())
                RETURNING on_hand
            """),
            {
                "tenant_id": str(current_tenant_id),
                "item_id": str(payload.item_id),
                "loc_id": str(payload.to_location_id),
                "qty": payload.qty
            }
        )
        new_to_on_hand = int(to_stock_res.scalar_one())

        # 6. Catat Ledger Mutasi di stock_movements (Out & In)
        memo_text = payload.reason or "Transfer stok cabang"
        # Mutasi Keluar
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (
                    id, tenant_id, item_id, location_id, qty_delta, reason, ref_id, created_at
                ) VALUES (
                    gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, :reason, :ref_id, timezone('utc'::text, now())
                )
            """),
            {
                "tenant_id": str(current_tenant_id),
                "item_id": str(payload.item_id),
                "loc_id": str(payload.from_location_id),
                "delta": -payload.qty,
                "reason": f"Transfer Keluar ke {to_loc_name} ({memo_text})",
                "ref_id": str(payload.to_location_id)
            }
        )

        # Mutasi Masuk
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (
                    id, tenant_id, item_id, location_id, qty_delta, reason, ref_id, created_at
                ) VALUES (
                    gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, :reason, :ref_id, timezone('utc'::text, now())
                )
            """),
            {
                "tenant_id": str(current_tenant_id),
                "item_id": str(payload.item_id),
                "loc_id": str(payload.to_location_id),
                "delta": payload.qty,
                "reason": f"Transfer Masuk dari {from_loc_name} ({memo_text})",
                "ref_id": str(payload.from_location_id)
            }
        )

        # Commit atomik seluruh transfer
        await db.commit()

        return StockTransferResponse(
            success=True,
            message=f"Berhasil mentransfer {payload.qty} unit '{item_row['name']}' dari {from_loc_name} ke {to_loc_name}.",
            item_id=item_row["id"],
            item_name=item_row["name"],
            from_location_name=from_loc_name,
            to_location_name=to_loc_name,
            transferred_qty=payload.qty,
            from_location_remaining=new_from_on_hand,
            to_location_new_stock=new_to_on_hand
        )

    except HTTPException:
        await db.rollback()
        raise
    except (DBAPIError, IntegrityError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses mutasi transfer stok: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 4: GOODS RECEIPT NOTE (GRN) & MOVING AVERAGE HPP
# ==============================================================================

@router.post("/grn", response_model=GRNResponse)
async def process_goods_receipt_note(
    payload: GRNCreatePayload,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Penerimaan Barang Supplier (Goods Receipt Note):
    1. Tambah stok fisik di lokasi gudang penerima (default: 'Gudang Pusat').
    2. Recalculate HPP (base_price) menggunakan rumus Moving Average:
       HPP_Baru = ((Stok_Lama * HPP_Lama) + (Qty_Baru * Harga_Beli_Baru)) / (Stok_Lama + Qty_Baru)
    3. Catat mutasi stok append-only di stock_movements dengan reason 'GRN_SUPPLIER'.
    4. Buat jurnal otomatis akuntansi double-entry:
       - DEBIT: Persediaan (Akun 1200 / 1210)
       - KREDIT: Hutang Usaha (Akun 2000)
    """
    tenant_id_str = str(current_tenant_id)
    grn_number = f"GRN-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:4].upper()}"

    try:
        # 1. Tentukan lokasi penerimaan (default ke 'Gudang Pusat')
        target_location_id = None
        target_location_name = "Gudang Pusat"

        if payload.location_id:
            loc_res = await db.execute(
                text("SELECT id, name FROM public.locations WHERE id = :id AND tenant_id = :tenant_id"),
                {"id": str(payload.location_id), "tenant_id": tenant_id_str}
            )
            loc_row = loc_res.mappings().first()
            if loc_row:
                target_location_id = str(loc_row["id"])
                target_location_name = loc_row["name"]

        if not target_location_id:
            # Ambil lokasi warehouse pertama (Gudang Pusat)
            loc_res = await db.execute(
                text("""
                    SELECT id, name FROM public.locations 
                    WHERE tenant_id = :tenant_id AND (name ILIKE '%gudang pusat%' OR type = 'warehouse')
                    ORDER BY created_at ASC LIMIT 1
                """),
                {"tenant_id": tenant_id_str}
            )
            loc_row = loc_res.mappings().first()
            if loc_row:
                target_location_id = str(loc_row["id"])
                target_location_name = loc_row["name"]
            else:
                # Inisialisasi Gudang Pusat darurat
                target_location_id = str(uuid4())
                await db.execute(
                    text("""
                        INSERT INTO public.locations (id, tenant_id, name, type, is_active)
                        VALUES (:id, :tenant_id, 'Gudang Pusat', 'warehouse', true)
                    """),
                    {"id": target_location_id, "tenant_id": tenant_id_str}
                )

        details_result: List[GRNItemResult] = []
        total_grn_cost = 0

        # 2. Proses Setiap Item Penerimaan
        for item_in in payload.items:
            item_id_str = str(item_in.item_id)

            # Query data item saat ini
            item_res = await db.execute(
                text("SELECT id, name, sku, base_price, category FROM public.items WHERE id = :id AND tenant_id = :tenant_id"),
                {"id": item_id_str, "tenant_id": tenant_id_str}
            )
            item_data = item_res.mappings().first()
            if not item_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Barang dengan ID {item_id_str} tidak ditemukan."
                )

            # Hitung total stok lama across all locations
            stock_sum_res = await db.execute(
                text("SELECT COALESCE(SUM(on_hand), 0) AS total_on_hand FROM public.stock_levels WHERE item_id = :item_id AND tenant_id = :tenant_id"),
                {"item_id": item_id_str, "tenant_id": tenant_id_str}
            )
            total_on_hand_before = int(stock_sum_res.scalar() or 0)
            old_hpp = int(item_data["base_price"] or 0)
            new_qty = item_in.qty
            new_price = item_in.purchase_price
            subtotal = new_qty * new_price
            total_grn_cost += subtotal

            # Rumus Moving Average HPP
            total_qty_after = total_on_hand_before + new_qty
            if total_qty_after > 0:
                new_hpp = int(((total_on_hand_before * old_hpp) + (new_qty * new_price)) / total_qty_after)
            else:
                new_hpp = new_price

            # Update base_price (HPP) di tabel items
            await db.execute(
                text("""
                    UPDATE public.items 
                    SET base_price = :new_hpp, updated_at = timezone('utc'::text, now())
                    WHERE id = :id AND tenant_id = :tenant_id
                """),
                {"new_hpp": new_hpp, "id": item_id_str, "tenant_id": tenant_id_str}
            )

            # Tambahkan stok ke target location (Gudang Pusat)
            await db.execute(
                text("""
                    INSERT INTO public.stock_levels (id, tenant_id, item_id, location_id, on_hand, reserved, updated_at)
                    VALUES (gen_random_uuid(), :tenant_id, :item_id, :location_id, :qty, 0, timezone('utc'::text, now()))
                    ON CONFLICT (tenant_id, item_id, location_id)
                    DO UPDATE SET on_hand = public.stock_levels.on_hand + EXCLUDED.on_hand, updated_at = timezone('utc'::text, now())
                """),
                {"tenant_id": tenant_id_str, "item_id": item_id_str, "location_id": target_location_id, "qty": new_qty}
            )

            # Catat mutasi stok append-only
            await db.execute(
                text("""
                    INSERT INTO public.stock_movements (
                        id, tenant_id, item_id, location_id, qty_delta, reason, ref_id, created_at
                    ) VALUES (
                        gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, 'GRN_SUPPLIER', :ref_id, timezone('utc'::text, now())
                    )
                """),
                {
                    "tenant_id": tenant_id_str,
                    "item_id": item_id_str,
                    "loc_id": target_location_id,
                    "delta": new_qty,
                    "ref_id": f"{grn_number} - Surat Jalan: {payload.delivery_order_number or '-'}"
                }
            )

            details_result.append(
                GRNItemResult(
                    item_id=item_data["id"],
                    item_name=item_data["name"],
                    sku=item_data["sku"],
                    qty_received=new_qty,
                    purchase_price=new_price,
                    subtotal=subtotal,
                    old_hpp=old_hpp,
                    new_moving_average_hpp=new_hpp,
                    new_total_stock=total_qty_after
                )
            )

        # 3. Catat Header GRN ke tabel goods_receipt_notes jika ada
        try:
            await db.execute(
                text("""
                    INSERT INTO public.goods_receipt_notes (
                        id, tenant_id, grn_number, supplier_name, delivery_order_number, location_id, total_cost, status, notes
                    ) VALUES (
                        gen_random_uuid(), :tenant_id, :grn_number, :supplier_name, :do_num, :loc_id, :total_cost, 'COMPLETED', :notes
                    )
                """),
                {
                    "tenant_id": tenant_id_str,
                    "grn_number": grn_number,
                    "supplier_name": payload.supplier_name or "Supplier Utama",
                    "do_num": payload.delivery_order_number,
                    "loc_id": target_location_id,
                    "total_cost": total_grn_cost,
                    "notes": payload.notes
                }
            )
        except Exception:
            pass

        # 4. Auto-Accounting Double-Entry Journal
        journal_success = False
        if total_grn_cost > 0:
            try:
                coa_map = await get_or_create_default_accounts(current_tenant_id, db)
                inv_acc = coa_map.get("1200") # Persediaan Sparepart
                ap_acc = coa_map.get("2000")  # Hutang Usaha

                if inv_acc and ap_acc:
                    await create_auto_journal(
                        tenant_id=current_tenant_id,
                        transaction_date=date.today(),
                        description=f"Penerimaan Barang Supplier (GRN: {grn_number} - DO: {payload.delivery_order_number or '-'})",
                        reference_type="GRN",
                        reference_id=uuid4(),
                        lines=[
                            {"account_id": inv_acc["id"], "debit": total_grn_cost, "credit": 0},
                            {"account_id": ap_acc["id"], "debit": 0, "credit": total_grn_cost}
                        ],
                        db=db
                    )
                    journal_success = True
            except Exception:
                pass

        await db.commit()

        return GRNResponse(
            success=True,
            message=f"Penerimaan barang {grn_number} berhasil disimpan. HPP dihitung ulang dengan Moving Average.",
            grn_number=grn_number,
            delivery_order_number=payload.delivery_order_number,
            location_name=target_location_name,
            total_cost=total_grn_cost,
            items_count=len(details_result),
            details=details_result,
            journal_created=journal_success
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses Goods Receipt Note: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 5: RETUR KE SUPPLIER (DEFECT & QUARANTINE RETUR)
# ==============================================================================

@router.post("/return-to-supplier", response_model=ReturnToSupplierResponse)
async def process_return_to_supplier(
    payload: ReturnToSupplierPayload,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Retur Barang Defect ke Supplier:
    1. Mengurangi stok dari lokasi 'Gudang Karantina / Defect' (atau lokasi terpilih).
    2. Mencatat mutasi keluar append-only ke stock_movements dengan reason 'RETURN_TO_SUPPLIER'.
    3. Mengurangi Hutang Usaha (AP) supplier terkait via jurnal otomatis:
       - DEBIT: Hutang Usaha (Akun 2000)
       - KREDIT: Persediaan (Akun 1200)
    """
    tenant_id_str = str(current_tenant_id)
    item_id_str = str(payload.item_id)
    ret_number = f"RET-{datetime.now().strftime('%Y%m%d')}-{str(uuid4())[:4].upper()}"

    try:
        # 1. Cari lokasi asal retur (default ke Gudang Karantina / Defect)
        quarantine_loc_id = None
        if payload.from_location_id:
            quarantine_loc_id = str(payload.from_location_id)
        else:
            q_res = await db.execute(
                text("SELECT id FROM public.locations WHERE tenant_id = :tenant_id AND (name ILIKE '%karantina%' OR name ILIKE '%defect%') LIMIT 1"),
                {"tenant_id": tenant_id_str}
            )
            q_row = q_res.mappings().first()
            if q_row:
                quarantine_loc_id = str(q_row["id"])
            else:
                # Fallback ke Gudang Pusat
                w_res = await db.execute(
                    text("SELECT id FROM public.locations WHERE tenant_id = :tenant_id AND type = 'warehouse' LIMIT 1"),
                    {"tenant_id": tenant_id_str}
                )
                w_row = w_res.mappings().first()
                quarantine_loc_id = str(w_row["id"]) if w_row else None

        if not quarantine_loc_id:
            raise HTTPException(status_code=400, detail="Lokasi gudang karantina tidak ditemukan.")

        # 2. Cek ketersediaan stok barang defect di lokasi tersebut
        item_res = await db.execute(
            text("SELECT id, name, base_price FROM public.items WHERE id = :id AND tenant_id = :tenant_id"),
            {"id": item_id_str, "tenant_id": tenant_id_str}
        )
        item_data = item_res.mappings().first()
        if not item_data:
            raise HTTPException(status_code=404, detail="Barang tidak ditemukan.")

        stock_res = await db.execute(
            text("SELECT on_hand FROM public.stock_levels WHERE item_id = :item_id AND location_id = :loc_id AND tenant_id = :tenant_id"),
            {"item_id": item_id_str, "loc_id": quarantine_loc_id, "tenant_id": tenant_id_str}
        )
        stock_row = stock_res.mappings().first()
        current_quarantine_stock = int(stock_row["on_hand"]) if stock_row else 0

        if current_quarantine_stock < payload.qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stok di karantina tidak mencukupi untuk retur. Tersedia: {current_quarantine_stock} unit, diminta retur: {payload.qty} unit."
            )

        unit_price = payload.return_price if payload.return_price is not None else int(item_data["base_price"])
        total_value = unit_price * payload.qty

        # 3. Potong stok dari gudang karantina
        new_quarantine_stock = current_quarantine_stock - payload.qty
        await db.execute(
            text("""
                UPDATE public.stock_levels 
                SET on_hand = :new_stock, updated_at = timezone('utc'::text, now())
                WHERE item_id = :item_id AND location_id = :loc_id AND tenant_id = :tenant_id
            """),
            {"new_stock": new_quarantine_stock, "item_id": item_id_str, "loc_id": quarantine_loc_id, "tenant_id": tenant_id_str}
        )

        # 4. Catat mutasi stok keluar append-only
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (
                    id, tenant_id, item_id, location_id, qty_delta, reason, ref_id, created_at
                ) VALUES (
                    gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, 'RETURN_TO_SUPPLIER', :ref_id, timezone('utc'::text, now())
                )
            """),
            {
                "tenant_id": tenant_id_str,
                "item_id": item_id_str,
                "loc_id": quarantine_loc_id,
                "delta": -payload.qty,
                "ref_id": f"{ret_number} - Supplier: {payload.supplier_name} ({payload.reason})"
            }
        )

        # 5. Auto-Journal: DR Hutang Usaha (2000), CR Persediaan (1200)
        journal_success = False
        try:
            coa_map = await get_or_create_default_accounts(current_tenant_id, db)
            ap_acc = coa_map.get("2000")  # Hutang Usaha
            inv_acc = coa_map.get("1200") # Persediaan

            if ap_acc and inv_acc:
                await create_auto_journal(
                    tenant_id=current_tenant_id,
                    transaction_date=date.today(),
                    description=f"Retur Barang Defect ke Supplier {payload.supplier_name} ({ret_number})",
                    reference_type="SUPPLIER_RETURN",
                    reference_id=uuid4(),
                    lines=[
                        {"account_id": ap_acc["id"], "debit": total_value, "credit": 0},
                        {"account_id": inv_acc["id"], "debit": 0, "credit": total_value}
                    ],
                    db=db
                )
                journal_success = True
        except Exception:
            pass

        await db.commit()

        return ReturnToSupplierResponse(
            success=True,
            message=f"Berhasil meretur {payload.qty} unit '{item_data['name']}' ke {payload.supplier_name}.",
            return_number=ret_number,
            item_name=item_data["name"],
            qty_returned=payload.qty,
            return_unit_price=unit_price,
            total_return_value=total_value,
            remaining_quarantine_stock=new_quarantine_stock,
            journal_created=journal_success
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memproses retur ke supplier: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 6: PINDAHKAN BARANG KE KARANTINA / DEFECT (QUARANTINE TRANSFER)
# ==============================================================================

@router.post("/quarantine-defect")
async def transfer_to_quarantine(
    payload: QuarantineTransferPayload,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Memindahkan barang cacat/rusak dari toko/gudang normal ke Gudang Karantina.
    """
    tenant_id_str = str(current_tenant_id)
    item_id_str = str(payload.item_id)
    from_loc_id = str(payload.from_location_id)

    try:
        # Cari lokasi karantina
        q_res = await db.execute(
            text("SELECT id, name FROM public.locations WHERE tenant_id = :tenant_id AND (name ILIKE '%karantina%' OR name ILIKE '%defect%') LIMIT 1"),
            {"tenant_id": tenant_id_str}
        )
        q_row = q_res.mappings().first()
        if not q_row:
            q_id = str(uuid4())
            await db.execute(
                text("INSERT INTO public.locations (id, tenant_id, name, type, is_active) VALUES (:id, :tenant_id, 'Gudang Karantina / Defect', 'warehouse', true)"),
                {"id": q_id, "tenant_id": tenant_id_str}
            )
            to_quarantine_id = q_id
        else:
            to_quarantine_id = str(q_row["id"])

        # Cek stok asal
        stock_res = await db.execute(
            text("SELECT on_hand FROM public.stock_levels WHERE item_id = :item_id AND location_id = :loc_id AND tenant_id = :tenant_id"),
            {"item_id": item_id_str, "loc_id": from_loc_id, "tenant_id": tenant_id_str}
        )
        stock_row = stock_res.mappings().first()
        current_from_stock = int(stock_row["on_hand"]) if stock_row else 0

        if current_from_stock < payload.qty:
            raise HTTPException(status_code=400, detail="Stok di lokasi asal tidak mencukupi untuk dikarantina.")

        # Kurangi dari lokasi asal
        await db.execute(
            text("UPDATE public.stock_levels SET on_hand = on_hand - :qty WHERE item_id = :item_id AND location_id = :loc_id AND tenant_id = :tenant_id"),
            {"qty": payload.qty, "item_id": item_id_str, "loc_id": from_loc_id, "tenant_id": tenant_id_str}
        )

        # Tambahkan ke lokasi karantina
        await db.execute(
            text("""
                INSERT INTO public.stock_levels (id, tenant_id, item_id, location_id, on_hand, reserved, updated_at)
                VALUES (gen_random_uuid(), :tenant_id, :item_id, :q_id, :qty, 0, timezone('utc'::text, now()))
                ON CONFLICT (tenant_id, item_id, location_id)
                DO UPDATE SET on_hand = public.stock_levels.on_hand + EXCLUDED.on_hand, updated_at = timezone('utc'::text, now())
            """),
            {"tenant_id": tenant_id_str, "item_id": item_id_str, "q_id": to_quarantine_id, "qty": payload.qty}
        )

        # Catat mutasi append-only
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (id, tenant_id, item_id, location_id, qty_delta, reason, ref_id)
                VALUES (gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, 'TRANSFER_TO_QUARANTINE', :ref_id)
            """),
            {"tenant_id": tenant_id_str, "item_id": item_id_str, "loc_id": from_loc_id, "delta": -payload.qty, "ref_id": payload.notes}
        )
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (id, tenant_id, item_id, location_id, qty_delta, reason, ref_id)
                VALUES (gen_random_uuid(), :tenant_id, :item_id, :loc_id, :delta, 'RECEIVED_IN_QUARANTINE', :ref_id)
            """),
            {"tenant_id": tenant_id_str, "item_id": item_id_str, "loc_id": to_quarantine_id, "delta": payload.qty, "ref_id": payload.notes}
        )

        await db.commit()

        return {
            "success": True,
            "message": f"Berhasil memindahkan {payload.qty} unit barang ke Gudang Karantina.",
            "quarantine_location_id": to_quarantine_id,
            "qty_quarantined": payload.qty
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# ENDPOINT 7: DAFTAR BARANG DEFECT / DI LOKASI KARANTINA
# ==============================================================================

@router.get("/quarantine-items")
async def list_quarantine_items(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil daftar seluruh barang yang sedang berada di Gudang Karantina / Defect.
    """
    try:
        query = text("""
            SELECT 
                i.id AS item_id,
                i.sku,
                i.name,
                i.category,
                i.base_price,
                COALESCE(sl.on_hand, 0) AS quarantine_qty,
                l.id AS location_id,
                l.name AS location_name
            FROM public.stock_levels sl
            JOIN public.items i ON i.id = sl.item_id AND i.tenant_id = sl.tenant_id
            JOIN public.locations l ON l.id = sl.location_id AND l.tenant_id = sl.tenant_id
            WHERE sl.tenant_id = :tenant_id
              AND (l.name ILIKE '%karantina%' OR l.name ILIKE '%defect%')
              AND sl.on_hand > 0
            ORDER BY sl.on_hand DESC, i.name ASC;
        """)
        res = await db.execute(query, {"tenant_id": str(current_tenant_id)})
        rows = res.mappings().all()

        return [
            {
                "item_id": r["item_id"],
                "sku": r["sku"],
                "name": r["name"],
                "category": r["category"],
                "base_price": int(r["base_price"]),
                "quarantine_qty": int(r["quarantine_qty"]),
                "location_id": r["location_id"],
                "location_name": r["location_name"],
                "total_defect_value": int(r["base_price"]) * int(r["quarantine_qty"])
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
