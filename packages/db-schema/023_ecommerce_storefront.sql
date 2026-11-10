-- =============================================================================
-- NEXUS CORE OS - MIGRATION 023: E-COMMERCE MIGRATION & STOREFRONT SETTINGS
-- File: packages/db-schema/023_ecommerce_storefront.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- 1. TABEL: tenant_storefront_settings
-- Menyimpan konfigurasi etalase toko online instan milik tenant
CREATE TABLE IF NOT EXISTS public.tenant_storefront_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    store_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    whatsapp_number TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    address TEXT,
    banner_url TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_storefront_tenant ON public.tenant_storefront_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_storefront_slug ON public.tenant_storefront_settings (slug);

-- 2. ROW-LEVEL SECURITY
ALTER TABLE public.tenant_storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_storefront_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_storefront ON public.tenant_storefront_settings;
CREATE POLICY tenant_isolation_storefront ON public.tenant_storefront_settings
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS public_read_active_storefront ON public.tenant_storefront_settings;
CREATE POLICY public_read_active_storefront ON public.tenant_storefront_settings
    FOR SELECT
    USING (is_active = true);
