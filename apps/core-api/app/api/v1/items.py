import json
from typing import List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, ProgrammingError, IntegrityError
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.api.v1.schemas import ItemCreate, ItemResponse

router = APIRouter(prefix="/items", tags=["Universal Items"])

@router.get("", response_model=List[ItemResponse])
async def list_items(
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Mengambil seluruh item katalog milik tenant aktif (Universal Catalog).

    🧠 CATATAN ARSITEKTUR (BUKTI RLS & UNIVERSAL CATALOG):
    Query SQL: `SELECT id, name, base_price, attributes, sku, item_type, active FROM public.items`
    TIDAK menggunakan klausa `WHERE tenant_id = ...`.
    PostgreSQL Row-Level Security (RLS) otomatis menyaring baris berdasarkan
    session context `app.tenant_id`.
    Tenant Spa hanya melihat jasanya, dan Tenant Distributor hanya melihat barang fisiknya,
    meskipun keduanya disimpan di tabel yang sama!
    """
    result = await db.execute(
        text("""
            SELECT id, name, base_price, attributes, sku, item_type, active
            FROM public.items
            ORDER BY created_at DESC
        """)
    )
    rows = result.mappings().all()
    return [
        ItemResponse(
            id=row["id"],
            name=row["name"],
            base_price=row["base_price"],
            attributes=row["attributes"] if isinstance(row["attributes"], dict) else {},
            sku=row["sku"],
            item_type=row["item_type"],
            active=row["active"]
        )
        for row in rows
    ]

@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menambahkan item katalog baru untuk tenant aktif.
    Mendukung item fisik ('stocked'), jasa ('service'), maupun 'digital'.
    Atribut dinamis disimpan secara fleksibel di kolom JSONB.
    """
    target_tenant_id = payload.tenant_id if payload.tenant_id is not None else current_tenant_id
    sku = payload.sku or f"{payload.item_type[:3].upper()}-{uuid4().hex[:8].upper()}"

    try:
        result = await db.execute(
            text("""
                INSERT INTO public.items (
                    tenant_id, sku, name, item_type, base_price, attributes, active
                ) VALUES (
                    :tenant_id, :sku, :name, :item_type, :base_price, :attributes, true
                )
                RETURNING id, name, base_price, attributes, sku, item_type, active
            """),
            {
                "tenant_id": str(target_tenant_id),
                "sku": sku,
                "name": payload.name,
                "item_type": payload.item_type,
                "base_price": payload.base_price,
                "attributes": json.dumps(payload.attributes)
            }
        )
        row = result.mappings().one()
        return ItemResponse(
            id=row["id"],
            name=row["name"],
            base_price=row["base_price"],
            attributes=row["attributes"] if isinstance(row["attributes"], dict) else {},
            sku=row["sku"],
            item_type=row["item_type"],
            active=row["active"]
        )
    except (DBAPIError, ProgrammingError, IntegrityError) as e:
        error_msg = str(e).lower()
        if (
            "row-level security" in error_msg
            or "row level security" in error_msg
            or "violates" in error_msg
            or "permission denied" in error_msg
            or "insufficientprivilege" in error_msg
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-tenant write operation blocked by RLS policy"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan item katalog: {str(e)}"
        )
