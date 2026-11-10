-- ==============================================================================
-- NEXUS CORE OS - MIGRATION 024: MARKET INTELLIGENCE & TREND SCRAPER (DOMAIN A)
-- File: packages/db-schema/024_market_intelligence.sql
-- ==============================================================================

-- 1. Tabel Konfigurasi Keran Data Modular (Pluggable Data Sources)
CREATE TABLE IF NOT EXISTS public.tenant_market_data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_code VARCHAR(50) NOT NULL, -- 'tiktok_id', 'shopee_id', 'tokopedia_id', 'google_trends_id', 'custom_competitor'
    source_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb, -- e.g. {"region": "ID", "keywords": ["gadget", "sparepart", "audio"]}
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_tenant_source UNIQUE (tenant_id, source_code)
);

-- 2. Tabel Multi-Store & Akun Media Sosial Terhubung (Multi-Account Monitoring)
CREATE TABLE IF NOT EXISTS public.tenant_connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'tiktok_shop', 'shopee', 'instagram', 'youtube', 'meta_ads'
    account_label VARCHAR(100) NOT NULL, -- 'TikTok Affiliate 01', 'Shopee Cabang Roxy'
    account_id_or_username VARCHAR(100) NOT NULL,
    access_token_encrypted TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'NEEDS_REAUTH', 'DISCONNECTED'
    total_views_30d BIGINT DEFAULT 0,
    total_orders_30d INTEGER DEFAULT 0,
    total_gmv_30d NUMERIC(15, 2) DEFAULT 0.00,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Observasi Sinyal Tren Pasar Mentah (Raw Observations)
CREATE TABLE IF NOT EXISTS public.market_trend_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_code VARCHAR(50) NOT NULL,
    trend_keyword VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    velocity_score NUMERIC(5, 4) DEFAULT 0.0,
    engagement_score NUMERIC(5, 4) DEFAULT 0.0,
    estimated_price_idr NUMERIC(15, 2) DEFAULT 0.0,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Entitas Kanonikal Peluang Konten (Canonical ContentOpportunity)
CREATE TABLE IF NOT EXISTS public.content_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    niche_category VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) DEFAULT 'OWN_INVENTORY', -- 'OWN_INVENTORY' vs 'AFFILIATE_PARTNER'
    inventory_match JSONB DEFAULT '{}'::jsonb, -- {sku, stock_available, current_hpp, selling_price, profit_margin_pct}
    metrics JSONB DEFAULT '{}'::jsonb, -- {velocity_score, competition_saturation, overall_opportunity_score, demand_level}
    creative_brief JSONB DEFAULT '{}'::jsonb, -- {target_audience, pain_points, hook_angles, scenes, cta}
    ads_strategy JSONB DEFAULT '{}'::jsonb, -- Kapten Ads: {daily_budget_idr, target_roas, campaign_type, audience_interests, kill_switch_cpr}
    sosmed_strategy JSONB DEFAULT '{}'::jsonb, -- Sosmed Specialist: {prime_time_wib, sound_recommendation, tone_of_voice, engagement_comment_prompt}
    status VARCHAR(50) DEFAULT 'DISCOVERED', -- 'DISCOVERED', 'READY_FOR_PRODUCTION', 'IN_STUDIO', 'PUBLISHED', 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_tenant_opp_code UNIQUE (tenant_id, opportunity_code)
);

-- 5. Tabel Fondasi Umpan Balik Metrik (Closed-Loop Attribution Foundation)
CREATE TABLE IF NOT EXISTS public.opportunity_performance_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    opportunity_id UUID REFERENCES public.content_opportunities(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    views_count BIGINT DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    attributed_revenue NUMERIC(15, 2) DEFAULT 0.00,
    actual_ad_spend NUMERIC(15, 2) DEFAULT 0.00,
    actual_roas NUMERIC(6, 2) DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes untuk akselerasi query multi-tenant
CREATE INDEX IF NOT EXISTS idx_opp_tenant_status ON public.content_opportunities(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON public.tenant_connected_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obs_tenant_source ON public.market_trend_observations(tenant_id, source_code);
