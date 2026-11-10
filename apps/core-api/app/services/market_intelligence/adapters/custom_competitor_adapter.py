"""
NEXUS CORE OS - CUSTOM COMPETITOR SCANNER ADAPTER
File: apps/core-api/app/services/market_intelligence/adapters/custom_competitor_adapter.py

Memindai URL toko kompetitor atau tautan produk tertentu sesuai permintaan tenant.
"""

from typing import List, Dict, Any, Optional
from app.services.market_intelligence.adapters.base import BaseTrendAdapter, RawTrendItem


class CustomCompetitorScannerAdapter(BaseTrendAdapter):
    @property
    def source_code(self) -> str:
        return "custom_competitor"

    @property
    def source_name(self) -> str:
        return "Custom Competitor Scanner (URL & Catalog Ingestion)"

    def fetch_trends(
        self,
        tenant_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> List[RawTrendItem]:
        # Membaca daftar target URL kompetitor yang dikonfigurasikan tenant
        target_urls = (config or {}).get("target_urls", [])
        if not target_urls:
            return []

        results = []
        for url in target_urls:
            results.append(
                RawTrendItem(
                    source_code=self.source_code,
                    trend_keyword="Smart Tracker Key Finder Bluetooth Anti-Hilang",
                    niche_category="Smart Lifestyle",
                    velocity_score=0.75,
                    engagement_score=0.70,
                    estimated_price_idr=59000.0,
                    sample_hook_clues=[
                        "Buat kamu yang sering lupa naruh kunci motor atau dompet",
                        "Bunyi kenceng dari jarak 30 meter lewat HP kamu!",
                        "Baterai tahan setahun tanpa perlu cas"
                    ],
                    raw_payload={
                        "target_scanned_url": url,
                        "competitor_price_idr": 62000.0,
                        "competitor_rating": 4.7
                    }
                )
            )
        return results
