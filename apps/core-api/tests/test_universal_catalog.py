from pathlib import Path
from uuid import UUID
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, create_engine
from app.main import app
from app.core.config import get_settings

# Identitas Tenant Uji
# Tenant A: Bisnis Jasa Spa / Klinik Relaksasi
TENANT_A_ID = UUID("11111111-1111-1111-1111-111111111111")
# Tenant B: Bisnis Distribusi Grosir Barang Plastik
TENANT_B_ID = UUID("22222222-2222-2222-2222-222222222222")

@pytest.fixture(scope="session", autouse=True)
def setup_catalog_database():
    """
    Setup database pengujian sinkron untuk Fase 2:
    1. Membaca dan menjalankan seluruh skema SQL migrasi (001 dan 002).
    2. Mendaftarkan entitas Tenant A dan Tenant B.
    3. Membersihkan data uji items dan tenants setelah suite test selesai.
    """
    settings = get_settings()
    sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
    engine = create_engine(sync_url)

    schema_dir = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "db-schema"
    )

    migration_files = ["001_foundation.sql", "002_catalog_contacts.sql"]

    with engine.begin() as conn:
        for file_name in migration_files:
            file_path = schema_dir / file_name
            if file_path.exists():
                sql_content = file_path.read_text(encoding="utf-8")
                # Eksekusi DDL migrasi
                conn.execute(text(sql_content))

        # Daftarkan Tenant A dan Tenant B jika belum ada
        conn.execute(
            text("""
                INSERT INTO public.tenants (id, name, slug)
                VALUES 
                    (:a, 'Aura Spa & Wellness', 'aura-spa'),
                    (:b, 'Nusantara Plastik Grosir', 'nusantara-plastik')
                ON CONFLICT (id) DO NOTHING;
            """),
            {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)}
        )

    yield

    # Cleanup tabel items dan tenants
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM public.items WHERE tenant_id IN (:a, :b);"),
            {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)}
        )
        conn.execute(
            text("DELETE FROM public.tenants WHERE id IN (:a, :b);"),
            {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)}
        )

    engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def client():
    """Client pengujian asynchronous FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_universal_items_isolation(client: AsyncClient):
    """
    MEMBUKTIKAN KONSEP UNIVERSAL CORE & ROW-LEVEL SECURITY:
    1. Tenant A (Spa) menyimpan data JASA dengan atribut durasi & terapis.
    2. Tenant B (Distributor) menyimpan data BARANG dengan atribut material & MOQ.
    3. Kedua tenant memakai SATU TABEL yang sama ('items').
    4. Assert: Tenant A HANYA melihat jasa miliknya, Tenant B HANYA melihat barang miliknya.
    """
    headers_a = {"X-Tenant-ID": str(TENANT_A_ID)}
    headers_b = {"X-Tenant-ID": str(TENANT_B_ID)}

    # 1. Tenant A membuat item JASA
    payload_a = {
        "name": "Pijat 60 Menit",
        "item_type": "service",
        "base_price": 150000, # Rp 150.000 dalam minor units
        "attributes": {
            "durasi_menit": 60,
            "terapis": "Ani"
        }
    }
    res_a = await client.post("/api/v1/items", json=payload_a, headers=headers_a)
    assert res_a.status_code == 201, f"Tenant A gagal create item: {res_a.text}"
    item_a_id = res_a.json()["id"]

    # 2. Tenant B membuat item BARANG FISIK
    payload_b = {
        "name": "Gelas Plastik 500ml",
        "item_type": "stocked",
        "base_price": 25000, # Rp 25.000 dalam minor units
        "attributes": {
            "material": "PP",
            "moq": 100
        }
    }
    res_b = await client.post("/api/v1/items", json=payload_b, headers=headers_b)
    assert res_b.status_code == 201, f"Tenant B gagal create item: {res_b.text}"
    item_b_id = res_b.json()["id"]

    # 3. Tenant A melakukan query katalog
    list_a = await client.get("/api/v1/items", headers=headers_a)
    assert list_a.status_code == 200
    items_a = list_a.json()
    item_ids_a = [item["id"] for item in items_a]
    names_a = [item["name"] for item in items_a]

    assert item_a_id in item_ids_a, "Jasa milik Tenant A harus muncul di katalog Tenant A"
    assert "Pijat 60 Menit" in names_a
    assert item_b_id not in item_ids_a, "PELANGGARAN RLS: Barang milik Tenant B bocor ke Tenant A!"
    assert "Gelas Plastik 500ml" not in names_a

    # Verifikasi integritas JSONB & BIGINT Tenant A
    spa_item = next(item for item in items_a if item["id"] == item_a_id)
    assert spa_item["base_price"] == 150000
    assert spa_item["attributes"]["durasi_menit"] == 60
    assert spa_item["attributes"]["terapis"] == "Ani"

    # 4. Tenant B melakukan query katalog
    list_b = await client.get("/api/v1/items", headers=headers_b)
    assert list_b.status_code == 200
    items_b = list_b.json()
    item_ids_b = [item["id"] for item in items_b]
    names_b = [item["name"] for item in items_b]

    assert item_b_id in item_ids_b, "Barang milik Tenant B harus muncul di katalog Tenant B"
    assert "Gelas Plastik 500ml" in names_b
    assert item_a_id not in item_ids_b, "PELANGGARAN RLS: Jasa milik Tenant A bocor ke Tenant B!"
    assert "Pijat 60 Menit" not in names_b

    # Verifikasi integritas JSONB & BIGINT Tenant B
    distributor_item = next(item for item in items_b if item["id"] == item_b_id)
    assert distributor_item["base_price"] == 25000
    assert distributor_item["attributes"]["material"] == "PP"
    assert distributor_item["attributes"]["moq"] == 100

@pytest.mark.asyncio
async def test_cross_tenant_item_write_blocked(client: AsyncClient):
    """
    MENGUJI KEAMANAN PENULISAN SILANG PADA UNIVERSAL CATALOG:
    Tenant A mencoba menyisipkan item katalog untuk Tenant B.
    Wajib ditolak HTTP 403 Forbidden oleh RLS.
    """
    headers_a = {"X-Tenant-ID": str(TENANT_A_ID)}
    malicious_payload = {
        "name": "Item Selundupan",
        "item_type": "digital",
        "base_price": 50000,
        "tenant_id": str(TENANT_B_ID) # Upaya bypass tenant_id
    }

    res = await client.post("/api/v1/items", json=malicious_payload, headers=headers_a)
    assert res.status_code == 403
    assert "cross-tenant" in res.json()["detail"].lower()
