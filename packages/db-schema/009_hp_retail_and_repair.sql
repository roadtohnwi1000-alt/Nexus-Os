-- =============================================================================
-- NEXUS CORE OS - MIGRATION 009: HP RETAIL & REPAIR ENGINE
-- File: packages/db-schema/009_hp_retail_and_repair.sql
-- Engine: PostgreSQL (Supabase Cloud / PostgreSQL 15+ compatible)
-- =============================================================================

-- =============================================================================
-- 🧠 CATATAN ARSITEKTUR & TUJUAN BISNIS MODUL HP RETAIL & REPAIR:
-- 
-- 1. MULTI-LOCATION INVENTORY:
--    Toko HP modern memiliki pemisahan fisik antara 'Gudang Pusat' (buffer stok &
--    pembelian grosir sparepart) dan 'Toko Cabang/Counter' (stok display & servis).
-- 
-- 2. TIKET SERVIS HP & SIKLUS HIDUP (WORKFLOW):
--    Servis HP membutuhkan tracking ketat dari unit diterima, diagnosa kerusakan,
--    persetujuan biaya oleh pelanggan, pengerjaan teknisi, Quality Control (QC),
--    hingga unit diambil. Status:
--    'Intake' -> 'Diagnosis' -> 'Waiting Approval' -> 'Repairing' -> 'QC' -> 'Done' -> 'Taken'
--
-- 3. HPP SPAREPART IMMUTABLE (hpp_at_use):
--    Harga beli/pokok sparepart saat dipasang ke unit pelanggan dicatat secara permanen
--    (snapshot) untuk menjamin akurasi perhitungan laba rugi kotor per tiket servis.
--
-- 4. GENERAL LEDGER (DOUBLE-ENTRY ACCOUNTING):
--    Setiap transaksi POS, penggunaan sparepart servis, dan pembayaran jasa
--    secara otomatis terintegrasi ke Jurnal Akuntansi (Chart of Accounts).
--    Semua nominal moneter WAJIB menggunakan BIGINT (minor currency units / rupiah penuh)
--    untuk mencegah floating-point rounding error.
-- =============================================================================

-- =============================================================================
-- 1. TABEL: locations (MULTI-LOKASI GUDANG & TOKO)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Contoh: 'Gudang Pusat', 'Toko Cabang Utama', 'Counter Servis 1'
    type TEXT NOT NULL CHECK (type IN ('warehouse', 'store')), -- 'warehouse' atau 'store'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON public.locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_tenant_type ON public.locations (tenant_id, type);

