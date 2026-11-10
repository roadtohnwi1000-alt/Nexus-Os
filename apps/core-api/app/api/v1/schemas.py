from typing import Dict, Any, Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

# =============================================================================
# SCHEMAS: ITEMS (UNIVERSAL CATALOG)
# =============================================================================

class ItemCreate(BaseModel):
    """
    Schema untuk pembuatan item katalog baru (bisa berupa barang stok, jasa, atau digital).
    
    🧠 CATATAN ARSITEKTUR:
    1. base_price WAJIB bertipe int (minor units), DILARANG float/decimal.
    2. attributes bertipe dict yang dipetakan langsung ke kolom JSONB PostgreSQL.
    """
    name: str = Field(..., min_length=1, max_length=255, json_schema_extra={"example": "Pijat Refleksi 60 Menit"})
    sku: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "SRV-SPA-001"})
    item_type: str = Field(
        ...,
        pattern="^(stocked|service|digital)$",
        description="Tipe item: stocked (barang fisik), service (jasa), digital (produk digital)",
        json_schema_extra={"example": "service"}
    )
    # Aturan Besar #1: Uang WAJIB int minor units (Rp 150.000 = 150000)
    base_price: int = Field(..., ge=0, description="Harga dasar dalam minor units", json_schema_extra={"example": 150000})
    price_retail: Optional[int] = Field(None, ge=0, description="Harga konsumen eceran (retail)")
    price_reseller: Optional[int] = Field(None, ge=0, description="Harga grosir toko mitra (reseller)")
    price_technician: Optional[int] = Field(None, ge=0, description="Harga khusus teknisi HP")
    marketplace_sku: Optional[str] = Field(None, max_length=100, description="SKU listing di marketplace / TikTok Shop", json_schema_extra={"example": "TTS-IP11-SCR"})
    # Aturan Besar #2: JSONB untuk atribut deskriptif dinamis
    attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Atribut dinamis industri (misal: durasi, bahan, spesifikasi)",
        json_schema_extra={"example": {"durasi_menit": 60, "terapis": "Ani"}}
    )
    # Opsional untuk pengujian cross-tenant
    tenant_id: Optional[UUID] = Field(None, description="Override tenant_id untuk testing keamanan")

class ItemResponse(BaseModel):
    """
    Schema respon representasi item katalog dengan dukungan Multi-Tier Harga.
    """
    id: UUID
    name: str
    base_price: int
    price_retail: Optional[int] = None
    price_reseller: Optional[int] = None
    price_technician: Optional[int] = None
    marketplace_sku: Optional[str] = None
    attributes: Dict[str, Any]
    sku: Optional[str] = None
    item_type: Optional[str] = None
    active: Optional[bool] = True

# =============================================================================
# SCHEMAS: CONTACTS (UNIVERSAL CRM)
# =============================================================================

class ContactCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255, json_schema_extra={"example": "PT Maju Bersama"})
    kind: str = Field(
        ...,
        pattern="^(person|org)$",
        description="Jenis kontak: person (individu) atau org (perusahaan)",
        json_schema_extra={"example": "org"}
    )
    attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata kontak fleksibel (npwp, plafon_kredit, alergi)",
        json_schema_extra={"example": {"npwp": "01.234.567.8-901.000", "plafon_kredit": 50000000}}
    )

class ContactResponse(BaseModel):
    id: UUID
    display_name: str
    kind: str
    attributes: Dict[str, Any]

# =============================================================================
# SCHEMAS: ORDERS & STOCK LEDGER
# =============================================================================

class OrderItemCreate(BaseModel):
    item_id: UUID
    qty: int = Field(..., gt=0, description="Kuantitas pesanan (harus > 0)", json_schema_extra={"example": 10})

class PaymentInput(BaseModel):
    """
    Representasi satu metode pembayaran dalam transaksi split payment POS.
    """
    payment_method: str = Field(
        ...,
        pattern="^(CASH|QRIS|TRANSFER)$",
        description="Metode pembayaran: 'CASH', 'QRIS', atau 'TRANSFER'",
        json_schema_extra={"example": "CASH"}
    )
    amount: int = Field(
        ...,
        gt=0,
        description="Nominal pembayaran dalam minor units (Rp)",
        json_schema_extra={"example": 350000}
    )

class OrderCreate(BaseModel):
    """
    Payload pembuatan order transaksi.
    Menerima contact_id opsional, daftar item pesanan, idempotency_key, dan daftar split payments.
    """
    contact_id: Optional[UUID] = Field(None, json_schema_extra={"example": "00000000-0000-0000-0000-000000000001"})
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Daftar item yang dipesan")
    idempotency_key: Optional[str] = Field(None, max_length=255, json_schema_extra={"example": "idem-key-9988"})
    pricing_tier: Optional[str] = Field("retail", description="Tier harga: 'retail', 'reseller', atau 'technician'")
    payments: Optional[List[PaymentInput]] = Field(None, description="Daftar split payments (CASH, QRIS, TRANSFER)")

class OrderLineResponse(BaseModel):
    id: UUID
    item_id: UUID
    sku_snapshot: str
    name_snapshot: str
    qty: int
    unit_price_minor: int
    line_total_minor: Optional[int] = 0

class OrderResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    contact_id: Optional[UUID] = None
    status: str
    total_minor: int
    subtotal_minor: Optional[int] = 0
    tax_minor: Optional[int] = 0
    idempotency_key: Optional[str] = None
    items: List[OrderLineResponse] = Field(default_factory=list)
    payments: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
