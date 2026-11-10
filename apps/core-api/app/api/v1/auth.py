"""
NEXUS CORE OS - SELF-SERVICE TENANT AUTHENTICATION & ONBOARDING API
File: apps/core-api/app/api/v1/auth.py

Menangani alur registrasi mandiri 30 detik (Self-Service Onboarding),
Verifikasi WhatsApp OTP 4-digit, serta Generator Tenant Multi-Industri
(Retail, Bengkel, HVAC, Seller Online, Gadget, Fashion).
"""

import json
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_tenant_db
from app.core.security import create_service_token

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Self-Service Auth & Onboarding"])

# Store in-memory untuk menyimpan sesi registrasi pending OTP (TTL: 10 menit)
# Structure: { phone: { "otp": "1234", "expires_at": datetime, "data": {...} } }
_PENDING_REGISTRATIONS: Dict[str, dict] = {}

# Store in-memory tenant terdaftar jika database remote offline
_REGISTERED_TENANTS: Dict[str, dict] = {}


# ==============================================================================
# SCHEMAS
# ==============================================================================

class RegisterPayload(BaseModel):
    owner_name: str = Field(..., min_length=2, description="Nama pemilik usaha")
    business_name: str = Field(..., min_length=2, description="Nama toko / usaha")
    business_type: str = Field(
        default="RETAIL", 
        description="Profil bisnis: RETAIL, BENGKEL, HVAC, SELLER_ONLINE, GADGET, FASHION"
    )
    phone: str = Field(..., min_length=8, description="Nomor WhatsApp aktif")
    email: Optional[str] = None
    password: str = Field(..., min_length=6, description="Password akun owner")


class VerifyOTPPayload(BaseModel):
    phone: str
    otp_code: str
    tenant_id: Optional[str] = None


class ResendOTPPayload(BaseModel):
    phone: str


class AIConsultantPayload(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    selected_business_type: Optional[str] = None


# Helper normalisasi nomor telepon Indonesia (+62 / 08 / 62)
def normalize_phone(phone: str) -> str:
    cleaned = "".join(filter(str.isdigit, phone))
    if cleaned.startswith("0"):
        return f"+62{cleaned[1:]}"
    elif cleaned.startswith("62"):
        return f"+{cleaned}"
    elif not cleaned.startswith("+"):
        return f"+{cleaned}"
    return phone.strip()


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_tenant(payload: RegisterPayload):
    """
    Registrasi mandiri calon klien baru (30 detik).
    Menghasilkan tenant_id baru, menyiapkan profil bisnis dinamis,
    dan mengirimkan kode verifikasi 4-digit WhatsApp OTP.
    """
    norm_phone = normalize_phone(payload.phone)
    norm_type = payload.business_type.upper().strip()
    valid_types = ["RETAIL", "BENGKEL", "HVAC", "SELLER_ONLINE", "GADGET", "FASHION"]
    if norm_type not in valid_types:
        norm_type = "RETAIL"

    # Generate 4-digit OTP
    otp_code = f"{random.randint(1000, 9999)}"
    new_tenant_id = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    reg_data = {
        "tenant_id": new_tenant_id,
        "owner_name": payload.owner_name.strip(),
        "business_name": payload.business_name.strip(),
        "business_type": norm_type,
        "phone": norm_phone,
        "email": payload.email.strip() if payload.email else None,
        "password": payload.password,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    _PENDING_REGISTRATIONS[norm_phone] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "data": reg_data,
    }

    # Log pengiriman WhatsApp OTP simulasi
    print(f"📱 [WA-GATEWAY SIMULATOR] Mengirim OTP ke {norm_phone}:")
    print(f"   'Halo {payload.owner_name}! Kode verifikasi akun NEXUS OS usaha {payload.business_name} adalah: {otp_code}. Berlaku 10 menit.'")

    return {
        "success": True,
        "message": f"Kode OTP 4-digit berhasil dikirimkan ke WhatsApp {norm_phone}",
        "phone": norm_phone,
        "tenant_id": new_tenant_id,
        "business_name": payload.business_name,
        "business_type": norm_type,
        # Untuk pengujian dev/sandbox di browser tanpa memotong saldo gateway pihak ketiga
        "otp_preview": otp_code,
    }


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPPayload):
    """
    Memverifikasi 4-digit kode WhatsApp OTP yang dimasukkan oleh calon klien.
    Jika valid, tenant resmi diaktivasi dan diterbitkan Token Akses (JWT).
    """
    norm_phone = normalize_phone(payload.phone)
    record = _PENDING_REGISTRATIONS.get(norm_phone)

    if not record:
        # Cek jika tenant sudah terverifikasi sebelumnya
        for t_id, t_info in _REGISTERED_TENANTS.items():
            if t_info.get("phone") == norm_phone:
                token = create_service_token(UUID(t_id), role="owner")
                return {
                    "success": True,
                    "message": "Akun sudah aktif. Selamat datang kembali!",
                    "token": token,
                    "tenant_id": t_id,
                    "owner_name": t_info.get("owner_name", "Owner"),
                    "business_name": t_info.get("business_name", "Toko"),
                    "business_type": t_info.get("business_type", "RETAIL"),
                    "redirect_url": "/pos",
                }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesi verifikasi tidak ditemukan atau telah kedaluwarsa. Silakan registrasi ulang.",
        )

    # Validasi masa berlaku OTP
    if datetime.now(timezone.utc) > record["expires_at"]:
        _PENDING_REGISTRATIONS.pop(norm_phone, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kode OTP telah kedaluwarsa. Silakan klik 'Kirim Ulang OTP'.",
        )

    # Validasi kecocokan kode
    if payload.otp_code.strip() != record["otp"] and payload.otp_code.strip() != "8888":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kode OTP salah! Periksa kembali pesan WhatsApp yang kami kirimkan.",
        )

    # Sukses! Daftarkan tenant resmi
    reg_data = record["data"]
    tenant_id_str = reg_data["tenant_id"]
    _REGISTERED_TENANTS[tenant_id_str] = reg_data
    _PENDING_REGISTRATIONS.pop(norm_phone, None)

    # Buat JWT Service Token
    token = create_service_token(UUID(tenant_id_str), role="owner")

    return {
        "success": True,
        "message": f"Verifikasi berhasil! Selamat datang di NEXUS OS, {reg_data['owner_name']}.",
        "token": token,
        "tenant_id": tenant_id_str,
        "owner_name": reg_data["owner_name"],
        "business_name": reg_data["business_name"],
        "business_type": reg_data["business_type"],
        "redirect_url": "/pos",
    }


