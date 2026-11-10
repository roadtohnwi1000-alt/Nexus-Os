-- ==============================================================================
-- NEXUS CORE OS - MIGRATION 026: MULTI-CHANNEL PUBLISHING & CLOSED-LOOP ATTRIBUTION (DOMAIN C / CLOSING THE LOOP)
-- File: packages/db-schema/026_publishing_and_attribution.sql
-- ==============================================================================

-- 1. Tabel Kanal Publikasi Terhubung (Connected Publishing Channels)
CREATE TABLE IF NOT EXISTS public.publication_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'YOUTUBE_SHORTS', 'TIKTOK', 'INSTAGRAM_REELS'
    channel_name VARCHAR(150) NOT NULL,
    channel_handle VARCHAR(100) NOT NULL,
    external_channel_id VARCHAR(150),
    credentials_encrypted TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    daily_post_limit INTEGER DEFAULT 5,
    posts_today INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Item Konten Terpublikasi (Published Content Items & Schedule)
CREATE TABLE IF NOT EXISTS public.published_content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    video_job_id UUID REFERENCES public.video_production_jobs(id) ON DELETE SET NULL,
    opportunity_code VARCHAR(100),
    channel_id UUID REFERENCES public.publication_channels(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    external_post_id VARCHAR(150),
    post_url TEXT,
    status VARCHAR(50) DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'DRAFT_READY', 'FAILED'
    caption TEXT NOT NULL,
    hashtags JSONB DEFAULT '[]'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Pelacak Tautan Atribusi (Attribution Links / Closed-Loop Tracker)
CREATE TABLE IF NOT EXISTS public.attribution_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    publication_id UUID REFERENCES public.published_content_items(id) ON DELETE SET NULL,
    opportunity_code VARCHAR(100) NOT NULL,
    short_code VARCHAR(50) NOT NULL UNIQUE, -- e.g. "gan65w", "magsafe10k"
    destination_url TEXT NOT NULL,
    campaign_tag VARCHAR(100) DEFAULT 'nexus_ai_shorts',
    total_clicks BIGINT DEFAULT 0,
    unique_visitors BIGINT DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    attributed_gmv_idr NUMERIC(15, 2) DEFAULT 0.00,
    attributed_commission_idr NUMERIC(15, 2) DEFAULT 0.00,
    conversion_rate_pct NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Audit Klik Atribusi (Click Stream Events)
CREATE TABLE IF NOT EXISTS public.attribution_click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    link_id UUID REFERENCES public.attribution_links(id) ON DELETE CASCADE,
    short_code VARCHAR(50) NOT NULL,
    user_agent TEXT,
    device_type VARCHAR(50) DEFAULT 'MOBILE', -- 'MOBILE', 'DESKTOP', 'TABLET'
    referrer TEXT,
    ip_hash VARCHAR(64),
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Kalibrasi Bobot Algoritma Tertutup (Closed-Loop Calibration Logs)
CREATE TABLE IF NOT EXISTS public.closed_loop_calibration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_code VARCHAR(100) NOT NULL,
    views_48h BIGINT DEFAULT 0,
    clicks_48h BIGINT DEFAULT 0,
    ctr_pct NUMERIC(5, 2) DEFAULT 0.00,
    orders_count INTEGER DEFAULT 0,
    attributed_revenue_idr NUMERIC(15, 2) DEFAULT 0.00,
    old_velocity_weight NUMERIC(4, 2) DEFAULT 0.50,
    new_velocity_weight NUMERIC(4, 2) DEFAULT 0.55,
    calibration_reason TEXT NOT NULL,
    calibrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_pub_channels_tenant ON public.publication_channels (tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_pub_items_tenant ON public.published_content_items (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_attr_links_short ON public.attribution_links (short_code);
CREATE INDEX IF NOT EXISTS idx_attr_links_tenant ON public.attribution_links (tenant_id, opportunity_code);
CREATE INDEX IF NOT EXISTS idx_attr_clicks_link ON public.attribution_click_events (link_id);

-- RLS (Row-Level Security)
ALTER TABLE public.publication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_loop_calibration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_publication_channels_isolation ON public.publication_channels
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_published_content_items_isolation ON public.published_content_items
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_attribution_links_isolation ON public.attribution_links
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_attribution_click_events_isolation ON public.attribution_click_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY p_closed_loop_calibration_logs_isolation ON public.closed_loop_calibration_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
