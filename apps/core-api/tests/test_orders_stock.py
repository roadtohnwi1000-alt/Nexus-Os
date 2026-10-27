from pathlib import Path
from uuid import UUID
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, create_engine
from app.main import app
from app.core.config import get_settings

# Identitas Tenant & Item Uji
TENANT_A_ID = UUID("11111111-1111-1111-1111-111111111111")
TEST_ITEM_ID = UUID("33333333-3333-3333-3333-333333333333")

settings = get_settings()
sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(sync_url)

@pytest.fixture(scope="session", autouse=True)
def setup_orders_database():
    """
    Setup database pengujian sinkron untuk Fase 3:
    1. Membaca dan menjalankan migrasi 001, 002, dan 003.
    2. Mendaftarkan Tenant A, item uji 'Gelas Plastik', dan stok awal 100 di `stock_levels`.
    3. Membersihkan data uji setelah seluruh rangkaian test selesai.
    """
    schema_dir = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "db-schema"
    )

    migration_files = [
        "001_foundation.sql",
        "002_catalog_contacts.sql",
        "003_orders_stock.sql"
    ]

    with sync_engine.begin() as conn:
        for file_name in migration_files:
            file_path = schema_dir / file_name
            if file_path.exists():
                sql_content = file_path.read_text(encoding="utf-8")
                conn.execute(text(sql_content))

        # 1. Daftarkan Tenant A jika belum ada
        conn.execute(
            text("""
                INSERT INTO public.tenants (id, name, slug)
                VALUES (:a, 'Distribusi Maju Jaya', 'distribusi-maju')
                ON CONFLICT (id) DO NOTHING;
            """),
            {"a": str(TENANT_A_ID)}
        )

        # 2. Set context tenant_id agar RLS mengizinkan insert data tenant A
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_A_ID)}
        )

        # 3. Buat item uji 'Gelas Plastik' bertipe 'stocked'
        conn.execute(
            text("""
                INSERT INTO public.items (
                    id, tenant_id, sku, name, item_type, base_price, active
                ) VALUES (
                    :item_id, :tenant_id, 'GLS-500', 'Gelas Plastik', 'stocked', 25000, true
                )
                ON CONFLICT (id) DO NOTHING;
            """),
            {
                "item_id": str(TEST_ITEM_ID),
                "tenant_id": str(TENANT_A_ID)
            }
        )

        # 4. Inisialisasi stok awal: on_hand = 100, reserved = 0
        conn.execute(
            text("""
                INSERT INTO public.stock_levels (
                    tenant_id, item_id, on_hand, reserved
                ) VALUES (
                    :tenant_id, :item_id, 100, 0
                )
                ON CONFLICT (tenant_id, item_id) DO UPDATE
                SET on_hand = 100, reserved = 0;
            """),
            {
                "tenant_id": str(TENANT_A_ID),
                "item_id": str(TEST_ITEM_ID)
            }
        )

    yield

    # Cleanup tabel-tabel transaksi
    with sync_engine.begin() as conn:
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_A_ID)}
        )
        conn.execute(text("DELETE FROM public.stock_movements WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.order_lines WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.orders WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.stock_levels WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.items WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.tenants WHERE id = :a;"), {"a": str(TENANT_A_ID)})

    sync_engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def client():
    """Client asynchronous FastAPI bertransport ASGI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_order_creation_and_stock_reservation(client: AsyncClient):
    """
    PENGUJIAN RESERVASI STOK & KONFIRMASI ORDER (FASE 3):
    1. Tenant A membuat order sebanyak 10 item.
       - Assert order berstatus 'draft'.
       - Assert `stock_levels` reserved bertambah menjadi 10, on_hand tetap 100.
    2. Tenant A melakukan confirm order.
       - Assert order berstatus 'confirmed'.
       - Assert `stock_levels` on_hand berkurang menjadi 90, reserved kembali 0.
       - Assert `stock_movements` memiliki 1 baris mutasi keluar dengan qty_delta = -10.
    """
    headers = {"X-Tenant-ID": str(TENANT_A_ID)}

    # 1. Action: Buat Order 10 Gelas
    order_payload = {
        "items": [
            {
                "item_id": str(TEST_ITEM_ID),
                "qty": 10
            }
        ],
        "idempotency_key": "idem-order-test-001"
    }
    create_res = await client.post("/api/v1/orders", json=order_payload, headers=headers)
    assert create_res.status_code == 201, f"Gagal create order: {create_res.text}"
    order_data = create_res.json()

    assert order_data["status"] == "draft"
    assert order_data["total_minor"] == 250000 # 10 * 25.000 = 250.000
    order_id = order_data["id"]

    # 2. Assert: Cek stock_levels setelah reservasi (on_hand=100, reserved=10)
    with sync_engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(TENANT_A_ID)}
            )
            row = conn.execute(
                text("SELECT on_hand, reserved FROM public.stock_levels WHERE item_id = :item_id"),
                {"item_id": str(TEST_ITEM_ID)}
            ).mappings().one()

            assert row["on_hand"] == 100, "on_hand fisik tidak boleh berkurang saat masih draft"
            assert row["reserved"] == 10, "reserved harus bertambah 10 untuk menahan stok"

    # 3. Action: Konfirmasi Order
    confirm_res = await client.post(f"/api/v1/orders/{order_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200, f"Gagal confirm order: {confirm_res.text}"
    confirmed_data = confirm_res.json()
    assert confirmed_data["status"] == "confirmed"

    # 4. Assert: Cek status stok dan ledger mutasi setelah confirm
    with sync_engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(TENANT_A_ID)}
            )
            # Cek stock_levels (on_hand=90, reserved=0)
            stock_row = conn.execute(
                text("SELECT on_hand, reserved FROM public.stock_levels WHERE item_id = :item_id"),
                {"item_id": str(TEST_ITEM_ID)}
            ).mappings().one()

            assert stock_row["on_hand"] == 90, "on_hand harus berkurang menjadi 90 setelah confirm"
            assert stock_row["reserved"] == 0, "reserved harus kembali 0 setelah order terealisasi"

            # Cek stock_movements (Append-Only Ledger)
            movements = conn.execute(
                text("""
                    SELECT qty_delta, reason, ref_id 
                    FROM public.stock_movements 
                    WHERE item_id = :item_id AND ref_id = :order_id
                """),
                {
                    "item_id": str(TEST_ITEM_ID),
                    "order_id": str(order_id)
                }
            ).mappings().all()

            assert len(movements) == 1, "Harus ada tepat 1 baris mutasi stok dicatat"
            assert movements[0]["qty_delta"] == -10, "Mutasi keluar harus bernilai negatif (-10)"
            assert movements[0]["reason"] == "sale"

@pytest.mark.asyncio
async def test_order_exceeds_stock_rejected(client: AsyncClient):
    """
    NEGATIVE TEST:
    Mencoba memesan 1.000 item padahal sisa stok siap jual hanya 90.
    Wajib ditolak dengan 400 Bad Request ("Stok tidak mencukupi").
    """
    headers = {"X-Tenant-ID": str(TENANT_A_ID)}

    order_payload = {
        "items": [
            {
                "item_id": str(TEST_ITEM_ID),
                "qty": 1000 # Jauh melebihi stok yang ada
            }
        ]
    }

    res = await client.post("/api/v1/orders", json=order_payload, headers=headers)
    assert res.status_code == 400
    assert "stok tidak mencukupi" in res.json()["detail"].lower()
