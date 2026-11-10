-- =============================================================================
-- NEXUS CORE OS - MIGRATION 021: MULTI-STAFF RBAC & FREEMIUM PAYWALL GATING
-- File: packages/db-schema/021_team_rbac_and_paywall.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
--
-- Menambahkan tabel manajemen staf internal (RBAC) dan kolom paket langganan:
-- 1. tenant_staff_members: Mendaftarkan staf toko oleh Owner (Kasir, Teknisi, Gudang)
--    dengan hak akses granular (sembunyikan HPP, sembunyikan laba, kunci harga jual).
-- 2. Menambahkan kolom plan_tier dan subscription metadata ke public.tenants.
-- =============================================================================

-- 1. Tambah kolom plan_tier ke public.tenants jika belum ada
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'plan_tier'
    ) THEN
        ALTER TABLE public.tenants ADD COLUMN plan_tier VARCHAR(50) NOT NULL DEFAULT 'STARTER';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'max_staff_limit'
    ) THEN
        ALTER TABLE public.tenants ADD COLUMN max_staff_limit INT NOT NULL DEFAULT 3;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'business_preset'
    ) THEN
        ALTER TABLE public.tenants ADD COLUMN business_preset VARCHAR(50) NOT NULL DEFAULT 'RETAIL';
    END IF;
END $$;

-- 2. TABEL: tenant_staff_members (Akun Staf Internal Toko)
CREATE TABLE IF NOT EXISTS public.tenant_staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'CASHIER' CHECK (role IN ('OWNER', 'CASHIER', 'TECHNICIAN', 'WAREHOUSE', 'CUSTOM')),
    pin_code VARCHAR(100) NOT NULL, -- 4 to 6 digit quick login PIN
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Granular Permissions Checklist
    permissions JSONB NOT NULL DEFAULT '{
        "can_access_pos": true,
        "can_view_cost_price": false,
        "can_view_profit_margin": false,
        "can_edit_selling_price": false,
        "can_give_discount": false,
        "can_manage_inventory": false,
        "can_access_crm": false,
        "can_access_repair": false,
        "can_access_settings": false
    }'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(tenant_id, username)
);

-- Indeks Performa
CREATE INDEX IF NOT EXISTS idx_tenant_staff_tenant_id ON public.tenant_staff_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_staff_role ON public.tenant_staff_members(tenant_id, role);

-- Enable RLS
ALTER TABLE public.tenant_staff_members ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Tenant isolation for staff members"
    ON public.tenant_staff_members
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
