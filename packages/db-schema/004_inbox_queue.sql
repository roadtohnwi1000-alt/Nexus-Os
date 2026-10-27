-- =============================================================================
-- NEXUS CORE OS - MIGRATION 004: WHATSAPP INBOX & ASYNC QUEUE SYSTEM
-- File: packages/db-schema/004_inbox_queue.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. TABEL: conversations (SESI PERCAKAPAN OMNICHANNEL)
-- Menyimpan sesi percakapan dengan kontak via channel tertentu (WhatsApp, Email, dll).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'email', 'telegram', 'webchat')),
    channel_identifier VARCHAR(100) NOT NULL, -- Nomor WhatsApp pengirim (misal: '+6281234567890')
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived', 'ai_replied', 'human')),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_conversation_channel UNIQUE (tenant_id, channel, channel_identifier)
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status ON public.conversations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations (tenant_id, last_message_at DESC);

-- =============================================================================
-- 2. TABEL: messages (HISTORI PESAN CHAT)
-- Menyimpan pesan masuk (inbound) dari pelanggan atau keluar (outbound) dari agen/AI.
-- external_id: ID pesan dari penyedia WhatsApp (Meta WAMID) untuk garansi Idempotency.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
    external_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_messages_tenant_external_id UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (tenant_id, conversation_id, created_at ASC);

-- =============================================================================
-- 3. TABEL: inbound_events (AUDIT LOG WEBHOOK & FAST INGESTION)
-- Menerima raw payload webhook segera (<1 detik) sebelum diteruskan ke background worker.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inbound_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'whatsapp.message'
    external_id VARCHAR(255) NOT NULL, -- ID pesan unik dari webhook provider
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_inbound_events_tenant_external UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_events_tenant_processed ON public.inbound_events (tenant_id, processed);

-- =============================================================================
-- 4. TABEL: jobs (PERSISTENT JOB QUEUE / AUDIT ARQ WORKER)
-- Mencatat state antrean task asynchronous untuk pemantauan dan fault tolerance.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL, -- 'process_inbound_message', 'generate_ai_reply'
    status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON public.jobs (tenant_id, status);

-- =============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- =============================================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. POLICIES
-- =============================================================================
DROP POLICY IF EXISTS tenant_isolation_conversations ON public.conversations;
CREATE POLICY tenant_isolation_conversations ON public.conversations
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_messages ON public.messages;
CREATE POLICY tenant_isolation_messages ON public.messages
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_inbound_events ON public.inbound_events;
CREATE POLICY tenant_isolation_inbound_events ON public.inbound_events
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation_jobs ON public.jobs;
CREATE POLICY tenant_isolation_jobs ON public.jobs
    FOR ALL
    USING (tenant_id = app.tenant_id())
    WITH CHECK (tenant_id = app.tenant_id());

-- =============================================================================
-- 7. ROLE PERMISSIONS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
