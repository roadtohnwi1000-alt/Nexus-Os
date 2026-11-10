"""
NEXUS CORE OS - MULTI-STAFF RBAC & FREEMIUM PAYWALL GATING API
File: apps/core-api/app/api/v1/team.py

Menangani:
1. Pendaftaran akun staf oleh Owner toko (Kasir, Teknisi, Gudang).
2. Konfigurasi hak akses granular (Sembunyikan HPP, Kunci Laba, Kunci Harga Jual).
3. Verifikasi PIN Cepat untuk ganti kasir / lock kasir di POS.
4. Status Paket Freemium (Starter vs Pro AI) dan pembatasan limit staf.
5. Permintaan Upgrade Pro AI (WhatsApp Lead Generator).
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

settings = get_settings()

router = APIRouter(prefix="/team", tags=["Team & Granular RBAC"])


# ==============================================================================
# SCHEMAS
# ==============================================================================

class StaffPermissionSchema(BaseModel):
    can_access_pos: bool = Field(default=True, description="Boleh akses kasir POS")
    can_view_cost_price: bool = Field(default=False, description="Boleh lihat harga modal supplier / HPP")
    can_view_profit_margin: bool = Field(default=False, description="Boleh lihat laba bersih & margin toko")
    can_edit_selling_price: bool = Field(default=False, description="Boleh ubah harga jual saat checkout di kasir")
    can_give_discount: bool = Field(default=False, description="Boleh beri diskon potongan di kasir")
    can_manage_inventory: bool = Field(default=False, description="Boleh kelola stok, GRN supplier, retur")
    can_access_crm: bool = Field(default=False, description="Boleh akses database & histori retur pelanggan")
    can_access_repair: bool = Field(default=False, description="Boleh akses tiket servis / perbaikan")
    can_access_settings: bool = Field(default=False, description="Boleh akses menu pengaturan toko & tim")


class StaffMemberResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    username: str
    role: str  # OWNER, CASHIER, TECHNICIAN, WAREHOUSE, CUSTOM
    phone: Optional[str] = None
    is_active: bool = True
    permissions: StaffPermissionSchema
    created_at: str


class CreateStaffPayload(BaseModel):
    name: str = Field(..., min_length=2, description="Nama lengkap staf")
    username: str = Field(..., min_length=2, description="Username untuk login")
    role: str = Field(default="CASHIER", description="Role preset: CASHIER, TECHNICIAN, WAREHOUSE, CUSTOM")
    pin_code: str = Field(..., min_length=4, max_length=6, description="PIN login cepat 4-6 digit")
    phone: Optional[str] = None
    permissions: Optional[StaffPermissionSchema] = None


class UpdateStaffPayload(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    pin_code: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[StaffPermissionSchema] = None


class VerifyPinPayload(BaseModel):
    pin_code: str = Field(..., min_length=4, max_length=6)
    staff_id: Optional[str] = None


class PlanStatusResponse(BaseModel):
    plan_tier: str  # STARTER, PRO_AI, ENTERPRISE
    plan_name: str
    max_staff_limit: int
    current_staff_count: int
    is_unlimited_staff: bool
    features: Dict[str, bool]
    upgrade_price_monthly: int


class UpgradeRequestPayload(BaseModel):
    feature_name: str = Field(..., description="Nama fitur yang ingin dibuka kuncinya")
    requested_plan: str = "PRO_AI"
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


# ==============================================================================
# IN-MEMORY STORE (Fallback & Instant Dev Mode)
# ==============================================================================

_DEFAULT_PERMISSIONS_OWNER = StaffPermissionSchema(
    can_access_pos=True,
    can_view_cost_price=True,
    can_view_profit_margin=True,
    can_edit_selling_price=True,
    can_give_discount=True,
    can_manage_inventory=True,
    can_access_crm=True,
    can_access_repair=True,
    can_access_settings=True,
)

_DEFAULT_PERMISSIONS_CASHIER = StaffPermissionSchema(
    can_access_pos=True,
    can_view_cost_price=False,
    can_view_profit_margin=False,
    can_edit_selling_price=False,
    can_give_discount=True,
    can_manage_inventory=False,
    can_access_crm=True,
    can_access_repair=False,
    can_access_settings=False,
)

# Struktur: { tenant_id: [ staff_dict, ... ] }
_STAFF_STORE: Dict[str, List[dict]] = {}

# Struktur: { tenant_id: { "plan": "STARTER", "upgraded_at": None } }
_TENANT_PLANS: Dict[str, dict] = {}


def _get_or_init_staff(tenant_id: str) -> List[dict]:
    if tenant_id not in _STAFF_STORE:
        # Buat akun Owner default dan 1 kasir contoh
        now_str = datetime.now(timezone.utc).isoformat()
        _STAFF_STORE[tenant_id] = [
            {
                "id": str(uuid4()),
                "tenant_id": tenant_id,
                "name": "Owner Toko (Anda)",
                "username": "owner",
                "role": "OWNER",
                "pin_code": "1234",
                "phone": "+628123456789",
                "is_active": True,
                "permissions": _DEFAULT_PERMISSIONS_OWNER.model_dump(),
                "created_at": now_str,
            },
            {
                "id": str(uuid4()),
                "tenant_id": tenant_id,
                "name": "Budi Santoso (Kasir)",
                "username": "kasir_budi",
                "role": "CASHIER",
                "pin_code": "0000",
                "phone": "+628987654321",
                "is_active": True,
                "permissions": _DEFAULT_PERMISSIONS_CASHIER.model_dump(),
                "created_at": now_str,
            },
        ]
    return _STAFF_STORE[tenant_id]


def _get_tenant_plan_info(tenant_id: str) -> dict:
    if tenant_id not in _TENANT_PLANS:
        _TENANT_PLANS[tenant_id] = {
            "plan_tier": "STARTER",
            "max_staff_limit": 3,
        }
    return _TENANT_PLANS[tenant_id]


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.get("/members", response_model=List[StaffMemberResponse])
async def list_staff_members(
    tenant_id: str = Query(default="default-tenant", description="ID Tenant aktif"),
):
    """
    Mengambil seluruh daftar anggota staf dan hak aksesnya untuk tenant aktif.
    """
    staff_list = _get_or_init_staff(tenant_id)
    return [
        StaffMemberResponse(
            id=s["id"],
            tenant_id=s["tenant_id"],
            name=s["name"],
            username=s["username"],
            role=s["role"],
            phone=s.get("phone"),
            is_active=s.get("is_active", True),
            permissions=StaffPermissionSchema(**s["permissions"]),
            created_at=s["created_at"],
        )
        for s in staff_list
    ]


@router.post("/members", response_model=StaffMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_staff_member(
    payload: CreateStaffPayload,
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Mendaftarkan staf baru oleh Owner dengan checklist hak akses granular.
    Memeriksa batasan kuota paket Freemium (Starter max 3 staf).
    """
    staff_list = _get_or_init_staff(tenant_id)
    plan_info = _get_tenant_plan_info(tenant_id)

    # Validasi kuota staf paket Freemium
    if plan_info["plan_tier"] == "STARTER" and len(staff_list) >= plan_info["max_staff_limit"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Batas kuota staf Paket Starter ({plan_info['max_staff_limit']} orang) telah tercapai! "
                "Silakan upgrade ke Paket Pro AI untuk menambah staf kasir tanpa batas (Unlimited)."
            ),
        )

    # Cek username duplikat dalam tenant yang sama
    if any(s["username"].lower() == payload.username.lower() for s in staff_list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{payload.username}' sudah digunakan oleh staf lain di toko ini!",
        )

    # Tentukan permission default jika tidak diisi lengkap
    if payload.permissions:
        perms = payload.permissions
    elif payload.role == "CASHIER":
        perms = _DEFAULT_PERMISSIONS_CASHIER
    elif payload.role == "TECHNICIAN":
        perms = StaffPermissionSchema(
            can_access_pos=True,
            can_access_repair=True,
            can_view_cost_price=False,
            can_view_profit_margin=False,
            can_edit_selling_price=False,
            can_give_discount=False,
            can_manage_inventory=False,
            can_access_crm=True,
            can_access_settings=False,
        )
    elif payload.role == "WAREHOUSE":
        perms = StaffPermissionSchema(
            can_access_pos=False,
            can_manage_inventory=True,
            can_view_cost_price=True,
            can_view_profit_margin=False,
            can_edit_selling_price=False,
            can_give_discount=False,
            can_access_crm=False,
            can_access_repair=False,
            can_access_settings=False,
        )
    else:
        perms = _DEFAULT_PERMISSIONS_CASHIER

    new_member = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": payload.name,
        "username": payload.username,
        "role": payload.role,
        "pin_code": payload.pin_code,
        "phone": payload.phone,
        "is_active": True,
        "permissions": perms.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    staff_list.append(new_member)

    return StaffMemberResponse(
        id=new_member["id"],
        tenant_id=new_member["tenant_id"],
        name=new_member["name"],
        username=new_member["username"],
        role=new_member["role"],
        phone=new_member["phone"],
        is_active=new_member["is_active"],
        permissions=perms,
        created_at=new_member["created_at"],
    )


