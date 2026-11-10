"""
NEXUS CORE OS - E-COMMERCE CLONER & STOREFRONT TEST SUITE
File: apps/core-api/tests/test_ecommerce_cloner.py

Menguji:
1. Resolusi Kategori TikTok Shop (Category ID & Attributes)
2. Penulisan Ulang Judul SEO (AI Title Rewriter)
3. Kalkulasi Markup Biaya Admin Marketplace
4. Validasi Skema & Integrasi Router
"""

import pytest
from app.api.v1.ecommerce import (
    resolve_tiktok_category,
    rewrite_title_for_tiktok_seo,
    calculate_marketplace_markup,
    router as ecommerce_router,
    CloneAnalyzeRequest,
    ClonedProductInput,
    analyze_and_clone_products
)

def test_resolve_tiktok_category():
    """Menguji pemetaan kategori berdasarkan kata kunci produk."""
    cat1 = resolve_tiktok_category("LCD Touchscreen iPhone 11 Pro Fullset")
    assert cat1["category_id"] == "601243"
    assert "Sparepart" in cat1["category_name"]

    cat2 = resolve_tiktok_category("Casing Silikon Matte iPhone 13")
    assert cat2["category_id"] == "601244"

    cat3 = resolve_tiktok_category("Oli Mesin Motul 10W-40 1L")
    assert cat3["category_id"] == "702110"

    cat4 = resolve_tiktok_category("Barang Antik Langka")
    assert cat4["category_id"] == "600100"

def test_rewrite_title_for_tiktok_seo():
    """Menguji pembersihan kata spam dan pembuatan judul SEO TikTok Shop."""
    spammy_title = "LCD IPHONE 11 TERMURAH 100% ORIGINAL COPOTAN GILA DISKON 99%!!!"
    rewritten = rewrite_title_for_tiktok_seo(spammy_title, "Suku Cadang")

    # Pastikan kata spam dihapus
    assert "termurah" not in rewritten.lower()
    assert "diskon" not in rewritten.lower()
    assert "!!!" not in rewritten
    assert len(rewritten) <= 130
    assert "[High Quality]" in rewritten or "Garansi" in rewritten

def test_calculate_marketplace_markup():
    """
    Menguji formula kalkulasi penyesuaian harga jual saat migrasi.
    Harga Asal: Rp 100.000 (Shopee fee 8%)
    Fee TikTok Target: 10%
    Buffer Margin: 5%
    """
    res = calculate_marketplace_markup(
        source_price=100000,
        source_fee_pct=8.0,
        target_fee_pct=10.0,
        margin_buffer_pct=5.0
    )
    # 100.000 * 0.92 = 92.000
    # 92.000 * 1.05 = 96.600
    # 96.600 / 0.90 = 107.333 -> dibulatkan ke kelipatan 1.000 terdekat = 108.000
    assert res["target_price"] == 108000
    assert res["markup_nominal"] == 8000
    assert res["markup_pct"] == 8.0

def test_analyze_and_clone_products_endpoint():
    """Menguji eksekusi endpoint analyze_and_clone_products."""
    req = CloneAnalyzeRequest(
        source_platform="shopee",
        target_platform="tiktok_shop",
        source_fee_pct=8.0,
        target_fee_pct=10.0,
        margin_buffer_pct=5.0,
        products=[
            ClonedProductInput(
                name="LCD TOUCHSCREEN IPHONE 11 PRO MAX OEM TERMURAH",
                source_price=450000,
                category="Sparepart",
                stock=15
            )
        ]
    )
    response = analyze_and_clone_products(req)
    assert response.total_products == 1
    assert response.target_platform == "tiktok_shop"
    assert len(response.products) == 1

    item = response.products[0]
    assert item.tiktok_category_id == "601243"
    assert item.target_price > 450000
    assert len(item.bullets) == 4
    assert item.status == "ready_to_upload"
