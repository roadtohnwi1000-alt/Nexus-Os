"""
NEXUS CORE OS - C-SUITE TELEGRAM BOT FOR REMOTE OWNER
File: apps/core-api/app/api/v1/csuite_telegram.py

Menyediakan integrasi Telegram Bot khusus untuk Pemilik Toko / Direksi (C-Level):
1. Memungkinkan pemilik memantau operasional saat dinas luar kota tanpa laptop.
2. Mengakses query eksekutif: Saldo Kas, Dead Stock, Rekomendasi Restock, Margin Kategori.
3. Menjalankan Action Triggers interaktif via Inline Keyboard:
   - [Approve Draft PO Restock]
   - [Launch Promo Cuci Gudang]
   - [Audit Arus Kas & Runway]
"""

from typing import Dict, Any, Optional
import os
import httpx
from fastapi import APIRouter, Request, HTTPException, status, Header
from pydantic import BaseModel, Field

from app.services.csuite_advisory import (
    process_csuite_advisory_message,
    audit_csuite_cash_flow,
    analyze_dead_stock,
    analyze_restock_recommendations,
    trigger_marketing_promo_action,
    trigger_purchase_order_action
)

router = APIRouter(prefix="/csuite/telegram", tags=["C-Suite Telegram Executive Bot"])

DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "mock_telegram_bot_token")


class TelegramWebhookPayload(BaseModel):
    update_id: int
    message: Optional[Dict[str, Any]] = None
    callback_query: Optional[Dict[str, Any]] = None


class TelegramSimulatePayload(BaseModel):
    user_query: str = Field(..., description="Pesan atau tombol yang ditekan owner di Telegram")
    chat_id: Optional[int] = Field(987654321, description="Telegram Chat ID pemilik toko")


def build_csuite_inline_keyboard() -> Dict[str, Any]:
    """
    Membuat layout tombol interaktif Telegram Inline Keyboard
    untuk navigasi cepat satu-ketukan bagi pemilik toko.
    """
    return {
        "inline_keyboard": [
            [
                {"text": "📊 Saldo Kas & Runway", "callback_data": "csuite_cash_flow"},
                {"text": "⚠️ Audit Modal Beku", "callback_data": "csuite_dead_stock"}
            ],
            [
                {"text": "📦 Saran Restock PO", "callback_data": "csuite_restock_po"},
                {"text": "🚀 Launch Promo TikTok", "callback_data": "csuite_promo_deadstock"}
            ]
        ]
    }


@router.post("/webhook")
async def telegram_csuite_webhook(
    payload: TelegramWebhookPayload,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None)
):
    """
    Webhook Receiver resmi dari Telegram Bot API:
    Memproses pesan masuk atau klik callback button dari Telegram pemilik toko.
    """
    # 1. Penanganan Callback Query (Saat Pemilik Klik Tombol Inline di Telegram)
    if payload.callback_query:
        cb = payload.callback_query
        data = cb.get("data", "")
        chat_id = cb.get("message", {}).get("chat", {}).get("id", 0)

        reply_text = ""
        keyboard = build_csuite_inline_keyboard()

        if data == "csuite_cash_flow":
            res = await audit_csuite_cash_flow(DEFAULT_TENANT_ID)
            reply_text = res["reply"]
        elif data == "csuite_dead_stock":
            res = await analyze_dead_stock(DEFAULT_TENANT_ID)
            reply_text = res["reply"] + "\n\n💡 *Ketik 'buat promo cuci gudang' untuk eksekusi diskon ke Marketing.*"
        elif data == "csuite_restock_po":
            res = await analyze_restock_recommendations(DEFAULT_TENANT_ID)
            reply_text = res["reply"] + "\n\n💡 *Ketik 'buat po restock' untuk terbitkan order supplier otomatis.*"
        elif data == "csuite_promo_deadstock":
            res = await trigger_marketing_promo_action(DEFAULT_TENANT_ID)
            reply_text = res["reply"]
        elif data == "csuite_approve_po":
            res = await trigger_purchase_order_action(DEFAULT_TENANT_ID)
            reply_text = res["reply"]
        else:
            reply_text = "Perintah eksekutif tidak dikenali."

        return {
            "status": "success",
            "type": "CALLBACK_PROCESSED",
            "chat_id": chat_id,
            "reply": reply_text,
            "inline_keyboard": keyboard
        }

    # 2. Penanganan Pesan Teks Masuk dari Pemilik
    if payload.message:
        msg = payload.message
        text = msg.get("text", "")
        chat_id = msg.get("chat", {}).get("id", 0)

        # Proses melalui NLU Agentic Advisory Engine
        advisory_res = await process_csuite_advisory_message(
            user_message=text,
            tenant_id=DEFAULT_TENANT_ID
        )

        return {
            "status": "success",
            "type": "MESSAGE_PROCESSED",
            "chat_id": chat_id,
            "reply": advisory_res["reply"],
            "tool_called": advisory_res.get("tool_called"),
            "inline_keyboard": build_csuite_inline_keyboard()
        }

    return {"status": "ignored", "reason": "No message or callback_query"}


@router.post("/simulate")
async def simulate_telegram_interaction(payload: TelegramSimulatePayload):
    """
    Endpoint simulasi pengujian C-Suite Telegram:
    Memungkinkan pengujian alur percakapan & action triggers Telegram secara langsung
    dari antarmuka Web atau Swagger tanpa harus deploy ke server public Telegram.
    """
    query = payload.user_query.strip()
    
    # Jika query cocok dengan callback data tombol
    if query.startswith("csuite_"):
        sim_payload = TelegramWebhookPayload(
            update_id=1001,
            callback_query={
                "data": query,
                "message": {"chat": {"id": payload.chat_id}}
            }
        )
        return await telegram_csuite_webhook(sim_payload)

    # Jika query adalah teks biasa dari owner
    sim_payload = TelegramWebhookPayload(
        update_id=1002,
        message={
            "text": query,
            "chat": {"id": payload.chat_id}
        }
    )
    return await telegram_csuite_webhook(sim_payload)


@router.get("/status")
async def get_csuite_telegram_status():
    """
    Status koneksi bot Telegram C-Suite untuk store owner.
    """
    return {
        "bot_configured": True,
        "bot_username": "@NexusExecutiveBot",
        "authorized_roles": ["STORE_OWNER", "BOARD_OF_DIRECTORS", "MAJORITY_SHAREHOLDER"],
        "supported_action_triggers": [
            "AUDIT_CASH_FLOW",
            "ANALYZE_DEAD_STOCK",
            "SMART_PO_REORDER",
            "LAUNCH_DISCOUNT_PROMO",
            "COMPETITOR_PRICE_SCAN"
        ],
        "remote_access_enabled": True
    }
