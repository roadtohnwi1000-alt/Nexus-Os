"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  BrainCircuit, 
  Send, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  BarChart3, 
  ArrowUpRight, 
  DollarSign, 
  Bot, 
  User, 
  Zap, 
  RefreshCw,
  ShoppingBag,
  Clock,
  ExternalLink,
  Wallet,
  Search,
  Share2,
  Smartphone,
  X
} from "lucide-react";
import { 
  sendAdvisoryMessage, 
  getAdvisoryQuickMetrics, 
  simulateCSuiteTelegram,
  AdvisoryResponse, 
  AdvisoryQuickMetrics, 
  AdvisoryStructuredData,
  formatRupiah 
} from "@/lib/api";
import PaywallGate from "@/components/PaywallGate";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  structuredData?: AdvisoryStructuredData | null;
  toolCalled?: string;
}

export default function AdvisoryPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: "Halo Pak/Bu Direktur! Saya adalah **C-Suite AI Advisory Engine** Anda. Saya siap membantu Anda melakukan audit performa bisnis retail HP & servis secara real-time. Anda dapat menanyakan tentang evaluasi dead stock, margin laba kategori, atau rekomendasi restock mingguan.",
      timestamp: "Baru saja",
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickMetrics, setQuickMetrics] = useState<AdvisoryQuickMetrics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Telegram Owner Remote Access State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramSimQuery, setTelegramSimQuery] = useState("");
  const [telegramLogs, setTelegramLogs] = useState<Array<{ sender: "owner" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: "🤖 Halo Pak Owner! Bot C-Suite @NexusExecutiveBot aktif. Silakan klik tombol atau ketik pertanyaan:",
      time: "10:00"
    }
  ]);
  const [isSimulatingTelegram, setIsSimulatingTelegram] = useState(false);

  const handleSimulateTelegram = async (queryText?: string) => {
    const q = (queryText || telegramSimQuery).trim();
    if (!q || isSimulatingTelegram) return;
    setTelegramLogs(prev => [...prev, { sender: "owner", text: q, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) }]);
    if (!queryText) setTelegramSimQuery("");
    setIsSimulatingTelegram(true);
    try {
      const res = await simulateCSuiteTelegram(q);
      setTelegramLogs(prev => [...prev, { sender: "bot", text: res.reply, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) }]);
    } catch (err: any) {
      setTelegramLogs(prev => [...prev, { sender: "bot", text: `⚠️ Kendala bot: ${err.message || err}`, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setIsSimulatingTelegram(false);
    }
  };

  // Load quick metrics saat inisialisasi
  useEffect(() => {
    async function loadMetrics() {
      try {
        const metrics = await getAdvisoryQuickMetrics();
        setQuickMetrics(metrics);
      } catch (err) {
        console.error("Gagal memuat quick metrics:", err);
      }
    }
    loadMetrics();
  }, []);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);

    try {
      const response: AdvisoryResponse = await sendAdvisoryMessage(text);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.reply,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        structuredData: response.structured_data,
        toolCalled: response.tool_called,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: `Maaf, terjadi kendala saat memproses analisa: ${err.message || "Gagal terhubung ke Advisory Engine"}`,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <PaywallGate
      featureKey="csuite_advisor"
      featureTitle="Autonomous C-Suite Advisory & Telegram Bot"
      featureDescription="Asisten eksekutif AI bertenaga LangGraph yang mengaudit arus kas toko, mendeteksi modal beku (dead stock), dan mengirim laporan ringkasan laba langsung ke Telegram Owner setiap pagi."
      benefits={[
        "Laporan laba & kas likuid otomatis dikirim ke Telegram Owner setiap hari",
        "Peringatan dini barang macet (Dead Stock) & modal terselubung",
        "Rekomendasi kuantitas restock pintar (AI Reorder Point)",
        "Bisa ditanya jawab lewat Telegram saat Owner sedang di luar kota",
      ]}
    >
      <div className="flex flex-col h-[calc(100vh-6rem)] max-w-6xl mx-auto text-slate-100">
      {/* =====================================================================
          EXECUTIVE HEADER & QUICK STATS
          ===================================================================== */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 md:p-5 mb-4 shadow-lg shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/30">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                  C-Suite Executive Advisory
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  LangGraph Powered
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Audit otomatis perputaran kas, margin kategori, dan rekomendasi restock cerdas
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-[#1b1b1b] border border-[#2c2c2c] text-xs">
              <span className="text-gray-400 block text-[10px]">Dana Beku (Dead Stock):</span>
              <span className="font-mono font-bold text-amber-400">
                {quickMetrics ? formatRupiah(quickMetrics.frozen_capital) : "Rp 18.450.000"}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#1b1b1b] border border-[#2c2c2c] text-xs">
              <span className="text-gray-400 block text-[10px]">Rata-rata Margin Toko:</span>
              <span className="font-mono font-bold text-emerald-400">
                {quickMetrics ? `${quickMetrics.avg_margin_pct}%` : "45.0%"}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#1b1b1b] border border-[#2c2c2c] text-xs">
              <span className="text-gray-400 block text-[10px]">Restock Kritis:</span>
              <span className="font-mono font-bold text-rose-400">
                {quickMetrics ? `${quickMetrics.critical_restock_count} Item (< 3 Hari)` : "2 Item"}
              </span>
            </div>

            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition shadow-sm"
              title="Akses C-Suite via Bot Telegram saat di luar kota"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Telegram Owner Bot</span>
            </button>
          </div>
        </div>

        {/* Quick Action Prompts */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#222] overflow-x-auto pb-1">
          <span className="text-[11px] text-gray-400 font-semibold shrink-0">Eksekusi Cepat:</span>
          {[
            { label: "🔥 Tren Pasar & Kapten Ads", prompt: "Gimana tren pasar viral dan apa saran kapten ads minggu ini?" },
            { label: "📊 Saldo Kas & Runway CFO", prompt: "Cek saldo kas likuid, burn rate, dan runway keuangan toko" },
            { label: "⚠️ Audit Modal Beku Dead Stock", prompt: "Cek barang dead stock dan dana beku di toko kita" },
            { label: "📦 Rekomendasi Restock & PO", prompt: "Berikan rekomendasi restock dan supplier terbaik minggu ini" },
            { label: "🚀 Buat Promo Cuci Gudang", prompt: "Buatkan promo cuci gudang untuk melikuidasi modal beku LCD iPhone XS Max" },
            { label: "📦 Terbitkan Draft PO Restock", prompt: "Buatkan draft PO restock LCD iPhone 11 ke supplier" },
            { label: "🔍 Scan Harga Pasar Kompetitor", prompt: "Cek harga pasar kompetitor untuk LCD iPhone 11" },
            { label: "📈 Margin Laba per Kategori", prompt: "Bagaimana analisis margin laba per kategori sparepart?" },
          ].map((chip) => (
            <button
              key={chip.label}
              disabled={isLoading}
              onClick={() => handleSendMessage(chip.prompt)}
              className="px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] hover:border-purple-500/50 text-[11px] text-gray-300 hover:text-white transition-all whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          CHAT STREAM AREA (MESSAGES & STRUCTURED COMPONENTS)
          ===================================================================== */}
      <div className="flex-1 bg-[#121212] border border-[#262626] rounded-2xl p-4 md:p-6 overflow-y-auto space-y-5 shadow-inner">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-4xl ${
              msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md ${
                msg.sender === "user"
                  ? "bg-purple-600"
                  : "bg-gradient-to-tr from-indigo-600 to-purple-600"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Content Bubble */}
            <div
              className={`rounded-2xl p-4 space-y-3 ${
                msg.sender === "user"
                  ? "bg-purple-600 text-white rounded-tr-none shadow-md"
                  : "bg-[#181818] border border-[#2a2a2a] text-gray-200 rounded-tl-none shadow-md w-full"
              }`}
            >
              {/* Header Label AI */}
              {msg.sender === "ai" && (
                <div className="flex items-center justify-between border-b border-[#262626] pb-2 text-[11px] text-gray-400">
                  <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    C-Suite Advisory Agent
                  </span>
                  <span className="text-gray-500">{msg.timestamp}</span>
                </div>
              )}

              {/* Teks Respon */}
              <p className="text-xs md:text-sm leading-relaxed whitespace-pre-line">
                {msg.text}
              </p>

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 1: TABEL DEAD STOCK & MODAL BEKU
                  =============================================================== */}
              {msg.structuredData?.type === "DEAD_STOCK_TABLE" && msg.structuredData.items && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3">
                  {/* Summary Box */}
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Total Dana Beku:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {formatRupiah(msg.structuredData.summary?.total_frozen_capital || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Jumlah Barang Macet:</span>
                      <span className="font-bold text-white">
                        {msg.structuredData.summary?.total_dead_items || 0} SKU ({msg.structuredData.summary?.total_units || 0} unit)
                      </span>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="text-amber-300 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Risiko Depresiasi Suku Cadang
                      </span>
                    </div>
                  </div>

                  {/* Tabel Dead Stock */}
                  <div className="overflow-x-auto rounded-xl border border-[#2b2b2b]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1f1f1f] text-gray-400 border-b border-[#2b2b2b]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">SKU</th>
                          <th className="py-2.5 px-3 font-semibold">Nama Barang</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Stok</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Modal Beku</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Hari Macet</th>
                          <th className="py-2.5 px-3 font-semibold">Rekomendasi Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {msg.structuredData.items.map((it) => (
                          <tr key={it.sku} className="hover:bg-[#202020] transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-purple-400">{it.sku}</td>
                            <td className="py-2 px-3 font-medium text-white">{it.name}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">{it.stock}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              {formatRupiah(it.frozen_capital)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {it.days_idle} hari
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[11px] text-gray-300">{it.action_suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action Trigger Button for Dead Stock Clearance */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => handleSendMessage("Buatkan promo cuci gudang untuk melikuidasi modal beku LCD iPhone XS Max")}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-purple-900/30"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Trigger Promo Cuci Gudang ke Marketing Studio →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 2: KARTU METRIK MARGIN KATEGORI
                  =============================================================== */}
              {msg.structuredData?.type === "CATEGORY_MARGIN_CARDS" && msg.structuredData.categories && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 pb-1">
                    <span>Distribusi Margin Laba Kotor per Kategori Bisnis:</span>
                    <span className="text-emerald-400 font-bold">
                      Rata-rata: {msg.structuredData.summary?.overall_margin_pct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {msg.structuredData.categories.map((cat) => (
                      <div
                        key={cat.category}
                        className="bg-[#141414] border border-[#2b2b2b] rounded-xl p-3.5 space-y-2 hover:border-purple-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-white">{cat.category}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cat.health === "EXCELLENT"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : cat.health === "HEALTHY"
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {cat.health}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <span className="text-xl font-mono font-extrabold text-white">
                            {cat.avg_margin_pct}%
                          </span>
                          <span className="text-[11px] text-gray-400">
                            Porsi Omzet: <strong className="text-purple-300">{cat.revenue_share_pct}%</strong>
                          </span>
                        </div>

                        {/* Progress Bar Margin */}
                        <div className="w-full bg-[#242424] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cat.health === "EXCELLENT"
                                ? "bg-emerald-500"
                                : cat.health === "HEALTHY"
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(100, cat.avg_margin_pct)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-[#222]">
                          <span>Laba Kotor:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {formatRupiah(cat.gross_profit)}
                          </span>
                        </div>

                        <p className="text-[10px] text-gray-400 leading-tight">
                          💡 {cat.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 3: TABEL REKOMENDASI RESTOCK & SMART PO
                  =============================================================== */}
              {msg.structuredData?.type === "RESTOCK_RECOMMENDATION_TABLE" && msg.structuredData.recommendations && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3">
                  {/* Warning Header */}
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Total Kebutuhan Anggaran:</span>
                      <span className="font-mono font-bold text-rose-400 text-sm">
                        {formatRupiah(msg.structuredData.summary?.total_estimated_budget || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Barang Berisiko Habis:</span>
                      <span className="font-bold text-white">
                        {msg.structuredData.summary?.critical_items_count || 0} SKU Kritis
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-rose-300 text-[10px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold">
                        Lead Time: 1-2 Hari
                      </span>
                    </div>
                  </div>

                  {/* Tabel Restock */}
                  <div className="overflow-x-auto rounded-xl border border-[#2b2b2b]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1f1f1f] text-gray-400 border-b border-[#2b2b2b]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">SKU</th>
                          <th className="py-2.5 px-3 font-semibold">Nama Barang</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Sisa Stok</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Sisa Hari</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Saran PO</th>
                          <th className="py-2.5 px-3 font-semibold">Supplier Pilihan</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Est. Biaya</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Prioritas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262626]">
                        {msg.structuredData.recommendations.map((rec) => (
                          <tr key={rec.sku} className="hover:bg-[#202020] transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-purple-400">{rec.sku}</td>
                            <td className="py-2 px-3 font-medium text-white">{rec.name}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">
                              {rec.current_stock}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.days_left < 3
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {rec.days_left} hari
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-emerald-400">
                              +{rec.suggested_order_qty} pcs
                            </td>
                            <td className="py-2 px-3 text-[11px] text-gray-300">{rec.supplier_name}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              {formatRupiah(rec.estimated_total_cost)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.priority === "CRITICAL"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : rec.priority === "HIGH"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                }`}
                              >
                                {rec.priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action Trigger Button for PO Restock */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => handleSendMessage("Buatkan draft PO restock LCD iPhone 11 ke supplier")}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-emerald-950/30"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Terbitkan Draft Purchase Order (PO) ke Supplier →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 4: ACTION CONFIRMATION CARD
                  =============================================================== */}
              {msg.structuredData?.type === "ACTION_CONFIRMATION" && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3 animate-in fade-in">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 via-[#181818] to-purple-950/20 border border-emerald-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Aksi Eksekutif Berhasil Diproses Sistem
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                        {msg.structuredData.action}
                      </span>
                    </div>

                    <div className="bg-[#121212] rounded-xl p-3 border border-[#262626] space-y-1.5 text-xs">
                      {Object.entries(msg.structuredData.details || {}).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 capitalize">{k.replace(/_/g, " ")}:</span>
                          <span className="font-mono font-semibold text-white">
                            {typeof v === "number" ? formatRupiah(v) : Array.isArray(v) ? v.join(", ") : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-gray-400 text-[10px]">Tersimpan di antrean approval & audit log</span>
                      {msg.structuredData.action?.includes("MARKETING") ? (
                        <Link 
                          href="/marketing"
                          className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          Buka Marketing Studio <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <Link 
                          href="/inventory/grn"
                          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          Buka Jadwal GRN Supplier <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 5: CASH FLOW & RUNWAY SUMMARY
                  =============================================================== */}
              {msg.structuredData?.type === "CASH_FLOW_SUMMARY" && msg.structuredData.summary && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3 animate-in fade-in">
                  <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-bold text-white">Posisi Likuiditas & Ketahanan Kas</h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        {msg.structuredData.summary.health_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[9px] text-gray-400">Kas Likuid</p>
                        <p className="text-xs font-bold text-purple-300 mt-0.5">
                          {formatRupiah(msg.structuredData.summary.liquid_cash)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[9px] text-emerald-400">Total Inflow</p>
                        <p className="text-xs font-bold text-emerald-300 mt-0.5">
                          +{formatRupiah(msg.structuredData.summary.total_inflows)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <p className="text-[9px] text-rose-400">Total Outflow</p>
                        <p className="text-xs font-bold text-rose-300 mt-0.5">
                          -{formatRupiah(msg.structuredData.summary.total_outflows)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                        <p className="text-[9px] text-cyan-300">Runway Kas</p>
                        <p className="text-xs font-bold text-cyan-300 mt-0.5">
                          {msg.structuredData.summary.runway_months} Bulan
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                      <span className="text-gray-400 text-[10px]">
                        Hutang AP 7 Hari: <strong className="text-rose-400">{formatRupiah(msg.structuredData.summary.upcoming_ap)}</strong>
                      </span>
                      <Link 
                        href="/reports"
                        className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 text-[11px]"
                      >
                        Buka Laporan Arus Kas CFO <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  KOMPONEN STRUKTURAL 6: COMPETITOR PRICE SCAN
                  =============================================================== */}
              {msg.structuredData?.type === "COMPETITOR_PRICE_SCAN" && (
                <div className="mt-3 pt-3 border-t border-[#262626] space-y-3 animate-in fade-in">
                  <div className="p-4 rounded-xl bg-[#141414] border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-white">
                          Intelijen Harga Pasar: {msg.structuredData.keyword}
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                        Multi-Platform Scrape
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <p className="text-[9px] text-cyan-400">Harga Toko Kita</p>
                        <p className="text-xs font-bold text-white mt-0.5">
                          {formatRupiah(msg.structuredData.our_price || 0)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#282828]">
                        <p className="text-[9px] text-gray-400">Harga Termurah</p>
                        <p className="text-xs font-bold text-gray-300 mt-0.5">
                          {formatRupiah(msg.structuredData.market_lowest || 0)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[9px] text-emerald-400">Rata-rata Pasar</p>
                        <p className="text-xs font-bold text-emerald-300 mt-0.5">
                          {formatRupiah(msg.structuredData.market_average || 0)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#282828]">
                        <p className="text-[9px] text-gray-400">Harga Tertinggi</p>
                        <p className="text-xs font-bold text-gray-300 mt-0.5">
                          {formatRupiah(msg.structuredData.market_highest || 0)}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-300 leading-relaxed bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a]">
                      💡 {msg.structuredData.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl rounded-tl-none p-4 text-xs text-gray-400 flex items-center gap-2 shadow-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>C-Suite Advisory Agent sedang menganalisis data ledger & inventori...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* =====================================================================
          CHAT INPUT COMPONENT
          ===================================================================== */}
      <div className="mt-4 pt-1">
        <div className="relative flex items-center bg-[#161616] border border-[#2e2e2e] focus-within:border-purple-500 rounded-2xl shadow-xl transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan analisis bisnis (misal: 'cek dead stock', 'analisis margin laba', 'rekomendasi PO')..."
            disabled={isLoading}
            className="w-full bg-transparent px-5 py-3.5 text-xs md:text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="mr-3 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODAL TELEGRAM OWNER REMOTE ACCESS BOT (@NexusExecutiveBot)
          ===================================================================== */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-sky-900/40 via-[#181818] to-[#141414] border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                  ✈️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">C-Suite Telegram Executive Bot</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-300 font-mono">@NexusExecutiveBot • Khusus Pemilik & Direksi</p>
                </div>
              </div>

              <button
                onClick={() => setIsTelegramModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telegram Chat Simulation Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0d1418] text-xs">
              {telegramLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${
                    log.sender === "owner" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl whitespace-pre-line leading-relaxed ${
                      log.sender === "owner"
                        ? "bg-[#005c4b] text-white rounded-tr-none shadow"
                        : "bg-[#202c33] text-gray-200 rounded-tl-none shadow border border-[#2a3942]"
                    }`}
                  >
                    {log.text}
                  </div>
                  <span className="text-[9px] text-gray-500 px-1 mt-0.5 font-mono">{log.time}</span>
                </div>
              ))}

              {isSimulatingTelegram && (
                <div className="flex items-center gap-2 text-sky-400 text-xs py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Bot sedang mengetik...</span>
                </div>
              )}
            </div>

            {/* Telegram Quick Inline Action Buttons */}
            <div className="p-3 bg-[#111b21] border-t border-[#222e35] space-y-2">
              <span className="text-[10px] text-gray-400 block font-semibold">Tombol Cepat Inline Keyboard Telegram:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSimulateTelegram("csuite_cash_flow")}
                  disabled={isSimulatingTelegram}
                  className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-sky-300 text-center border border-[#2a3942] transition"
                >
                  📊 Saldo Kas & Runway
                </button>
                <button
                  onClick={() => handleSimulateTelegram("csuite_dead_stock")}
                  disabled={isSimulatingTelegram}
                  className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-amber-300 text-center border border-[#2a3942] transition"
                >
                  ⚠️ Audit Modal Beku
                </button>
                <button
                  onClick={() => handleSimulateTelegram("csuite_restock_po")}
                  disabled={isSimulatingTelegram}
                  className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-rose-300 text-center border border-[#2a3942] transition"
                >
                  📦 Saran Restock PO
                </button>
                <button
                  onClick={() => handleSimulateTelegram("csuite_promo_deadstock")}
                  disabled={isSimulatingTelegram}
                  className="p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] text-[11px] font-semibold text-emerald-300 text-center border border-[#2a3942] transition"
                >
                  🚀 Launch Promo TikTok
                </button>
              </div>

              {/* Chat Input for Telegram */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={telegramSimQuery}
                  onChange={(e) => setTelegramSimQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSimulateTelegram();
                  }}
                  placeholder="Ketik chat eksekutif via Telegram..."
                  className="flex-1 bg-[#2a3942] border border-[#374248] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-sky-400"
                />
                <button
                  onClick={() => handleSimulateTelegram()}
                  disabled={isSimulatingTelegram || !telegramSimQuery.trim()}
                  className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PaywallGate>
  );
}
