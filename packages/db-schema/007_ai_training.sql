-- =============================================================================
-- NEXUS CORE OS - MIGRATION 007: AI TRAINING & EXPERT KNOWLEDGE (HYBRID RAG)
-- File: packages/db-schema/007_ai_training.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. TABEL: ai_guidelines (ATURAN BISNIS & TONE OF VOICE)
-- Menyimpan instruksi operasional, batasan etika/keamanan, dan panduan gaya bicara
-- yang dikonfigurasi langsung oleh pemilik tenant untuk mengarahkan agent.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_guidelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('tone_of_voice', 'escalation_rules', 'consultation_flow', 'safety_rules')),
    instruction TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_guidelines_tenant_category ON public.ai_guidelines (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_ai_guidelines_tenant_active ON public.ai_guidelines (tenant_id, is_active);

-- =============================================================================
-- 2. TABEL: expert_knowledge (BASIS PENGETAHUAN AHLI & TROUBLESHOOTING)
-- Menyimpan basis pengetahuan spesifik domain (aftersales, troubleshooting,
-- panduan diagnosa, konsultasi perawatan) yang diinput oleh klien.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.expert_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expert_knowledge_tenant_topic ON public.expert_knowledge (tenant_id, topic);
CREATE INDEX IF NOT EXISTS idx_expert_knowledge_tenant_active ON public.expert_knowledge (tenant_id, is_active);

-- =============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- =============================================================================
ALTER TABLE public.ai_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guidelines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_guidelines ON public.ai_guidelines;
CREATE POLICY tenant_isolation_ai_guidelines ON public.ai_guidelines
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

ALTER TABLE public.expert_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_knowledge FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_expert_knowledge ON public.expert_knowledge;
CREATE POLICY tenant_isolation_expert_knowledge ON public.expert_knowledge
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 4. ROLE PERMISSIONS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
