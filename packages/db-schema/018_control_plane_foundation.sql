-- =============================================================================
-- NEXUS CORE OS - MIGRATION 018: NEXUS CONTROL PLANE FOUNDATION
-- File: packages/db-schema/018_control_plane_foundation.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
--
-- Membangun fondasi database Control Plane untuk Super Admin SaaS dan AI Telegram Copilot:
-- 1. saas_tenants: Profil klien SaaS, tier paket (BASIC/PREMIUM), dan konfigurasi tema UI.
-- 2. support_tickets: Tiket komplain bug / permintaan fitur yang diajukan klien via Telegram.
-- 3. system_audit_logs: Log audit aktivitas internal Control Plane.
-- =============================================================================

-- Sequence untuk No Tiket Support Otomatis (Format: TCK-1001, TCK-1002, ...)
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START WITH 1001;

-- 1. TABEL: saas_tenants (Profil Klien SaaS)
CREATE TABLE IF NOT EXISTS public.saas_tenants (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('BASIC', 'PREMIUM')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    ui_theme_config JSONB NOT NULL DEFAULT '{"primary_color": "#9333ea", "dark_mode": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABEL: support_tickets (Tiket Komplain & Fitur Klien)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL DEFAULT ('TCK-' || nextval('support_ticket_seq')::text),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('BUG', 'FEATURE_REQUEST', 'GENERAL')),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    source VARCHAR(50) NOT NULL DEFAULT 'TELEGRAM',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks Pencarian Tiket
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON public.support_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC);

-- 3. TABEL: system_audit_logs (Audit Trail Internal Control Plane)
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_tenant ON public.system_audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action ON public.system_audit_logs (action);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - DUAL IDENTITAS (SUPER ADMIN vs TENANT KLIEN)
-- Super Admin (tenant_id 00000000-0000-0000-0000-000000000000 atau app.is_super_admin)
-- bisa membaca & mengelola semua data tiket. Klien biasa hanya bisa melihat miliknya.
-- =============================================================================

ALTER TABLE public.saas_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Policy saas_tenants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'saas_tenants' AND policyname = 'control_plane_saas_tenants_policy'
    ) THEN
        CREATE POLICY control_plane_saas_tenants_policy ON public.saas_tenants
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;

    -- Policy support_tickets
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'control_plane_support_tickets_policy'
    ) THEN
        CREATE POLICY control_plane_support_tickets_policy ON public.support_tickets
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;

    -- Policy system_audit_logs
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'system_audit_logs' AND policyname = 'control_plane_audit_logs_policy'
    ) THEN
        CREATE POLICY control_plane_audit_logs_policy ON public.system_audit_logs
            FOR ALL
            USING (
                NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
                OR NULLIF(current_setting('app.tenant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;
END $$;

-- =============================================================================
-- SEED DATA MINIMAL: Tenant Klien Demo & Sample Support Tickets
-- =============================================================================
INSERT INTO public.saas_tenants (tenant_id, business_name, plan_type, status, ui_theme_config)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Nexus HP Store (Demo Toko HP)',
    'PREMIUM',
    'ACTIVE',
    '{"primary_color": "#9333ea", "dark_mode": true, "telegram_alerts": true}'::jsonb
)
ON CONFLICT (tenant_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status;

INSERT INTO public.support_tickets (id, ticket_number, tenant_id, category, subject, description, status, source)
VALUES 
    (
        'b1c2d3e4-0001-4000-8000-000000000001',
        'TCK-1001',
        '11111111-1111-1111-1111-111111111111',
        'BUG',
        'Split Payment POS Offline Sync',
        'Transaksi split payment saat offline sempat pending di outbox browser, mohon dicek log sinkronisasinya.',
        'IN_PROGRESS',
        'TELEGRAM'
    ),
    (
        'b1c2d3e4-0002-4000-8000-000000000002',
        'TCK-1002',
        '11111111-1111-1111-1111-111111111111',
        'FEATURE_REQUEST',
        'Fitur Cetak Barcode Thermal Label 58mm',
        'Tolong tambahkan fitur cetak barcode label thermal 58mm langsung dari katalog inventori.',
        'OPEN',
        'TELEGRAM'
    )
ON CONFLICT (ticket_number) DO NOTHING;
