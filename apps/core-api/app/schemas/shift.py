"""
NEXUS CORE OS - CASHIER SHIFT SCHEMAS
File: apps/core-api/app/schemas/shift.py
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

class ShiftOpenPayload(BaseModel):
    cashier_id: str = Field(..., description="ID kasir yang bertugas")
    cashier_name: str = Field(..., description="Nama kasir yang bertugas")
    opening_cash: int = Field(..., ge=0, description="Modal kas awal di laci kasir (Rupiah/minor units)")
    notes: Optional[str] = Field(None, description="Catatan pembukaan shift")

class ShiftClosePayload(BaseModel):
    shift_id: Optional[UUID] = Field(None, description="ID shift yang akan ditutup (opsional, default: shift aktif)")
    closing_cash: int = Field(..., ge=0, description="Total uang fisik di laci kasir saat tutup shift (Blind Balancing)")
    notes: Optional[str] = Field(None, description="Catatan penutupan shift atau alasan selisih")

class ShiftResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    cashier_id: str
    cashier_name: str
    status: str
    opening_cash: int
    closing_cash: Optional[int] = None
    cash_sales: Optional[int] = 0
    expected_cash: Optional[int] = None
    variance: Optional[int] = None
    notes: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None

class CurrentShiftResponse(BaseModel):
    active_shift: Optional[ShiftResponse] = None
