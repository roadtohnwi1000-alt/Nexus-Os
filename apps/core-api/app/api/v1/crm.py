"""
NEXUS CORE OS - CRM & CUSTOMER 360 RETENTION API
File: apps/core-api/app/api/v1/crm.py

Menangani manajemen data pelanggan 360 derajat (Customer Profile, Tracking Device/IMEI),
Segmentasi RFM (Champions, Loyal, At-Risk, Lost), serta Otomasi WhatsApp Lifecycle Drip.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.services.data_science import calculate_rfm_segments

router = APIRouter(prefix="/crm", tags=["CRM & Customer 360 Retention"])


# ==============================================================================
# SCHEMAS
# ==============================================================================

class CustomerDevice(BaseModel):
    brand: str
    model: str
    imei: Optional[str] = None
    last_service_date: Optional[str] = None
    warranty_until: Optional[str] = None


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, description="Nama pelanggan")
    phone: str = Field(..., min_length=8, description="Nomor WhatsApp (+62...)")
    tier: str = Field(default="retail", description="Tiering harga: retail, reseller, technician")
    address: Optional[str] = None
    notes: Optional[str] = None
    devices: Optional[List[CustomerDevice]] = Field(default_factory=list)


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    tier: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    phone: str
    tier: str
    address: Optional[str] = None
    total_spent: int = 0
    total_orders: int = 0
    last_transaction_date: Optional[str] = None
    rfm_segment: str = "Promising"
    devices: List[CustomerDevice] = []
    created_at: str


class LifecycleSequence(BaseModel):
    id: str
    title: str
    delay_label: str
    description: str
    template_preview: str
    target_event: str
    is_active: bool
    sent_count: int = 0


# In-memory store fallback untuk customer demo
_DEMO_CUSTOMERS: List[Dict[str, Any]] = [
    {
        "id": "c-001",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "name": "Budi Santoso",
        "phone": "+6281234567890",
        "tier": "technician",
        "address": "Jl. Fatmawati No. 12, Jakarta Selatan",
        "total_spent": 4850000,
        "total_orders": 8,
        "last_transaction_date": "2026-10-25",
        "rfm_segment": "Champions",
        "devices": [
            {"brand": "Apple", "model": "iPhone 11", "imei": "358920194820192", "last_service_date": "2026-10-15", "warranty_until": "2026-11-15"},
            {"brand": "Apple", "model": "MacBook Pro M1", "imei": "C02F8912P001", "last_service_date": "2026-09-10", "warranty_until": "2026-12-10"}
        ],
        "created_at": "2026-06-01T10:00:00Z"
    },
    {
        "id": "c-002",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "name": "Siti Rahmawati",
        "phone": "+6281388776655",
        "tier": "retail",
        "address": "Ruko Sentra Niaga Blok B-4, Bekasi",
        "total_spent": 1250000,
        "total_orders": 3,
        "last_transaction_date": "2026-09-02",
        "rfm_segment": "At Risk",
        "devices": [
            {"brand": "Samsung", "model": "Galaxy S21", "imei": "354112093849102", "last_service_date": "2026-09-02", "warranty_until": "2026-10-02"}
        ],
        "created_at": "2026-08-10T14:30:00Z"
    },
    {
        "id": "c-003",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "name": "Rian Kusuma (Kusuma Cell)",
        "phone": "+6287799881122",
        "tier": "reseller",
        "address": "Pasar Grosir Cililitan Lt. 2",
        "total_spent": 8450000,
        "total_orders": 14,
        "last_transaction_date": "2026-10-28",
        "rfm_segment": "Loyal Customers",
        "devices": [
            {"brand": "Xiaomi", "model": "Redmi Note 10 Pro", "imei": "864920194820190", "last_service_date": "2026-10-20", "warranty_until": "2026-11-20"}
        ],
        "created_at": "2026-05-15T09:00:00Z"
    },
    {
        "id": "c-004",
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "name": "Dewi Lestari",
        "phone": "+6281900112233",
        "tier": "retail",
        "address": "Apartemen Kalibata City",
        "total_spent": 350000,
        "total_orders": 1,
        "last_transaction_date": "2026-06-12",
        "rfm_segment": "Lost",
        "devices": [
            {"brand": "Oppo", "model": "Reno 6", "imei": "359102938491023", "last_service_date": "2026-06-12", "warranty_until": "2026-07-12"}
        ],
        "created_at": "2026-06-12T11:00:00Z"
    }
]

_LIFECYCLE_SEQUENCES: List[Dict[str, Any]] = [
    {
        "id": "seq-01",
        "title": "Instruksi Perawatan & Ketentuan Garansi",
        "delay_label": "H+1 Pasca-Servis Selesai",
        "description": "Mengirimkan panduan perawatan perangkat (misal: jangan terkena air atau ditekan keras) dan rincian masa aktif garansi.",
        "template_preview": "Halo Kak {nama}! Terima kasih telah melakukan servis {device} di outlet kami. Perangkat Kakak dilindungi garansi 30 hari hingga {garansi}. Simpan nota ini sebagai bukti klaim ya!",
        "target_event": "SERVICE_COMPLETED",
        "is_active": True,
        "sent_count": 142
    },
    {
        "id": "seq-02",
        "title": "Survei Kepuasan & Google Maps Booster",
        "delay_label": "H+3 Pasca-Pengambilan",
        "description": "Menanyakan kepuasan hasil pengerjaan. Jika bintang 5, otomatis lampirkan tautan review Google Maps.",
        "template_preview": "Halo Kak {nama}, bagaimana performa layar {device} setelah 3 hari pemakaian? Mohon berikan penilaian 1-5 bintang. Masukan Kakak sangat berharga untuk peningkatan layanan kami!",
        "target_event": "CUSTOMER_SATISFACTION",
        "is_active": True,
        "sent_count": 98
    },
    {
        "id": "seq-03",
        "title": "Evaluasi & Follow-up Garansi Habis",
        "delay_label": "H+25 (5 Hari Sebelum Garansi Habis)",
        "description": "Mengingatkan pelanggan sebelum masa garansi servis 30 hari berakhir agar sempat mengecek kendala jika ada.",
        "template_preview": "Pemberitahuan: Garansi servis {device} Kak {nama} akan berakhir dalam 5 hari lagi. Jika ada kendala layar sentuh atau baterai, silakan mampir ke outlet untuk pengecekan gratis!",
        "target_event": "WARRANTY_EXPIRING",
        "is_active": True,
        "sent_count": 65
    },
    {
        "id": "seq-04",
        "title": "Pengingat Perawatan Berkala & Diskon Khusus",
        "delay_label": "H+60 (Re-Engagement Pasien Lama)",
        "description": "Memicu pelanggan yang tidak berkunjung >60 hari (At Risk) dengan voucher potongan servis atau pembersihan internal gratis.",
        "template_preview": "Kabar baik Kak {nama}! Sudah 2 bulan sejak servis terakhir. Dapatkan voucher potongan Rp 25.000 untuk penggantian tempered glass atau ganti baterai original minggu ini!",
        "target_event": "RETENTION_OFFER",
        "is_active": True,
        "sent_count": 43
    }
]


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(
    search: Optional[str] = Query(None, description="Pencarian nama atau nomor HP"),
    tier: Optional[str] = Query(None, description="Filter tiering: retail, reseller, technician"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil daftar pelanggan lengkap dengan profil 360 derajat (Device Tracking & RFM Segment).
    """
    tenant_str = str(current_tenant_id)
    customers = [c for c in _DEMO_CUSTOMERS if c["tenant_id"] == tenant_str]

    if search:
        s_lower = search.lower().strip()
        customers = [c for c in customers if s_lower in c["name"].lower() or s_lower in c["phone"]]

    if tier and tier != "all":
        customers = [c for c in customers if c["tier"].lower() == tier.lower()]

    return [CustomerResponse(**c) for c in customers]


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menambahkan pelanggan baru beserta aset perangkat yang dimiliki (IMEI / Model HP).
    """
    tenant_str = str(current_tenant_id)
    new_id = f"c-{uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    new_cust = {
        "id": new_id,
        "tenant_id": tenant_str,
        "name": payload.name,
        "phone": payload.phone,
        "tier": payload.tier,
        "address": payload.address,
        "total_spent": 0,
        "total_orders": 0,
        "last_transaction_date": None,
        "rfm_segment": "Promising",
        "devices": [d.model_dump() for d in (payload.devices or [])],
        "created_at": now_iso
    }
    _DEMO_CUSTOMERS.insert(0, new_cust)
    return CustomerResponse(**new_cust)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Memperbarui profil pelanggan, termasuk menaikkan atau menurunkan tiering harga (retail, reseller, technician).
    """
    for c in _DEMO_CUSTOMERS:
        if c["id"] == customer_id:
            if payload.name is not None:
                c["name"] = payload.name
            if payload.phone is not None:
                c["phone"] = payload.phone
            if payload.tier is not None:
                c["tier"] = payload.tier.lower()
            if payload.address is not None:
                c["address"] = payload.address
            return CustomerResponse(**c)

    raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")


