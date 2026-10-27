from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, ProgrammingError, IntegrityError
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/products", tags=["Products"])

class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, json_schema_extra={"example": "Espresso Nusantara"})
    sku: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "ESP-001"})
    # Aturan Besar #2 & #3: base_price bertipe BIGINT minor units (Rp 25.000 = 25000)
    base_price: int = Field(..., ge=0, description="Harga dasar produk dalam minor units", json_schema_extra={"example": 25000})
    # Kolom opsional untuk pengujian cross-tenant write violation
    tenant_id: Optional[UUID] = Field(
        None,
        description="Override tenant_id untuk testing penolakan RLS cross-tenant write"
    )

class ProductResponse(BaseModel):
    id: UUID
    name: str
    base_price: int

@router.get("", response_model=List[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Mengambil daftar produk untuk tenant aktif.

    🧠 CATATAN ARSITEKTUR (BUKTI RLS):
    Perhatikan query SQL di bawah ini:
    `SELECT id, name, base_price FROM products`
    Query ini sama sekali TIDAK menyertakan klausa `WHERE tenant_id = ...`.
    Engine Row-Level Security (RLS) PostgreSQL secara otomatis dan transparan
    menyaring baris tabel sehingga HANYA data yang memiliki `tenant_id = app.tenant_id()`
    yang dikembalikan ke aplikasi.
    """
    result = await db.execute(
        text("SELECT id, name, base_price FROM public.products ORDER BY created_at DESC")
    )
    rows = result.mappings().all()
    return [
        ProductResponse(
            id=row["id"],
            name=row["name"],
            base_price=row["base_price"]
        )
        for row in rows
    ]

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreateRequest,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menambahkan produk baru ke database tenant.
    
    Jika payload.tenant_id diisi dengan UUID tenant lain (berbeda dari context aktif),
    PostgreSQL RLS dengan policy 'WITH CHECK (tenant_id = app.tenant_id())' akan
    secara deterministik menolak operasi INSERT dan melempar security violation error!
    """
    # Gunakan tenant_id dari payload jika sengaja diisi untuk pengujian cross-tenant,
    # jika tidak ada, gunakan tenant_id yang terautentikasi secara aman.
    target_tenant_id = payload.tenant_id if payload.tenant_id is not None else current_tenant_id
    sku = payload.sku or f"SKU-{uuid4().hex[:8].upper()}"

    try:
        result = await db.execute(
            text("""
                INSERT INTO public.products (
                    tenant_id, name, sku, base_price, is_active
                ) VALUES (
                    :tenant_id, :name, :sku, :base_price, true
                )
                RETURNING id, name, base_price
            """),
            {
                "tenant_id": str(target_tenant_id),
                "name": payload.name,
                "sku": sku,
                "base_price": payload.base_price
            }
        )
        row = result.mappings().one()
        return ProductResponse(
            id=row["id"],
            name=row["name"],
            base_price=row["base_price"]
        )
    except (DBAPIError, ProgrammingError, IntegrityError) as e:
        # Tangkap error PostgreSQL RLS (misal: InsufficientPrivilegeError / policy violation)
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
        # Jika bukan RLS violation, lempar kembali agar ditangani global handler
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal menyimpan produk: {str(e)}"
        )
