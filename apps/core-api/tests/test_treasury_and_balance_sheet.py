"""
NEXUS CORE OS - TREASURY, OPEX & BALANCE SHEET TEST SUITE
File: apps/core-api/tests/test_treasury_and_balance_sheet.py

Menguji seeding sub-akun bank operasional (1001, 1010, 1020),
skema beban operasional (OPEX), pelunasan hutang supplier (AP),
serta perhitungan Neraca Keuangan (Balance Sheet).
"""

from uuid import uuid4
from datetime import date
import pytest

from app.services.journal_service import DEFAULT_COA_ACCOUNTS
from app.schemas.repair import (
    ExpenseCreate,
    PaySupplierCreate,
    BankBalancesResponse,
    BalanceSheetResponse,
    ProfitLossSummaryResponse
)
from app.api.v1.accounting import router as accounting_router

def test_default_coa_accounts_has_treasury_and_opex():
    """Memastikan bagan akun standar menyertakan sub-akun bank dan beban operasional."""
    codes = {acc["code"]: acc for acc in DEFAULT_COA_ACCOUNTS}

    # Kas & Bank Operasional
    assert "1001" in codes
    assert codes["1001"]["name"] == "Kas Fisik Kasir"
    assert codes["1001"]["type"] == "Asset"

    assert "1010" in codes
    assert "BCA" in codes["1010"]["name"]
    assert codes["1010"]["type"] == "Asset"

    assert "1020" in codes
    assert "Mandiri" in codes["1020"]["name"]
    assert codes["1020"]["type"] == "Asset"

    assert "1040" in codes
    assert codes["1040"]["name"] == "Saldo QRIS / Settlement Marketplace"

    # Beban Operasional (OPEX)
    assert "6000" in codes
    assert codes["6000"]["type"] == "Expense"
    assert "6100" in codes  # Sewa
    assert "6200" in codes  # Listrik
    assert "6300" in codes  # Gaji
    assert "6400" in codes  # Packing & Operasional

def test_expense_schema_validation():
    """Menguji validasi payload pencatatan beban operasional."""
    exp = ExpenseCreate(
        expense_name="Listrik Toko Oktober",
        amount=350000,
        expense_account_id=uuid4(),
        source_account_id=uuid4(),
        transaction_date=date.today(),
        notes="Token PLN"
    )
    assert exp.amount == 350000
    assert exp.expense_name == "Listrik Toko Oktober"

def test_pay_supplier_schema_validation():
    """Menguji validasi payload pelunasan hutang supplier."""
    pay = PaySupplierCreate(
        supplier_name="PT Sinar Sparepart",
        amount=1250000,
        source_account_id=uuid4(),
        grn_ref="GRN-001"
    )
    assert pay.amount == 1250000
    assert pay.supplier_name == "PT Sinar Sparepart"

def test_accounting_router_has_all_required_endpoints():
    """Memverifikasi bahwa router accounting memiliki semua endpoint treasury & neraca."""
    routes = {r.path: r.methods for r in accounting_router.routes}
    
    assert "/accounting/bank-balances" in routes
    assert "GET" in routes["/accounting/bank-balances"]

    assert "/accounting/expenses" in routes
    assert "POST" in routes["/accounting/expenses"]

    assert "/accounting/pay-supplier" in routes
    assert "POST" in routes["/accounting/pay-supplier"]

    assert "/accounting/profit-loss-summary" in routes
    assert "GET" in routes["/accounting/profit-loss-summary"]

    assert "/accounting/balance-sheet" in routes
    assert "GET" in routes["/accounting/balance-sheet"]
