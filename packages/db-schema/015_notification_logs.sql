-- =============================================================================
-- NEXUS CORE OS - MIGRATION 015: NOTIFICATION LOGS (WHATSAPP & OMNICHANNEL MOCK)
-- File: packages/db-schema/015_notification_logs.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    template_name VARCHAR(100) DEFAULT 'general_notification',
    status VARCHAR(50) NOT NULL DEFAULT 'SIMULATED_SENT',
    channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant ON public.notification_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_phone ON public.notification_logs (tenant_id, phone);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notification_logs' AND policyname = 'tenant_isolation_notification_logs'
    ) THEN
        CREATE POLICY tenant_isolation_notification_logs ON public.notification_logs
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;
END $$;
