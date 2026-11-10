"use client";

import { useState, useEffect } from "react";
import { 
  Sliders, 
  ShoppingBag, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Terminal, 
  PackageCheck, 
  FileText, 
  Smartphone, 
  Copy, 
  Check, 
  Send, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Zap,
  HelpCircle,
  Bot,
  Sparkles,
  Database,
  User,
  LifeBuoy,
  ShieldAlert,
  MessageCircle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  XCircle
} from "lucide-react";
import { 
  triggerSimulatedTikTokOrder, 
  triggerSimulatedWA, 
  getNotificationLogs, 
  NotificationLog, 
  TikTokSimulationResult, 
  formatRupiah,
  sendMockWhatsAppMessage,
  getWhatsAppBotHistory,
  getSupportTickets,
  sendTelegramCopilotMessage,
  updateSupportTicketStatus,
  SupportTicketItem
} from "@/lib/api";

export interface SocialDraft {
  id: string;
  title: string;
  caption: string;
  channels: ("Instagram" | "TikTok" | "Facebook" | "WhatsApp Status")[];
  targetAudience: string;
  hashtags: string[];
  suggestedMedia: string;
  generatedAt: string;
  status: "DRAFT" | "POSTED" | "REJECTED";
  postedAt?: string;
  simulatedUrl?: string;
}

