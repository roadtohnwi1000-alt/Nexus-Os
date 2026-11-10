"""
Unit Tests untuk FASE 7: Domain B - AI Creative & Remotion Programmatic Video Studio
Memverifikasi Scriptwriter Agent (3 varian naskah 60s), QA Compliance Guard,
TTS Synthesizer (subtitles kinetik karaoke & waveform), Remotion Compositor (9:16),
serta REST API endpoints dan isolasi multi-tenant.
"""

import pytest
from app.services.video_studio import (
    ScriptwriterAgent,
    TTSSynthesizer,
    VideoCompositor,
    StudioService,
    get_studio_service
)
from app.api.v1.video_studio import (
    list_voice_identities,
    list_bgm_tracks,
    get_video_jobs,
    create_video_job,
    get_video_job_detail,
    select_script_variant_endpoint,
    configure_audio_endpoint,
    trigger_render_video_endpoint,
    approve_job_endpoint,
    CreateVideoJobPayload,
    SelectVariantPayload,
    ConfigureAudioPayload,
    ApproveJobPayload
)

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"

def test_scriptwriter_three_variants_generation():
    """Menguji generator naskah AI menghasilkan 3 sudut pandang berbeda dengan pembagian detik presisi."""
    agent = ScriptwriterAgent()
    variants = agent.generate_three_variants(
        product_name="Powerbank Wireless 10.000mAh",
        category="Power & Charging",
        price_idr=189000,
        stock_remaining=25,
        pain_points=["kabel ruwet dan baterai drop saat traveling"],
        unique_selling_points=[
            "MagSafe nempel kuat 15W",
            "Bentuk ramping seukuran kartu ATM",
            "Garansi 1 tahun ganti baru"
        ],
        target_audience="Traveler & pekerja komuter"
    )

    assert len(variants) == 3
    angles = [v["angle_type"] for v in variants]
    assert "FOMO_AGITATION" in angles
    assert "EDUCATIONAL_REVIEW" in angles
    assert "BEFORE_AFTER_STORY" in angles

    for v in variants:
        scenes = v["scenes"]
        assert len(scenes) == 4
        assert scenes[0]["name"] == "Hook"
        assert scenes[0]["start_sec"] == 0
        assert scenes[0]["end_sec"] == 3
        assert scenes[1]["name"] == "Problem / Agitation"
        assert scenes[1]["start_sec"] == 3
        assert scenes[1]["end_sec"] == 15
        assert scenes[2]["name"] == "Solution & Demo"
        assert scenes[2]["start_sec"] == 15
        assert scenes[2]["end_sec"] == 45
        assert scenes[3]["name"] == "Strong CTA"
        assert scenes[3]["start_sec"] == 45
        assert scenes[3]["end_sec"] == 60
        assert v["estimated_duration_sec"] == 60
        assert v["compliance_check"]["status"] == "PASSED"

def test_scriptwriter_compliance_guard_catches_overclaims():
    """Menguji sistem QA Compliance Guard mendeteksi klaim berlebihan / pelanggaran iklan."""
    agent = ScriptwriterAgent()
    violating_scenes = [
        {"scene_index": 1, "name": "Hook", "start_sec": 0, "end_sec": 3, "duration_sec": 3, "narration": "Ini obat mujarab pasti sembuh 100% dari segala penyakit!"},
        {"scene_index": 2, "name": "Problem", "start_sec": 3, "end_sec": 15, "duration_sec": 12, "narration": "Bisa kaya mendadak cuan miliaran tanpa modal dalam 2 hari."},
        {"scene_index": 3, "name": "Solution", "start_sec": 15, "end_sec": 45, "duration_sec": 30, "narration": "Garansi seumur hidup tanpa syarat apapun."},
        {"scene_index": 4, "name": "CTA", "start_sec": 45, "end_sec": 60, "duration_sec": 15, "narration": "Beli sekarang di keranjang kuning!"}
    ]

    compliance = agent.check_compliance(violating_scenes)
    assert compliance["status"] == "NEEDS_REVISION"
    assert compliance["compliance_score"] < 70.0
    assert len(compliance["warnings"]) >= 2

def test_tts_synthesizer_kinetic_subtitles_and_waveform():
    """Menguji TTS synthesizer menghasilkan timestamp kata untuk subtitle karaoke dan data visualizer suara."""
    synth = TTSSynthesizer()
    scenes = [
        {"scene_index": 1, "name": "Hook", "start_sec": 0, "end_sec": 3, "duration_sec": 3, "narration": "Stop! Jangan beli charger murah!"},
        {"scene_index": 2, "name": "CTA", "start_sec": 3, "end_sec": 10, "duration_sec": 7, "narration": "Klik keranjang kuning sekarang juga."}
    ]

    bundle = synth.synthesize_scenes_audio(
        job_id="test_job_1",
        scenes=scenes,
        voice_id="id_id_female_natural",
        bgm_track_id="bgm_tech_pulse"
    )

    assert bundle["status"] == "SYNTHESIZED"
    assert len(bundle["subtitles_payload"]) > 5
    assert len(bundle["waveform_data"]) == 40
    assert "audio_ducking_config" in bundle
    # Cek bahwa kata ber-emphasis terdeteksi
    emphasis_words = [w["word"] for w in bundle["subtitles_payload"] if w["is_emphasis"]]
    assert any("Stop" in w or "Jangan" in w for w in emphasis_words)

