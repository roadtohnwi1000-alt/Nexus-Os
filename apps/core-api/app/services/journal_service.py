"""
NEXUS CORE OS - AUTO-ACCOUNTING ENGINE (JOURNAL SERVICE)
File: apps/core-api/app/services/journal_service.py

Layanan otomatisasi akuntansi double-entry (General Ledger).
Mencatat pergerakan finansial secara append-only setiap kali terjadi
transaksi operasional (servis selesai, pemakaian sparepart, penjualan POS).

🧠 ATURAN ARSITEKTUR EMAS:
1. DOUBLE-ENTRY BALANCE: Total Debit WAJIB sama persis dengan Total Kredit (Debit == Credit).
   Jika selisih 1 rupiah pun, transaksi ditolak (raise ValueError) dan di-rollback.
2. APPEND-ONLY LEDGER: Tidak ada operasi UPDATE atau DELETE pada tabel jurnal.
3. INTEGER MINOR UNITS: Seluruh nilai debit dan kredit menggunakan integer (Rupiah penuh).
"""

from datetime import date
from typing import List, Dict, Any, Union
from uuid import UUID, uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, IntegrityError

# Standar Bagan Akun Dasar (Chart of Accounts) untuk Tenant Universal & Treasury
DEFAULT_COA_ACCOUNTS = [
    {"code": "1000", "name": "Kas Utama", "type": "Asset"},
    {"code": "1001", "name": "Kas Fisik Kasir", "type": "Asset"},
    {"code": "1010", "name": "Bank Operasional 1 (BCA)", "type": "Asset"},
    {"code": "1020", "name": "Bank Operasional 2 (Mandiri / Rekening Penampung)", "type": "Asset"},
    {"code": "1030", "name": "Bank Cadangan", "type": "Asset"},
    {"code": "1040", "name": "Saldo QRIS / Settlement Marketplace", "type": "Asset"},
    {"code": "1120", "name": "Piutang Marketplace (TikTok/Shopee)", "type": "Asset"},
    {"code": "1200", "name": "Persediaan Sparepart", "type": "Asset"},
    {"code": "1210", "name": "Persediaan Aksesoris & Retail", "type": "Asset"},
    {"code": "2000", "name": "Hutang Usaha / Supplier", "type": "Liability"},
    {"code": "3000", "name": "Modal Pemilik", "type": "Equity"},
    {"code": "4000", "name": "Pendapatan Jasa Servis", "type": "Revenue"},
    {"code": "4100", "name": "Pendapatan Penjualan Sparepart", "type": "Revenue"},
    {"code": "4200", "name": "Pendapatan Penjualan Aksesoris", "type": "Revenue"},
    {"code": "4300", "name": "Pendapatan Penjualan Marketplace", "type": "Revenue"},
    {"code": "5000", "name": "HPP Sparepart", "type": "COGS"},
    {"code": "5100", "name": "HPP Aksesoris & Barang Dagang", "type": "COGS"},
    {"code": "6000", "name": "Beban Operasional Umum", "type": "Expense"},
    {"code": "6100", "name": "Beban Sewa Tempat / Toko", "type": "Expense"},
    {"code": "6200", "name": "Beban Listrik, Air & Internet", "type": "Expense"},
    {"code": "6300", "name": "Beban Gaji Staf & Karyawan", "type": "Expense"},
    {"code": "6400", "name": "Beban Packing & Perlengkapan Operasional", "type": "Expense"},
]

async def get_or_create_default_accounts(
    tenant_id: Union[UUID, str],
    db: AsyncSession
) -> Dict[str, Dict[str, Any]]:
    """
    Mengambil mapping akun standar untuk tenant aktif (key: 'code', value: dict data akun).
    Jika akun standar belum ada di database, fungsi ini otomatis membuatkannya (auto-seed).
    """
    tenant_id_str = str(tenant_id)

    # 1. Ambil akun yang sudah terdaftar untuk tenant ini
    query = text("""
        SELECT id, code, name, type, is_active
        FROM public.chart_of_accounts
        WHERE tenant_id = :tenant_id
    """)
    result = await db.execute(query, {"tenant_id": tenant_id_str})
    existing_accounts = {r["code"]: dict(r) for r in result.mappings().all()}

    # 2. Cek apakah ada akun standar yang belum ada, lalu insert otomatis
    accounts_to_insert = [
        acc for acc in DEFAULT_COA_ACCOUNTS
        if acc["code"] not in existing_accounts
    ]

    if accounts_to_insert:
        for acc in accounts_to_insert:
            new_id = str(uuid4())
            await db.execute(
                text("""
                    INSERT INTO public.chart_of_accounts (
                        id, tenant_id, code, name, type, parent_id, is_active,
                        created_at, updated_at
                    ) VALUES (
                        :id, :tenant_id, :code, :name, :type, NULL, true,
                        timezone('utc'::text, now()), timezone('utc'::text, now())
                    )
                    ON CONFLICT (tenant_id, code) DO NOTHING
                """),
                {
                    "id": new_id,
                    "tenant_id": tenant_id_str,
                    "code": acc["code"],
                    "name": acc["name"],
                    "type": acc["type"]
                }
            )
        await db.commit()

        # Ambil ulang mapping akun lengkap setelah seeding
        result = await db.execute(query, {"tenant_id": tenant_id_str})
        existing_accounts = {r["code"]: dict(r) for r in result.mappings().all()}

    return existing_accounts


