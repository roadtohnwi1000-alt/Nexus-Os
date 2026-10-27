import sys
from pathlib import Path
from uuid import UUID, uuid4
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, create_engine

# Tambahkan direktori ai-worker ke path sistem untuk mengimpor cs_agent
ai_worker_dir = Path(__file__).resolve().parent.parent.parent / "ai-worker"
if str(ai_worker_dir) not in sys.path:
    sys.path.append(str(ai_worker_dir))

from app.main import app
from app.core.config import get_settings
from app.core.security import create_service_token
from agents.cs_agent import run_cs_agent

TENANT_A_ID = UUID("55555555-5555-5555-5555-555555555555")
TENANT_B_ID = UUID("66666666-6666-6666-6666-666666666666")

KOPI_ITEM_ID = UUID("77777777-7777-7777-7777-777777777777")
CONVERSATION_ID = UUID("88888888-8888-8888-8888-888888888888")

settings = get_settings()
sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(sync_url)

@pytest.fixture(scope="session", autouse=True)
def setup_ai_database():
    """
    Setup database pengujian sinkron untuk Fase 5:
    1. Membaca dan menjalankan seluruh migrasi 001 hingga 005.
    2. Menyiapkan Tenant A dan Tenant B.
    3. Menyiapkan item 'Kopi Susu' dan level stok awal untuk Tenant A.
    4. Menyiapkan sesi percakapan WhatsApp untuk Tenant A.
    5. Cleanup saat selesai testing.
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
        "004_inbox_queue.sql",
        "005_ai_agent.sql"
    ]

    with sync_engine.begin() as conn:
        for file_name in migration_files:
            file_path = schema_dir / file_name
            if file_path.exists():
                sql_content = file_path.read_text(encoding="utf-8")
                conn.execute(text(sql_content))

        # 1. Daftarkan Tenant A dan Tenant B
        conn.execute(
            text("""
                INSERT INTO public.tenants (id, name, slug)
                VALUES 
                    (:a, 'Kopi Kenangan Senja', 'kopi-kenangan'),
                    (:b, 'Teh Tarik Nusantara', 'teh-tarik')
                ON CONFLICT (id) DO NOTHING;
            """),
            {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)}
        )

        # 2. Set context tenant A untuk setup data
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_A_ID)}
        )

        # 3. Masukkan item 'Kopi Susu' untuk Tenant A
        conn.execute(
            text("""
                INSERT INTO public.items (
                    id, tenant_id, name, sku, item_type, base_price, attributes, active
                ) VALUES (
                    :id, :tid, 'Kopi Susu Gula Aren', 'KOPI-001', 'stocked', 25000,
                    '{"volume": "250ml", "temperature": "iced"}'::jsonb, true
                )
                ON CONFLICT (id) DO UPDATE SET base_price = 25000;
            """),
            {"id": str(KOPI_ITEM_ID), "tid": str(TENANT_A_ID)}
        )

        # 4. Masukkan stok 50 di stock_levels untuk item Kopi Susu
        conn.execute(
            text("""
                INSERT INTO public.stock_levels (
                    tenant_id, item_id, on_hand, reserved
                ) VALUES (
                    :tid, :iid, 50, 0
                )
                ON CONFLICT (tenant_id, item_id) 
                DO UPDATE SET on_hand = 50, reserved = 0;
            """),
            {"tid": str(TENANT_A_ID), "iid": str(KOPI_ITEM_ID)}
        )

        # 5. Masukkan sesi percakapan WhatsApp untuk Tenant A
        conn.execute(
            text("""
                INSERT INTO public.conversations (
                    id, tenant_id, channel, channel_identifier, status
                ) VALUES (
                    :cid, :tid, 'whatsapp', '+62811111111', 'active'
                )
                ON CONFLICT (tenant_id, channel, channel_identifier) DO NOTHING;
            """),
            {"cid": str(CONVERSATION_ID), "tid": str(TENANT_A_ID)}
        )

    yield

    # Cleanup data uji Fase 5
    with sync_engine.begin() as conn:
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_A_ID)}
        )
        conn.execute(text("DELETE FROM public.ai_runs WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.ai_drafts WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.order_lines WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.orders WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.conversations WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.stock_levels WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.items WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})
        conn.execute(text("DELETE FROM public.tenants WHERE id IN (:a, :b);"), {"a": str(TENANT_A_ID), "b": str(TENANT_B_ID)})

    sync_engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def client():
    """Client asynchronous FastAPI bertransport ASGI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# ==============================================================================
