"""
NEXUS CORE OS - TEST SUITE FASE 6: DOMAIN A (MARKET INTELLIGENCE & THE BRAIN)
File: apps/core-api/tests/test_market_intelligence_fase_6.py

Memverifikasi secara menyeluruh:
1. Pluggable Data Adapters (TikTok ID, Shopee/Tokopedia ID, Google Trends ID, Custom Competitor)
2. LangGraph StateGraph 7-Node Autonomous Pipeline
3. Formula Matematis Deterministic Opportunity Scoring
4. Kapten Ads Strategy & Sosmed Specialist 4-Scene Generation
5. Multi-Store & Connected Social Accounts Management
6. C-Suite Advisory Live Market Integration
7. API Router Endpoints
"""

import asyncio
from app.services.market_intelligence.adapters import (
    TikTokIndonesiaAdapter,
    MarketplaceIndonesiaAdapter,
    GoogleTrendsIndonesiaAdapter,
    CustomCompetitorScannerAdapter,
    AVAILABLE_ADAPTERS
)
from app.services.market_intelligence.intelligence_graph import (
    MARKET_INTELLIGENCE_GRAPH,
    MarketIntelligenceState
)
from app.services.market_intelligence.service import (
    run_market_intelligence_scan,
    get_tenant_opportunities,
    get_opportunity_by_code,
    update_opportunity_status,
    get_tenant_connected_accounts,
    add_connected_account,
    generate_csuite_market_brief
)
from app.services.csuite_advisory import process_csuite_advisory_message
from app.api.v1.intelligence import router


def test_pluggable_data_adapters_indonesia():
    """Memverifikasi bahwa semua adapter modular pasar Indonesia berjalan dan mengembalikan tipe RawTrendItem."""
    tiktok = TikTokIndonesiaAdapter()
    assert tiktok.source_code == "tiktok_id"
    tk_items = tiktok.fetch_trends("test_tenant")
    assert len(tk_items) >= 2
    assert any("Microphone" in it.trend_keyword for it in tk_items)
    assert all(0.0 <= it.velocity_score <= 1.0 for it in tk_items)

    mkt = MarketplaceIndonesiaAdapter()
    mkt_items = mkt.fetch_trends("test_tenant")
    assert len(mkt_items) >= 1
    assert any("LCD" in it.trend_keyword for it in mkt_items)

    gtrends = GoogleTrendsIndonesiaAdapter()
    gt_items = gtrends.fetch_trends("test_tenant")
    assert len(gt_items) >= 1

    custom = CustomCompetitorScannerAdapter()
    cust_items = custom.fetch_trends("test_tenant", {"target_urls": ["https://shopee.co.id/toko-kompetitor"]})
    assert len(cust_items) == 1


