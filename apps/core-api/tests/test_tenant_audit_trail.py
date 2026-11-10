"""
Unit tests for Control Plane Tenant-Isolated Audit Trail & History.
Verifies strict isolation per tenant_id for:
1. Chat History
2. Code Diffs History
3. Unified Audit Trail
"""

from app.api.v1.control_plane_api import (
    get_tenant_chat_history,
    get_tenant_code_diff_history,
    get_tenant_unified_audit_trail,
    router as cp_router
)

DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111"
OTHER_TENANT_ID = "22222222-2222-2222-2222-222222222222"
UNKNOWN_TENANT_ID = "99999999-9999-9999-9999-999999999999"


def test_control_plane_router_has_tenant_isolation_endpoints():
    """Memverifikasi bahwa router control-plane mendaftarkan seluruh endpoint isolasi tenant."""
    routes = {r.path for r in cp_router.routes}
    assert "/control-plane/tenants/{tenant_id}/chat-history" in routes
    assert "/control-plane/tenants/{tenant_id}/code-diffs" in routes
    assert "/control-plane/tenants/{tenant_id}/audit-trail" in routes


def test_get_tenant_chat_history_isolated():
    """Memastikan riwayat chat terisolasi 100% per tenant_id dan tidak bocor ke tenant lain."""
    # 1. Query chat history untuk Demo Tenant
    res_demo = get_tenant_chat_history(DEMO_TENANT_ID)
    assert res_demo["status"] == "success"
    assert res_demo["tenant_id"] == DEMO_TENANT_ID
    assert res_demo["total_messages"] >= 1
    for msg in res_demo["messages"]:
        assert msg["tenant_id"] == DEMO_TENANT_ID

    # 2. Query chat history untuk tenant yang tidak dikenal (harus kosong, zero leak)
    res_unknown = get_tenant_chat_history(UNKNOWN_TENANT_ID)
    assert res_unknown["status"] == "success"
    assert res_unknown["tenant_id"] == UNKNOWN_TENANT_ID
    assert res_unknown["total_messages"] == 0
    assert res_unknown["messages"] == []


def test_get_tenant_code_diffs_isolated():
    """Memastikan histori patch kode / Git diff hanya menampilkan perubahan milik tenant terkait."""
    # 1. Query code diffs untuk Demo Tenant
    res_demo = get_tenant_code_diff_history(DEMO_TENANT_ID)
    assert res_demo["status"] == "success"
    assert res_demo["tenant_id"] == DEMO_TENANT_ID
    for diff in res_demo["code_diffs"]:
        assert diff["tenant_id"] == DEMO_TENANT_ID
        assert "target_file" in diff
        assert "proposed_patch" in diff

    # 2. Query code diffs untuk Other Tenant
    res_other = get_tenant_code_diff_history(OTHER_TENANT_ID)
    assert res_other["status"] == "success"
    assert res_other["tenant_id"] == OTHER_TENANT_ID
    for diff in res_other["code_diffs"]:
        assert diff["tenant_id"] == OTHER_TENANT_ID


def test_get_tenant_unified_audit_trail():
    """Memastikan Unified Audit Trail merangkum seluruh artefak tenant secara presisi."""
    res = get_tenant_unified_audit_trail(DEMO_TENANT_ID)
    assert res["status"] == "success"
    assert res["tenant_id"] == DEMO_TENANT_ID
    assert "summary" in res
    assert "total_chat_interactions" in res["summary"]
    assert "total_code_patches" in res["summary"]
    assert "chat_history" in res
    assert "code_diffs" in res
    assert "billing_records" in res
    assert "runtime_config" in res
