-- =============================================================================
-- NEXUS CORE OS - MIGRATION 014: ADD MARKETPLACE SKU FOR TIKTOK SHOP & E-COMMERCE SYNC
-- File: packages/db-schema/014_add_marketplace_sku.sql
-- Engine: PostgreSQL (Supabase Cloud compatible)
-- =============================================================================

-- =============================================================================
-- 1. MODIFIKASI TABEL: items (MARKETPLACE SKU MAPPING)
-- 
-- 🧠 CATATAN ARSITEKTUR INTEGRASI TIKTOK SHOP / MARKETPLACE:
-- Pada sistem legacy (KetoKo / Accurate), SKU internal seringkali berbeda dengan
-- SKU listing di TikTok Shop (misal: internal "LCD-IP11-BLK" vs TikTok "TTS-IP11-SCREEN-01").
-- Kolom `marketplace_sku` memungkinkan sinkronisasi pesanan dan webhook stok otomatis
-- tanpa mengubah struktur SKU internal toko.
-- =============================================================================

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS marketplace_sku VARCHAR(100);

-- Index komposit untuk query super cepat saat webhook pesanan masuk dari TikTok Shop
CREATE INDEX IF NOT EXISTS idx_items_tenant_marketplace_sku 
ON public.items (tenant_id, marketplace_sku);

-- Tambahkan komentar dokumentasi kolom
COMMENT ON COLUMN public.items.marketplace_sku IS 'SKU khusus listing di marketplace (TikTok Shop, Shopee) untuk sinkronisasi webhook otomatis';
