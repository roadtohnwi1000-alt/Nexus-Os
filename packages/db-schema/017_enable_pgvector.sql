-- =============================================================================
-- NEXUS CORE OS - MIGRATION 017: PGVECTOR EXTENSION & KNOWLEDGE BASE
-- File: packages/db-schema/017_enable_pgvector.sql
-- Engine: PostgreSQL (Supabase Cloud compatible with pgvector)
-- =============================================================================

-- 1. Aktifkan Ekstensi pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Buat Tabel Knowledge Base untuk WhatsApp RAG Smartbot
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('FAQ', 'STOCK_RULES', 'SERVICE_GUIDE')),
    content TEXT NOT NULL,
    embedding vector(1536), -- Format vector OpenAI text-embedding-ada-002 / text-embedding-3-small
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks untuk pencarian cepat berbasis tenant & kategori
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON public.knowledge_base (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base (tenant_id, category);

-- 3. Row Level Security (RLS) - Isolasi Tenant Terjamin
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'knowledge_base' AND policyname = 'tenant_isolation_knowledge_base'
    ) THEN
        CREATE POLICY tenant_isolation_knowledge_base ON public.knowledge_base
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            );
    END IF;
END $$;

-- 4. SEED DATA MINIMAL (2 baris testing fungsionalitas)
INSERT INTO public.knowledge_base (id, tenant_id, category, content)
VALUES 
    (
        'a1b2c3d4-0001-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'SERVICE_GUIDE',
        'Garansi servis layar adalah 30 hari. Tidak berlaku untuk kerusakan fisik baru atau terkena air.'
    ),
    (
        'a1b2c3d4-0002-4000-8000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'FAQ',
        'Jam operasional toko adalah Senin-Sabtu 10.00 - 21.00 WIB.'
    )
ON CONFLICT (id) DO NOTHING;
