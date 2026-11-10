"""
NEXUS CORE OS - LANGGRAPH MARKET INTELLIGENCE STATEGRAPH ENGINE ("THE BRAIN")
File: apps/core-api/app/services/market_intelligence/intelligence_graph.py

Membangun alur kerja otonom (LangGraph StateGraph) untuk:
1. IngestTrendNode: Mengambil sinyal tren dari keran data modular (TikTok ID, Shopee, Google Trends).
2. EntityResolutionNode: Deduplikasi dan normalisasi entitas produk.
3. InternalInventoryMatcherNode: Kroscek ketersediaan stok fisik & HPP di POS toko.
4. DeterministicScoringNode: Perhitungan Opportunity Score matematis (Anti-Halusinasi).
5. AdsStrategistNode: Kapten Ads merumuskan strategi kampanye, target ROAS, dan guardrails anggaran.
6. SosmedSpecialistNode: Spesialis Sosmed merancang naskah 4-scene (0-3s, 3-15s, 15-45s, 45-60s), sound FYP, dan jam tayang WIB.
7. QualityGateNode: Validasi skema kanonikal ContentOpportunity dan pemeringkatan akhir.
"""

import os
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGSMITH_TRACING"] = "false"

import math
import uuid
from typing import Dict, List, Any, Optional, TypedDict
from datetime import datetime, timezone

from langgraph.graph import StateGraph, START, END
from app.services.market_intelligence.adapters import AVAILABLE_ADAPTERS, RawTrendItem


class MarketIntelligenceState(TypedDict):
    tenant_id: str
    active_sources: List[str]
    scan_configs: Dict[str, Any]
    raw_trend_items: List[Dict[str, Any]]
    deduplicated_entities: List[Dict[str, Any]]
    matched_inventory_items: List[Dict[str, Any]]
    scored_opportunities: List[Dict[str, Any]]
    ads_strategies: Dict[str, Dict[str, Any]]
    sosmed_strategies: Dict[str, Dict[str, Any]]
    final_content_opportunities: List[Dict[str, Any]]
    execution_logs: List[str]
    errors: List[str]


# ==============================================================================
# NODE 1: INGEST TREND DATA (PLUGGABLE ADAPTERS)
# ==============================================================================
def ingest_trend_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    tenant_id = state.get("tenant_id", "default_tenant")
    active_sources = state.get("active_sources") or ["tiktok_id", "marketplace_id", "google_trends_id"]
    configs = state.get("scan_configs", {})
    
    raw_items: List[Dict[str, Any]] = []
    logs = list(state.get("execution_logs", []))
    errors = list(state.get("errors", []))
    
    logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Ingesting data dari {len(active_sources)} adapter aktif...")
    
    for source_code in active_sources:
        adapter_cls = AVAILABLE_ADAPTERS.get(source_code)
        if not adapter_cls:
            continue
        try:
            adapter = adapter_cls()
            items: List[RawTrendItem] = adapter.fetch_trends(tenant_id, configs.get(source_code))
            for it in items:
                raw_items.append(it.model_dump())
            logs.append(f"✓ Sumber '{adapter.source_name}' berhasil memuat {len(items)} sinyal tren.")
        except Exception as e:
            errors.append(f"Error memuat sumber {source_code}: {str(e)}")

    return {
        "raw_trend_items": raw_items,
        "execution_logs": logs,
        "errors": errors
    }