@router.put("/members/{member_id}", response_model=StaffMemberResponse)
async def update_staff_member(
    member_id: str,
    payload: UpdateStaffPayload,
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Memperbarui role, status aktif, PIN, atau hak akses granular staf tertentu.
    """
    staff_list = _get_or_init_staff(tenant_id)
    target = next((s for s in staff_list if s["id"] == member_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staf tidak ditemukan")

    if payload.name is not None:
        target["name"] = payload.name
    if payload.role is not None:
        target["role"] = payload.role
    if payload.pin_code is not None:
        target["pin_code"] = payload.pin_code
    if payload.phone is not None:
        target["phone"] = payload.phone
    if payload.is_active is not None:
        target["is_active"] = payload.is_active
    if payload.permissions is not None:
        target["permissions"] = payload.permissions.model_dump()

    return StaffMemberResponse(
        id=target["id"],
        tenant_id=target["tenant_id"],
        name=target["name"],
        username=target["username"],
        role=target["role"],
        phone=target.get("phone"),
        is_active=target.get("is_active", True),
        permissions=StaffPermissionSchema(**target["permissions"]),
        created_at=target["created_at"],
    )


@router.delete("/members/{member_id}")
async def delete_staff_member(
    member_id: str,
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Menghapus anggota staf (Akun Owner tidak dapat dihapus).
    """
    staff_list = _get_or_init_staff(tenant_id)
    target_idx = next((i for i, s in enumerate(staff_list) if s["id"] == member_id), None)
    if target_idx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staf tidak ditemukan")

    if staff_list[target_idx]["role"] == "OWNER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Akun Owner utama tidak dapat dihapus dari sistem!",
        )

    deleted = staff_list.pop(target_idx)
    return {"success": True, "message": f"Staf '{deleted['name']}' berhasil dihapus."}


