"""
NEXUS CORE OS - TIKTOK CREATIVE CENTER INDONESIA ADAPTER
File: apps/core-api/app/services/market_intelligence/adapters/tiktok_id_adapter.py

Mengambil data tren viral khusus regional Indonesia (ID):
- Audio/Sound viral FYP Indonesia
- Hashtag tren e-commerce (#racuntiktok, #spillracun, #tiktokmademebuyit)
- Produk dengan lonjakan GMV dan tayangan tertinggi 7 hari terakhir
"""

from typing import List, Dict, Any, Optional
from app.services.market_intelligence.adapters.base import BaseTrendAdapter, RawTrendItem


class TikTokIndonesiaAdapter(BaseTrendAdapter):
    @property
    def source_code(self) -> str:
        return "tiktok_id"

    @property
    def source_name(self) -> str:
        return "TikTok Creative Center ID (FYP & Viral Products)"

    def fetch_trends(
        self,
        tenant_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> List[RawTrendItem]:
        # Dalam implementasi riil, ini memanggil TikTok Creative Center API / Scraper untuk region=ID.
        # Data disesuaikan secara realistis untuk pasar retail gadget, sparepart, dan lifestyle Indonesia.
        return [
            RawTrendItem(
                source_code=self.source_code,
                trend_keyword="Wireless Lavalier Microphone Noise Cancelling Type-C & Lightning",
                niche_category="Gadget & Audio",
                velocity_score=0.92,
                engagement_score=0.88,
                estimated_price_idr=149000.0,
                sample_hook_clues=[
                    "Spill mic wireless jernih 100 ribuan buat ngonten outdoor",
                    "Jangan beli mic mahal jutaan sebelum kamu coba mic ini!",
                    "Tes audio di pinggir jalan raya: ini hasilnya!"
                ],
                raw_payload={
                    "trending_audio": "DJ Jedag Jedug Viral TikTok 2026 (ID)",
                    "growth_7d_pct": 142.5,
                    "target_region": "ID",
                    "video_count_24h": 12800
                }
            ),
            RawTrendItem(
                source_code=self.source_code,
                trend_keyword="Tempered Glass Privacy Anti-Spy 9D Auto Dust Removal",
                niche_category="Aksesoris Ponsel",
                velocity_score=0.85,
                engagement_score=0.79,
                estimated_price_idr=35000.0,
                sample_hook_clues=[
                    "Trik pasang tempered glass anti gagal dalam 5 detik",
                    "Orang sebelah gak bakal bisa kepo lagi liat layar HP kamu!",
                    "Tes gores pake obeng dan kunci motor, masih mulus!"
                ],
                raw_payload={
                    "trending_audio": "Sound Edukasi Santai FYP",
                    "growth_7d_pct": 89.0,
                    "target_region": "ID",
                    "video_count_24h": 8450
                }
            ),
            RawTrendItem(
                source_code=self.source_code,
                trend_keyword="Power Bank Magnetik Wireless Magsafe 10000mAh Fast Charging 20W",
                niche_category="Gadget & Charging",
                velocity_score=0.78,
                engagement_score=0.82,
                estimated_price_idr=189000.0,
                sample_hook_clues=[
                    "Power bank tempel tanpa kabel paling tipis tahun ini",
                    "Muat di kantong celana tanpa bikin berat",
                    "Solusi baterai iPhone yang boros pas lagi jalan-jalan"
                ],
                raw_payload={
                    "trending_audio": "Pop Trending Acoustic Indo",
                    "growth_7d_pct": 65.4,
                    "target_region": "ID",
                    "video_count_24h": 5320
                }
            )
        ]