async def create_auto_journal(
    tenant_id: Union[UUID, str],
    transaction_date: date,
    description: str,
    reference_type: str,
    reference_id: Union[UUID, str],
    lines: List[Dict[str, Any]],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Mencatat ayat jurnal akuntansi double-entry otomatis secara atomik.
    
    Validasi Ketat:
    - Total Debit harus persis sama dengan Total Credit.
    - Jumlah baris minimal 2 (1 Debit, 1 Credit).
    - Seluruh operasi dilakukan secara atomik (rollback jika ada baris yang gagal).
    
    Format `lines`:
    [
        {"account_id": UUID, "debit": int, "credit": int},
        {"account_id": UUID, "debit": int, "credit": int}
    ]
    """
    tenant_id_str = str(tenant_id)
    ref_id_str = str(reference_id)

    # 1. Validasi Jumlah Baris
    if not lines or len(lines) < 2:
        raise ValueError("Jurnal otomatis minimal memerlukan 2 baris transaksi (1 Debit dan 1 Kredit).")

    # 2. Validasi Keseimbangan Double-Entry (Debit == Credit)
    total_debit = sum(int(line.get("debit", 0)) for line in lines)
    total_credit = sum(int(line.get("credit", 0)) for line in lines)

    if total_debit != total_credit:
        raise ValueError(
            f"Jurnal tidak seimbang (Unbalanced)! Total Debit (Rp {total_debit:,}) "
            f"harus persis sama dengan Total Kredit (Rp {total_credit:,}). "
            f"Selisih: Rp {abs(total_debit - total_credit):,}."
        )

    if total_debit <= 0:
        raise ValueError("Total nilai transaksi jurnal harus lebih besar dari 0.")

    try:
        # 3. Insert Header Jurnal ke tabel `journal_entries`
        entry_id = str(uuid4())
        insert_entry_sql = text("""
            INSERT INTO public.journal_entries (
                id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
            ) VALUES (
                :id, :tenant_id, :tx_date, :description, :ref_type, :ref_id, timezone('utc'::text, now())
            )
            RETURNING id, tenant_id, transaction_date, description, reference_type, reference_id, created_at
        """)

        await db.execute(
            insert_entry_sql,
            {
                "id": entry_id,
                "tenant_id": tenant_id_str,
                "tx_date": transaction_date,
                "description": description.strip() if description else "Jurnal Otomatis Sistem",
                "ref_type": reference_type,
                "ref_id": ref_id_str
            }
        )

        # 4. Insert Detail Baris ke tabel `journal_lines`
        insert_line_sql = text("""
            INSERT INTO public.journal_lines (
                id, tenant_id, journal_entry_id, account_id, debit, credit, created_at
            ) VALUES (
                :id, :tenant_id, :entry_id, :account_id, :debit, :credit, timezone('utc'::text, now())
            )
        """)

        inserted_lines = []
        for line in lines:
            line_id = str(uuid4())
            account_id_str = str(line["account_id"])
            debit_val = int(line.get("debit", 0))
            credit_val = int(line.get("credit", 0))

            await db.execute(
                insert_line_sql,
                {
                    "id": line_id,
                    "tenant_id": tenant_id_str,
                    "entry_id": entry_id,
                    "account_id": account_id_str,
                    "debit": debit_val,
                    "credit": credit_val
                }
            )
            inserted_lines.append({
                "id": line_id,
                "account_id": account_id_str,
                "debit": debit_val,
                "credit": credit_val
            })

        return {
            "entry_id": entry_id,
            "tenant_id": tenant_id_str,
            "transaction_date": transaction_date.isoformat(),
            "description": description,
            "reference_type": reference_type,
            "reference_id": ref_id_str,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "lines": inserted_lines
        }

    except Exception as e:
        # Menjamin pembatalan transaksi secara atomik jika terjadi error
        await db.rollback()
        raise e
