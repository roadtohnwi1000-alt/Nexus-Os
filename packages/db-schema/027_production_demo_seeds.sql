-- =============================================================================
-- NEXUS CORE OS - MIGRATION 027: PRODUCTION & STAGING DEMO SEED DATA
-- File: packages/db-schema/027_production_demo_seeds.sql
-- Engine: PostgreSQL 16 (pgvector enabled)
-- =============================================================================

-- 1. SEED TENANTS
INSERT INTO public.tenants (id, name, slug, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'NEXUS Gadget Official Store', 'nexus-gadget-official', true),
    ('22222222-2222-2222-2222-222222222222', 'iFix Phone Repair & Service', 'ifix-phone-repair', true)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    is_active = EXCLUDED.is_active;

-- 2. SEED CATALOG ITEMS (Universal Catalog: Stocked Products & Services)
INSERT INTO public.items (id, tenant_id, sku, name, item_type, base_price, attributes, active)
VALUES
    -- Tenant 1: Gadget Store
    ('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'TG-PRIVACY-9D', 'Tempered Glass Privacy Anti-Spy 9D Auto Dust Removal', 'stocked', 35000, '{"category": "Aksesoris Ponsel", "brand": "NEXUS Armor", "stock": 45, "hpp": 12000}'::jsonb, true),
    ('a0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'CHG-GAN-65W', 'Anker GaN 65W Fast Charger Ultra Compact', 'stocked', 249000, '{"category": "Power & Charging", "brand": "Anker", "stock": 28, "hpp": 165000}'::jsonb, true),
    ('a0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'TWS-ANC-PRO', 'TWS Earbuds Active Noise Cancelling 40dB', 'stocked', 299000, '{"category": "Audio", "brand": "SoundWave", "stock": 19, "hpp": 175000}'::jsonb, true),
    ('a0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'MIC-WL-DUAL', 'Wireless Lavalier Microphone Noise Cancelling Type-C & Lightning', 'stocked', 145000, '{"category": "Creator Gear", "brand": "VoicePro", "stock": 34, "hpp": 78000}'::jsonb, true),
    -- Tenant 2: Repair Shop
    ('a0000002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'SRV-LCD-IP13', 'Jasa Ganti LCD iPhone 13 Original OEM', 'service', 850000, '{"warranty_days": 90, "estimated_hours": 2}'::jsonb, true),
    ('a0000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'SRV-BAT-S22', 'Jasa Ganti Baterai Samsung Galaxy S22 High Capacity', 'service', 450000, '{"warranty_days": 60, "estimated_hours": 1}'::jsonb, true)
ON CONFLICT (tenant_id, sku) DO NOTHING;

-- 3. SEED CONTACTS (CRM)
INSERT INTO public.contacts (id, tenant_id, display_name, kind, attributes)
VALUES
    ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Budi Santoso', 'person', '{"phone": "081234567890", "loyalty_tier": "GOLD", "email": "budi@gmail.com"}'::jsonb),
    ('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Siti Rahmawati', 'person', '{"phone": "085712345678", "loyalty_tier": "SILVER", "email": "siti@gmail.com"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED SAMPLE ORDERS
INSERT INTO public.orders (id, tenant_id, contact_id, status, total_minor, idempotency_key)
VALUES
    ('d0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'confirmed', 284000, 'seed_order_001'),
    ('d0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000002', 'confirmed', 35000, 'seed_order_002')
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

-- 5. SEED ORDER LINES
INSERT INTO public.order_lines (id, tenant_id, order_id, item_id, sku_snapshot, name_snapshot, qty, unit_price_minor)
VALUES
    ('e0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'd0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'TG-PRIVACY-9D', 'Tempered Glass Privacy Anti-Spy 9D Auto Dust Removal', 1, 35000),
    ('e0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'd0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', 'CHG-GAN-65W', 'Anker GaN 65W Fast Charger Ultra Compact', 1, 249000),
    ('e0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'd0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'TG-PRIVACY-9D', 'Tempered Glass Privacy Anti-Spy 9D Auto Dust Removal', 1, 35000)
ON CONFLICT (id) DO NOTHING;

-- 6. SEED PUBLISHING CHANNELS (Domain C)
INSERT INTO public.publication_channels (id, tenant_id, platform, channel_name, channel_handle, is_active, connected_account_id)
VALUES
    ('chan_yt_demo_01', '11111111-1111-1111-1111-111111111111', 'YOUTUBE_SHORTS', 'NEXUS Tech ID Official', '@nexustech_id', true, 'acc_yt_001'),
    ('chan_tt_demo_01', '11111111-1111-1111-1111-111111111111', 'TIKTOK', 'NEXUS Creator TikTok Shop', '@nexus_creator', true, 'acc_tt_001'),
    ('chan_ig_demo_01', '11111111-1111-1111-1111-111111111111', 'INSTAGRAM_REELS', 'NEXUS Official Store IG', '@nexus_official.id', true, 'acc_ig_001')
ON CONFLICT (id) DO NOTHING;

-- 7. SEED CLOSED LOOP INITIAL LOG
INSERT INTO public.closed_loop_calibration_logs (
    id, tenant_id, opportunity_code, product_name, views_48h, clicks_48h, 
    ctr_pct, orders_count, attributed_revenue_idr, attributed_commission_idr,
    old_weights, new_weights, winning_hook_angle, calibration_reason
)
VALUES (
    'calib_init_001',
    '11111111-1111-1111-1111-111111111111',
    'OPP-2611-001',
    'Tempered Glass Privacy Anti-Spy 9D Auto Dust Removal',
    18500,
    1443,
    7.80,
    61,
    15250000.00,
    1830000.00,
    '{"w_demand": 0.50, "w_margin": 0.30, "w_competition": 0.20}'::jsonb,
    '{"w_demand": 0.55, "w_margin": 0.30, "w_competition": 0.17}'::jsonb,
    'FOMO_AGITATION',
    'CTR (7.8%) & CVR (4.23%) sangat tinggi. W_demand dinaikkan ke 0.55 untuk memprioritaskan konversi instan.'
)
ON CONFLICT (id) DO NOTHING;
