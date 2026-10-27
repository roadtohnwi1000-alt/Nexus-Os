-- =============================================================================
-- NEXUS CORE OS - MIGRATION 003: ORDERS, QUOTATION, & STOCK LEDGER
-- File: packages/db-schema/003_orders_stock.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- Hapus tabel legacy jika ada untuk migrasi clean
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.order_lines CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_levels CASCADE;

-- =============================================================================
-- 1. TABEL: orders (HEADER TRANSAKSI)
-- Menyimpan transaksi pemesanan penjualan.
-- total_minor: Total transaksi dalam minor units (contoh: Rp 25.000 = 25000).
-- =============================================================================
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    total_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_orders_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX idx_orders_tenant_status ON public.orders (tenant_id, status);

-- =============================================================================
-- 2. TABEL: order_lines (DETAIL ITEM PESANAN DENGAN SNAPSHOT)
-- 
-- 🧠 CATATAN ARSITEKTUR: SNAPSHOT NAMA & HARGA
-- Nama produk dan harga satuan di-snapshot permanen saat pesanan dibuat.
-- Jika nama atau harga item di katalog diubah di kemudian hari, rekaman transaksi
-- historis ini tidak akan pernah berubah.
-- =============================================================================
CREATE TABLE public.order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    sku_snapshot VARCHAR(100) NOT NULL,
    name_snapshot VARCHAR(255) NOT NULL,
    qty BIGINT NOT NULL CHECK (qty > 0),
    unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_order_lines_order_id ON public.order_lines (order_id);
CREATE INDEX idx_order_lines_tenant_item ON public.order_lines (tenant_id, item_id);

-- =============================================================================
-- 3. TABEL: stock_levels (CACHE READ-MODEL STATUS STOK REAL-TIME)
-- on_hand: Jumlah fisik barang yang tersedia.
-- reserved: Jumlah barang yang sedang ditahan oleh order 'draft' (belum dikonfirmasi).
-- Stok siap jual = (on_hand - reserved).
-- =============================================================================
CREATE TABLE public.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    on_hand BIGINT NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved BIGINT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_stock_levels UNIQUE (tenant_id, item_id),
    CONSTRAINT chk_stock_levels_valid CHECK (on_hand >= reserved)
);

CREATE INDEX idx_stock_levels_tenant_item ON public.stock_levels (tenant_id, item_id);

-- =============================================================================
-- 4. TABEL: stock_movements (APPEND-ONLY IMMUTABLE LEDGER)
-- 
-- 🧠 CATATAN ARSITEKTUR: APPEND-ONLY STOCK LEDGER
-- Stok TIDAK PERNAH di-UPDATE langsung untuk merekam mutasi fisik.
-- Setiap perubahan barang keluar (penjualan) atau masuk (pembelian) dicatat
-- sebagai baris baru yang abadi (immutable) untuk menjamin audit trail akuntansi.
-- =============================================================================
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty_delta BIGINT NOT NULL, -- Positif (+) barang masuk, Negatif (-) barang keluar
    reason VARCHAR(100) NOT NULL, -- 'sale', 'receipt', 'adjustment'
    ref_id VARCHAR(255), -- ID order referensi
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
    -- DILARANG ada updated_at (tabel immutable append-only)
);

CREATE INDEX idx_stock_movements_tenant_item ON public.stock_movements (tenant_id, item_id);

-- =============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- =============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. POLICIES
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders;
CREATE POLICY tenant_isolation_orders ON public.orders
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_order_lines ON public.order_lines;
CREATE POLICY tenant_isolation_order_lines ON public.order_lines
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_stock_levels ON public.stock_levels;
CREATE POLICY tenant_isolation_stock_levels ON public.stock_levels
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_stock_movements ON public.stock_movements;
CREATE POLICY tenant_isolation_stock_movements ON public.stock_movements
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 7. ROLE PERMISSIONS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
