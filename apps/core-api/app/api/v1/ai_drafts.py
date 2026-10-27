import json
from typing import Optional, Dict, Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/ai-drafts", tags=["AI Drafts & Human-in-the-Loop"])

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================

class RejectRequest(BaseModel):
    reason: Optional[str] = Field(default="Rejected by staff", description="Alasan penolakan draft")

class DraftDetailResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: Optional[str]
    kind: str
    status: str
    payload: Dict[str, Any]
    generated_by: str
    rejection_reason: Optional[str] = None
    created_at: str

class ApprovalResponse(BaseModel):
    status: str
    message: str
    draft_id: str
    order_id: Optional[str] = None
    conversation_status: Optional[str] = None

# ==============================================================================
# ENDPOINT: LIST PENDING DRAFTS (UNTUK DASHBOARD STAF)
# ==============================================================================
@router.get(
    "/",
    response_model=List[DraftDetailResponse],
    summary="Ambil daftar draft AI yang membutuhkan persetujuan (Human-in-the-Loop)"
)
async def list_drafts(
    status_filter: str = "pending",
    db: AsyncSession = Depends(get_tenant_db)
):
    query = text("""
        SELECT 
            id, tenant_id, conversation_id, kind, status, payload, generated_by, rejection_reason, created_at
        FROM public.ai_drafts
        WHERE status = :status OR (status = 'pending_review' AND :status = 'pending')
        ORDER BY created_at DESC;
    """)
    result = await db.execute(query, {"status": status_filter})
    rows = result.mappings().all()

    return [
        DraftDetailResponse(
            id=str(r["id"]),
            tenant_id=str(r["tenant_id"]),
            conversation_id=str(r["conversation_id"]) if r["conversation_id"] else None,
            kind=r["kind"] or "reply",
            status=r["status"],
            payload=r["payload"] if isinstance(r["payload"], dict) else json.loads(r["payload"]),
            generated_by=r["generated_by"],
            rejection_reason=r["rejection_reason"],
            created_at=r["created_at"].isoformat()
        )
        for r in rows
    ]

