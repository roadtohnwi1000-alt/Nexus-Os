"""
NEXUS CORE OS - MARKET INTELLIGENCE PACKAGE
File: apps/core-api/app/services/market_intelligence/__init__.py
"""

from app.services.market_intelligence.adapters import (
    BaseTrendAdapter,
    RawTrendItem,
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

__all__ = [
    "BaseTrendAdapter",
    "RawTrendItem",
    "AVAILABLE_ADAPTERS",
    "MARKET_INTELLIGENCE_GRAPH",
    "MarketIntelligenceState",
    "run_market_intelligence_scan",
    "get_tenant_opportunities",
    "get_opportunity_by_code",
    "update_opportunity_status",
    "get_tenant_connected_accounts",
    "add_connected_account",
    "generate_csuite_market_brief"
]
