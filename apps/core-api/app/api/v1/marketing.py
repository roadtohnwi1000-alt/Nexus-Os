"""
NEXUS CORE OS - SOCIAL & E-COMMERCE MARKETING STUDIO API
File: apps/core-api/app/api/v1/marketing.py

Menangani automasi pemasaran terpadu (Omnichannel Marketing & E-Commerce):
1. Antrean draf kampanye AI (Approval Queue - Human in the Loop).
2. Generator konten kreatif instan berbasis inventori toko aktif.
3. Sinkronisasi multi-channel e-commerce (TikTok Shop & Shopee) untuk mencegah oversell.
4. Riwayat publikasi dan pelacak performa konversi penjualan.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Literal
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/marketing", tags=["Social & E-Commerce Marketing Studio"])


# ==============================================================================
# SCHEMAS
# ==============================================================================

class CampaignDraft(BaseModel):
    id: str
    tenant_id: str
    title: str
    caption: str
    channels: List[str]
    category: Literal["PROMO", "EDUCATION", "SERVICE_SHOWCASE", "NEW_ARRIVAL"]
    target_audience: str
    hashtags: List[str]
    suggested_media: str
    linked_sku: Optional[str] = None
    linked_item_name: Optional[str] = None
    status: Literal["DRAFT", "SCHEDULED", "POSTED", "REJECTED"]
    generated_at: str
    posted_at: Optional[str] = None
    simulated_url: Optional[str] = None


class DraftGenerateRequest(BaseModel):
    item_id: Optional[str] = None
    item_name: str = Field(..., description="Nama barang atau jasa yang ingin dipromosikan")
    sku: Optional[str] = None
    angle: Literal["DISCOUNT_PROMO", "EDUCATIONAL_TIPS", "URGENCY_LIMITED_STOCK", "SERVICE_EXCELLENCE"]
    target_channels: List[str] = Field(default=["Instagram", "TikTok"])
    tone: Optional[str] = "Menarik, terpercaya, dan persuasif"


class ECommerceChannelStatus(BaseModel):
    platform: str
    account_name: str
    is_connected: bool
    sync_status: str
    total_synced_items: int
    pending_orders: int
    last_sync_time: str


# ==============================================================================
# DATA STORE (IN-MEMORY / DEMO REALISTIS)
# ==============================================================================

_CAMPAIGN_DRAFTS: List[Dict[str, Any]] = [
    {
        "id": "cmp-001",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "title": "🔥 Promo Spesial Ganti LCD iPhone 11 Original OEM - Bergaransi!",
        "caption": "Layar iPhone 11 kamu pecah, bergaris, atau ghost touch? 📱✨\n\nJangan biarkan aktivitasmu terhambat! Nikmati promo penggantian LCD Original OEM cuma 30 menit bisa ditunggu. Gratis kalibrasi True Tone & pembersihan speaker di meja kasir. Garansi tukar baru 30 hari penuh!",
        "channels": ["Instagram", "TikTok"],
        "category": "PROMO",
        "target_audience": "Pengguna iPhone 11 & Komunitas Gadget",
        "hashtags": ["#ServisiPhone", "#GantiLCD", "#AppleRepair", "#FixPhoneParts", "#PromoServis"],
        "suggested_media": "Video pendek 30 detik: Sebelum vs Sesudah pengerjaan kalibrasi True Tone",
        "linked_sku": "LCD-IPH-11",
        "linked_item_name": "LCD iPhone 11 Original OEM",
        "status": "DRAFT",
        "generated_at": "15 menit lalu (via Autonomous Marketing Swarm)"
    },
    {
        "id": "cmp-002",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "title": "🔋 4 Tanda Baterai HP Sudah Wajib Diganti Sebelum Kembung Merusak Mesin",
        "caption": "Sering abis baterai mendadak padahal indikator masih 20%? 😱\n\nItu tanda cell baterai kamu sudah bocor! Berikut 4 ciri baterai minta pensiun:\n1. Baterai drop drastis dalam 15 menit.\n2. Layar mulai terangkat karena baterai kembung.\n3. Suhu HP cepat panas meski cuma buka chat.\n4. Battery Health di bawah 75%.\n\nStok baterai original Samsung & iPhone ready di outlet kami dengan promo pasang gratis!",
        "channels": ["TikTok", "Instagram", "WhatsApp Status"],
        "category": "EDUCATION",
        "target_audience": "Seluruh Pengguna Smartphone",
        "hashtags": ["#TipsGadget", "#BatteryHealth", "#RawatHP", "#BateraiOriginal"],
        "suggested_media": "Carousel infografis 4 slide perbandingan baterai sehat vs kembung",
        "linked_sku": "BAT-SAM-S21",
        "linked_item_name": "Baterai Samsung Galaxy S21 (4000mAh)",
        "status": "DRAFT",
        "generated_at": "45 menit lalu (via Autonomous Marketing Swarm)"
    },
    {
        "id": "cmp-003",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "title": "⚡ Spesialis Servis Mesin HP Mati Total & Reball Chipset Mikrosolder",
        "caption": "HP kesayangan mati total karena kena air atau korsleting tegangan? Jangan buru-buru lem biru!\n\nTeknisi berpengalaman kami melayani perbaikan mikrosolder level IC Power PM6150 dan reballing CPU dengan presisi mikroskop. Konsultasi & cek kerusakan GRATIS tanpa dipungut biaya!",
        "channels": ["Instagram", "Facebook"],
        "category": "SERVICE_SHOWCASE",
        "target_audience": "Teknisi Rekanan & Pemilik Ponsel Rusak Berat",
        "hashtags": ["#ReballCPU", "#ServisMesinHP", "#ICPower", "#B2BService", "#TeknisiHP"],
        "suggested_media": "Foto mikroskop hasil cetak timah IC BGA rapi dan presisi",
        "linked_sku": "IC-PWR-PM6150",
        "linked_item_name": "IC Power PM6150 Xiaomi/Redmi",
        "status": "DRAFT",
        "generated_at": "2 jam lalu (via Autonomous Marketing Swarm)"
    }
]

_POSTED_HISTORY: List[Dict[str, Any]] = [
    {
        "id": "pst-001",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "title": "🎉 Weekend Flash Sale: Kabel Data Fast Charge 100W Braided",
        "caption": "Dapatkan kabel data type-c to type-c 100W cuma Rp 45.000 selama weekend ini!",
        "channels": ["Instagram", "TikTok"],
        "category": "PROMO",
        "target_audience": "Pelanggan Sekitar Toko",
        "hashtags": ["#FlashSale", "#KabelData100W", "#AksesorisHP"],
        "suggested_media": "Banner Grafis Promo",
        "status": "POSTED",
        "generated_at": "2 hari lalu",
        "posted_at": "28 Okt 2026, 10:00 WIB",
        "simulated_url": "https://instagram.com/p/flash_sale_cable_100w"
    }
]

_ECOMMERCE_STATUS: List[Dict[str, Any]] = [
    {
        "platform": "TikTok Shop",
        "account_name": "FixPhone Official Store",
        "is_connected": True,
        "sync_status": "SYNCHRONIZED",
        "total_synced_items": 48,
        "pending_orders": 2,
        "last_sync_time": "5 menit yang lalu"
    },
    {
        "platform": "Shopee",
        "account_name": "FixPhone_Sparepart_Hub",
        "is_connected": True,
        "sync_status": "SYNCHRONIZED",
        "total_synced_items": 42,
        "pending_orders": 0,
        "last_sync_time": "12 menit yang lalu"
    },
    {
        "platform": "Tokopedia",
        "account_name": "FixPhone Parts Jakarta",
        "is_connected": False,
        "sync_status": "DISCONNECTED",
        "total_synced_items": 0,
        "pending_orders": 0,
        "last_sync_time": "Belum terhubung"
    }
]


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.get("/campaigns", response_model=List[CampaignDraft])
async def get_campaign_drafts(
    status_filter: Optional[str] = Query("DRAFT", description="Filter status: DRAFT, POSTED, ALL"),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil antrean draf konten promosi & marketing AI untuk tenant aktif.
    """
    tenant_str = str(current_tenant_id)
    if status_filter == "POSTED":
        return [CampaignDraft(**c) for c in _POSTED_HISTORY if c["tenant_id"] == tenant_str]
    elif status_filter == "ALL":
        all_items = [c for c in _CAMPAIGN_DRAFTS if c["tenant_id"] == tenant_str] + [c for c in _POSTED_HISTORY if c["tenant_id"] == tenant_str]
        return [CampaignDraft(**c) for c in all_items]
    else:
        return [CampaignDraft(**c) for c in _CAMPAIGN_DRAFTS if c["tenant_id"] == tenant_str and c["status"] == "DRAFT"]