# ==============================================================================
# ENDPOINT: APPROVE DRAFT (HUMAN-IN-THE-LOOP)
# ==============================================================================
@router.post(
    "/{draft_id}/approve",
    response_model=ApprovalResponse,
    summary="Setujui draft AI (Human-in-the-Loop Approval)"
)
async def approve_draft(
    draft_id: UUID,
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Eksekusi persetujuan draft oleh staf:
    1. Memastikan draft berstatus 'pending' / 'pending_review'.
    2. Jika kind == 'reply': ubah status jadi 'approved', update conversation.status -> 'ai_replied'.
    3. Jika kind == 'quote': ubah status jadi 'approved', jalankan transaksi pembuatan Order riil.
    """
    # 1. Ambil data draft
    fetch_query = text("""
        SELECT id, tenant_id, conversation_id, kind, status, payload
        FROM public.ai_drafts
        WHERE id = :id
        FOR UPDATE;
    """)
    result = await db.execute(fetch_query, {"id": str(draft_id)})
    draft = result.mappings().first()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft AI tidak ditemukan."
        )

    if draft["status"] not in ("pending", "pending_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft tidak dapat disetujui karena berstatus '{draft['status']}'."
        )

    kind = draft["kind"] or "reply"
    payload = draft["payload"] if isinstance(draft["payload"], dict) else json.loads(draft["payload"])
    conv_id = draft["conversation_id"] or payload.get("conversation_id")
    order_id = None
    conv_status = None

    # 2. Tangani kind == 'reply'
    if kind == "reply":
        # Tandai draft approved
        await db.execute(
            text("UPDATE public.ai_drafts SET status = 'approved', updated_at = now() WHERE id = :id;"),
            {"id": str(draft_id)}
        )
        # Update conversation status jika ada
        if conv_id:
            await db.execute(
                text("UPDATE public.conversations SET status = 'ai_replied', updated_at = now() WHERE id = :cid;"),
                {"cid": str(conv_id)}
            )
            conv_status = "ai_replied"

    # 3. Tangani kind == 'quote' (Order Creation)
    elif kind == "quote":
        contact_id = payload.get("contact_id")
        items_data = payload.get("items", [])
        idempotency_key = payload.get("idempotency_key")

        if not items_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payload draft quote tidak memuat daftar items."
            )

        # Validasi dan reservasi stok atomik per item
        total_minor = 0
        order_lines_to_insert = []

        for item_entry in items_data:
            item_id = item_entry.get("item_id")
            qty = int(item_entry.get("qty", 1))

            # Ambil data snapshot item
            item_res = await db.execute(
                text("SELECT id, sku, name, base_price FROM public.items WHERE id = :item_id;"),
                {"item_id": str(item_id)}
            )
            item_row = item_res.mappings().first()
            if not item_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Item ID {item_id} tidak ditemukan dalam katalog."
                )

            line_subtotal = int(item_row["base_price"]) * qty
            total_minor += line_subtotal

            # Reservasi stok secara atomik
            reserve_sql = text("""
                UPDATE public.stock_levels
                SET reserved = reserved + :qty,
                    updated_at = now()
                WHERE item_id = :item_id
                  AND (on_hand - reserved) >= :qty
                RETURNING id;
            """)
            reserve_res = await db.execute(reserve_sql, {"item_id": str(item_id), "qty": qty})
            if not reserve_res.first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stok untuk '{item_row['name']}' tidak mencukupi untuk disetujui."
                )

            order_lines_to_insert.append({
                "item_id": str(item_row["id"]),
                "sku_snapshot": item_row["sku"],
                "name_snapshot": item_row["name"],
                "qty": qty,
                "unit_price_minor": int(item_row["base_price"])
            })

        # Insert Order resmi
        order_insert_sql = text("""
            INSERT INTO public.orders (
                tenant_id,
                contact_id,
                status,
                total_minor,
                idempotency_key
            ) VALUES (
                :tenant_id,
                :contact_id,
                'draft',
                :total_minor,
                :idempotency_key
            )
            RETURNING id;
        """)
        order_res = await db.execute(
            order_insert_sql,
            {
                "tenant_id": str(draft["tenant_id"]),
                "contact_id": str(contact_id) if contact_id else None,
                "total_minor": total_minor,
                "idempotency_key": idempotency_key
            }
        )
        created_order_row = order_res.mappings().first()
        order_id = str(created_order_row["id"])

        # Insert Order Lines snapshot
        line_insert_sql = text("""
            INSERT INTO public.order_lines (
                tenant_id,
                order_id,
                item_id,
                sku_snapshot,
                name_snapshot,
                qty,
                unit_price_minor
            ) VALUES (
                :tenant_id,
                :order_id,
                :item_id,
                :sku_snapshot,
                :name_snapshot,
                :qty,
                :unit_price_minor
            );
        """)
        for line in order_lines_to_insert:
            await db.execute(
                line_insert_sql,
                {
                    "tenant_id": str(draft["tenant_id"]),
                    "order_id": order_id,
                    **line
                }
            )

        # Update draft status jadi 'approved'
        await db.execute(
            text("UPDATE public.ai_drafts SET status = 'approved', updated_at = now() WHERE id = :id;"),
            {"id": str(draft_id)}
        )

        if conv_id:
            await db.execute(
                text("UPDATE public.conversations SET status = 'ai_replied', updated_at = now() WHERE id = :cid;"),
                {"cid": str(conv_id)}
            )
            conv_status = "ai_replied"

    return ApprovalResponse(
        status="approved",
        message="Draft AI berhasil disetujui dan dieksekusi.",
        draft_id=str(draft_id),
        order_id=order_id,
        conversation_status=conv_status
    )

# ==============================================================================
# ENDPOINT: REJECT DRAFT (HANDOFF KE MANUSIA)
# ==============================================================================
@router.post(
    "/{draft_id}/reject",
    response_model=ApprovalResponse,
    summary="Tolak draft AI dan handoff percakapan ke staf manusia"
)
async def reject_draft(
    draft_id: UUID,
    body: RejectRequest = Body(default=RejectRequest()),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Menolak draft usulan AI:
    1. Memastikan draft berstatus 'pending' / 'pending_review'.
    2. Mengubah status draft menjadi 'rejected' dengan alasan penolakan.
    3. Mengubah status conversation menjadi 'human' untuk intervensi manual staf.
    """
    fetch_query = text("""
        SELECT id, tenant_id, conversation_id, status, payload
        FROM public.ai_drafts
        WHERE id = :id
        FOR UPDATE;
    """)
    result = await db.execute(fetch_query, {"id": str(draft_id)})
    draft = result.mappings().first()

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft AI tidak ditemukan."
        )

    if draft["status"] not in ("pending", "pending_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Draft tidak dapat ditolak karena sudah berstatus '{draft['status']}'."
        )

    payload = draft["payload"] if isinstance(draft["payload"], dict) else json.loads(draft["payload"])
    conv_id = draft["conversation_id"] or payload.get("conversation_id")

    # Update draft ke 'rejected'
    await db.execute(
        text("""
            UPDATE public.ai_drafts 
            SET status = 'rejected', 
                rejection_reason = :reason,
                updated_at = now() 
            WHERE id = :id;
        """),
        {"id": str(draft_id), "reason": body.reason}
    )

    conv_status = None
    if conv_id:
        await db.execute(
            text("UPDATE public.conversations SET status = 'human', updated_at = now() WHERE id = :cid;"),
            {"cid": str(conv_id)}
        )
        conv_status = "human"

    return ApprovalResponse(
        status="rejected",
        message="Draft AI ditolak. Percakapan dialihkan ke operator manusia.",
        draft_id=str(draft_id),
        conversation_status=conv_status
    )
