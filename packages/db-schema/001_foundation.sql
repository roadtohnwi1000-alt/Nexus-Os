-- =============================================================================
-- NEXUS CORE OS - THE VAULT (DATABASE FOUNDATION)
-- File: packages/db-schema/001_foundation.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
-- pgcrypto: Digunakan untuk fungsi kriptografi, hashing, dan gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- vector: Digunakan untuk penyimpanan embedding produk dan pencarian semantik (AI search)
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- 2. SCHEMA & RUNTIME SESSION CONTEXT (MULTI-TENANCY ENGINE)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS app;

-- =============================================================================
-- FUNGSI: app.tenant_id()
-- MENGAPA: 
-- Fungsi ini mengekstraksi nilai 'app.tenant_id' dari session runtime PostgreSQL.
-- Parameter kedua 'true' mencegah error jika setting belum diinisialisasi (mengembalikan NULL).
-- Jika mengembalikan NULL, perbandingan RLS (tenant_id = NULL) bernilai UNKNOWN/FALSE,
-- sehingga menerapkan prinsip fail-closed (data terkunci secara default).
-- =============================================================================
CREATE OR REPLACE FUNCTION app.tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION app.tenant_id() IS 'Mengekstrak tenant_id aktif dari context runtime session connection.';

-- =============================================================================
-- 3. CORE TENANT TABLES
-- =============================================================================

-- TABEL: tenants
-- Menyimpan identitas setiap entitas bisnis (toko / perusahaan).
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- TABEL: tenant_memberships
-- Menghubungkan pengguna (auth.users) ke tenant dengan role tertentu.
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'cashier', 'staff'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

-- =============================================================================
-- 4. BUSINESS TABLES
-- =============================================================================

-- TABEL: products
--
-- 🧠 CATATAN ARSITEKTUR: MENGAPA BIGINT UNTUK HARGA?
-- 1. Floating-point (FLOAT/REAL) di komputer menggunakan representasi biner IEEE 754,
--    yang menyebabkan rounding error fatal pada kalkulasi akuntansi (contoh: 0.1 + 0.2 != 0.3).
-- 2. DECIMAL/NUMERIC di PostgreSQL memang presisi, namun memiliki overhead kalkulasi
--    dan parsing string/desimal yang lebih berat pada throughput transaksi tinggi.
-- 3. BIGINT (minor units) menyimpan nilai dalam unit terkecil tanpa desimal.
--    Contoh: Rp 10.000 disimpan sebagai 10000. Untuk mata uang dengan sen (USD),
--    $10.50 disimpan sebagai 1050 cents. Ini menghilangkan risiko floating-point bug 100%.
--
-- 🧠 CATATAN ARSITEKTUR: MENGAPA JSONB UNTUK ATTRIBUTES?
-- Di sistem ERP/Commerce, tiap kategori produk memiliki atribut dinamis yang berbeda:
-- - Pakaian: ukuran, warna, material
-- - Elektronik: daya_watt, garansi, prosesor
-- - Makanan: tanggal_kedaluwarsa, alergen
-- Jika menggunakan skema kaku (EAV pattern atau tabel relasional terpisah), performa JOIN
-- akan hancur pada skala jutaan produk. JSONB di PostgreSQL disimpan dalam format binary
-- terindeks (GIN), mendukung query pencarian bersarang cepat tanpa memerlukan schema migration!
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    description TEXT,
    base_price BIGINT NOT NULL CHECK (base_price >= 0), -- Disimpan dalam minor currency units (contoh: IDR = Rupiah)
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- Atribut fleksibel (varian warna, spek, ukuran)
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_product_sku UNIQUE (tenant_id, sku)
);

-- Index GIN untuk pencarian performa tinggi pada JSONB attributes
CREATE INDEX IF NOT EXISTS idx_products_attributes_gin ON public.products USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products (tenant_id);

