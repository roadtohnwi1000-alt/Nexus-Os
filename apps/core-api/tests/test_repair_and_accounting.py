"""
NEXUS CORE OS - REPAIR & ACCOUNTING TEST SUITE
File: apps/core-api/tests/test_repair_and_accounting.py

Menguji skema Pydantic dan validasi business logic untuk tiket servis HP dan jurnal akuntansi.
"""

from uuid import uuid4
from datetime import date
import pytest
from pydantic import ValidationError

from app.schemas.repair import (
    RepairTicketCreate,
    RepairTicketUpdate,
    RepairPartAdd,
    RepairStatus,
    JournalEntryCreate,
    JournalLineCreate
)

def test_repair_ticket_create_schema():
    """Menguji schema pembuatan tiket servis baru."""
    valid_payload = {
        "device_model": "iPhone 11 64GB Black",
        "device_imei": "358742091234567",
        "complaint": "Layar retak & touch mati sebagian",
        "customer_id": str(uuid4()),
        "estimated_cost": 650000,
        "device_password_pattern": "PIN: 123456"
    }
    ticket = RepairTicketCreate(**valid_payload)
    assert ticket.device_model == "iPhone 11 64GB Black"
    assert ticket.estimated_cost == 650000
    assert isinstance(ticket.estimated_cost, int)

def test_repair_ticket_update_status_enum():
    """Menguji enum status tiket servis."""
    update = RepairTicketUpdate(status=RepairStatus.REPAIRING, final_cost=750000)
    assert update.status == RepairStatus.REPAIRING
    assert update.final_cost == 750000

    # Status tidak valid harus gagal validasi
    with pytest.raises(ValidationError):
        RepairTicketUpdate(status="InvalidStatus")

def test_repair_part_add_schema():
    """Menguji penambahan sparepart servis dengan minor units integer."""
    part = RepairPartAdd(
        item_id=uuid4(),
        qty=2,
        hpp_at_use=320000
    )
    assert part.qty == 2
    assert part.hpp_at_use == 320000
    assert isinstance(part.hpp_at_use, int)

def test_journal_entry_line_validation():
    """Menguji bahwa baris jurnal harus memiliki salah satu dari debit atau kredit > 0."""
    acc_id = uuid4()
    
    # Keduanya nol -> tolak
    with pytest.raises(ValidationError):
        JournalLineCreate(account_id=acc_id, debit=0, credit=0)

    # Keduanya > 0 dalam 1 baris -> tolak
    with pytest.raises(ValidationError):
        JournalLineCreate(account_id=acc_id, debit=1000, credit=1000)

    # Valid Debit
    line_debit = JournalLineCreate(account_id=acc_id, debit=500000, credit=0)
    assert line_debit.debit == 500000

    # Valid Kredit
    line_credit = JournalLineCreate(account_id=acc_id, debit=0, credit=500000)
    assert line_credit.credit == 500000

def test_journal_entry_create_schema():
    """Menguji struktur JournalEntryCreate."""
    acc1 = uuid4()
    acc2 = uuid4()
    entry = JournalEntryCreate(
        transaction_date=date(2026, 10, 29),
        description="Penerimaan kas servis iPhone 11",
        reference_type="REPAIR",
        lines=[
            JournalLineCreate(account_id=acc1, debit=500000, credit=0),
            JournalLineCreate(account_id=acc2, debit=0, credit=500000),
        ]
    )
    assert len(entry.lines) == 2
    assert sum(l.debit for l in entry.lines) == 500000
    assert sum(l.credit for l in entry.lines) == 500000
