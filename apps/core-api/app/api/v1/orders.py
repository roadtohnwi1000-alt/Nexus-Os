from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.api.v1.schemas import OrderCreate, OrderResponse, OrderLineResponse

router = APIRouter(prefix="/orders", tags=["Orders & Stock Ledger"])

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Membuat pesanan baru (Draft Order) dengan reservasi stok atomik dan snapshot harga.

    Alur Transaksi:
    1. Cek Idempotency: Jika idempotency_key sudah ada, kembalikan pesanan yang ada.
    2. Validasi Item & Harga dari Database (Universal Catalog).
    3. Hitung total_minor menggunakan aritmatika integer murni (BIGINT).
    4. Reservasi Stok Atomik (Atomic Stock Reservation) pada `stock_levels`:
       Menggunakan klausa atomik `WHERE (on_hand - reserved) >= :qty` untuk mencegah race condition.
       Jika stok tidak cukup, tolak dengan 400 Bad Request.
    5. Simpan Order Header dan Order Lines dengan Snapshot SKU, Nama, dan Harga.
    """
    # 1. Cek Idempotency Key
    idempotency_key = payload.idempotency_key or f"idem-{uuid4().hex}"
    existing_order = await db.execute(
        text("""
            SELECT id, tenant_id, contact_id, status, total_minor, idempotency_key
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
        return OrderResponse(
            id=existing_row["id"],
            tenant_id=existing_row["tenant_id"],
            contact_id=existing_row["contact_id"],
            status=existing_row["status"],
            total_minor=existing_row["total_minor"],
            idempotency_key=existing_row["idempotency_key"],
            items=existing_lines
        )

    # 2. Validasi Item & Ambil Data Snapshot dari Tabel items
    item_ids = [item.item_id for item in payload.items]
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

        unit_price = item_data["base_price"]
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

    # 3. Reservasi Stok Atomik pada stock_levels
    for line_info in lines_to_create:
        # Cek apakah item memiliki record di stock_levels
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
        if not updated_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stok tidak mencukupi untuk item '{line_info['name_snapshot']}'."
            )

    # 4. Insert Order Header
    order_insert = await db.execute(
        text("""
            INSERT INTO public.orders (
                tenant_id, contact_id, status, total_minor, idempotency_key
            ) VALUES (
                :tenant_id, :contact_id, 'draft', :total_minor, :idempotency_key
            )
            RETURNING id, tenant_id, contact_id, status, total_minor, idempotency_key
        """),
        {
            "tenant_id": str(current_tenant_id),
            "contact_id": payload.contact_id,
            "total_minor": total_minor,
            "idempotency_key": idempotency_key
        }
    )
    order_row = order_insert.mappings().one()
    new_order_id = order_row["id"]

    # 5. Insert Order Lines dengan Snapshot Permanen
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
                "order_id": new_order_id,
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

    return OrderResponse(
        id=order_row["id"],
        tenant_id=order_row["tenant_id"],
        contact_id=order_row["contact_id"],
        status=order_row["status"],
        total_minor=order_row["total_minor"],
        idempotency_key=order_row["idempotency_key"],
        items=created_lines
    )

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
