-- =============================================================================
-- NEXUS CORE OS - MIGRATION 005: AI AGENT RUNS & DRAFT REFINEMENT (ZONA B)
-- File: packages/db-schema/005_ai_agent.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. PENYESUAIAN TABEL: ai_drafts & conversations
-- Menambahkan kolom kind dan conversation_id untuk pelacakan alur approval,
-- serta memperluas status conversation untuk mendukung 'ai_replied' dan 'human'.
-- =============================================================================
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_status_check 
    CHECK (status IN ('active', 'closed', 'archived', 'ai_replied', 'human'));

ALTER TABLE public.ai_drafts 
    ADD COLUMN IF NOT EXISTS kind VARCHAR(50) DEFAULT 'reply',
    ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_drafts_tenant_kind ON public.ai_drafts (tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_conversation ON public.ai_drafts (conversation_id);

-- =============================================================================
-- 2. TABEL: ai_runs (METADATA RUN & AUDIT OBSERVABILITY)
-- Menyimpan metrik eksekusi agent: token usage, status handoff, dan durasi.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'handoff')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_tenant_agent ON public.ai_runs (tenant_id, agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_runs_conversation ON public.ai_runs (conversation_id);

-- =============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- =============================================================================
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_runs ON public.ai_runs;
CREATE POLICY tenant_isolation_ai_runs ON public.ai_runs
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 4. ROLE PERMISSIONS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