def test_video_compositor_9_16_canvas_props():
    """Menguji pembentukan props kanvas video vertikal 9:16 untuk Remotion."""
    comp = VideoCompositor()
    scenes = [
        {"scene_index": 1, "name": "Hook", "start_sec": 0, "end_sec": 3, "duration_sec": 3, "visual_cue": "Close up", "on_screen_text": "HOOK!"},
        {"scene_index": 2, "name": "Problem", "start_sec": 3, "end_sec": 15, "duration_sec": 12, "visual_cue": "Problem", "on_screen_text": "PROBLEM!"},
        {"scene_index": 3, "name": "Demo", "start_sec": 15, "end_sec": 45, "duration_sec": 30, "visual_cue": "Unboxing", "on_screen_text": "DEMO!"},
        {"scene_index": 4, "name": "CTA", "start_sec": 45, "end_sec": 60, "duration_sec": 15, "visual_cue": "Keranjang kuning", "on_screen_text": "BELI!"}
    ]

    props = comp.build_composition_props(
        job_id="test_comp_1",
        title="Test Title",
        product_name="Super Charger 65W",
        price_idr=250000,
        stock_remaining=10,
        scenes=scenes,
        subtitles_payload=[],
        waveform_data=[0.5] * 40,
        audio_track_url="/test.mp3"
    )

    assert props["canvas"]["width"] == 1080
    assert props["canvas"]["height"] == 1920
    assert props["canvas"]["aspect_ratio"] == "9:16"
    assert props["canvas"]["duration_in_frames"] == 1800
    assert len(props["scenes"]) == 4

    render_res = comp.render_video_job("test_comp_1", props)
    assert render_res["status"] == "READY_FOR_REVIEW"
    assert render_res["render_metrics"]["cost_usd"] == 0.03
    assert render_res["render_metrics"]["fps"] == 30

def test_studio_service_lifecycle_and_tenant_isolation():
    """Menguji seluruh siklus pembuatan job, seleksi varian, hingga persetujuan operator serta isolasi tenant."""
    service = get_studio_service()

    # Buat job di Tenant A
    job_a = service.create_job_from_opportunity(
        tenant_id=TENANT_A,
        opportunity_code="OPP-101",
        product_name="Microfiber Cleaner Spray",
        category="Cleaning Kit",
        price_idr=49000,
        stock_remaining=50
    )
    assert job_a["status"] == "READY_FOR_REVIEW"
    assert job_a["opportunity_code"] == "OPP-101"

    # Verifikasi isolasi tenant: Tenant B tidak boleh melihat job milik Tenant A
    jobs_b = service.get_jobs(tenant_id=TENANT_B)
    assert not any(j["id"] == job_a["id"] for j in jobs_b)

    # Pilih varian kedua (Review Edukatif)
    v2_id = job_a["script_variants"][1]["id"]
    updated_job = service.select_script_variant(tenant_id=TENANT_A, job_id=job_a["id"], variant_id=v2_id)
    assert updated_job["selected_variant_id"] == v2_id
    assert updated_job["active_script"]["angle_type"] == "EDUCATIONAL_REVIEW"

    # Operator menyetujui video untuk antrean publikasi (Fase 8)
    approved_job = service.approve_job(tenant_id=TENANT_A, job_id=job_a["id"], operator_name="Budi Founder")
    assert approved_job["status"] == "APPROVED"
    assert approved_job["approved_by"] == "Budi Founder"
    assert approved_job["approved_at"] is not None

def test_fastapi_studio_endpoints():
    """Menguji seluruh endpoint REST API /api/v1/studio."""
    # 1. Voice identities & BGM tracks
    r_voices = list_voice_identities()
    assert len(r_voices["voices"]) >= 3

    r_bgm = list_bgm_tracks()
    assert len(r_bgm["bgm_tracks"]) >= 2

    # 2. List jobs
    r_jobs = get_video_jobs(x_tenant_id=TENANT_A)
    assert r_jobs["status"] == "success"

    # 3. Create job
    payload = CreateVideoJobPayload(
        opportunity_code="OPP-999",
        product_name="TWS ANC Noise Cancelling Earbuds",
        category="Audio",
        price_idr=299000.0,
        stock_remaining=30,
        pain_points=["suara bising saat di jalan"],
        unique_selling_points=["Active Noise Cancelling 40dB", "Baterai 30 Jam", "IPX5 Tahan Air"],
        target_audience="Pecinta musik & commuters"
    )
    r_create = create_video_job(payload=payload, x_tenant_id=TENANT_A)
    created_job = r_create["job"]
    job_id = created_job["id"]

    # 4. Detail job
    r_detail = get_video_job_detail(job_id=job_id, x_tenant_id=TENANT_A)
    assert r_detail["job"]["id"] == job_id

    # 5. Select variant
    v_id = created_job["script_variants"][1]["id"]
    r_variant = select_script_variant_endpoint(
        job_id=job_id,
        payload=SelectVariantPayload(variant_id=v_id),
        x_tenant_id=TENANT_A
    )
    assert r_variant["job"]["selected_variant_id"] == v_id

    # 6. Configure audio
    r_audio = configure_audio_endpoint(
        job_id=job_id,
        payload=ConfigureAudioPayload(voice_identity_id="id_id_male_deep", bgm_track_id="bgm_tech_pulse", bgm_volume=0.20),
        x_tenant_id=TENANT_A
    )
    assert r_audio["job"]["voice_identity_id"] == "id_id_male_deep"

    # 7. Render
    r_render = trigger_render_video_endpoint(job_id=job_id, x_tenant_id=TENANT_A)
    assert r_render["job"]["status"] == "READY_FOR_REVIEW"

    # 8. Approve (Fase 8 Handoff)
    r_approve = approve_job_endpoint(
        job_id=job_id,
        payload=ApproveJobPayload(operator_name="Chief Creative Officer"),
        x_tenant_id=TENANT_A
    )
    assert r_approve["job"]["status"] == "APPROVED"
    assert r_approve["job"]["approved_by"] == "Chief Creative Officer"