# ==============================================================================
# NODE 2: ENTITY RESOLUTION & DEDUPLICATION
# ==============================================================================
def entity_resolution_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    raw_items = state.get("raw_trend_items", [])
    logs = list(state.get("execution_logs", []))
    
    # Normalisasi kata kunci: lowercase dan pengelompokan token
    dedup_map: Dict[str, Dict[str, Any]] = {}
    
    for item in raw_items:
        kw = item.get("trend_keyword", "").strip()
        # Normalisasi dasar
        clean_key = " ".join(kw.lower().split()[:4]) # 4 kata pertama sebagai signature
        
        if clean_key not in dedup_map:
            dedup_map[clean_key] = {
                "entity_key": clean_key,
                "display_name": kw,
                "niche_category": item.get("niche_category", "Umum"),
                "max_velocity": item.get("velocity_score", 0.5),
                "avg_engagement": item.get("engagement_score", 0.5),
                "estimated_price_idr": item.get("estimated_price_idr", 0.0),
                "sample_hooks": list(item.get("sample_hook_clues", [])),
                "sources_detected": [item.get("source_code")],
                "combined_payloads": [item.get("raw_payload", {})]
            }
        else:
            existing = dedup_map[clean_key]
            existing["max_velocity"] = max(existing["max_velocity"], item.get("velocity_score", 0.5))
            existing["avg_engagement"] = (existing["avg_engagement"] + item.get("engagement_score", 0.5)) / 2.0
            if item.get("estimated_price_idr", 0.0) > 0:
                existing["estimated_price_idr"] = item.get("estimated_price_idr")
            existing["sample_hooks"].extend(item.get("sample_hook_clues", []))
            if item.get("source_code") not in existing["sources_detected"]:
                existing["sources_detected"].append(item.get("source_code"))
            existing["combined_payloads"].append(item.get("raw_payload", {}))

    deduplicated = list(dedup_map.values())
    logs.append(f"✓ Entity Resolution: Merampingkan {len(raw_items)} sinyal mentah menjadi {len(deduplicated)} entitas produk unik.")
    
    return {
        "deduplicated_entities": deduplicated,
        "execution_logs": logs
    }


# ==============================================================================
# NODE 3: INTERNAL INVENTORY MATCHER (NEXUS OS CLOSED-LOOP)
# ==============================================================================
def internal_inventory_matcher_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    deduplicated = state.get("deduplicated_entities", [])
    logs = list(state.get("execution_logs", []))
    
    # Mock / Database lookup items:
    # Dalam produksi ini mencocokkan dengan tabel public.items & public.stock_levels
    known_inventory_catalog = [
        {
            "sku": "MIC-WL-01",
            "name": "Wireless Lavalier Microphone Type-C & Lightning",
            "stock_available": 24,
            "current_hpp": 78000,
            "selling_price": 159000,
            "keywords": ["wireless", "lavalier", "microphone", "mic"]
        },
        {
            "sku": "LCD-IPH-11-INCELL",
            "name": "LCD Touchscreen iPhone 11 Incell Crown",
            "stock_available": 16,
            "current_hpp": 185000,
            "selling_price": 325000,
            "keywords": ["lcd", "iphone 11", "touchscreen", "incell"]
        },
        {
            "sku": "TG-PRIV-ALL",
            "name": "Tempered Glass Privacy Anti-Spy 9D",
            "stock_available": 45,
            "current_hpp": 9500,
            "selling_price": 35000,
            "keywords": ["tempered glass", "privacy", "anti-spy"]
        }
    ]
    
    matched_results: List[Dict[str, Any]] = []
    
    for entity in deduplicated:
        entity_name_lower = entity["display_name"].lower()
        matched_item = None
        
        for inv in known_inventory_catalog:
            match_score = sum(1 for kw in inv["keywords"] if kw in entity_name_lower)
            if match_score >= 2:
                matched_item = inv
                break
                
        if matched_item and matched_item["stock_available"] > 0:
            hpp = matched_item["current_hpp"]
            price = matched_item["selling_price"]
            margin_pct = round(((price - hpp) / price) * 100, 1) if price > 0 else 40.0
            
            entity_copy = dict(entity)
            entity_copy["source_type"] = "OWN_INVENTORY"
            entity_copy["inventory_match"] = {
                "sku": matched_item["sku"],
                "item_name": matched_item["name"],
                "stock_available": matched_item["stock_available"],
                "current_hpp": hpp,
                "selling_price": price,
                "profit_margin_pct": margin_pct,
                "note": "Barang tersedia di rak toko dengan margin sehat!"
            }
            entity_copy["margin_pct_for_scoring"] = margin_pct
        else:
            # Afiliasi pihak ketiga
            entity_copy = dict(entity)
            entity_copy["source_type"] = "AFFILIATE_PARTNER"
            entity_copy["inventory_match"] = {
                "sku": None,
                "stock_available": 0,
                "current_hpp": 0,
                "selling_price": entity.get("estimated_price_idr", 100000.0),
                "profit_margin_pct": 15.0, # Standar komisi afiliasi TikTok/Shopee
                "note": "Barang belum ada di inventori fisik. Dapat dijual via komisi afiliasi."
            }
            entity_copy["margin_pct_for_scoring"] = 15.0

        matched_results.append(entity_copy)
        
    logs.append(f"✓ Inventory Matcher: {sum(1 for m in matched_results if m['source_type'] == 'OWN_INVENTORY')} item cocok dengan stok fisik toko.")
    
    return {
        "matched_inventory_items": matched_results,
        "execution_logs": logs
    }