-- TABEL: ai_drafts (AI SANDBOX - ZONA B)
--
-- 🧠 CATATAN ARSITEKTUR: MENGAPA AI SANDBOX?
-- Aturan Besar #3: AI Agent beroperasi secara nondeterministik (probabilistik).
-- Jika AI diizinkan menulis langsung ke tabel `orders` atau `stock_movements`, halusinasi AI
-- dapat merusak data keuangan atau inventaris riil bisnis tenant.
-- AI HANYA BOLEH menulis rekomendasi ke `ai_drafts`.
-- Data ini kemudian harus disetujui oleh User (Human-in-the-Loop) atau validasi Rule Engine Backend.
CREATE TABLE IF NOT EXISTS public.ai_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    draft_type VARCHAR(50) NOT NULL, -- 'order_proposal', 'stock_reorder', 'crm_followup', 'catalog_generation'
    payload JSONB NOT NULL, -- Seluruh data usulan aksi AI disimpan di sini
    status VARCHAR(50) NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected'
    generated_by VARCHAR(100) NOT NULL DEFAULT 'langgraph_agent',
    reviewed_by UUID, -- ID user yang melakukan approval
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_tenant_status ON public.ai_drafts (tenant_id, status);

-- =============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) ACTIVATION
-- =============================================================================
-- WAJIB: Aktifkan RLS dan paksa FORCE RLS agar table owner sekalipun (kecuali superuser)
-- tetap terikat aturan multi-tenant isolation.

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_drafts FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES
-- =============================================================================

-- Policy untuk Tenants:
-- 1. SELECT: Hanya bisa melihat datanya sendiri jika context tenant disetel
-- 2. INSERT: Diizinkan saat registrasi tenant baru (app.tenant_id() IS NULL) atau jika sesuai id
-- 3. UPDATE/DELETE: Hanya bisa memodifikasi tenant-nya sendiri
DROP POLICY IF EXISTS tenant_isolation_tenants ON public.tenants;
DROP POLICY IF EXISTS tenant_isolation_tenants_select ON public.tenants;
DROP POLICY IF EXISTS tenant_isolation_tenants_insert ON public.tenants;
DROP POLICY IF EXISTS tenant_isolation_tenants_update ON public.tenants;
DROP POLICY IF EXISTS tenant_isolation_tenants_delete ON public.tenants;

CREATE POLICY tenant_isolation_tenants_select ON public.tenants
    FOR SELECT
    USING (id = app.tenant_id());

CREATE POLICY tenant_isolation_tenants_insert ON public.tenants
    FOR INSERT
    WITH CHECK (id = app.tenant_id() OR app.tenant_id() IS NULL);

CREATE POLICY tenant_isolation_tenants_update ON public.tenants
    FOR UPDATE
    USING (id = app.tenant_id())
    WITH CHECK (id = app.tenant_id());

CREATE POLICY tenant_isolation_tenants_delete ON public.tenants
    FOR DELETE
    USING (id = app.tenant_id() OR app.tenant_id() IS NULL);

-- Policy untuk Tenant Memberships
DROP POLICY IF EXISTS tenant_isolation_memberships ON public.tenant_memberships;
CREATE POLICY tenant_isolation_memberships ON public.tenant_memberships
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy untuk Products
DROP POLICY IF EXISTS tenant_isolation_products ON public.products;
CREATE POLICY tenant_isolation_products ON public.products
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- Policy untuk AI Drafts (Sandbox Zona B)
DROP POLICY IF EXISTS tenant_isolation_ai_drafts ON public.ai_drafts;
CREATE POLICY tenant_isolation_ai_drafts ON public.ai_drafts
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 7. ROLE PERMISSIONS
-- =============================================================================
-- Menjamin role 'authenticated' Supabase dapat mengeksekusi fungsi app.tenant_id()
-- dan mengakses tabel publik di bawah pengawasan kebijakan RLS.
GRANT USAGE ON SCHEMA app TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
