from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/ai-training", tags=["AI Training & Expert Knowledge"])

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================

class GuidelineCreate(BaseModel):
    category: str = Field(..., description="Kategori: 'tone_of_voice', 'escalation_rules', 'consultation_flow', 'safety_rules'")
    instruction: str = Field(..., min_length=3, description="Instruksi aturan bisnis untuk AI")
    is_active: bool = Field(default=True)

class GuidelineUpdate(BaseModel):
    category: Optional[str] = None
    instruction: Optional[str] = None
    is_active: Optional[bool] = None

class GuidelineResponse(BaseModel):
    id: str
    tenant_id: str
    category: str
    instruction: str
    is_active: bool
    created_at: str
    updated_at: str

class ExpertKnowledgeCreate(BaseModel):
    topic: str = Field(..., min_length=2, description="Topik keahlian atau troubleshooting")
    content: str = Field(..., min_length=5, description="Penjelasan solusi atau panduan konsultasi")
    is_active: bool = Field(default=True)

class ExpertKnowledgeUpdate(BaseModel):
    topic: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None

class ExpertKnowledgeResponse(BaseModel):
    id: str
    tenant_id: str
    topic: str
    content: str
    is_active: bool
    created_at: str
    updated_at: str

# ==============================================================================
# 1. CRUD: AI GUIDELINES
# ==============================================================================

@router.post(
    "/guidelines",
    response_model=GuidelineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tambah panduan atau aturan perilaku AI baru"
)
async def create_guideline(
    payload: GuidelineCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_tenant_db)
):
    query = text("""
        INSERT INTO public.ai_guidelines (tenant_id, category, instruction, is_active)
        VALUES (:tid, :cat, :inst, :act)
        RETURNING id, tenant_id, category, instruction, is_active, created_at, updated_at;
    """)
    result = await db.execute(
        query,
        {
            "tid": str(tenant_id),
            "cat": payload.category,
            "inst": payload.instruction,
            "act": payload.is_active
        }
    )
    row = result.mappings().first()
    return GuidelineResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        category=row["category"],
        instruction=row["instruction"],
        is_active=row["is_active"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat()
    )

@router.get(
    "/guidelines",
    response_model=List[GuidelineResponse],
    summary="Ambil daftar seluruh aturan AI milik tenant"
)
async def list_guidelines(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_tenant_db)
):
    sql = "SELECT id, tenant_id, category, instruction, is_active, created_at, updated_at FROM public.ai_guidelines WHERE 1=1"
    params = {}
    if category:
        sql += " AND category = :cat"
        params["cat"] = category
    sql += " ORDER BY created_at DESC;"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [
        GuidelineResponse(
            id=str(r["id"]),
            tenant_id=str(r["tenant_id"]),
            category=r["category"],
            instruction=r["instruction"],
            is_active=r["is_active"],
            created_at=r["created_at"].isoformat(),
            updated_at=r["updated_at"].isoformat()
        )
        for r in rows
    ]

@router.put(
    "/guidelines/{guideline_id}",
    response_model=GuidelineResponse,
    summary="Perbarui aturan panduan AI"
)
async def update_guideline(
    guideline_id: UUID,
    payload: GuidelineUpdate,
    db: AsyncSession = Depends(get_tenant_db)
):
    fetch_res = await db.execute(
        text("SELECT id, tenant_id, category, instruction, is_active FROM public.ai_guidelines WHERE id = :id FOR UPDATE;"),
        {"id": str(guideline_id)}
    )
    row = fetch_res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Guideline tidak ditemukan.")

    new_cat = payload.category if payload.category is not None else row["category"]
    new_inst = payload.instruction if payload.instruction is not None else row["instruction"]
    new_act = payload.is_active if payload.is_active is not None else row["is_active"]

    update_sql = text("""
        UPDATE public.ai_guidelines
        SET category = :cat, instruction = :inst, is_active = :act, updated_at = now()
        WHERE id = :id
        RETURNING id, tenant_id, category, instruction, is_active, created_at, updated_at;
    """)
    res = await db.execute(update_sql, {"cat": new_cat, "inst": new_inst, "act": new_act, "id": str(guideline_id)})
    updated_row = res.mappings().first()

    return GuidelineResponse(
        id=str(updated_row["id"]),
        tenant_id=str(updated_row["tenant_id"]),
        category=updated_row["category"],
        instruction=updated_row["instruction"],
        is_active=updated_row["is_active"],
        created_at=updated_row["created_at"].isoformat(),
        updated_at=updated_row["updated_at"].isoformat()
    )

