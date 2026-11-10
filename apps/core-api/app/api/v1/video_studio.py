"""
NEXUS OS - REST API Video Studio (Domain B)
Endpoints untuk manajemen pekerjaan pembuatan video AI, naskah 3 varian, sintesis suara,
Remotion canvas props, dan persetujuan operator (Human-in-the-Loop).
"""

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from app.services.video_studio import get_studio_service

router = APIRouter(prefix="/studio", tags=["Video Studio (Domain B)"])

# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================

class CreateVideoJobPayload(BaseModel):
    opportunity_code: str = Field(..., description="Kode peluang dari Domain A, misal 'OPP-001'")
    product_name: str = Field(..., description="Nama produk yang akan diiklankan")
    category: str = Field(default="Accessories", description="Kategori produk")
    price_idr: float = Field(default=249000.0, description="Harga jual dalam Rupiah")
    stock_remaining: int = Field(default=15, description="Jumlah sisa stok di gudang")
    pain_points: Optional[List[str]] = Field(default=None, description="Keluhan konsumen / pain points")
    unique_selling_points: Optional[List[str]] = Field(default=None, description="Nilai jual unik (USP)")
    target_audience: str = Field(default="Tech enthusiast & shoppers", description="Target demografi audiens")

class SelectVariantPayload(BaseModel):
    variant_id: str = Field(..., description="ID varian naskah yang dipilih")

class ConfigureAudioPayload(BaseModel):
    voice_identity_id: str = Field(default="id_id_female_natural", description="ID identitas suara")
    bgm_track_id: str = Field(default="bgm_tech_pulse", description="ID musik latar belakang")
    bgm_volume: float = Field(default=0.15, description="Volume musik saat narasi berbunyi (0.05 - 0.5)")

class ApproveJobPayload(BaseModel):
    operator_name: Optional[str] = Field(default="Admin Operator", description="Nama pemeriksa/approver")

# ==============================================================================
# ROUTE ENDPOINTS
# ==============================================================================

@router.get("/voice-identities")
def list_voice_identities():
    """Mengambil daftar karakter suara AI Indonesia yang didukung (Natural, Wibawa, Enerjik)."""
    service = get_studio_service()
    return {"status": "success", "voices": service.get_voice_identities()}

@router.get("/bgm-tracks")
def list_bgm_tracks():
    """Mengambil daftar musik latar bebas royalti untuk video pendek."""
    service = get_studio_service()
    return {"status": "success", "bgm_tracks": service.get_bgm_tracks()}

@router.get("/jobs")
def get_video_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    niche: Optional[str] = Query(None),
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil seluruh pekerjaan video produksi milik tenant."""
    service = get_studio_service()
    jobs = service.get_jobs(tenant_id=x_tenant_id, status=status_filter, niche=niche)
    return {
        "status": "success",
        "total_jobs": len(jobs),
        "jobs": jobs
    }

@router.post("/jobs/create", status_code=status.HTTP_201_CREATED)
def create_video_job(
    payload: CreateVideoJobPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """
    Membuat draft pekerjaan video baru dari sinyal peluang Domain A.
    Seketika memproduksi 3 variasi sudut pandang naskah, audio preview, dan props kanvas Remotion.
    """
    service = get_studio_service()
    job = service.create_job_from_opportunity(
        tenant_id=x_tenant_id,
        opportunity_code=payload.opportunity_code,
        product_name=payload.product_name,
        category=payload.category,
        price_idr=payload.price_idr,
        stock_remaining=payload.stock_remaining,
        pain_points=payload.pain_points,
        unique_selling_points=payload.unique_selling_points,
        target_audience=payload.target_audience
    )
    return {
        "status": "success",
        "message": f"Pekerjaan produksi video '{job['title']}' berhasil dibuat.",
        "job": job
    }

@router.get("/jobs/{job_id}")
def get_video_job_detail(
    job_id: str,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengambil detail lengkap satu pekerjaan video beserta props kanvas dan subtitle karaoke."""
    service = get_studio_service()
    job = service.get_job_by_id(tenant_id=x_tenant_id, job_id=job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Video job dengan id '{job_id}' tidak ditemukan.")
    return {"status": "success", "job": job}

@router.post("/jobs/{job_id}/select-variant")
def select_script_variant_endpoint(
    job_id: str,
    payload: SelectVariantPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Memilih salah satu varian naskah (FOMO vs Edukatif vs Story) dan merakit ulang kanvas Remotion."""
    service = get_studio_service()
    job = service.select_script_variant(
        tenant_id=x_tenant_id,
        job_id=job_id,
        variant_id=payload.variant_id
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job atau varian naskah tidak ditemukan.")
    return {
        "status": "success",
        "message": f"Varian '{payload.variant_id}' berhasil dipilih dan diterapkan.",
        "job": job
    }

@router.post("/jobs/{job_id}/configure-audio")
def configure_audio_endpoint(
    job_id: str,
    payload: ConfigureAudioPayload,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Mengganti karakter suara AI (pria/wanita) atau musik latar video."""
    service = get_studio_service()
    job = service.reconfigure_audio(
        tenant_id=x_tenant_id,
        job_id=job_id,
        voice_identity_id=payload.voice_identity_id,
        bgm_track_id=payload.bgm_track_id,
        bgm_volume=payload.bgm_volume
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
    return {
        "status": "success",
        "message": "Konfigurasi audio dan subtitle berhasil diperbarui.",
        "job": job
    }

@router.post("/jobs/{job_id}/render")
def trigger_render_video_endpoint(
    job_id: str,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """Menjalankan proses render programmatic video MP4 1080x1920."""
    service = get_studio_service()
    job = service.render_job_video(tenant_id=x_tenant_id, job_id=job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
    return {
        "status": "success",
        "message": "Rendering video vertikal selesai.",
        "job": job
    }

@router.post("/jobs/{job_id}/approve")
def approve_job_endpoint(
    job_id: str,
    payload: Optional[ApproveJobPayload] = None,
    x_tenant_id: str = Header("11111111-1111-1111-1111-111111111111", alias="X-Tenant-ID")
):
    """
    Gerbang Persetujuan Operator (Human-in-the-Loop):
    Memberi stempel 'APPROVED' pada video agar siap dialirkan ke antrean publikasi otomatis (Fase 8).
    """
    service = get_studio_service()
    operator = payload.operator_name if payload else "Admin Operator"
    job = service.approve_job(tenant_id=x_tenant_id, job_id=job_id, operator_name=operator)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
    return {
        "status": "success",
        "message": f"Video disetujui oleh '{operator}' dan siap dialirkan ke antrean publikasi multi-channel.",
        "job": job
    }
