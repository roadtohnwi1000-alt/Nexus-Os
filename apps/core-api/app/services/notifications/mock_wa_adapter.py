"""
TODO: INTEGRASI API ASLI WHATSAPP BUSINESS CLOUD API (META GRAPH API)
=============================================================================
1. Daftar Akun Developer di Meta for Developers (developers.facebook.com).
2. Buat App bertipe 'Business' dan tambahkan produk 'WhatsApp'.
3. Dapatkan dan simpan credentials berikut di .env:
   - WHATSAPP_PHONE_NUMBER_ID
   - WHATSAPP_BUSINESS_ACCOUNT_ID (WABA_ID)
   - WHATSAPP_PERMANENT_ACCESS_TOKEN
   - WHATSAPP_API_VERSION=v19.0
4. Daftarkan & submit template pesan resmi di WhatsApp Business Manager:
   - repair_done_notification
   - aftercare_h1_warranty
   - aftercare_h7_checkup
   - aftercare_h14_promo
   - tiktok_order_confirmation
5. Ganti fungsi send_wa_message() dengan HTTP POST request asli menggunakan httpx:
   POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
   Headers:
       Authorization: Bearer {PERMANENT_ACCESS_TOKEN}
       Content-Type: application/json
   Body:
       {
           "messaging_product": "whatsapp",
           "recipient_type": "individual",
           "to": phone_number,
           "type": "text",
           "text": { "preview_url": false, "body": message }
       }
6. Verifikasi webhook status delivery di endpoint /api/v1/webhooks/whatsapp.
=============================================================================
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from uuid import UUID, uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# In-memory log cache untuk fallback jika tabel database belum dimigrasi di remote
MOCK_NOTIFICATION_MEMORY_LOGS: List[Dict[str, Any]] = [
    {
        "id": "wa-mock-init-01",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "phone": "+6281234567890",
        "message": "Halo Budi! Servis iPhone 11 Anda (Tiket #REP-001) sudah selesai dan lolos QC teknisi. Total biaya: Rp 650.000. Unit siap diambil di toko.",
        "template_name": "repair_done_notification",
        "status": "SIMULATED_SENT",
        "channel": "WHATSAPP",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "wa-mock-init-02",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "phone": "+6281987654321",
        "message": "Halo Kak Siti! Servis HP Anda sudah berjalan 1 hari (H+1). Mohon konfirmasi apakah touchscreen sudah responsif sempurna? Masa garansi aktif 30 hari.",
        "template_name": "aftercare_h1_warranty",
        "status": "SIMULATED_SENT",
        "channel": "WHATSAPP",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

async def send_wa_message(
    tenant_id: Union[str, UUID],
    phone_number: str,
    message: str,
    template_name: str = "general_notification",
    metadata: Optional[Dict[str, Any]] = None,
    db: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """
    Simulasi Adapter WhatsApp Business API.
    
    1. Print ke log konsol backend: [WA MOCK] Mengirim ke {phone}: {message}.
    2. Simpan record log ke tabel `notification_logs` di PostgreSQL.
    3. Fallback aman ke in-memory list jika tabel belum di-migrate.
    """
    clean_phone = phone_number.strip()
    if not clean_phone.startswith("+") and clean_phone.startswith("08"):
        clean_phone = "+62" + clean_phone[1:]
    elif not clean_phone.startswith("+") and clean_phone.startswith("62"):
        clean_phone = "+" + clean_phone

    # 1. Print ke backend console
    print(f"\n[WA MOCK] ========================================================")
    print(f"[WA MOCK] Mengirim ke : {clean_phone}")
    print(f"[WA MOCK] Template    : {template_name}")
    print(f"[WA MOCK] Pesan       : {message}")
    print(f"[WA MOCK] ========================================================\n")

    log_entry = {
        "id": str(uuid4()),
        "tenant_id": str(tenant_id),
        "phone": clean_phone,
        "message": message,
        "template_name": template_name,
        "status": "SIMULATED_SENT",
        "channel": "WHATSAPP",
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # 2. Simpan ke database jika session tersedia
    if db:
        try:
            await db.execute(
                text("""
                    INSERT INTO public.notification_logs (
                        id, tenant_id, phone, message, template_name, status, channel, metadata
                    ) VALUES (
                        :id, :tenant_id, :phone, :message, :template_name, :status, :channel, :metadata::jsonb
                    )
                """),
                {
                    "id": log_entry["id"],
                    "tenant_id": log_entry["tenant_id"],
                    "phone": log_entry["phone"],
                    "message": log_entry["message"],
                    "template_name": log_entry["template_name"],
                    "status": log_entry["status"],
                    "channel": log_entry["channel"],
                    "metadata": json.dumps(log_entry["metadata"])
                }
            )
            await db.commit()
        except Exception as e:
            # Table might not exist yet in remote Supabase
            print(f"[WA MOCK] Catatan: Gagal insert ke tabel notification_logs ({e}), fallback ke memory log.")

    # 3. Selalu simpan juga ke in-memory queue
    MOCK_NOTIFICATION_MEMORY_LOGS.insert(0, log_entry)
    if len(MOCK_NOTIFICATION_MEMORY_LOGS) > 100:
        MOCK_NOTIFICATION_MEMORY_LOGS.pop()

    return log_entry


async def send_repair_done_notification(
    tenant_id: Union[str, UUID],
    phone: str,
    customer_name: str,
    device_model: str,
    ticket_id: str,
    final_cost: int,
    db: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """Mengirimkan pesan otomatis saat tiket servis selesai (Done / QC Pass)."""
    msg = (
        f"Halo Kak {customer_name}! 📱\n"
        f"Perangkat *{device_model}* Anda dengan No. Tiket *#{ticket_id[:8].upper()}* "
        f"telah SELESAI diperbaiki dan lulus uji fungsi QC teknisi Nexus.\n\n"
        f"💰 Total Biaya: Rp {final_cost:,}\n"
        f"🛡️ Garansi: 30 Hari Pergantian Suku Cadang.\n\n"
        f"Unit dapat diambil di konter toko cabang kami pada jam operasional (10.00 - 21.00 WIB).\n"
        f"Terima kasih telah mempercayakan servis HP Anda kepada kami! 🙏"
    )
    return await send_wa_message(
        tenant_id=tenant_id,
        phone_number=phone,
        message=msg,
        template_name="repair_done_notification",
        metadata={"device_model": device_model, "ticket_id": ticket_id, "final_cost": final_cost},
        db=db
    )


async def send_aftercare_notification(
    tenant_id: Union[str, UUID],
    phone: str,
    customer_name: str,
    device_model: str,
    day_stage: int, # 1, 7, 14
    db: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """Mengirimkan pesan aftercare otomatis pada interval H+1, H+7, atau H+14."""
    if day_stage == 1:
        msg = (
            f"Halo Kak {customer_name}! 👋\n"
            f"Sudah 1 hari berlalu sejak servis *{device_model}* selesai.\n"
            f"Bagaimana performa layar sentuh, baterai, dan responsivitasnya hari ini?\n"
            f"Jika ada kendala sedikit pun, segera hubungi kami karena masa garansi 30 hari sedang aktif. 😊"
        )
        tpl = "aftercare_h1_warranty"
    elif day_stage == 7:
        msg = (
            f"Halo Kak {customer_name}! ✨\n"
            f"Sudah 1 minggu *{device_model}* Anda kami rawat.\n"
            f"Apakah semuanya berfungsi normal tanpa kendala panas atau baterai drop?\n"
            f"Kami siap melayani jika Anda membutuhkan konsultasi perawatan berkala."
        )
        tpl = "aftercare_h7_checkup"
    else: # 14 or 30
        msg = (
            f"Halo Kak {customer_name}! 🎉\n"
            f"Terima kasih sudah menjadi pelanggan setia Nexus Service.\n"
            f"Khusus untuk Kakak, kami berikan Voucher Diskon 15% untuk pembelian Tempered Glass & Casing MagSafe "
            f"dengan kode promo: *NEXUSCARE15* di toko offline kami. Valid sampai akhir bulan!"
        )
        tpl = "aftercare_h14_promo"

    return await send_wa_message(
        tenant_id=tenant_id,
        phone_number=phone,
        message=msg,
        template_name=tpl,
        metadata={"device_model": device_model, "day_stage": day_stage},
        db=db
    )


async def send_tiktok_order_notification(
    tenant_id: Union[str, UUID],
    phone: str,
    order_id: str,
    buyer_name: str,
    item_summary: str,
    total_amount: int,
    db: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """Mengirimkan konfirmasi pesanan TikTok Shop ke pembeli atau owner."""
    msg = (
        f"Halo {buyer_name}! 🛍️\n"
        f"Pesanan TikTok Shop Anda *#{order_id}* telah kami terima dan masuk tahap packing:\n"
        f"📦 {item_summary}\n"
        f"💵 Total: Rp {total_amount:,}\n\n"
        f"Resi pengiriman kurir akan kami update segera begitu paket diserahkan. "
        f"Terima kasih telah berbelanja di toko resmi kami di TikTok Shop! ✨"
    )
    return await send_wa_message(
        tenant_id=tenant_id,
        phone_number=phone,
        message=msg,
        template_name="tiktok_order_confirmation",
        metadata={"order_id": order_id, "total_amount": total_amount},
        db=db
    )


async def get_recent_notification_logs(
    tenant_id: Union[str, UUID],
    db: Optional[AsyncSession] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Mengambil riwayat log notifikasi WA (dari PostgreSQL atau fallback in-memory)."""
    tenant_id_str = str(tenant_id)
    if db:
        try:
            result = await db.execute(
                text("""
                    SELECT id, tenant_id, phone, message, template_name, status, channel, metadata, created_at
                    FROM public.notification_logs
                    WHERE tenant_id = :tenant_id
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {"tenant_id": tenant_id_str, "limit": limit}
            )
            rows = result.mappings().all()
            if rows:
                return [
                    {
                        "id": str(r["id"]),
                        "tenant_id": str(r["tenant_id"]),
                        "phone": r["phone"],
                        "message": r["message"],
                        "template_name": r["template_name"],
                        "status": r["status"],
                        "channel": r["channel"],
                        "metadata": r["metadata"] if isinstance(r["metadata"], dict) else {},
                        "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
                    }
                    for r in rows
                ]
        except Exception:
            pass

    # Fallback to memory logs
    return [l for l in MOCK_NOTIFICATION_MEMORY_LOGS if l["tenant_id"] == tenant_id_str][:limit]
