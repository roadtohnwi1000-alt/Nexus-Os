"""
NEXUS OS - Closed-Loop Attribution & Feedback Calibration Engine
Domain C / The Feedback Loop
Feeds real post-publication performance data back into Domain A Opportunity Scorer
to auto-tune mathematical weights and eliminate subjective AI hallucinations.
"""

from typing import Dict, Any, List, Optional
import uuid
import datetime

class ClosedLoopFeedbackEngine:
    """
    Mesin Penutup Siklus Otomatis (Closed Feedback Loop).
    Menghubungkan analitik penayangan (YouTube/TikTok) dan penjualan riil
    kembali ke rumus Opportunity Score Domain A.
    """

    DEFAULT_WEIGHTS = {
        "w_demand": 0.50,
        "w_margin": 0.30,
        "w_competition": 0.20
    }

    def __init__(self):
        # {tenant_id: {"active_weights": dict, "calibration_logs": list}}
        self._tenant_calibration: Dict[str, Dict[str, Any]] = {}
        self._ensure_demo_data_seeded()

    def _ensure_demo_data_seeded(self):
        demo_tenant = "11111111-1111-1111-1111-111111111111"
        if demo_tenant not in self._tenant_calibration:
            self._tenant_calibration[demo_tenant] = {
                "active_weights": dict(self.DEFAULT_WEIGHTS),
                "calibration_logs": [
                    {
                        "id": "calib_001",
                        "tenant_id": demo_tenant,
                        "opportunity_code": "OPP-001",
                        "product_name": "Anker GaN 65W Fast Charger",
                        "views_48h": 12450,
                        "clicks_48h": 1240,
                        "ctr_pct": 9.96,
                        "orders_count": 42,
                        "attributed_revenue_idr": 10458000.0,
                        "attributed_commission_idr": 1254960.0,
                        "old_weights": {"w_demand": 0.50, "w_margin": 0.30, "w_competition": 0.20},
                        "new_weights": {"w_demand": 0.55, "w_margin": 0.28, "w_competition": 0.17},
                        "winning_hook_angle": "FOMO_AGITATION",
                        "calibration_reason": "CTR melejit 9.96% (> 3.0%), bobot permintaan pasar (W_demand) dinaikkan untuk memprioritaskan stok kategori charger GaN.",
                        "calibrated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }
                ]
            }

    def get_calibration_status(self, tenant_id: str) -> Dict[str, Any]:
        """Mengambil bobot aktif rumus Opportunity Score dan riwayat kalibrasi."""
        data = self._tenant_calibration.get(tenant_id, {
            "active_weights": dict(self.DEFAULT_WEIGHTS),
            "calibration_logs": []
        })
        return {
            "tenant_id": tenant_id,
            "active_scoring_weights": data["active_weights"],
            "total_calibrations": len(data["calibration_logs"]),
            "recent_calibrations": data["calibration_logs"]
        }

    def process_performance_feedback(
        self,
        tenant_id: str,
        opportunity_code: str,
        product_name: str,
        views_48h: int,
        clicks_48h: int,
        orders_count: int,
        attributed_revenue_idr: float,
        winning_angle: str = "FOMO_AGITATION"
    ) -> Dict[str, Any]:
        """
        Memproses data performa 48 jam dan menutup loop:
        Mengkalibrasi bobot algoritma Domain A secara deterministik.
        """
        if tenant_id not in self._tenant_calibration:
            self._tenant_calibration[tenant_id] = {
                "active_weights": dict(self.DEFAULT_WEIGHTS),
                "calibration_logs": []
            }

        curr_weights = dict(self._tenant_calibration[tenant_id]["active_weights"])
        ctr_pct = round((clicks_48h / max(1, views_48h)) * 100.0, 2)
        cvr_pct = round((orders_count / max(1, clicks_48h)) * 100.0, 2)

        # Logika Kalibrasi Deterministik Tertutup (CommerceOS Loop)
        new_weights = dict(curr_weights)
        if ctr_pct >= 3.0 and cvr_pct >= 2.0:
            # Performa di atas rata-rata: pasar sangat responsif
            new_weights["w_demand"] = min(0.65, round(curr_weights["w_demand"] + 0.05, 2))
            new_weights["w_competition"] = max(0.10, round(curr_weights["w_competition"] - 0.03, 2))
            reason = f"CTR ({ctr_pct}%) & CVR ({cvr_pct}%) tinggi! W_demand dinaikkan ke {new_weights['w_demand']}. Niche ini sangat responsif."
        elif ctr_pct < 1.0 and views_48h > 3000:
            # Penonton banyak tapi sedikit yang klik: saturasi konten tinggi
            new_weights["w_competition"] = min(0.40, round(curr_weights["w_competition"] + 0.05, 2))
            new_weights["w_demand"] = max(0.40, round(curr_weights["w_demand"] - 0.03, 2))
            reason = f"CTR rendah ({ctr_pct}%) pada {views_48h} views. Penalti kejenuhan kompetitor (W_comp) dinaikkan ke {new_weights['w_competition']}."
        else:
            reason = f"Metrik CTR ({ctr_pct}%) berada dalam rentang normal industri e-commerce (1.0% - 3.0%). Bobot stabil."

        # Simpan perubahan bobot aktif
        self._tenant_calibration[tenant_id]["active_weights"] = new_weights

        calibration_entry = {
            "id": f"calib_{uuid.uuid4().hex[:8]}",
            "tenant_id": tenant_id,
            "opportunity_code": opportunity_code,
            "product_name": product_name,
            "views_48h": views_48h,
            "clicks_48h": clicks_48h,
            "ctr_pct": ctr_pct,
            "orders_count": orders_count,
            "attributed_revenue_idr": attributed_revenue_idr,
            "attributed_commission_idr": round(attributed_revenue_idr * 0.12, 2),
            "old_weights": curr_weights,
            "new_weights": new_weights,
            "winning_hook_angle": winning_angle,
            "calibration_reason": reason,
            "calibrated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        self._tenant_calibration[tenant_id]["calibration_logs"].insert(0, calibration_entry)

        return {
            "status": "CALIBRATED",
            "feedback_summary": {
                "views": views_48h,
                "clicks": clicks_48h,
                "ctr_pct": ctr_pct,
                "orders": orders_count,
                "cvr_pct": cvr_pct,
                "attributed_revenue": attributed_revenue_idr
            },
            "calibration_result": calibration_entry
        }


# Global Singleton
_CLOSED_LOOP_ENGINE = ClosedLoopFeedbackEngine()

def get_closed_loop_engine() -> ClosedLoopFeedbackEngine:
    return _CLOSED_LOOP_ENGINE
