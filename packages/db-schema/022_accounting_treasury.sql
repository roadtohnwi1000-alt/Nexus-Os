-- =============================================================================
-- NEXUS CORE OS - MIGRATION 022: ACCOUNTING TREASURY, OPEX & BALANCE SHEET EXPANSION
-- File: packages/db-schema/022_accounting_treasury.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- 1. Perluas tipe referensi jurnal agar mencakup beban operasional (EXPENSE)
-- dan pelunasan hutang supplier (AP_SETTLEMENT)
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_reference_type_check;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_reference_type_check 
    CHECK (reference_type IN (
        'POS_SALE', 
        'REPAIR', 
        'PURCHASE', 
        'MANUAL', 
        'ADJUSTMENT', 
        'EXPENSE', 
        'AP_SETTLEMENT', 
        'OPENING_BALANCE'
    ));

-- 2. Pastikan index performa untuk agregasi neraca & laba rugi per tipe akun
CREATE INDEX IF NOT EXISTS idx_coa_tenant_type ON public.chart_of_accounts (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_created ON public.journal_lines (tenant_id, account_id, created_at);