def test_langgraph_market_intelligence_stategraph_execution():
    """Memverifikasi eksekusi penuh 7 node LangGraph StateGraph untuk Domain A."""
    initial_state: MarketIntelligenceState = {
        "tenant_id": "test_tenant_langgraph",
        "active_sources": ["tiktok_id", "marketplace_id"],
        "scan_configs": {},
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

    result = MARKET_INTELLIGENCE_GRAPH.invoke(initial_state)

    assert len(result["raw_trend_items"]) > 0
    assert len(result["deduplicated_entities"]) > 0
    assert len(result["matched_inventory_items"]) > 0
    assert len(result["scored_opportunities"]) > 0
    assert len(result["final_content_opportunities"]) > 0
    assert len(result["errors"]) == 0
    assert any("Quality Gate" in log for log in result["execution_logs"])

    # Verifikasi hasil canonical ContentOpportunity
    top_opp = result["final_content_opportunities"][0]
    assert "opportunity_code" in top_opp
    assert "product_name" in top_opp
    assert "source_type" in top_opp
    assert top_opp["status"] == "READY_FOR_PRODUCTION"

    # Verifikasi Kapten Ads
    ads = top_opp["ads_strategy"]
    assert "daily_budget_idr" in ads
    assert ads["daily_budget_idr"] >= 35000
    assert "target_roas" in ads
    assert "kill_switch_rule" in ads

    # Verifikasi Sosmed Specialist
    sosmed = top_opp["sosmed_strategy"]
    assert "prime_time_wib" in sosmed
    assert "scenes" in sosmed
    scenes = sosmed["scenes"]
    assert "scene_1_hook" in scenes
    assert "scene_2_problem" in scenes
    assert "scene_3_solution_demo" in scenes
    assert "scene_4_cta" in scenes


def test_market_intelligence_service_crud_and_status_update():
    """Memverifikasi pemanggilan service, filter, dan update status peluang."""
    tenant_id = "test_tenant_service_01"
    scan_res = run_market_intelligence_scan(tenant_id)
    assert scan_res["total_opportunities_found"] > 0

    opps = get_tenant_opportunities(tenant_id)
    assert len(opps) > 0
    code = opps[0]["opportunity_code"]

    detail = get_opportunity_by_code(tenant_id, code)
    assert detail is not None
    assert detail["opportunity_code"] == code

    updated = update_opportunity_status(tenant_id, code, "APPROVED_FOR_STUDIO")
    assert updated is not None
    assert updated["status"] == "APPROVED_FOR_STUDIO"


def test_multi_store_connected_accounts():
    """Memverifikasi pengelolaan multi-toko e-commerce dan multi-akun sosial media."""
    tenant_id = "test_tenant_multi_acc"
    accounts = get_tenant_connected_accounts(tenant_id)
    initial_count = len(accounts)
    assert initial_count >= 3
    assert any(a["platform"] == "tiktok_shop" for a in accounts)

    new_acc = add_connected_account(tenant_id, {
        "platform": "tiktok_shop",
        "account_label": "TikTok Affiliate Cabang Surabaya",
        "account_id_or_username": "@racun_surabaya"
    })
    assert new_acc["account_label"] == "TikTok Affiliate Cabang Surabaya"
    
    updated_list = get_tenant_connected_accounts(tenant_id)
    assert len(updated_list) == initial_count + 1


def test_csuite_advisory_market_intelligence_integration():
    """Memverifikasi koneksi dialog C-Suite Advisory dengan data tren pasar Domain A."""
    tenant_id = "test_tenant_csuite_bridge"
    
    # 1. Direct brief generation
    brief = generate_csuite_market_brief(tenant_id)
    assert brief["status"] == "READY"
    assert "c_suite_dialogue" in brief
    assert "cmo_view" in brief["c_suite_dialogue"]
    assert "cfo_view" in brief["c_suite_dialogue"]
    assert "coo_view" in brief["c_suite_dialogue"]

    # 2. Executive Advisory Market Analysis tool
    from app.services.csuite_advisory import analyze_csuite_market_trends
    advisory_response = analyze_csuite_market_trends(tenant_id)
    assert advisory_response["tool_called"] == "market_intelligence_brief"
    assert "Laporan Intelijen Pasar & Tren Terkini" in advisory_response["reply"]
    assert "CMO (Marketing)" in advisory_response["reply"]
    assert "CFO (Keuangan)" in advisory_response["reply"]
    assert "COO (Operasional)" in advisory_response["reply"]


def test_intelligence_router_has_all_phase_6_endpoints():
    """Memverifikasi bahwa router /intelligence telah mendaftarkan seluruh endpoint Fase 6."""
    routes = {r.path for r in router.routes}
    assert "/intelligence/trends" in routes
    assert "/intelligence/trigger-scan" in routes
    assert "/intelligence/opportunities/{opportunity_code}" in routes
    assert "/intelligence/opportunities/{opportunity_code}/status" in routes
    assert "/intelligence/connected-accounts" in routes
    assert "/intelligence/csuite-brief" in routes
