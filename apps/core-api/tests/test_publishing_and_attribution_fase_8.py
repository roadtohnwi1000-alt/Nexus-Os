"""
Unit Tests untuk FASE 8: Multi-Channel Publishing, Closed-Loop Attribution & Feedback Calibration
Memverifikasi YouTube Shorts, TikTok Draft Package, Instagram Reels adapters,
Pelacakan Tautan Atribusi (shortlinks), Penutupan Siklus Umpan Balik (Closed-Loop Calibration),
dan REST API Endpoints dengan isolasi multi-tenant.
"""

import pytest
from unittest.mock import MagicMock
from app.services.publishing import get_publishing_service
from app.services.attribution import get_link_tracker, get_closed_loop_engine
from app.api.v1.publishing import (
    list_connected_channels,
    get_prime_time_slots,
    publish_now_endpoint,
    schedule_video_endpoint,
    create_attribution_link_endpoint,
    redirect_attribution_link,
    ingest_closed_loop_feedback,
    get_closed_loop_status,
    PublishNowPayload,
    SchedulePublishPayload,
    CreateLinkPayload,
    PerformanceFeedbackPayload
)

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"

def test_publishing_adapters_functionality():
    """Menguji fungsionalitas adapter YouTube Shorts, TikTok, dan Instagram Reels."""
    service = get_publishing_service()

    # 1. YouTube Shorts Adapter
    yt_adapter = service.adapters["YOUTUBE_SHORTS"]
    yt_res = yt_adapter.publish_video(
        tenant_id=TENANT_A,
        video_url="/test.mp4",
        caption="Review Charger GaN 65W",
        hashtags=["#Tech", "#Shorts"]
    )
    assert yt_res["status"] == "PUBLISHED"
    assert yt_res["category_id"] == "28"
    assert "https://youtube.com/shorts/" in yt_res["post_url"]

    # 2. TikTok Adapter (Creator Draft Package)
    tt_adapter = service.adapters["TIKTOK"]
    tt_res = tt_adapter.publish_video(
        tenant_id=TENANT_A,
        video_url="/test.mp4",
        caption="Baterai dingin pake GaN 65W",
        hashtags=["#racuntiktok"],
        metadata={"has_creator_token": False, "product_checkout_url": "https://tiktok.com/cart"}
    )
    assert tt_res["status"] == "DRAFT_READY"
    assert tt_res["mode"] == "CREATOR_DRAFT_PACKAGE"
    assert "draft_package" in tt_res
    assert "copyable_caption" in tt_res["draft_package"]

    # 3. Instagram Reels Adapter
    ig_adapter = service.adapters["INSTAGRAM_REELS"]
    ig_res = ig_adapter.publish_video(
        tenant_id=TENANT_A,
        video_url="/test.mp4",
        caption="Ready stok charger di toko!",
        hashtags=["#reels"]
    )
    assert ig_res["status"] == "PUBLISHED"
    assert "instagram.com/reel/" in ig_res["post_url"]

def test_publishing_service_queue_and_tenant_isolation():
    """Menguji antrean publikasi, penjadwalan waktu emas (Prime Time), dan isolasi tenant."""
    service = get_publishing_service()

    # Jadwalkan video di Tenant A untuk jam 19:30 WIB
    scheduled_post = service.schedule_publication(
        tenant_id=TENANT_A,
        video_job_id="job-test-sched-01",
        opportunity_code="OPP-001",
        platform="YOUTUBE_SHORTS",
        channel_id="chan_yt_01",
        scheduled_for="2026-11-03T19:30:00Z",
        caption="Spesial Prime Time 19:30 WIB - Charger GaN 65W",
        hashtags=["#Shorts", "#Viral"]
    )
    assert scheduled_post["status"] == "SCHEDULED"
    assert scheduled_post["scheduled_for"] == "2026-11-03T19:30:00Z"

    # Verifikasi isolasi tenant: Tenant B tidak boleh melihat antrean Tenant A
    posts_b = service.get_posts(tenant_id=TENANT_B)
    assert not any(p["id"] == scheduled_post["id"] for p in posts_b)

def test_link_tracker_and_click_attribution():
    """Menguji pembuatan shortlink atribusi, pencatatan klik, dan kalkulasi komisi omzet."""
    tracker = get_link_tracker()

    link = tracker.create_attribution_link(
        tenant_id=TENANT_A,
        opportunity_code="OPP-777",
        destination_url="https://shopee.co.id/tws-anc-official",
        short_code="twsanc",
        campaign_tag="tiktok_reels_promo"
    )
    assert link["short_code"] == "twsanc"
    assert link["total_clicks"] == 0

    # Simulasikan 3 klik dari user mobile
    dest_1 = tracker.record_click("twsanc", user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)", referrer="https://tiktok.com", ip_address="103.11.22.33")
    dest_2 = tracker.record_click("twsanc", user_agent="Mozilla/5.0 (Android 14)", referrer="https://instagram.com", ip_address="103.11.22.34")
    dest_3 = tracker.record_click("twsanc", user_agent="Mozilla/5.0 (Windows NT 10.0)", referrer="https://youtube.com", ip_address="103.11.22.35")
    assert dest_1 == "https://shopee.co.id/tws-anc-official"
    assert link["total_clicks"] == 3

    # Simulasikan 1 pembelian (Konversi)
    updated_link = tracker.record_conversion(
        tenant_id=TENANT_A,
        short_code="twsanc",
        gmv_idr=299000.0,
        commission_idr=35880.0 # 12% komisi
    )
    assert updated_link["total_purchases"] == 1
    assert updated_link["attributed_gmv_idr"] == 299000.0
    assert updated_link["conversion_rate_pct"] == round((1 / 3) * 100.0, 2) # 33.33%

