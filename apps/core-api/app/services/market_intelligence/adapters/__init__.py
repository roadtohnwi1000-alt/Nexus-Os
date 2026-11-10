"""
NEXUS CORE OS - MARKET INTELLIGENCE ADAPTERS REGISTRY
File: apps/core-api/app/services/market_intelligence/adapters/__init__.py
"""

from typing import Dict, Type
from app.services.market_intelligence.adapters.base import BaseTrendAdapter, RawTrendItem
from app.services.market_intelligence.adapters.tiktok_id_adapter import TikTokIndonesiaAdapter
from app.services.market_intelligence.adapters.marketplace_id_adapter import MarketplaceIndonesiaAdapter
from app.services.market_intelligence.adapters.google_trends_id_adapter import GoogleTrendsIndonesiaAdapter
from app.services.market_intelligence.adapters.custom_competitor_adapter import CustomCompetitorScannerAdapter

AVAILABLE_ADAPTERS: Dict[str, Type[BaseTrendAdapter]] = {
    "tiktok_id": TikTokIndonesiaAdapter,
    "marketplace_id": MarketplaceIndonesiaAdapter,
    "google_trends_id": GoogleTrendsIndonesiaAdapter,
    "custom_competitor": CustomCompetitorScannerAdapter,
}

__all__ = [
    "BaseTrendAdapter",
    "RawTrendItem",
    "TikTokIndonesiaAdapter",
    "MarketplaceIndonesiaAdapter",
    "GoogleTrendsIndonesiaAdapter",
    "CustomCompetitorScannerAdapter",
    "AVAILABLE_ADAPTERS"
]
