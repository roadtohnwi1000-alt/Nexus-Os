"use client";

import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Server, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  Layers, 
  Cpu, 
  DollarSign, 
  RefreshCw, 
  Sliders, 
  Settings2, 
  Check, 
  X, 
  ExternalLink, 
  Clock, 
  FileCode, 
  Zap, 
  Database, 
  Sparkles, 
  Play, 
  ChevronRight,
  ShieldAlert,
  Palette,
  Flag,
  ToggleLeft,
  ToggleRight,
  Bot,
  Lock,
  Unlock,
  Key,
  ArrowLeft
} from "lucide-react";
import { 
  getFleetStatus, 
  getApprovalQueue, 
  approveAction, 
  updateTenantConfig, 
  triggerDevOpsSwarm,
  getBillingRecords,
  updateBillingRecordStatus,
  getTenantChatHistory,
  getTenantCodeDiffs,
  getTenantAuditTrail,
  getGlobalIncidents,
  getTenantWeeklyHealthDigest,
  getTenantCircuitBreaker,
  updateTenantCircuitBreaker,
  FleetTenantItem, 
  ApprovalQueueItem, 
  BillingRecordItem, 
  formatRupiah 
} from "@/lib/api";

export interface SwarmActivityLog {
  id: string;
  time: string;
  status: "INFO" | "RUNNING" | "SUCCESS" | "WARNING";
  stage: string;
  message: string;
}

const INITIAL_ACTIVITY_LOGS: SwarmActivityLog[] = [
  {
    id: "act-log-1",
    time: "07:48:10",
    status: "INFO",
    stage: "INGESTION",
    message: "Ingesting error stacktrace from tenant 11111111-1111-1111-1111-111111111111 telemetry stream"
  },
  {
    id: "act-log-2",
    time: "07:48:12",
    status: "RUNNING",
    stage: "RAG_SEARCH",
    message: "Vector DB match: apps/core-api/app/api/v1/orders.py (Similarity 94.2%)"
  },
  {
    id: "act-log-3",
    time: "07:48:14",
    status: "RUNNING",
    stage: "E2B_SANDBOX",
    message: "Spawning isolated microVM container #vm-8921 on E2B hypervisor"
  },
  {
    id: "act-log-4",
    time: "07:48:16",
    status: "RUNNING",
    stage: "TEST_SUITE",
    message: "Executing pytest tests/test_orders.py in sandbox: 2/2 tests passed in 1.42s"
  },
  {
    id: "act-log-5",
    time: "07:48:18",
    status: "SUCCESS",
    stage: "EVALUATION",
    message: "Confidence score: 88%. Action queued to Super Admin Approval Queue (HITL)"
  }
];