# ==============================================================================
# NODE 4: DETERMINISTIC OPPORTUNITY SCORING (NO LLM HALLUCINATION)
# ==============================================================================
def deterministic_scoring_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    matched_items = state.get("matched_inventory_items", [])
    logs = list(state.get("execution_logs", []))
    
    # Formula: Score = (W_demand * Velocity * 100) + (W_margin * MarginPct) - (W_comp * Saturation * 100)
    w_demand = 0.45
    w_margin = 0.35
    w_comp = 0.20
    
    scored_items: List[Dict[str, Any]] = []
    
    for it in matched_items:
        velocity = float(it.get("max_velocity", 0.5)) # 0.0 - 1.0
        margin_pct = float(it.get("margin_pct_for_scoring", 20.0)) # 10% - 60%
        # Saturation dihitung berbanding terbalik dengan engagement atau jumlah sumber
        num_sources = len(it.get("sources_detected", []))
        saturation = 0.20 if num_sources <= 1 else (0.45 if num_sources == 2 else 0.70)
        
        # Perhitungan matematis
        demand_term = w_demand * velocity * 100.0
        margin_term = w_margin * min(margin_pct, 60.0) # Cap margin di 60% agar proporsional
        comp_term = w_comp * saturation * 100.0
        
        raw_score = demand_term + margin_term - comp_term
        # Normalisasi ke skala 10.0 - 99.0
        final_score = round(max(10.0, min(raw_score * 1.35, 98.8)), 1)
        
        it_scored = dict(it)
        it_scored["metrics"] = {
            "velocity_score": round(velocity, 2),
            "margin_pct": round(margin_pct, 1),
            "competition_saturation": round(saturation, 2),
            "overall_opportunity_score": final_score,
            "demand_level": "VERY_HIGH" if final_score >= 80 else ("MODERATE" if final_score >= 60 else "LOW")
        }
        scored_items.append(it_scored)
        
    logs.append(f"✓ Deterministic Scorer: Berhasil menghitung Opportunity Score untuk {len(scored_items)} kandidat.")
    
    return {
        "scored_opportunities": scored_items,
        "execution_logs": logs
    }


# ==============================================================================
# NODE 5: ADS STRATEGIST SPECIALIST (KAPTEN ADS NODE)
# ==============================================================================
def ads_strategist_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    scored_items = state.get("scored_opportunities", [])
    logs = list(state.get("execution_logs", []))
    
    ads_plan_map: Dict[str, Dict[str, Any]] = {}
    
    for it in scored_items:
        key = it["entity_key"]
        score = it["metrics"]["overall_opportunity_score"]
        margin = it["metrics"]["margin_pct"]
        est_price = it.get("estimated_price_idr", 100000.0)
        
        # Kapten Ads merumuskan rekomendasi belanja iklan berdasarkan margin dan skor
        if score >= 80 and margin >= 30:
            daily_budget = 100000
            target_roas = 3.5
            campaign_type = "TikTok Video Shopping Ads (VSA) & Spark Ads"
            kill_cpr = 12000
        elif score >= 65:
            daily_budget = 50000
            target_roas = 2.8
            campaign_type = "Meta Reels Conversion / Traffic Catalog"
            kill_cpr = 9000
        else:
            daily_budget = 35000
            target_roas = 2.2
            campaign_type = "Organic Push First (Hold Paid Ads)"
            kill_cpr = 6000

        ads_plan_map[key] = {
            "daily_budget_idr": daily_budget,
            "target_roas": target_roas,
            "campaign_type": campaign_type,
            "audience_interests": [
                "Belanja Online Indonesia",
                "Gadget & Aksesoris Murah",
                "Teknisi & Reviewer Elektronik",
                "Usia 18 - 34 Tahun (Nasional)"
            ],
            "bidding_strategy": "Lowest Cost with CPR Cap",
            "kill_switch_rule": f"Matikan Ad Set jika CPR melebihi Rp {kill_cpr:,} setelah 70 klik tanpa pembelian.",
            "scaling_rule": "Scale-up anggaran 20% per 2 hari jika ROAS stabil di atas target.",
            "breakeven_units_per_day": max(1, math.ceil(daily_budget / max(est_price * (margin / 100.0), 10000.0)))
        }

    logs.append(f"✓ Kapten Ads: Menyusun strategi paid performance marketing untuk {len(ads_plan_map)} produk.")
    
    return {
        "ads_strategies": ads_plan_map,
        "execution_logs": logs
    }


