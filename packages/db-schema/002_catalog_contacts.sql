-- =============================================================================
-- NEXUS CORE OS - MIGRATION 002: UNIVERSAL CATALOG & CONTACTS
-- File: packages/db-schema/002_catalog_contacts.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- TABEL: items (UNIVERSAL CATALOG)
-- 
-- 🧠 CATATAN ARSITEKTUR: MENGAPA SATU TABEL UNTUK BARANG DAN JASA?
-- Sistem ERP legacy sering memisahkan tabel `physical_products`, `services`, dan `digital_assets`.
-- Ini menyebabkan duplikasi kode fatal pada order lines, invoice, dan POS checkout.
-- Di Nexus Core OS, kita menggunakan model "Universal Catalog Item":
-- 1. Kolom Inti Relasional (sku, name, item_type, base_price) tetap berbentuk kolom
--    relasional terstruktur untuk menjamin integritas referensial dan kecepatan query JOIN.
-- 2. Atribut Khusus Industri (durasi pijat, spesifikasi material, lisensi software, MOQ)
--    disimpan di dalam kolom JSONB 'attributes'.
--
-- 🧠 CATATAN ARSITEKTUR: MENGAPA BIGINT UNTUK BASE_PRICE?
-- Aturan Besar #1 & #2: Dilarang menggunakan FLOAT/DECIMAL.
-- Nilai harga disimpan dalam satuan terkecil (minor currency units / cents).
-- Contoh: Rp 25.000 disimpan sebagai integer 25000.
-- Ini mencegah rounding error floating-point IEEE 754 dan menjamin akurasi mutlak kalkulasi finansial.
--
-- 🧠 CATATAN ARSITEKTUR: ATURAN PENGGUNAAN JSONB
-- Aturan Besar: JSONB HANYA untuk atribut deskriptif fleksibel.
-- DILARANG menyimpan kolom yang memerlukan agregasi finansial (SUM, AVG) atau
-- foreign key JOIN di dalam JSONB. Atribut deskriptif (misal: warna, durasi_menit, moq)
-- sangat ideal disimpan di JSONB karena tidak memerlukan DDL ALTER TABLE saat tenant baru onboarding.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('stocked', 'service', 'digital')),
    base_price BIGINT NOT NULL CHECK (base_price >= 0),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_item_sku UNIQUE (tenant_id, sku)
);

-- Index GIN untuk pencarian filter performa tinggi pada JSONB attributes
CREATE INDEX IF NOT EXISTS idx_items_attributes_gin ON public.items USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_items_tenant_id ON public.items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant_type ON public.items (tenant_id, item_type);

-- =============================================================================
-- TABEL: contacts (UNIVERSAL CRM)
-- Menyimpan entitas pelanggan, vendor, atau mitra bisnis (individu maupun perusahaan).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL CHECK (kind IN ('person', 'org')),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contoh: npwp, plafon_kredit, alergi_kulit, PIC
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_contacts_attributes_gin ON public.contacts USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts (tenant_id);

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) ACTIVATION
-- =============================================================================
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- ROW-LEVEL SECURITY POLICIES
-- Kebijakan isolasi multi-tenant ketat menggunakan app.tenant_id()
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_items ON public.items;
CREATE POLICY tenant_isolation_items ON public.items
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_contacts ON public.contacts;
CREATE POLICY tenant_isolation_contacts ON public.contacts
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- ROLE PERMISSIONS
-- Menjamin role 'authenticated' Supabase memiliki hak akses DML di bawah RLS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
