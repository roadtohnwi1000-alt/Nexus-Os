from typing import AsyncGenerator, Optional
from uuid import UUID
from fastapi import Header, HTTPException, status, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal

class TenantContext(BaseModel):
    """
    Model konteks tenant dan user yang sedang aktif pada request HTTP saat ini.
    """
    tenant_id: UUID
    user_id: UUID
    role: str = "member"

async def get_current_tenant_context(
    request: Request,
    authorization: Optional[str] = Header(None, description="Bearer JWT Token"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id", description="Override / Mock Tenant ID untuk testing")
) -> TenantContext:
    """
    Mengekstrak dan memvalidasi kredensial tenant dari header HTTP.
    
    🧠 CATATAN ARSITEKTUR:
    Pada arsitektur multi-tenant, setiap request WAJIB memiliki identitas tenant yang jelas.
    Di fase foundation ini, kita menyediakan mock decoder yang membaca dari JWT
    atau X-Tenant-Id header untuk kemudahan pengujian developer, sebelum integrasi
    lengkap dengan Supabase Auth JWT.
    """
    # 1. Jika ada token Bearer, validasi (mock logic di fase 0)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        # Mock payload JWT (nantinya diverifikasi menggunakan jose.jwt.decode)
        # Jika token adalah dummy uuid, gunakan sebagai tenant_id
        try:
            # Fallback jika user mengirim UUID langsung di bearer token untuk testing
            tenant_uuid = UUID(token)
            return TenantContext(
                tenant_id=tenant_uuid,
                user_id=UUID("00000000-0000-0000-0000-000000000001"),
                role="owner"
            )
        except ValueError:
            pass

    # 2. Fallback untuk pengujian manual menggunakan header X-Tenant-Id
    if x_tenant_id:
        try:
            return TenantContext(
                tenant_id=UUID(x_tenant_id),
                user_id=UUID("00000000-0000-0000-0000-000000000001"),
                role="admin"
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Header 'X-Tenant-Id' harus berupa format UUID yang valid."
            )

    # 3. Jika tidak ada identitas tenant, tolak request secara fail-closed
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autentikasi gagal: Tenant context tidak ditemukan. Sertakan 'Authorization: Bearer <token>' atau 'X-Tenant-Id: <uuid>'."
    )

async def get_tenant_db(
    tenant_ctx: TenantContext = Depends(get_current_tenant_context)
) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency yang membuka sesi transaksi PostgreSQL dan MENYUNTIKKAN
    tenant_id ke session state menggunakan 'SET LOCAL app.tenant_id = ...'.

    🧠 CATATAN ARSITEKTUR KRUSIAL (MENGAPA SET LOCAL DI DALAM TRANSAKSI?):
    1. 'SET LOCAL' hanya berlaku selama durasi transaksi aktif ('BEGIN ... COMMIT/ROLLBACK').
    2. Jika kita menggunakan 'SET' biasa tanpa LOCAL, nilai tenant_id akan menempel
       pada koneksi fisik di connection pool. Ketika koneksi tersebut digunakan kembali
       oleh tenant lain, akan terjadi KEBOCORAN DATA ANTAR-TENANT (Fatal Security Breach!).
    3. Dengan 'SET LOCAL' di dalam blok transaksi, PostgreSQL menjamin bahwa begitu
       transaksi selesai, parameter 'app.tenant_id' otomatis di-reset ke nilai default (NULL).
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Turunkan role ke 'authenticated' agar BYPASSRLS milik superuser mati
            await session.execute(text("SET LOCAL ROLE authenticated"))
            # Injeksi tenant_id ke dalam session runtime PostgreSQL via set_config
            await session.execute(
                text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_ctx.tenant_id)}
            )
            try:
                yield session
                # Transaksi akan di-commit otomatis jika tidak ada exception
            except Exception:
                await session.rollback()
                raise
