"""
NEXUS CORE OS - MARKET INTELLIGENCE DATA ADAPTER INTERFACE
File: apps/core-api/app/services/market_intelligence/adapters/base.py

Mendefinisikan antarmuka modular (Pluggable Adapter Pattern) untuk seluruh
sumber data tren pasar lokal Indonesia dan internasional.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class RawTrendItem(BaseModel):
    source_code: str = Field(..., description="Kode sumber: tiktok_id, shopee_id, tokopedia_id, google_trends_id, custom_competitor")
    trend_keyword: str = Field(..., description="Kata kunci nama produk atau topik viral")
    niche_category: str = Field(..., description="Kategori industri produk (misal: Gadget & Aksesoris, Sparepart, Fashion, Audio)")
    velocity_score: float = Field(..., ge=0.0, le=1.0, description="Kecepatan pertumbuhan tren 0.0 - 1.0")
    engagement_score: float = Field(0.5, ge=0.0, le=1.0, description="Skor keterlibatan atau popularitas")
    estimated_price_idr: float = Field(0.0, description="Estimasi harga jual umum di Indonesia (Rp)")
    sample_hook_clues: List[str] = Field(default_factory=list, description="Petunjuk teks hook atau kalimat viral yang sering dipakai")
    raw_payload: Dict[str, Any] = Field(default_factory=dict, description="Metadata mentah dari sumber data")
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BaseTrendAdapter(ABC):
    """
    Kelas abstrak untuk semua adapter data sumber tren pasar.
    """
    @property
    @abstractmethod
    def source_code(self) -> str:
        pass

    @property
    @abstractmethod
    def source_name(self) -> str:
        pass

    @abstractmethod
    def fetch_trends(
        self,
        tenant_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> List[RawTrendItem]:
        """
        Mengambil daftar tren terbaru dari sumber terkait.
        """
        pass