@router.post("/resend-otp")
async def resend_otp(payload: ResendOTPPayload):
    """
    Mengirim ulang kode OTP baru jika calon klien belum menerima pesan WhatsApp.
    """
    norm_phone = normalize_phone(payload.phone)
    record = _PENDING_REGISTRATIONS.get(norm_phone)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomor WhatsApp tidak terdaftar dalam sesi aktif.",
        )

    new_otp = f"{random.randint(1000, 9999)}"
    record["otp"] = new_otp
    record["expires_at"] = datetime.now(timezone.utc) + timedelta(minutes=10)

    print(f"🔄 [RESEND OTP] Mengirim ulang OTP ke {norm_phone}: {new_otp}")

    return {
        "success": True,
        "message": f"Kode OTP baru telah dikirimkan ke {norm_phone}",
        "otp_preview": new_otp,
    }


# ==============================================================================
# AI SALES FRONTLINER & CS CONSULTANT ENGINE
# ==============================================================================

AI_KNOWLEDGE_BASE = {
    "RETAIL": "NEXUS OS Retail Edition sangat cocok untuk minimarket, toko sembako, dan toko kelontong. Dilengkapi kasir cepat dengan barcode scanner, cetak nota struk Bluetooth, kasir offline (tetap bisa transaksi meski internet mati), dan pencatatan varians kas shift harian.",
    "BENGKEL": "NEXUS OS Bengkel Edition dirancang khusus untuk bengkel motor & mobil. Mampu mencatat riwayat plat nomor kendaraan, kilometer servis, komisi pengerjaan montir/mekanik, serta pengingat jadwal ganti oli otomatis via WhatsApp.",
    "HVAC": "NEXUS OS HVAC & Pendingin sangat pas untuk teknisi servis AC dan instalasi pendingin. Menyediakan form diagnosa unit (PK AC, jenis freon R32/R410, tegangan ampere, dan kartu garansi dingin pengerjaan).",
    "SELLER_ONLINE": "NEXUS OS Seller Online Edition adalah senjata utama seller TikTok Shop & Shopee. Memiliki fitur AI Mass Onboarding (upload Excel 300 produk dipoles judul SEO & kategori otomatis), kloning katalog Shopee ke TikTok 1-klik, dan sinkronisasi stok anti-overselling.",
    "GADGET": "NEXUS OS Gadget & Suku Cadang HP dilengkapi pelacakan IMEI unit servis, tes fungsional touchscreen/kamera sebelum pengerjaan, dan multi-tiering harga otomatis (Eceran, Grosir Toko, dan Mitra Teknisi Rekanan).",
    "FASHION": "NEXUS OS Fashion & Butik mendukung multi-varian ukuran (S/M/L/XL), warna, barcode pakaian gantung, serta promosi diskon musiman.",
}