def test_closed_loop_feedback_calibration():
    """Menguji penutupan siklus umpan balik (Closed-Loop) yang mengkalibrasi rumus matematis Domain A."""
    engine = get_closed_loop_engine()

    initial_status = engine.get_calibration_status(TENANT_A)
    old_demand_weight = initial_status["active_scoring_weights"]["w_demand"]

    # Simulasikan data performa 48 jam yang sangat viral (CTR 8.5% > 3.0%)
    res = engine.process_performance_feedback(
        tenant_id=TENANT_A,
        opportunity_code="OPP-001",
        product_name="Anker GaN 65W Fast Charger",
        views_48h=10000,
        clicks_48h=850, # CTR = 8.5%
        orders_count=35, # CVR = 4.1%
        attributed_revenue_idr=8715000.0,
        winning_angle="FOMO_AGITATION"
    )

    assert res["status"] == "CALIBRATED"
    assert res["feedback_summary"]["ctr_pct"] == 8.5
    calib = res["calibration_result"]
    # Karena CTR & CVR tinggi, bobot demand harus naik!
    assert calib["new_weights"]["w_demand"] >= old_demand_weight
    assert "tinggi" in calib["calibration_reason"].lower()

def test_fastapi_publishing_and_attribution_endpoints():
    """Menguji seluruh REST API /api/v1/publishing/*."""
    # 1. Channels & Prime time
    r_chan = list_connected_channels(x_tenant_id=TENANT_A)
    assert r_chan["total_channels"] >= 3

    r_slots = get_prime_time_slots()
    assert len(r_slots["slots"]) >= 4

    # 2. Publish Now
    pub_payload = PublishNowPayload(
        video_job_id="job-api-test-01",
        opportunity_code="OPP-001",
        platform="YOUTUBE_SHORTS",
        channel_id="chan_yt_01",
        caption="Video Promo Fast Charging GaN",
        hashtags=["#Shorts", "#GaN"]
    )
    r_pub = publish_now_endpoint(payload=pub_payload, x_tenant_id=TENANT_A)
    assert r_pub["post"]["platform"] == "YOUTUBE_SHORTS"

    # 3. Schedule
    sched_payload = SchedulePublishPayload(
        video_job_id="job-api-test-02",
        opportunity_code="OPP-001",
        platform="TIKTOK",
        channel_id="chan_tt_01",
        scheduled_for="2026-11-03T21:15:00Z",
        caption="Nonton sebelum tidur! Promo charger",
        hashtags=["#racuntiktok"]
    )
    r_sched = schedule_video_endpoint(payload=sched_payload, x_tenant_id=TENANT_A)
    assert r_sched["post"]["status"] == "SCHEDULED"

    # 4. Attribution Link Creation
    link_payload = CreateLinkPayload(
        opportunity_code="OPP-001",
        destination_url="https://shopee.co.id/anker-gan-65w-promo",
        short_code="promo65w",
        campaign_tag="shorts_bio_link"
    )
    r_link = create_attribution_link_endpoint(payload=link_payload, x_tenant_id=TENANT_A)
    assert r_link["link"]["short_code"] == "promo65w"

    # 5. Click Redirection (Follow redirects false to check 307 status)
    mock_req = MagicMock()
    mock_req.headers.get.return_value = "Mozilla/5.0"
    mock_req.client.host = "127.0.0.1"
    r_redir = redirect_attribution_link(short_code="promo65w", request=mock_req)
    assert r_redir.status_code == 307
    assert r_redir.headers["location"] == "https://shopee.co.id/anker-gan-65w-promo"

    # 6. Ingest Closed-Loop Performance
    perf_payload = PerformanceFeedbackPayload(
        opportunity_code="OPP-001",
        product_name="Anker GaN 65W Fast Charger",
        views_48h=15000,
        clicks_48h=1500,
        orders_count=55,
        attributed_revenue_idr=13695000.0,
        winning_angle="FOMO_AGITATION"
    )
    r_perf = ingest_closed_loop_feedback(payload=perf_payload, x_tenant_id=TENANT_A)
    assert r_perf["data"]["status"] == "CALIBRATED"

    # 7. Check Closed-Loop Status
    r_status = get_closed_loop_status(x_tenant_id=TENANT_A)
    assert r_status["data"]["total_calibrations"] >= 1
