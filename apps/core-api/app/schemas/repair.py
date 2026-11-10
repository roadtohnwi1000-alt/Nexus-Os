"""
NEXUS CORE OS - HP RETAIL, REPAIR, & ACCOUNTING SCHEMAS
File: apps/core-api/app/schemas/repair.py

Mendefinisikan skema Pydantic untuk tiket servis HP, pemakaian sparepart,
Bagan Akun (Chart of Accounts), dan Jurnal Akuntansi Double-Entry.

🧠 ATURAN EMAS:
1. UANG & HARGA: WAJIB int (minor units / rupiah penuh), DILARANG float/decimal.
2. VALIDASI SIKLUS SERVIS: Status tiket terkontrol secara ketat melalui enum.
3. BALANCED DOUBLE-ENTRY: Total debit wajib sama dengan total kredit.
"""

from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

# ==============================================================================
# ENUM SIKLUS HIDUP TIKET SERVIS HP
# ==============================================================================

class RepairStatus(str, Enum):
    INTAKE = "Intake"
    DIAGNOSIS = "Diagnosis"
    WAITING_APPROVAL = "Waiting Approval"
    REPAIRING = "Repairing"
    QC = "QC"
    DONE = "Done"
    TAKEN = "Taken"

class AccountType(str, Enum):
    ASSET = "Asset"
    LIABILITY = "Liability"
    EQUITY = "Equity"
    REVENUE = "Revenue"
    COGS = "COGS"
    EXPENSE = "Expense"

# ==============================================================================
# SCHEMAS: REPAIR TICKETS
# ==============================================================================

class RepairTicketCreate(BaseModel):
    """Payload pembuatan tiket servis HP baru di meja intake/kasir."""
    device_model: str = Field(
        ..., 
        min_length=1, 
        max_length=255, 
        description="Model/tipe perangkat", 
        json_schema_extra={"example": "iPhone 11 64GB Black"}
    )
    device_imei: Optional[str] = Field(
        None, 
        max_length=100, 
        description="Nomor IMEI atau Serial Number perangkat", 
        json_schema_extra={"example": "358742091234567"}
    )
    complaint: str = Field(
        ..., 
        min_length=1, 
        description="Keluhan kerusakan dari pelanggan", 
        json_schema_extra={"example": "Layar retak & touch tidak merespon sebagian"}
    )
    customer_id: Optional[UUID] = Field(
        None, 
        description="ID kontak pelanggan dari tabel contacts", 
        json_schema_extra={"example": "11111111-1111-1111-1111-111111111111"}
    )
    estimated_cost: Optional[int] = Field(
        0, 
        ge=0, 
        description="Estimasi biaya servis dalam minor units (Rp)", 
        json_schema_extra={"example": 650000}
    )
    device_password_pattern: Optional[str] = Field(
        None, 
        description="PIN atau pola kunci layar untuk pengujian QC teknisi", 
        json_schema_extra={"example": "Pola L atau PIN: 123456"}
    )
    assigned_technician_id: Optional[UUID] = Field(
        None, 
        description="ID teknisi yang ditugaskan", 
        json_schema_extra={"example": "22222222-2222-2222-2222-222222222222"}
    )

class RepairTicketUpdate(BaseModel):
    """Payload pembaruan status pengerjaan dan biaya akhir servis."""
    status: RepairStatus = Field(
        ..., 
        description="Status tahapan reparasi baru", 
        json_schema_extra={"example": "Repairing"}
    )
    final_cost: Optional[int] = Field(
        None, 
        ge=0, 
        description="Biaya akhir servis dalam minor units (Rp)", 
        json_schema_extra={"example": 750000}
    )
    assigned_technician_id: Optional[UUID] = Field(
        None, 
        description="ID teknisi penanggung jawab baru"
    )

# ==============================================================================
# SCHEMAS: REPAIR TICKET PARTS
# ==============================================================================

class RepairPartAdd(BaseModel):
    """Payload penambahan sparepart yang dipakai untuk servis HP."""
    item_id: UUID = Field(
        ..., 
        description="ID item sparepart dari katalog universal items"
    )
    qty: int = Field(
        ..., 
        gt=0, 
        description="Jumlah fisik sparepart yang digunakan", 
        json_schema_extra={"example": 1}
    )
    hpp_at_use: int = Field(
        ..., 
        ge=0, 
        description="Harga Pokok Penjualan (HPP) satuan saat dipakai dalam minor units (Rp)", 
        json_schema_extra={"example": 420000}
    )

class RepairPartResponse(BaseModel):
    id: UUID
    repair_ticket_id: UUID
    item_id: UUID
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    qty: int
    hpp_at_use: int
    created_at: Optional[datetime] = None

class RepairTicketResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    device_imei: Optional[str] = None
    device_model: str
    device_password_pattern: Optional[str] = None
    complaint: str
    status: str
    assigned_technician_id: Optional[UUID] = None
    estimated_cost: Optional[int] = 0
    final_cost: Optional[int] = None
    parts: List[RepairPartResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ==============================================================================
# SCHEMAS: CHART OF ACCOUNTS (COA)
# ==============================================================================

class AccountResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    code: str
    name: str
    type: str
    parent_id: Optional[UUID] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# ==============================================================================
# SCHEMAS: GENERAL LEDGER & DOUBLE-ENTRY JOURNALS
# ==============================================================================

class JournalLineCreate(BaseModel):
    account_id: UUID = Field(..., description="ID akun dari chart_of_accounts")
    debit: int = Field(default=0, ge=0, description="Nominal debit dalam minor units (Rp)")
    credit: int = Field(default=0, ge=0, description="Nominal kredit dalam minor units (Rp)")

    @field_validator("credit")
    @classmethod
    def validate_debit_or_credit(cls, credit_val: int, info):
        debit_val = info.data.get("debit", 0)
        if debit_val == 0 and credit_val == 0:
            raise ValueError("Baris jurnal harus memiliki nilai debit atau kredit > 0")
        if debit_val > 0 and credit_val > 0:
            raise ValueError("Baris jurnal tidak boleh mengisi debit dan kredit sekaligus pada satu baris")
        return credit_val

class JournalLineResponse(BaseModel):
    id: UUID
    account_id: UUID
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit: int
    credit: int
    created_at: Optional[datetime] = None

class JournalEntryCreate(BaseModel):
    """
    Payload pembuatan jurnal manual double-entry.
    Total seluruh debit WAJIB sama persis dengan total seluruh kredit.
    """
    transaction_date: Optional[date] = Field(
        None, 
        description="Tanggal transaksi (default hari ini)", 
        json_schema_extra={"example": "2026-10-29"}
    )
    description: Optional[str] = Field(
        None, 
        description="Uraian atau memo transaksi akuntansi", 
        json_schema_extra={"example": "Penerimaan kas pendapatan servis iPhone 11"}
    )
    reference_type: Optional[str] = Field(
        None, 
        description="Tipe referensi transaksi ('POS_SALE', 'REPAIR', 'PURCHASE', 'MANUAL', 'ADJUSTMENT')", 
        json_schema_extra={"example": "REPAIR"}
    )
    reference_id: Optional[UUID] = Field(
        None, 
        description="ID transaksi referensi (misal: ID repair_ticket)"
    )
    lines: List[JournalLineCreate] = Field(
        ..., 
        min_length=2, 
        description="Daftar ayat jurnal berpasangan (minimal 2 baris)"
    )

class JournalEntryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    transaction_date: date
    description: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    lines: List[JournalLineResponse] = []
    created_at: Optional[datetime] = None

class ExpenseBreakdownItem(BaseModel):
    account_id: UUID
    code: str
    name: str
    amount: int

class ProfitLossSummaryResponse(BaseModel):
    total_revenue: int = Field(..., description="Total pendapatan dalam minor units (Rp)")
    total_cogs: int = Field(..., description="Total HPP dalam minor units (Rp)")
    gross_profit: int = Field(..., description="Laba kotor (total_revenue - total_cogs)")
    total_opex: int = Field(0, description="Total beban operasional (OPEX) dalam minor units (Rp)")
    net_profit: int = Field(0, description="Laba bersih (gross_profit - total_opex)")
    opex_breakdown: List[ExpenseBreakdownItem] = Field(default_factory=list, description="Rincian beban operasional")
    period: Optional[str] = Field(None, description="Periode bulan laporan (YYYY-MM atau All Time)")

# ==============================================================================
# SCHEMAS: TREASURY, OPEX & BALANCE SHEET
# ==============================================================================

class ExpenseCreate(BaseModel):
    expense_name: str = Field(..., min_length=2, description="Nama beban/keterangan pengeluaran (misal: Biaya Listrik Toko)")
    amount: int = Field(..., gt=0, description="Nominal beban dalam minor units (Rp)")
    expense_account_id: UUID = Field(..., description="ID Akun Beban (COA kepala 6000)")
    source_account_id: UUID = Field(..., description="ID Akun Kas/Bank sumber pengeluaran dana (COA 10xx)")
    transaction_date: Optional[date] = Field(None, description="Tanggal transaksi beban (default hari ini)")
    notes: Optional[str] = Field(None, description="Catatan atau nomor nota pengeluaran")

class PaySupplierCreate(BaseModel):
    supplier_name: Optional[str] = Field(None, description="Nama supplier atau pihak penerima")
    supplier_id: Optional[UUID] = None
    grn_ref: Optional[str] = Field(None, description="Nomor nota/referensi GRN pembelian")
    amount: int = Field(..., gt=0, description="Nominal pelunasan hutang dalam minor units (Rp)")
    source_account_id: UUID = Field(..., description="ID Akun Kas/Bank sumber pembayaran (COA 10xx)")
    liability_account_id: Optional[UUID] = Field(None, description="ID Akun Hutang Usaha (opsional, default: akun 2000)")
    transaction_date: Optional[date] = Field(None, description="Tanggal pembayaran hutang (default hari ini)")
    notes: Optional[str] = Field(None, description="Catatan bukti transfer atau kwitansi pelunasan")

class BankBalanceItem(BaseModel):
    id: UUID
    code: str
    name: str
    balance: int
    total_debit: int
    total_credit: int

class BankBalancesResponse(BaseModel):
    tenant_id: UUID
    accounts: List[BankBalanceItem] = []
    total_liquid_balance: int

class BalanceSheetItem(BaseModel):
    code: str
    name: str
    amount: int

class BalanceSheetSection(BaseModel):
    items: List[BalanceSheetItem] = []
    subtotal: int = 0

class BalanceSheetResponse(BaseModel):
    as_of_date: date
    period_label: str
    total_assets: int
    total_liabilities: int
    total_equity: int
    is_balanced: bool
    assets: BalanceSheetSection
    liabilities: BalanceSheetSection
    equity: BalanceSheetSection

