import re
import json
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_ai_service_tenant_id
from app.core.database import get_ai_tenant_db

router = APIRouter(prefix="/internal/ai-tools", tags=["Internal AI Tools"])

# ==============================================================================
# PYDANTIC SCHEMAS UNTUK TYPED TOOLS (ZONA B RPC)
# ==============================================================================

class ItemToolResult(BaseModel):
    id: str
    name: str
    base_price: int = Field(..., description="Harga satuan dalam minor units (Rp)")
    stock: int = Field(..., description="Jumlah stok tersedia siap jual (on_hand - reserved)")

class StockToolResult(BaseModel):
    item_id: str
    on_hand: int
    reserved: int
    available_stock: int

class PriceToolResult(BaseModel):
    item_id: str
    name: str
    unit_price: int
    qty: int
    total_price: int

class ExpertKnowledgeItem(BaseModel):
    id: str
    topic: str
    content: str

class GuidelineItem(BaseModel):
    id: str
    category: str
    instruction: str

class AIContextResult(BaseModel):
    items: List[ItemToolResult]
    expert_knowledge: List[ExpertKnowledgeItem]
    guidelines: List[GuidelineItem]

class AIDraftCreate(BaseModel):
    conversation_id: Optional[UUID] = None
    kind: str = Field(default="reply", description="'reply' atau 'quote'")
    payload: Dict[str, Any]
    status: str = Field(default="pending", description="'pending', 'approved', 'rejected'")
    generated_by: str = Field(default="langgraph_agent")

class AIDraftResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: Optional[str]
    kind: str
    payload: Dict[str, Any]
    status: str
    generated_by: str
    created_at: str

class AIRunCreate(BaseModel):
    agent_name: str
    conversation_id: Optional[UUID] = None
    input_tokens: int = 0
    output_tokens: int = 0
    status: str = Field(default="completed", description="'completed', 'failed', 'handoff'")
    metadata: Dict[str, Any] = {}

class AIRunResponse(BaseModel):
    id: str
    tenant_id: str
    agent_name: str
    conversation_id: Optional[str]
    input_tokens: int
    output_tokens: int
    status: str
    metadata: Dict[str, Any]
    created_at: str

