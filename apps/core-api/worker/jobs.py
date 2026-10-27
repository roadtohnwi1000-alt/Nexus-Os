import json
from uuid import UUID, uuid4
from typing import Dict, Any, Optional
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def process_inbound_message(
    ctx: Optional[Dict[str, Any]],
    tenant_id: str,
    payload: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Background Job Handler untuk memproses pesan WhatsApp masuk secara asynchronous.
    
    Alur Kerja:
    1. Buka sesi database dengan isolasi RLS tenant (SET LOCAL ROLE authenticated & set_config).
    2. Resolusi Contact: Cari kontak berdasarkan nomor telepon atau buat kontak baru.
    3. Resolusi Conversation: Ambil percakapan aktif atau buat sesi baru.
    4. Simpan Pesan ke tabel 'messages' (idempotent berdasarkan external_id).
    5. Trigger AI: Buat proposal draft balasan di tabel 'ai_drafts' (Iron Rule #3).
    6. Tandai event di 'inbound_events' dan 'jobs' sebagai selesai (completed).
    """
    tenant_uuid = UUID(tenant_id)
    sender_number = payload.get("sender_number", "").strip()
    sender_name = payload.get("sender_name", sender_number).strip()
    content = payload.get("content", "").strip()
    external_id = payload.get("external_id", "").strip()

    if not sender_number or not content:
        return {"status": "error", "message": "Nomor pengirim atau konten pesan kosong"}

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Injeksi context tenant & role authenticated untuk penegakan RLS
            await session.execute(text("SET LOCAL ROLE authenticated"))
            await session.execute(
                text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_uuid)}
            )

            # 1. Resolusi Contact
            contact_query = await session.execute(
                text("""
                    SELECT id FROM public.contacts 
                    WHERE attributes->>'phone' = :phone
                    LIMIT 1
                """),
                {"phone": sender_number}
            )
            contact_row = contact_query.mappings().first()
            if contact_row:
                contact_id = contact_row["id"]
            else:
                contact_insert = await session.execute(
                    text("""
                        INSERT INTO public.contacts (tenant_id, display_name, kind, attributes)
                        VALUES (:tenant_id, :name, 'person', :attributes)
                        RETURNING id
                    """),
                    {
                        "tenant_id": str(tenant_uuid),
                        "name": sender_name,
                        "attributes": json.dumps({"phone": sender_number})
                    }
                )
                contact_id = contact_insert.mappings().one()["id"]

            # 2. Resolusi Conversation (Cari atau Buat)
            conv_query = await session.execute(
                text("""
                    SELECT id FROM public.conversations
                    WHERE channel = 'whatsapp' AND channel_identifier = :identifier
                    LIMIT 1
                """),
                {"identifier": sender_number}
            )
            conv_row = conv_query.mappings().first()

            if conv_row:
                conversation_id = conv_row["id"]
                # Update last_message_at
                await session.execute(
                    text("""
                        UPDATE public.conversations
                        SET last_message_at = timezone('utc'::text, now()),
                            updated_at = timezone('utc'::text, now()),
                            contact_id = COALESCE(contact_id, :contact_id)
                        WHERE id = :conv_id
                    """),
                    {"conv_id": conversation_id, "contact_id": contact_id}
                )
            else:
                conv_insert = await session.execute(
                    text("""
                        INSERT INTO public.conversations (
                            tenant_id, contact_id, channel, channel_identifier, status, last_message_at
                        ) VALUES (
                            :tenant_id, :contact_id, 'whatsapp', :identifier, 'active', timezone('utc'::text, now())
                        )
                        RETURNING id
                    """),
                    {
                        "tenant_id": str(tenant_uuid),
                        "contact_id": contact_id,
                        "identifier": sender_number
                    }
                )
                conversation_id = conv_insert.mappings().one()["id"]

            # 3. Simpan Pesan Masuk (Idempotent berdasarkan external_id)
            msg_query = await session.execute(
                text("""
                    INSERT INTO public.messages (
                        tenant_id, conversation_id, direction, content, status, external_id, metadata
                    ) VALUES (
                        :tenant_id, :conv_id, 'inbound', :content, 'received', :external_id, :metadata
                    )
                    ON CONFLICT (tenant_id, external_id) DO NOTHING
                    RETURNING id
                """),
                {
                    "tenant_id": str(tenant_uuid),
                    "conv_id": conversation_id,
                    "content": content,
                    "external_id": external_id,
                    "metadata": json.dumps(payload.get("metadata", {}))
                }
            )
            msg_row = msg_query.mappings().first()
            message_id = msg_row["id"] if msg_row else None

            # 4. AI Sandbox: Trigger AI Draft Reply (Iron Rule #3)
            # AI DILARANG membalas/menulis langsung ke pelanggan tanpa approval
            ai_proposal_payload = {
                "conversation_id": str(conversation_id),
                "inbound_message": content,
                "suggested_reply": f"Halo {sender_name}, terima kasih telah menghubungi kami. Pesan Anda sedang kami tinjau."
            }
            await session.execute(
                text("""
                    INSERT INTO public.ai_drafts (
                        tenant_id, draft_type, payload, status, generated_by
                    ) VALUES (
                        :tenant_id, 'whatsapp_reply_proposal', :payload, 'pending_review', 'langgraph_agent'
                    )
                """),
                {
                    "tenant_id": str(tenant_uuid),
                    "payload": json.dumps(ai_proposal_payload)
                }
            )

            # 5. Update status inbound_events
            await session.execute(
                text("""
                    UPDATE public.inbound_events
                    SET processed = true
                    WHERE tenant_id = :tenant_id AND external_id = :external_id
                """),
                {"tenant_id": str(tenant_uuid), "external_id": external_id}
            )

            # 6. Update status jobs jika job_id ada
            if job_id:
                await session.execute(
                    text("""
                        UPDATE public.jobs
                        SET status = 'completed',
                            result = :result,
                            updated_at = timezone('utc'::text, now())
                        WHERE id = :job_id
                    """),
                    {
                        "job_id": UUID(job_id),
                        "result": json.dumps({"conversation_id": str(conversation_id), "message_id": str(message_id)})
                    }
                )

    return {
        "status": "success",
        "conversation_id": str(conversation_id),
        "message_id": str(message_id) if message_id else "already_processed"
    }

# =============================================================================
# ARQ WORKER CONFIGURATION
# =============================================================================
class WorkerSettings:
    """Konfigurasi Arq Worker untuk eksekusi job asynchronous."""
    functions = [process_inbound_message]
    redis_settings = None # Dapat di-inject dari config REDIS_URL di production