@router.get("/rfm-summary")
async def get_crm_rfm_summary(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil ringkasan segmentasi pelanggan RFM untuk CRM.
    """
    tenant_str = str(current_tenant_id)
    custs = [c for c in _DEMO_CUSTOMERS if c["tenant_id"] == tenant_str]

    champions = [c for c in custs if c["rfm_segment"] == "Champions"]
    loyal = [c for c in custs if c["rfm_segment"] == "Loyal Customers"]
    at_risk = [c for c in custs if c["rfm_segment"] == "At Risk"]
    lost = [c for c in custs if c["rfm_segment"] == "Lost"]

    total_spent = sum(c["total_spent"] for c in custs)
    avg_ltv = int(total_spent / len(custs)) if custs else 0

    return {
        "total_customers": len(custs),
        "avg_ltv": avg_ltv,
        "champions_count": len(champions),
        "loyal_count": len(loyal),
        "at_risk_count": len(at_risk),
        "lost_count": len(lost),
        "segments": {
            "Champions": len(champions),
            "Loyal": len(loyal),
            "AtRisk": len(at_risk),
            "Lost": len(lost)
        }
    }


@router.get("/lifecycle", response_model=List[LifecycleSequence])
async def get_lifecycle_sequences():
    """
    Mengambil daftar urutan pesan WhatsApp Lifecycle Automation (Drip Sequence).
    """
    return [LifecycleSequence(**seq) for seq in _LIFECYCLE_SEQUENCES]


@router.post("/lifecycle/{sequence_id}/toggle")
async def toggle_lifecycle_sequence(sequence_id: str):
    """
    Mengaktifkan / menonaktifkan saklar otomatisasi pesan WhatsApp Lifecycle.
    """
    for seq in _LIFECYCLE_SEQUENCES:
        if seq["id"] == sequence_id:
            seq["is_active"] = not seq["is_active"]
            return {"success": True, "sequence_id": sequence_id, "is_active": seq["is_active"]}

    raise HTTPException(status_code=404, detail="Sequence tidak ditemukan")
