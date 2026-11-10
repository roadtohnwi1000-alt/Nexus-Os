"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ShoppingBag, 
  Sparkles, 
  ArrowRight, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Sliders, 
  HelpCircle, 
  Layers, 
  Tag, 
  ExternalLink,
  Store,
  Percent,
  FileSpreadsheet,
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { 
  analyzeAndCloneProducts, 
  exportTikTokBatchCSV, 
  formatRupiah, 
  ClonedProductInput, 
  ClonedProductOutput, 
  CloneAnalyzeResponse 
} from "@/lib/api";

const DEMO_PRODUCTS: ClonedProductInput[] = [
  {
    name: "LCD TOUCHSCREEN FULLSET IPHONE 11 PRO OEM ORIGINAL COPOTAN TERMURAH BERGARANSI",
    source_price: 450000,
    category: "Sparepart HP",
    sku: "SP-LCD-11PRO",
    stock: 15,
    weight_grams: 250
  },
  {
    name: "TEMPERED GLASS ANTI SPY PRIVACY IPHONE 13 PRO MAX FULL COVER 9D OBRAL DISKON 99%",
    source_price: 25000,
    category: "Aksesoris HP",
    sku: "ACC-TG-13PM",
    stock: 50,
    weight_grams: 60
  },
  {
    name: "OLI MESIN MOTOR MATIC MOTUL SCOOTER POWER LE 10W-40 4T 1L 100% ORIGINAL PABRIK",
    source_price: 110000,
    category: "Otomotif & Bengkel",
    sku: "OTO-MOTUL-1L",
    stock: 24,
    weight_grams: 1000
  },
  {
    name: "FAST CHARGER 20W USB-C POWER ADAPTER ORIGINAL TYPE C KABEL DATA FAST CHARGING",
    source_price: 95000,
    category: "Charger",
    sku: "ACC-CHG-20W",
    stock: 30,
    weight_grams: 120
  },
  {
    name: "KAOS POLOS PRIA COTTON COMBED 30S PREMIUM DISTRO CUCI GUDANG TERMURAH",
    source_price: 42000,
    category: "Fashion Pria",
    sku: "FSH-TSHIRT-BLK",
    stock: 100,
    weight_grams: 200
  }
];

