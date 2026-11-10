"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  Ticket, 
  Receipt, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  ArrowLeft, 
  Cpu, 
  DollarSign, 
  ShieldCheck, 
  HelpCircle, 
  Zap, 
  FileCode,
  Layers
} from "lucide-react";
import { 
  getPortalMessages, 
  sendPortalChatMessage, 
  getBillingRecords, 
  PortalMessageItem, 
  BillingRecordItem, 
  formatRupiah 
} from "@/lib/api";

export default function ClientPortalPage() {
  const defaultTenantId = "11111111-1111-1111-1111-111111111111";
  const defaultTenantName = "Nexus HP Store (Demo Toko HP)";

  const [activeTab, setActiveTab] = useState<"CHAT" | "BILLING">("CHAT");

  // Chat State
  const [messages, setMessages] = useState<PortalMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newTicketNotice, setNewTicketNotice] = useState<{
    ticket_number: string;
    category: string;
    estimated_cost_idr?: number;
  } | null>(null);

  // Billing State
  const [billingRecords, setBillingRecords] = useState<BillingRecordItem[]>([]);
  const [totalCostIdr, setTotalCostIdr] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [pendingBillingIdr, setPendingBillingIdr] = useState(0);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  // Sample Ticket List for client tracking
  const [tickets, setTickets] = useState([
    {
      id: "TCK-1001",
      category: "BUG",
      subject: "Split Payment POS Offline Sync",
      status: "IN_PROGRESS",
      created_at: "2026-10-28T09:12:00Z"
    },
    {
      id: "TCK-1002",
      category: "FEATURE_REQUEST",
      subject: "Fitur Cetak Barcode Thermal Label 58mm",
      status: "OPEN",
      created_at: "2026-10-29T11:45:00Z"
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // ===========================================================================
  // INITIAL DATA FETCH
  // ===========================================================================
  useEffect(() => {
    loadChatMessages();
    loadBillingData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const loadChatMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const res = await getPortalMessages(defaultTenantId);
      if (res && res.messages) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.warn("Gagal memuat pesan portal:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadBillingData = async () => {
    setIsLoadingBilling(true);
    try {
      const res = await getBillingRecords({ tenant_id: defaultTenantId });
      if (res) {
        setBillingRecords(res.records || []);
        setTotalCostIdr(res.total_cost_idr || 0);
        setTotalTokens(res.total_tokens || 0);
        setPendingBillingIdr(res.pending_billing_idr || 0);
      }
    } catch (err) {
      console.warn("Gagal memuat data billing:", err);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  // ===========================================================================
  // SEND MESSAGE HANDLER
  // ===========================================================================
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputMessage("");

    // Optimistic client message
    const tempClientMsg: PortalMessageItem = {
      id: `temp-${Date.now()}`,
      tenant_id: defaultTenantId,
      sender: "CLIENT",
      message: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempClientMsg]);

    try {
      const response = await sendPortalChatMessage({
        tenant_id: defaultTenantId,
        message: text,
        sender_name: "Budi (Owner Toko HP)"
      });

      // Tambahkan balasan AI
      const aiReply: PortalMessageItem = {
        id: `ai-${Date.now()}`,
        tenant_id: defaultTenantId,
        sender: "AI",
        message: response.reply,
        created_at: response.timestamp || new Date().toISOString()
      };
      setMessages((prev) => [...prev, aiReply]);

      // Jika tiket baru dibuat
      if (response.ticket_created && response.ticket_data) {
        setNewTicketNotice({
          ticket_number: response.ticket_data.ticket_number,
          category: response.ticket_data.category,
          estimated_cost_idr: response.ticket_data.estimated_cost_idr
        });

        // Tambahkan ke daftar tiket lokal
        setTickets((prev) => [
          {
            id: response.ticket_data!.ticket_number,
            category: response.ticket_data!.category,
            subject: response.ticket_data!.subject,
            status: response.ticket_data!.status || "OPEN",
            created_at: new Date().toISOString()
          },
          ...prev
        ]);

        // Auto refresh billing data
        await loadBillingData();
      }
    } catch (err: any) {
      const errorReply: PortalMessageItem = {
        id: `err-${Date.now()}`,
        tenant_id: defaultTenantId,
        sender: "AI",
        message: "Mohon maaf, sistem Helpdesk sedang sibuk. Silakan coba kembali sesaat lagi.",
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto text-slate-100">
      {/* =====================================================================
          HEADER CLIENT PORTAL
          ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Link 
              href="/"
              className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#1f1f1f] hover:bg-[#2a2a2a] text-gray-400 hover:text-white border border-[#333] transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Toko
            </Link>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              Nexus Client Support Portal
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              AI Helpdesk Active (24/7)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Pusat Bantuan & Layanan Mandiri
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {defaultTenantName} • Tier: <span className="text-purple-400 font-semibold">PREMIUM</span> • ID: <span className="font-mono text-gray-500 text-xs">{defaultTenantId}</span>
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#171717] p-1.5 rounded-xl border border-[#262626]">
          <button
            onClick={() => setActiveTab("CHAT")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "CHAT"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-[#262626]"
            }`}
          >
            <Bot className="w-4 h-4" />
            Helpdesk AI Chat
          </button>
          <button
            onClick={() => setActiveTab("BILLING")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "BILLING"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-[#262626]"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Tiket & Billing
            {pendingBillingIdr > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: HELPDESK AI CHAT
          ===================================================================== */}
      {activeTab === "CHAT" && (
        <div className="space-y-4">
          {/* Notifikasi Tiket Baru */}
          {newTicketNotice && (
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <Ticket className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Tiket Resmi Berhasil Diterbitkan: <span className="font-mono text-blue-300">{newTicketNotice.ticket_number}</span>
                  </h4>
                  <p className="text-xs text-blue-300/80 mt-0.5">
                    Permintaan fitur/kendala telah dicatat di antrean Super Admin. Estimasi penagihan:{" "}
                    <span className="font-semibold text-white">
                      {formatRupiah(newTicketNotice.estimated_cost_idr || 0)}
                    </span>
                    . Anda dapat melacaknya di tab <strong>Tiket & Billing</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNewTicketNotice(null)}
                className="text-xs text-blue-400 hover:text-white px-2 py-1 rounded bg-blue-900/50"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Chat Container */}
          <div className="bg-[#121212] border border-[#262626] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
            {/* Chat Messages Timeline */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Memuat riwayat chat...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-base font-medium text-gray-400">Belum ada percakapan</p>
                  <p className="text-sm text-gray-500 mt-1">Mulai tanyakan kendala atau ajukan fitur baru di bawah.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isClient = msg.sender === "CLIENT";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isClient ? "justify-end" : "justify-start"}`}
                    >
                      {!isClient && (
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isClient
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-[#1c1c1c] text-slate-200 border border-[#2e2e2e] rounded-tl-none whitespace-pre-wrap"
                        }`}
                      >
                        <div className="text-[11px] opacity-70 mb-1 font-semibold flex items-center gap-1.5">
                          {isClient ? (
                            <>
                              <User className="w-3 h-3" /> Anda (Owner)
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-blue-400" /> Nexus AI Helpdesk
                            </>
                          )}
                        </div>
                        <div className="text-sm leading-relaxed">{msg.message}</div>
                        <div className="text-[10px] opacity-50 mt-1.5 text-right font-mono">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                      {isClient && (
                        <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {isSending && (
                <div className="flex gap-3 justify-start items-center text-gray-400 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-blue-400 animate-pulse" />
                  </div>
                  <div className="bg-[#1c1c1c] border border-[#2e2e2e] px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>AI Helpdesk sedang menganalisis & merespons...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-6 py-2.5 bg-[#171717] border-t border-[#262626] flex items-center gap-2 overflow-x-auto text-xs text-gray-400">
              <span className="text-[11px] text-gray-500 font-semibold shrink-0">💡 Saran:</span>
              <button
                onClick={() => handleSendMessage("Saya mau fitur RFM di dashboard")}
                className="px-2.5 py-1 rounded-full bg-[#202020] hover:bg-[#2a2a2a] hover:text-white border border-[#333] transition shrink-0"
              >
                Saya mau fitur RFM di dashboard
              </button>
              <button
                onClick={() => handleSendMessage("Bagaimana cara cetak nota servis thermal 58mm?")}
                className="px-2.5 py-1 rounded-full bg-[#202020] hover:bg-[#2a2a2a] hover:text-white border border-[#333] transition shrink-0"
              >
                Cara cetak nota servis thermal
              </button>
              <button
                onClick={() => handleSendMessage("Split payment POS sempat error saat offline sync")}
                className="px-2.5 py-1 rounded-full bg-[#202020] hover:bg-[#2a2a2a] hover:text-white border border-[#333] transition shrink-0"
              >
                Split payment sempat error offline
              </button>
            </div>

            {/* Chat Input Area */}
            <div className="p-4 bg-[#141414] border-t border-[#262626] flex items-center gap-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Tanyakan panduan operasional, laporkan bug, atau ajukan permintaan fitur baru..."
                rows={1}
                className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputMessage.trim()}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30 transition shrink-0"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: TIKET & BILLING TRACKER
          ===================================================================== */}
      {activeTab === "BILLING" && (
        <div className="space-y-8 animate-in fade-in">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
              <div className="text-gray-400 text-xs font-semibold flex items-center justify-between mb-2">
                <span>TOTAL TASK DIKERJAKAN AI</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{billingRecords.length} Task</div>
              <div className="text-xs text-gray-500 mt-1">Otomatisasi Swarm & Custom Engineering</div>
            </div>

            <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
              <div className="text-gray-400 text-xs font-semibold flex items-center justify-between mb-2">
                <span>TOTAL TOKEN AI DIGUNAKAN</span>
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{totalTokens.toLocaleString("id-ID")} Tokens</div>
              <div className="text-xs text-gray-500 mt-1">Konsumsi komputasi LLM state machine</div>
            </div>

            <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
              <div className="text-gray-400 text-xs font-semibold flex items-center justify-between mb-2">
                <span>TAGIHAN TERTUNDA</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{formatRupiah(pendingBillingIdr)}</div>
              <div className="text-xs text-amber-500/80 mt-1">Status: PENDING_BILLING</div>
            </div>

            <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
              <div className="text-gray-400 text-xs font-semibold flex items-center justify-between mb-2">
                <span>TOTAL BIAYA REKAYASA</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{formatRupiah(totalCostIdr)}</div>
              <div className="text-xs text-gray-500 mt-1">Komputasi + Sandbox MicroVM</div>
            </div>
          </div>

          {/* Section 1: Daftar Tiket Support Klien */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-400" />
                  Daftar Tiket Permintaan & Kendala
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Laporan kendala operasional dan permintaan fitur yang Anda ajukan via Web Portal.
                </p>
              </div>
              <span className="text-xs font-mono text-gray-500">{tickets.length} Tiket</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#262626] text-gray-400 text-xs uppercase font-semibold">
                    <th className="pb-3">No. Tiket</th>
                    <th className="pb-3">Kategori</th>
                    <th className="pb-3">Rincian Kendala / Fitur</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Tanggal Pengajuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202020]">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-[#1a1a1a] transition">
                      <td className="py-3 font-mono font-medium text-blue-400 text-xs">{t.id}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          t.category === "FEATURE_REQUEST"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}>
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 text-white font-medium">{t.subject}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 w-fit ${
                          t.status === "RESOLVED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : t.status === "IN_PROGRESS"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-400 font-mono">
                        {new Date(t.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Rincian Billing Tracker (Resource AI & Custom Development) */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Rincian Penagihan Komputasi AI & Custom Engineering
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Transparansi konsumsi token LLM, durasi agent, dan biaya rekayasa otomatis per task.
                </p>
              </div>
              <button
                onClick={loadBillingData}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-gray-300 flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBilling ? "animate-spin" : ""}`} />
                Segarkan Data
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#262626] text-gray-400 text-xs uppercase font-semibold">
                    <th className="pb-3">Task ID</th>
                    <th className="pb-3">Tipe</th>
                    <th className="pb-3">Deskripsi Pengerjaan</th>
                    <th className="pb-3 text-center">Durasi</th>
                    <th className="pb-3 text-center">Tokens</th>
                    <th className="pb-3 text-center">Kompleksitas</th>
                    <th className="pb-3 text-right">Estimasi Biaya</th>
                    <th className="pb-3 text-right">Status Penagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202020]">
                  {billingRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[#1a1a1a] transition">
                      <td className="py-3 font-mono text-xs text-gray-400">{r.task_id.slice(0, 12)}...</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.task_type === "FEATURE_REQUEST"
                            ? "bg-purple-500/20 text-purple-300"
                            : r.task_type === "BUG_FIX"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          {r.task_type}
                        </span>
                      </td>
                      <td className="py-3 text-white text-xs max-w-xs truncate" title={r.description}>
                        {r.description}
                      </td>
                      <td className="py-3 text-center text-xs font-mono text-gray-300">
                        {r.agent_duration_seconds}s
                      </td>
                      <td className="py-3 text-center text-xs font-mono text-blue-300">
                        {r.ai_token_cost}
                      </td>
                      <td className="py-3 text-center text-xs font-mono text-gray-300">
                        {(r.complexity_score * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 text-right font-semibold text-white text-xs">
                        {formatRupiah(r.estimated_cost_idr || 0)}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : r.status === "BILLED"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
