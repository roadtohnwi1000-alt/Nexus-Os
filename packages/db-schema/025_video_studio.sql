-- ==============================================================================
-- NEXUS CORE OS - MIGRATION 025: AI CREATIVE & REMOTION VIDEO STUDIO (DOMAIN B)
-- File: packages/db-schema/025_video_studio.sql
-- ==============================================================================

-- 1. Tabel Pekerjaan Perakitan Video Programatik (Video Production Jobs)
CREATE TABLE IF NOT EXISTS public.video_production_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_id UUID REFERENCES public.content_opportunities(id) ON DELETE SET NULL,
    opportunity_code VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    target_niche VARCHAR(100) DEFAULT 'tech_gadgets',
    format VARCHAR(50) DEFAULT 'SHORT_FORM_9_16', -- 'SHORT_FORM_9_16' (1080x1920), 'SQUARE_1_1', 'LANDSCAPE_16_9'
    status VARCHAR(50) DEFAULT 'QUEUED', -- 'QUEUED', 'SCRIPTING', 'SYNTHESIZING_AUDIO', 'COMPOSING_SCENES', 'READY_FOR_REVIEW', 'APPROVED', 'FAILED'
    selected_variant_id VARCHAR(50) DEFAULT 'variant_fomo',
    active_script JSONB DEFAULT '{}'::jsonb,
    voice_identity_id VARCHAR(100) DEFAULT 'id_id_female_natural', -- 'id_id_female_natural', 'id_id_male_deep', 'id_id_female_energetic'
    bgm_track_id VARCHAR(100) DEFAULT 'bgm_tech_pulse',
    bgm_volume NUMERIC(3, 2) DEFAULT 0.15,
    audio_track_url TEXT,
    subtitles_payload JSONB DEFAULT '[]'::jsonb, -- Array word-level timestamps untuk karaoke kinetic typography
    composition_props JSONB DEFAULT '{}'::jsonb, -- Data payload siap render untuk Remotion React Canvas
    rendered_video_url TEXT,
    thumbnail_url TEXT,
    compliance_score NUMERIC(5, 2) DEFAULT 98.50,
    compliance_notes JSONB DEFAULT '{"status": "PASSED", "rules_checked": ["anti_overclaim", "bpom_safety", "tiktok_ads_policy"]}'::jsonb,
    render_metrics JSONB DEFAULT '{"duration_sec": 60, "fps": 30, "resolution": "1080x1920", "render_time_ms": 3200, "cost_usd": 0.03}'::jsonb,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Multi-Varian Naskah Kreatif (3 Multi-Angle Script Variations)
CREATE TABLE IF NOT EXISTS public.video_script_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.video_production_jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    angle_type VARCHAR(50) NOT NULL, -- 'FOMO_AGITATION', 'EDUCATIONAL_REVIEW', 'BEFORE_AFTER_STORY'
    angle_label VARCHAR(100) NOT NULL,
    hook_text TEXT NOT NULL,
    target_pacing_wpm INTEGER DEFAULT 145,
    scenes JSONB NOT NULL, -- 4 scenes with exact timestamps (0-3s, 3-15s, 15-45s, 45-60s)
    compliance_status VARCHAR(30) DEFAULT 'PASSED',
    compliance_flags JSONB DEFAULT '[]'::jsonb,
    is_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Perpustakaan Aset Media Studio (Studio Media Assets & Presets)
CREATE TABLE IF NOT EXISTS public.studio_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    asset_type VARCHAR(50) NOT NULL, -- 'B_ROLL', 'PRODUCT_SHOT', 'BGM', 'VOICE_PRESET', 'OVERLAY_STICKER'
    name VARCHAR(255) NOT NULL,
    asset_url TEXT NOT NULL,
    duration_sec NUMERIC(6, 2),
    tags JSONB DEFAULT '[]'::jsonb,
    is_system_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing untuk kecepatan pencarian jobs dan filter status
CREATE INDEX IF NOT EXISTS idx_video_jobs_tenant ON public.video_production_jobs (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_opp_code ON public.video_production_jobs (tenant_id, opportunity_code);
CREATE INDEX IF NOT EXISTS idx_video_script_variants_job ON public.video_script_variants (job_id);
CREATE INDEX IF NOT EXISTS idx_studio_assets_tenant ON public.studio_media_assets (tenant_id, asset_type);

-- RLS (Row-Level Security)
ALTER TABLE public.video_production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_script_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_video_production_jobs_isolation ON public.video_production_jobs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_video_script_variants_isolation ON public.video_script_variants
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_studio_media_assets_isolation ON public.studio_media_assets
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR is_system_preset = TRUE);
