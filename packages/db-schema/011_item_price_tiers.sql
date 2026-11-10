-- =============================================================================
-- NEXUS CORE OS - MIGRATION 011: ITEM PRICE TIERS & ORDER SPLIT PAYMENTS
-- File: packages/db-schema/011_item_price_tiers.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. MODIFIKASI TABEL: items (MULTI-TIERING HARGA HP RETAIL)
-- 
-- 🧠 CATATAN BISNIS HP RETAIL & GROSIR:
-- Dalam industri ponsel dan sparepart, terdapat 3 tingkatan harga utama:
-- 1. price_retail     : Harga jual ke konsumen umum (walk-in customer / default base_price).
-- 2. price_reseller   : Harga grosir untuk toko mitra/reseller (diskon volume).
-- 3. price_technician : Harga khusus untuk rekanan teknisi/bengkel servis HP luar.
-- Seluruh harga wajib disimpan dalam integer minor units (Rupiah penuh).
-- =============================================================================

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS price_retail BIGINT,
ADD COLUMN IF NOT EXISTS price_reseller BIGINT,
ADD COLUMN IF NOT EXISTS price_technician BIGINT;

-- Inisialisasi nilai awal: price_retail sama dengan base_price
UPDATE public.items 
SET price_retail = base_price 
WHERE price_retail IS NULL;

-- Default nilai reseller (~90% base_price) dan teknisi (~85% base_price) jika belum ada nilai khusus
UPDATE public.items 
SET price_reseller = CAST(base_price * 0.90 AS BIGINT)
WHERE price_reseller IS NULL;

UPDATE public.items 
SET price_technician = CAST(base_price * 0.85 AS BIGINT)
WHERE price_technician IS NULL;

-- =============================================================================
-- 2. TABEL: order_payments (SPLIT PAYMENT KASIR POS)
-- Mendukung pemisahan pembayaran pesanan menjadi multi-metode (CASH, QRIS, TRANSFER)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CASH', 'QRIS', 'TRANSFER')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_payments_tenant ON public.order_payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON public.order_payments (order_id);

-- Tambahkan kolom payments JSONB pada tabel orders sebagai cache audit transaksi cepat
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- =============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) FOR ORDER_PAYMENTS
-- =============================================================================
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_order_payments ON public.order_payments;
CREATE POLICY tenant_isolation_order_payments ON public.order_payments
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

GRANT ALL ON public.order_payments TO authenticated;

-- =============================================================================
-- 4. CHART OF ACCOUNTS (COA) PEMISAHAN REVENUE & HPP AKSESORIS
-- =============================================================================
INSERT INTO public.chart_of_accounts (id, tenant_id, code, name, type, is_active)
SELECT gen_random_uuid(), t.id, '4200', 'Pendapatan Penjualan Aksesoris', 'Revenue', true
FROM public.tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.chart_of_accounts (id, tenant_id, code, name, type, is_active)
SELECT gen_random_uuid(), t.id, '5100', 'HPP Aksesoris', 'COGS', true
FROM public.tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.chart_of_accounts (id, tenant_id, code, name, type, is_active)
SELECT gen_random_uuid(), t.id, '1210', 'Persediaan Aksesoris', 'Asset', true
FROM public.tenants t
ON CONFLICT (tenant_id, code) DO NOTHING;
