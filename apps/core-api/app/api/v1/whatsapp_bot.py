"""
=============================================================================
NEXUS CORE OS - WHATSAPP BOT WEBHOOK ENDPOINTS (MOCK & RAG AGENT)
File: apps/core-api/app/api/v1/whatsapp_bot.py

Menerima pesan WhatsApp (simulasi webhook), memproses balasan via
LangGraph Zero-Hallucination RAG Agent, dan mencatat riwayat ke notification_logs.
=============================================================================
"""

import json
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.services.whatsapp_rag_agent import process_whatsapp_message

router = APIRouter(prefix="/webhooks", tags=["WhatsApp Bot & Webhooks"])


class MockWhatsAppPayload(BaseModel):
    phone: str = Field(..., description="Nomor WhatsApp pengirim", json_schema_extra={"example": "08123456789"})
    message: str = Field(..., description="Isi teks pesan pelanggan", json_schema_extra={"example": "Stok LCD iPhone 11 ada?"})
    tenant_id: Optional[str] = Field(None, description="ID tenant opsional (default ke tenant sesi aktif)")


class MockWhatsAppResponse(BaseModel):
    status: str
    tenant_id: str
    sender_phone: str
    incoming_message: str
    bot_reply: str
    channel: str
    timestamp: str


@router.post("/mock-whatsapp", response_model=MockWhatsAppResponse, status_code=status.HTTP_200_OK)
async def handle_mock_whatsapp_webhook(
    payload: MockWhatsAppPayload,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mock Webhook WhatsApp RAG Smartbot:
    1. Menerima pesan pelanggan WhatsApp.
    2. Menjalankan LangGraph Zero-Hallucination RAG Agent (stok, harga, garansi, FAQ).
    3. Mencatat balasan ke tabel 'notification_logs' dengan status 'SIMULATED_SENT' dan channel 'WHATSAPP_RAG'.
    4. Mengembalikan respons JSON berisi pesan asli dan balasan bot AI.
    """
    active_tenant_id = str(payload.tenant_id or current_tenant_id)

    # 1. Eksekusi LangGraph RAG Agent
    try:
        bot_reply = await process_whatsapp_message(
            tenant_id=active_tenant_id,
            sender_phone=payload.phone,
            message=payload.message,
            db=db
        )
    except Exception as e:
        bot_reply = "Mohon maaf, sistem asisten toko kami sedang dalam pemeliharaan. Silakan hubungi admin manusia."

    now_iso = datetime.now(timezone.utc).isoformat()

    # 2. Catat ke notification_logs (Audit Trail & Simulator History)
    try:
        meta = json.dumps({
            "incoming_message": payload.message,
            "sender_phone": payload.phone,
            "bot_reply": bot_reply,
            "simulated": True,
            "source": "mock_whatsapp_webhook"
        })
        insert_sql = text("""
            INSERT INTO public.notification_logs (
                id, tenant_id, phone, message, template_name, status, channel, metadata, created_at
            ) VALUES (
                gen_random_uuid(), :tenant_id, :phone, :message, :template, 'SIMULATED_SENT', 'WHATSAPP_RAG', :meta::jsonb, now()
            )
        """)
        await db.execute(insert_sql, {
            "tenant_id": active_tenant_id,
            "phone": payload.phone,
            "message": bot_reply,
            "template": "whatsapp_rag_reply",
            "meta": meta
        })
        await db.commit()
    except Exception as log_err:
        # Fail-safe: jika pencatatan log gagal, jangan gagalkan balasan chat pelanggan
        pass

    # 3. Return respons
    return MockWhatsAppResponse(
        status="success",
        tenant_id=active_tenant_id,
        sender_phone=payload.phone,
        incoming_message=payload.message,
        bot_reply=bot_reply,
        channel="WHATSAPP_RAG",
        timestamp=now_iso
    )


@router.get("/whatsapp-history")
async def get_whatsapp_chat_history(
    phone: Optional[str] = None,
    limit: int = 30,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil riwayat percakapan WhatsApp RAG Bot untuk tampilan UI Simulator.
    """
    try:
        where_clause = "WHERE tenant_id = :tenant_id AND channel = 'WHATSAPP_RAG'"
        params: Dict[str, Any] = {"tenant_id": str(current_tenant_id), "limit": limit}
        if phone:
            where_clause += " AND phone = :phone"
            params["phone"] = phone

        sql = text(f"""
            SELECT id, phone, message, metadata, status, created_at
            FROM public.notification_logs
            {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit;
        """)
        res = await db.execute(sql, params)
        rows = res.fetchall()

        history = []
        for r in reversed(rows): # Urutkan dari lama ke baru
            m = r.metadata if isinstance(r.metadata, dict) else (json.loads(r.metadata) if r.metadata else {})
            history.append({
                "id": str(r.id),
                "phone": r.phone,
                "incoming_message": m.get("incoming_message", ""),
                "bot_reply": r.message,
                "created_at": r.created_at.isoformat() if r.created_at else ""
            })
        return {"status": "success", "history": history}
    except Exception as e:
        return {"status": "error", "history": [], "message": str(e)}