@router.post("/verify-pin")
async def verify_staff_pin(
    payload: VerifyPinPayload,
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Verifikasi PIN Cepat untuk otentikasi kasir saat switch shift atau lock screen di POS.
    """
    staff_list = _get_or_init_staff(tenant_id)

    matched = None
    if payload.staff_id:
        matched = next((s for s in staff_list if s["id"] == payload.staff_id and s["is_active"]), None)
        if not matched or matched["pin_code"] != payload.pin_code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN yang Anda masukkan salah!")
    else:
        # Cek jika ada staf aktif dengan PIN tersebut
        matched = next((s for s in staff_list if s["pin_code"] == payload.pin_code and s["is_active"]), None)
        if not matched:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN tidak cocok dengan staf manapun!")

    return {
        "success": True,
        "staff": {
            "id": matched["id"],
            "name": matched["name"],
            "username": matched["username"],
            "role": matched["role"],
            "permissions": matched["permissions"],
        },
    }


@router.get("/plan-status", response_model=PlanStatusResponse)
async def get_plan_status(
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Mengambil status langganan tenant (STARTER vs PRO_AI) dan status gembok fitur.
    """
    plan_info = _get_tenant_plan_info(tenant_id)
    staff_list = _get_or_init_staff(tenant_id)

    is_pro = plan_info["plan_tier"] == "PRO_AI"

    return PlanStatusResponse(
        plan_tier=plan_info["plan_tier"],
        plan_name="Nexus Pro AI" if is_pro else "Nexus Starter (Freemium)",
        max_staff_limit=999 if is_pro else plan_info["max_staff_limit"],
        current_staff_count=len(staff_list),
        is_unlimited_staff=is_pro,
        features={
            "pos": True,
            "inventory": True,
            "crm": True,
            "reports_basic": True,
            "ai_mass_onboarding": is_pro,
            "whatsapp_smartbot": is_pro,
            "csuite_advisor": is_pro,
            "ecommerce_cross_listing": is_pro,
        },
        upgrade_price_monthly=149000,
    )


@router.post("/upgrade-request")
async def request_plan_upgrade(
    payload: UpgradeRequestPayload,
    tenant_id: str = Query(default="default-tenant"),
):
    """
    Membuat permintaan upgrade ke Pro AI dan menghasilkan tautan WhatsApp instan ke sales support.
    """
    sales_phone = "6281234567890"  # WhatsApp Admin NEXUS OS
    wa_message = (
        f"Halo Tim NEXUS OS, saya ingin aktivasi paket *{payload.requested_plan}* "
        f"untuk membuka fitur *{payload.feature_name}* di toko saya (Tenant ID: {tenant_id}). "
        f"Mohon dibantu proses aktivasinya. Terima kasih!"
    )
    import urllib.parse
    encoded_msg = urllib.parse.quote(wa_message)
    wa_url = f"https://wa.me/{sales_phone}?text={encoded_msg}"

    return {
        "success": True,
        "message": "Permintaan upgrade diterima. Silakan lanjutkan chat WhatsApp dengan Tim Konsultan NEXUS OS.",
        "whatsapp_url": wa_url,
        "requested_plan": payload.requested_plan,
        "feature_name": payload.feature_name,
    }
