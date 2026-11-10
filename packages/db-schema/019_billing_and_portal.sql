-- =============================================================================
-- NEXUS CORE OS - MIGRATION 019: BILLING TRACKER & CLIENT PORTAL
-- File: packages/db-schema/019_billing_and_portal.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
--
-- Menambahkan tabel penagihan autonomous agent dan chat riwayat Client Portal:
-- 1. billing_records: Mencatat konsumsi token, durasi kerja agent, skor kompleksitas,
--    dan status penagihan (PENDING_BILLING, BILLED, PAID) per tenant.
-- 2. portal_messages: Riwayat komunikasi helpdesk resmi antara klien dan AI di Web Portal.
-- =============================================================================

-- 1. TABEL: billing_records (Pencatatan Biaya AI Agent & Custom Engineering)
CREATE TABLE IF NOT EXISTS public.billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('FEATURE_REQUEST', 'BUG_FIX', 'AUTO_DEPLOY')),
    description TEXT NOT NULL,
    agent_duration_seconds INT NOT NULL DEFAULT 0,
    ai_token_cost INT NOT NULL DEFAULT 0,
    complexity_score NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_BILLING' CHECK (status IN ('PENDING_BILLING', 'BILLED', 'PAID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks Penagihan
CREATE INDEX IF NOT EXISTS idx_billing_records_tenant ON public.billing_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_task_type ON public.billing_records (task_type);
CREATE INDEX IF NOT EXISTS idx_billing_records_status ON public.billing_records (status);
CREATE INDEX IF NOT EXISTS idx_billing_records_created_at ON public.billing_records (created_at DESC);


-- 2. TABEL: portal_messages (Pesan Chat Resmi Client Portal)
CREATE TABLE IF NOT EXISTS public.portal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('CLIENT', 'AI')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks Portal Messages
CREATE INDEX IF NOT EXISTS idx_portal_messages_tenant ON public.portal_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_messages_created_at ON public.portal_messages (created_at ASC);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - STRICT MULTI-TENANT ISOLATION
-- Super Admin (tenant 00000000-0000-0000-0000-000000000000 atau app.is_super_admin)
-- dapat mengakses seluruh catatan penagihan dan portal.
-- Klien hanya dapat mengakses rekaman billing dan pesan portal milik tenant-nya sendiri.
-- =============================================================================

ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Policy billing_records
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'billing_records' AND policyname = 'control_plane_billing_records_policy'
    ) THEN
        CREATE POLICY control_plane_billing_records_policy ON public.billing_records
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

    -- Policy portal_messages
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'portal_messages' AND policyname = 'control_plane_portal_messages_policy'
    ) THEN
        CREATE POLICY control_plane_portal_messages_policy ON public.portal_messages
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
END $$;


-- =============================================================================
-- SEED DATA MINIMAL: Demo Billing & Portal Chat History (2-3 entri realistis)
-- =============================================================================

INSERT INTO public.billing_records (
    id, tenant_id, task_id, task_type, description, 
    agent_duration_seconds, ai_token_cost, complexity_score, status, created_at
)
VALUES 
    (
        'c1d2e3f4-0001-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'c1d2e3f4-0001-4000-8000-000000000011',
        'BUG_FIX',
        'Auto-Patch Split Payment Null Array Handler di Pos Sync Engine',
        4,
        342,
        0.65,
        'BILLED',
        timezone('utc'::text, now()) - interval '2 days'
    ),
    (
        'c1d2e3f4-0002-4000-8000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'c1d2e3f4-0002-4000-8000-000000000022',
        'FEATURE_REQUEST',
        'Implementasi RFM Customer Modeling & Intelligence Dashboard',
        7,
        920,
        0.85,
        'PENDING_BILLING',
        timezone('utc'::text, now()) - interval '3 hours'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.portal_messages (
    id, tenant_id, sender, message, created_at
)
VALUES
    (
        'd1e2f3a4-0001-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'AI',
        'Halo! Selamat datang di Nexus Client Portal. Ada kendala operasional atau usulan fitur yang bisa kami bantu hari ini?',
        timezone('utc'::text, now()) - interval '4 hours'
    ),
    (
        'd1e2f3a4-0002-4000-8000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'CLIENT',
        'Saya mau tanya cara cetak nota servis thermal yang baru ya?',
        timezone('utc'::text, now()) - interval '3 hours 55 minutes'
    ),
    (
        'd1e2f3a4-0003-4000-8000-000000000003',
        '11111111-1111-1111-1111-111111111111',
        'AI',
        'Bisa melalui menu Repair Service > klik nomor tiket servis > pilih ikon printer Nota Thermal 58mm/80mm di pojok kanan atas.',
        timezone('utc'::text, now()) - interval '3 hours 54 minutes'
    )
ON CONFLICT (id) DO NOTHING;
