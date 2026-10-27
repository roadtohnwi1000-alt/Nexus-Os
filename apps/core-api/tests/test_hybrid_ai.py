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

TENANT_HYBRID_A_ID = UUID("aaaa1111-1111-1111-1111-111111111111")
TENANT_HYBRID_B_ID = UUID("bbbb2222-2222-2222-2222-222222222222")

ITEM_SERUM_ID = UUID("cccc3333-3333-3333-3333-333333333333")
ITEM_TONER_ID = UUID("dddd4444-4444-4444-4444-444444444444")
CONVERSATION_HYBRID_ID = UUID("eeee5555-5555-5555-5555-555555555555")

settings = get_settings()
sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(sync_url)

@pytest.fixture(scope="session", autouse=True)
def setup_hybrid_database():
    """
    Setup database pengujian sinkron untuk Fase 7 (Hybrid AI):
    1. Membaca dan menjalankan seluruh migrasi 001 hingga 007.
    2. Menyiapkan Tenant A dan Tenant B.
    3. Menyiapkan produk (Serum Niacinamide & Toner Alkohol) untuk Tenant A.
    4. Menyiapkan basis pengetahuan ahli (expert_knowledge) untuk Tenant A.
    5. Menyiapkan sesi percakapan WhatsApp untuk Tenant A.
    6. Cleanup data uji saat selesai testing.
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
        "005_ai_agent.sql",
        "007_ai_training.sql"
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
                    (:a, 'Glow Skin Clinic', 'glow-skin'),
                    (:b, 'Herbal Natural Spa', 'herbal-natural')
                ON CONFLICT (id) DO NOTHING;
            """),
            {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)}
        )

        # 2. Set context tenant A untuk setup data
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_HYBRID_A_ID)}
        )

        # 3. Masukkan item katalog Tenant A (Serum Niacinamide & Toner Alkohol)
        conn.execute(
            text("""
                INSERT INTO public.items (
                    id, tenant_id, name, sku, item_type, base_price, attributes, active
                ) VALUES 
                    (:s_id, :tid, 'Serum Niacinamide', 'SERUM-NIA-01', 'stocked', 85000, '{"volume": "30ml"}'::jsonb, true),
                    (:t_id, :tid, 'Toner Astringent Alkohol', 'TONER-ALK-01', 'stocked', 45000, '{"volume": "100ml", "alcohol": true}'::jsonb, true)
                ON CONFLICT (id) DO NOTHING;
            """),
            {
                "s_id": str(ITEM_SERUM_ID),
                "t_id": str(ITEM_TONER_ID),
                "tid": str(TENANT_HYBRID_A_ID)
            }
        )

        # 4. Masukkan stok fisik untuk item Tenant A
        conn.execute(
            text("""
                INSERT INTO public.stock_levels (tenant_id, item_id, on_hand, reserved)
                VALUES 
                    (:tid, :s_id, 20, 0),
                    (:tid, :t_id, 15, 0)
                ON CONFLICT (tenant_id, item_id) 
                DO UPDATE SET on_hand = EXCLUDED.on_hand, reserved = 0;
            """),
            {
                "tid": str(TENANT_HYBRID_A_ID),
                "s_id": str(ITEM_SERUM_ID),
                "t_id": str(ITEM_TONER_ID)
            }
        )

        # 5. Masukkan basis pengetahuan ahli (expert_knowledge) untuk Tenant A
        conn.execute(
            text("""
                INSERT INTO public.expert_knowledge (
                    tenant_id, topic, content, is_active
                ) VALUES (
                    :tid,
                    'Skincare untuk kulit berminyak',
                    'Untuk kulit berminyak, gunakan pembersih berbasis air (water-based) dan pelembab gel ringan yang non-komedogenik. Sangat disarankan menggunakan Serum Niacinamide.',
                    true
                );
            """),
            {"tid": str(TENANT_HYBRID_A_ID)}
        )

        # 6. Masukkan sesi percakapan WhatsApp untuk Tenant A
        conn.execute(
            text("""
                INSERT INTO public.conversations (
                    id, tenant_id, channel, channel_identifier, status
                ) VALUES (
                    :cid, :tid, 'whatsapp', '+62899999999', 'active'
                )
                ON CONFLICT (tenant_id, channel, channel_identifier) DO NOTHING;
            """),
            {"cid": str(CONVERSATION_HYBRID_ID), "tid": str(TENANT_HYBRID_A_ID)}
        )

    yield

    # Cleanup data uji Fase 7
    with sync_engine.begin() as conn:
        conn.execute(
            text("SELECT set_config('app.tenant_id', :tid, true)"),
            {"tid": str(TENANT_HYBRID_A_ID)}
        )
        conn.execute(text("DELETE FROM public.expert_knowledge WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.ai_guidelines WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.ai_runs WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.ai_drafts WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.conversations WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.stock_levels WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.items WHERE tenant_id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})
        conn.execute(text("DELETE FROM public.tenants WHERE id IN (:a, :b);"), {"a": str(TENANT_HYBRID_A_ID), "b": str(TENANT_HYBRID_B_ID)})

    sync_engine.dispose()

@pytest_asyncio.fixture(scope="session")
async def client():
    """Client asynchronous FastAPI bertransport ASGI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# ==============================================================================
# TEST 1: EXPERT KNOWLEDGE CONSULTATION
# ==============================================================================
@pytest.mark.asyncio
async def test_hybrid_ai_expert_consultation(client: AsyncClient):
    """
    SKENARIO 1: KONSULTASI AHLI (EXPERT KNOWLEDGE)
    Pelanggan bertanya masalah spesifik: 'Wajah saya berminyak banget, apa yang cocok?'
    - AI harus mengidentifikasi topik dari expert_knowledge ('Skincare untuk kulit berminyak').
    - AI harus memberikan anjuran ahli (water-based / Serum Niacinamide).
    - Draft tersimpan di `ai_drafts` berstatus 'pending'.
    """
    token_a = create_service_token(TENANT_HYBRID_A_ID)

    agent_result = await run_cs_agent(
        conversation_id=CONVERSATION_HYBRID_ID,
        message_body="Wajah saya berminyak banget, apa yang cocok?",
        service_token=token_a,
        client=client
    )

    assert agent_result["status"] == "success"
    reply = agent_result["reply_text"]

    # Verifikasi bahwa balasan mengandung materi konsultasi ahli
    assert "panduan ahli" in reply.lower() or "saran ahli" in reply.lower()
    assert "water-based" in reply.lower() or "berminyak" in reply.lower()
    assert "serum niacinamide" in reply.lower()
    # Verifikasi harga produk internal terlampir secara akurat (85000)
    assert "85000" in reply
    assert agent_result["draft_id"] is not None

# ==============================================================================
# TEST 2: STRICT PRICE FROM DB (NO HALLUCINATIONS)
# ==============================================================================
@pytest.mark.asyncio
async def test_hybrid_ai_strict_price_from_database(client: AsyncClient):
    """
    SKENARIO 2: PERTANYAAN HARGA KATALOG (STRICT GUARDRAILS)
    Pelanggan bertanya: 'Berapa harga Serum Niacinamide?'
    - AI WAJIB mengambil harga dari tabel items (85000).
    - AI DILARANG mengarang atau mengubah angka harga.
    """
    token_a = create_service_token(TENANT_HYBRID_A_ID)

    agent_result = await run_cs_agent(
        conversation_id=CONVERSATION_HYBRID_ID,
        message_body="Berapa harga Serum Niacinamide?",
        service_token=token_a,
        client=client
    )

    assert agent_result["status"] == "success"
    assert agent_result["item_name"] == "Serum Niacinamide"
    assert agent_result["price"] == 85000
    assert "85000" in agent_result["reply_text"]

# ==============================================================================
# TEST 3: BUSINESS GUIDELINE ENFORCEMENT (ATURAN LARANGAN)
# ==============================================================================
@pytest.mark.asyncio
async def test_hybrid_ai_guidelines_enforcement(client: AsyncClient):
    """
    SKENARIO 3: ATURAN BISNIS & TONE OF VOICE (ai_guidelines)
    1. Tenant A menambahkan guideline via API: 'Jangan pernah merekomendasikan produk mengandung alkohol'.
    2. Pelanggan memicu produk alkohol: 'Ada toner yang mengandung alkohol ga?'.
    3. AI WAJIB mematuhi aturan dan menolak merekomendasikan produk beralkohol.
    """
    headers_staff = {"X-Tenant-ID": str(TENANT_HYBRID_A_ID)}

    # 1. Staff menginput guideline baru
    guideline_payload = {
        "category": "safety_rules",
        "instruction": "Jangan pernah merekomendasikan produk mengandung alkohol kepada pelanggan.",
        "is_active": True
    }
    create_res = await client.post(
        "/api/v1/ai-training/guidelines",
        headers=headers_staff,
        json=guideline_payload
    )
    assert create_res.status_code == 201

    # 2. Pelanggan bertanya tentang toner alkohol
    token_a = create_service_token(TENANT_HYBRID_A_ID)
    agent_result = await run_cs_agent(
        conversation_id=CONVERSATION_HYBRID_ID,
        message_body="Ada toner yang mengandung alkohol ga?",
        service_token=token_a,
        client=client
    )

    # 3. Assert AI menolak merekomendasikan sesuai guideline
    assert agent_result["status"] == "success"
    assert agent_result["guideline_violation_found"] is True
    reply = agent_result["reply_text"].lower()
    assert "tidak merekomendasikan" in reply or "kebijakan" in reply
    assert "alkohol" in reply

# ==============================================================================
# TEST 4: MULTI-TENANT ISOLATION ON TRAINING DATA
# ==============================================================================
@pytest.mark.asyncio
async def test_hybrid_ai_training_data_rls_isolation(client: AsyncClient):
    """
    SKENARIO 4: ISOLASI RLS DATA TRAINING
    - Tenant B tidak boleh melihat expert_knowledge atau ai_guidelines milik Tenant A.
    """
    headers_b = {"X-Tenant-ID": str(TENANT_HYBRID_B_ID)}

    # 1. Tenant B mengakses daftar expert knowledge
    exp_res = await client.get("/api/v1/ai-training/expert-knowledge", headers=headers_b)
    assert exp_res.status_code == 200
    expert_list_b = exp_res.json()
    assert len(expert_list_b) == 0, f"BOCOR: Tenant B dapat melihat expert knowledge Tenant A: {expert_list_b}"

    # 2. Tenant B mengakses daftar guidelines
    guide_res = await client.get("/api/v1/ai-training/guidelines", headers=headers_b)
    assert guide_res.status_code == 200
    guidelines_list_b = guide_res.json()
    assert len(guidelines_list_b) == 0, f"BOCOR: Tenant B dapat melihat guidelines Tenant A: {guidelines_list_b}"
