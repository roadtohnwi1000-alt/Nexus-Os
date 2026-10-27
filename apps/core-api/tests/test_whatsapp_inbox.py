from pathlib import Path
from uuid import UUID
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, create_engine
from app.main import app
from app.core.config import get_settings
from worker.jobs import process_inbound_message

TENANT_A_ID = UUID("11111111-1111-1111-1111-111111111111")

settings = get_settings()
sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(sync_url)

@pytest.fixture(scope="session", autouse=True)
def setup_inbox_database():
    """
    Setup database pengujian sinkron untuk Fase 4:
    1. Membaca dan menjalankan seluruh migrasi 001 hingga 004.
    2. Mendaftarkan Tenant A jika belum ada.
    3. Membersihkan data uji setelah testing selesai.
    """
    schema_dir = (
        Path(__file__).resolve().parent.parent.parent.parent
        / "packages"
        / "db-schema"
    )

    migration_files = [
        "001_foundation.sql",
        "002_catalog_contacts.sql",
        "003_orders_stock.sql",
        "004_inbox_queue.sql"
    ]

    with sync_engine.begin() as conn:
        for file_name in migration_files:
            file_path = schema_dir / file_name
            if file_path.exists():
                sql_content = file_path.read_text(encoding="utf-8")
                conn.execute(text(sql_content))

        # Daftarkan Tenant A jika belum ada
        conn.execute(
            text("""
                INSERT INTO public.tenants (id, name, slug)
                VALUES (:a, 'Toko Digital Sejahtera', 'toko-digital')
                ON CONFLICT (id) DO NOTHING;
            """),
            {"a": str(TENANT_A_ID)}
        )

    yield

    # Cleanup data uji Fase 4
    with sync_engine.begin() as conn:
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_A_ID)}
        )
        conn.execute(text("DELETE FROM public.ai_drafts WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.jobs WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.inbound_events WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.messages WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.conversations WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.contacts WHERE tenant_id = :a;"), {"a": str(TENANT_A_ID)})
        conn.execute(text("DELETE FROM public.tenants WHERE id = :a;"), {"a": str(TENANT_A_ID)})

    sync_engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def client():
    """Client asynchronous FastAPI bertransport ASGI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_whatsapp_webhook_ingestion_and_idempotency(client: AsyncClient):
    """
    PENGUJIAN WEBHOOK WHATSAPP & IDEMPOTENCY:
    1. Kirim webhook pesan WhatsApp pertama -> Assert 200 OK & tercatat di jobs + inbound_events.
    2. Kirim pesan yang sama kedua kalinya (ID duplikat) -> Assert 200 OK tapi status 'already_received' (Idempotent).
    """
    headers = {"X-Tenant-ID": str(TENANT_A_ID)}
    payload = {
        "sender_number": "+6281234567890",
        "sender_name": "Budi Santoso",
        "content": "Halo, apakah stok Gelas Plastik masih ada?",
        "external_id": "wamid.test_wa_001"
    }

    # 1. Kirim pesan pertama kali
    res1 = await client.post("/api/v1/webhooks/whatsapp", json=payload, headers=headers)
    assert res1.status_code == 200, f"Gagal terima webhook: {res1.text}"
    data1 = res1.json()
    assert data1["status"] == "received"
    assert data1["external_id"] == "wamid.test_wa_001"
    job_id = data1["job_id"]
    assert job_id is not None

    # Verifikasi audit log inbound_events & jobs di database
    with sync_engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(TENANT_A_ID)}
            )
            event_row = conn.execute(
                text("SELECT external_id, processed FROM public.inbound_events WHERE external_id = :ext_id"),
                {"ext_id": "wamid.test_wa_001"}
            ).mappings().one()
            assert event_row["external_id"] == "wamid.test_wa_001"
            assert event_row["processed"] is False

            job_row = conn.execute(
                text("SELECT job_type, status FROM public.jobs WHERE id = :job_id"),
                {"job_id": job_id}
            ).mappings().one()
            assert job_row["job_type"] == "process_inbound_message"
            assert job_row["status"] == "queued"

    # 2. Kirim pesan yang sama persis kedua kalinya (Simulasi retry dari Meta)
    res2 = await client.post("/api/v1/webhooks/whatsapp", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "already_received"
    assert "idempotent" in data2["message"].lower()

@pytest.mark.asyncio
async def test_job_worker_processes_message():
    """
    PENGUJIAN ASYNC WORKER:
    Menjalankan handler `process_inbound_message` untuk memproses payload pesan masuk:
    - Kontak dibuat di tabel 'contacts'.
    - Sesi percakapan dibuat di tabel 'conversations'.
    - Pesan masuk tersimpan di tabel 'messages'.
    - Proposal draft balasan tersimpan di 'ai_drafts' (AI Sandbox).
    - Status job diperbarui menjadi 'completed'.
    """
    message_payload = {
        "sender_number": "+6281234567890",
        "sender_name": "Budi Santoso",
        "content": "Halo, apakah stok Gelas Plastik masih ada?",
        "external_id": "wamid.test_wa_001"
    }

    # Ambil job_id dari database
    with sync_engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(TENANT_A_ID)}
            )
            job = conn.execute(
                text("SELECT id FROM public.jobs WHERE status = 'queued' ORDER BY created_at DESC LIMIT 1")
            ).mappings().one()
            job_id = str(job["id"])

    # Eksekusi worker job
    result = await process_inbound_message(
        ctx=None,
        tenant_id=str(TENANT_A_ID),
        payload=message_payload,
        job_id=job_id
    )

    assert result["status"] == "success"
    conversation_id = result["conversation_id"]

    # Verifikasi integritas relasional setelah worker selesai
    with sync_engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("SELECT set_config('app.tenant_id', :tid, true)"),
                {"tid": str(TENANT_A_ID)}
            )

            # Cek tabel conversations
            conv = conn.execute(
                text("SELECT channel, channel_identifier, status FROM public.conversations WHERE id = :id"),
                {"id": conversation_id}
            ).mappings().one()
            assert conv["channel"] == "whatsapp"
            assert conv["channel_identifier"] == "+6281234567890"
            assert conv["status"] == "active"

            # Cek tabel messages
            msg = conn.execute(
                text("SELECT direction, content, external_id FROM public.messages WHERE conversation_id = :id"),
                {"id": conversation_id}
            ).mappings().one()
            assert msg["direction"] == "inbound"
            assert msg["content"] == "Halo, apakah stok Gelas Plastik masih ada?"
            assert msg["external_id"] == "wamid.test_wa_001"

            # Cek tabel ai_drafts (AI Sandbox - Iron Rule #3)
            draft = conn.execute(
                text("SELECT draft_type, status, generated_by FROM public.ai_drafts WHERE tenant_id = :a ORDER BY created_at DESC LIMIT 1"),
                {"a": str(TENANT_A_ID)}
            ).mappings().one()
            assert draft["draft_type"] == "whatsapp_reply_proposal"
            assert draft["status"] == "pending_review"
            assert draft["generated_by"] == "langgraph_agent"

            # Cek tabel jobs (sudah completed)
            completed_job = conn.execute(
                text("SELECT status FROM public.jobs WHERE id = :job_id"),
                {"job_id": job_id}
            ).mappings().one()
            assert completed_job["status"] == "completed"

            # Cek inbound_events (sudah processed)
            inbound = conn.execute(
                text("SELECT processed FROM public.inbound_events WHERE external_id = :ext_id"),
                {"ext_id": "wamid.test_wa_001"}
            ).mappings().one()
            assert inbound["processed"] is True