# TEST 1: CS AGENT END-TO-END EXECUTION & HUMAN-IN-THE-LOOP APPROVAL
# ==============================================================================
@pytest.mark.asyncio
async def test_cs_agent_end_to_end_and_approval(client: AsyncClient):
    """
    PENGUJIAN END-TO-END AGENT ZONA B & HUMAN-IN-THE-LOOP APPROVAL:
    1. Agent menerima pesan 'Halo, ada Kopi Susu ga?'.
    2. Agent memanggil Typed Tools (/search-items, /check-stock, /get-price) via Service Token.
    3. Output Guard memastikan harga persis 25000 tanpa halusinasi.
    4. Draft tersimpan di `ai_drafts` berstatus 'pending'.
    5. Staff meng-approve draft lewat endpoint `/api/v1/ai-drafts/{id}/approve`.
    6. Assert status draft berubah jadi 'approved' dan status percakapan berubah jadi 'ai_replied'.
    """
    # Buat Service Token sah bertanda tangan server untuk Tenant A
    service_token = create_service_token(TENANT_A_ID)

    # 1. Jalankan CS Agent (Zona B)
    agent_result = await run_cs_agent(
        conversation_id=CONVERSATION_ID,
        message_body="Halo, ada Kopi Susu ga?",
        service_token=service_token,
        client=client
    )

    # 2. Verifikasi respon agent dan eksekusi Typed Tools
    assert agent_result["status"] == "success", f"Agent gagal: {agent_result}"
    assert agent_result["item_name"] == "Kopi Susu Gula Aren"
    assert agent_result["price"] == 25000
    assert agent_result["stock"] == 50
    assert "25000" in agent_result["reply_text"]
    draft_id = agent_result["draft_id"]

    # 3. Verifikasi draft tercatat di tabel `ai_drafts` lewat API staff (Zona A)
    headers_staff = {"X-Tenant-ID": str(TENANT_A_ID)}
    get_drafts_res = await client.get("/api/v1/ai-drafts/", headers=headers_staff)
    assert get_drafts_res.status_code == 200
    drafts = get_drafts_res.json()
    matching_draft = next((d for d in drafts if d["id"] == draft_id), None)
    assert matching_draft is not None, "Draft tidak ditemukan di daftar pending staff"
    assert matching_draft["status"] == "pending"
    assert matching_draft["payload"]["price"] == 25000

    # 4. Staff melakukan approval
    approve_res = await client.post(f"/api/v1/ai-drafts/{draft_id}/approve", headers=headers_staff)
    assert approve_res.status_code == 200, f"Approval gagal: {approve_res.text}"
    approve_data = approve_res.json()
    assert approve_data["status"] == "approved"
    assert approve_data["conversation_status"] == "ai_replied"

# ==============================================================================
# TEST 2: DRAFT REJECTION & HUMAN HANDOFF
# ==============================================================================
@pytest.mark.asyncio
async def test_ai_draft_rejection_and_human_handoff(client: AsyncClient):
    """
    PENGUJIAN PENOLAKAN DRAFT OLEH STAF:
    1. Simpan draft baru.
    2. Staff memanggil reject endpoint `/api/v1/ai-drafts/{id}/reject`.
    3. Assert status draft berubah jadi 'rejected'.
    4. Assert status percakapan berubah jadi 'human' (dialihkan ke operator manusia).
    """
    service_token = create_service_token(TENANT_A_ID)
    headers_tools = {"Authorization": f"Bearer {service_token}"}
    headers_staff = {"X-Tenant-ID": str(TENANT_A_ID)}

    # Buat draft usulan manual via tools endpoint
    draft_payload = {
        "conversation_id": str(CONVERSATION_ID),
        "kind": "reply",
        "status": "pending",
        "payload": {
            "conversation_id": str(CONVERSATION_ID),
            "reply_text": "Harga diskon spesial Rp 10.000",
            "price": 10000
        },
        "generated_by": "test_agent"
    }
    create_res = await client.post("/internal/ai-tools/drafts", headers=headers_tools, json=draft_payload)
    assert create_res.status_code == 201
    draft_id = create_res.json()["id"]

    # Staff menolak draft karena diskon tidak sah
    reject_res = await client.post(
        f"/api/v1/ai-drafts/{draft_id}/reject",
        headers=headers_staff,
        json={"reason": "Diskon tidak sesuai kebijakan toko"}
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["status"] == "rejected"
    assert reject_data["conversation_status"] == "human"

# ==============================================================================
# TEST 3: KEAMANAN SERVICE TOKEN & ISOLASI RLS TYPED TOOLS
# ==============================================================================
@pytest.mark.asyncio
async def test_typed_tools_security_and_rls_isolation(client: AsyncClient):
    """
    PENGUJIAN KEAMANAN TYPED TOOLS API:
    1. Tanpa Authorization Header -> 401 Unauthorized.
    2. Menggunakan token palsu / unsigned JWT -> 401 Unauthorized.
    3. Menggunakan Service Token milik Tenant B:
       - Query search 'Kopi Susu' harus KOSONG [] karena item milik Tenant A (RLS isolasi mutlak).
       - Memeriksa item_id milik Tenant A harus 404 Not Found.
    """
    # 1. Tanpa header token
    no_auth_res = await client.get("/internal/ai-tools/search-items?q=Kopi")
    assert no_auth_res.status_code == 401

    # 2. Token palsu / signature tidak cocok
    fake_token_res = await client.get(
        "/internal/ai-tools/search-items?q=Kopi",
        headers={"Authorization": "Bearer token.palsu.sembarangan"}
    )
    assert fake_token_res.status_code == 401

    # 3. Service Token sah untuk Tenant B
    token_tenant_b = create_service_token(TENANT_B_ID)
    headers_b = {"Authorization": f"Bearer {token_tenant_b}"}

    # Cari Kopi Susu (Item ini milik Tenant A)
    search_b = await client.get("/internal/ai-tools/search-items?q=Kopi", headers=headers_b)
    assert search_b.status_code == 200
    results_b = search_b.json()
    # Kritis: Tenant B DILARANG melihat item Tenant A
    assert len(results_b) == 0, f"PELANGGARAN RLS: Tenant B dapat melihat item Tenant A: {results_b}"

    # Coba cek stok item Kopi Susu milik Tenant A menggunakan token Tenant B
    stock_b = await client.get(f"/internal/ai-tools/check-stock?item_id={KOPI_ITEM_ID}", headers=headers_b)
    assert stock_b.status_code == 404, f"PELANGGARAN RLS: Tenant B dapat mengakses stok Tenant A: {stock_b.text}"
