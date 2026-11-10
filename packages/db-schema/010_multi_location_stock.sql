-- =============================================================================
-- NEXUS CORE OS - MIGRATION 010: MULTI-LOCATION STOCK LEVELS & MOVEMENTS
-- File: packages/db-schema/010_multi_location_stock.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- 1. Tambahkan kolom location_id ke stock_levels jika belum ada
ALTER TABLE public.stock_levels 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;

-- 2. Sesuaikan unique constraint agar unik per (tenant_id, item_id, location_id)
ALTER TABLE public.stock_levels DROP CONSTRAINT IF EXISTS uq_stock_levels;
ALTER TABLE public.stock_levels DROP CONSTRAINT IF EXISTS uq_stock_levels_location;
ALTER TABLE public.stock_levels 
ADD CONSTRAINT uq_stock_levels_location UNIQUE (tenant_id, item_id, location_id);

CREATE INDEX IF NOT EXISTS idx_stock_levels_location ON public.stock_levels (tenant_id, location_id);

-- 3. Tambahkan kolom location_id ke stock_movements jika belum ada
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON public.stock_movements (tenant_id, location_id);
