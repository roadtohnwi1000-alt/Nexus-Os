"""
NEXUS OS - Video Studio Orchestration Service
Domain B: AI Creative Production Engine
Coordinates ScriptwriterAgent, TTSSynthesizer, and VideoCompositor.
Manages video production job lifecycles and human approval gates.
"""

from typing import Dict, Any, List, Optional
import uuid
import datetime
from .scriptwriter_agent import ScriptwriterAgent
from .tts_synthesizer import TTSSynthesizer
from .video_compositor import VideoCompositor

class StudioService:
    """
    Service Pusat Pengendali Pabrik Konten Video Programatik (The Studio).
    Menjamin isolasi tenant, multi-varian naskah, sintesis suara bahasa Indonesia,
    dan perakitan kanvas video 9:16 siap publish.
    """

    def __init__(self):
        self.scriptwriter = ScriptwriterAgent()
        self.synthesizer = TTSSynthesizer()
        self.compositor = VideoCompositor()
        # In-memory storage per tenant: {tenant_id: {job_id: job_dict}}
        self._jobs_store: Dict[str, Dict[str, Any]] = {}
        self._ensure_demo_data_seeded()

    def _ensure_demo_data_seeded(self):
        """Menyediakan contoh pekerjaan produksi video aktif untuk demo & pengujian langsung."""
        demo_tenant = "11111111-1111-1111-1111-111111111111"
        if demo_tenant not in self._jobs_store:
            self._jobs_store[demo_tenant] = {}
            job = self.create_job_from_opportunity(
                tenant_id=demo_tenant,
                opportunity_code="OPP-001",
                product_name="Anker GaN 65W Fast Charger (Triple Port)",
                category="Accessories & Chargers",
                price_idr=249000,
                stock_remaining=18,
                pain_points=["charger bawaan lambat dan mudah panas bikin baterai kembung"],
                unique_selling_points=[
                    "Teknologi GaN III 65W isi 80% dalam 30 menit",
                    "Garansi resmi 18 bulan rusak ganti baru",
                    "Triple Port bisa cas laptop dan 2 HP sekaligus"
                ],
                target_audience="Pengguna smartphone aktif, pekerja mobile, dan tech savvy"
            )
            # Simpan job demo pertama
            self._jobs_store[demo_tenant][job["id"]] = job

    def get_jobs(
        self,
        tenant_id: str,
        status: Optional[str] = None,
        niche: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Mengambil seluruh pekerjaan perakitan video milik tenant."""
        tenant_jobs = self._jobs_store.get(tenant_id, {})
        jobs_list = list(tenant_jobs.values())

        if status and status != "ALL":
            jobs_list = [j for j in jobs_list if j.get("status") == status]
        if niche and niche != "ALL":
            jobs_list = [j for j in jobs_list if j.get("target_niche") == niche]

        # Urutkan berdasarkan created_at descending
        return sorted(jobs_list, key=lambda x: x.get("created_at", ""), reverse=True)

    def get_job_by_id(self, tenant_id: str, job_id: str) -> Optional[Dict[str, Any]]:
        """Mengambil detail lengkap sebuah video job."""
        tenant_jobs = self._jobs_store.get(tenant_id, {})
        return tenant_jobs.get(job_id)

    def create_job_from_opportunity(
        self,
        tenant_id: str,
        opportunity_code: str,
        product_name: str = "Fast Charger GaN 65W",
        category: str = "Accessories",
        price_idr: float = 249000.0,
        stock_remaining: int = 15,
        pain_points: Optional[List[str]] = None,
        unique_selling_points: Optional[List[str]] = None,
        target_audience: str = "Tech enthusiast & online shoppers"
    ) -> Dict[str, Any]:
        """
        Membuat job perakitan video baru dari peluang tren (Domain A).
        Menghasilkan 3 variasi naskah, menyintesis audio, dan merakit canvas Remotion.
        """
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        pain_pts = pain_points or ["charger lama panas dan lambat"]
        usps = unique_selling_points or [
            "GaN III 65W Fast Charge",
            "Garansi 18 Bulan Resmi",
            "Triple Port Aman dari Konslet"
        ]

        # 1. Generate 3 Multi-Angle Script Variations
        variants = self.scriptwriter.generate_three_variants(
            product_name=product_name,
            category=category,
            price_idr=price_idr,
            stock_remaining=stock_remaining,
            pain_points=pain_pts,
            unique_selling_points=usps,
            target_audience=target_audience
        )

        selected_variant = variants[0] # Default ke FOMO_AGITATION
        voice_id = "id_id_female_natural"
        bgm_id = "bgm_tech_pulse"
        bgm_vol = 0.15

        # 2. Synthesize Audio & Kinetic Subtitles
        audio_bundle = self.synthesizer.synthesize_scenes_audio(
            job_id=job_id,
            scenes=selected_variant["scenes"],
            voice_id=voice_id,
            bgm_track_id=bgm_id
        )

        # 3. Assemble Remotion React Composition Props
        composition_props = self.compositor.build_composition_props(
            job_id=job_id,
            title=f"Promo {product_name} - 60s Vertical",
            product_name=product_name,
            price_idr=price_idr,
            stock_remaining=stock_remaining,
            scenes=selected_variant["scenes"],
            subtitles_payload=audio_bundle["subtitles_payload"],
            waveform_data=audio_bundle["waveform_data"],
            audio_track_url=audio_bundle["audio_track_url"],
            voice_label=audio_bundle["voice_used"]["name"],
            bgm_track_id=bgm_id,
            bgm_volume=bgm_vol
        )

        # 4. Render Video Pipeline Initial Output
        render_output = self.compositor.render_video_job(
            job_id=job_id,
            composition_props=composition_props
        )

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        job_record = {
            "id": job_id,
            "tenant_id": tenant_id,
            "opportunity_code": opportunity_code,
            "title": f"Video Promo: {product_name}",
            "product_name": product_name,
            "category": category,
            "price_idr": price_idr,
            "stock_remaining": stock_remaining,
            "target_niche": "tech_gadgets",
            "format": "SHORT_FORM_9_16",
            "status": "READY_FOR_REVIEW",
            "selected_variant_id": selected_variant["id"],
            "script_variants": variants,
            "active_script": selected_variant,
            "voice_identity_id": voice_id,
            "bgm_track_id": bgm_id,
            "bgm_volume": bgm_vol,
            "audio_bundle": audio_bundle,
            "composition_props": composition_props,
            "rendered_video_url": render_output["rendered_video_url"],
            "thumbnail_url": render_output["thumbnail_url"],
            "render_metrics": render_output["render_metrics"],
            "compliance_score": selected_variant["compliance_check"]["compliance_score"],
            "compliance_check": selected_variant["compliance_check"],
            "approved_by": None,
            "approved_at": None,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        if tenant_id not in self._jobs_store:
            self._jobs_store[tenant_id] = {}
        self._jobs_store[tenant_id][job_id] = job_record

        return job_record

    def select_script_variant(self, tenant_id: str, job_id: str, variant_id: str) -> Optional[Dict[str, Any]]:
        """Memilih salah satu dari 3 varian naskah dan memperbarui komposisi video."""
        job = self.get_job_by_id(tenant_id, job_id)
        if not job:
            return None

        target_variant = None
        for v in job.get("script_variants", []):
            if v["id"] == variant_id:
                v["is_selected"] = True
                target_variant = v
            else:
                v["is_selected"] = False

        if not target_variant:
            return None

        job["selected_variant_id"] = variant_id
        job["active_script"] = target_variant
        job["compliance_score"] = target_variant["compliance_check"]["compliance_score"]
        job["compliance_check"] = target_variant["compliance_check"]

        # Re-synthesize audio & update composition
        audio_bundle = self.synthesizer.synthesize_scenes_audio(
            job_id=job_id,
            scenes=target_variant["scenes"],
            voice_id=job["voice_identity_id"],
            bgm_track_id=job["bgm_track_id"]
        )
        job["audio_bundle"] = audio_bundle

        composition_props = self.compositor.build_composition_props(
            job_id=job_id,
            title=job["title"],
            product_name=job["product_name"],
            price_idr=job["price_idr"],
            stock_remaining=job["stock_remaining"],
            scenes=target_variant["scenes"],
            subtitles_payload=audio_bundle["subtitles_payload"],
            waveform_data=audio_bundle["waveform_data"],
            audio_track_url=audio_bundle["audio_track_url"],
            voice_label=audio_bundle["voice_used"]["name"],
            bgm_track_id=job["bgm_track_id"],
            bgm_volume=job["bgm_volume"]
        )
        job["composition_props"] = composition_props
        job["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return job

    def reconfigure_audio(
        self,
        tenant_id: str,
        job_id: str,
        voice_identity_id: str,
        bgm_track_id: str,
        bgm_volume: float
    ) -> Optional[Dict[str, Any]]:
        """Mengganti suara voiceover AI dan track musik latar (BGM)."""
        job = self.get_job_by_id(tenant_id, job_id)
        if not job:
            return None

        job["voice_identity_id"] = voice_identity_id
        job["bgm_track_id"] = bgm_track_id
        job["bgm_volume"] = bgm_volume

        active_scenes = job["active_script"]["scenes"]
        audio_bundle = self.synthesizer.synthesize_scenes_audio(
            job_id=job_id,
            scenes=active_scenes,
            voice_id=voice_identity_id,
            bgm_track_id=bgm_track_id
        )
        job["audio_bundle"] = audio_bundle

        # Update props
        job["composition_props"] = self.compositor.build_composition_props(
            job_id=job_id,
            title=job["title"],
            product_name=job["product_name"],
            price_idr=job["price_idr"],
            stock_remaining=job["stock_remaining"],
            scenes=active_scenes,
            subtitles_payload=audio_bundle["subtitles_payload"],
            waveform_data=audio_bundle["waveform_data"],
            audio_track_url=audio_bundle["audio_track_url"],
            voice_label=audio_bundle["voice_used"]["name"],
            bgm_track_id=bgm_track_id,
            bgm_volume=bgm_volume
        )
        job["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return job

    def render_job_video(self, tenant_id: str, job_id: str) -> Optional[Dict[str, Any]]:
        """Menjalankan render ulang video composition."""
        job = self.get_job_by_id(tenant_id, job_id)
        if not job:
            return None

        render_output = self.compositor.render_video_job(job_id, job["composition_props"])
        job["status"] = "READY_FOR_REVIEW"
        job["rendered_video_url"] = render_output["rendered_video_url"]
        job["thumbnail_url"] = render_output["thumbnail_url"]
        job["render_metrics"] = render_output["render_metrics"]
        job["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return job

    def approve_job(self, tenant_id: str, job_id: str, operator_name: str = "Admin Owner") -> Optional[Dict[str, Any]]:
        """
        Gerbang Human-in-the-Loop Approval:
        Menyetujui video hasil rakitan AI untuk siap diteruskan ke antrean publikasi multi-channel (Fase 8).
        """
        job = self.get_job_by_id(tenant_id, job_id)
        if not job:
            return None

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        job["status"] = "APPROVED"
        job["approved_by"] = operator_name
        job["approved_at"] = now_iso
        job["updated_at"] = now_iso

        return job

    def get_voice_identities(self) -> List[Dict[str, Any]]:
        return self.synthesizer.get_voice_identities()

    def get_bgm_tracks(self) -> List[Dict[str, Any]]:
        return self.synthesizer.get_bgm_tracks()


# Global Singleton
_STUDIO_SERVICE = StudioService()

def get_studio_service() -> StudioService:
    return _STUDIO_SERVICE
