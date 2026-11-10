"""
NEXUS CORE OS - MARKET INTELLIGENCE SERVICE LAYER
File: apps/core-api/app/services/market_intelligence/service.py

Menyediakan logika bisnis terpadu untuk:
1. Menjalankan LangGraph scan tren pasar
2. Mengelola cache dan persistensi data peluang konten
3. Mengelola multi-store & connected social media accounts
4. Menyediakan Market Context Brief untuk C-Suite Advisory (/advisory)
"""

import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.market_intelligence.intelligence_graph import (
    MARKET_INTELLIGENCE_GRAPH,
    MarketIntelligenceState
)

# In-memory store untuk akselerasi dan isolasi multi-tenant bila DB belum ter-migrate
TENANT_OPPORTUNITIES_CACHE: Dict[str, List[Dict[str, Any]]] = {}
TENANT_CONNECTED_ACCOUNTS_CACHE: Dict[str, List[Dict[str, Any]]] = {}


def run_market_intelligence_scan(
    tenant_id: str,
    active_sources: Optional[List[str]] = None,
    configs: Optional[Dict[str, Any]] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Menjalankan alur kerja LangGraph StateGraph untuk mendeteksi tren pasar lokal Indonesia.
    """
    initial_state: MarketIntelligenceState = {
        "tenant_id": tenant_id,
        "active_sources": active_sources or ["tiktok_id", "marketplace_id", "google_trends_id"],
        "scan_configs": configs or {},
        "raw_trend_items": [],
        "deduplicated_entities": [],
        "matched_inventory_items": [],
        "scored_opportunities": [],
        "ads_strategies": {},
        "sosmed_strategies": {},
        "final_content_opportunities": [],
        "execution_logs": [],
        "errors": []
    }

    # Eksekusi StateGraph otonom (synchronous & deterministic invoke)
    result_state = MARKET_INTELLIGENCE_GRAPH.invoke(initial_state)
    
    final_opps = result_state.get("final_content_opportunities", [])
    
    # Simpan ke cache tenant
    TENANT_OPPORTUNITIES_CACHE[tenant_id] = final_opps

    return {
        "tenant_id": tenant_id,
        "total_opportunities_found": len(final_opps),
        "opportunities": final_opps,
        "execution_logs": result_state.get("execution_logs", []),
        "errors": result_state.get("errors", [])
    }


def get_tenant_opportunities(
    tenant_id: str,
    niche: Optional[str] = None,
    min_score: Optional[float] = None,
    source_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Mengambil daftar peluang konten yang tersimpan untuk tenant tertentu dengan filter.
    """
    if tenant_id not in TENANT_OPPORTUNITIES_CACHE:
        run_market_intelligence_scan(tenant_id)

    opps = TENANT_OPPORTUNITIES_CACHE.get(tenant_id, [])

    filtered = opps
    if niche and niche != "ALL":
        filtered = [o for o in filtered if o.get("niche_category", "").lower() == niche.lower()]
    if min_score is not None:
        filtered = [o for o in filtered if o.get("metrics", {}).get("overall_opportunity_score", 0.0) >= min_score]
    if source_type and source_type != "ALL":
        filtered = [o for o in filtered if o.get("source_type", "").upper() == source_type.upper()]

    return filtered


def get_opportunity_by_code(tenant_id: str, opportunity_code: str) -> Optional[Dict[str, Any]]:
    """
    Mengambil 1 peluang konten spesifik berdasarkan opportunity_code.
    """
    opps = get_tenant_opportunities(tenant_id)
    for o in opps:
        if o.get("opportunity_code") == opportunity_code:
            return o
    return None


def update_opportunity_status(tenant_id: str, opportunity_code: str, new_status: str) -> Optional[Dict[str, Any]]:
    """
    Memperbarui status peluang (misal: 'APPROVED_FOR_STUDIO', 'REJECTED', 'IN_STUDIO').
    """
    opps = get_tenant_opportunities(tenant_id)
    for o in opps:
        if o.get("opportunity_code") == opportunity_code:
            o["status"] = new_status
            return o
    return None


# ==============================================================================
# MULTI-STORE & CONNECTED ACCOUNTS MANAGEMENT
# ==============================================================================
def get_tenant_connected_accounts(tenant_id: str) -> List[Dict[str, Any]]:
    """
    Mengambil daftar akun media sosial dan toko e-commerce yang terhubung.
    """
    if tenant_id not in TENANT_CONNECTED_ACCOUNTS_CACHE:
        # Default mock realistis untuk toko modern
        TENANT_CONNECTED_ACCOUNTS_CACHE[tenant_id] = [
            {
                "id": str(uuid.uuid4()),
                "platform": "tiktok_shop",
                "account_label": "TikTok Official Store (Live & Shop)",
                "account_id_or_username": "@nexusphone_official",
                "status": "ACTIVE",
                "total_views_30d": 348500,
                "total_orders_30d": 642,
                "total_gmv_30d": 88450000.0,
                "connected_at": "2026-10-15T08:00:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "platform": "tiktok_shop",
                "account_label": "TikTok Affiliate Creator 01",
                "account_id_or_username": "@racungadget_id",
                "status": "ACTIVE",
                "total_views_30d": 182000,
                "total_orders_30d": 315,
                "total_gmv_30d": 32100000.0,
                "connected_at": "2026-10-20T10:30:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "platform": "shopee",
                "account_label": "Shopee Mall Cabang Pusat",
                "account_id_or_username": "nexus_sparepart_id",
                "status": "ACTIVE",
                "total_views_30d": 95400,
                "total_orders_30d": 412,
                "total_gmv_30d": 74300000.0,
                "connected_at": "2026-10-18T14:15:00Z"
            },
            {
                "id": str(uuid.uuid4()),
                "platform": "instagram",
                "account_label": "Instagram Reels Brand",
                "account_id_or_username": "@nexus.os.tech",
                "status": "ACTIVE",
                "total_views_30d": 124000,
                "total_orders_30d": 98,
                "total_gmv_30d": 15600000.0,
                "connected_at": "2026-10-22T11:00:00Z"
            }
        ]
    return TENANT_CONNECTED_ACCOUNTS_CACHE[tenant_id]


def add_connected_account(tenant_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Menambahkan toko atau akun media sosial baru ke dashboard tenant.
    """
    accounts = get_tenant_connected_accounts(tenant_id)
    new_account = {
        "id": str(uuid.uuid4()),
        "platform": payload.get("platform", "tiktok_shop"),
        "account_label": payload.get("account_label", "Akun Baru"),
        "account_id_or_username": payload.get("account_id_or_username", "@akun"),
        "status": "ACTIVE",
        "total_views_30d": 0,
        "total_orders_30d": 0,
        "total_gmv_30d": 0.0,
        "connected_at": datetime.now(timezone.utc).isoformat()
    }
    accounts.append(new_account)
    TENANT_CONNECTED_ACCOUNTS_CACHE[tenant_id] = accounts
    return new_account


# ==============================================================================
# C-SUITE EXECUTIVE ADVISORY BRIDGE
# ==============================================================================
def generate_csuite_market_brief(tenant_id: str) -> Dict[str, Any]:
    """
    Menghasilkan ringkasan data tren pasar, rekomendasi Kapten Ads, dan kroscek stok
    khusus untuk dikonsumsi oleh C-Suite Advisory (/advisory).
    """
    opps = get_tenant_opportunities(tenant_id)
    if not opps:
        run_market_intelligence_scan(tenant_id)
        opps = get_tenant_opportunities(tenant_id)

    top_opp = opps[0] if opps else None
    
    if not top_opp:
        return {
            "status": "NO_DATA",
            "executive_summary": "Belum ada data tren pasar yang terindeks."
        }

    pname = top_opp["product_name"]
    score = top_opp["metrics"]["overall_opportunity_score"]
    source_type = top_opp["source_type"]
    inv_match = top_opp.get("inventory_match", {})
    ads_strat = top_opp.get("ads_strategy", {})
    sosmed_strat = top_opp.get("sosmed_strategy", {})

    # Sintesis Lintas Direktur C-Suite
    cmo_statement = (
        f"Tren '{pname}' sedang memuncak di TikTok ID & Marketplace dengan skor peluang {score}/100. "
        f"Kapten Ads menyarankan anggaran Rp {ads_strat.get('daily_budget_idr', 100000):,}/hari "
        f"di {ads_strat.get('campaign_type', 'TikTok VSA')} dengan target ROAS {ads_strat.get('target_roas', 3.5)}x."
    )

    if source_type == "OWN_INVENTORY":
        cfo_statement = (
            f"Kita memiliki {inv_match.get('stock_available', 0)} unit fisik di gudang (SKU: {inv_match.get('sku')}) "
            f"dengan margin laba {inv_match.get('profit_margin_pct', 0)}% (HPP Rp {inv_match.get('current_hpp', 0):,}). "
            f"Titik impas (BEP) iklan tercapai hanya dengan menjual {ads_strat.get('breakeven_units_per_day', 1)} unit per hari."
        )
        coo_statement = (
            f"Jika kampanye iklan dijalankan dengan target ROAS {ads_strat.get('target_roas', 3.5)}x, "
            f"stok {inv_match.get('stock_available', 0)} unit akan terserap dalam waktu ~4 hari. "
            f"Segera jadwalkan PO restock ke supplier sebelum stok habis!"
        )
    else:
        cfo_statement = (
            f"Barang ini belum ada di stok fisik toko kita. Kita bisa menjalankannya via Program Afiliasi TikTok/Shopee "
            f"dengan estimasi komisi {inv_match.get('profit_margin_pct', 15)}% tanpa resiko modal beku atau dead stock."
        )
        coo_statement = (
            f"Jika respons pasar positif, kita dapat segera mencari supplier grosir (Mangga Dua/Tanah Abang) "
            f"untuk memesan 50 unit pertama dan menjualnya sebagai produk fisik toko."
        )

    return {
        "status": "READY",
        "top_opportunity": {
            "opportunity_code": top_opp["opportunity_code"],
            "product_name": pname,
            "opportunity_score": score,
            "source_type": source_type,
            "inventory_match": inv_match,
            "ads_strategy": ads_strat,
            "sosmed_strategy": sosmed_strat
        },
        "c_suite_dialogue": {
            "cmo_view": cmo_statement,
            "cfo_view": cfo_statement,
            "coo_view": coo_statement
        },
        "suggested_actions": [
            {"label": "Kirim ke Studio Video", "action": "SEND_TO_STUDIO", "target": top_opp["opportunity_code"]},
            {"label": "Pasang Iklan Uji Coba", "action": "LAUNCH_ADS_TEST", "budget": ads_strat.get("daily_budget_idr", 100000)},
            {"label": "Cek Gudang / Buat PO", "action": "RESTOCK_SUPPLIER", "sku": inv_match.get("sku")}
        ]
    }