export default function EcommerceClonerPage() {
  const [sourcePlatform, setSourcePlatform] = useState("shopee");
  const [targetPlatform, setTargetPlatform] = useState("tiktok_shop");
  const [sourceFeePct, setSourceFeePct] = useState(8.0);
  const [targetFeePct, setTargetFeePct] = useState(10.0);
  const [marginBufferPct, setMarginBufferPct] = useState(5.0);

  const [inputMode, setInputMode] = useState<"demo" | "custom">("demo");
  const [customText, setCustomText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloneResult, setCloneResult] = useState<CloneAnalyzeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Jalankan analisa dan transformasi AI
  const handleRunCloner = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      let productList: ClonedProductInput[] = [];

      if (inputMode === "demo") {
        productList = DEMO_PRODUCTS;
      } else {
        // Parsing input teks baris demi baris: "Nama Produk, Harga"
        const lines = customText.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setErrorMsg("Masukkan minimal 1 produk (format: Nama Produk, Harga).");
          setIsProcessing(false);
          return;
        }

        productList = lines.map((line, idx) => {
          const parts = line.split(/[,;\t]/);
          const name = parts[0]?.trim() || `Produk #${idx + 1}`;
          const rawPrice = parts[1]?.replace(/\D/g, "") || "50000";
          const price = parseInt(rawPrice, 10) || 50000;
          return {
            name,
            source_price: price,
            stock: 10,
            weight_grams: 200
          };
        });
      }

      const res = await analyzeAndCloneProducts({
        source_platform: sourcePlatform,
        target_platform: targetPlatform,
        source_fee_pct: sourceFeePct,
        target_fee_pct: targetFeePct,
        margin_buffer_pct: marginBufferPct,
        products: productList
      });

      setCloneResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses kloning produk.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Unduh CSV Template Resmi TikTok Shop
  const handleDownloadBatchCSV = async () => {
    if (!cloneResult || cloneResult.products.length === 0) return;
    try {
      const csvData = await exportTikTokBatchCSV(cloneResult.products);
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `tiktok_shop_batch_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Gagal mengunduh file batch upload: " + err.message);
    }
  };

  const copyToClipboard = (textToCopy: string, id: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* =========================================================================
          HEADER SECTION
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center gap-1.5">
              <ShoppingBag className="w-3 h-3 text-pink-400" /> E-Commerce Cross-Listing Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Shopee ➔ TikTok Shop Cloner Live
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-pink-500" />
            Mesin Kloning & Migrasi E-Commerce
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kloning seluruh katalog toko antar-marketplace: AI SEO title rewrite, auto category mapping, dan markup biaya admin otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/store/demo-store"
            target="_blank"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Store className="w-4 h-4 text-purple-400" />
            <span>Lihat Web Storefront Instan</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* =========================================================================
          CONTROL PANEL: PARAMETER MIGRATION & MARKUP
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Konfigurasi Marketplace & Fee */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-pink-400" />
              1. Pilih Platform & Penyesuaian Biaya Admin
            </h2>
            <span className="text-xs text-slate-400">Zero-Halusinasi Margin Formula</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Platform Asal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Platform Asal (Source)</label>
              <select
                value={sourcePlatform}
                onChange={(e) => setSourcePlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="shopee">Shopee Indonesia (Admin Fee ~8%)</option>
                <option value="tokopedia">Tokopedia Seller (Admin Fee ~7.5%)</option>
                <option value="excel">File Excel / POS Toko Fisik</option>
              </select>
            </div>

            {/* Platform Target */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Platform Tujuan (Target)</label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="tiktok_shop">TikTok Shop Seller Center (Category ID & Tagging)</option>
                <option value="shopee">Shopee Mass Upload Format</option>
                <option value="lazada">Lazada Global / Local</option>
              </select>
            </div>
          </div>

          {/* Slider Kalkulator Fee & Margin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Fee Asal:</span>
                <span className="font-mono text-slate-200 font-bold">{sourceFeePct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={sourceFeePct}
                onChange={(e) => setSourceFeePct(parseFloat(e.target.value))}
                className="w-full accent-pink-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Fee Target (TikTok):</span>
                <span className="font-mono text-pink-400 font-bold">{targetFeePct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={targetFeePct}
                onChange={(e) => setTargetFeePct(parseFloat(e.target.value))}
                className="w-full accent-pink-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Buffer Margin Tambahan:</span>
                <span className="font-mono text-emerald-400 font-bold">+{marginBufferPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={marginBufferPct}
                onChange={(e) => setMarginBufferPct(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300">Rumus Penyesuaian Harga Otomatis:</span>
            <p className="font-mono text-emerald-400 text-[10px]">
              Harga_Target = [Harga_Asal × (1 + {marginBufferPct}%) / (1 - {targetFeePct}%)] ➔ Dibulatkan ke Rp 1.000 teratas.
            </p>
          </div>
        </div>

        {/* Kolom 3: Mode Input & Tombol Eksekusi */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              2. Sumber Data Produk
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setInputMode("demo")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  inputMode === "demo"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                Sample Toko (5 SKU)
              </button>
              <button
                onClick={() => setInputMode("custom")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  inputMode === "custom"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                Input / Paste List
              </button>
            </div>

            {inputMode === "demo" ? (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">Katalog Uji Coba Terpilih:</p>
                <p>• LCD iPhone 11 Pro Max OEM</p>
                <p>• Tempered Glass Anti Spy 9D</p>
                <p>• Oli Mesin Motul Scooter 1L</p>
                <p>• Fast Charger 20W USB-C</p>
                <p>• Kaos Polos Combed 30s</p>
              </div>
            ) : (
              <div>
                <textarea
                  rows={4}
                  placeholder="Contoh:&#10;LCD iPhone 12 Pro, 650000&#10;Baterai Samsung S20, 180000"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleRunCloner}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-pink-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mentransformasi Judul & Kategori...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Jalankan AI Cloner & SEO Rewrite</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          HASIL TRANSFORMATION & SIDE-BY-SIDE REVIEW
      ========================================================================= */}
      {cloneResult && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Produk Berhasil</span>
              <p className="text-2xl font-black font-mono text-white">{cloneResult.total_products} SKU</p>
              <p className="text-[11px] text-emerald-400">100% Kategori ID Terpetakan</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Nilai Asal (Shopee)</span>
              <p className="text-2xl font-black font-mono text-slate-300">{formatRupiah(cloneResult.total_original_value)}</p>
              <p className="text-[11px] text-slate-500">Sebelum kompensasi potongan fee</p>
            </div>

            <div className="bg-slate-900 border border-pink-500/30 rounded-2xl p-5 space-y-1 shadow-lg shadow-pink-950/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-pink-400">Total Nilai Baru (TikTok)</span>
              <p className="text-2xl font-black font-mono text-pink-300">{formatRupiah(cloneResult.total_target_value)}</p>
              <p className="text-[11px] text-pink-400/80">Rata-rata Markup: +{cloneResult.avg_markup_pct}%</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-2 flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Ekspor Siap Upload</span>
              <button
                onClick={handleDownloadBatchCSV}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Batch Upload (.csv)</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Review Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Perbandingan Berdampingan (Side-by-Side Review)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Periksa bagaimana AI membersihkan judul spam dan mengomputasi harga baru sebelum diunggah ke TikTok Shop.
                </p>
              </div>

              <button
                onClick={handleDownloadBatchCSV}
                className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File TikTok Shop</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 w-1/3">Katalog Asal (Shopee / Excel)</th>
                    <th className="py-3 px-4 w-1/3">Hasil Transformasi AI (TikTok Shop)</th>
                    <th className="py-3 px-4 text-right">Harga Asal</th>
                    <th className="py-3 px-4 text-right">Harga Baru (+Fee)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {cloneResult.products.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      {/* Katalog Asal */}
                      <td className="py-3.5 px-4 space-y-1 align-top">
                        <p className="text-slate-300 font-medium line-clamp-2">{item.original_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">SKU: {item.sku}</span>
                          <span>•</span>
                          <span>{item.category_name}</span>
                        </div>
                      </td>

                      {/* Hasil AI TikTok */}
                      <td className="py-3.5 px-4 space-y-1.5 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-emerald-300 font-semibold leading-relaxed">{item.seo_title}</p>
                          <button
                            onClick={() => copyToClipboard(item.seo_title, `title-${idx}`)}
                            title="Salin Judul Baru"
                            className="text-slate-500 hover:text-slate-200 flex-shrink-0"
                          >
                            {copiedId === `title-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                            ID: {item.tiktok_category_id} ({item.tiktok_category_name})
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {item.weight_grams}g
                          </span>
                        </div>

                        {/* Bullet Points Preview */}
                        <div className="pt-1 text-[10px] text-slate-400 space-y-0.5">
                          {item.bullets.slice(0, 2).map((b, bIdx) => (
                            <p key={bIdx} className="line-clamp-1">• {b}</p>
                          ))}
                        </div>
                      </td>

                      {/* Harga Asal */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400 align-top">
                        {formatRupiah(item.original_price)}
                      </td>

                      {/* Harga Baru */}
                      <td className="py-3.5 px-4 text-right font-mono align-top space-y-1">
                        <p className="text-emerald-400 font-bold text-sm">{formatRupiah(item.target_price)}</p>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] inline-block font-mono">
                          +{formatRupiah(item.markup_nominal)} ({item.markup_pct}%)
                        </span>
                      </td>

                      {/* Status Ready */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
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
