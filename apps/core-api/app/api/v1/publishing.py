"""
NEXUS OS - REST API Multi-Channel Publishing & Closed-Loop Attribution
Domain C: Publishing, Distribution & Closing the Loop
"""

from fastapi import APIRouter, Header, HTTPException, Query, status, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from app.services.publishing import get_publishing_service
from app.services.attribution import get_link_tracker, get_closed_loop_engine

router = APIRouter(prefix="/publishing", tags=["Multi-Channel Publishing & Attribution (Domain C)"])

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================

class ConnectChannelPayload(BaseModel):
    platform: str = Field(..., description="YOUTUBE_SHORTS, TIKTOK, atau INSTAGRAM_REELS")
    channel_name: str = Field(..., description="Nama kanal/akun")
    channel_handle: str = Field(..., description="Handle @username")
    credentials_encrypted: Optional[str] = Field(default=None, description="Token OAuth2 terenkripsi")

class PublishNowPayload(BaseModel):
    video_job_id: str = Field(..., description="ID pekerjaan video dari Fase 7")
    opportunity_code: str = Field(default="OPP-001", description="Kode peluang")
    platform: str = Field(..., description="Target platform")
    channel_id: str = Field(..., description="ID kanal terhubung")
    caption: str = Field(..., description="Naskah teks caption")
    hashtags: List[str] = Field(default_factory=list, description="Daftar hashtag")
    metadata: Optional[Dict[str, Any]] = Field(default=None)

class SchedulePublishPayload(BaseModel):
    video_job_id: str = Field(..., description="ID pekerjaan video dari Fase 7")
    opportunity_code: str = Field(default="OPP-001", description="Kode peluang")
    platform: str = Field(..., description="Target platform")
    channel_id: str = Field(..., description="ID kanal terhubung")
    scheduled_for: str = Field(..., description="Waktu jadwal ISO timestamp (e.g. 2026-11-03T19:30:00Z)")
    caption: str = Field(..., description="Naskah teks caption")
    hashtags: List[str] = Field(default_factory=list, description="Daftar hashtag")
    metadata: Optional[Dict[str, Any]] = Field(default=None)

class CreateLinkPayload(BaseModel):
    opportunity_code: str = Field(..., description="Kode peluang produk")
    destination_url: str = Field(..., description="URL tujuan checkout (Shopee/TikTok Shop)")
    short_code: Optional[str] = Field(default=None, description="Kustom slug shortlink")
    campaign_tag: str = Field(default="nexus_ai_shorts", description="Tag kampanye UTM")
    publication_id: Optional[str] = Field(default=None)

class PerformanceFeedbackPayload(BaseModel):
    opportunity_code: str = Field(..., description="Kode peluang produk")
    product_name: str = Field(..., description="Nama produk")
    views_48h: int = Field(..., description="Jumlah tayangan organik 48 jam")
    clicks_48h: int = Field(..., description="Jumlah klik tautan keranjang kuning/link")
    orders_count: int = Field(..., description="Jumlah pesanan selesai")
    attributed_revenue_idr: float = Field(..., description="Total omzet diatribusikan (Rupiah)")
    winning_angle: str = Field(default="FOMO_AGITATION", description="Sudut pandang naskah pemenang")

# ==============================================================================
# ROUTE ENDPOINTS
# ==============================================================================

