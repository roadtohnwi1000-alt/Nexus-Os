"""
NEXUS CORE OS - AUTO-ACCOUNTING TEST SUITE
File: apps/core-api/tests/test_auto_accounting.py

Menguji validasi keseimbangan debit == kredit dan integritas journal_service.
"""

from uuid import uuid4
from datetime import date
import pytest

from app.services.journal_service import create_auto_journal

@pytest.mark.asyncio
async def test_create_auto_journal_unbalanced_rejection():
    """Menguji bahwa create_auto_journal wajib menolak jika debit != credit."""
    acc1 = uuid4()
    acc2 = uuid4()

    # Total debit 750000, Total credit 500000 (tidak seimbang)
    unbalanced_lines = [
        {"account_id": acc1, "debit": 750000, "credit": 0},
        {"account_id": acc2, "debit": 0, "credit": 500000},
    ]

    class DummyAsyncSession:
        async def rollback(self):
            pass

    with pytest.raises(ValueError) as excinfo:
        await create_auto_journal(
            tenant_id=uuid4(),
            transaction_date=date.today(),
            description="Test Unbalanced",
            reference_type="REPAIR",
            reference_id=uuid4(),
            lines=unbalanced_lines,
            db=DummyAsyncSession()
        )
    assert "tidak seimbang" in str(excinfo.value).lower()

@pytest.mark.asyncio
async def test_create_auto_journal_min_lines_rejection():
    """Menguji bahwa jurnal minimal memerlukan 2 baris transaksi."""
    class DummyAsyncSession:
        async def rollback(self):
            pass

    with pytest.raises(ValueError) as excinfo:
        await create_auto_journal(
            tenant_id=uuid4(),
            transaction_date=date.today(),
            description="Test Single Line",
            reference_type="REPAIR",
            reference_id=uuid4(),
            lines=[{"account_id": uuid4(), "debit": 100000, "credit": 0}],
            db=DummyAsyncSession()
        )
    assert "minimal memerlukan 2 baris" in str(excinfo.value).lower()