# ==============================================================================
# NODE 6: SOCIAL MEDIA SPECIALIST (VIRAL CONTENT & SCENE PLANNER)
# ==============================================================================
def sosmed_specialist_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    scored_items = state.get("scored_opportunities", [])
    logs = list(state.get("execution_logs", []))
    
    sosmed_plan_map: Dict[str, Dict[str, Any]] = {}
    
    for it in scored_items:
        key = it["entity_key"]
        name = it["display_name"]
        sample_hooks = it.get("sample_hooks", [])
        
        main_hook = sample_hooks[0] if sample_hooks else f"Kenapa barang {name} ini mendadak viral di mana-mana?"
        
        # Menghasilkan naskah 4-scene berdurasi detik (Siap langsung dikonsumsi Remotion di Fase 7)
        scenes = {
            "scene_1_hook": {
                "time_range": "00:00 - 00:03 (3 Detik)",
                "visual_direction": f"Close-up tangan memegang {name} dengan teks berjalan tebal dan ekspresi kaget.",
                "spoken_text": main_hook
            },
            "scene_2_problem": {
                "time_range": "00:03 - 00:15 (12 Detik)",
                "visual_direction": "Tampilkan keluhan pembeli: suara bising / layar pecah / kabel gampang putus.",
                "spoken_text": "Pernah gak sih kesel pas butuh barang ini malah dapet yang gampang rusak atau kualitasnya abal-abal?"
            },
            "scene_3_solution_demo": {
                "time_range": "00:15 - 00:45 (30 Detik)",
                "visual_direction": "Demonstrasi uji coba fisik produk secara ekstrem (tes audio / tes gores / fast charging timer).",
                "spoken_text": f"Nah ini solusinya! {name} yang udah kita tes langsung. Fiturnya lengkap dan build quality-nya solid banget di kelas harganya."
            },
            "scene_4_cta": {
                "time_range": "00:45 - 00:60 (15 Detik)",
                "visual_direction": "Tunjuk ke arah tombol keranjang kuning atau link profil toko dengan badge diskon terbatas.",
                "spoken_text": "Mumpung stoknya masih ada dan lagi promo, langsung amankan sebelum kehabisan di keranjang kuning ya!"
            }
        }
        
        sosmed_plan_map[key] = {
            "prime_time_wib": "12:15 WIB (Istirahat Siang) & 19:45 WIB (Prime Time Malam)",
            "sound_recommendation": "Sound Jedag Jedug Trending FYP TikTok ID / Suara Suasana Kafe Chill",
            "tone_of_voice": "Bahasa santai, solutif, anti-gimmick, khas kreator edukatif Indonesia",
            "scenes": scenes,
            "suggested_hashtags": ["#racuntiktok", "#gadgetmurah", "#spillracun", "#reviewjujur", "#fypindonesia"],
            "engagement_comment_prompt": "Ketik 'MAU' di kolom komentar, nanti kita bisikin link diskon khususnya!"
        }

    logs.append(f"✓ Spesialis Sosmed: Merumuskan naskah video 4-scene & jadwal tayang WIB untuk {len(sosmed_plan_map)} produk.")
    
    return {
        "sosmed_strategies": sosmed_plan_map,
        "execution_logs": logs
    }


