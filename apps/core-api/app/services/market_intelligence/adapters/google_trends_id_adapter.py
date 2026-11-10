"""
NEXUS CORE OS - GOOGLE TRENDS & SOCIAL SENTIMENT INDONESIA ADAPTER
File: apps/core-api/app/services/market_intelligence/adapters/google_trends_id_adapter.py

Mengambil sinyal kenaikan volume pencarian konsumen Indonesia (Google Search ID & X/Twitter Indonesia).
"""

from typing import List, Dict, Any, Optional
from app.services.market_intelligence.adapters.base import BaseTrendAdapter, RawTrendItem


class GoogleTrendsIndonesiaAdapter(BaseTrendAdapter):
    @property
    def source_code(self) -> str:
        return "google_trends_id"

    @property
    def source_name(self) -> str:
        return "Google Trends ID & Social Search Sentiment"

    def fetch_trends(
        self,
        tenant_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> List[RawTrendItem]:
        return [
            RawTrendItem(
                source_code=self.source_code,
                trend_keyword="Charger GaN 65W 3 Port Mini Foldable",
                niche_category="Gadget & Charging",
                velocity_score=0.81,
                engagement_score=0.76,
                estimated_price_idr=165000.0,
                sample_hook_clues=[
                    "Satu kepala charger kecil ini bisa cas laptop dan 2 HP sekaligus",
                    "Ga bikin panas berlebih berkat teknologi GaN terbaru",
                    "Praktis buat yang suka nongkrong di kafe atau kerja remote"
                ],
                raw_payload={
                    "search_surge_pct": 210.0,
                    "geo_location": "Indonesia (Nasional)",
                    "related_queries": ["rekomendasi charger gan murah", "charger macbook type c"]
                }
            )
        ]
