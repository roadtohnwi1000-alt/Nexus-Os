from typing import AsyncGenerator
from uuid import UUID
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import get_settings
from app.core.security import get_current_tenant_id, get_ai_service_tenant_id

settings = get_settings()

# Engine database asynchronous dengan NullPool
# 1. NullPool mencegah connection reuse antar-event-loop di pytest-asyncio
#    yang menyebabkan error 'RuntimeError: Event loop is closed'.
# 2. Sangat ideal untuk Supabase karena pooling sudah ditangani di server-side (Supavisor / PgBouncer).
# 3. statement_cache_size=0 dan prepared_statement_cache_size=0 WAJIB untuk Supabase Pooler.
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
)

# Session factory untuk membuat sesi transaksi database
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_raw_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Menyediakan sesi database mentah (tanpa isolasi tenant_id).
    HANYA digunakan untuk operasi internal platform, registrasi awal tenant,
    dan setup database testing.
    """
    async with AsyncSessionLocal() as session:
        yield session

async def get_tenant_db(
    tenant_id: UUID = Depends(get_current_tenant_id)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency FastAPI yang membuka koneksi/sesi database terisolasi untuk tenant aktif.

    Alur Eksekusi:
    1. Membuka koneksi baru yang terikat pada event loop aktif saat ini.
    2. Menurunkan role ke 'authenticated' agar BYPASSRLS milik superuser mati.
    3. Mengeksekusi query runtime PostgreSQL: `SELECT set_config('app.tenant_id', :tenant_id, true)`.
    4. Meng-yield sesi yang terisolasi ke endpoint handler.
    5. Melakukan commit otomatis saat keluar dari context manager jika sukses,
       atau rollback otomatis jika terjadi exception/error.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Turunkan role ke 'authenticated' agar BYPASSRLS milik superuser mati
            await session.execute(text("SET LOCAL ROLE authenticated"))
            # Injeksi parameter session PostgreSQL scoped ke transaksi saat ini (is_local = true)
            # Menggunakan set_config() fungsi resmi PostgreSQL yang mendukung parameterized query aman
            await session.execute(
                text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_id)}
            )
            try:
                yield session
                # Transaksi berhasil diselesaikan, blok session.begin() melakukan commit otomatis
            except Exception:
                await session.rollback()
                raise

async def get_ai_tenant_db(
    tenant_id: UUID = Depends(get_ai_service_tenant_id)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency database khusus untuk AI Typed Tools API.
    Mengekstrak tenant_id secara aman dari Service Token (JWT)
    dan menginisialisasi session PostgreSQL terisolasi via RLS.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text("SET LOCAL ROLE authenticated"))
            await session.execute(
                text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_id)}
            )
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