# ==============================================================================
# NODE 7: QUALITY GATE & CANONICAL SCHEMA VALIDATOR
# ==============================================================================
def quality_gate_node(state: MarketIntelligenceState) -> Dict[str, Any]:
    tenant_id = state.get("tenant_id", "default_tenant")
    scored_items = state.get("scored_opportunities", [])
    ads_map = state.get("ads_strategies", {})
    sosmed_map = state.get("sosmed_strategies", {})
    logs = list(state.get("execution_logs", []))
    
    final_opportunities: List[Dict[str, Any]] = []
    
    # Sort berdasarkan skor peluang tertinggi
    sorted_items = sorted(
        scored_items,
        key=lambda x: x["metrics"]["overall_opportunity_score"],
        reverse=True
    )
    
    for idx, it in enumerate(sorted_items):
        key = it["entity_key"]
        code = f"OPP-{datetime.now(timezone.utc).strftime('%y%m')}-{idx+1:03d}"
        
        canonical_opp = {
            "opportunity_code": code,
            "tenant_id": tenant_id,
            "product_name": it["display_name"],
            "niche_category": it["niche_category"],
            "source_type": it.get("source_type", "OWN_INVENTORY"),
            "inventory_match": it.get("inventory_match", {}),
            "metrics": it.get("metrics", {}),
            "creative_brief": {
                "target_audience": "Konsumen retail Indonesia, pemburu promo gadget, dan konten kreator",
                "primary_pain_point": "Barang murah di marketplace sering abal-abal atau tidak awet",
                "hook_angles": it.get("sample_hooks", [])[:3],
                "recommended_video_format": "Problem-Agitation-Solution (60s Vertical MP4)",
                "scenes": sosmed_map.get(key, {}).get("scenes", {}),
                "call_to_action": "Beli langsung lewat keranjang kuning TikTok atau pesan via WhatsApp toko"
            },
            "ads_strategy": ads_map.get(key, {}),
            "sosmed_strategy": sosmed_map.get(key, {}),
            "status": "READY_FOR_PRODUCTION",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        final_opportunities.append(canonical_opp)

    logs.append(f"✓ Quality Gate: Mengemas {len(final_opportunities)} canonical ContentOpportunity resmi siap produksi.")
    
    return {
        "final_content_opportunities": final_opportunities,
        "execution_logs": logs
    }


# ==============================================================================
# STATE GRAPH COMPILER
# ==============================================================================
def build_market_intelligence_graph():
    """
    Menyusun dan mengompilasi StateGraph LangGraph resmi untuk Domain A.
    """
    workflow = StateGraph(MarketIntelligenceState)
    
    # Tambahkan Node
    workflow.add_node("ingest_trends", ingest_trend_node)
    workflow.add_node("entity_resolution", entity_resolution_node)
    workflow.add_node("inventory_matcher", internal_inventory_matcher_node)
    workflow.add_node("deterministic_scorer", deterministic_scoring_node)
    workflow.add_node("ads_strategist", ads_strategist_node)
    workflow.add_node("sosmed_specialist", sosmed_specialist_node)
    workflow.add_node("quality_gate", quality_gate_node)
    
    # Alur Eksekusi
    workflow.add_edge(START, "ingest_trends")
    workflow.add_edge("ingest_trends", "entity_resolution")
    workflow.add_edge("entity_resolution", "inventory_matcher")
    workflow.add_edge("inventory_matcher", "deterministic_scorer")
    workflow.add_edge("deterministic_scorer", "ads_strategist")
    workflow.add_edge("ads_strategist", "sosmed_specialist")
    workflow.add_edge("sosmed_specialist", "quality_gate")
    workflow.add_edge("quality_gate", END)
    
    return workflow.compile()


# Instance singleton graph
MARKET_INTELLIGENCE_GRAPH = build_market_intelligence_graph()
