"use client";

import React, { useState, useEffect } from "react";
import {
  Share2,
  Send,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Flame,
  TrendingUp,
  RefreshCw,
  PlusCircle,
  Youtube,
  Radio,
  Sliders,
  Sparkles,
  DollarSign,
  BarChart3,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  fetchPublicationChannels,
  connectPublicationChannel,
  fetchPrimeTimeSlots,
  fetchPublishingQueue,
  publishVideoNow,
  scheduleVideoPublication,
  fetchAttributionLinks,
  createAttributionLinkAPI,
  ingestClosedLoopFeedbackAPI,
  fetchClosedLoopStatusAPI,
  PublicationChannel,
  PublishedPost,
  AttributionLink,
  PrimeTimeSlot,
  ClosedLoopStatus,
} from "@/lib/api";

export default function PublishingPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "attribution" | "closed_loop" | "channels">("queue");
  const [channels, setChannels] = useState<PublicationChannel[]>([]);
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [links, setLinks] = useState<AttributionLink[]>([]);
  const [slots, setSlots] = useState<PrimeTimeSlot[]>([]);
  const [closedLoopStatus, setClosedLoopStatus] = useState<ClosedLoopStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filter
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // State Modal Buat Link Baru
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newLinkForm, setNewLinkForm] = useState({
    opportunity_code: "OPP-001",
    destination_url: "https://shopee.co.id/anker-official-store",
    short_code: "anker65w",
    campaign_tag: "shorts_affiliate_01",
  });

  // State Modal Jadwalkan Video Baru
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    video_job_id: "job-8bf26c27",
    opportunity_code: "OPP-001",
    platform: "YOUTUBE_SHORTS",
    channel_id: "",
    scheduled_for: "2026-11-03T19:30:00Z",
    caption: "Stop pakai charger lambat! Anker GaN 65W ini solusi fast charging aman dingin tanpa bikin baterai bocor.",
    hashtags: "#Shorts, #GadgetReview, #RacunShopee",
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [chanRes, postsRes, linksRes, slotsRes, loopRes] = await Promise.all([
        fetchPublicationChannels(),
        fetchPublishingQueue(),
        fetchAttributionLinks(),
        fetchPrimeTimeSlots(),
        fetchClosedLoopStatusAPI(),
      ]);

      setChannels(chanRes.channels || []);
      setPosts(postsRes.posts || []);
      setLinks(linksRes.links || []);
      setSlots(slotsRes.slots || []);
      setClosedLoopStatus(loopRes.data || null);

      if (chanRes.channels && chanRes.channels.length > 0) {
        setScheduleForm((prev) => ({ ...prev, channel_id: chanRes.channels[0].id }));
      }
    } catch (err: any) {
      console.error("Gagal memuat data distribusi:", err);
      showNotification("Gagal memuat data distribusi & atribusi", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Salin URL shortlink ke clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification(`Tautan ${text} disalin ke clipboard!`, "success");
  };

  // Publish langsung
  const handlePublishDirect = async (videoJobId: string, oppCode: string, platform: string, chanId: string) => {
    try {
      setActionLoading(true);
      const res = await publishVideoNow({
        video_job_id: videoJobId,
        opportunity_code: oppCode,
        platform: platform,
        channel_id: chanId,
        caption: "Beli charger aman di keranjang kuning! Diskon hari ini.",
        hashtags: ["#Shorts", "#FlashSale"],
      });
      setPosts((prev) => [res.post, ...prev]);
      showNotification(`Video berhasil dipublikasikan ke ${platform}!`, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal mempublikasikan video", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Jadwal Video
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await scheduleVideoPublication({
        video_job_id: scheduleForm.video_job_id,
        opportunity_code: scheduleForm.opportunity_code,
        platform: scheduleForm.platform,
        channel_id: scheduleForm.channel_id || channels[0]?.id || "chan_yt_01",
        scheduled_for: scheduleForm.scheduled_for,
        caption: scheduleForm.caption,
        hashtags: scheduleForm.hashtags.split(",").map((s) => s.trim()),
      });
      setPosts((prev) => [res.post, ...prev]);
      setIsScheduleModalOpen(false);
      showNotification(`Video dijadwalkan pada ${scheduleForm.scheduled_for}!`, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal menjadwalkan video", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Buat Link Atribusi
  const handleCreateLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await createAttributionLinkAPI({
        opportunity_code: newLinkForm.opportunity_code,
        destination_url: newLinkForm.destination_url,
        short_code: newLinkForm.short_code,
        campaign_tag: newLinkForm.campaign_tag,
      });
      setLinks((prev) => [res.link, ...prev]);
      setIsLinkModalOpen(false);
      showNotification(`Tautan https://nexus.to/${res.link.short_code} berhasil dibuat!`, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal membuat tautan atribusi", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Simulasi Penutupan Siklus Umpan Balik (Closed-Loop)
  const handleSimulateFeedback = async () => {
    try {
      setActionLoading(true);
      const res = await ingestClosedLoopFeedbackAPI({
        opportunity_code: "OPP-001",
        product_name: "Anker GaN 65W Fast Charger",
        views_48h: 18500,
        clicks_48h: 1420, // CTR ~7.6%
        orders_count: 58,
        attributed_revenue_idr: 14442000,
        winning_angle: "FOMO_AGITATION",
      });

      const updatedStatus = await fetchClosedLoopStatusAPI();
      setClosedLoopStatus(updatedStatus.data);
      showNotification("🚀 Siklus umpan balik tertutup selesai! Bobot algoritma Domain A terkalibrasi.", "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal mengkalibrasi umpan balik", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Perhitungan ringkasan atribusi
  const totalClicksAll = links.reduce((sum, l) => sum + (l.total_clicks || 0), 0);
  const totalOrdersAll = links.reduce((sum, l) => sum + (l.total_purchases || 0), 0);
  const totalGmvAll = links.reduce((sum, l) => sum + (l.attributed_gmv_idr || 0), 0);
  const totalCommissionAll = links.reduce((sum, l) => sum + (l.attributed_commission_idr || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm font-medium text-slate-400">
            Menghubungkan Pusat Distribusi & Atribusi Multi-Kanal (Fase 8)...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
            notification.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "bg-red-600 text-white border border-red-400"
          }`}
        >
          {notification.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Top Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
            <Share2 className="w-4 h-4" /> Domain C // Multi-Channel Publishing & Closed-Loop Attribution
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight flex items-center gap-3">
            Distribusi Multi-Kanal & Pelacak Atribusi
            <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Closed-Loop Active
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mempublikasikan video Remotion ke YouTube Shorts, TikTok, dan Reels secara teratur, melacak link checkout,
            dan mengalirkan metrik performa kembali ke algoritma tren Domain A.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors shadow-md"
          >
            <Calendar className="w-4 h-4" /> Jadwalkan Video
          </button>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-cyan-400" /> Buat Tautan Pelacak
          </button>
        </div>
      </header>

      {/* Tab Navigasi 4 Pilar */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "queue"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Send className="w-4 h-4" /> Antrean Publikasi ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab("attribution")}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "attribution"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <LinkIcon className="w-4 h-4" /> Link Atribusi & Omzet ({links.length})
        </button>
        <button
          onClick={() => setActiveTab("closed_loop")}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "closed_loop"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Tutup Siklus (Auto-Tuning)
        </button>
        <button
          onClick={() => setActiveTab("channels")}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "channels"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Radio className="w-4 h-4" /> Akun Terhubung ({channels.length})
        </button>
      </div>

      {/* TAB 1: ANTREAN PUBLIKASI & JADWAL TAYANG */}
      {activeTab === "queue" && (
        <div className="space-y-6">
          {/* Prime Time Golden Hour Recommendation Bar */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Rekomendasi Waktu Emas (Prime Time WIB)
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Algoritma merekomendasikan rilis video pada jam berikut untuk rasio tonton & interaksi maksimal:
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {slots.map((s, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-center"
                >
                  <div className="text-[11px] font-bold text-cyan-400">{s.time_wib.slice(0, 5)} WIB</div>
                  <div className="text-[10px] text-slate-400">{s.slot_name.split("(")[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                      {post.platform}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                        post.status === "PUBLISHED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : post.status === "SCHEDULED"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 line-clamp-3 mb-3 font-medium">"{post.caption}"</p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {post.hashtags?.map((h, i) => (
                      <span key={i} className="text-[10px] text-cyan-400/80 font-mono">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {post.published_at ? (
                      `Tayang: ${new Date(post.published_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`
                    ) : post.scheduled_for ? (
                      `Jadwal: ${new Date(post.scheduled_for).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`
                    ) : (
                      "Siap posting"
                    )}
                  </span>
                  {post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      Buka Video <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: LINK ATRIBUSI & STATISTIK OMZET */}
      {activeTab === "attribution" && (
        <div className="space-y-6">
          {/* Top Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400">Total Klik Tautan</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">{totalClicksAll.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Dari video TikTok & Shorts</div>
            </div>
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400">Pesanan Selesai</div>
              <div className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">{totalOrdersAll} Order</div>
              <div className="text-[11px] text-cyan-300 mt-0.5">Konversi e-commerce</div>
            </div>
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400">Omzet Diatribusikan (GMV)</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">
                Rp {totalGmvAll.toLocaleString("id-ID")}
              </div>
              <div className="text-[11px] text-amber-400 mt-0.5">Hasil tracking closed-loop</div>
            </div>
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400">Estimasi Komisi Afiliasi</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                Rp {totalCommissionAll.toLocaleString("id-ID")}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Rata-rata komisi 12%</div>
            </div>
          </div>

          {/* Links Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-cyan-400" /> Daftar Tautan Pelacak Aktif
              </h2>
              <span className="text-xs text-slate-400">{links.length} tautan terpantau</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-3">Kode Peluang</th>
                  <th className="pb-3">Tautan Singkat</th>
                  <th className="pb-3">Tujuan Checkout</th>
                  <th className="pb-3">Klik</th>
                  <th className="pb-3">Konversi (CVR)</th>
                  <th className="pb-3">Omzet (GMV)</th>
                  <th className="pb-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 font-mono font-bold text-cyan-400">{link.opportunity_code}</td>
                    <td className="py-3 font-mono text-white font-bold">{link.short_url}</td>
                    <td className="py-3 text-slate-400 truncate max-w-[200px]">{link.destination_url}</td>
                    <td className="py-3 font-mono text-slate-200">{link.total_clicks}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold font-mono">
                        {link.conversion_rate_pct}% ({link.total_purchases} beli)
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-amber-400">
                      Rp {link.attributed_gmv_idr?.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => copyToClipboard(link.short_url)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors inline-flex items-center gap-1"
                        title="Salin Tautan"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TUTUP SIKLUS (CLOSED-LOOP CALIBRATION ENGINE) */}
      {activeTab === "closed_loop" && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> CommerceOS Continuous Optimization
              </span>
              <h2 className="text-lg font-black text-white">
                Siklus Umpan Balik Tertutup Otomatis (Closed Feedback Loop)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sistem tidak berhenti hanya membuat video. Data penayangan riil 48 jam dan konversi checkout secara
                otomatis dialirkan kembali untuk mengkalibrasi rumus matematis{" "}
                <span className="text-amber-400 font-mono">Opportunity Score</span> di Domain A (The Brain).
              </p>
            </div>

            <button
              onClick={handleSimulateFeedback}
              disabled={actionLoading}
              className="py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
              Simulasikan Data 48 Jam & Kalibrasi Bobot
            </button>
          </div>

          {/* Active Mathematical Scoring Weights */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
              Bobot Aktif Rumus Skoring Peluang Pasar (Domain A):
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400">W_demand (Kecepatan Tren)</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">
                  {closedLoopStatus?.active_scoring_weights?.w_demand || 0.55}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Memprioritaskan produk dengan laju viral tinggi</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400">W_margin (Margin Laba / HPP)</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {closedLoopStatus?.active_scoring_weights?.w_margin || 0.28}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Memastikan margin keuntungan tetap sehat</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="text-xs text-slate-400">W_competition (Penalti Kejenuhan)</div>
                <div className="text-2xl font-black text-red-400 mt-1">
                  {closedLoopStatus?.active_scoring_weights?.w_competition || 0.17}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Mengurangi skor jika pasar sudah dibanjiri video serupa</div>
              </div>
            </div>
          </div>

          {/* Calibration Audit Trail */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Riwayat Kalibrasi Algoritma Berdasarkan Hasil Tayang:
            </h3>
            <div className="space-y-3">
              {closedLoopStatus?.recent_calibrations?.map((calib) => (
                <div
                  key={calib.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-400">
                      {calib.opportunity_code} - {calib.product_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(calib.calibrated_at).toLocaleString("id-ID")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                    <div>Views: {calib.views_48h.toLocaleString()}</div>
                    <div>Klik: {calib.clicks_48h.toLocaleString()} (CTR {calib.ctr_pct}%)</div>
                    <div>Pesanan: {calib.orders_count} Transaksi</div>
                    <div className="text-amber-400 font-bold">
                      Omzet: Rp {calib.attributed_revenue_idr.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-emerald-400">
                    <span className="font-semibold text-slate-400">Hasil Kalibrasi:</span> {calib.calibration_reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AKUN TERHUBUNG (CONNECTED CHANNELS) */}
      {activeTab === "channels" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                    {ch.platform}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{ch.channel_name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{ch.channel_handle}</div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Kuota Harian:</span>
                <span className="text-white font-mono font-bold">
                  {ch.posts_today} / {ch.daily_post_limit} Video
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Jadwalkan Video */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" /> Jadwalkan Rilis Video
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Pilih kanal tujuan dan waktu rilis otomatis untuk memaksimalkan retensi penonton.
            </p>

            <form onSubmit={handleScheduleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Kanal Publikasi:</label>
                <select
                  value={scheduleForm.channel_id}
                  onChange={(e) => {
                    const ch = channels.find((c) => c.id === e.target.value);
                    setScheduleForm({
                      ...scheduleForm,
                      channel_id: e.target.value,
                      platform: ch ? ch.platform : scheduleForm.platform,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.platform} - {c.channel_name} ({c.channel_handle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Jadwal Rilis (WIB):</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.scheduled_for}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_for: e.target.value })}
                  placeholder="2026-11-03T19:30:00Z"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Caption Naskah:</label>
                <textarea
                  required
                  rows={3}
                  value={scheduleForm.caption}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, caption: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Hashtags (Pisahkan koma):</label>
                <input
                  type="text"
                  value={scheduleForm.hashtags}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, hashtags: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" /> Kunci Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Link Atribusi */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-cyan-400" /> Buat Tautan Pelacak Checkout
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Tautan pendek unik untuk disematkan di bio, deskripsi YouTube Shorts, atau keranjang TikTok.
            </p>

            <form onSubmit={handleCreateLinkSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Kode Peluang:</label>
                <input
                  type="text"
                  required
                  value={newLinkForm.opportunity_code}
                  onChange={(e) => setNewLinkForm({ ...newLinkForm, opportunity_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">URL Tujuan Checkout:</label>
                <input
                  type="url"
                  required
                  value={newLinkForm.destination_url}
                  onChange={(e) => setNewLinkForm({ ...newLinkForm, destination_url: e.target.value })}
                  placeholder="https://shopee.co.id/produk-xyz"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Slug Kustom (nexus.to/...):</label>
                <input
                  type="text"
                  required
                  value={newLinkForm.short_code}
                  onChange={(e) => setNewLinkForm({ ...newLinkForm, short_code: e.target.value })}
                  placeholder="gan65w"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5"
                >
                  <LinkIcon className="w-4 h-4" /> Buat Tautan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
