"""
Unit tests for Solo-Developer Playbook (Fase 5.7 Spec):
1. 5.7.1: Alert Deduplication Engine (anti-alert fatigue)
2. 5.7.2: Automated Weekly Health Digest
3. 5.7.3: Circuit Breaker System (TRIP & RESET anomaly protection)
"""

from app.api.v1.control_plane_api import (
    list_global_incidents,
    process_alert_deduplication,
    get_tenant_weekly_health_digest,
    get_tenant_circuit_breaker_status,
    update_tenant_circuit_breaker_status,
    DeduplicateAlertPayload,
    CircuitBreakerActionPayload,
    router as cp_router
)

DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111"
OTHER_TENANT_ID = "22222222-2222-2222-2222-222222222222"


def test_playbook_router_endpoints_registered():
    """Memverifikasi bahwa seluruh endpoint Playbook 5.7 telah terdaftar di router."""
    routes = {r.path for r in cp_router.routes}
    assert "/control-plane/incidents" in routes
    assert "/control-plane/incidents/deduplicate" in routes
    assert "/control-plane/tenants/{tenant_id}/health-digest" in routes
    assert "/control-plane/tenants/{tenant_id}/circuit-breaker" in routes


def test_alert_deduplication_engine():
    """Playbook 5.7.1: Menguji pengelompokan alert serupa menjadi 1 insiden global."""
    sig = "DatabaseLockTimeout:OrdersTable"
    
    # 1. Alert pertama dari Tenant 1 -> Membuat insiden global baru
    res1 = process_alert_deduplication(DeduplicateAlertPayload(
        tenant_id=DEMO_TENANT_ID,
        error_signature=sig,
        error_message="Lock wait timeout exceeded on orders table",
        severity="CRITICAL"
    ))
    assert res1["status"] == "success"
    assert res1["action"] == "NEW_INCIDENT_CREATED"
    inc_id = res1["incident_id"]

    # 2. Alert kedua dengan signature yang sama dari Tenant 2 -> Dikelompokkan ke insiden yang sama!
    res2 = process_alert_deduplication(DeduplicateAlertPayload(
        tenant_id=OTHER_TENANT_ID,
        error_signature=sig,
        error_message="Lock wait timeout exceeded on orders table",
        severity="CRITICAL"
    ))
    assert res2["status"] == "success"
    assert res2["action"] == "DEDUPLICATED_INTO_EXISTING_INCIDENT"
    assert res2["incident_id"] == inc_id
    assert res2["affected_tenants_count"] >= 2


def test_weekly_health_digest():
    """Playbook 5.7.2: Menguji pembuatan laporan mingguan otomatis tenant."""
    digest = get_tenant_weekly_health_digest(DEMO_TENANT_ID)
    assert digest["status"] == "success"
    assert digest["tenant_id"] == DEMO_TENANT_ID
    assert "metrics" in digest
    assert "uptime_percent" in digest["metrics"]
    assert "bugs_auto_resolved_by_ai" in digest["metrics"]
    assert "executive_summary" in digest
    assert digest["health_score"] >= 90


def test_circuit_breaker_trip_and_reset():
    """Playbook 5.7.3: Menguji saklar darurat Circuit Breaker (TRIP & RESET)."""
    # 1. Status awal harus CLOSED
    cb_init = get_tenant_circuit_breaker_status(DEMO_TENANT_ID)
    assert cb_init["status"] == "success"

    # 2. Trip darurat saklar
    trip_res = update_tenant_circuit_breaker_status(
        DEMO_TENANT_ID,
        CircuitBreakerActionPayload(action="TRIP", reason="Loop anomali terdeteksi")
    )
    assert trip_res["status"] == "success"
    assert trip_res["circuit_breaker"]["status"] == "OPEN"
    assert trip_res["circuit_breaker"]["reason"] == "Loop anomali terdeteksi"

    # 3. Reset pemulihan saklar
    reset_res = update_tenant_circuit_breaker_status(
        DEMO_TENANT_ID,
        CircuitBreakerActionPayload(action="RESET")
    )
    assert reset_res["status"] == "success"
    assert reset_res["circuit_breaker"]["status"] == "CLOSED"
    assert reset_res["circuit_breaker"]["reason"] is None