@router.delete(
    "/guidelines/{guideline_id}",
    status_code=status.HTTP_200_OK,
    summary="Hapus aturan panduan AI"
)
async def delete_guideline(
    guideline_id: UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    res = await db.execute(
        text("DELETE FROM public.ai_guidelines WHERE id = :id RETURNING id;"),
        {"id": str(guideline_id)}
    )
    if not res.first():
        raise HTTPException(status_code=404, detail="Guideline tidak ditemukan.")
    return {"status": "deleted", "id": str(guideline_id)}

# ==============================================================================
# 2. CRUD: EXPERT KNOWLEDGE
# ==============================================================================

@router.post(
    "/expert-knowledge",
    response_model=ExpertKnowledgeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tambah basis pengetahuan ahli / troubleshooting baru"
)
async def create_expert_knowledge(
    payload: ExpertKnowledgeCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_tenant_db)
):
    query = text("""
        INSERT INTO public.expert_knowledge (tenant_id, topic, content, is_active)
        VALUES (:tid, :topic, :content, :act)
        RETURNING id, tenant_id, topic, content, is_active, created_at, updated_at;
    """)
    result = await db.execute(
        query,
        {
            "tid": str(tenant_id),
            "topic": payload.topic,
            "content": payload.content,
            "act": payload.is_active
        }
    )
    row = result.mappings().first()
    return ExpertKnowledgeResponse(
        id=str(row["id"]),
        tenant_id=str(row["tenant_id"]),
        topic=row["topic"],
        content=row["content"],
        is_active=row["is_active"],
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat()
    )

@router.get(
    "/expert-knowledge",
    response_model=List[ExpertKnowledgeResponse],
    summary="Ambil daftar basis pengetahuan ahli milik tenant"
)
async def list_expert_knowledge(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_tenant_db)
):
    sql = "SELECT id, tenant_id, topic, content, is_active, created_at, updated_at FROM public.expert_knowledge WHERE 1=1"
    params = {}
    if q:
        sql += " AND (topic ILIKE :q OR content ILIKE :q)"
        params["q"] = f"%{q.strip()}%"
    sql += " ORDER BY created_at DESC;"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [
        ExpertKnowledgeResponse(
            id=str(r["id"]),
            tenant_id=str(r["tenant_id"]),
            topic=r["topic"],
            content=r["content"],
            is_active=r["is_active"],
            created_at=r["created_at"].isoformat(),
            updated_at=r["updated_at"].isoformat()
        )
        for r in rows
    ]

@router.put(
    "/expert-knowledge/{knowledge_id}",
    response_model=ExpertKnowledgeResponse,
    summary="Perbarui basis pengetahuan ahli"
)
async def update_expert_knowledge(
    knowledge_id: UUID,
    payload: ExpertKnowledgeUpdate,
    db: AsyncSession = Depends(get_tenant_db)
):
    fetch_res = await db.execute(
        text("SELECT id, tenant_id, topic, content, is_active FROM public.expert_knowledge WHERE id = :id FOR UPDATE;"),
        {"id": str(knowledge_id)}
    )
    row = fetch_res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Expert knowledge tidak ditemukan.")

    new_topic = payload.topic if payload.topic is not None else row["topic"]
    new_content = payload.content if payload.content is not None else row["content"]
    new_act = payload.is_active if payload.is_active is not None else row["is_active"]

    update_sql = text("""
        UPDATE public.expert_knowledge
        SET topic = :topic, content = :content, is_active = :act, updated_at = now()
        WHERE id = :id
        RETURNING id, tenant_id, topic, content, is_active, created_at, updated_at;
    """)
    res = await db.execute(update_sql, {"topic": new_topic, "content": new_content, "act": new_act, "id": str(knowledge_id)})
    updated_row = res.mappings().first()

    return ExpertKnowledgeResponse(
        id=str(updated_row["id"]),
        tenant_id=str(updated_row["tenant_id"]),
        topic=updated_row["topic"],
        content=updated_row["content"],
        is_active=updated_row["is_active"],
        created_at=updated_row["created_at"].isoformat(),
        updated_at=updated_row["updated_at"].isoformat()
    )

@router.delete(
    "/expert-knowledge/{knowledge_id}",
    status_code=status.HTTP_200_OK,
    summary="Hapus basis pengetahuan ahli"
)
async def delete_expert_knowledge(
    knowledge_id: UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    res = await db.execute(
        text("DELETE FROM public.expert_knowledge WHERE id = :id RETURNING id;"),
        {"id": str(knowledge_id)}
    )
    if not res.first():
        raise HTTPException(status_code=404, detail="Expert knowledge tidak ditemukan.")
    return {"status": "deleted", "id": str(knowledge_id)}
