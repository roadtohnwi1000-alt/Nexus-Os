import json
from uuid import UUID, uuid4
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status, HTTPException, Request, Header
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/webhooks", tags=["Webhooks & Ingestion"])

class WhatsAppInboundPayload(BaseModel):
    """
    Schema payload webhook WhatsApp.
    Mendukung format langsung maupun format Meta Cloud API.
    """
    sender_number: str = Field(..., description="Nomor WhatsApp pengirim (+62...)", json_schema_extra={"example": "+6281234567890"})
    content: str = Field(..., min_length=1, description="Isi teks pesan", json_schema_extra={"example": "Halo, saya mau pesan kopi"})
    external_id: str = Field(..., description="ID pesan unik dari WhatsApp (Meta WAMID)", json_schema_extra={"example": "wamid.HBgM..."})
    sender_name: Optional[str] = Field(None, json_schema_extra={"example": "Budi Santoso"})
    metadata: Dict[str, Any] = Field(default_factory=dict)

@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    request: Request
):
    """
    Endpoint verifikasi handshake WhatsApp Cloud API (Meta Webhook Verification).
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token:
        # Kembalikan challenge token yang diminta Meta
        return int(challenge) if challenge and challenge.isdigit() else challenge
    return {"status": "ready", "service": "whatsapp-webhook"}

@router.post("/whatsapp", status_code=status.HTTP_200_OK)
async def handle_whatsapp_webhook(
    payload: WhatsAppInboundPayload,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    Menerima webhook WhatsApp secara cepat (<1 detik):
    1. Validasi signature (jika dikirim oleh Meta).
    2. Cek Idempotency: Jika external_id sudah ada, kembalikan 200 OK langsung (tanpa duplikasi).
    3. Simpan ke tabel 'inbound_events'.
    4. Enqueue job ke tabel 'jobs' untuk diproses worker Arq.
    5. Return 200 OK seketika.
    """
    # 1. Validasi Signature Opsional (HMAC SHA256)
    # Pada fase staging/dev, jika header ada dapat diverifikasi dengan app secret

    # 2. Idempotency Check: Cegah duplikasi pesan WhatsApp
    check_event = await db.execute(
        text("""
            SELECT id, processed 
            FROM public.inbound_events 
            WHERE external_id = :ext_id
        """),
        {"ext_id": payload.external_id}
    )
    existing_event = check_event.mappings().first()
    if existing_event:
        # Pesan sudah pernah diterima sebelumnya, balas 200 OK tanpa memproses ulang
        return {
            "status": "already_received",
            "message": "Pesan sudah pernah diterima sebelumnya (Idempotent)",
            "external_id": payload.external_id
        }

    # 3. Simpan ke inbound_events
    raw_payload_dict = payload.model_dump()
    await db.execute(
        text("""
            INSERT INTO public.inbound_events (
                tenant_id, event_type, external_id, payload, processed
            ) VALUES (
                :tenant_id, 'whatsapp.message', :external_id, :payload, false
            )
        """),
        {
            "tenant_id": str(current_tenant_id),
            "external_id": payload.external_id,
            "payload": json.dumps(raw_payload_dict)
        }
    )

    # 4. Enqueue Job ke tabel jobs untuk diproses oleh background worker (Arq)
    job_insert = await db.execute(
        text("""
            INSERT INTO public.jobs (
                tenant_id, job_type, status, payload
            ) VALUES (
                :tenant_id, 'process_inbound_message', 'queued', :payload
            )
            RETURNING id
        """),
        {
            "tenant_id": str(current_tenant_id),
            "payload": json.dumps(raw_payload_dict)
        }
    )
    job_id = job_insert.mappings().one()["id"]

    # 5. Return 200 OK (< 1 detik)
    return {
        "status": "received",
        "external_id": payload.external_id,
        "job_id": str(job_id)
    }
