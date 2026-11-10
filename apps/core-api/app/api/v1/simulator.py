"""
NEXUS CORE OS - API SIMULATOR ROUTER
File: apps/core-api/app/api/v1/simulator.py

Endpoint kontrol untuk menguji coba integrasi eksternal (TikTok Shop & WhatsApp API)
menggunakan Adapter Pattern dan Mocking sebelum API resmi dipasangkan.
"""

from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.services.marketplace.mock_tiktok_adapter import (
    simulate_incoming_order,
    process_marketplace_order,
    DEFAULT_SIMULATION_ITEMS
)
from app.services.notifications.mock_wa_adapter import (
    send_wa_message,
    send_repair_done_notification,
    send_aftercare_notification,
    get_recent_notification_logs
)

router = APIRouter(prefix="/simulator", tags=["API Simulator & Mocking"])


class SimulateTikTokRequest(BaseModel):
    payment_method: str = Field("QRIS", description="Metode pembayaran: 'QRIS', 'COD', atau 'TRANSFER'")
    custom_items: Optional[List[Dict[str, Any]]] = None


class SimulateWARequest(BaseModel):
    phone: str = Field(..., description="Nomor WhatsApp penerima (+62...)", json_schema_extra={"example": "+6281234567890"})
    template_type: str = Field(
        "aftercare_h1",
        description="Tipe template: 'repair_done', 'aftercare_h1', 'aftercare_h7', 'aftercare_h14', atau 'custom'"
    )
    customer_name: Optional[str] = Field("Budi Santoso", description="Nama pelanggan")
    device_model: Optional[str] = Field("iPhone 11 64GB", description="Model perangkat")
    ticket_id: Optional[str] = Field("REP-001", description="ID Tiket Servis")
    final_cost: Optional[int] = Field(650000, description="Biaya servis")
    custom_message: Optional[str] = Field(None, description="Teks pesan kustom jika template_type='custom'")


@router.post("/tiktok-order", status_code=status.HTTP_200_OK, summary="Memicu simulasi order masuk TikTok Shop")
async def trigger_simulated_tiktok_order(
    payload: Optional[SimulateTikTokRequest] = None,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menjalankan alur lengkap order TikTok Shop:
    - Menghasilkan payload webhook simulasi.
    - Mengurangi stok fisik produk di inventaris toko.
    - Mencatat mutasi ke stock_movements ledger.
    - Menghasilkan ayat jurnal akuntansi otomatis (Kas, Penjualan, HPP, Persediaan).
    - Memicu notifikasi konfirmasi ke WhatsApp pembeli.
    """
    payment_method = payload.payment_method if payload else "QRIS"
    custom_items = payload.custom_items if payload else None

    # 1. Generate payload simulasi webhook
    simulated_webhook = simulate_incoming_order(
        tenant_id=current_tenant_id,
        custom_items=custom_items,
        payment_method=payment_method
    )

    # 2. Proses pesanan ke core logic
    result = await process_marketplace_order(
        tenant_id=current_tenant_id,
        order_payload=simulated_webhook,
        db=db
    )

    return {
        "simulation_webhook_payload": simulated_webhook,
        "processing_result": result
    }


@router.post("/send-wa", status_code=status.HTTP_200_OK, summary="Memicu simulasi pengiriman pesan WhatsApp")
async def trigger_simulated_wa(
    payload: SimulateWARequest,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengirimkan pesan simulasi WhatsApp:
    - repair_done: Notifikasi unit servis selesai & siap diambil.
    - aftercare_h1: Pengecekan fungsi unit H+1 pasca servis & aktivasi garansi.
    - aftercare_h7: Check-up performa H+7.
    - aftercare_h14: Penawaran voucher aksesoris / promo loyalty.
    - custom: Pesan bebas manual.
    """
    if payload.template_type == "repair_done":
        log_entry = await send_repair_done_notification(
            tenant_id=current_tenant_id,
            phone=payload.phone,
            customer_name=payload.customer_name or "Pelanggan",
            device_model=payload.device_model or "Smartphone",
            ticket_id=payload.ticket_id or "REP-001",
            final_cost=payload.final_cost or 150000,
            db=db
        )
    elif payload.template_type in ["aftercare_h1", "aftercare_h7", "aftercare_h14"]:
        day_stage = 1 if payload.template_type == "aftercare_h1" else 7 if payload.template_type == "aftercare_h7" else 14
        log_entry = await send_aftercare_notification(
            tenant_id=current_tenant_id,
            phone=payload.phone,
            customer_name=payload.customer_name or "Pelanggan",
            device_model=payload.device_model or "Smartphone",
            day_stage=day_stage,
            db=db
        )
    else:
        # Custom message
        msg_text = payload.custom_message or "Halo! Ini adalah pesan simulasi WhatsApp dari Nexus OS."
        log_entry = await send_wa_message(
            tenant_id=current_tenant_id,
            phone_number=payload.phone,
            message=msg_text,
            template_name="custom_message",
            metadata={"sender": "owner_simulator"},
            db=db
        )

    return {
        "success": True,
        "log": log_entry
    }


@router.get("/notification-logs", status_code=status.HTTP_200_OK, summary="Mengambil riwayat log notifikasi WhatsApp")
async def get_notification_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Mengambil riwayat pesan notifikasi yang terkirim (simulasi)."""
    logs = await get_recent_notification_logs(
        tenant_id=current_tenant_id,
        db=db,
        limit=limit
    )
    return {
        "total": len(logs),
        "logs": logs
    }