@router.post("/generate-draft", response_model=CampaignDraft, status_code=status.HTTP_201_CREATED)
async def generate_campaign_draft(
    payload: DraftGenerateRequest,
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Memicu pembuatan draf konten baru secara instan berbasis produk toko aktif.
    """
    tenant_str = str(current_tenant_id)
    new_id = f"cmp-{uuid4().hex[:6]}"
    now_str = "Baru saja (via Autonomous Marketing Generator)"

    # AI Template generator rule-based
    if payload.angle == "DISCOUNT_PROMO":
        title = f"🔥 Promo Spesial {payload.item_name} - Penawaran Terbatas!"
        caption = f"Lagi cari {payload.item_name}? 📱✨\n\nKabar baik! Khusus minggu ini, dapatkan promo harga spesial langsung di outlet kami atau pesan via online. Garansi terjamin dan siap kirim hari ini juga!"
        category = "PROMO"
    elif payload.angle == "EDUCATIONAL_TIPS":
        title = f"💡 Tips Penting Perawatan Gadget: Kapan Harus Ganti {payload.item_name}?"
        caption = f"Banyak yang belum tahu, pemakaian {payload.item_name} yang tidak tepat bisa memicu kerusakan komponen lainnya! Simak tips singkat dari teknisi kami berikut..."
        category = "EDUCATION"
    elif payload.angle == "URGENCY_LIMITED_STOCK":
        title = f"⚠️ Sisa Stok Terbatas: {payload.item_name} Segera Habis!"
        caption = f"Permintaan tinggi! Stok {payload.item_name} di gudang utama kami tersisa sedikit. Segera amankan unit kamu sekarang sebelum kehabisan!"
        category = "PROMO"
    else:
        title = f"✨ Hasil Pengerjaan Servis: Pemasangan {payload.item_name}"
        caption = f"Unit selesai dikerjakan dengan presisi tinggi menggunakan {payload.item_name}. Kepuasan pelanggan adalah prioritas utama kami!"
        category = "SERVICE_SHOWCASE"

    new_draft = {
        "id": new_id,
        "tenant_id": tenant_str,
        "title": title,
        "caption": caption,
        "channels": payload.target_channels,
        "category": category,
        "target_audience": "Pelanggan Toko & Rekanan Pengguna Smartphone",
        "hashtags": [f"#{payload.item_name.replace(' ', '')}", "#SparepartHP", "#FixPhoneStore", "#PromoGadget"],
        "suggested_media": f"Foto produk resmi dan infografis keunggulan {payload.item_name}",
        "linked_sku": payload.sku or "SKU-AUTO",
        "linked_item_name": payload.item_name,
        "status": "DRAFT",
        "generated_at": now_str
    }
    _CAMPAIGN_DRAFTS.insert(0, new_draft)
    return CampaignDraft(**new_draft)


@router.post("/campaigns/{campaign_id}/approve", response_model=CampaignDraft)
async def approve_campaign(
    campaign_id: str,
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menyetujui draf konten AI (Human in the Loop) dan memicu publikasi multi-channel.
    """
    tenant_str = str(current_tenant_id)
    draft = next((d for d in _CAMPAIGN_DRAFTS if d["id"] == campaign_id and d["tenant_id"] == tenant_str), None)

    if not draft:
        raise HTTPException(status_code=404, detail="Draf kampanye tidak ditemukan")

    _CAMPAIGN_DRAFTS.remove(draft)
    time_now = datetime.now().strftime("%d %b %Y, %H:%M WIB")

    published_item = {
        **draft,
        "status": "POSTED",
        "posted_at": time_now,
        "simulated_url": f"https://{draft['channels'][0].lower().replace(' ', '')}.com/post/auto_{campaign_id}"
    }
    _POSTED_HISTORY.insert(0, published_item)
    return CampaignDraft(**published_item)


@router.post("/campaigns/{campaign_id}/reject")
async def reject_campaign(
    campaign_id: str,
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menolak draf konten AI dan menghapusnya dari antrean.
    """
    tenant_str = str(current_tenant_id)
    draft = next((d for d in _CAMPAIGN_DRAFTS if d["id"] == campaign_id and d["tenant_id"] == tenant_str), None)

    if not draft:
        raise HTTPException(status_code=404, detail="Draf kampanye tidak ditemukan")

    _CAMPAIGN_DRAFTS.remove(draft)
    return {"success": True, "message": f"Draf {campaign_id} berhasil ditolak dan dihapus"}


@router.get("/ecommerce-status", response_model=List[ECommerceChannelStatus])
async def get_ecommerce_channels_status():
    """
    Mengambil status koneksi dan sinkronisasi multi-channel marketplace e-commerce.
    """
    return [ECommerceChannelStatus(**ch) for ch in _ECOMMERCE_STATUS]
