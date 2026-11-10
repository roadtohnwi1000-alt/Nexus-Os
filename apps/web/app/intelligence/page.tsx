"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Brain, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Clock, 
  Search, 
  RefreshCw, 
  Send, 
  Package, 
  Layers, 
  CheckCircle2, 
  ShoppingBag, 
  ArrowRight, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Target,
  DollarSign,
  HelpCircle,
  BarChart2,
  Flame,
  Radio,
  Sliders,
  Eye,
  Share2,
  PlayCircle,
  X,
  Plus,
  Store,
  Globe,
  Video,
  Check
} from "lucide-react";
import { 
  getRFMSegments, 
  getPredictiveStock, 
  getCompetitorPrices, 
  formatRupiah,
  RFMSegmentsResponse,
  PredictiveStockResponse,
  MarketIntelResponse,
  RFMCustomer,
  fetchMarketTrends,
  triggerMarketScan,
  fetchOpportunityDetail,
  updateOpportunityStatusAPI,
  fetchConnectedAccounts,
  connectNewAccount,
  createVideoJob,
  ContentOpportunityAPI,
  ConnectedAccountAPI
} from "@/lib/api";

export default function IntelligencePage() {
  // Tab Aktif:
  // 'trends' -> Domain A: Radar Peluang Tren & Kapten Ads / Sosmed Specialist
  // 'accounts' -> Multi-Store & Social Media Connected Accounts
  // 'rfm' -> Segmentasi Pelanggan RFM
  // 'stock' -> Prediksi Stok Habis & Smart PO
  // 'market' -> Intel Harga Pasar Kompetitor
  const [activeTab, setActiveTab] = useState<"trends" | "accounts" | "rfm" | "stock" | "market">("trends");

  // State Domain A (Fase 6)
  const [opportunities, setOpportunities] = useState<ContentOpportunityAPI[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccountAPI[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<ContentOpportunityAPI | null>(null);
  const [isScanningTrends, setIsScanningTrends] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<string>("ALL");
  const [selectedSourceType, setSelectedSourceType] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State Modal Connect Account
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newAccPlatform, setNewAccPlatform] = useState("tiktok_shop");
  const [newAccLabel, setNewAccLabel] = useState("");
  const [newAccUsername, setNewAccUsername] = useState("");
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);

  // State Data Science Internal (RFM, Stock, Market)
  const [rfmData, setRfmData] = useState<RFMSegmentsResponse | null>(null);
  const [stockData, setStockData] = useState<PredictiveStockResponse | null>(null);
  const [marketData, setMarketData] = useState<MarketIntelResponse | null>(null);

  // State Kontrol
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchRfmQuery, setSearchRfmQuery] = useState("");
  const [selectedRfmSegment, setSelectedRfmSegment] = useState<string>("ALL");
  const [competitorKeyword, setCompetitorKeyword] = useState("LCD iPhone 11");
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  // Notifikasi Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Memuat data analitik utama
  const loadIntelligenceData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [oppRes, accRes, rfmRes, stockRes, marketRes] = await Promise.allSettled([
        fetchMarketTrends(selectedNiche, undefined, selectedSourceType),
        fetchConnectedAccounts(),
        getRFMSegments(),
        getPredictiveStock(),
        getCompetitorPrices(competitorKeyword),
      ]);

      if (oppRes.status === "fulfilled" && oppRes.value?.opportunities) {
        setOpportunities(oppRes.value.opportunities);
      }
      if (accRes.status === "fulfilled" && accRes.value?.accounts) {
        setConnectedAccounts(accRes.value.accounts);
      }
      if (rfmRes.status === "fulfilled") setRfmData(rfmRes.value);
      if (stockRes.status === "fulfilled") setStockData(stockRes.value);
      if (marketRes.status === "fulfilled") setMarketData(marketRes.value);
    } catch (err) {
      console.error("Gagal memuat analitik data science:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadIntelligenceData();
  }, [selectedNiche, selectedSourceType]);

  // Handler Pemicu Scan LangGraph StateGraph
  const handleTriggerLangGraphScan = async () => {
    setIsScanningTrends(true);
    try {
      const res = await triggerMarketScan();
      if (res?.data?.opportunities) {
        setOpportunities(res.data.opportunities);
        showToast("⚡ Scan tren LangGraph selesai! Data peluang terkini berhasil disintesis.");
      }
    } catch (err) {
      console.error("Gagal memindai tren:", err);
      showToast("❌ Gagal memindai tren pasar.");
    } finally {
      setIsScanningTrends(false);
    }
  };

  // Handler Kirim ke Studio Video (Fase 7 Handoff)
  const handleSendToStudio = async (code: string) => {
    try {
      const opp = opportunities.find((o) => o.opportunity_code === code) || selectedOpp;
      await updateOpportunityStatusAPI(code, "APPROVED_FOR_STUDIO");

      // Otomatis buat draft job perakitan video di The Studio (Domain B)
      if (opp) {
        await createVideoJob({
          opportunity_code: opp.opportunity_code,
          product_name: opp.product_name,
          category: opp.niche_category,
          price_idr: opp.inventory_match?.selling_price || 199000,
          stock_remaining: opp.inventory_match?.stock_available || 25,
          pain_points: [opp.creative_brief?.primary_pain_point || "masalah sering rusak"],
          unique_selling_points: opp.creative_brief?.hook_angles || ["Garansi Resmi", "Kualitas Terbaik"],
          target_audience: opp.creative_brief?.target_audience || "Konsumen Online",
        });
      }

      setOpportunities((prev) =>
        prev.map((o) => (o.opportunity_code === code ? { ...o, status: "APPROVED_FOR_STUDIO" } : o))
      );
      if (selectedOpp && selectedOpp.opportunity_code === code) {
        setSelectedOpp({ ...selectedOpp, status: "APPROVED_FOR_STUDIO" });
      }
      showToast(`🎬 Peluang ${code} dibuatkan kanvas di Studio Video Remotion (Fase 7)! Buka rute /studio untuk mempratinjau.`);
    } catch (err) {
      console.error("Gagal mengirim ke studio:", err);
      showToast("❌ Gagal memperbarui status peluang.");
    }
  };

  // Handler Hubungkan Akun Baru
  const handleConnectAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccLabel.trim() || !newAccUsername.trim()) return;
    setIsSubmittingAccount(true);
    try {
      const res = await connectNewAccount({
        platform: newAccPlatform,
        account_label: newAccLabel,
        account_id_or_username: newAccUsername,
      });
      if (res?.account) {
        setConnectedAccounts((prev) => [res.account, ...prev]);
        setShowConnectModal(false);
        setNewAccLabel("");
        setNewAccUsername("");
        showToast(`✓ Akun ${newAccLabel} (${newAccPlatform}) berhasil dihubungkan!`);
      }
    } catch (err) {
      console.error("Gagal menghubungkan akun:", err);
      showToast("❌ Gagal menghubungkan akun.");
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  // Handler Cari Intel Pasar untuk keyword tertentu
  const handleSearchMarket = async (kw?: string) => {
    const targetKw = kw || competitorKeyword;
    if (!targetKw.trim()) return;
    setIsSearchingMarket(true);
    try {
      const res = await getCompetitorPrices(targetKw);
      setMarketData(res);
      setCompetitorKeyword(targetKw);
    } catch (err) {
      console.error("Gagal mencari intel pasar:", err);
    } finally {
      setIsSearchingMarket(false);
    }
  };

  // Filter daftar pelanggan RFM
  const filteredCustomers = useMemo(() => {
    if (!rfmData?.customers) return [];
    return rfmData.customers.filter((c) => {
      const matchQuery =
        (c.customer_name || "").toLowerCase().includes(searchRfmQuery.toLowerCase()) ||
        (c.phone || "").includes(searchRfmQuery);
      const matchSegment =
        selectedRfmSegment === "ALL" || (c.segment || "").toUpperCase().includes(selectedRfmSegment.toUpperCase());
      return matchQuery && matchSegment;
    });
  }, [rfmData, searchRfmQuery, selectedRfmSegment]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl shadow-emerald-950/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Utama & Status StateGraph */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Brain className="w-7 h-7 text-purple-400" />
              <span>Data Intelligence & Market Brain</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LangGraph StateGraph Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Domain A ("The Brain"): Analisis tren viral pasar Indonesia, kroscek stok riil POS, perumusan Kapten Ads & Naskah Sosmed.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleTriggerLangGraphScan()}
            disabled={isScanningTrends}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-950/40 flex items-center gap-2"
          >
            {isScanningTrends ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Zap className="w-4 h-4 text-amber-300" />}
            <span>{isScanningTrends ? "LangGraph Sedang Memindai..." : "Pindai Tren Pasar Baru"}</span>
          </button>

          <button
            onClick={() => loadIntelligenceData(true)}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-purple-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tab Navigasi 5 Pilar */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab("trends")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === "trends"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Radar Tren & Peluang ({opportunities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === "accounts"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Store className="w-4 h-4 text-cyan-400" />
          <span>Multi-Store & Sosmed Hub ({connectedAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("rfm")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === "rfm"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Segmentasi Pelanggan (RFM)</span>
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === "stock"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span>Prediksi Stok Habis (PO)</span>
        </button>

        <button
          onClick={() => setActiveTab("market")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === "market"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Intel Harga Pasar</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: RADAR PELUANG TREN & KAPTEN ADS (FASE 6 CORE) */}
      {/* ===================================================================== */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          {/* Quick Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Peluang Terdeteksi</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1.5">{opportunities.length}</p>
              <span className="text-[10px] text-slate-500">TikTok ID + Marketplace + Google Trends</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Peluang Panas (Skor &ge; 80)</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-1.5">
                {opportunities.filter((o) => o.metrics.overall_opportunity_score >= 80).length}
              </p>
              <span className="text-[10px] text-emerald-500/80">Rekomendasi Kampanye Prioritas</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Tersedia di Gudang Toko</span>
                <Package className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-cyan-400 mt-1.5">
                {opportunities.filter((o) => o.source_type === "OWN_INVENTORY").length} Item
              </p>
              <span className="text-[10px] text-slate-500">Stok Fisik POS & Margin Tinggi</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Akun Sosmed / Toko Terhubung</span>
                <Globe className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-black text-purple-300 mt-1.5">{connectedAccounts.length}</p>
              <span className="text-[10px] text-slate-500">Kanal Distribusi Penjualan</span>
            </div>
          </div>

          {/* Filter Bar Niche & Sumber */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" /> Niche:
              </span>
              {["ALL", "Gadget & Audio", "Aksesoris Ponsel", "Sparepart & Servis", "Gadget & Charging"].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedNiche(n)}
                  className={`px-3 py-1 rounded-xl font-bold transition-all ${
                    selectedNiche === n
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {n === "ALL" ? "Semua Niche" : n}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Pasokan:</span>
              <select
                value={selectedSourceType}
                onChange={(e) => setSelectedSourceType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">Semua Sumber</option>
                <option value="OWN_INVENTORY">Stok Toko Sendiri</option>
                <option value="AFFILIATE_PARTNER">Afiliasi Pihak Ketiga</option>
              </select>
            </div>
          </div>

          {/* Grid Peluang Konten (Opportunity Matrix) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {opportunities.map((opp) => {
              const score = opp.metrics.overall_opportunity_score;
              const isHot = score >= 80;
              const isOwnStock = opp.source_type === "OWN_INVENTORY";

              return (
                <div
                  key={opp.opportunity_code}
                  className="bg-slate-900 border border-slate-800/90 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all hover:shadow-xl hover:shadow-purple-950/20 group"
                >
                  <div className="space-y-3">
                    {/* Header Card: Kode & Skor Peluang */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {opp.opportunity_code}
                      </span>
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black ${
                          isHot
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        }`}
                      >
                        <Flame className={`w-3.5 h-3.5 ${isHot ? "text-amber-400" : "text-purple-400"}`} />
                        <span>{score}/100</span>
                      </div>
                    </div>

                    {/* Judul Produk & Niche */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                        {opp.niche_category}
                      </span>
                      <h3 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-2 mt-0.5">
                        {opp.product_name}
                      </h3>
                    </div>

                    {/* Badge Pasokan: Stok Sendiri vs Afiliasi */}
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                      {isOwnStock ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5" /> Stok Fisik Toko
                            </span>
                            <span>{opp.inventory_match.stock_available} Unit Tersedia</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span>SKU: {opp.inventory_match.sku}</span>
                            <span className="text-emerald-300 font-mono font-bold">
                              Margin {opp.inventory_match.profit_margin_pct}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-cyan-400 text-[11px] font-bold">
                          <span className="flex items-center gap-1">
                            <Radio className="w-3.5 h-3.5" /> Afiliasi Pihak Ketiga
                          </span>
                          <span className="text-cyan-300 font-mono">Komisi ~15%</span>
                        </div>
                      )}
                    </div>

                    {/* Bar Metrik Kecepatan Tren & Saturasi */}
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Kecepatan Tren (Velocity):</span>
                        <span className="font-mono font-bold text-white">{Math.round(opp.metrics.velocity_score * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-amber-400 h-full rounded-full"
                          style={{ width: `${opp.metrics.velocity_score * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Snippet Hook Clue Terkuat */}
                    {opp.creative_brief.hook_angles && opp.creative_brief.hook_angles.length > 0 && (
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/50 text-[11px] text-slate-300 italic line-clamp-2">
                        "{opp.creative_brief.hook_angles[0]}"
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Bawah */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOpp(opp)}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>Blueprint & Ads</span>
                    </button>

                    <button
                      onClick={() => handleSendToStudio(opp.opportunity_code)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        opp.status === "APPROVED_FOR_STUDIO"
                          ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/30"
                      }`}
                      title="Kirim ke Studio Video Remotion (Fase 7)"
                    >
                      {opp.status === "APPROVED_FOR_STUDIO" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Siap Studio</span>
                        </>
                      ) : (
                        <>
                          <Video className="w-3.5 h-3.5 text-white" />
                          <span>Ke Studio</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MULTI-STORE & SOCIAL MEDIA HUB */}
      {/* ===================================================================== */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-cyan-400" />
                <span>Multi-Store & Social Media Management</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pantau performa agregat tayangan video, konversi pesanan, dan GMV dari multi-toko e-commerce serta multi-akun media sosial Anda.
              </p>
            </div>
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Hubungkan Akun Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {connectedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {acc.platform.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {acc.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white line-clamp-1">{acc.account_label}</h4>
                    <p className="text-xs text-slate-400 font-mono">{acc.account_id_or_username}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Penayangan (30 Hari):</span>
                    <span className="text-white font-mono font-bold">{acc.total_views_30d.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Pesanan Terkonversi:</span>
                    <span className="text-white font-mono font-bold">{acc.total_orders_30d} Order</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total GMV:</span>
                    <span className="text-emerald-400 font-mono font-bold">{formatRupiah(acc.total_gmv_30d)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DETAIL BLUEPRINT & KAPTEN ADS */}
      {/* ===================================================================== */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/40">
                    {selectedOpp.opportunity_code}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{selectedOpp.niche_category}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Skor: {selectedOpp.metrics.overall_opportunity_score}/100
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">{selectedOpp.product_name}</h2>
              </div>
              <button
                onClick={() => setSelectedOpp(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid 2 Kolom: Kiri Naskah 4-Scene, Kanan Kapten Ads */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kolom Kiri: Naskah 4-Scene Berdurasi Detik */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-400" />
                  <span>Naskah Video 4-Scene (Siap Remotion & TTS)</span>
                </h3>

                <div className="space-y-3">
                  {Object.entries(selectedOpp.creative_brief.scenes || {}).map(([sKey, sVal]: [string, any]) => (
                    <div key={sKey} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-purple-300 uppercase tracking-wider">{sKey.replace(/_/g, " ")}</span>
                        <span className="text-slate-500 font-mono">{sVal.time_range}</span>
                      </div>
                      <p className="text-xs text-white font-medium bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/50">
                        "{sVal.spoken_text}"
                      </p>
                      <p className="text-[11px] text-slate-400 italic">
                        🎬 Visual: {sVal.visual_direction}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Spesialis Sosmed Insights */}
                <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    <span>Nasihat Spesialis Media Sosial</span>
                  </div>
                  <p className="text-slate-300">
                    ⏰ <strong>Jam Tayang Emas:</strong> {selectedOpp.sosmed_strategy.prime_time_wib}
                  </p>
                  <p className="text-slate-300">
                    🎵 <strong>Audio Rekomendasi:</strong> {selectedOpp.sosmed_strategy.sound_recommendation}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    💬 <strong>Trik Komentar:</strong> "{selectedOpp.sosmed_strategy.engagement_comment_prompt}"
                  </p>
                </div>
              </div>

              {/* Kolom Kanan: Strategi Kapten Ads & Evaluasi Stok */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Strategi Belanja Iklan (Kapten Ads)</span>
                </h3>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Anggaran Harian</span>
                      <p className="text-base font-extrabold text-white mt-0.5">
                        {formatRupiah(selectedOpp.ads_strategy.daily_budget_idr)}/hari
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Target ROAS</span>
                      <p className="text-base font-extrabold text-emerald-400 mt-0.5">
                        {selectedOpp.ads_strategy.target_roas}x Omset
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Tipe Kampanye Iklan:</span>
                    <p className="text-slate-200 font-bold">{selectedOpp.ads_strategy.campaign_type}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Aturan Kill-Switch Darurat:</span>
                    <p className="text-rose-300 text-[11px] bg-rose-950/30 p-2 rounded-lg border border-rose-800/30">
                      🛡️ {selectedOpp.ads_strategy.kill_switch_rule}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Target Audiens & Minat:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedOpp.ads_strategy.audience_interests.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status Kroscek Gudang Toko */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-cyan-400" />
                    <span>Sinkronisasi Stok Fisik POS</span>
                  </h4>
                  {selectedOpp.source_type === "OWN_INVENTORY" ? (
                    <div className="space-y-1 text-slate-300">
                      <p>• SKU: <strong className="text-white">{selectedOpp.inventory_match.sku}</strong></p>
                      <p>• Sisa Stok: <strong className="text-emerald-400">{selectedOpp.inventory_match.stock_available} Unit</strong></p>
                      <p>• HPP: <strong>{formatRupiah(selectedOpp.inventory_match.current_hpp)}</strong> | Jual: <strong>{formatRupiah(selectedOpp.inventory_match.selling_price)}</strong></p>
                      <p className="text-[11px] text-cyan-400 font-semibold pt-1">
                        ✓ Titik Impas (BEP) iklan tercapai dengan menjual {selectedOpp.ads_strategy.breakeven_units_per_day} unit per hari.
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400">
                      Barang belum tersedia di stok gudang fisik. Dapat dijalankan melalui jalur Afiliasi dengan komisi {selectedOpp.inventory_match.profit_margin_pct}% tanpa risiko modal kerja.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal Action */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedOpp(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={() => handleSendToStudio(selectedOpp.opportunity_code)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-950/40 flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Setujui & Kirim ke Studio Video (Fase 7)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL CONNECT NEW ACCOUNT */}
      {/* ===================================================================== */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-cyan-400" />
                <span>Hubungkan Akun Baru</span>
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectAccountSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Platform</label>
                <select
                  value={newAccPlatform}
                  onChange={(e) => setNewAccPlatform(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="tiktok_shop">TikTok Shop (Official / Creator)</option>
                  <option value="shopee">Shopee Indonesia</option>
                  <option value="instagram">Instagram Bisnis / Reels</option>
                  <option value="youtube">YouTube Shorts Channel</option>
                  <option value="meta_ads">Meta Ads Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Label Akun</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TikTok Affiliate Cabang Surabaya"
                  value={newAccLabel}
                  onChange={(e) => setNewAccLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Username / Store ID</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: @racun_gadget_id"
                  value={newAccUsername}
                  onChange={(e) => setNewAccUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAccount}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors"
                >
                  {isSubmittingAccount ? "Menghubungkan..." : "Simpan & Hubungkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: RFM SEGMENTATION (ORIGINAL RESTORED) */}
      {/* ===================================================================== */}
      {activeTab === "rfm" && (
        <div className="space-y-6">
          {rfmData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Pelanggan Terdaftar</span>
                <p className="text-2xl font-black text-white mt-1">{rfmData.summary.total_customers}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Pelanggan Champions</span>
                <p className="text-2xl font-black text-purple-400 mt-1">{rfmData.summary.champions}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Pelanggan Loyal</span>
                <p className="text-2xl font-black text-white mt-1">{rfmData.summary.loyal}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Pelanggan At Risk</span>
                <p className="text-2xl font-black text-rose-400 mt-1">{rfmData.summary.at_risk}</p>
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari nama atau nomor HP pelanggan..."
                value={searchRfmQuery}
                onChange={(e) => setSearchRfmQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              />
            </div>
            <select
              value={selectedRfmSegment}
              onChange={(e) => setSelectedRfmSegment(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
            >
              <option value="ALL">Semua Segmen</option>
              <option value="CHAMPIONS">Champions</option>
              <option value="LOYAL">Loyal Customers</option>
              <option value="AT_RISK">At Risk</option>
              <option value="LOST">Lost</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3.5">Nama & Kontak</th>
                  <th className="p-3.5">Segmen</th>
                  <th className="p-3.5">Terakhir Belanja</th>
                  <th className="p-3.5">Frekuensi</th>
                  <th className="p-3.5">Total Belanja</th>
                  <th className="p-3.5">Rekomendasi Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((c) => (
                  <tr key={c.customer_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-white">{c.customer_name}</p>
                      <p className="text-[11px] text-slate-500">{c.phone}</p>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {c.segment}
                      </span>
                    </td>
                    <td className="p-3.5">{c.recency_days} hari lalu</td>
                    <td className="p-3.5">{c.frequency}x Transaksi</td>
                    <td className="p-3.5 font-mono font-bold text-white">{formatRupiah(c.monetary_total)}</td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{c.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: PREDICTIVE STOCK & SMART PO (ORIGINAL RESTORED) */}
      {/* ===================================================================== */}
      {activeTab === "stock" && stockData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Item Kritis (&lt; 7 Hari)</span>
              <p className="text-2xl font-black text-rose-400 mt-1">{stockData.critical_stockout_count}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Item Dianalisis</span>
              <p className="text-2xl font-black text-white mt-1">{stockData.items.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Peringatan Stok Rendah</span>
              <p className="text-2xl font-black text-amber-400 mt-1">{stockData.warning_stockout_count} Item</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3.5">SKU & Nama Barang</th>
                  <th className="p-3.5">Sisa Stok</th>
                  <th className="p-3.5">Penjualan Harian (ADS)</th>
                  <th className="p-3.5">Estimasi Habis</th>
                  <th className="p-3.5">Saran Qty PO</th>
                  <th className="p-3.5">Tingkat Risiko</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockData.items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{item.sku}</p>
                    </td>
                    <td className="p-3.5 font-bold">{item.current_stock} Unit</td>
                    <td className="p-3.5">{item.ads} unit/hari</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.days_until_stockout <= 7
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-slate-800 text-slate-300"
                      }`}>
                        {item.days_until_stockout} Hari Lagi
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-cyan-400">+{item.recommended_reorder_qty} Unit</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {item.status} ({item.risk_level})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: INTEL HARGA PASAR KOMPETITOR (ORIGINAL RESTORED) */}
      {/* ===================================================================== */}
      {activeTab === "market" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Ketik nama atau SKU barang..."
                  value={competitorKeyword}
                  onChange={(e) => setCompetitorKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchMarket()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <button
                onClick={() => handleSearchMarket()}
                disabled={isSearchingMarket}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {isSearchingMarket ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                <span>Pindai Pasar Kompetitor</span>
              </button>
            </div>
          </div>

          {marketData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                    Hasil Komparasi Harga Retail
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {marketData.matched_item_name}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Harga Toko Kita</span>
                    <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                      {formatRupiah(marketData.our_price)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Rata-rata Pasar</span>
                    <p className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono">
                      {formatRupiah(marketData.market_average_price)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Deviasi Selisih</span>
                    <p className={`text-2xl font-extrabold mt-1 font-mono ${
                      marketData.price_difference_percentage > 10 ? "text-rose-400" :
                      marketData.price_difference_percentage < -10 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>
                      {marketData.price_difference_percentage > 0 ? `+${marketData.price_difference_percentage}%` : `${marketData.price_difference_percentage}%`}
                    </p>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  marketData.status_code === "UNCOMPETITIVE"
                    ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                    : marketData.status_code === "UNDERPRICED"
                    ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                    : "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                }`}>
                  <p className="font-bold text-sm">{marketData.status_label}</p>
                  <p className="opacity-90">{marketData.recommendation}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-xs uppercase text-slate-300 tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                  <ShoppingBag className="w-4 h-4 text-purple-400" />
                  Listing Kompetitor ({marketData.competitor_listings.length})
                </h4>

                <div className="space-y-2.5">
                  {marketData.competitor_listings.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          {c.marketplace}
                        </span>
                        <span className="font-mono font-bold text-slate-100">{formatRupiah(c.price)}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">{c.seller}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                        <span>⭐ Rating: {c.rating}</span>
                        <span>Terjual: {c.sold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
