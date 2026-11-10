"""
NEXUS OS - Base Publishing Adapter Interface
Domain C: Multi-Channel Publishing & Distribution
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import datetime

class BasePublishingAdapter(ABC):
    """
    Antarmuka Dasar Adapter Penerbitan Multi-Kanal.
    Mendukung upload langsung, penjadwalan waktu emas (Prime Time),
    dan pembuatan paket draf siap posting jika API platform memiliki batasan.
    """

    @property
    @abstractmethod
    def platform_code(self) -> str:
        """Kode unik platform, e.g. 'YOUTUBE_SHORTS', 'TIKTOK', 'INSTAGRAM_REELS'."""
        pass

    @abstractmethod
    def publish_video(
        self,
        tenant_id: str,
        video_url: str,
        caption: str,
        hashtags: List[str],
        scheduled_for: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Mempublikasikan atau menjadwalkan video ke platform tujuan."""
        pass

    @abstractmethod
    def fetch_post_metrics(self, external_post_id: str) -> Dict[str, Any]:
        """Mengambil data performa video dari API analitik (views, likes, shares, comments, clicks)."""
        pass

    def validate_video_spec(self, duration_sec: int, aspect_ratio: str) -> Dict[str, Any]:
        """Validasi kepatuhan spesifikasi teknis video pendek."""
        is_valid = duration_sec <= 60 and aspect_ratio in ["9:16", "VERTICAL"]
        return {
            "is_valid": is_valid,
            "max_duration_sec": 60,
            "required_aspect_ratio": "9:16",
            "message": "Spesifikasi video valid untuk format vertikal." if is_valid else "Durasi atau rasio aspek tidak memenuhi syarat."
        }