@router.get("/channels")
def list_connected_channels(
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil daftar kanal media sosial (YouTube, TikTok, Instagram) yang terhubung."""
    service = get_publishing_service()
    channels = service.get_channels(tenant_id=x_tenant_id)
    return {"status": "success", "total_channels": len(channels), "channels": channels}

@router.post("/channels/connect", status_code=status.HTTP_201_CREATED)
def connect_new_channel(
    payload: ConnectChannelPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Menghubungkan akun media sosial baru per tenant."""
    service = get_publishing_service()
    try:
        new_chan = service.connect_channel(
            tenant_id=x_tenant_id,
            platform=payload.platform,
            channel_name=payload.channel_name,
            channel_handle=payload.channel_handle,
            credentials_encrypted=payload.credentials_encrypted
        )
        return {"status": "success", "message": f"Kanal '{payload.channel_name}' berhasil dihubungkan.", "channel": new_chan}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/prime-time-slots")
def get_prime_time_slots():
    """Mengambil rekomendasi jam emas upload video pendek (Prime Time WIB)."""
    service = get_publishing_service()
    return {"status": "success", "slots": service.get_prime_time_slots()}

@router.get("/queue")
def get_publishing_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    platform: Optional[str] = Query(None),
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil antrean video yang dijadwalkan maupun riwayat yang telah dipublikasikan."""
    service = get_publishing_service()
    posts = service.get_posts(tenant_id=x_tenant_id, status=status_filter, platform=platform)
    return {"status": "success", "total_posts": len(posts), "posts": posts}

@router.post("/publish-now")
def publish_now_endpoint(
    payload: PublishNowPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mempublikasikan video langsung ke platform tujuan via adapter terkait."""
    service = get_publishing_service()
    try:
        post = service.publish_now(
            tenant_id=x_tenant_id,
            video_job_id=payload.video_job_id,
            opportunity_code=payload.opportunity_code,
            platform=payload.platform,
            channel_id=payload.channel_id,
            caption=payload.caption,
            hashtags=payload.hashtags,
            metadata=payload.metadata
        )
        return {
            "status": "success",
            "message": f"Video berhasil diunggah ke {payload.platform}.",
            "post": post
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/schedule")
def schedule_video_endpoint(
    payload: SchedulePublishPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Menjadwalkan video untuk rilis otomatis pada waktu emas (Prime Time)."""
    service = get_publishing_service()
    try:
        post = service.schedule_publication(
            tenant_id=x_tenant_id,
            video_job_id=payload.video_job_id,
            opportunity_code=payload.opportunity_code,
            platform=payload.platform,
            channel_id=payload.channel_id,
            scheduled_for=payload.scheduled_for,
            caption=payload.caption,
            hashtags=payload.hashtags,
            metadata=payload.metadata
        )
        return {
            "status": "success",
            "message": f"Video berhasil dijadwalkan untuk rilis pada {payload.scheduled_for}.",
            "post": post
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================================================
# ATTRIBUTION & CLOSED-LOOP FEEDBACK ENDPOINTS
# ==============================================================================

@router.get("/attribution/links")
def list_attribution_links(
    opportunity_code: Optional[str] = Query(None),
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil seluruh tautan pelacak atribusi beserta statistik klik dan omzetnya."""
    tracker = get_link_tracker()
    links = tracker.get_links(tenant_id=x_tenant_id, opportunity_code=opportunity_code)
    return {"status": "success", "total_links": len(links), "links": links}

@router.post("/attribution/create-link", status_code=status.HTTP_201_CREATED)
def create_attribution_link_endpoint(
    payload: CreateLinkPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Membuat tautan pelacak atribusi baru."""
    tracker = get_link_tracker()
    link = tracker.create_attribution_link(
        tenant_id=x_tenant_id,
        opportunity_code=payload.opportunity_code,
        destination_url=payload.destination_url,
        short_code=payload.short_code,
        campaign_tag=payload.campaign_tag,
        publication_id=payload.publication_id
    )
    return {"status": "success", "message": f"Tautan atribusi 'https://nexus.to/{link['short_code']}' berhasil dibuat.", "link": link}

@router.get("/attribution/redirect/{short_code}")
def redirect_attribution_link(
    short_code: str,
    request: Request
):
    """
    Endpoint Pengalihan Klik (Redirect):
    Mencatat event klik secara instan lalu mengalihkan pembeli ke toko tujuan.
    """
    tracker = get_link_tracker()
    user_agent = request.headers.get("user-agent")
    referrer = request.headers.get("referer")
    ip_addr = request.client.host if request.client else "127.0.0.1"

    dest = tracker.record_click(
        short_code=short_code,
        user_agent=user_agent,
        referrer=referrer,
        ip_address=ip_addr
    )
    if not dest:
        raise HTTPException(status_code=404, detail="Tautan atribusi tidak ditemukan.")

    return RedirectResponse(url=dest, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

@router.post("/closed-loop/ingest-performance")
def ingest_closed_loop_feedback(
    payload: PerformanceFeedbackPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """
    Menutup Siklus (Closed Feedback Loop):
    Memasukkan data penayangan dan penjualan 48 jam untuk mengkalibrasi rumus matematis Domain A.
    """
    engine = get_closed_loop_engine()
    res = engine.process_performance_feedback(
        tenant_id=x_tenant_id,
        opportunity_code=payload.opportunity_code,
        product_name=payload.product_name,
        views_48h=payload.views_48h,
        clicks_48h=payload.clicks_48h,
        orders_count=payload.orders_count,
        attributed_revenue_idr=payload.attributed_revenue_idr,
        winning_angle=payload.winning_angle
    )
    return {
        "status": "success",
        "message": "Siklus umpan balik tertutup berhasil dijalankan. Bobot algoritma Domain A terkalibrasi.",
        "data": res
    }

@router.get("/closed-loop/status")
def get_closed_loop_status(
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil status bobot aktif dan log kalibrasi algoritma tren pasar."""
    engine = get_closed_loop_engine()
    status_data = engine.get_calibration_status(tenant_id=x_tenant_id)
    return {"status": "success", "data": status_data}