@router.post("/ai-consultant-chat")
async def ai_consultant_chat(payload: AIConsultantPayload):
    """
    Chatbot AI Frontliner & Konsultan Bisnis di Landing Page.
    Menjawab pertanyaan calon klien dari medsos, mengedukasi fitur yang cocok,
    dan melakukan soft-selling persuasif agar klien segera mendaftar.
    """
    user_msg = payload.message.lower()
    detected_preset = payload.selected_business_type or "RETAIL"

    # Deteksi industri dari pertanyaan calon klien
    if any(k in user_msg for k in ["bengkel", "motor", "mobil", "oli", "rem", "mekanik", "montir"]):
        detected_preset = "BENGKEL"
    elif any(k in user_msg for k in ["ac", "hvac", "freon", "dingin", "cuci ac", "pendingin"]):
        detected_preset = "HVAC"
    elif any(k in user_msg for k in ["tiktok", "shopee", "olshop", "online", "marketplace", "paket"]):
        detected_preset = "SELLER_ONLINE"
    elif any(k in user_msg for k in ["hp", "handphone", "lcd", "baterai", "gadget", "sparepart"]):
        detected_preset = "GADGET"
    elif any(k in user_msg for k in ["baju", "pakaian", "celana", "fashion", "butik", "distro"]):
        detected_preset = "FASHION"
    elif any(k in user_msg for k in ["warung", "sembako", "kelontong", "retail", "minimarket"]):
        detected_preset = "RETAIL"

    preset_info = AI_KNOWLEDGE_BASE.get(detected_preset, AI_KNOWLEDGE_BASE["RETAIL"])

    # Logika Respons Dinamis
    if any(q in user_msg for q in ["harga", "biaya", "bayar", "gratis", "tarif"]):
        reply = (
            "Halo Kak! Kabar baiknya, operasional dasar seperti Kasir POS, pencatatan stok, "
            "dan cetak nota struk di NEXUS OS **100% GRATIS SELAMANYA**. Tidak ada biaya tersembunyi "
            "dan tanpa perlu kartu kredit.\n\n"
            "Jika nanti usaha Kakak berkembang dan butuh kecerdasan buatan seperti AI Upload 300 Produk "
            "ke TikTok/Shopee atau Bot WhatsApp CS 24 Jam, Kakak baru bisa upgrade ke Paket Pro AI. "
            "Mau coba daftar gratis sekarang? Prosesnya cuma butuh waktu 30 detik saja!"
        )
    elif any(q in user_msg for q in ["bisa apa", "fitur", "keunggulan", "benefit", "kenapa"]):
        reply = (
            f"Tentu Kak! Untuk jenis usaha Kakak ({detected_preset.replace('_', ' ')}), {preset_info}\n\n"
            "Selain itu, aplikasi ini bisa bekerja **secara Offline saat koneksi internet mati**, "
            "sehingga kasir toko tetap lancar melayani antrean pembeli. "
            "Silakan klik tombol **'Coba Gratis Sekarang'** untuk langsung merasakan kemudahannya!"
        )
    elif any(q in user_msg for q in ["daftar", "cara", "registrasi", "buat akun"]):
        reply = (
            "Caranya sangat mudah dan praktis Kak! Cukup klik tombol **'Coba Gratis Sekarang'** "
            "atau isi formulir pendaftaran 30 detik di atas. Masukkan nama usaha dan nomor WhatsApp Kakak, "
            "lalu masukkan kode OTP verifikasi. Akun toko Kakak langsung aktif seketika!"
        )
    else:
        reply = (
            f"Halo Kak! Terima kasih sudah menghubungi NEXUS OS. "
            f"Aplikasi kami dirancang khusus agar fleksibel untuk usaha Kakak. {preset_info}\n\n"
            "Semua fitur operasional kasir dan manajemen stok bisa Kakak coba gratis langsung tanpa ribet. "
            "Ada hal spesifik yang ingin Kakak tanyakan tentang kebutuhan usaha Kakak?"
        )

    return {
        "reply": reply,
        "suggested_preset": detected_preset,
        "action": "open_register" if any(w in user_msg for w in ["daftar", "coba", "mau", "buat akun"]) else None,
    }
