"""
NEXUS OS - Multi-Channel Publishing & Queue Manager
Domain C: Multi-Channel Publishing & Operations
Coordinates YouTube Shorts, TikTok, and Instagram Reels adapters.
"""

from typing import Dict, Any, List, Optional
import uuid
import datetime
from .adapters.base import BasePublishingAdapter
from .adapters.youtube_shorts_adapter import YouTubeShortsAdapter
from .adapters.tiktok_adapter import TikTokAdapter
from .adapters.instagram_reels_adapter import InstagramReelsAdapter

class PublishingService:
    """
    Manajer Layanan Publikasi Multi-Kanal & Penjadwalan Waktu Emas (Prime Time).
    """

    PRIME_TIME_SLOTS_WIB = [
        {"slot_name": "Siang (Istirahat Kantor)", "time_wib": "12:00:00", "weight": "HIGH"},
        {"slot_name": "Sore (Pulang Kerja/Kuliah)", "time_wib": "17:30:00", "weight": "MEDIUM"},
        {"slot_name": "Malam (Prime Time Rehat)", "time_wib": "19:30:00", "weight": "VERY_HIGH"},
        {"slot_name": "Late Night (Bedtime Scrolling)", "time_wib": "21:15:00", "weight": "HIGH"}
    ]

    def __init__(self):
        self.adapters: Dict[str, BasePublishingAdapter] = {
            "YOUTUBE_SHORTS": YouTubeShortsAdapter(),
            "TIKTOK": TikTokAdapter(),
            "INSTAGRAM_REELS": InstagramReelsAdapter()
        }
        # In-memory storage per tenant:
        # {tenant_id: {"channels": [...], "posts": [...]}}
        self._store: Dict[str, Dict[str, Any]] = {}
        self._ensure_demo_data_seeded()

    def _ensure_demo_data_seeded(self):
        """Menyediakan kanal default terhubung dan posting terjadwal untuk demo & pengujian."""
        demo_tenant = "11111111-1111-1111-1111-111111111111"
        if demo_tenant not in self._store:
            self._store[demo_tenant] = {
                "channels": [
                    {
                        "id": "chan_yt_01",
                        "tenant_id": demo_tenant,
                        "platform": "YOUTUBE_SHORTS",
                        "channel_name": "Nexus Tech Review Official",
                        "channel_handle": "@NexusTechID",
                        "is_active": True,
                        "daily_post_limit": 5,
                        "posts_today": 1,
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    },
                    {
                        "id": "chan_tt_01",
                        "tenant_id": demo_tenant,
                        "platform": "TIKTOK",
                        "channel_name": "Gadget Racun TikTok",
                        "channel_handle": "@racungadget.id",
                        "is_active": True,
                        "daily_post_limit": 6,
                        "posts_today": 2,
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    },
                    {
                        "id": "chan_ig_01",
                        "tenant_id": demo_tenant,
                        "platform": "INSTAGRAM_REELS",
                        "channel_name": "Katalog HP Roxy",
                        "channel_handle": "@roxy.gadgetstore",
                        "is_active": True,
                        "daily_post_limit": 4,
                        "posts_today": 0,
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }
                ],
                "posts": []
            }

            # Seed 1 contoh post terpublikasi di YouTube
            yt_adapter = self.adapters["YOUTUBE_SHORTS"]
            published_res = yt_adapter.publish_video(
                tenant_id=demo_tenant,
                video_url="/media/rendered_video/job_sample_vertical.mp4",
                caption="Jangan asal colok charger abal-abal! GaN 65W ini bikin baterai dingin.",
                hashtags=["#Shorts", "#GadgetReview", "#AnkerGaN"],
                metadata={"title": "Review Charger GaN 65W"}
            )
            self._store[demo_tenant]["posts"].append({
                "id": "post_yt_demo_01",
                "tenant_id": demo_tenant,
                "video_job_id": "job-sample-01",
                "opportunity_code": "OPP-001",
                "channel_id": "chan_yt_01",
                "platform": "YOUTUBE_SHORTS",
                "external_post_id": published_res["external_post_id"],
                "post_url": published_res["post_url"],
                "status": "PUBLISHED",
                "caption": published_res["description"],
                "hashtags": ["#Shorts", "#GadgetReview", "#AnkerGaN"],
                "scheduled_for": None,
                "published_at": published_res["published_at"],
                "error_message": None,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

    def get_channels(self, tenant_id: str) -> List[Dict[str, Any]]:
        """Mengambil seluruh kanal media sosial yang terhubung."""
        tenant_data = self._store.get(tenant_id, {})
        return tenant_data.get("channels", [])

    def connect_channel(
        self,
        tenant_id: str,
        platform: str,
        channel_name: str,
        channel_handle: str,
        credentials_encrypted: Optional[str] = None
    ) -> Dict[str, Any]:
        """Menghubungkan kanal media sosial baru."""
        if platform not in self.adapters:
            raise ValueError(f"Platform '{platform}' belum didukung. Pilihan: {list(self.adapters.keys())}")

        if tenant_id not in self._store:
            self._store[tenant_id] = {"channels": [], "posts": []}

        new_chan = {
            "id": f"chan_{uuid.uuid4().hex[:8]}",
            "tenant_id": tenant_id,
            "platform": platform,
            "channel_name": channel_name,
            "channel_handle": channel_handle if channel_handle.startswith("@") else f"@{channel_handle}",
            "is_active": True,
            "daily_post_limit": 5,
            "posts_today": 0,
            "credentials_encrypted": credentials_encrypted or "token_oauth2_authorized",
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        self._store[tenant_id]["channels"].append(new_chan)
        return new_chan

    def get_posts(
        self,
        tenant_id: str,
        status: Optional[str] = None,
        platform: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Mengambil antrean atau riwayat publikasi."""
        tenant_data = self._store.get(tenant_id, {})
        posts = tenant_data.get("posts", [])

        if status and status != "ALL":
            posts = [p for p in posts if p.get("status") == status]
        if platform and platform != "ALL":
            posts = [p for p in posts if p.get("platform") == platform]

        return sorted(posts, key=lambda x: x.get("created_at", ""), reverse=True)

    def publish_now(
        self,
        tenant_id: str,
        video_job_id: str,
        opportunity_code: str,
        platform: str,
        channel_id: str,
        caption: str,
        hashtags: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Mempublikasikan video langsung ke platform tujuan menggunakan adapter terkait.
        """
        adapter = self.adapters.get(platform)
        if not adapter:
            raise ValueError(f"Platform adapter '{platform}' tidak ditemukan.")

        video_url = metadata.get("video_url", f"/media/rendered_video/{video_job_id}.mp4") if metadata else f"/media/rendered_video/{video_job_id}.mp4"

        # Eksekusi publish lewat adapter
        res = adapter.publish_video(
            tenant_id=tenant_id,
            video_url=video_url,
            caption=caption,
            hashtags=hashtags,
            scheduled_for=None,
            metadata=metadata
        )

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        post_record = {
            "id": f"post_{uuid.uuid4().hex[:8]}",
            "tenant_id": tenant_id,
            "video_job_id": video_job_id,
            "opportunity_code": opportunity_code,
            "channel_id": channel_id,
            "platform": platform,
            "external_post_id": res["external_post_id"],
            "post_url": res["post_url"],
            "status": res["status"],
            "caption": caption,
            "hashtags": hashtags,
            "scheduled_for": None,
            "published_at": now_iso,
            "error_message": None,
            "adapter_payload": res,
            "created_at": now_iso
        }

        if tenant_id not in self._store:
            self._store[tenant_id] = {"channels": [], "posts": []}
        self._store[tenant_id]["posts"].append(post_record)

        return post_record

    def schedule_publication(
        self,
        tenant_id: str,
        video_job_id: str,
        opportunity_code: str,
        platform: str,
        channel_id: str,
        scheduled_for: str, # ISO Timestamp
        caption: str,
        hashtags: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Menjadwalkan video untuk dipublikasikan pada waktu tertentu (e.g. Jam Emas WIB)."""
        adapter = self.adapters.get(platform)
        if not adapter:
            raise ValueError(f"Platform adapter '{platform}' tidak ditemukan.")

        video_url = metadata.get("video_url", f"/media/rendered_video/{video_job_id}.mp4") if metadata else f"/media/rendered_video/{video_job_id}.mp4"

        res = adapter.publish_video(
            tenant_id=tenant_id,
            video_url=video_url,
            caption=caption,
            hashtags=hashtags,
            scheduled_for=scheduled_for,
            metadata=metadata
        )

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        post_record = {
            "id": f"post_{uuid.uuid4().hex[:8]}",
            "tenant_id": tenant_id,
            "video_job_id": video_job_id,
            "opportunity_code": opportunity_code,
            "channel_id": channel_id,
            "platform": platform,
            "external_post_id": res["external_post_id"],
            "post_url": res["post_url"],
            "status": "SCHEDULED",
            "caption": caption,
            "hashtags": hashtags,
            "scheduled_for": scheduled_for,
            "published_at": None,
            "error_message": None,
            "adapter_payload": res,
            "created_at": now_iso
        }

        if tenant_id not in self._store:
            self._store[tenant_id] = {"channels": [], "posts": []}
        self._store[tenant_id]["posts"].append(post_record)

        return post_record

    def fetch_post_analytics(self, platform: str, external_post_id: str) -> Dict[str, Any]:
        """Mengambil data analitik video dari adapter terkait."""
        adapter = self.adapters.get(platform)
        if not adapter:
            raise ValueError(f"Platform '{platform}' tidak valid.")
        return adapter.fetch_post_metrics(external_post_id)

    def get_prime_time_slots(self) -> List[Dict[str, Any]]:
        return self.PRIME_TIME_SLOTS_WIB


# Global Singleton
_PUBLISHING_SERVICE = PublishingService()

def get_publishing_service() -> PublishingService:
    return _PUBLISHING_SERVICE
