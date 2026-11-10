import json
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status, HTTPException, Header
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.api.v1.schemas import OrderCreate, OrderResponse, OrderLineResponse
from app.services.journal_service import create_auto_journal, get_or_create_default_accounts

router = APIRouter(prefix="/orders", tags=["Orders & Stock Ledger"])

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Membuat pesanan baru (Draft atau Confirmed Order) dengan reservasi/pemotongan stok atomik,
    snapshot harga multi-tier (Retail, Reseller, Teknisi), dan validasi Split Payments (CASH, QRIS, TRANSFER).

    🧠 ATURAN IDEMPOTENCY & OFFLINE SYNC:
    1. Header 'Idempotency-Key' memiliki prioritas utama dari background sync Dexie.js.
    2. Jika key sudah pernah sukses, return order response yang sama persis (mencegah duplikasi stok/jurnal).
    3. Jika stok tidak mencukupi, kembalikan 409 Conflict agar klien offline-first menandai transaksi sebagai FAILED.
    """
    # 1. Cek Idempotency Key dari Header atau Body
    idempotency_key = idempotency_key_header or payload.idempotency_key or f"idem-{uuid4().hex}"

    # Cek tabel idempotency_keys
    try:
        existing_key_res = await db.execute(
            text("""
                SELECT response_code, response_body
                FROM public.idempotency_keys
                WHERE tenant_id = :tenant_id AND idempotency_key = :key AND status = 'SUCCESS'
            """),
            {"tenant_id": str(current_tenant_id), "key": idempotency_key}
        )
        existing_key_row = existing_key_res.mappings().first()
        if existing_key_row and existing_key_row.get("response_body"):
            # Kembalikan response yang sama persis tanpa mutasi ulang
            return OrderResponse(**existing_key_row["response_body"])
    except Exception:
        pass

    # Cek tabel orders langsung sebagai perlindungan ganda
    existing_order = await db.execute(
        text("""
            SELECT id, tenant_id, contact_id, status, total_minor, idempotency_key, payments
            FROM public.orders
            WHERE idempotency_key = :idem
        """),
        {"idem": idempotency_key}
    )
    existing_row = existing_order.mappings().first()
    if existing_row:
        # Kembalikan order yang sudah ada tanpa duplikasi transaksi
        lines_res = await db.execute(
            text("""
                SELECT id, item_id, sku_snapshot, name_snapshot, qty, unit_price_minor
                FROM public.order_lines
                WHERE order_id = :order_id
            """),
            {"order_id": existing_row["id"]}
        )
        existing_lines = [
            OrderLineResponse(
                id=line["id"],
                item_id=line["item_id"],
                sku_snapshot=line["sku_snapshot"],
                name_snapshot=line["name_snapshot"],
                qty=line["qty"],
                unit_price_minor=line["unit_price_minor"],
                line_total_minor=line["qty"] * line["unit_price_minor"]
            )
            for line in lines_res.mappings().all()
        ]
        
        # Ambil payments historis jika ada
        payments_data = []
        if existing_row.get("payments"):
            payments_data = existing_row["payments"] if isinstance(existing_row["payments"], list) else []

        return OrderResponse(
            id=existing_row["id"],
            tenant_id=existing_row["tenant_id"],
            contact_id=existing_row["contact_id"],
            status=existing_row["status"],
            total_minor=existing_row["total_minor"],
            idempotency_key=existing_row["idempotency_key"],
            items=existing_lines,
            payments=payments_data
        )

    # 2. Validasi Item & Ambil Data Snapshot dari Tabel items (Multi-Tier Harga)
    item_ids = [item.item_id for item in payload.items]
    try:
        items_query = await db.execute(
            text("""
                SELECT id, sku, name, item_type, base_price, active,
                       COALESCE(price_retail, base_price) AS price_retail,
                       COALESCE(price_reseller, CAST(base_price * 0.90 AS BIGINT)) AS price_reseller,
                       COALESCE(price_technician, CAST(base_price * 0.85 AS BIGINT)) AS price_technician
                FROM public.items
                WHERE id = ANY(:item_ids)
            """),
            {"item_ids": item_ids}
        )
        items_map = {row["id"]: row for row in items_query.mappings().all()}
    except Exception:
        items_query = await db.execute(
            text("""
                SELECT id, sku, name, item_type, base_price, active
                FROM public.items
                WHERE id = ANY(:item_ids)
            """),
            {"item_ids": item_ids}
        )
        items_map = {row["id"]: row for row in items_query.mappings().all()}

    lines_to_create = []
    total_minor = 0
    tier = (payload.pricing_tier or "retail").lower().strip()

    for line in payload.items:
        if line.item_id not in items_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item dengan ID {line.item_id} tidak ditemukan di katalog tenant ini."
            )
        item_data = items_map[line.item_id]
        if not item_data["active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item '{item_data['name']}' sedang tidak aktif."
            )

        # Tentukan harga satuan sesuai Tier Pelanggan yang dipilih
        if tier == "reseller":
            unit_price = int(item_data.get("price_reseller") or int(item_data["base_price"] * 0.90))
        elif tier == "technician":
            unit_price = int(item_data.get("price_technician") or int(item_data["base_price"] * 0.85))
        else:
            unit_price = int(item_data.get("price_retail") or item_data["base_price"])

        line_total = unit_price * line.qty
        total_minor += line_total

        lines_to_create.append({
            "item_id": line.item_id,
            "sku_snapshot": item_data["sku"],
            "name_snapshot": item_data["name"],
            "item_type": item_data["item_type"],
            "qty": line.qty,
            "unit_price_minor": unit_price
        })

    # 3. Validasi Bisnis: Split Payment (Jika Ada Pembayaran)
    has_payments = bool(payload.payments and len(payload.payments) > 0)
    payments_data = []

    if has_payments:
        total_paid = sum(int(p.amount) for p in payload.payments) # type: ignore
        if total_paid != total_minor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total pembayaran (Rp {total_paid:,}) tidak sesuai dengan total tagihan (Rp {total_minor:,})."
            )
        payments_data = [
            {"payment_method": p.payment_method, "amount": int(p.amount)}
            for p in payload.payments # type: ignore
        ]

    order_status = "confirmed" if has_payments else "draft"

    # 4. Penanganan Stok (Reservasi atau Langsung Mutasi Terjual)
    if order_status == "confirmed":
        for line_info in lines_to_create:
            stock_update = await db.execute(
                text("""
                    UPDATE public.stock_levels
                    SET on_hand = on_hand - :qty,
                        updated_at = timezone('utc'::text, now())
                    WHERE item_id = :item_id
                      AND on_hand >= :qty
                    RETURNING on_hand
                """),
                {
                    "item_id": line_info["item_id"],
                    "qty": line_info["qty"]
                }
            )
            updated_stock = stock_update.mappings().first()
            if not updated_stock:
                # Jika item bertipe jasa (service), lewati pembatasan stok
                if line_info["item_type"] != "service":
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Stok tidak mencukupi untuk item '{line_info['name_snapshot']}'."
                    )
    else:
        # Status draft: Reservasi stok
        for line_info in lines_to_create:
            stock_update = await db.execute(
                text("""
                    UPDATE public.stock_levels
                    SET reserved = reserved + :qty,
                        updated_at = timezone('utc'::text, now())
                    WHERE item_id = :item_id
                      AND (on_hand - reserved) >= :qty
                    RETURNING on_hand, reserved
                """),
                {
                    "item_id": line_info["item_id"],
                    "qty": line_info["qty"]
                }
            )
            updated_stock = stock_update.mappings().first()
            if not updated_stock and line_info["item_type"] != "service":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Stok tidak mencukupi untuk reservasi item '{line_info['name_snapshot']}'."
                )

    # 5. Insert Order Header
    new_order_id = uuid4()
    order_insert = await db.execute(
        text("""
            INSERT INTO public.orders (
                id, tenant_id, contact_id, status, total_minor, idempotency_key, payments
            ) VALUES (
                :id, :tenant_id, :contact_id, :status, :total_minor, :idempotency_key, :payments::jsonb
            )
            RETURNING id, tenant_id, contact_id, status, total_minor, idempotency_key
        """),
        {
            "id": str(new_order_id),
            "tenant_id": str(current_tenant_id),
            "contact_id": payload.contact_id,
            "status": order_status,
            "total_minor": total_minor,
            "idempotency_key": idempotency_key,
            "payments": json.dumps(payments_data)
        }
    )
    order_row = order_insert.mappings().one()

    # 6. Insert Order Lines dengan Snapshot Permanen
    created_lines = []
    for line_info in lines_to_create:
        line_insert = await db.execute(
            text("""
                INSERT INTO public.order_lines (
                    tenant_id, order_id, item_id, sku_snapshot, name_snapshot,
                    qty, unit_price_minor
                ) VALUES (
                    :tenant_id, :order_id, :item_id, :sku_snapshot, :name_snapshot,
                    :qty, :unit_price_minor
                )
                RETURNING id, item_id, sku_snapshot, name_snapshot, qty, unit_price_minor
            """),
            {
                "tenant_id": str(current_tenant_id),
                "order_id": str(new_order_id),
                "item_id": line_info["item_id"],
                "sku_snapshot": line_info["sku_snapshot"],
                "name_snapshot": line_info["name_snapshot"],
                "qty": line_info["qty"],
                "unit_price_minor": line_info["unit_price_minor"]
            }
        )
        line_row = line_insert.mappings().one()
        created_lines.append(
            OrderLineResponse(
                id=line_row["id"],
                item_id=line_row["item_id"],
                sku_snapshot=line_row["sku_snapshot"],
                name_snapshot=line_row["name_snapshot"],
                qty=line_row["qty"],
                unit_price_minor=line_row["unit_price_minor"],
                line_total_minor=line_row["qty"] * line_row["unit_price_minor"]
            )
        )

    # 7. Jika Order Langsung Confirmed, Catat Mutasi Fisik di stock_movements
    if order_status == "confirmed":
        for line_info in lines_to_create:
            if line_info["item_type"] != "service":
                await db.execute(
                    text("""
                        INSERT INTO public.stock_movements (
                            tenant_id, item_id, qty_delta, reason, ref_id
                        ) VALUES (
                            :tenant_id, :item_id, :qty_delta, 'sale', :ref_id
                        )
                    """),
                    {
                        "tenant_id": str(current_tenant_id),
                        "item_id": line_info["item_id"],
                        "qty_delta": -line_info["qty"],
                        "ref_id": str(new_order_id)
                    }
                )

    # 8. Simpan ke Tabel Relasional order_payments jika tabel tersedia
    if payments_data:
        for p in payments_data:
            try:
                await db.execute(
                    text("""
                        INSERT INTO public.order_payments (
                            id, tenant_id, order_id, payment_method, amount, created_at
                        ) VALUES (
                            gen_random_uuid(), :tenant_id, :order_id, :method, :amount, timezone('utc'::text, now())
                        )
                    """),
                    {
                        "tenant_id": str(current_tenant_id),
                        "order_id": str(new_order_id),
                        "method": p["payment_method"],
                        "amount": p["amount"]
                    }
                )
            except Exception:
                # Jika tabel order_payments belum dibuat, data tetap aman di orders.payments JSONB
                pass

    # 9. Auto-Accounting: Catat jurnal double-entry otomatis untuk penjualan POS (Pemisahan Revenue)
    if order_status == "confirmed" and total_minor > 0:
        try:
            from datetime import date
            coa_map = await get_or_create_default_accounts(current_tenant_id, db)
            kas_acc = coa_map.get("1000")
            rev_service_acc = coa_map.get("4000")
            rev_sparepart_acc = coa_map.get("4100")
            rev_acc_acc = coa_map.get("4200")

            # Hitung proporsi pendapatan berdasarkan jenis produk
            service_rev = sum(l["qty"] * l["unit_price_minor"] for l in lines_to_create if l["item_type"] == "service")
            
            aksesoris_rev = 0
            sparepart_rev = 0
            for l in lines_to_create:
                if l["item_type"] != "service":
                    sku_upper = l["sku_snapshot"].upper()
                    name_upper = l["name_snapshot"].upper()
                    if (
                        sku_upper.startswith("ACC") 
                        or sku_upper.startswith("CASE") 
                        or sku_upper.startswith("CAB")
                        or "CASING" in name_upper 
                        or "KABEL" in name_upper 
                        or "CHARGER" in name_upper
                    ):
                        aksesoris_rev += (l["qty"] * l["unit_price_minor"])
                    else:
                        sparepart_rev += (l["qty"] * l["unit_price_minor"])

            auto_lines = []
            if kas_acc:
                auto_lines.append({
                    "account_id": kas_acc["id"],
                    "debit": total_minor,
                    "credit": 0
                })

            if service_rev > 0 and rev_service_acc:
                auto_lines.append({
                    "account_id": rev_service_acc["id"],
                    "debit": 0,
                    "credit": service_rev
                })
            if sparepart_rev > 0 and rev_sparepart_acc:
                auto_lines.append({
                    "account_id": rev_sparepart_acc["id"],
                    "debit": 0,
                    "credit": sparepart_rev
                })
            if aksesoris_rev > 0 and rev_acc_acc:
                auto_lines.append({
                    "account_id": rev_acc_acc["id"],
                    "debit": 0,
                    "credit": aksesoris_rev
                })

            # Jika auto_lines seimbang (Debit == Credit) dan minimal 2 baris
            if (
                len(auto_lines) >= 2 
                and sum(x["debit"] for x in auto_lines) == sum(x["credit"] for x in auto_lines)
            ):
                await create_auto_journal(
                    tenant_id=current_tenant_id,
                    transaction_date=date.today(),
                    description=f"Penjualan POS Kasir #{str(new_order_id)[:8]}",
                    reference_type="POS_SALE",
                    reference_id=new_order_id,
                    lines=auto_lines,
                    db=db
                )
        except Exception as e:
            # Kegagalan jurnal tidak menggagalkan transaksi penjualan
            pass

    await db.commit()

    final_response = OrderResponse(
        id=order_row["id"],
        tenant_id=order_row["tenant_id"],
        contact_id=order_row["contact_id"],
        status=order_row["status"],
        total_minor=order_row["total_minor"],
        idempotency_key=order_row["idempotency_key"],
        items=created_lines,
        payments=payments_data
    )

    # 10. Simpan cache respon ke tabel idempotency_keys
    try:
        await db.execute(
            text("""
                INSERT INTO public.idempotency_keys (
                    tenant_id, idempotency_key, status, resource_id, response_code, response_body
                ) VALUES (
                    :tenant_id, :key, 'SUCCESS', :resource_id, 201, :response_body::jsonb
                )
                ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
                SET status = 'SUCCESS', response_body = EXCLUDED.response_body, updated_at = timezone('utc'::text, now())
            """),
            {
                "tenant_id": str(current_tenant_id),
                "key": idempotency_key,
                "resource_id": str(order_row["id"]),
                "response_body": json.dumps(final_response.model_dump(mode="json"))
            }
        )
        await db.commit()
    except Exception:
        pass

    return final_response

@router.post("/{id}/confirm", response_model=OrderResponse)
async def confirm_order(
    id: UUID,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengonfirmasi pesanan (Confirm Order):
    1. Validasi status order saat ini (harus 'draft').
    2. Ubah status order menjadi 'confirmed'.
    3. Kurangi stok di `stock_levels` (on_hand = on_hand - qty, reserved = reserved - qty).
    4. Catat mutasi fisik di `stock_movements` (Append-Only Ledger) dengan `qty_delta` negatif.
    """
    # 1. Ambil Order
    order_query = await db.execute(
        text("""
            SELECT id, tenant_id, contact_id, status, total_minor, idempotency_key
            FROM public.orders
            WHERE id = :order_id
        """),
        {"order_id": id}
    )
    order_row = order_query.mappings().first()
    if not order_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order dengan ID {id} tidak ditemukan."
        )

    # 2. Ambil detail baris order
    lines_query = await db.execute(
        text("""
            SELECT id, item_id, sku_snapshot, name_snapshot, qty, unit_price_minor
            FROM public.order_lines
            WHERE order_id = :order_id
        """),
        {"order_id": id}
    )
    order_lines = lines_query.mappings().all()

    if order_row["status"] == "confirmed":
        # Idempotent confirmation
        result_lines = [
            OrderLineResponse(
                id=line["id"],
                item_id=line["item_id"],
                sku_snapshot=line["sku_snapshot"],
                name_snapshot=line["name_snapshot"],
                qty=line["qty"],
                unit_price_minor=line["unit_price_minor"],
                line_total_minor=line["qty"] * line["unit_price_minor"]
            )
            for line in order_lines
        ]
        return OrderResponse(
            id=order_row["id"],
            tenant_id=order_row["tenant_id"],
            contact_id=order_row["contact_id"],
            status="confirmed",
            total_minor=order_row["total_minor"],
            idempotency_key=order_row["idempotency_key"],
            items=result_lines
        )

    if order_row["status"] != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hanya order dengan status 'draft' yang dapat dikonfirmasi."
        )

    # 3. Proses Pengurangan Stok & Catat di Ledger Mutasi (Append-Only)
    for line in order_lines:
        # Catat mutasi keluar di stock_movements (APPEND-ONLY LEDGER)
        await db.execute(
            text("""
                INSERT INTO public.stock_movements (
                    tenant_id, item_id, qty_delta, reason, ref_id
                ) VALUES (
                    :tenant_id, :item_id, :qty_delta, 'sale', :ref_id
                )
            """),
            {
                "tenant_id": str(current_tenant_id),
                "item_id": line["item_id"],
                "qty_delta": -line["qty"], # Negatif karena barang keluar/terjual
                "ref_id": str(id)
            }
        )

        # Update stock_levels cache: on_hand dan reserved dipotong sekaligus
        await db.execute(
            text("""
                UPDATE public.stock_levels
                SET on_hand = on_hand - :qty,
                    reserved = reserved - :qty,
                    updated_at = timezone('utc'::text, now())
                WHERE item_id = :item_id
            """),
            {
                "item_id": line["item_id"],
                "qty": line["qty"]
            }
        )

    # 4. Ubah status order menjadi 'confirmed'
    await db.execute(
        text("""
            UPDATE public.orders
            SET status = 'confirmed',
                updated_at = timezone('utc'::text, now())
            WHERE id = :order_id
        """),
        {"order_id": id}
    )

    result_lines = [
        OrderLineResponse(
            id=line["id"],
            item_id=line["item_id"],
            sku_snapshot=line["sku_snapshot"],
            name_snapshot=line["name_snapshot"],
            qty=line["qty"],
            unit_price_minor=line["unit_price_minor"],
            line_total_minor=line["qty"] * line["unit_price_minor"]
        )
        for line in order_lines
    ]

    return OrderResponse(
        id=order_row["id"],
        tenant_id=order_row["tenant_id"],
        contact_id=order_row["contact_id"],
        status="confirmed",
        total_minor=order_row["total_minor"],
        idempotency_key=order_row["idempotency_key"],
        items=result_lines
    )