-- =============================================================================
-- 2. TABEL: repair_tickets (TIKET SERVIS & REPAIR HP)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.repair_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    device_imei TEXT, -- IMEI atau Serial Number perangkat HP
    device_model TEXT NOT NULL, -- Contoh: 'iPhone 11 64GB Black', 'Samsung S21 Ultra'
    device_password_pattern TEXT, -- Pola kunci layar / PIN (untuk pengujian teknisi setelah reparasi)
    complaint TEXT NOT NULL, -- Keluhan pelanggan (contoh: 'LCD Blank, touch mati sebagian')
    status TEXT NOT NULL DEFAULT 'Intake' CHECK (
        status IN (
            'Intake',           -- Unit baru diterima di meja kasir/servis
            'Diagnosis',        -- Sedang dicek dan dianalisa kerusakan oleh teknisi
            'Waiting Approval', -- Menunggu persetujuan biaya dari pemilik HP
            'Repairing',        -- Sedang dalam tahap pengerjaan fisik / pergantian sparepart
            'QC',               -- Quality Control pengujian fungsi perangkat paska reparasi
            'Done',             -- Servis selesai & unit siap diambil pelanggan
            'Taken'             -- Unit telah diambil pelanggan & lunas
        )
    ),
    assigned_technician_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
    estimated_cost BIGINT CHECK (estimated_cost >= 0), -- Estimasi biaya dalam minor units (Rp)
    final_cost BIGINT CHECK (final_cost >= 0),         -- Biaya akhir yang ditagihkan (Rp)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_repair_tickets_tenant_id ON public.repair_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_tenant_status ON public.repair_tickets (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_customer ON public.repair_tickets (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_technician ON public.repair_tickets (tenant_id, assigned_technician_id);

-- =============================================================================
-- 3. TABEL: repair_ticket_parts (PENGGUNAAN SPAREPART PER TIKET SERVIS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.repair_ticket_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    repair_ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    hpp_at_use BIGINT NOT NULL DEFAULT 0 CHECK (hpp_at_use >= 0), -- Snapshot Harga Pokok Penjualan saat dipakai
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_repair_ticket_parts_tenant ON public.repair_ticket_parts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_repair_ticket_parts_ticket ON public.repair_ticket_parts (repair_ticket_id);
CREATE INDEX IF NOT EXISTS idx_repair_ticket_parts_item ON public.repair_ticket_parts (tenant_id, item_id);

-- =============================================================================
-- 4. TABEL: chart_of_accounts (BAGAN AKUN STANDAR AKUNTANSI / COA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Contoh: '1000' (Kas), '1200' (Persediaan Sparepart), '4000' (Pendapatan Jasa Servis)
    name TEXT NOT NULL, -- Contoh: 'Kas Kasir Toko A', 'HPP Sparepart HP', 'Pendapatan Servis'
    type TEXT NOT NULL CHECK (
        type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense')
    ),
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL, -- Self-reference untuk sub-akun berjenjang
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_coa_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coa_tenant_id ON public.chart_of_accounts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_coa_tenant_code ON public.chart_of_accounts (tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_coa_parent_id ON public.chart_of_accounts (parent_id);

-- =============================================================================
-- 5. TABEL: journal_entries (HEADER JURNAL UMUM / GENERAL LEDGER)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT, -- Deskripsi transaksi (contoh: 'Penerimaan Servis iPhone 11 #SRV-001')
    reference_type TEXT CHECK (reference_type IN ('POS_SALE', 'REPAIR', 'PURCHASE', 'MANUAL', 'ADJUSTMENT')),
    reference_id UUID, -- Referensi ke order_id atau repair_ticket_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date ON public.journal_entries (tenant_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries (tenant_id, reference_type, reference_id);

-- =============================================================================
-- 6. TABEL: journal_lines (DETAIL DEBIT & KREDIT DOUBLE-ENTRY)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    debit BIGINT NOT NULL DEFAULT 0 CHECK (debit >= 0),   -- Minor currency units (Rp)
    credit BIGINT NOT NULL DEFAULT 0 CHECK (credit >= 0), -- Minor currency units (Rp)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_journal_lines_positive CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_tenant ON public.journal_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines (tenant_id, account_id);

-- =============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) ACTIVATION & FORCING
-- =============================================================================
-- Wajib menerapkan RLS dan FORCE RLS pada seluruh tabel baru demi isolasi multi-tenant.
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_tickets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.repair_ticket_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_ticket_parts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. ROW-LEVEL SECURITY POLICIES (ISOLASI BERBASIS app.tenant_id())
-- =============================================================================

-- Policy: locations
DROP POLICY IF EXISTS tenant_isolation_locations ON public.locations;
CREATE POLICY tenant_isolation_locations ON public.locations
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy: repair_tickets
DROP POLICY IF EXISTS tenant_isolation_repair_tickets ON public.repair_tickets;
CREATE POLICY tenant_isolation_repair_tickets ON public.repair_tickets
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy: repair_ticket_parts
DROP POLICY IF EXISTS tenant_isolation_repair_ticket_parts ON public.repair_ticket_parts;
CREATE POLICY tenant_isolation_repair_ticket_parts ON public.repair_ticket_parts
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy: chart_of_accounts
DROP POLICY IF EXISTS tenant_isolation_chart_of_accounts ON public.chart_of_accounts;
CREATE POLICY tenant_isolation_chart_of_accounts ON public.chart_of_accounts
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy: journal_entries
DROP POLICY IF EXISTS tenant_isolation_journal_entries ON public.journal_entries;
CREATE POLICY tenant_isolation_journal_entries ON public.journal_entries
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy: journal_lines
DROP POLICY IF EXISTS tenant_isolation_journal_lines ON public.journal_lines;
CREATE POLICY tenant_isolation_journal_lines ON public.journal_lines
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 9. ROLE PERMISSIONS
-- =============================================================================
-- Memberikan hak akses tabel ke role 'authenticated' Supabase di bawah filter RLS.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
