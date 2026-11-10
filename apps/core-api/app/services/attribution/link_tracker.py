"""
NEXUS OS - Attribution Link Tracker & Shortlink Service
Domain C: Closed-Loop Attribution
Generates trackable shortlinks, logs click events, and tracks affiliate conversions.
"""

from typing import Dict, Any, List, Optional
import uuid
import datetime
import hashlib

class LinkTracker:
    """
    Pelacak Tautan Atribusi & Konversi Penjualan.
    Mencatat klik unik, perangkat, dan atribusi komisi secara presisi per tenant.
    """

    def __init__(self):
        # {tenant_id: {link_id: link_dict}}
        self._links_store: Dict[str, Dict[str, Any]] = {}
        # {short_code: (tenant_id, link_id)}
        self._shortcode_index: Dict[str, tuple[str, str]] = {}
        # Click stream log
        self._click_events: List[Dict[str, Any]] = []
        self._ensure_demo_data_seeded()

    def _ensure_demo_data_seeded(self):
        """Menyediakan contoh link atribusi aktif untuk OPP-001."""
        demo_tenant = "11111111-1111-1111-1111-111111111111"
        if demo_tenant not in self._links_store:
            self._links_store[demo_tenant] = {}

            link = self.create_attribution_link(
                tenant_id=demo_tenant,
                opportunity_code="OPP-001",
                destination_url="https://shopee.co.id/anker-official-gan-65w-fast-charger",
                short_code="gan65w",
                campaign_tag="tiktok_affiliate_gan65w"
            )
            # Berikan data historis klik dan penjualan realistis
            link["total_clicks"] = 1240
            link["unique_visitors"] = 985
            link["total_purchases"] = 42
            link["attributed_gmv_idr"] = 42 * 249000.0 # Rp 10.458.000
            link["attributed_commission_idr"] = link["attributed_gmv_idr"] * 0.12 # Komisi 12% = Rp 1.254.960
            link["conversion_rate_pct"] = round((42 / 1240) * 100.0, 2) # 3.39%

    def create_attribution_link(
        self,
        tenant_id: str,
        opportunity_code: str,
        destination_url: str,
        short_code: Optional[str] = None,
        campaign_tag: str = "nexus_shorts_affiliate",
        publication_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Membuat tautan pelacak atribusi baru."""
        code = short_code or f"nx_{uuid.uuid4().hex[:6]}"
        link_id = f"link_{uuid.uuid4().hex[:8]}"

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        link_record = {
            "id": link_id,
            "tenant_id": tenant_id,
            "opportunity_code": opportunity_code,
            "publication_id": publication_id,
            "short_code": code,
            "short_url": f"https://nexus.to/{code}",
            "destination_url": destination_url,
            "campaign_tag": campaign_tag,
            "total_clicks": 0,
            "unique_visitors": 0,
            "total_purchases": 0,
            "attributed_gmv_idr": 0.0,
            "attributed_commission_idr": 0.0,
            "conversion_rate_pct": 0.0,
            "created_at": now_iso
        }

        if tenant_id not in self._links_store:
            self._links_store[tenant_id] = {}

        self._links_store[tenant_id][link_id] = link_record
        self._shortcode_index[code] = (tenant_id, link_id)

        return link_record

    def get_links(self, tenant_id: str, opportunity_code: Optional[str] = None) -> List[Dict[str, Any]]:
        """Mengambil seluruh tautan atribusi milik tenant."""
        tenant_links = self._links_store.get(tenant_id, {})
        links = list(tenant_links.values())

        if opportunity_code:
            links = [l for l in links if l.get("opportunity_code") == opportunity_code]

        return sorted(links, key=lambda x: x.get("created_at", ""), reverse=True)

    def record_click(
        self,
        short_code: str,
        user_agent: Optional[str] = None,
        referrer: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Optional[str]:
        """
        Mencatat event klik pengunjung dan mengembalikan destination URL untuk HTTP 302 Redirect.
        """
        if short_code not in self._shortcode_index:
            return None

        tenant_id, link_id = self._shortcode_index[short_code]
        link = self._links_store[tenant_id][link_id]

        link["total_clicks"] += 1
        link["unique_visitors"] += 1

        # Hitung conversion rate ulang jika ada pembelian
        if link["total_clicks"] > 0:
            link["conversion_rate_pct"] = round((link["total_purchases"] / link["total_clicks"]) * 100.0, 2)

        # Log click audit event
        ip_hash = hashlib.sha256((ip_address or "127.0.0.1").encode()).hexdigest()[:16]
        device = "MOBILE" if "mobile" in (user_agent or "").lower() else "DESKTOP"

        self._click_events.append({
            "id": f"clk_{uuid.uuid4().hex[:8]}",
            "tenant_id": tenant_id,
            "link_id": link_id,
            "short_code": short_code,
            "user_agent": user_agent,
            "referrer": referrer,
            "device_type": device,
            "ip_hash": ip_hash,
            "clicked_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

        return link["destination_url"]

    def record_conversion(
        self,
        tenant_id: str,
        short_code: str,
        gmv_idr: float,
        commission_idr: float
    ) -> Optional[Dict[str, Any]]:
        """Mencatat konversi pembelian yang diatribusikan ke link ini."""
        if short_code not in self._shortcode_index:
            return None

        t_id, link_id = self._shortcode_index[short_code]
        if t_id != tenant_id:
            return None

        link = self._links_store[t_id][link_id]
        link["total_purchases"] += 1
        link["attributed_gmv_idr"] += gmv_idr
        link["attributed_commission_idr"] += commission_idr

        if link["total_clicks"] > 0:
            link["conversion_rate_pct"] = round((link["total_purchases"] / link["total_clicks"]) * 100.0, 2)

        return link


# Global Singleton
_LINK_TRACKER = LinkTracker()

def get_link_tracker() -> LinkTracker:
    return _LINK_TRACKER
