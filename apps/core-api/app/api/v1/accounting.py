"""
NEXUS CORE OS - ACCOUNTING & GENERAL LEDGER API ROUTER
File: apps/core-api/app/api/v1/accounting.py

Menangani pembukuan akuntansi double-entry, bagan akun (Chart of Accounts),
dan pencatatan jurnal umum manual maupun otomatis dari transaksi retail/servis.

🧠 ATURAN ARSITEKTUR EMAS:
1. TENANCY ISOLATION: Setiap query SQL WAJIB menyertakan `WHERE tenant_id = :tenant_id`.
2. INTEGER MINOR UNITS: Seluruh nominal debit dan credit bertipe `int` (minor units / rupiah penuh).
3. DOUBLE-ENTRY BALANCE: Total Debit WAJIB sama persis dengan Total Kredit (Debit == Credit).
   Jika tidak seimbang, transaksi dibatalkan (rollback atomik) dan ditolak dengan 400 Bad Request.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.services.journal_service import get_or_create_default_accounts
from app.schemas.repair import (
    AccountResponse,
    JournalEntryCreate,
    JournalEntryResponse,
    JournalLineResponse,
    ProfitLossSummaryResponse,
    ExpenseCreate,
    PaySupplierCreate,
    BankBalanceItem,
    BankBalancesResponse,
    ExpenseBreakdownItem,
    BalanceSheetResponse,
    BalanceSheetSection,
    BalanceSheetItem
)

router = APIRouter(prefix="/accounting", tags=["Accounting & General Ledger"])

# ==============================================================================
# ENDPOINT 1: MAPPING KODE AKUN STANDAR (AUTO-SEEDING)
# ==============================================================================
@router.get("/accounts/default-codes")
async def get_default_account_codes(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil mapping kode akun standar (Kas 1000, Persediaan 1200, Pendapatan 4000, HPP 5000)
    beserta ID akun untuk tenant aktif. Otomatis membuat akun dasar jika belum ada di database.
    """
    try:
        accounts_map = await get_or_create_default_accounts(current_tenant_id, db)
        return {
            "tenant_id": str(current_tenant_id),
            "accounts": accounts_map
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil kode akun standar: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 2: LIST CHART OF ACCOUNTS (COA)
# ==============================================================================
@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil seluruh daftar Bagan Akun (Chart of Accounts) milik tenant aktif,
    diurutkan berdasarkan kode akun numerik (contoh: 1000 Kas, 4000 Pendapatan).
    Jika belum ada akun sama sekali, otomatis melakukan seeding akun dasar.
    """
    try:
        query = text("""
            SELECT 
                id, tenant_id, code, name, type, parent_id, is_active,
                created_at, updated_at
            FROM public.chart_of_accounts
            WHERE tenant_id = :tenant_id
            ORDER BY code ASC
        """)
        result = await db.execute(query, {"tenant_id": str(current_tenant_id)})
        rows = result.mappings().all()

        # Otomatis inisialisasi akun dasar jika tenant baru belum memiliki akun
        if not rows:
            await get_or_create_default_accounts(current_tenant_id, db)
            result = await db.execute(query, {"tenant_id": str(current_tenant_id)})
            rows = result.mappings().all()

        return [
            AccountResponse(
                id=r["id"],
                tenant_id=r["tenant_id"],
                code=r["code"],
                name=r["name"],
                type=r["type"],
                parent_id=r["parent_id"],
                is_active=r["is_active"],
                created_at=r["created_at"],
                updated_at=r["updated_at"]
            )
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar Chart of Accounts: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 2: BUAT JURNAL MANUAL DOUBLE-ENTRY
# ==============================================================================
@router.post("/journals", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    payload: JournalEntryCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mencatat ayat jurnal transaksi umum double-entry.
    
    🧠 VALIDASI BISNIS AKUNTANSI:
    1. Minimal terdapat 2 baris jurnal (1 Debit, 1 Kredit).
    2. Total nilai Debit HARUS seimbang dan sama persis dengan Total nilai Kredit.
    3. Seluruh `account_id` wajib diverifikasi keberadaannya pada tenant aktif.
    4. Menggunakan transaksi database atomik (rollback jika salah satu baris gagal).
    """
    # 1. Validasi Jumlah Baris
    if len(payload.lines) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jurnal double-entry minimal memerlukan 2 baris transaksi (1 Debit dan 1 Kredit)."
        )

    # 2. Validasi Keseimbangan Double-Entry (Debit == Credit)
    total_debit = sum(line.debit for line in payload.lines)
    total_credit = sum(line.credit for line in payload.lines)

    if total_debit != total_credit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Jurnal tidak seimbang (Unbalanced)! Total Debit (Rp {total_debit:,}) "
                f"harus persis sama dengan Total Kredit (Rp {total_credit:,}). "
                f"Selisih: Rp {abs(total_debit - total_credit):,}."
            )
        )

    if total_debit <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total nilai transaksi jurnal harus lebih besar dari 0 (nol)."
        )

    try:
        # 3. Verifikasi Seluruh Akun yang Digunakan Berada pada Tenant Aktif
        account_ids = [str(line.account_id) for line in payload.lines]
        accounts_query = text("""
            SELECT id, code, name
            FROM public.chart_of_accounts
            WHERE id = ANY(:acc_ids) AND tenant_id = :tenant_id
        """)
        accounts_res = await db.execute(
            accounts_query,
            {"acc_ids": account_ids, "tenant_id": str(current_tenant_id)}
        )
        found_accounts = {str(a["id"]): a for a in accounts_res.mappings().all()}

        missing_accounts = [acc_id for acc_id in account_ids if acc_id not in found_accounts]
        if missing_accounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Akun COA berikut tidak valid atau tidak dimiliki oleh tenant Anda: {', '.join(missing_accounts)}"
            )

        # 4. Buat Header Jurnal (journal_entries)
        entry_id = uuid4()
        entry_date = payload.transaction_date or date.today()

        insert_entry_query = text("""
            INSERT INTO public.journal_entries (
                id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
            ) VALUES (
                :id, :tenant_id, :tx_date, :description, :ref_type, :ref_id, timezone('utc'::text, now())
            )
            RETURNING id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
        """)

        entry_res = await db.execute(
            insert_entry_query,
            {
                "id": str(entry_id),
                "tenant_id": str(current_tenant_id),
                "tx_date": entry_date,
                "description": payload.description.strip() if payload.description else None,
                "ref_type": payload.reference_type,
                "ref_id": str(payload.reference_id) if payload.reference_id else None
            }
        )
        entry_row = entry_res.mappings().one()

        # 5. Buat Baris Jurnal (journal_lines)
        lines_response: List[JournalLineResponse] = []
        insert_line_query = text("""
            INSERT INTO public.journal_lines (
                id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
            ) VALUES (
                :id, :tenant_id, :entry_id, :account_id, :debit, :credit, timezone('utc'::text, now())
            )
            RETURNING id, account_id, debit, credit, created_at
        """)

        for line in payload.lines:
            line_id = uuid4()
            line_res = await db.execute(
                insert_line_query,
                {
                    "id": str(line_id),
                    "tenant_id": str(current_tenant_id),
                    "entry_id": str(entry_id),
                    "account_id": str(line.account_id),
                    "debit": int(line.debit),
                    "credit": int(line.credit)
                }
            )
            line_row = line_res.mappings().one()
            acc_info = found_accounts[str(line.account_id)]

            lines_response.append(
                JournalLineResponse(
                    id=line_row["id"],
                    account_id=line_row["account_id"],
                    account_code=acc_info["code"],
                    account_name=acc_info["name"],
                    debit=line_row["debit"],
                    credit=line_row["credit"],
                    created_at=line_row["created_at"]
                )
            )

        # Commit atomik seluruh transaksi jurnal
        await db.commit()

        return JournalEntryResponse(
            id=entry_row["id"],
            tenant_id=entry_row["tenant_id"],
            transaction_date=entry_row["transaction_date"],
            description=entry_row["description"],
            reference_type=entry_row["reference_type"],
            reference_id=entry_row["reference_id"],
            lines=lines_response,
            created_at=entry_row["created_at"]
        )

    except HTTPException:
        await db.rollback()
        raise
    except (DBAPIError, IntegrityError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mencatat jurnal akuntansi: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 4: DAFTAR BUKU JURNAL UMUM (GENERAL LEDGER)
# ==============================================================================
@router.get("/journals", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    reference_type: Optional[str] = Query(None, description="Filter tipe referensi ('REPAIR', 'POS_SALE', 'MANUAL')"),
    limit: int = Query(100, ge=1, le=500, description="Batas jumlah jurnal"),
    offset: int = Query(0, ge=0, description="Offset paginasi"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil daftar jurnal umum (General Ledger) milik tenant aktif beserta detail barisnya,
    diurutkan berdasarkan transaction_date DESC, created_at DESC.
    """
    try:
        base_query = """
            SELECT 
                id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
            FROM public.journal_entries
            WHERE tenant_id = :tenant_id
        """
        params = {"tenant_id": str(current_tenant_id), "limit": limit, "offset": offset}
        if reference_type:
            base_query += " AND reference_type = :ref_type"
            params["ref_type"] = reference_type

        base_query += " ORDER BY transaction_date DESC, created_at DESC LIMIT :limit OFFSET :offset"

        result = await db.execute(text(base_query), params)
        entry_rows = result.mappings().all()

        if not entry_rows:
            return []

        entry_ids = [str(r["id"]) for r in entry_rows]

        # Ambil seluruh baris jurnal untuk entri-entri di atas dengan join ke chart_of_accounts
        lines_query = text("""
            SELECT 
                jl.id, jl.tenant_id, jl.journal_entry_id, jl.account_id,
                coa.code AS account_code, coa.name AS account_name,
                jl.debit, jl.credit, jl.created_at
            FROM public.journal_lines jl
            LEFT JOIN public.chart_of_accounts coa ON coa.id = jl.account_id AND coa.tenant_id = :tenant_id
            WHERE jl.tenant_id = :tenant_id AND jl.journal_entry_id = ANY(:entry_ids)
            ORDER BY jl.created_at ASC
        """)
        lines_result = await db.execute(lines_query, {"tenant_id": str(current_tenant_id), "entry_ids": entry_ids})
        all_lines = lines_result.mappings().all()

        lines_by_entry: dict[str, list[JournalLineResponse]] = {}
        for l in all_lines:
            eid = str(l["journal_entry_id"])
            if eid not in lines_by_entry:
                lines_by_entry[eid] = []
            lines_by_entry[eid].append(
                JournalLineResponse(
                    id=l["id"],
                    account_id=l["account_id"],
                    account_code=l["account_code"],
                    account_name=l["account_name"],
                    debit=l["debit"],
                    credit=l["credit"],
                    created_at=l["created_at"]
                )
            )

        return [
            JournalEntryResponse(
                id=r["id"],
                tenant_id=r["tenant_id"],
                transaction_date=r["transaction_date"],
                description=r["description"],
                reference_type=r["reference_type"],
                reference_id=r["reference_id"],
                lines=lines_by_entry.get(str(r["id"]), []),
                created_at=r["created_at"]
            )
            for r in entry_rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar buku jurnal: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 5: RINGKASAN LABA RUGI (PROFIT & LOSS SUMMARY)
# ==============================================================================
@router.get("/profit-loss-summary", response_model=ProfitLossSummaryResponse)
async def get_profit_loss_summary(
    month: Optional[int] = Query(None, ge=1, le=12, description="Bulan (1-12, default bulan ini)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Tahun (contoh: 2026)"),
    all_time: bool = Query(False, description="Tampilkan seluruh data tanpa batasan bulan"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil ringkasan Laba Rugi (Profit & Loss Summary) untuk tenant aktif.
    Menghitung:
    - Total Pendapatan: Jumlah kredit pada akun tipe 'Revenue' / kepala 4xxx
    - Total HPP (COGS): Jumlah debit pada akun tipe 'COGS' / kepala 5xxx
    - Laba Kotor (Gross Profit): Total Pendapatan - Total HPP
    - Total Beban Operasional (OPEX): Jumlah debit pada akun tipe 'Expense' / kepala 6xxx
    - Laba Bersih (Net Profit): Laba Kotor - Total OPEX
    """
    try:
        today = date.today()
        target_month = month or today.month
        target_year = year or today.year
        period_label = f"{target_year}-{target_month:02d}"

        if all_time:
            date_filter = ""
            params = {"tenant_id": str(current_tenant_id)}
            period_label = "All Time"
        else:
            date_filter = """
                AND EXTRACT(MONTH FROM je.transaction_date) = :target_month
                AND EXTRACT(YEAR FROM je.transaction_date) = :target_year
            """
            params = {
                "tenant_id": str(current_tenant_id),
                "target_month": target_month,
                "target_year": target_year
            }

        # 1. Agregasi Pendapatan, HPP, dan Total Beban
        query_totals = text(f"""
            SELECT 
                COALESCE(SUM(CASE WHEN coa.code LIKE '4%' OR coa.type = 'Revenue' THEN (jl.credit - jl.debit) ELSE 0 END), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN coa.code LIKE '5%' OR coa.type = 'COGS' THEN (jl.debit - jl.credit) ELSE 0 END), 0) AS total_cogs,
                COALESCE(SUM(CASE WHEN coa.code LIKE '6%' OR coa.type = 'Expense' THEN (jl.debit - jl.credit) ELSE 0 END), 0) AS total_opex
            FROM public.journal_lines jl
            JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.tenant_id = :tenant_id
            JOIN public.chart_of_accounts coa ON coa.id = jl.account_id AND coa.tenant_id = :tenant_id
            WHERE jl.tenant_id = :tenant_id
            {date_filter}
        """)

        result = await db.execute(query_totals, params)
        row = result.mappings().one()

        total_revenue = int(row["total_revenue"] or 0)
        total_cogs = int(row["total_cogs"] or 0)
        total_opex = int(row["total_opex"] or 0)
        gross_profit = total_revenue - total_cogs
        net_profit = gross_profit - total_opex

        # 2. Rincian per pos Beban Operasional (OPEX Breakdown)
        query_breakdown = text(f"""
            SELECT 
                coa.id AS account_id,
                coa.code,
                coa.name,
                COALESCE(SUM(jl.debit - jl.credit), 0) AS amount
            FROM public.journal_lines jl
            JOIN public.journal_entries je ON je.id = jl.journal_entry_id AND je.tenant_id = :tenant_id
            JOIN public.chart_of_accounts coa ON coa.id = jl.account_id AND coa.tenant_id = :tenant_id
            WHERE jl.tenant_id = :tenant_id
              AND (coa.code LIKE '6%' OR coa.type = 'Expense')
            {date_filter}
            GROUP BY coa.id, coa.code, coa.name
            HAVING SUM(jl.debit - jl.credit) > 0
            ORDER BY amount DESC
        """)
        breakdown_res = await db.execute(query_breakdown, params)
        breakdown_rows = breakdown_res.mappings().all()

        opex_breakdown = [
            ExpenseBreakdownItem(
                account_id=b["account_id"],
                code=b["code"],
                name=b["name"],
                amount=int(b["amount"])
            )
            for b in breakdown_rows
        ]

        return ProfitLossSummaryResponse(
            total_revenue=total_revenue,
            total_cogs=total_cogs,
            gross_profit=gross_profit,
            total_opex=total_opex,
            net_profit=net_profit,
            opex_breakdown=opex_breakdown,
            period=period_label
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghitung ringkasan Laba Rugi: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 6: SALDO KAS & BANK OPERASIONAL (HOUSE BANKS)
# ==============================================================================
@router.get("/bank-balances", response_model=BankBalancesResponse)
async def get_bank_balances(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil saldo kas fisik kasir dan rekening bank operasional (House Banks).
    Saldo dihitung secara realtime dari mutasi (Debit - Credit) pada journal_lines.
    """
    try:
        # Pastikan akun standar sudah ter-seed jika baru
        await get_or_create_default_accounts(current_tenant_id, db)

        query = text("""
            SELECT 
                coa.id,
                coa.code,
                coa.name,
                COALESCE(SUM(jl.debit), 0) AS total_debit,
                COALESCE(SUM(jl.credit), 0) AS total_credit,
                COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS balance
            FROM public.chart_of_accounts coa
            LEFT JOIN public.journal_lines jl 
                ON jl.account_id = coa.id AND jl.tenant_id = :tenant_id
            WHERE coa.tenant_id = :tenant_id
              AND coa.type = 'Asset'
              AND (coa.code LIKE '10%' OR coa.code = '1000')
              AND coa.is_active = true
            GROUP BY coa.id, coa.code, coa.name
            ORDER BY coa.code ASC
        """)
        result = await db.execute(query, {"tenant_id": str(current_tenant_id)})
        rows = result.mappings().all()

        accounts = [
            BankBalanceItem(
                id=r["id"],
                code=r["code"],
                name=r["name"],
                balance=int(r["balance"]),
                total_debit=int(r["total_debit"]),
                total_credit=int(r["total_credit"])
            )
            for r in rows
        ]

        total_liquid = sum(acc.balance for acc in accounts)

        return BankBalancesResponse(
            tenant_id=current_tenant_id,
            accounts=accounts,
            total_liquid_balance=total_liquid
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil saldo kas & bank: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 7: PENCATATAN BEBAN OPERASIONAL (OPEX)
# ==============================================================================
@router.post("/expenses", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def record_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mencatat Beban Operasional (OPEX) seperti sewa toko, listrik, gaji, atau perlengkapan.
    Menerapkan Double-Entry atomik:
    - DEBIT: Akun Beban (kepala 6000)
    - KREDIT: Akun Kas/Bank (kepala 1000/1001/1010/1020)
    """
    try:
        tenant_id_str = str(current_tenant_id)

        # 1. Verifikasi akun beban
        check_acc = text("""
            SELECT id, code, name, type 
            FROM public.chart_of_accounts
            WHERE id = :acc_id AND tenant_id = :tenant_id
        """)
        exp_res = await db.execute(check_acc, {"acc_id": str(payload.expense_account_id), "tenant_id": tenant_id_str})
        exp_acc = exp_res.mappings().one_or_none()
        if not exp_acc or exp_acc["type"] != "Expense":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Akun beban tidak valid atau bukan bertipe 'Expense'."
            )

        # 2. Verifikasi akun sumber kas/bank
        src_res = await db.execute(check_acc, {"acc_id": str(payload.source_account_id), "tenant_id": tenant_id_str})
        src_acc = src_res.mappings().one_or_none()
        if not src_acc or src_acc["type"] != "Asset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Akun sumber dana tidak valid atau bukan bertipe kas/bank ('Asset')."
            )

        entry_date = payload.transaction_date or date.today()
        desc = f"Beban Operasional: {payload.expense_name}"
        if payload.notes:
            desc += f" - {payload.notes}"

        # 3. Insert Journal Entry Header
        entry_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_entries (
                    id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
                ) VALUES (
                    :id, :tenant_id, :tx_date, :description, 'EXPENSE', NULL, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(entry_id),
                "tenant_id": tenant_id_str,
                "tx_date": entry_date,
                "description": desc
            }
        )

        # 4. Insert Debit Line (Beban bertambah)
        line1_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_lines (
                    id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
                ) VALUES (
                    :id, :tenant_id, :entry_id, :acc_id, :debit, 0, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(line1_id),
                "tenant_id": tenant_id_str,
                "entry_id": str(entry_id),
                "acc_id": str(payload.expense_account_id),
                "debit": int(payload.amount)
            }
        )

        # 5. Insert Credit Line (Kas/Bank berkurang)
        line2_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_lines (
                    id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
                ) VALUES (
                    :id, :tenant_id, :entry_id, :acc_id, 0, :credit, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(line2_id),
                "tenant_id": tenant_id_str,
                "entry_id": str(entry_id),
                "acc_id": str(payload.source_account_id),
                "credit": int(payload.amount)
            }
        )

        await db.commit()

        lines_resp = [
            JournalLineResponse(
                id=line1_id,
                account_id=payload.expense_account_id,
                account_code=exp_acc["code"],
                account_name=exp_acc["name"],
                debit=int(payload.amount),
                credit=0
            ),
            JournalLineResponse(
                id=line2_id,
                account_id=payload.source_account_id,
                account_code=src_acc["code"],
                account_name=src_acc["name"],
                debit=0,
                credit=int(payload.amount)
            )
        ]

        return JournalEntryResponse(
            id=entry_id,
            tenant_id=current_tenant_id,
            transaction_date=entry_date,
            description=desc,
            reference_type="EXPENSE",
            reference_id=None,
            lines=lines_resp
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mencatat beban operasional: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 8: PELUNASAN HUTANG SUPPLIER (AP SETTLEMENT)
# ==============================================================================
@router.post("/pay-supplier", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def pay_supplier(
    payload: PaySupplierCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mencatat pelunasan hutang supplier / pembelian konsinyasi (AP Settlement).
    Menerapkan Double-Entry atomik:
    - DEBIT: Akun Hutang Usaha (kepala 2000) -> Hutang berkurang
    - KREDIT: Akun Kas/Bank (kepala 10xx) -> Kas/Bank berkurang
    """
    try:
        tenant_id_str = str(current_tenant_id)

        # 1. Cari atau verifikasi akun hutang (2000)
        check_acc = text("""
            SELECT id, code, name, type 
            FROM public.chart_of_accounts
            WHERE (id = :acc_id OR code = '2000') AND tenant_id = :tenant_id
            LIMIT 1
        """)
        ap_res = await db.execute(check_acc, {
            "acc_id": str(payload.liability_account_id) if payload.liability_account_id else str(uuid4()),
            "tenant_id": tenant_id_str
        })
        ap_acc = ap_res.mappings().one_or_none()
        if not ap_acc:
            # Auto-seed default accounts jika belum ada
            default_map = await get_or_create_default_accounts(current_tenant_id, db)
            ap_acc = default_map.get("2000")
            if not ap_acc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Akun Hutang Usaha (2000) tidak ditemukan."
                )

        # 2. Verifikasi akun sumber kas/bank
        src_res = await db.execute(
            text("SELECT id, code, name, type FROM public.chart_of_accounts WHERE id = :acc_id AND tenant_id = :tenant_id"),
            {"acc_id": str(payload.source_account_id), "tenant_id": tenant_id_str}
        )
        src_acc = src_res.mappings().one_or_none()
        if not src_acc or src_acc["type"] != "Asset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Akun sumber pembayaran tidak valid atau bukan bertipe kas/bank ('Asset')."
            )

        entry_date = payload.transaction_date or date.today()
        supplier_label = payload.supplier_name or payload.grn_ref or "Supplier"
        desc = f"Pelunasan Hutang Supplier: {supplier_label}"
        if payload.notes:
            desc += f" - {payload.notes}"

        # 3. Insert Journal Entry Header
        entry_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_entries (
                    id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
                ) VALUES (
                    :id, :tenant_id, :tx_date, :description, 'AP_SETTLEMENT', :ref_id, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(entry_id),
                "tenant_id": tenant_id_str,
                "tx_date": entry_date,
                "description": desc,
                "ref_id": str(payload.supplier_id) if payload.supplier_id else None
            }
        )

        # 4. Insert Debit Line (Hutang Usaha berkurang)
        line1_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_lines (
                    id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
                ) VALUES (
                    :id, :tenant_id, :entry_id, :acc_id, :debit, 0, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(line1_id),
                "tenant_id": tenant_id_str,
                "entry_id": str(entry_id),
                "acc_id": str(ap_acc["id"]),
                "debit": int(payload.amount)
            }
        )

        # 5. Insert Credit Line (Kas/Bank berkurang)
        line2_id = uuid4()
        await db.execute(
            text("""
                INSERT INTO public.journal_lines (
                    id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
                ) VALUES (
                    :id, :tenant_id, :entry_id, :acc_id, 0, :credit, timezone('utc'::text, now())
                )
            """),
            {
                "id": str(line2_id),
                "tenant_id": tenant_id_str,
                "entry_id": str(entry_id),
                "acc_id": str(payload.source_account_id),
                "credit": int(payload.amount)
            }
        )

        await db.commit()

        lines_resp = [
            JournalLineResponse(
                id=line1_id,
                account_id=ap_acc["id"],
                account_code=ap_acc["code"],
                account_name=ap_acc["name"],
                debit=int(payload.amount),
                credit=0
            ),
            JournalLineResponse(
                id=line2_id,
                account_id=payload.source_account_id,
                account_code=src_acc["code"],
                account_name=src_acc["name"],
                debit=0,
                credit=int(payload.amount)
            )
        ]

        return JournalEntryResponse(
            id=entry_id,
            tenant_id=current_tenant_id,
            transaction_date=entry_date,
            description=desc,
            reference_type="AP_SETTLEMENT",
            reference_id=payload.supplier_id,
            lines=lines_resp
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mencatat pelunasan hutang supplier: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 9: LAPORAN POSISI KEUANGAN (NERACA / BALANCE SHEET)
# ==============================================================================
@router.get("/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    as_of: Optional[date] = Query(None, description="Tanggal posisi neraca (default hari ini)"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Menghitung Laporan Posisi Keuangan (Neraca / Balance Sheet) per tanggal tertentu.
    Persamaan Akuntansi Dasar:
    ASET = KEWAJIBAN + EKUITAS
    """
    try:
        tenant_id_str = str(current_tenant_id)
        target_date = as_of or date.today()

        # Ambil saldo seluruh akun per tanggal target
        query = text("""
            SELECT 
                coa.id,
                coa.code,
                coa.name,
                coa.type,
                COALESCE(SUM(jl.debit), 0) AS total_debit,
                COALESCE(SUM(jl.credit), 0) AS total_credit
            FROM public.chart_of_accounts coa
            LEFT JOIN public.journal_lines jl 
                ON jl.account_id = coa.id AND jl.tenant_id = :tenant_id
            LEFT JOIN public.journal_entries je 
                ON je.id = jl.journal_entry_id AND je.tenant_id = :tenant_id AND je.transaction_date <= :as_of_date
            WHERE coa.tenant_id = :tenant_id AND coa.is_active = true
            GROUP BY coa.id, coa.code, coa.name, coa.type
            ORDER BY coa.code ASC
        """)
        result = await db.execute(query, {"tenant_id": tenant_id_str, "as_of_date": target_date})
        rows = result.mappings().all()

        asset_items = []
        liability_items = []
        equity_items = []

        total_assets = 0
        total_liabilities = 0
        total_initial_equity = 0

        # Penampung kalkulasi laba berjalan kumulatif
        total_cumulative_revenue = 0
        total_cumulative_cogs = 0
        total_cumulative_opex = 0

        for r in rows:
            acc_type = r["type"]
            code = r["code"]
            name = r["name"]
            deb = int(r["total_debit"])
            crd = int(r["total_credit"])

            if acc_type == "Asset":
                val = deb - crd
                total_assets += val
                asset_items.append(BalanceSheetItem(code=code, name=name, amount=val))
            elif acc_type == "Liability":
                val = crd - deb
                total_liabilities += val
                liability_items.append(BalanceSheetItem(code=code, name=name, amount=val))
            elif acc_type == "Equity":
                val = crd - deb
                total_initial_equity += val
                equity_items.append(BalanceSheetItem(code=code, name=name, amount=val))
            elif acc_type == "Revenue":
                total_cumulative_revenue += (crd - deb)
            elif acc_type == "COGS":
                total_cumulative_cogs += (deb - crd)
            elif acc_type == "Expense":
                total_cumulative_opex += (deb - crd)

        # Laba Bersih Berjalan Kumulatif (Current Net Profit / Retained Earnings)
        current_net_profit = total_cumulative_revenue - total_cumulative_cogs - total_cumulative_opex
        equity_items.append(BalanceSheetItem(
            code="3999",
            name="Laba Berjalan Kumulatif (Net Profit)",
            amount=current_net_profit
        ))

        total_equity = total_initial_equity + current_net_profit
        is_balanced = (total_assets == (total_liabilities + total_equity))

        return BalanceSheetResponse(
            as_of_date=target_date,
            period_label=f"Per {target_date.strftime('%d %B %Y')}",
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity,
            is_balanced=is_balanced,
            assets=BalanceSheetSection(items=asset_items, subtotal=total_assets),
            liabilities=BalanceSheetSection(items=liability_items, subtotal=total_liabilities),
            equity=BalanceSheetSection(items=equity_items, subtotal=total_equity)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghitung neraca (balance sheet): {str(e)}"
        )