export default function SimulatorPage() {
  // State: Tab Navigasi
  const [activeTab, setActiveTab] = useState<"ALL" | "SOCIAL_SWARM" | "CONTROL_PLANE" | "RAG_BOT" | "TIKTOK" | "NOTIFICATIONS">("ALL");

  // State: Social Media Swarm (Mocked Autonomous Agent)
  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>([
    {
      id: "draft-001",
      title: "🔥 Promo LCD iPhone 11 OEM - Diskon Spesial Minggu Ini!",
      caption: "Layar iPhone 11 retak atau touchscreen suka ghost touch? Jangan biarkan aktivitas kerjamu terganggu! 📱✨\n\nKhusus minggu ini, nikmati diskon ganti LCD Original OEM lengkap dengan garansi 1 bulan + kalibrasi True Tone gratis di meja kasir. Pengerjaan cepat cuma 30 menit bisa ditunggu!",
      channels: ["Instagram", "TikTok"],
      targetAudience: "Pemilik iPhone 11 & Komunitas Apple Jabodetabek",
      hashtags: ["#ServisiPhone", "#GantiLCD", "#AppleIndonesia", "#ServiceHPMurah", "#NexusRepair"],
      suggestedMedia: "Video perbandingan sebelum vs sesudah kalibrasi True Tone",
      generatedAt: "10 menit yang lalu (via Swarm Marketing Agent)",
      status: "DRAFT"
    },
    {
      id: "draft-002",
      title: "🔋 4 Tips Ampuh Merawat Baterai HP Tetap Awet & Tidak Kembung",
      caption: "Sering tinggal tidur HP dalam kondisi charging semalaman? 😱 Hati-hati IC power dan baterai cepat aus!\n\nBerikut 4 tips langsung dari tim teknisi Nexus:\n1. Jaga persentase baterai di rentang 20% - 80%.\n2. Hindari main game berat sambil charging.\n3. Selalu gunakan adaptor dan kabel bersertifikasi aman.\n4. Rutin kalibrasi baterai sebulan sekali.\n\nButuh ganti baterai original? Mampir ke outlet kami sekarang!",
      channels: ["TikTok", "Instagram", "WhatsApp Status"],
      targetAudience: "Semua Pengguna Smartphone Android & iPhone",
      hashtags: ["#TipsGadget", "#BatteryHealth", "#RawatHP", "#NexusTechTips"],
      suggestedMedia: "Infografis Carousel Tips Charging Sehat",
      generatedAt: "25 menit yang lalu (via Swarm Marketing Agent)",
      status: "DRAFT"
    },
    {
      id: "draft-003",
      title: "⚡ Solusi HP Mati Total (Matot) & Reball CPU Spesialis",
      caption: "Device kesayangan tiba-tiba mati total atau stuck di logo? Tenang, teknisi Nexus siap tangani perbaikan mikrosolder level mesin!\n\nMelayani reballing IC Power PM6150 dan chipset Qualcomm dengan presisi mikroskop. Garansi servis mesin hingga 45 hari. Konsultasi kerusakan GRATIS!",
      channels: ["Instagram", "Facebook"],
      targetAudience: "Pengguna Berat & Rekanan Teknisi Wilayah",
      hashtags: ["#ReballCPU", "#ServisMesinHP", "#ICPower", "#B2BService", "#TeknisiHP"],
      suggestedMedia: "Foto mikroskop pengerjaan soldering timah IC BGA",
      generatedAt: "1 jam yang lalu (via Swarm Marketing Agent)",
      status: "DRAFT"
    }
  ]);

  const [socialPostingHistory, setSocialPostingHistory] = useState<SocialDraft[]>([
    {
      id: "posted-001",
      title: "🎉 Grand Re-Opening Outlet Nexus & Promo Servis Ringan",
      caption: "Terima kasih untuk 500+ pelanggan setia bulan ini! Dapatkan voucher potongan Rp 25.000 untuk setiap transaksi servis di atas Rp 150.000.",
      channels: ["Instagram", "TikTok"],
      targetAudience: "Pelanggan Sekitar Toko",
      hashtags: ["#PromoServis", "#NexusOS", "#PromoHP"],
      suggestedMedia: "Foto Dokumentasi Tim Toko",
      generatedAt: "Kemarin",
      status: "POSTED",
      postedAt: "Kemarin, 14:30 WIB",
      simulatedUrl: "https://instagram.com/p/mock_nexus_promo_001"
    }
  ]);

  const [swarmAlert, setSwarmAlert] = useState<string | null>(null);

  const handleApproveDraft = (draftId: string) => {
    const draft = socialDrafts.find((d) => d.id === draftId);
    if (!draft) return;

    const timeNow = new Date().toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short"
    });

    const postedItem: SocialDraft = {
      ...draft,
      status: "POSTED",
      postedAt: `${timeNow} WIB`,
      simulatedUrl: `https://${draft.channels[0].toLowerCase().replace(/\s+/g, "")}.com/post/mock_${draftId}`
    };

    setSocialDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setSocialPostingHistory((prev) => [postedItem, ...prev]);
    setSwarmAlert(`✅ Postingan "${draft.title.slice(0, 30)}..." berhasil di-approve dan diposting ke ${draft.channels.join(", ")}!`);
    setTimeout(() => setSwarmAlert(null), 5000);
  };

  const handleRejectDraft = (draftId: string) => {
    const draft = socialDrafts.find((d) => d.id === draftId);
    if (!draft) return;

    setSocialDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setSwarmAlert(`❌ Postingan "${draft.title.slice(0, 30)}..." ditolak dan dihapus dari antrean draft.`);
    setTimeout(() => setSwarmAlert(null), 5000);
  };

  // State: Nexus Control Plane & Telegram Copilot
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [telegramSenderName, setTelegramSenderName] = useState("Budi (Owner Toko HP)");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [isTelegramSending, setIsTelegramSending] = useState(false);
  const [telegramChatHistory, setTelegramChatHistory] = useState<Array<{
    id: string;
    sender: "CLIENT" | "COPILOT";
    text: string;
    time: string;
    ticketNumber?: string;
  }>>([
    {
      id: "copilot-welcome",
      sender: "COPILOT",
      text: "Halo Pak Budi! Saya adalah Nexus Telegram Copilot yang terhubung langsung ke Nexus OS & Control Plane toko Anda. Ada yang bisa saya bantu terkait omset toko, info stok, atau keluhan teknis?",
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    }
  ]);

  // State: WhatsApp RAG Bot Simulator (Zero-Hallucination Agent)
  const [botPhone, setBotPhone] = useState("+6281234567890");
  const [botMessage, setBotMessage] = useState("");
  const [isBotSending, setIsBotSending] = useState(false);
  const [botChatHistory, setBotChatHistory] = useState<Array<{
    id: string;
    sender: "USER" | "BOT";
    text: string;
    time: string;
  }>>([
    {
      id: "initial-bot-msg",
      sender: "BOT",
      text: "Halo Kak! Saya Asisten Virtual Toko HP & Suku Cadang berbasis RAG. Ada yang bisa kami bantu seputar stok LCD, baterai, aksesoris, atau syarat garansi servis?",
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    }
  ]);

  // State: Tab & Loading TikTok
  const [isLoadingTikTok, setIsLoadingTikTok] = useState(false);
  const [tiktokResult, setTiktokResult] = useState<TikTokSimulationResult | null>(null);
  const [tiktokPaymentMethod, setTiktokPaymentMethod] = useState<"QRIS" | "COD">("QRIS");

  // State: WhatsApp Simulator Form
  const [waPhone, setWaPhone] = useState("+6281234567890");
  const [waCustomerName, setWaCustomerName] = useState("Budi Santoso");
  const [waDeviceModel, setWaDeviceModel] = useState("iPhone 11 64GB");
  const [waTemplateType, setWaTemplateType] = useState<"repair_done" | "aftercare_h1" | "aftercare_h7" | "aftercare_h14" | "custom">("aftercare_h1");
  const [waCustomMessage, setWaCustomMessage] = useState("");
  const [isLoadingWA, setIsLoadingWA] = useState(false);
  const [waSuccessNotice, setWaSuccessNotice] = useState<string | null>(null);

  // State: Notification Logs
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Fetch initial logs & tickets
  useEffect(() => {
    fetchLogs();
    fetchTickets();
  }, []);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await getNotificationLogs(30);
      if (res && res.logs) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.warn("Gagal mengambil log notifikasi:", e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const data = await getSupportTickets();
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch (e) {
      console.warn("Gagal mengambil tiket support:", e);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Handler: Telegram Copilot Message
  const handleSendTelegramMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || telegramMessage).trim();
    if (!textToSend) return;

    const userMsgId = `client_${Date.now()}`;
    const userTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // 1. Tampilkan pesan klien seketika di chat bubble
    setTelegramChatHistory((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "CLIENT",
        text: textToSend,
        time: userTime,
      }
    ]);
    if (!customPrompt) setTelegramMessage("");
    setIsTelegramSending(true);

    try {
      // 2. Kirim ke webhook Control Plane Telegram Copilot
      const res = await sendTelegramCopilotMessage({
        message: textToSend,
        sender_name: telegramSenderName,
      });

      // 3. Tampilkan balasan Copilot
      setTelegramChatHistory((prev) => [
        ...prev,
        {
          id: `copilot_${Date.now()}`,
          sender: "COPILOT",
          text: res.reply,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          ticketNumber: res.ticket_data?.ticket_number,
        }
      ]);

      // 4. Jika tiket dibuat, otomatis refresh daftar tiket Control Plane
      if (res.ticket_created) {
        setTimeout(() => {
          fetchTickets();
        }, 500);
      }
    } catch (err: any) {
      setTelegramChatHistory((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "COPILOT",
          text: "⚠️ Mohon maaf, terjadi kendala saat menghubungkan ke Copilot: " + (err.message || err),
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setIsTelegramSending(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateSupportTicketStatus(ticketId, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId || t.ticket_number === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.warn("Gagal memperbarui status tiket:", err);
    }
  };

  // Handler: WhatsApp RAG Smartbot Message
  const handleSendBotMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || botMessage).trim();
    if (!textToSend) return;

    const userMsgId = `user_${Date.now()}`;
    const userTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // 1. Tambahkan bubble chat pesan pengguna
    setBotChatHistory((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "USER",
        text: textToSend,
        time: userTime,
      }
    ]);
    if (!customPrompt) setBotMessage("");
    setIsBotSending(true);

    try {
      // 2. Kirim pesan ke mock-whatsapp webhook
      const res = await sendMockWhatsAppMessage({
        phone: botPhone,
        message: textToSend,
      });

      // 3. Tambahkan balasan bot AI ke riwayat chat
      setBotChatHistory((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: "BOT",
          text: res.bot_reply,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);

      // 4. Refresh log notifikasi database di bagian bawah
      setTimeout(() => {
        fetchLogs();
      }, 500);
    } catch (err: any) {
      setBotChatHistory((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "BOT",
          text: "⚠️ Mohon maaf, terjadi kegagalan sistem saat menghubungi asisten AI: " + (err.message || err),
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setIsBotSending(false);
    }
  };

  // Handler: Trigger TikTok Order
  const handleSimulateTikTokOrder = async () => {
    setIsLoadingTikTok(true);
    try {
      const res = await triggerSimulatedTikTokOrder({
        payment_method: tiktokPaymentMethod,
      });
      setTiktokResult(res);
      // Auto refresh notification logs after TikTok order
      setTimeout(() => {
        fetchLogs();
      }, 500);
    } catch (err: any) {
      alert("Gagal memproses simulasi TikTok Shop: " + (err.message || err));
    } finally {
      setIsLoadingTikTok(false);
    }
  };

  // Handler: Trigger WhatsApp
  const handleSimulateWA = async () => {
    if (!waPhone) {
      alert("Nomor telepon wajib diisi!");
      return;
    }

    setIsLoadingWA(true);
    setWaSuccessNotice(null);
    try {
      const res = await triggerSimulatedWA({
        phone: waPhone,
        template_type: waTemplateType,
        customer_name: waCustomerName,
        device_model: waDeviceModel,
        ticket_id: "REP-001",
        final_cost: 650000,
        custom_message: waCustomMessage,
      });

      setWaSuccessNotice(`Pesan berhasil dikirim (Simulasi) ke ${waPhone}`);
      setTimeout(() => setWaSuccessNotice(null), 3500);
      fetchLogs();
    } catch (err: any) {
      alert("Gagal mengirim simulasi WA: " + (err.message || err));
    } finally {
      setIsLoadingWA(false);
    }
  };

  const copyToClipboard = (textToCopy: string, id: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              API Sandbox & Mocking Engine
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Role: Owner / Admin Sandbox
            </span>
            <span className="text-xs text-gray-500 font-mono">X-Tenant-ID: 11111111...1111</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-purple-400" />
            Simulator Integrasi API (TikTok Shop & WhatsApp)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Uji coba seluruh alur bisnis dari pesanan marketplace hingga otomatisasi pesan WhatsApp tanpa menunggu akses API resmi.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoadingLogs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs font-medium text-gray-300 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin text-purple-400" : ""}`} />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* =====================================================================
          TAB NAVIGASI SIMULATOR
          ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "ALL"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          Semua Simulator
        </button>
        <button
          onClick={() => setActiveTab("SOCIAL_SWARM")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "SOCIAL_SWARM"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "bg-[#181818] text-violet-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Social Media Swarm</span>
          <span className="text-[10px] bg-violet-950/60 text-violet-300 px-1.5 py-0.2 rounded-full border border-violet-500/30">
            {socialDrafts.length} Draft
          </span>
        </button>
        <button
          onClick={() => setActiveTab("CONTROL_PLANE")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "CONTROL_PLANE"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-[#181818] text-amber-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Control Plane: Support Tickets</span>
          <span className="text-[10px] bg-amber-950/60 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/30">
            Fase 1
          </span>
        </button>
        <button
          onClick={() => setActiveTab("RAG_BOT")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "RAG_BOT"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-[#181818] text-emerald-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>WhatsApp RAG Smartbot</span>
          <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
            Sprint 2
          </span>
        </button>
        <button
          onClick={() => setActiveTab("TIKTOK")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "TIKTOK"
              ? "bg-pink-600 text-white shadow-md shadow-pink-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-pink-400" />
          <span>TikTok Shop Adapter</span>
        </button>
        <button
          onClick={() => setActiveTab("NOTIFICATIONS")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === "NOTIFICATIONS"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Notifikasi & Aftercare</span>
        </button>
      </div>

      {/* =====================================================================
          PANEL SOCIAL MEDIA SWARM: AUTONOMOUS MARKETING CONTENT ENGINE (MOCKED)
          ===================================================================== */}
      {(activeTab === "ALL" || activeTab === "SOCIAL_SWARM") && (
        <div className="space-y-6">
          {swarmAlert && (
            <div className="p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-200 text-xs flex items-center justify-between shadow-lg shadow-violet-900/20 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-violet-400" />
                <span>{swarmAlert}</span>
              </div>
              <button
                onClick={() => setSwarmAlert(null)}
                className="text-violet-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-violet-800/30"
              >
                ✕
              </button>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-[#141414] border border-violet-500/30 space-y-6 shadow-xl">
            {/* Header Swarm */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#242424] gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                  <Share2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                    Social Media Swarm Agent
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Multi-Agent Swarm
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Autopilot Ready
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generate draf konten promosi & tips teknis berdasarkan data inventori aktif dan profit margin tertinggi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Target Kanal:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f1f1f] text-pink-400 border border-[#333]">
                  Instagram
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f1f1f] text-cyan-400 border border-[#333]">
                  TikTok
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f1f1f] text-emerald-400 border border-[#333]">
                  WhatsApp Status
                </span>
              </div>
            </div>

            {/* Sub-Section 1: Approval Queue (Daftar Draft Menunggu) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Antrean Draf Konten AI (Menunggu Persetujuan)
                </h4>
                <span className="text-xs text-gray-400">
                  {socialDrafts.length} draf aktif
                </span>
              </div>

              {socialDrafts.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#181818] border border-[#262626] text-center text-gray-500 space-y-2">
                  <CheckCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-gray-300">Semua draf postingan telah diproses!</p>
                  <p className="text-xs text-gray-500">
                    Swarm agent akan otomatis men-generate ide konten baru saat terdeteksi produk baru atau promo toko.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {socialDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-[#181818] border border-[#292929] hover:border-violet-500/50 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors shadow-md"
                    >
                      <div className="space-y-2">
                        {/* Kanal & Waktu */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            {draft.channels.map((ch) => (
                              <span
                                key={ch}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-500">{draft.generatedAt}</span>
                        </div>

                        {/* Judul & Caption */}
                        <h5 className="font-bold text-xs text-white line-clamp-2">
                          {draft.title}
                        </h5>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line bg-[#131313] p-2.5 rounded-lg border border-[#242424] max-h-36 overflow-y-auto">
                          {draft.caption}
                        </p>

                        {/* Hashtags */}
                        <div className="flex flex-wrap gap-1">
                          {draft.hashtags.map((tag) => (
                            <span key={tag} className="text-[10px] text-purple-400 font-mono">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Saran Visual Media */}
                        <div className="p-2 rounded bg-[#1f1f1f] border border-[#2d2d2d] text-[10px] text-gray-400 flex items-start gap-1.5">
                          <span className="text-amber-400 shrink-0 font-bold">Media:</span>
                          <span>{draft.suggestedMedia}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-[#262626] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectDraft(draft.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-[#252525] hover:bg-rose-950/40 hover:text-rose-300 text-gray-400 border border-[#333] hover:border-rose-500/40 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveDraft(draft.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-900/30 flex items-center justify-center gap-1.5"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Approve & Post</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-Section 2: Posting History Ledger */}
            <div className="pt-4 border-t border-[#242424] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Riwayat Posting (Social Media Ledger)
                </h4>
                <span className="text-xs text-gray-400">
                  {socialPostingHistory.length} postingan berhasil dipublikasi
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#292929]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181818] text-gray-400 border-b border-[#292929]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Waktu Posting</th>
                      <th className="py-2.5 px-3 font-semibold">Judul Konten</th>
                      <th className="py-2.5 px-3 font-semibold">Kanal Target</th>
                      <th className="py-2.5 px-3 font-semibold">Audiens Target</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Tautan Simulasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]">
                    {socialPostingHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                          {item.postedAt}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate">
                          {item.title}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex gap-1">
                            {item.channels.map((ch) => (
                              <span
                                key={ch}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#222] text-gray-300 border border-[#333]"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-gray-400">
                          {item.targetAudience}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit mx-auto">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            POSTED
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              alert(`Simulasi membuka URL media sosial: ${item.simulatedUrl}`);
                            }}
                            className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                          >
                            <span>{item.simulatedUrl}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PANEL FASE 1: NEXUS CONTROL PLANE & TELEGRAM COPILOT (SAAS MANAGEMENT)
          ===================================================================== */}
      {(activeTab === "ALL" || activeTab === "CONTROL_PLANE") && (
        <div className="space-y-6">
          {/* 1. CHAT SIMULATOR: TELEGRAM COPILOT (CLIENT-FACING) */}
          <div className="p-6 rounded-2xl bg-[#141414] border border-amber-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <LifeBuoy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    AI Telegram Copilot Simulator (Client-Facing)
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Telegram Bot API
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      LangGraph Copilot
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Asisten Telegram untuk pemilik toko klien. Otomatis membedakan query bisnis (omset/stok) vs komplain bug/request fitur yang masuk ke Control Plane.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">Nama Pengirim:</span>
                <input
                  type="text"
                  value={telegramSenderName}
                  onChange={(e) => setTelegramSenderName(e.target.value)}
                  className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-white w-44 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Quick-Test Prompts Telegram Copilot */}
            <div>
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block mb-2">
                ⚡ Tombol Uji Coba Cepat (Quick Test Copilot):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSendTelegramMessage("Tolong dong, fitur split paymentnya error nih")}
                  disabled={isTelegramSending}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-rose-950/40 border border-[#2e2e2e] hover:border-rose-500/40 text-rose-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Simulasi pelaporan bug: AI otomatis mencatat tiket BUG ke Control Plane"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Coba: Split payment error (Lapor Bug)</span>
                </button>
                <button
                  onClick={() => handleSendTelegramMessage("Tolong tambahin fitur cetak barcode dong")}
                  disabled={isTelegramSending}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-purple-950/40 border border-[#2e2e2e] hover:border-purple-500/40 text-purple-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Simulasi permintaan fitur baru: AI mencatat tiket FEATURE_REQUEST"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Coba: Tambahin cetak barcode (Feature Request)</span>
                </button>
                <button
                  onClick={() => handleSendTelegramMessage("Berapa omset hari ini?")}
                  disabled={isTelegramSending}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-emerald-950/40 border border-[#2e2e2e] hover:border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Simulasi query bisnis: AI membaca omset hari ini (Read-Only)"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Coba: Berapa omset hari ini? (Business Query)</span>
                </button>
                <button
                  onClick={() => handleSendTelegramMessage("Stok LCD iPhone 11 ada berapa?")}
                  disabled={isTelegramSending}
                  className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-blue-950/40 border border-[#2e2e2e] hover:border-blue-500/40 text-blue-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Simulasi query stok barang"
                >
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Coba: Cek stok LCD iPhone 11</span>
                </button>
              </div>
            </div>

            {/* Chat Box (Telegram Theme) */}
            <div className="border border-[#282828] rounded-2xl bg-[#0c0c0c] overflow-hidden flex flex-col h-[340px]">
              <div className="px-4 py-2 bg-[#161616] border-b border-[#242424] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Nexus Telegram Copilot</span>
                    <span className="text-[10px] text-blue-400 block -mt-0.5">Connected to Nexus OS & Control Plane</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] text-gray-400 border border-[#2d2d2d]">
                  Tenant: Nexus HP Store
                </span>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {telegramChatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex flex-col ${
                      chat.sender === "CLIENT" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                        chat.sender === "CLIENT"
                          ? "bg-blue-600 text-white rounded-tr-xs"
                          : "bg-[#1c1c1c] border border-[#2b2b2b] text-gray-200 rounded-tl-xs"
                      }`}
                    >
                      {chat.text}
                    </div>
                    <span className="text-[9px] text-gray-500 mt-1 px-1">
                      {chat.time}
                    </span>
                  </div>
                ))}

                {isTelegramSending && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 p-2.5 bg-[#171717] rounded-xl w-fit border border-[#292929] animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Copilot sedang menganalisis intent & memproses data...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Field */}
              <div className="p-2.5 bg-[#161616] border-t border-[#242424] flex items-center gap-2">
                <input
                  type="text"
                  value={telegramMessage}
                  onChange={(e) => setTelegramMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTelegramMessage();
                    }
                  }}
                  placeholder="Ketik pesan chat Telegram (e.g. Tolong dong, fitur split paymentnya error nih)..."
                  className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
                <button
                  onClick={() => handleSendTelegramMessage()}
                  disabled={isTelegramSending || !telegramMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40 cursor-pointer"
                >
                  <span>Kirim</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. DASHBOARD MONITORING TIKET SUPPORT (SUPER ADMIN VIEW) */}
          <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Control Plane: Support Tickets Monitor
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Super Admin Access
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Memantau seluruh keluhan bug dan permintaan fitur dari seluruh tenant klien SaaS.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTickets}
                  disabled={isLoadingTickets}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs text-gray-300 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? "animate-spin text-purple-400" : ""}`} />
                  <span>Refresh Tiket</span>
                </button>
              </div>
            </div>

            {/* Stat Counters & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-4 gap-2 text-center w-full sm:w-auto">
                <div className="bg-[#181818] border border-[#262626] rounded-xl px-3 py-1.5">
                  <span className="text-[10px] text-gray-400 block font-semibold">TOTAL</span>
                  <span className="text-sm font-bold text-white">{tickets.length}</span>
                </div>
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] text-amber-400 block font-semibold">OPEN</span>
                  <span className="text-sm font-bold text-amber-300">
                    {tickets.filter((t) => t.status === "OPEN").length}
                  </span>
                </div>
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] text-blue-400 block font-semibold">PROG</span>
                  <span className="text-sm font-bold text-blue-300">
                    {tickets.filter((t) => t.status === "IN_PROGRESS").length}
                  </span>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                  <span className="text-[10px] text-emerald-400 block font-semibold">DONE</span>
                  <span className="text-sm font-bold text-emerald-300">
                    {tickets.filter((t) => t.status === "RESOLVED").length}
                  </span>
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
                {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTicketStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      ticketStatusFilter === st
                        ? "bg-purple-600 text-white"
                        : "bg-[#1a1a1a] text-gray-400 hover:text-white"
                    }`}
                  >
                    {st === "ALL" ? "Semua Status" : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Tickets Table */}
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                Belum ada tiket support yang diajukan. Gunakan simulasi Telegram Copilot di atas untuk mencoba.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1a1a1a] text-gray-400 font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">No. Tiket</th>
                      <th className="py-2.5 px-3">Tenant Klien</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-4">Subjek & Deskripsi Masalah</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Ubah Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {tickets
                      .filter((t) => ticketStatusFilter === "ALL" || t.status === ticketStatusFilter)
                      .map((t) => (
                        <tr key={t.id || t.ticket_number} className="hover:bg-[#191919] transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                            {t.ticket_number}
                          </td>
                          <td className="py-3 px-3 font-medium text-white whitespace-nowrap">
                            <div>
                              <span>{t.business_name}</span>
                              <span className="block text-[10px] text-gray-500 font-mono">
                                via {t.source}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                t.category === "BUG"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                  : t.category === "FEATURE_REQUEST"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              {t.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-sm text-gray-300">
                            <div className="font-semibold text-slate-100">{t.subject}</div>
                            <div className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{t.description}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                t.status === "OPEN"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : t.status === "IN_PROGRESS"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateTicketStatus(t.id || t.ticket_number, e.target.value)}
                              className="bg-[#222] border border-[#333] hover:border-gray-500 text-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-none"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="RESOLVED">RESOLVED</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PANEL UTAMA: WHATSAPP RAG SMARTBOT SIMULATOR (ZERO-HALLUCINATION AGENT)
          ===================================================================== */}
      {(activeTab === "ALL" || activeTab === "RAG_BOT") && (
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#222] gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  WhatsApp RAG Smartbot Simulator
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    LangGraph + Pgvector
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Zero-Hallucination
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Bot cerdas menjawab stok, harga multi-tier, dan aturan garansi secara akurat. Dilarang mengarang jawaban jika data tidak ada.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">No. WhatsApp Toko:</span>
              <input
                type="text"
                value={botPhone}
                onChange={(e) => setBotPhone(e.target.value)}
                className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-white font-mono w-36 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick-Test Prompts */}
          <div>
            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block mb-2">
              ⚡ Tombol Uji Coba Cepat (Quick Test):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSendBotMessage("Stok LCD iPhone 11 ada?")}
                disabled={isBotSending}
                className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-emerald-950/40 border border-[#2e2e2e] hover:border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Coba: Stok LCD iPhone 11</span>
              </button>
              <button
                onClick={() => handleSendBotMessage("Berapa lama garansi?")}
                disabled={isBotSending}
                className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-purple-950/40 border border-[#2e2e2e] hover:border-purple-500/40 text-purple-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Coba: Berapa lama garansi?</span>
              </button>
              <button
                onClick={() => handleSendBotMessage("Jam operasional toko buka jam berapa?")}
                disabled={isBotSending}
                className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-blue-950/40 border border-[#2e2e2e] hover:border-blue-500/40 text-blue-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Coba: Jam buka toko</span>
              </button>
              <button
                onClick={() => handleSendBotMessage("Bisa pinjam uang gak?")}
                disabled={isBotSending}
                className="px-3 py-1.5 rounded-lg bg-[#1c1c1c] hover:bg-amber-950/40 border border-[#2e2e2e] hover:border-amber-500/40 text-amber-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Menguji aturan Anti-Halusinasi (AI menolak mengarang dan mengarahkan ke admin manusia)"
              >
                <span>🛡️ Coba: Pertanyaan Out of Scope</span>
              </button>
            </div>
          </div>

          {/* Area Percakapan Chat WhatsApp */}
          <div className="border border-[#282828] rounded-2xl bg-[#0c0c0c] overflow-hidden flex flex-col h-[360px]">
            {/* Header Chat Box */}
            <div className="px-4 py-2.5 bg-[#161616] border-b border-[#242424] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Nexus Support Bot (WhatsApp)</span>
                  <span className="text-[10px] text-emerald-400 block -mt-0.5">Online • Zero-Hallucination Agent</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] text-gray-400 border border-[#2d2d2d]">
                Channel: WHATSAPP_RAG
              </span>
            </div>

            {/* Riwayat Chat Bubble */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {botChatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={`flex flex-col ${
                    chat.sender === "USER" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                      chat.sender === "USER"
                        ? "bg-emerald-600 text-white rounded-tr-xs"
                        : "bg-[#1c1c1c] border border-[#2b2b2b] text-gray-200 rounded-tl-xs"
                    }`}
                  >
                    {chat.text}
                  </div>
                  <span className="text-[9px] text-gray-500 mt-1 px-1">
                    {chat.time}
                  </span>
                </div>
              ))}

              {isBotSending && (
                <div className="flex items-center gap-2 text-xs text-purple-400 p-2.5 bg-[#171717] rounded-xl w-fit border border-[#292929] animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>LangGraph Agent sedang membaca inventori & knowledge base...</span>
                </div>
              )}
            </div>

            {/* Input Chat & Tombol Kirim */}
            <div className="p-2.5 bg-[#161616] border-t border-[#242424] flex items-center gap-2">
              <input
                type="text"
                value={botMessage}
                onChange={(e) => setBotMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendBotMessage();
                  }
                }}
                placeholder="Ketik pesan pelanggan (e.g. Stok LCD iPhone 11 ada?)..."
                className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
              <button
                onClick={() => handleSendBotMessage()}
                disabled={isBotSending || !botMessage.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <span>Kirim</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: 2 Modul Simulasi Tradisional (TikTok & WA Aftercare) */}
      {(activeTab === "ALL" || activeTab === "TIKTOK" || activeTab === "NOTIFICATIONS") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ===================================================================
              KARTU 1: SIMULATOR TIKTOK SHOP
              =================================================================== */}
          {(activeTab === "ALL" || activeTab === "TIKTOK") && (
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        TikTok Shop Adapter (Mock)
                      </h3>
                      <p className="text-xs text-gray-400">Simulasi Webhook Pesanan Masuk</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                    AWAITING_SHIPMENT
                  </span>
                </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-gray-300 leading-relaxed">
                Meniru webhook resmi TikTok Shop saat pembeli melakukan checkout. Logika backend akan otomatis:
              </p>
              
              <ul className="space-y-1.5 text-gray-400 font-mono text-[11px] pl-2 border-l border-[#2e2e2e]">
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">1.</span> Mencari item berdasarkan <code>marketplace_sku</code>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">2.</span> Mengurangi stok fisik & mencatat ke <code>stock_movements</code>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">3.</span> Membuat Jurnal Akuntansi double-entry (Debit Kas, Credit Penjualan, HPP)
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">4.</span> Memicu konfirmasi pesan otomatis ke WhatsApp pembeli
                </li>
              </ul>

              {/* Pilihan Metode Pembayaran TikTok */}
              <div className="pt-2">
                <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                  Metode Pembayaran Pembeli:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTiktokPaymentMethod("QRIS")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      tiktokPaymentMethod === "QRIS"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    QRIS / Transfer Bank
                  </button>
                  <button
                    onClick={() => setTiktokPaymentMethod("COD")}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      tiktokPaymentMethod === "COD"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    COD (Cash on Delivery)
                  </button>
                </div>
              </div>

              {/* Rincian Produk Demo yang Dipesan */}
              <div className="p-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] space-y-1.5 font-mono text-[11px]">
                <div className="text-[10px] text-gray-400 font-sans uppercase font-bold flex justify-between">
                  <span>Simulasi Keranjang Pesanan:</span>
                  <span className="text-purple-400">2 Item</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>2x Casing MagSafe Armor Clear</span>
                  <span className="text-emerald-400">Rp 150.000</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>1x Kabel Type-C 100W Braided</span>
                  <span className="text-emerald-400">Rp 55.000</span>
                </div>
                <div className="pt-1.5 border-t border-[#333] flex justify-between font-bold text-white">
                  <span>Total Tagihan:</span>
                  <span className="text-purple-300">Rp 205.000</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleSimulateTikTokOrder}
              disabled={isLoadingTikTok}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-pink-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>{isLoadingTikTok ? "Memproses Order & Jurnal..." : "Memicu Order TikTok Masuk"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Hasil Eksekusi TikTok */}
          {tiktokResult && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#181818] border border-emerald-500/40 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{tiktokResult.processing_result.message}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-gray-300">
                <div className="bg-[#121212] p-2 rounded border border-[#262626]">
                  <span className="text-gray-500 block text-[10px]">No. Order TikTok:</span>
                  <span className="text-white font-bold">{tiktokResult.processing_result.order_id}</span>
                </div>
                <div className="bg-[#121212] p-2 rounded border border-[#262626]">
                  <span className="text-gray-500 block text-[10px]">Jurnal Double-Entry:</span>
                  <span className="text-emerald-400 font-bold">Entry #{tiktokResult.processing_result.journal_entry_id ? tiktokResult.processing_result.journal_entry_id.slice(0, 8) : "Recorded"}</span>
                </div>
              </div>
            </div>
          )}
            </div>
          )}

          {/* ===================================================================
              KARTU 2: SIMULATOR WHATSAPP NOTIFICATION SERVICE
              =================================================================== */}
          {(activeTab === "ALL" || activeTab === "NOTIFICATIONS") && (
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    WhatsApp Business Adapter (Mock)
                  </h3>
                  <p className="text-xs text-gray-400">Simulasi Notifikasi & Aftercare</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                META GRAPH API MOCK
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Form Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                    Nomor WhatsApp:
                  </label>
                  <input
                    type="text"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="+6281234567890"
                    className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                    Nama Pelanggan:
                  </label>
                  <input
                    type="text"
                    value={waCustomerName}
                    onChange={(e) => setWaCustomerName(e.target.value)}
                    placeholder="Budi Santoso"
                    className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-semibold block mb-1 uppercase tracking-wider">
                  Model Perangkat HP:
                </label>
                <input
                  type="text"
                  value={waDeviceModel}
                  onChange={(e) => setWaDeviceModel(e.target.value)}
                  placeholder="iPhone 11 64GB"
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Template Presets */}
              <div>
                <label className="text-[11px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
                  Pilih Template Otomatisasi:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setWaTemplateType("repair_done")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      waTemplateType === "repair_done"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-white">📱 Servis Selesai</p>
                    <p className="text-[10px] text-gray-400">Notifikasi unit siap ambil & garansi 30h</p>
                  </button>

                  <button
                    onClick={() => setWaTemplateType("aftercare_h1")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      waTemplateType === "aftercare_h1"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-white">🛡️ Aftercare H+1</p>
                    <p className="text-[10px] text-gray-400">Cek fungsi layar sentuh & aktivasi garansi</p>
                  </button>

                  <button
                    onClick={() => setWaTemplateType("aftercare_h7")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      waTemplateType === "aftercare_h7"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-white">✨ Aftercare H+7</p>
                    <p className="text-[10px] text-gray-400">Cek kestabilan baterai & suhu unit</p>
                  </button>

                  <button
                    onClick={() => setWaTemplateType("aftercare_h14")}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      waTemplateType === "aftercare_h14"
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-[#1c1c1c] border-[#2e2e2e] text-gray-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-white">🎁 Promo H+14</p>
                    <p className="text-[10px] text-gray-400">Voucher diskon 15% aksesoris toko</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            {waSuccessNotice && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{waSuccessNotice}</span>
              </div>
            )}

            <button
              onClick={handleSimulateWA}
              disabled={isLoadingWA}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isLoadingWA ? "Mengirim Pesan..." : "Kirim Pesan WhatsApp (Simulasi)"}</span>
            </button>
          </div>
        </div>
      )}
        </div>
      )}

      {/* =====================================================================
          BAGIAN BAWAH: LOG NOTIFIKASI REAL-TIME (Tabel notification_logs)
          ===================================================================== */}
      <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Log Notifikasi WhatsApp Terkirim ({logs.length})
              </h3>
              <p className="text-xs text-gray-400">
                Pesan keluar yang terekam di sistem Nexus OS (Status: SIMULATED_SENT)
              </p>
            </div>
          </div>

          <span className="text-[11px] text-gray-400 font-mono">
            Tabel: <code>public.notification_logs</code>
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs">
            Belum ada notifikasi yang terkirim. Klik tombol simulasi di atas untuk mencoba.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1a1a1a] text-gray-400 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Waktu</th>
                  <th className="py-2.5 px-3">Nomor Tujuan</th>
                  <th className="py-2.5 px-3">Template</th>
                  <th className="py-2.5 px-4">Isi Pesan WhatsApp</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 rounded-r-lg text-center">Salin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#191919] transition-colors">
                    <td className="py-3 px-3 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString("id-ID") : "-"}
                    </td>
                    <td className="py-3 px-3 font-mono text-purple-300 font-semibold whitespace-nowrap">
                      {log.phone}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                        {log.template_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-sans max-w-md leading-relaxed whitespace-pre-wrap">
                      {log.message}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => copyToClipboard(log.message, log.id)}
                        className="p-1.5 rounded-lg bg-[#222] hover:bg-[#2e2e2e] text-gray-400 hover:text-white transition-colors"
                        title="Salin Pesan"
                      >
                        {copiedLogId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
