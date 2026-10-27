import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, create_engine
from uuid import UUID
from pathlib import Path

from app.main import app
from app.core.config import get_settings

# Identitas Tenant Uji
TENANT_A_ID = UUID("11111111-1111-1111-1111-111111111111")
TENANT_B_ID = UUID("22222222-2222-2222-2222-222222222222")

# ==============================================================================
# 1. SETUP DATABASE (SYNC - SESSION SCOPE)
# Berjalan SEKALI di awal, SEBELUM event loop async tes dimulai.
# ==============================================================================
@pytest.fixture(scope="session", autouse=True)
def setup_database():
    settings = get_settings()
    # Ubah asyncpg URL menjadi sync URL (psycopg2) untuk operasi DDL
    sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
    engine = create_engine(sync_url)

    sql_file_path = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "db-schema"
        / "001_foundation.sql"
    )
    
    if sql_file_path.exists():
        with engine.begin() as conn:
            # Eksekusi skema
            conn.execute(text(sql_file_path.read_text(encoding="utf-8")))
            # Insert tenant uji
            conn.execute(
                text("""
                    INSERT INTO public.tenants (id, name, slug)
                    VALUES 
                        (:a, 'Tenant A', 'tenant-a'),
                        (:b, 'Tenant B', 'tenant-b')
                    ON CONFLICT (id) DO NOTHING;
                """),
                {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)}
            )
    
    yield
    
    # Cleanup
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM public.products WHERE tenant_id IN (:a, :b)"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.tenants WHERE id IN (:a, :b)"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
    
    engine.dispose()

# ==============================================================================
# 2. ASYNC CLIENT (SESSION SCOPE)
# CRITICAL FIX: Menggunakan scope="session" agar selaras dengan 
# asyncio_default_fixture_loop_scope="session" di pytest.ini.
# Ini mencegah FastAPI app lifespan mematikan database engine di antara test.
# ==============================================================================
@pytest_asyncio.fixture(scope="session")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# ==============================================================================
# 3. TEST CASES
# ==============================================================================
@pytest.mark.asyncio
async def test_tenant_isolation(client: AsyncClient):
    headers_a = {"X-Tenant-ID": str(TENANT_A_ID)}
    headers_b = {"X-Tenant-ID": str(TENANT_B_ID)}

    # Buat produk untuk A
    res_a = await client.post("/api/v1/products", json={"name": "Produk A", "base_price": 10000}, headers=headers_a)
    assert res_a.status_code == 201
    id_a = res_a.json()["id"]

    # Buat produk untuk B
    res_b = await client.post("/api/v1/products", json={"name": "Produk B", "base_price": 20000}, headers=headers_b)
    assert res_b.status_code == 201
    id_b = res_b.json()["id"]

    # Cek A hanya lihat A
    list_a = await client.get("/api/v1/products", headers=headers_a)
    assert list_a.status_code == 200
    ids_a = [p["id"] for p in list_a.json()]
    assert id_a in ids_a
    assert id_b not in ids_a, "DATA BOCOR! Tenant A lihat data B!"

@pytest.mark.asyncio
async def test_cross_tenant_write_blocked(client: AsyncClient):
    headers_a = {"X-Tenant-ID": str(TENANT_A_ID)}
    payload = {
        "name": "Produk Jahat",
        "base_price": 999,
        "tenant_id": str(TENANT_B_ID) # Coba selundupkan ke B
    }
    
    res = await client.post("/api/v1/products", json=payload, headers=headers_a)
    assert res.status_code == 403, f"Harusnya 403, tapi dapat {res.status_code}"
    assert "cross-tenant" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_missing_tenant_header_fails(client: AsyncClient):
    response = await client.get("/api/v1/products")
    assert response.status_code == 401
    assert "Header 'X-Tenant-ID' wajib disertakan" in response.json()["detail"]