export default function AdminCommandCenterPage() {
  // ===========================================================================
  // SUPER ADMIN & INTERNAL TECHNICIAN SECURITY GATE
  // ===========================================================================
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [passkeyError, setPasskeyError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("nexus_admin_authorized");
      if (saved === "true") {
        setIsAuthorized(true);
      }
    } catch (e) {
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const validKeys = ["2026", "nexusadmin", "admin2026"];
    if (validKeys.includes(passkeyInput.trim())) {
      setIsAuthorized(true);
      setPasskeyError("");
      try {
        sessionStorage.setItem("nexus_admin_authorized", "true");
      } catch (e) {}
    } else {
      setPasskeyError("Master Passkey tidak valid. Akses khusus pemilik platform & teknisi internal ditolak.");
    }
  };

  const handleLock = () => {
    setIsAuthorized(false);
    setPasskeyInput("");
    try {
      sessionStorage.removeItem("nexus_admin_authorized");
    } catch (e) {}
  };

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================
  const [fleet, setFleet] = useState<FleetTenantItem[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueueItem[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Filter & Layout
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<"ALL" | "HEALTHY" | "DEGRADED" | "NEEDS_APPROVAL">("ALL");
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "FLEET" | "APPROVALS" | "LIVE_ACTIVITY" | "BILLING" | "DEVOPS_TEST">("OVERVIEW");

  // State Global Billing Tracker
  const [billingList, setBillingList] = useState<BillingRecordItem[]>([]);
  const [billingTotalCost, setBillingTotalCost] = useState(0);
  const [billingTotalTokens, setBillingTotalTokens] = useState(0);
  const [billingPendingCost, setBillingPendingCost] = useState(0);
  const [billingPaidCost, setBillingPaidCost] = useState(0);
  const [billingFilterType, setBillingFilterType] = useState<string>("ALL");
  const [billingFilterStatus, setBillingFilterStatus] = useState<string>("ALL");
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [updatingBillingId, setUpdatingBillingId] = useState<string | null>(null);

  // State Live Swarm Activity (Mocked WebSocket)
  const [activityLogs, setActivityLogs] = useState<SwarmActivityLog[]>(INITIAL_ACTIVITY_LOGS);
  const [isStreamingActivity, setIsStreamingActivity] = useState(false);

  // State Modal Konfigurasi Tenant (Feature Flags)
  const [selectedTenantForConfig, setSelectedTenantForConfig] = useState<FleetTenantItem | null>(null);
  const [modalTheme, setModalTheme] = useState<string>("dark");
  const [modalFeatureFlags, setModalFeatureFlags] = useState<Record<string, boolean>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState<string | null>(null);

  // State Sub-Tab Modal Inspeksi & Audit Tenant (Fase 5.6 & 5.7)
  const [modalActiveSubTab, setModalActiveSubTab] = useState<"CONFIG" | "CHAT" | "DIFFS" | "DIGEST">("CONFIG");
  const [tenantChatLogs, setTenantChatLogs] = useState<any[]>([]);
  const [isLoadingTenantChats, setIsLoadingTenantChats] = useState(false);
  const [tenantCodeDiffs, setTenantCodeDiffs] = useState<any[]>([]);
  const [isLoadingTenantDiffs, setIsLoadingTenantDiffs] = useState(false);
  const [tenantCircuitBreaker, setTenantCircuitBreaker] = useState<any | null>(null);
  const [tenantHealthDigest, setTenantHealthDigest] = useState<any | null>(null);
  const [isLoadingHealthDigest, setIsLoadingHealthDigest] = useState(false);
  const [isUpdatingCircuitBreaker, setIsUpdatingCircuitBreaker] = useState(false);

  // Playbook 5.7: Global Deduplicated Incidents
  const [globalIncidents, setGlobalIncidents] = useState<any[]>([]);

  // State Review Tindakan (Approve / Reject)
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [expandedPatchId, setExpandedPatchId] = useState<string | null>(null);

  // State Simulasi Pemicu DevOps Swarm
  const [testIssueDesc, setTestIssueDesc] = useState("Split payment error saat koneksi terputus dan disinkronkan kembali");
  const [testTenantId, setTestTenantId] = useState("11111111-1111-1111-1111-111111111111");
  const [isTriggeringSwarm, setIsTriggeringSwarm] = useState(false);
  const [swarmResult, setSwarmResult] = useState<any | null>(null);

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([fetchFleet(), fetchQueue(), fetchBillingData(), fetchGlobalIncidents()]);
  };

  const fetchGlobalIncidents = async () => {
    try {
      const res = await getGlobalIncidents();
      setGlobalIncidents(res?.incidents || []);
    } catch (e) {
      console.warn("Gagal memuat insiden global:", e);
    }
  };

  const fetchFleet = async () => {
    setIsLoadingFleet(true);
    try {
      const data = await getFleetStatus();
      setFleet(data);
    } catch (e) {
      console.warn("Gagal memuat status armada:", e);
    } finally {
      setIsLoadingFleet(false);
    }
  };

  const fetchQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const data = await getApprovalQueue();
      if (data && data.queue) {
        setApprovalQueue(data.queue);
      }
    } catch (e) {
      console.warn("Gagal memuat approval queue:", e);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const fetchBillingData = async () => {
    setIsLoadingBilling(true);
    try {
      const res = await getBillingRecords({
        task_type: billingFilterType,
        status: billingFilterStatus,
      });
      if (res) {
        setBillingList(res.records || []);
        setBillingTotalCost(res.total_cost_idr || 0);
        setBillingTotalTokens(res.total_tokens || 0);
        setBillingPendingCost(res.pending_billing_idr || 0);
        setBillingPaidCost(res.paid_idr || 0);
      }
    } catch (err) {
      console.warn("Gagal memuat billing records:", err);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const handleUpdateBillingStatus = async (recordId: string, newStatus: "PENDING_BILLING" | "BILLED" | "PAID") => {
    setUpdatingBillingId(recordId);
    try {
      await updateBillingRecordStatus(recordId, newStatus);
      await fetchBillingData();
    } catch (err: any) {
      alert("Gagal mengubah status penagihan: " + (err.message || err));
    } finally {
      setUpdatingBillingId(null);
    }
  };

  const handleSimulateLiveActivityStream = () => {
    if (isStreamingActivity) return;
    setIsStreamingActivity(true);

    const nowTime = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const newStreamSteps: SwarmActivityLog[] = [
      {
        id: `sim-${Date.now()}-1`,
        time: nowTime(),
        status: "RUNNING",
        stage: "TELEMETRY",
        message: "🟡 [Ingestion] Fetching crash telemetry logs from tenant microservices...",
      },
      {
        id: `sim-${Date.now()}-2`,
        time: nowTime(),
        status: "RUNNING",
        stage: "RAG_SEARCH",
        message: "🟡 [RAG Search] Vector codebase retrieval matched apps/core-api/app/api/v1/orders.py",
      },
      {
        id: `sim-${Date.now()}-3`,
        time: nowTime(),
        status: "RUNNING",
        stage: "SANDBOX_E2B",
        message: "🟡 [E2B Sandbox] Provisioning isolated MicroVM container #vm-3901...",
      },
      {
        id: `sim-${Date.now()}-4`,
        time: nowTime(),
        status: "RUNNING",
        stage: "SANDBOX_TEST",
        message: "🟡 [Test Runner] Running pytest tests/test_orders.py in isolated sandbox (3/5 tests)...",
      },
      {
        id: `sim-${Date.now()}-5`,
        time: nowTime(),
        status: "SUCCESS",
        stage: "CONFIDENCE",
        message: "🟢 [Evaluated] Sandbox test passed 100%. Confidence: 92% (Auto-Deploy ready).",
      },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < newStreamSteps.length) {
        const step = newStreamSteps[currentStep];
        setActivityLogs((prev) => [step, ...prev.slice(0, 15)]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsStreamingActivity(false);
      }
    }, 700);
  };

  // ===========================================================================
  // HANDLERS: APPROVE & REJECT ACTIONS (HITL)
  // ===========================================================================
  const handleDecision = async (actionId: string, decision: "APPROVE" | "REJECT") => {
    setProcessingActionId(actionId);
    setActionSuccessNotice(null);

    try {
      const res = await approveAction({
        action_id: actionId,
        decision,
        reviewer_notes: `Authorized by Super Admin via Command Center (${decision})`,
      });

      const message = decision === "APPROVE"
        ? `✅ Tindakan ${actionId} berhasil disetujui! Patch kode dideploy otomatis ke mikroVM tenant.`
        : `❌ Tindakan ${actionId} ditolak. Permintaan revisi dikirim kembali ke DevOps Swarm.`;

      setActionSuccessNotice(message);
      setTimeout(() => setActionSuccessNotice(null), 5000);

      // Hapus dari antrean lokal
      setApprovalQueue((prev) => prev.filter((item) => item.id !== actionId));

      // Refresh data fleet
      fetchFleet();
    } catch (err: any) {
      alert("Gagal memproses keputusan: " + (err.message || err));
    } finally {
      setProcessingActionId(null);
    }
  };

  // ===========================================================================
  // HANDLERS: TENANT CONFIG & FEATURE FLAGS
  // ===========================================================================
  const handleOpenConfigModal = async (tenant: FleetTenantItem) => {
    setSelectedTenantForConfig(tenant);
    setModalActiveSubTab("CONFIG");
    setModalTheme(tenant.ui_theme || "dark");
    setModalFeatureFlags(tenant.feature_flags || {
      enable_copilot: true,
      enable_advanced_analytics: false,
      enable_auto_po: false,
      enable_tiktok_sync: false,
    });
    setConfigSaveSuccess(null);

    // Ambil histori chat, diffs, circuit breaker, dan health digest
    setIsLoadingTenantChats(true);
    setIsLoadingTenantDiffs(true);
    setIsLoadingHealthDigest(true);
    try {
      const [chatRes, diffRes, cbRes, digestRes] = await Promise.all([
        getTenantChatHistory(tenant.tenant_id),
        getTenantCodeDiffs(tenant.tenant_id),
        getTenantCircuitBreaker(tenant.tenant_id),
        getTenantWeeklyHealthDigest(tenant.tenant_id),
      ]);
      setTenantChatLogs(chatRes?.messages || []);
      setTenantCodeDiffs(diffRes?.code_diffs || []);
      setTenantCircuitBreaker(cbRes?.circuit_breaker || null);
      setTenantHealthDigest(digestRes || null);
    } catch (e) {
      console.warn("Gagal memuat audit tenant:", e);
    } finally {
      setIsLoadingTenantChats(false);
      setIsLoadingTenantDiffs(false);
      setIsLoadingHealthDigest(false);
    }
  };

  const handleToggleCircuitBreaker = async () => {
    if (!selectedTenantForConfig) return;
    setIsUpdatingCircuitBreaker(true);
    try {
      const currentStatus = tenantCircuitBreaker?.status || "CLOSED";
      const nextAction = currentStatus === "CLOSED" ? "TRIP" : "RESET";
      const res = await updateTenantCircuitBreaker(selectedTenantForConfig.tenant_id, nextAction);
      setTenantCircuitBreaker(res.circuit_breaker);
    } catch (e: any) {
      alert("Gagal mengubah circuit breaker: " + (e.message || e));
    } finally {
      setIsUpdatingCircuitBreaker(false);
    }
  };

  const handleSaveTenantConfig = async () => {
    if (!selectedTenantForConfig) return;

    setIsSavingConfig(true);
    setConfigSaveSuccess(null);

    try {
      await updateTenantConfig(selectedTenantForConfig.tenant_id, {
        ui_theme: modalTheme,
        feature_flags: modalFeatureFlags,
      });

      setConfigSaveSuccess("✓ Konfigurasi tema dan Feature Flags berhasil disimpan ke database!");
      setTimeout(() => setConfigSaveSuccess(null), 3500);

      // Perbarui state lokal armada
      setFleet((prev) =>
        prev.map((t) =>
          t.tenant_id === selectedTenantForConfig.tenant_id
            ? { ...t, ui_theme: modalTheme, feature_flags: modalFeatureFlags }
            : t
        )
      );

      setTimeout(() => {
        setSelectedTenantForConfig(null);
      }, 1200);
    } catch (err: any) {
      alert("Gagal menyimpan konfigurasi: " + (err.message || err));
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ===========================================================================
  // HANDLERS: TRIGGER DEVOPS AGENT LIVE
  // ===========================================================================
  const handleRunDevOpsSwarm = async () => {
    if (!testIssueDesc.trim()) return;

    setIsTriggeringSwarm(true);
    setSwarmResult(null);

    try {
      const tenant = fleet.find((f) => f.tenant_id === testTenantId);
      const res = await triggerDevOpsSwarm({
        tenant_id: testTenantId,
        issue_description: testIssueDesc,
        business_name: tenant?.business_name,
      });

      setSwarmResult(res);
      // Auto refresh approval queue
      await fetchQueue();
      await fetchFleet();
    } catch (err: any) {
      alert("Gagal memicu DevOps Agent: " + (err.message || err));
    } finally {
      setIsTriggeringSwarm(false);
    }
  };

  // ===========================================================================
  // COMPUTED KPI METRICS
  // ===========================================================================
  const totalTenants = fleet.length;
  const healthyCount = fleet.filter((t) => t.health_status === "HEALTHY").length;
  const needsApprovalCount = approvalQueue.length;
  const totalTasks = fleet.reduce((sum, t) => sum + (t.active_tasks || 0), 0);
  const totalTokenSpend = fleet.reduce((sum, t) => sum + (t.token_cost_today || 0), 0);
  const totalMRR = fleet.reduce((sum, t) => sum + (t.monthly_mrr || 0), 0);

  // Jika sedang memeriksa sesi atau belum terotorisasi
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full bg-[#090d16] flex items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full bg-[#090d16] flex items-center justify-center p-4 select-none">
        <div className="max-w-md w-full bg-[#121622] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl ring-1 ring-purple-500/20 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold uppercase tracking-wider mb-2">
            Pusat Kendali Terbatas
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">
            NEXUS OS Command Center
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Halaman ini khusus untuk pemilik SaaS dan teknisi internal pengembang sistem. Pengguna reguler dilarang mengakses konsol ini.
          </p>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div className="text-left">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Master Developer Passkey:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Ketik passkey (default: 2026)..."
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <Key className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
              {passkeyError && (
                <div className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {passkeyError}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-lg shadow-purple-950/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" /> Buka Akses Command Center
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Dashboard Toko Klien
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Banner Internal Security Status */}
      <div className="max-w-7xl mx-auto mb-6 p-2.5 px-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-purple-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Sesi Teknisi Internal / Super Admin Aktif (Root Isolated Console)</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard Toko Klien
          </a>
          <button
            onClick={handleLock}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors"
          >
            <Lock className="w-3 h-3" /> Kunci Sesi
          </button>
        </div>
      </div>

      <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      {/* =====================================================================
          HEADER UTAMA COMMAND CENTER (SINGLE PANE OF GLASS)
          ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              Nexus Control Plane v3.0
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Role: Super Admin (Root Access)
            </span>
            <span className="text-xs font-mono text-gray-500">
              Tenant ID: 00000000-0000-0000-0000-000000000000
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Server className="w-7 h-7 text-purple-400" />
            Web Command Center & DevOps Fleet
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Pusat kendali enterprise untuk memantau kesehatan armada multi-tenant, otorisasi Human-in-the-Loop (HITL), dan manajemen Feature Flags.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={loadAllData}
            disabled={isLoadingFleet || isLoadingQueue}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs font-semibold text-gray-300 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFleet || isLoadingQueue ? "animate-spin text-purple-400" : ""}`} />
            <span>Sinkronkan Armada</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TOP KPI METRIC CARDS
          ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Armada Tenant</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalTenants} Toko</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Multi-tenant PostgreSQL Isolated</div>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Status Armada</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{healthyCount} Healthy</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Uptime rata-rata: 99.8%</div>
        </div>

        <div className="bg-[#141414] border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Approval Queue (HITL)</span>
            <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-amber-300">{needsApprovalCount} Menunggu</div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">Memerlukan otorisasi Super Admin</div>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Token Cost Hari Ini</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-300">${totalTokenSpend.toFixed(2)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{totalTasks} tugas agen AI swarm aktif</div>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Monthly MRR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{formatRupiah(totalMRR)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Pendapatan langganan SaaS</div>
        </div>
      </div>

      {/* =====================================================================
          NOTIFIKASI FEEDBACK ACTION
          ===================================================================== */}
      {actionSuccessNotice && (
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{actionSuccessNotice}</span>
          </div>
          <button
            onClick={() => setActionSuccessNotice(null)}
            className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB SUB-NAVIGASI COMMAND CENTER
          ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "OVERVIEW"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          Single Pane of Glass
        </button>
        <button
          onClick={() => setActiveTab("FLEET")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "FLEET"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Fleet Overview Grid</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#252525] text-gray-300">
            {fleet.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("APPROVALS")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "APPROVALS"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-[#181818] text-amber-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Approval Queue (HITL)</span>
          {approvalQueue.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold">
              {approvalQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("DEVOPS_TEST")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "DEVOPS_TEST"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "bg-[#181818] text-blue-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-blue-400" />
          <span>DevOps Swarm Trigger</span>
        </button>
        <button
          onClick={() => setActiveTab("LIVE_ACTIVITY")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "LIVE_ACTIVITY"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Live Agent Activity</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
        <button
          onClick={() => setActiveTab("BILLING")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "BILLING"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-[#181818] text-emerald-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>Global Billing & Requests</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#252525] text-gray-300">
            {billingList.length}
          </span>
        </button>
      </div>

      {/* =====================================================================
          MODUL 2: APPROVAL QUEUE PANEL (HUMAN-IN-THE-LOOP HITL)
          ===================================================================== */}
      {(activeTab === "OVERVIEW" || activeTab === "APPROVALS") && (
        <div className="p-6 rounded-2xl bg-[#141414] border border-amber-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  DevOps Approval Queue (Human-in-the-Loop)
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {approvalQueue.length} Menunggu Keputusan
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Agen AI DevOps telah menguji patch di sandbox mikroVM E2B. Otorisasi Super Admin diperlukan sebelum penerapan ke kontainer produksi tenant.
                </p>
              </div>
            </div>

            <button
              onClick={fetchQueue}
              disabled={isLoadingQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs text-gray-300 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? "animate-spin text-amber-400" : ""}`} />
              <span>Refresh Antrean</span>
            </button>
          </div>

          {approvalQueue.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-300">Antrean Bersih (0 Tindakan Pending)</p>
              <p className="text-gray-500 mt-0.5">Semua tindakan perbaikan otomatis telah disetujui atau diselesaikan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvalQueue.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#181818] border border-[#2b2b2b] hover:border-amber-500/40 rounded-xl p-4 space-y-3 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-amber-300 text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {item.id}
                        </span>
                        <span className="font-semibold text-white text-xs">
                          {item.business_name}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 px-1.5 py-0.5 bg-[#222] rounded">
                          {item.issue_id}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Sandbox: {item.sandbox_status}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Confidence: {Math.round(item.confidence_score * 100)}% (HITL)
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{item.issue_title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedPatchId(expandedPatchId === item.id ? null : item.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#222] hover:bg-[#2b2b2b] text-gray-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <FileCode className="w-3.5 h-3.5 text-purple-400" />
                        <span>{expandedPatchId === item.id ? "Sembunyikan Patch" : "Lihat Diff Patch"}</span>
                      </button>

                      <button
                        onClick={() => handleDecision(item.id, "REJECT")}
                        disabled={processingActionId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>

                      <button
                        onClick={() => handleDecision(item.id, "APPROVE")}
                        disabled={processingActionId === item.id}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/50 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {processingActionId === item.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{processingActionId === item.id ? "Mendeploy..." : "Approve & Deploy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Patch Diff Viewer */}
                  {expandedPatchId === item.id && (
                    <div className="mt-3 p-3 rounded-lg bg-[#0f0f0f] border border-[#262626] font-mono text-[11px] overflow-x-auto space-y-1">
                      <div className="text-gray-400 pb-1 border-b border-[#222] text-[10px] flex justify-between">
                        <span>Target File: <code>{item.target_file}</code></span>
                        <span className="text-emerald-400">Syntax: Unified Diff (Git Compatible)</span>
                      </div>
                      <pre className="text-gray-300 leading-relaxed pt-1">
                        {item.proposed_patch.split("\n").map((line, idx) => {
                          const isAdd = line.startsWith("+");
                          const isDel = line.startsWith("-");
                          const isHdr = line.startsWith("@");
                          return (
                            <div
                              key={idx}
                              className={
                                isAdd
                                  ? "text-emerald-400 bg-emerald-950/30 px-1 rounded"
                                  : isDel
                                  ? "text-rose-400 bg-rose-950/30 px-1 rounded"
                                  : isHdr
                                  ? "text-purple-400"
                                  : "text-gray-400"
                              }
                            >
                              {line}
                            </div>
                          );
                        })}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODUL 1: FLEET OVERVIEW GRID
          ===================================================================== */}
      {(activeTab === "OVERVIEW" || activeTab === "FLEET") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#262626] gap-3">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Fleet Overview Grid (Multi-Tenant Armada)
                </h3>
                <p className="text-xs text-gray-400">
                  Klik pada kartu tenant untuk membuka konfigurasi Feature Flags & Tema UI.
                </p>
              </div>
            </div>

            {/* Filter Status Armada */}
            <div className="flex items-center gap-1.5">
              {(["ALL", "HEALTHY", "DEGRADED", "NEEDS_APPROVAL"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFleetFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedFleetFilter === filter
                      ? "bg-purple-600 text-white"
                      : "bg-[#181818] text-gray-400 hover:text-white"
                  }`}
                >
                  {filter === "ALL" ? "Semua Status" : filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fleet
              .filter((t) => selectedFleetFilter === "ALL" || t.health_status === selectedFleetFilter)
              .map((tenant) => {
                const isHealthy = tenant.health_status === "HEALTHY";
                const isNeedsApproval = tenant.health_status === "NEEDS_APPROVAL";
                const isDegraded = tenant.health_status === "DEGRADED";

                return (
                  <div
                    key={tenant.tenant_id}
                    onClick={() => handleOpenConfigModal(tenant)}
                    className={`bg-[#141414] hover:bg-[#1a1a1a] rounded-2xl p-5 border cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-xl relative overflow-hidden group ${
                      isNeedsApproval
                        ? "border-amber-500/50 hover:border-amber-400"
                        : isDegraded
                        ? "border-yellow-500/40 hover:border-yellow-400"
                        : "border-[#262626] hover:border-purple-500/50"
                    }`}
                  >
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        isNeedsApproval
                          ? "bg-amber-400 animate-pulse"
                          : isDegraded
                          ? "bg-yellow-400"
                          : "bg-emerald-500"
                      }`}
                    />

                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] text-gray-400 border border-[#2b2b2b]">
                          {tenant.plan_type}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                            isNeedsApproval
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                              : isDegraded
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isNeedsApproval
                                ? "bg-amber-400"
                                : isDegraded
                                ? "bg-yellow-400"
                                : "bg-emerald-400"
                            }`}
                          />
                          {tenant.health_status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                        {tenant.business_name}
                      </h4>
                      <p className="text-[11px] font-mono text-gray-500 mt-0.5 truncate">
                        ID: {tenant.tenant_id.slice(0, 18)}...
                      </p>

                      {/* Stat Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#222] text-xs">
                        <div>
                          <span className="text-[10px] text-gray-500 block">Tugas Agen AI</span>
                          <span className="font-semibold text-slate-200">{tenant.active_tasks} Active</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">Token Spend</span>
                          <span className="font-semibold text-blue-300">${tenant.token_cost_today.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">Uptime</span>
                          <span className="font-semibold text-emerald-400">{tenant.uptime_percent}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">Tema UI</span>
                          <span className="font-semibold text-purple-300 capitalize">{tenant.ui_theme}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Feature Flags Pill */}
                    <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between text-[11px] text-gray-400">
                      <div className="flex items-center gap-1 text-purple-400 group-hover:translate-x-0.5 transition-transform">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span className="font-semibold">Konfigurasi Flags</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODUL 4: SIMULASI PEMICU DEVOPS SWARM AGENT
          ===================================================================== */}
      {(activeTab === "OVERVIEW" || activeTab === "DEVOPS_TEST") && (
        <div className="p-6 rounded-2xl bg-[#141414] border border-blue-500/30 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#222]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  DevOps Swarm Trigger (Uji Coba LangGraph State Machine)
                </h3>
                <p className="text-xs text-gray-400">
                  Uji coba siklus self-healing: Error Diagnosa $\rightarrow$ Codebase RAG $\rightarrow$ E2B Sandbox Test $\rightarrow$ Evaluasi Confidence Score.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              E2B MicroVM Sandbox Mock
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                  Target Tenant Armada:
                </label>
                <select
                  value={testTenantId}
                  onChange={(e) => setTestTenantId(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {fleet.map((f) => (
                    <option key={f.tenant_id} value={f.tenant_id}>
                      {f.business_name} ({f.plan_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                  Deskripsi Masalah / Insiden Bug:
                </label>
                <textarea
                  value={testIssueDesc}
                  onChange={(e) => setTestIssueDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-gray-500">Preset Uji:</span>
                <button
                  type="button"
                  onClick={() => setTestIssueDesc("Split payment error saat koneksi terputus dan disinkronkan kembali")}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#202020] hover:bg-[#282828] text-gray-300 border border-[#2e2e2e]"
                >
                  Split Payment Error
                </button>
                <button
                  type="button"
                  onClick={() => setTestIssueDesc("Request fitur cetak label barcode thermal 58mm untuk inventori")}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#202020] hover:bg-[#282828] text-gray-300 border border-[#2e2e2e]"
                >
                  Cetak Barcode Thermal
                </button>
              </div>

              <button
                onClick={handleRunDevOpsSwarm}
                disabled={isTriggeringSwarm}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-blue-950/40 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isTriggeringSwarm ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menjalankan LangGraph DevOps Swarm...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Jalankan Investigasi Swarm Agent</span>
                  </>
                )}
              </button>
            </div>

            {/* Hasil Eksekusi Swarm Live */}
            <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4 flex flex-col justify-between text-xs">
              <div>
                <span className="text-[10px] font-semibold text-gray-400 block uppercase tracking-wider mb-2">
                  Console Output LangGraph:
                </span>
                {swarmResult ? (
                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Action ID:</span>
                      <span className="text-blue-300">{swarmResult.action_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence:</span>
                      <span className="text-emerald-400 font-bold">
                        {Math.round((swarmResult.agent_state?.confidence_score || 0.85) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className="text-amber-300 font-bold">
                        {swarmResult.action_record?.approval_status}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#222]">
                      <span className="text-gray-500 block text-[10px]">Summary:</span>
                      <p className="text-slate-300 text-[10px] mt-0.5">
                        {swarmResult.action_record?.details}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-600 text-xs font-mono">
                    Menunggu pemicu pengujian DevOps Swarm Agent...
                  </div>
                )}
              </div>

              {swarmResult && (
                <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px]">
                  ✓ Patch baru telah dimasukkan ke Approval Queue di atas!
                </div>
              )}

              {/* SUBTAB 4: PLAYBOOK 5.7 WEEKLY DIGEST & CIRCUIT BREAKER */}
              {modalActiveSubTab === "DIGEST" && (
                <div className="space-y-4">
                  {/* Circuit Breaker Control Card */}
                  <div className={`p-4 rounded-xl border transition-colors ${
                    tenantCircuitBreaker?.status === "OPEN"
                      ? "bg-red-950/20 border-red-500/40 text-red-200"
                      : "bg-[#121212] border-[#2a2a2a] text-gray-200"
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className={`w-5 h-5 ${tenantCircuitBreaker?.status === "OPEN" ? "text-red-400" : "text-emerald-400"}`} />
                        <div>
                          <h4 className="font-bold text-white text-xs">
                            Circuit Breaker (Saklar Darurat Loop Anomali)
                          </h4>
                          <p className="text-[10px] text-gray-400">
                            Playbook 5.7.3: Memutus eksekusi agen jika terjadi loop error atau kuota token habis.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          tenantCircuitBreaker?.status === "OPEN"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          STATUS: {tenantCircuitBreaker?.status || "CLOSED"}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleCircuitBreaker}
                          disabled={isUpdatingCircuitBreaker}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                            tenantCircuitBreaker?.status === "OPEN"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : "bg-red-600 hover:bg-red-500 text-white"
                          }`}
                        >
                          {isUpdatingCircuitBreaker ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : tenantCircuitBreaker?.status === "OPEN" ? (
                            "Reset Saklar (CLOSED)"
                          ) : (
                            "Putus Darurat (TRIP)"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Health Digest Card */}
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#2a2a2a] space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h4 className="font-bold text-white text-xs">
                          Automated Weekly Health Digest
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">
                        Skor Kesehatan: <strong className="text-emerald-400">{tenantHealthDigest?.health_score || 98}/100</strong>
                      </span>
                    </div>

                    {isLoadingHealthDigest ? (
                      <div className="py-6 text-center text-gray-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Menyusun laporan mingguan otomatis...</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Uptime Server</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {tenantHealthDigest?.metrics?.uptime_percent ?? 99.98}%
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Bug AI Resolved</span>
                            <span className="text-sm font-bold text-purple-300">
                              {tenantHealthDigest?.metrics?.bugs_auto_resolved_by_ai ?? 0} Bug
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Token Digunakan</span>
                            <span className="text-sm font-bold text-blue-300">
                              {tenantHealthDigest?.metrics?.total_tokens_used ?? 0}
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Biaya AI (IDR)</span>
                            <span className="text-sm font-bold text-amber-300">
                              {formatRupiah(tenantHealthDigest?.metrics?.estimated_token_cost_idr || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] text-[11px] text-gray-300 leading-relaxed font-sans">
                          <p className="font-semibold text-white mb-1">Executive Summary AI:</p>
                          <p>{tenantHealthDigest?.executive_summary || "Operasional toko berjalan optimal dengan zero critical outage."}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODUL 3: LIVE AGENT ACTIVITY (MOCKED WEBSOCKET / TELEMETRY STREAM)
          ===================================================================== */}
      {(activeTab === "OVERVIEW" || activeTab === "LIVE_ACTIVITY") && (
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Live Agent Activity & Telemetry Stream
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    WebSocket Connected
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Streaming telemetri aktivitas autonomous agent saat mendiagnosa crash log, query RAG, dan pengujian E2B sandbox.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[10px] font-mono text-gray-500 hidden md:inline">
                ws://control-plane.nexusos.internal/agent-stream
              </span>
              <button
                onClick={handleSimulateLiveActivityStream}
                disabled={isStreamingActivity}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-purple-900/40"
              >
                {isStreamingActivity ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Streaming...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Simulasikan Aktivitas Live</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Terminal Event Stream Box */}
          <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-4 font-mono text-xs overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1c1c1c] text-[10px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60 inline-block"></span>
                <span className="ml-2 text-gray-400">Agent Swarm Event Log</span>
              </div>
              <span className="text-gray-500">Latency: 16ms • Protocol: WSS/v2</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-1 px-2 rounded hover:bg-[#141414] transition-colors"
                >
                  <span className="text-gray-500 shrink-0 text-[11px]">{log.time}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 ${
                      log.status === "SUCCESS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : log.status === "RUNNING"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {log.stage}
                  </span>
                  <span
                    className={`text-xs ${
                      log.status === "SUCCESS"
                        ? "text-emerald-300"
                        : log.status === "RUNNING"
                        ? "text-amber-200"
                        : "text-gray-300"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODUL 4: GLOBAL BILLING & FEATURE REQUESTS (CENTRAL INVOICING)
          ===================================================================== */}
      {(activeTab === "OVERVIEW" || activeTab === "BILLING") && (
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Global Billing Tracker & Custom Feature Requests
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {billingList.length} Catatan Penagihan
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Rekapitulasi terpusat penggunaan AI token, komputasi runtime, dan penagihan custom engineering untuk semua tenant.
                </p>
              </div>
            </div>

            <button
              onClick={fetchBillingData}
              disabled={isLoadingBilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs text-gray-300 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBilling ? "animate-spin text-purple-400" : ""}`} />
              <span>Segarkan Billing</span>
            </button>
          </div>

          {/* Mini KPI Cards for Billing */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#181818] p-3 rounded-xl border border-[#252525]">
              <span className="text-[10px] text-gray-400 font-semibold block">TOTAL REKAP PENAGIHAN</span>
              <span className="text-lg font-bold text-white">{formatRupiah(billingTotalCost)}</span>
            </div>
            <div className="bg-[#181818] p-3 rounded-xl border border-[#252525]">
              <span className="text-[10px] text-gray-400 font-semibold block">TOTAL AI TOKENS</span>
              <span className="text-lg font-bold text-blue-400">{billingTotalTokens.toLocaleString("id-ID")}</span>
            </div>
            <div className="bg-[#181818] p-3 rounded-xl border border-amber-500/20">
              <span className="text-[10px] text-amber-400 font-semibold block">PENDING BILLING</span>
              <span className="text-lg font-bold text-amber-400">{formatRupiah(billingPendingCost)}</span>
            </div>
            <div className="bg-[#181818] p-3 rounded-xl border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-semibold block">TAGIHAN LUNAS (PAID)</span>
              <span className="text-lg font-bold text-emerald-400">{formatRupiah(billingPaidCost)}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Tipe Task:</span>
              {(["ALL", "FEATURE_REQUEST", "BUG_FIX", "AUTO_DEPLOY"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setBillingFilterType(t);
                    getBillingRecords({ task_type: t, status: billingFilterStatus }).then((res) => {
                      if (res) setBillingList(res.records || []);
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    billingFilterType === t
                      ? "bg-purple-600 text-white"
                      : "bg-[#1c1c1c] text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "ALL" ? "Semua Tipe" : t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              {(["ALL", "PENDING_BILLING", "BILLED", "PAID"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setBillingFilterStatus(s);
                    getBillingRecords({ task_type: billingFilterType, status: s }).then((res) => {
                      if (res) setBillingList(res.records || []);
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    billingFilterStatus === s
                      ? "bg-purple-600 text-white"
                      : "bg-[#1c1c1c] text-gray-400 hover:text-white"
                  }`}
                >
                  {s === "ALL" ? "Semua Status" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Central Billing Table */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] text-gray-400 uppercase font-semibold">
                  <th className="pb-3">Tenant & Task</th>
                  <th className="pb-3">Tipe</th>
                  <th className="pb-3">Deskripsi Rekayasa</th>
                  <th className="pb-3 text-center">Durasi</th>
                  <th className="pb-3 text-center">Tokens</th>
                  <th className="pb-3 text-center">Kompleksitas</th>
                  <th className="pb-3 text-right">Estimasi Biaya</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Aksi Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]">
                {billingList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      Tidak ada catatan penagihan dengan filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  billingList.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#1a1a1a] transition">
                      <td className="py-3">
                        <div className="font-semibold text-white">{rec.business_name || "Nexus Tenant"}</div>
                        <div className="font-mono text-[10px] text-gray-500">{rec.task_id}</div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rec.task_type === "FEATURE_REQUEST"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : rec.task_type === "BUG_FIX"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}>
                          {rec.task_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-200 max-w-xs truncate" title={rec.description}>
                        {rec.description}
                      </td>
                      <td className="py-3 text-center font-mono text-gray-400">
                        {rec.agent_duration_seconds}s
                      </td>
                      <td className="py-3 text-center font-mono text-blue-300">
                        {rec.ai_token_cost}
                      </td>
                      <td className="py-3 text-center font-mono text-gray-400">
                        {(rec.complexity_score * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 text-right font-bold text-white">
                        {formatRupiah(rec.estimated_cost_idr || 0)}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          rec.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : rec.status === "BILLED"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {rec.status !== "BILLED" && rec.status !== "PAID" && (
                            <button
                              onClick={() => handleUpdateBillingStatus(rec.id, "BILLED")}
                              disabled={updatingBillingId === rec.id}
                              className="px-2 py-1 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-500/30 text-[10px] font-semibold transition"
                            >
                              Tandai Ditagih
                            </button>
                          )}
                          {rec.status !== "PAID" && (
                            <button
                              onClick={() => handleUpdateBillingStatus(rec.id, "PAID")}
                              disabled={updatingBillingId === rec.id}
                              className="px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold transition"
                            >
                              Tandai Lunas
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: TENANT INSPECTION, AUDIT TRAIL, CHAT & FEATURE FLAGS
          ===================================================================== */}
      {selectedTenantForConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#333] rounded-2xl max-w-2xl w-full p-6 text-left shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Inspeksi Tenant & Audit Trail</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      {selectedTenantForConfig.plan_type}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    {selectedTenantForConfig.business_name} • ID: {selectedTenantForConfig.tenant_id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTenantForConfig(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Tab Navigation Pills */}
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalActiveSubTab("CHAT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalActiveSubTab === "CHAT"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-[#141414] text-gray-400 hover:text-white hover:bg-[#202020]"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Chat & Keluhan Klien</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-300">
                  {tenantChatLogs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveSubTab("DIFFS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalActiveSubTab === "DIFFS"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-[#141414] text-gray-400 hover:text-white hover:bg-[#202020]"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Patch Kode & Diffs</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-300">
                  {tenantCodeDiffs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveSubTab("CONFIG")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalActiveSubTab === "CONFIG"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-[#141414] text-gray-400 hover:text-white hover:bg-[#202020]"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Feature Flags & Tema</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveSubTab("DIGEST")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  modalActiveSubTab === "DIGEST"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-[#141414] text-gray-400 hover:text-white hover:bg-[#202020]"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Digest & Circuit Breaker</span>
                {tenantCircuitBreaker?.status === "OPEN" && (
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                )}
              </button>
            </div>

            {configSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{configSaveSuccess}</span>
              </div>
            )}

            {/* Modal Body: Scrollable Content based on active subtab */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* SUBTAB 1: LIVE CHAT KLIEN */}
              {modalActiveSubTab === "CHAT" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-[#121212] border border-[#262626] flex items-center justify-between text-[11px] text-gray-400">
                    <span>Percakapan resmi Klien dengan Copilot AI (Terisolasi per tenant)</span>
                    <span className="text-emerald-400 font-mono">Stream Active</span>
                  </div>

                  {isLoadingTenantChats ? (
                    <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Memuat riwayat chat tenant...</span>
                    </div>
                  ) : tenantChatLogs.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 border border-dashed border-[#262626] rounded-xl">
                      Belum ada pesan bantuan atau keluhan dari tenant ini.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {tenantChatLogs.map((msg, idx) => (
                        <div
                          key={msg.id || idx}
                          className={`p-3 rounded-xl border leading-relaxed ${
                            msg.sender === "CLIENT"
                              ? "bg-indigo-950/20 border-indigo-500/30 text-indigo-100"
                              : "bg-[#141414] border-[#2a2a2a] text-gray-200"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
                            <span className="font-bold flex items-center gap-1.5">
                              {msg.sender === "CLIENT" ? (
                                <span className="text-indigo-400">👤 KLIEN TOKO</span>
                              ) : (
                                <span className="text-purple-400">🤖 AI COPILOT SWARM</span>
                              )}
                            </span>
                            <span className="font-mono">{msg.created_at?.slice(0, 19).replace("T", " ")}</span>
                          </div>
                          <p className="whitespace-pre-line text-xs">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 2: PATCH KODE & DIFFS */}
              {modalActiveSubTab === "DIFFS" && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-[#121212] border border-[#262626] text-[11px] text-gray-400">
                    Rekam jejak perbaikan kode otomatis yang disintesis AI Swarm untuk tenant ini.
                  </div>

                  {isLoadingTenantDiffs ? (
                    <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Memuat patch kode tenant...</span>
                    </div>
                  ) : tenantCodeDiffs.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 border border-dashed border-[#262626] rounded-xl">
                      Tidak ada antrean patch kode untuk tenant ini saat ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tenantCodeDiffs.map((diff, idx) => (
                        <div key={diff.id || idx} className="p-3.5 rounded-xl bg-[#121212] border border-[#2a2a2a] space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-bold text-white text-xs">{diff.issue_title || "Perbaikan Kode"}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              diff.approval_status === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : diff.approval_status === "REJECTED"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}>
                              {diff.approval_status}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-purple-300 truncate">
                            File Target: {diff.target_file}
                          </p>
                          <div className="bg-black/70 p-2.5 rounded-lg border border-[#222] font-mono text-[10px] text-emerald-400 overflow-x-auto">
                            <pre className="whitespace-pre">{diff.proposed_patch}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: TEMA & FEATURE FLAGS */}
              {modalActiveSubTab === "CONFIG" && (
                <div className="space-y-4">
                  {/* Tema UI Selection */}
                  <div>
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
                      <Palette className="w-4 h-4 text-purple-400" />
                      Tema Antarmuka Klien (UI Theme):
                    </label>
                    <select
                      value={modalTheme}
                      onChange={(e) => setModalTheme(e.target.value)}
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="dark">Dark Theme (Standard Cyberpunk)</option>
                      <option value="light">Light Theme (Clean Professional)</option>
                      <option value="pastel">Pastel Soft (F&B / Creative Store)</option>
                    </select>
                  </div>

                  {/* Feature Flags Switches (Feature Flags over Code Forking) */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Flag className="w-4 h-4 text-purple-400" />
                      Feature Flags (Aktivasi Fitur Tanpa Code Forking):
                    </label>

                    <div className="space-y-2 bg-[#121212] p-3 rounded-xl border border-[#262626]">
                      {[
                        {
                          key: "enable_copilot",
                          label: "Aktifkan AI Telegram Copilot",
                          desc: "Asisten bot Telegram untuk pemilik toko mengecek omset & tiket.",
                        },
                        {
                          key: "enable_advanced_analytics",
                          label: "Aktifkan Advanced Analytics & RFM",
                          desc: "Model data science segmentasi pelanggan otomatis.",
                        },
                        {
                          key: "enable_auto_po",
                          label: "Aktifkan Auto-PO & Inventory Forecasting",
                          desc: "Prediksi restok barang otomatis berdasarkan laju penjualan.",
                        },
                        {
                          key: "enable_tiktok_sync",
                          label: "Aktifkan TikTok Shop Adapter",
                          desc: "Sinkronisasi webhook pesanan marketplace secara real-time.",
                        },
                      ].map((item) => {
                        const isChecked = modalFeatureFlags[item.key] ?? false;

                        return (
                          <div
                            key={item.key}
                            onClick={() =>
                              setModalFeatureFlags((prev) => ({
                                ...prev,
                                [item.key]: !isChecked,
                              }))
                            }
                            className="flex items-start justify-between gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                          >
                            <div>
                              <span className="text-xs font-semibold text-white block">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                {item.desc}
                              </span>
                            </div>

                            <div className="pt-0.5">
                              {isChecked ? (
                                <div className="w-9 h-5 rounded-full bg-purple-600 flex items-center justify-end px-0.5 transition-colors">
                                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                                </div>
                              ) : (
                                <div className="w-9 h-5 rounded-full bg-[#2a2a2a] flex items-center justify-start px-0.5 transition-colors">
                                  <div className="w-4 h-4 rounded-full bg-gray-400 shadow-sm" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 4: PLAYBOOK 5.7 WEEKLY DIGEST & CIRCUIT BREAKER */}
              {modalActiveSubTab === "DIGEST" && (
                <div className="space-y-4">
                  {/* Circuit Breaker Control Card */}
                  <div className={`p-4 rounded-xl border transition-colors ${
                    tenantCircuitBreaker?.status === "OPEN"
                      ? "bg-red-950/20 border-red-500/40 text-red-200"
                      : "bg-[#121212] border-[#2a2a2a] text-gray-200"
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className={`w-5 h-5 ${tenantCircuitBreaker?.status === "OPEN" ? "text-red-400" : "text-emerald-400"}`} />
                        <div>
                          <h4 className="font-bold text-white text-xs">
                            Circuit Breaker (Saklar Darurat Loop Anomali)
                          </h4>
                          <p className="text-[10px] text-gray-400">
                            Playbook 5.7.3: Memutus eksekusi agen jika terjadi loop error atau kuota token habis.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          tenantCircuitBreaker?.status === "OPEN"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          STATUS: {tenantCircuitBreaker?.status || "CLOSED"}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleCircuitBreaker}
                          disabled={isUpdatingCircuitBreaker}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
                            tenantCircuitBreaker?.status === "OPEN"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : "bg-red-600 hover:bg-red-500 text-white"
                          }`}
                        >
                          {isUpdatingCircuitBreaker ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : tenantCircuitBreaker?.status === "OPEN" ? (
                            "Reset Saklar (CLOSED)"
                          ) : (
                            "Putus Darurat (TRIP)"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Health Digest Card */}
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#2a2a2a] space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h4 className="font-bold text-white text-xs">
                          Automated Weekly Health Digest
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">
                        Skor Kesehatan: <strong className="text-emerald-400">{tenantHealthDigest?.health_score || 98}/100</strong>
                      </span>
                    </div>

                    {isLoadingHealthDigest ? (
                      <div className="py-6 text-center text-gray-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Menyusun laporan mingguan otomatis...</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Uptime Server</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {tenantHealthDigest?.metrics?.uptime_percent ?? 99.98}%
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Bug AI Resolved</span>
                            <span className="text-sm font-bold text-purple-300">
                              {tenantHealthDigest?.metrics?.bugs_auto_resolved_by_ai ?? 0} Bug
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Token Digunakan</span>
                            <span className="text-sm font-bold text-blue-300">
                              {tenantHealthDigest?.metrics?.total_tokens_used ?? 0}
                            </span>
                          </div>
                          <div className="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                            <span className="text-[10px] text-gray-400 block">Biaya AI (IDR)</span>
                            <span className="text-sm font-bold text-amber-300">
                              {formatRupiah(tenantHealthDigest?.metrics?.estimated_token_cost_idr || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-[#181818] border border-[#262626] text-[11px] text-gray-300 leading-relaxed font-sans">
                          <p className="font-semibold text-white mb-1">Executive Summary AI:</p>
                          <p>{tenantHealthDigest?.executive_summary || "Operasional toko berjalan optimal dengan zero critical outage."}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-between shrink-0">
              <span className="text-[10px] text-gray-500 font-mono">
                PostgreSQL RLS Protected • Zero Cross-Leak
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTenantForConfig(null)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Tutup
                </button>

                {modalActiveSubTab === "CONFIG" && (
                  <button
                    type="button"
                    onClick={handleSaveTenantConfig}
                    disabled={isSavingConfig}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingConfig && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingConfig ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
