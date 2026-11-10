"use client";

import { useState, useEffect } from "react";
import { 
  Share2, 
  Sparkles, 
  ShoppingBag, 
  CheckCheck, 
  XCircle, 
  ExternalLink, 
  RotateCw, 
  Send, 
  Package, 
  Layers, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle,
  Plus,
  RefreshCw
} from "lucide-react";
import { 
  getMarketingCampaigns, 
  generateMarketingDraft, 
  approveCampaignDraft, 
  rejectCampaignDraft, 
  getECommerceChannelStatus,
  CampaignDraft,
  ECommerceStatus
} from "@/lib/api";

export default function MarketingStudioPage() {
  const [activeTab, setActiveTab] = useState<"QUEUE" | "GENERATOR" | "ECOMMERCE" | "HISTORY">("QUEUE");
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [postedHistory, setPostedHistory] = useState<CampaignDraft[]>([]);
  const [ecommerceChannels, setEcommerceChannels] = useState<ECommerceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State Instant Generator
  const [genForm, setGenForm] = useState({
    itemName: "LCD iPhone 11 Original OEM",
    sku: "LCD-IPH-11",
    angle: "DISCOUNT_PROMO" as const,
    channels: ["Instagram", "TikTok"],
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Alert
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [draftList, historyList, ecomStatus] = await Promise.all([
        getMarketingCampaigns("DRAFT"),
        getMarketingCampaigns("POSTED"),
        getECommerceChannelStatus(),
      ]);
      setDrafts(draftList);
      setPostedHistory(historyList);
      setEcommerceChannels(ecomStatus);
    } catch (err) {
      console.error("Gagal memuat data marketing studio:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleApprove = async (draftId: string) => {
    try {
      const approved = await approveCampaignDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setPostedHistory((prev) => [approved, ...prev]);
      setAlertNotice(`✅ Kampanye "${approved.title.slice(0, 30)}..." berhasil di-approve dan dipublikasikan!`);
      setTimeout(() => setAlertNotice(null), 4000);
    } catch (err: any) {
      alert("Gagal approve: " + err.message);
    }
  };

  const handleReject = async (draftId: string) => {
    try {
      await rejectCampaignDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setAlertNotice(`❌ Draf kampanye ditolak dan dihapus dari antrean.`);
      setTimeout(() => setAlertNotice(null), 4000);
    } catch (err: any) {
      alert("Gagal tolak: " + err.message);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      const newDraft = await generateMarketingDraft({
        item_name: genForm.itemName,
        sku: genForm.sku,
        angle: genForm.angle,
        target_channels: genForm.channels,
      });
      setDrafts((prev) => [newDraft, ...prev]);
      setActiveTab("QUEUE");
      setAlertNotice(`✨ Draf baru untuk "${genForm.itemName}" berhasil di-generate!`);
      setTimeout(() => setAlertNotice(null), 4000);
    } catch (err: any) {
      alert("Gagal generate draf: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" />
              Creator & E-Commerce Marketing Studio
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Multi-Channel Autopilot
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Social & E-Commerce Marketing Studio
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Pabrik konten kreatif AI, automasi promosi sosial media, dan monitoring multi-channel marketplace e-commerce
          </p>
        </div>

        <button
          onClick={() => setActiveTab("GENERATOR")}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-violet-900/30 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>+ Buat Draf Konten Baru</span>
        </button>
      </div>

      {alertNotice && (
        <div className="p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-violet-400" />
            <span>{alertNotice}</span>
          </div>
          <button onClick={() => setAlertNotice(null)} className="text-violet-400 font-bold px-2">✕</button>
        </div>
      )}

      {/* Quick E-Commerce Connection Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ecommerceChannels.map((ch) => (
          <div
            key={ch.platform}
            className="p-3.5 rounded-xl bg-[#141414] border border-[#282828] flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                  ch.is_connected
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-gray-800 text-gray-500 border border-gray-700"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">{ch.platform}</span>
                <span className="text-[10px] text-gray-400">{ch.account_name}</span>
              </div>
            </div>

            <div className="text-right">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  ch.is_connected
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-[#252525] text-gray-400"
                }`}
              >
                {ch.sync_status}
              </span>
              {ch.is_connected && (
                <span className="text-[10px] text-gray-500 block font-mono mt-0.5">
                  {ch.total_synced_items} SKU Sinkron
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("QUEUE")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "QUEUE"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Antrean Draf Konten ({drafts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("GENERATOR")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "GENERATOR"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Instant AI Creator</span>
        </button>

        <button
          onClick={() => setActiveTab("ECOMMERCE")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "ECOMMERCE"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Multi-Channel E-Commerce Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "HISTORY"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Riwayat Publikasi ({postedHistory.length})</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: ANTREAN DRAF (APPROVAL QUEUE)
          ===================================================================== */}
      {activeTab === "QUEUE" && (
        <div className="space-y-4">
          {drafts.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#141414] border border-[#262626] text-center text-gray-500 space-y-3">
              <CheckCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-gray-300">Semua draf promosi telah di-review!</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Gunakan tab "Instant AI Creator" untuk menghasilkan draf promosi baru dari stok toko Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="bg-[#141414] border border-[#282828] hover:border-violet-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        {d.channels.map((ch) => (
                          <span
                            key={ch}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-500">{d.generated_at}</span>
                    </div>

                    <h4 className="font-bold text-xs text-white line-clamp-2 leading-snug">
                      {d.title}
                    </h4>

                    <div className="p-3 rounded-xl bg-[#111] border border-[#242424] text-xs text-gray-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                      {d.caption}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {d.hashtags.map((tag) => (
                        <span key={tag} className="text-[10px] text-purple-400 font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="p-2 rounded-lg bg-[#181818] border border-[#262626] text-[10px] text-gray-400 flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold shrink-0">Media:</span>
                      <span>{d.suggested_media}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#242424] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(d.id)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-[#222] hover:bg-rose-950/40 hover:text-rose-300 text-gray-400 border border-[#333] hover:border-rose-500/40 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(d.id)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-900/30 flex items-center justify-center gap-1.5"
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
      )}

      {/* =====================================================================
          TAB 2: INSTANT AI CREATOR (TRIGGER GENERATOR)
          ===================================================================== */}
      {activeTab === "GENERATOR" && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-[#141414] border border-[#282828] space-y-4">
          <div className="pb-3 border-b border-[#222]">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Generator Draf Konten Pemasaran AI
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Pilih produk dari inventori dan sudut pandang promosi untuk men-generate copywriting siap posting
            </p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Pilih Produk / Jasa Toko
              </label>
              <select
                value={genForm.itemName}
                onChange={(e) => {
                  const val = e.target.value;
                  let sku = "SKU-AUTO";
                  if (val.includes("LCD")) sku = "LCD-IPH-11";
                  if (val.includes("Baterai")) sku = "BAT-SAM-S21";
                  if (val.includes("Kabel")) sku = "CAB-TC-100W";
                  if (val.includes("IC")) sku = "IC-PWR-PM6150";
                  setGenForm({ ...genForm, itemName: val, sku });
                }}
                className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="LCD iPhone 11 Original OEM">LCD iPhone 11 Original OEM (Stok: 12)</option>
                <option value="Baterai Samsung Galaxy S21">Baterai Samsung Galaxy S21 (Stok: 8)</option>
                <option value="Kabel Data Type-C 100W Braided">Kabel Data Type-C 100W Braided (Stok: 30)</option>
                <option value="IC Power PM6150 Mikrosolder">IC Power PM6150 Mikrosolder (Stok: 25)</option>
                <option value="Jasa Ganti LCD & Kalibrasi True Tone">Jasa Ganti LCD & Kalibrasi True Tone</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Sudut Pandang Konten (Angle)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "DISCOUNT_PROMO", label: "🏷️ Promo Diskon & Garansi" },
                  { id: "EDUCATIONAL_TIPS", label: "💡 Tips Perawatan & Edukasi" },
                  { id: "URGENCY_LIMITED_STOCK", label: "⚠️ Urgensi Stok Terbatas (FOMO)" },
                  { id: "SERVICE_EXCELLENCE", label: "✨ Hasil Pengerjaan Teknisi" },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setGenForm({ ...genForm, angle: a.id as any })}
                    className={`p-3 rounded-xl border text-xs font-medium text-left transition-all ${
                      genForm.angle === a.id
                        ? "bg-violet-600/20 border-violet-500 text-violet-200 shadow-sm"
                        : "bg-[#181818] border-[#2b2b2b] text-gray-400 hover:text-white"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Target Kanal Pemasaran
              </label>
              <div className="flex gap-2">
                {["Instagram", "TikTok", "WhatsApp Status"].map((ch) => (
                  <label
                    key={ch}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1b1b1b] border border-[#2e2e2e] text-xs text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={genForm.channels.includes(ch)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGenForm({ ...genForm, channels: [...genForm.channels, ch] });
                        } else {
                          setGenForm({ ...genForm, channels: genForm.channels.filter((c) => c !== ch) });
                        }
                      }}
                      className="rounded accent-violet-600"
                    />
                    <span>{ch}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#222] flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-violet-900/30 flex items-center gap-2"
              >
                {isGenerating ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Generate Draf AI Sekarang</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 3: E-COMMERCE MULTI-CHANNEL MONITOR
          ===================================================================== */}
      {activeTab === "ECOMMERCE" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Atomic Stock Reservation Aktif:</strong> Setiap order masuk dari TikTok Shop atau Shopee langsung mengunci kuota stok agar tidak tertabrak transaksi kasir offline.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#282828] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-pink-400" />
                  TikTok Shop Partner Sync
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Sinkronisasi otomatis stok sparepart & pesanan masuk. Transaksi langsung menjurnal otomatis ke Buku Besar (GL) dan mengunci kolom reservasi inventori.
              </p>
              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>SKU Terhubung:</span>
                  <span className="font-bold text-white">48 Produk</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Order Dalam Proses:</span>
                  <span className="font-bold text-amber-400">2 Pesanan</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#141414] border border-[#282828] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  Shopee Open Platform
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Integrasi dua arah pesanan grosir dan eceran. Kompatibel dengan format SKU KetoKo untuk pemetaan otomatis saat parallel run.
              </p>
              <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>SKU Terhubung:</span>
                  <span className="font-bold text-white">42 Produk</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Order Dalam Proses:</span>
                  <span className="font-bold text-emerald-400">0 Pesanan (Lancar)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: RIWAYAT PUBLIKASI
          ===================================================================== */}
      {activeTab === "HISTORY" && (
        <div className="overflow-x-auto rounded-xl border border-[#262626]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161616] text-gray-400 border-b border-[#262626]">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu Terbit</th>
                <th className="py-3 px-4 font-semibold">Judul Kampanye</th>
                <th className="py-3 px-3 font-semibold">Kanal Target</th>
                <th className="py-3 px-3 font-semibold text-center">Status</th>
                <th className="py-3 px-3 font-semibold">Tautan Postingan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {postedHistory.map((item) => (
                <tr key={item.id} className="hover:bg-[#1a1a1a] transition-colors">
                  <td className="py-3 px-4 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                    {item.posted_at || "-"}
                  </td>
                  <td className="py-3 px-4 font-medium text-white max-w-sm truncate">
                    {item.title}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      {item.channels.map((ch) => (
                        <span key={ch} className="px-2 py-0.5 rounded text-[10px] bg-[#222] text-gray-300 border border-[#333]">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      POSTED
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Membuka postingan: ${item.simulated_url}`);
                      }}
                      className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                    >
                      <span>{item.simulated_url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