# ==============================================================================
# ENDPOINT 1: SEARCH ITEMS (TYPED TOOL)
# ==============================================================================
@router.get(
    "/search-items",
    response_model=List[ItemToolResult],
    summary="Cari item di katalog berdasarkan nama (Typed Tool AI)"
)
async def search_items(
    q: str = Query(..., min_length=1, description="Kata kunci nama produk/jasa"),
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    """
    Mencari item katalog berdasarkan nama menggunakan ILIKE.
    
    🧠 KEAMANAN ZONA B:
    - tenant_id diekstrak secara kriptografis dari Service Token JWT.
    - Sesi database diisolasi oleh PostgreSQL Row-Level Security (RLS).
    - AI Worker hanya dapat melihat item milik tenant penandatangan token.
    """
    search_pattern = f"%{q.strip()}%"
    query = text("""
        SELECT 
            i.id,
            i.name,
            i.base_price,
            COALESCE(s.on_hand - s.reserved, 0) AS stock
        FROM public.items i
        LEFT JOIN public.stock_levels s ON s.item_id = i.id
        WHERE i.name ILIKE :q
        ORDER BY i.name ASC
        LIMIT 20;
    """)
    result = await db.execute(query, {"q": search_pattern})
    rows = result.mappings().all()

    return [
        ItemToolResult(
            id=str(r["id"]),
            name=r["name"],
            base_price=int(r["base_price"]),
            stock=int(r["stock"])
        )
        for r in rows
    ]

# ==============================================================================
# ENDPOINT 2: CHECK STOCK (TYPED TOOL)
# ==============================================================================
@router.get(
    "/check-stock",
    response_model=StockToolResult,
    summary="Periksa status ketersediaan stok fisik real-time (Typed Tool AI)"
)
async def check_stock(
    item_id: UUID = Query(..., description="UUID item yang akan diperiksa"),
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    """
    Mengecek stok on_hand dan reserved dari cache stock_levels.
    """
    query = text("""
        SELECT 
            item_id,
            on_hand,
            reserved,
            (on_hand - reserved) AS available_stock
        FROM public.stock_levels
        WHERE item_id = :item_id;
    """)
    result = await db.execute(query, {"item_id": str(item_id)})
    row = result.mappings().first()

    if not row:
        # Cek apakah item terdaftar di katalog
        item_query = text("SELECT id FROM public.items WHERE id = :item_id;")
        item_check = await db.execute(item_query, {"item_id": str(item_id)})
        if not item_check.first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item tidak ditemukan di katalog tenant."
            )
        # Jika item ada tapi belum punya catatan stok (misal: jasa atau item baru)
        return StockToolResult(
            item_id=str(item_id),
            on_hand=0,
            reserved=0,
            available_stock=0
        )

    return StockToolResult(
        item_id=str(row["item_id"]),
        on_hand=int(row["on_hand"]),
        reserved=int(row["reserved"]),
        available_stock=int(row["available_stock"])
    )

# ==============================================================================
# ENDPOINT 3: GET PRICE (TYPED TOOL)
# ==============================================================================
@router.get(
    "/get-price",
    response_model=PriceToolResult,
    summary="Hitung kalkulasi harga transaksi menggunakan integer math (Typed Tool AI)"
)
async def get_price(
    item_id: UUID = Query(..., description="UUID item"),
    qty: int = Query(..., ge=1, description="Kuantitas pesanan"),
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    """
    Mengambil harga dasar item dan menghitung total harga (base_price * qty).
    
    🧠 ATURAN EMAS:
    DILARANG menggunakan desimal/float. Perhitungan mutlak menggunakan integer arithmetic.
    """
    query = text("""
        SELECT id, name, base_price
        FROM public.items
        WHERE id = :item_id;
    """)
    result = await db.execute(query, {"item_id": str(item_id)})
    row = result.mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item tidak ditemukan di katalog tenant."
        )

    unit_price = int(row["base_price"])
    total_price = unit_price * qty

    return PriceToolResult(
        item_id=str(row["id"]),
        name=row["name"],
        unit_price=unit_price,
        qty=qty,
        total_price=total_price
    )

# ==============================================================================
# ENDPOINT: EXPERT KNOWLEDGE (TYPED TOOL)
# ==============================================================================
@router.get(
    "/expert-knowledge",
    response_model=List[ExpertKnowledgeItem],
    summary="Ambil pengetahuan ahli dan panduan troubleshooting (Typed Tool AI)"
)
async def get_expert_knowledge(
    q: Optional[str] = Query(None, description="Kata kunci pencarian topik/isi"),
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    sql = "SELECT id, topic, content FROM public.expert_knowledge WHERE is_active = true"
    params = {}
    if q and q.strip():
        sql += " AND (topic ILIKE :q OR content ILIKE :q)"
        params["q"] = f"%{q.strip()}%"
    sql += " ORDER BY created_at DESC LIMIT 10;"

    res = await db.execute(text(sql), params)
    rows = res.mappings().all()
    return [
        ExpertKnowledgeItem(id=str(r["id"]), topic=r["topic"], content=r["content"])
        for r in rows
    ]

# ==============================================================================
# ENDPOINT: GUIDELINES (TYPED TOOL)
# ==============================================================================
@router.get(
    "/guidelines",
    response_model=List[GuidelineItem],
    summary="Ambil aturan bisnis dan tone of voice aktif milik tenant (Typed Tool AI)"
)
async def get_guidelines(
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    sql = "SELECT id, category, instruction FROM public.ai_guidelines WHERE is_active = true ORDER BY created_at DESC;"
    res = await db.execute(text(sql))
    rows = res.mappings().all()
    return [
        GuidelineItem(id=str(r["id"]), category=r["category"], instruction=r["instruction"])
        for r in rows
    ]

# ==============================================================================
# ENDPOINT: UNIFIED HYBRID CONTEXT (TYPED TOOL)
# ==============================================================================
@router.get(
    "/context",
    response_model=AIContextResult,
    summary="Ambil context lengkap Hybrid RAG: Items + Expert Knowledge + Guidelines"
)
async def get_hybrid_context(
    q: str = Query(..., description="Query pesan pelanggan"),
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    search_pattern = f"%{q.strip()}%"
    clean_words = [
        w for w in re.sub(r"[^\w\s]", "", q).split() 
        if len(w) > 2 and w.lower() not in ("berapa", "harga", "apakah", "stok", "adakah", "yang", "cocok", "saya", "kamu", "bisa", "tolong", "halo", "ada", "ga", "ngga", "dong", "banget")
    ]
    
    # 1. Query items
    item_sql = text("""
        SELECT i.id, i.name, i.base_price, COALESCE(s.on_hand - s.reserved, 0) AS stock
        FROM public.items i
        LEFT JOIN public.stock_levels s ON s.item_id = i.id
        WHERE i.name ILIKE :q OR i.attributes::text ILIKE :q
        ORDER BY i.name ASC LIMIT 10;
    """)
    item_rows = (await db.execute(item_sql, {"q": search_pattern})).mappings().all()

    # Jika pencarian frase utuh belum menemukan item, cari berdasarkan kata kunci produk
    if not item_rows and clean_words:
        for w in clean_words:
            rows = (await db.execute(item_sql, {"q": f"%{w}%"})).mappings().all()
            if rows:
                item_rows = rows
                break

    # Jika masih belum ada, sertakan item katalog aktif teratas milik tenant
    if not item_rows:
        fallback_item_sql = text("""
            SELECT i.id, i.name, i.base_price, COALESCE(s.on_hand - s.reserved, 0) AS stock
            FROM public.items i
            LEFT JOIN public.stock_levels s ON s.item_id = i.id
            WHERE i.active = true
            ORDER BY i.created_at DESC LIMIT 10;
        """)
        item_rows = (await db.execute(fallback_item_sql)).mappings().all()

    items_result = [
        ItemToolResult(
            id=str(r["id"]),
            name=r["name"],
            base_price=int(r["base_price"]),
            stock=int(r["stock"])
        )
        for r in item_rows
    ]

    # 2. Query expert knowledge
    exp_sql = text("""
        SELECT id, topic, content
        FROM public.expert_knowledge
        WHERE is_active = true AND (topic ILIKE :q OR content ILIKE :q)
        ORDER BY created_at DESC LIMIT 10;
    """)
    exp_rows = (await db.execute(exp_sql, {"q": search_pattern})).mappings().all()

    # Jika pencarian frase utuh belum ada, cari per kata kunci
    if not exp_rows and clean_words:
        for w in clean_words:
            rows = (await db.execute(exp_sql, {"q": f"%{w}%"})).mappings().all()
            if rows:
                exp_rows = rows
                break

    # Fallback ke 5 knowledge aktif teratas
    if not exp_rows:
        fallback_sql = text("SELECT id, topic, content FROM public.expert_knowledge WHERE is_active = true ORDER BY created_at DESC LIMIT 5;")
        exp_rows = (await db.execute(fallback_sql)).mappings().all()

    exp_result = [
        ExpertKnowledgeItem(id=str(r["id"]), topic=r["topic"], content=r["content"])
        for r in exp_rows
    ]

    # 3. Query guidelines
    guide_sql = text("SELECT id, category, instruction FROM public.ai_guidelines WHERE is_active = true ORDER BY created_at DESC;")
    guide_rows = (await db.execute(guide_sql)).mappings().all()
    guide_result = [
        GuidelineItem(id=str(r["id"]), category=r["category"], instruction=r["instruction"])
        for r in guide_rows
    ]

    return AIContextResult(
        items=items_result,
        expert_knowledge=exp_result,
        guidelines=guide_result
    )

# ==============================================================================
# ENDPOINT 4: SAVE DRAFT (ZONA B -> ZONA A PERSISTENCE)
# ==============================================================================
@router.post(
    "/drafts",
    response_model=AIDraftResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Simpan usulan aksi AI ke tabel ai_drafts (Sandbox Zona B)"
)
async def save_ai_draft(
    draft_in: AIDraftCreate,
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    """
    Menyimpan usulan respon atau order proposal dari AI Agent ke tabel `ai_drafts`.
    Status default adalah 'pending' (menunggu Human-in-the-Loop review).
    """
    payload_json = json.dumps(draft_in.payload)
    query = text("""
        INSERT INTO public.ai_drafts (
            tenant_id,
            conversation_id,
            draft_type,
            kind,
            payload,
            status,
            generated_by
        ) VALUES (
            :tenant_id,
            :conversation_id,
            :kind,
            :kind,
            CAST(:payload AS jsonb),
            :status,
            :generated_by
        )
        RETURNING id, tenant_id, conversation_id, kind, payload, status, generated_by, created_at;
    """)
    result = await db.execute(
        query,
        {
            "tenant_id": str(tenant_id),
            "conversation_id": str(draft_in.conversation_id) if draft_in.conversation_id else None,
            "kind": draft_in.kind,
            "payload": payload_json,
            "status": draft_in.status,
            "generated_by": draft_in.generated_by,
        }
    )
    row = result.mappings().first()

    return AIDraftResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        conversation_id=str(row["conversation_id"]) if row["conversation_id"] else None,
        kind=row["kind"],
        payload=row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"]),
        status=row["status"],
        generated_by=row["generated_by"],
        created_at=row["created_at"].isoformat()
    )

# ==============================================================================
# ENDPOINT 5: LOG RUN METRICS (ZONA B OBSERVABILITY)
# ==============================================================================
@router.post(
    "/runs",
    response_model=AIRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Catat metrik eksekusi agent ke tabel ai_runs"
)
async def log_ai_run(
    run_in: AIRunCreate,
    tenant_id: UUID = Depends(get_ai_service_tenant_id),
    db: AsyncSession = Depends(get_ai_tenant_db)
):
    """
    Merekam metadata run: token input/output, status, dan data pelacakan observabilitas.
    """
    metadata_json = json.dumps(run_in.metadata)
    query = text("""
        INSERT INTO public.ai_runs (
            tenant_id,
            agent_name,
            conversation_id,
            input_tokens,
            output_tokens,
            status,
            metadata
        ) VALUES (
            :tenant_id,
            :agent_name,
            :conversation_id,
            :input_tokens,
            :output_tokens,
            :status,
            CAST(:metadata AS jsonb)
        )
        RETURNING id, tenant_id, agent_name, conversation_id, input_tokens, output_tokens, status, metadata, created_at;
    """)
    result = await db.execute(
        query,
        {
            "tenant_id": str(tenant_id),
            "agent_name": run_in.agent_name,
            "conversation_id": str(run_in.conversation_id) if run_in.conversation_id else None,
            "input_tokens": run_in.input_tokens,
            "output_tokens": run_in.output_tokens,
            "status": run_in.status,
            "metadata": metadata_json
        }
    )
    row = result.mappings().first()

    return AIRunResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        agent_name=row["agent_name"],
        conversation_id=str(row["conversation_id"]) if row["conversation_id"] else None,
        input_tokens=int(row["input_tokens"]),
        output_tokens=int(row["output_tokens"]),
        status=row["status"],
        metadata=row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"]),
        created_at=row["created_at"].isoformat()
    )
