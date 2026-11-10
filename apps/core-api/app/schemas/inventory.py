"""
NEXUS CORE OS - INVENTORY & MULTI-LOCATION SCHEMAS
File: apps/core-api/app/schemas/inventory.py

Skema Pydantic untuk multi-lokasi gudang/toko, inventaris stok, dan mutasi transfer antar cabang.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

class LocationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    type: str  # 'warehouse' | 'store'
    is_active: bool
    created_at: Optional[datetime] = None

class StockItemResponse(BaseModel):
    item_id: UUID
    sku: str
    name: str
    item_type: str
    category: Optional[str] = "Sparepart"
    base_price: int
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    on_hand: int
    reserved: int
    available: int

class MultiLocationItemStock(BaseModel):
    item_id: UUID
    sku: str
    name: str
    category: Optional[str] = "Sparepart"
    base_price: int
    total_on_hand: int
    total_available: int
    locations: List[dict] = []  # list of {location_id, location_name, on_hand, available}

class StockTransferRequest(BaseModel):
    item_id: UUID = Field(..., description="ID item yang akan ditransfer")
    from_location_id: UUID = Field(..., description="ID lokasi/gudang asal")
    to_location_id: UUID = Field(..., description="ID lokasi/toko tujuan")
    qty: int = Field(..., gt=0, description="Kuantitas yang dipindahkan (harus > 0)")
    reason: Optional[str] = Field("Transfer stok antar cabang", description="Alasan mutasi pemindahan barang")

class StockTransferResponse(BaseModel):
    success: bool
    message: str
    item_id: UUID
    item_name: str
    from_location_name: str
    to_location_name: str
    transferred_qty: int
    from_location_remaining: int
    to_location_new_stock: int

# ==============================================================================
# SCHEMAS UNTUK GRN (GOODS RECEIPT NOTE) & MOVING AVERAGE HPP
# ==============================================================================

class GRNItemPayload(BaseModel):
    item_id: UUID = Field(..., description="ID Item yang diterima dari supplier")
    qty: int = Field(..., gt=0, description="Kuantitas barang yang diterima")
    purchase_price: int = Field(..., ge=0, description="Harga beli satuan dari supplier (IDR)")

class GRNCreatePayload(BaseModel):
    supplier_id: Optional[UUID] = Field(None, description="ID kontak supplier (opsional)")
    supplier_name: Optional[str] = Field("Supplier Utama", description="Nama supplier pengirim")
    delivery_order_number: Optional[str] = Field(None, description="Nomor Surat Jalan supplier")
    location_id: Optional[UUID] = Field(None, description="Lokasi gudang penerima (default: Gudang Pusat)")
    notes: Optional[str] = Field(None, description="Catatan penerimaan barang")
    items: List[GRNItemPayload] = Field(..., min_length=1, description="Daftar item yang diterima")

class GRNItemResult(BaseModel):
    item_id: UUID
    item_name: str
    sku: str
    qty_received: int
    purchase_price: int
    subtotal: int
    old_hpp: int
    new_moving_average_hpp: int
    new_total_stock: int

class GRNResponse(BaseModel):
    success: bool
    message: str
    grn_number: str
    delivery_order_number: Optional[str] = None
    location_name: str
    total_cost: int
    items_count: int
    details: List[GRNItemResult]
    journal_created: bool

# ==============================================================================
# SCHEMAS UNTUK DEFECT & RETUR SUPPLIER (QUARANTINE FLOW)
# ==============================================================================

class ReturnToSupplierPayload(BaseModel):
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = Field("Supplier Utama", description="Nama supplier tujuan retur")
    item_id: UUID = Field(..., description="ID barang defect yang diretur")
    qty: int = Field(..., gt=0, description="Kuantitas barang yang diretur")
    return_price: Optional[int] = Field(None, description="Harga pengembalian satuan (default: base_price)")
    from_location_id: Optional[UUID] = Field(None, description="Lokasi asal barang (default: Gudang Karantina / Defect)")
    reason: str = Field("Barang Rusak / Defect Pabrik", description="Alasan retur")
    reference_no: Optional[str] = Field(None, description="Nomor nota retur atau surat jalan")

class ReturnToSupplierResponse(BaseModel):
    success: bool
    message: str
    return_number: str
    item_name: str
    qty_returned: int
    return_unit_price: int
    total_return_value: int
    remaining_quarantine_stock: int
    journal_created: bool

class QuarantineTransferPayload(BaseModel):
    item_id: UUID = Field(..., description="ID barang rusak yang akan dikarantina")
    from_location_id: UUID = Field(..., description="Lokasi toko/gudang asal barang rusak")
    qty: int = Field(..., gt=0, description="Kuantitas barang rusak")
    notes: Optional[str] = Field("Ditemukan defect saat pengecekan fisik", description="Keterangan defect")

