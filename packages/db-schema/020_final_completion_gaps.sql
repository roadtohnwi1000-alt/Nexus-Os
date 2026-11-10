-- =============================================================================
-- NEXUS CORE OS - MIGRATION 020: FINAL HP RETAIL COMPLETION GAPS
-- File: packages/db-schema/020_final_completion_gaps.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
--
-- Menutup celah terakhir modul retail HP:
-- 1. Goods Receipt Note (GRN) headers & lines
-- 2. Karantina / Defect Stock Location & Flags
-- 3. Shift Management & Blind Balancing
-- =============================================================================

-- 1. TABEL: goods_receipt_notes (Header Penerimaan Barang dari Supplier)
CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    grn_number VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL DEFAULT 'Supplier Utama',
    delivery_order_number VARCHAR(100), -- No. Surat Jalan Supplier
    location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    total_cost BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_grn_tenant ON public.goods_receipt_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_grn_number ON public.goods_receipt_notes (grn_number);

-- 2. TABEL: goods_receipt_items (Rincian Item GRN)
CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    grn_id UUID NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    qty BIGINT NOT NULL CHECK (qty > 0),
    purchase_price BIGINT NOT NULL CHECK (purchase_price >= 0),
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    old_base_price BIGINT NOT NULL DEFAULT 0,
    new_base_price BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON public.goods_receipt_items (grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_item ON public.goods_receipt_items (item_id);

-- 3. TABEL: cashier_shifts (Shift Management & Blind Balancing)
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cashier_id VARCHAR(100) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opening_cash BIGINT NOT NULL DEFAULT 0,
    closing_cash BIGINT,
    expected_cash BIGINT,
    variance BIGINT,
    notes TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON public.cashier_shifts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.cashier_shifts (tenant_id, status);

-- 4. Pastikan Lokasi 'Gudang Karantina / Defect' tersedia untuk setiap tenant
INSERT INTO public.locations (id, tenant_id, name, type, is_active, created_at)
VALUES 
    (
        'e1f2a3b4-0001-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Gudang Karantina / Defect',
        'warehouse',
        true,
        timezone('utc'::text, now())
    )
ON CONFLICT (id) DO NOTHING;

-- Row Level Security (RLS)
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goods_receipt_notes' AND policyname = 'grn_tenant_isolation'
    ) THEN
        CREATE POLICY grn_tenant_isolation ON public.goods_receipt_notes
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goods_receipt_items' AND policyname = 'grn_items_tenant_isolation'
    ) THEN
        CREATE POLICY grn_items_tenant_isolation ON public.goods_receipt_items
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cashier_shifts' AND policyname = 'shifts_tenant_isolation'
    ) THEN
        CREATE POLICY shifts_tenant_isolation ON public.cashier_shifts
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;
END $$;
