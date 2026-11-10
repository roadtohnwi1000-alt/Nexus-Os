-- =============================================================================
-- NEXUS CORE OS - MIGRATION 016: IDEMPOTENCY KEYS (ANTI-FRAGILE OFFLINE SYNC)
-- File: packages/db-schema/016_idempotency_keys.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS', -- 'PROCESSING', 'SUCCESS', 'FAILED'
    resource_id UUID,
    response_code INT NOT NULL DEFAULT 201,
    response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant 
ON public.idempotency_keys (tenant_id, idempotency_key);

-- Aktifkan Row-Level Security
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'idempotency_keys' AND policyname = 'tenant_isolation_idempotency_keys'
    ) THEN
        CREATE POLICY tenant_isolation_idempotency_keys ON public.idempotency_keys
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;
END $$;
