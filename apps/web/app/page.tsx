"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ShoppingCart, 
  Warehouse, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  RefreshCw, 
  Clock, 
  WifiOff, 
  ChevronRight, 
  DollarSign, 
  Users, 
  Wrench, 
  Layers, 
  Building2,
  Check,
  Star
} from "lucide-react";
import { BUSINESS_PRESETS, BusinessType } from "@/lib/tenant-preset";
import AISalesFrontliner from "@/components/AISalesFrontliner";

export default function PublicLandingPage() {
  const [selectedIndustryTab, setSelectedIndustryTab] = useState<BusinessType>("RETAIL");

  const INDUSTRY_SHOWCASE: Record<BusinessType, {
    title: string;
    headline: string;
    tagline: string;
    points: string[];
    badge: string;
    metricLabel: string;
    metricValue: string;
  }> = {
    RETAIL: {
      title: "Ritel & Minimarket",
      headline: "Kasir Cepat Barcode & Anti Selisih Kasir",
      tagline: "Cocok untuk toko sembako, minimarket, dan toko kelontong modern.",
      badge: "🛒 RETAIL EDITION",
      metricLabel: "Kecepatan Checkout Kasir",
      metricValue: "< 3 Detik / Transaksi",
      points: [
        "Scan barcode cepat & cetak nota struk via Bluetooth thermal",
        "Bisa tetap transaksi saat internet mati (Offline-First Dexie.js)",
        "Tutup shift kasir buta (Blind Balancing) mencegah kasir curang",
        "Pencatatan harga modal rata-rata (Moving Average HPP)",
      ],
    },
    BENGKEL: {
      title: "Bengkel Motor & Mobil",
      headline: "Manajemen Servis, Plat Nomor & Komisi Mekanik",
      tagline: "Solusi terpadu servis pengerjaan mesin dan penjualan suku cadang.",
      badge: "🔧 BENGKEL EDITION",
      metricLabel: "Retensi Pelanggan Servis",
      metricValue: "+42% Jadwal Oli Rutin",
      points: [
        "Input nomor polisi (plat kendaraan) dan kilometer tempuh (KM)",
        "Pelacakan komisi montir/mekanik per pengerjaan jasa servis",
        "Pengingat servis berkala & ganti oli via WhatsApp otomatis",
        "Manajemen stok oli, busi, kampas rem, dan ban multi-cabang",
      ],
    },
    HVAC: {
      title: "Servis AC & HVAC",
      headline: "Diagnosa Teknis Unit AC & Kartu Garansi Pengerjaan",
      tagline: "Dirancang khusus teknisi pendingin, cuci AC, dan instalasi cold storage.",
      badge: "❄️ HVAC EDITION",
      metricLabel: "Klaim Garansi Tervalidasi",
      metricValue: "100% Anti-Sengketa",
      points: [
        "Form diagnosa teknis: Kapasitas PK, tipe freon (R32/R410), dan ampere",
        "Penerbitan kartu garansi dingin digital langsung ke WhatsApp klien",
        "Riwayat jadwal cuci AC berkala per unit aset pelanggan",
        "Pencatatan penggunaan gas freon & sparepart pipa/kapasitor",
      ],
    },
    SELLER_ONLINE: {
      title: "Seller TikTok & Shopee",
      headline: "AI Mass Onboarding 300 Produk & Kloning Katalog 1-Klik",
      tagline: "Mesin pencetak omzet bagi toko online dan live streamer e-commerce.",
      badge: "📦 SELLER ONLINE EDITION",
      metricLabel: "Hemat Waktu Upload Katalog",
      metricValue: "10x Lebih Cepat",
      points: [
        "Upload Excel mentah 300 SKU dipoles judul SEO & kategori otomatis oleh AI",
        "Kloning katalog Shopee ke TikTok Shop dalam 1 klik",
        "Kalkulator markup fee admin marketplace agar margin tetap utuh",
        "Sinkronisasi stok anti-overselling antar platform online",
      ],
    },
    GADGET: {
      title: "Pusat HP & Suku Cadang",
      headline: "Pelacakan IMEI Servis & Multi-Tiering Harga Grosir",
      tagline: "Spesialis konter handphone, grosir sparepart LCD, dan pusat reparasi.",
      badge: "📱 GADGET EDITION",
      metricLabel: "Akurasi Tier Harga",
      metricValue: "100% Otomatis di Kasir",
      points: [
        "Ceklis fungsi hardware (layar sentuh, kamera, mic) sebelum dibongkar",
        "Pelacakan nomor IMEI perangkat & histori pergantian suku cadang",
        "Auto-tiering harga otomatis di POS: Retail, Reseller, & Mitra Teknisi",
        "Pengecekan riwayat nota belanja instan untuk verifikasi garansi/retur",
      ],
    },
    FASHION: {
      title: "Butik & Fashion",
      headline: "Multi-Varian Ukuran, Warna & Barcode Tag Pakaian",
      tagline: "Sangat pas untuk butik pakaian, distro, toko sepatu, dan hijab.",
      badge: "👗 FASHION EDITION",
      metricLabel: "Pencarian Varian Barang",
      metricValue: "Instan per SKU",
      points: [
        "Manajemen matriks varian lengkap: Ukuran (S, M, L, XL) dan Warna",
        "Cetak label barcode gantung untuk pakaian dan hanger",
        "Pengaturan diskon grosir untuk pembelian per seri / lusinan",
        "Laporan stok busana terlaris (Fast Moving Fashion Items)",
      ],
    },
  };

  const activeShowcase = INDUSTRY_SHOWCASE[selectedIndustryTab];

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-slate-100 selection:bg-purple-600 selection:text-white">
      {/* Background Decorative Glow */}
      <div className="fixed inset-0 pointer-events-none opacity-25 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 right-10 w-[450px] h-[450px] bg-indigo-600/25 rounded-full blur-[150px]" />
      </div>

      {/* =====================================================================
          1. NAVBAR PUBLIK MODERN
          ===================================================================== */}
      <nav className="relative z-20 border-b border-[#222] bg-[#121212]/80 backdrop-blur-md sticky top-0 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-purple-900/40">
              N
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">NEXUS OS</span>
              <span className="text-[10px] text-gray-400 block -mt-1 font-mono">Universal Business Engine</span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-gray-300">
            <a href="#industri" className="hover:text-purple-300 transition-colors">Jenis Usaha</a>
            <a href="#fitur" className="hover:text-purple-300 transition-colors">Fitur Unggulan</a>
            <a href="#harga" className="hover:text-purple-300 transition-colors">Biaya & Paket</a>
            <a href="#faq" className="hover:text-purple-300 transition-colors">Tanya Jawab</a>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Dashboard Toko</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/admin"
              className="hidden lg:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Command Center</span>
            </Link>
            <Link
              href="/pos"
              className="hidden sm:inline-block px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#222] transition-colors"
            >
              Coba Kasir Langsung
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <span>Daftar Gratis 30 Detik</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* =====================================================================
          2. HERO SECTION DENGAN VALUE PROPOSITION TINGGI
          ===================================================================== */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center flex flex-col items-center">
        {/* Banner Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>SaaS Universal Pertama di Indonesia • Freemium Mandiri</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-[1.15] max-w-4xl">
          Satu Aplikasi Operasional untuk{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-emerald-400">
            Segala Jenis Usaha Anda.
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-sm sm:text-lg text-gray-300 max-w-2xl mt-5 leading-relaxed">
          Tinggalkan aplikasi kasir kaku. NEXUS OS otomatis beradaptasi menjadi aplikasi 
          <strong> Ritel Minimarket, Bengkel Motor, Servis AC HVAC, Seller TikTok/Shopee, Fashion Butik</strong>, 
          hingga <strong>Pusat Gadget & Sparepart</strong>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mt-8 w-full sm:w-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-2xl shadow-purple-900/50 hover:shadow-purple-700/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Mulai Coba Gratis Sekarang (30 Detik)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pos"
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#1c1c1c] hover:bg-[#242424] border border-[#333] text-gray-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <span>Lihat Demo Kasir Langsung</span>
          </Link>
        </div>

        {/* Quick Launch Direct App Modules */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-[#141414] border border-[#262626] text-xs">
          <span className="text-[11px] font-mono text-gray-500 px-2 py-1">Pintasan Akses:</span>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-300 font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>📊 Dashboard Toko</span>
          </Link>
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-300 font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>⚡ Command Center Admin</span>
          </Link>
          <Link
            href="/ecommerce/cloner"
            className="px-3 py-1.5 rounded-xl bg-pink-600/15 hover:bg-pink-600/25 border border-pink-500/20 text-pink-300 font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>🛍️ Kloning E-Commerce</span>
          </Link>
          <Link
            href="/reports"
            className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-300 font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>📈 Laporan & Treasury</span>
          </Link>
        </div>

        {/* 3 Garansi Utama */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 mt-10 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Operasional Kasir Gratis Selamanya
          </span>
          <span className="flex items-center gap-1.5">
            <WifiOff className="w-4 h-4 text-purple-400" />
            Bisa Kerja Offline (Internet Mati Aman)
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Tanpa Kartu Kredit & Onboarding Mandiri
          </span>
        </div>
      </section>

      {/* =====================================================================
          3. SHOWCASE TRANSFORMASI MULTI-INDUSTRI (INTERACTIVE TABS)
          ===================================================================== */}
      <section id="industri" className="relative z-10 max-w-6xl mx-auto px-4 py-16 border-t border-[#1f1f1f]">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono">
            DYNAMIC BUSINESS PRESETS
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
            Aplikasi Menyesuaikan Diri dengan Bisnis Anda
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Klik jenis usaha di bawah untuk melihat bagaimana istilah, menu servis, dan form diagnosa otomatis bertransformasi:
          </p>
        </div>

        {/* Tab Pilihan 6 Industri */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
          {(Object.keys(INDUSTRY_SHOWCASE) as BusinessType[]).map((key) => {
            const isSelected = selectedIndustryTab === key;
            const item = INDUSTRY_SHOWCASE[key];
            const icon = key === "RETAIL" ? "🛒" : key === "BENGKEL" ? "🔧" : key === "HVAC" ? "❄️" : key === "SELLER_ONLINE" ? "📦" : key === "GADGET" ? "📱" : "👗";

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedIndustryTab(key)}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  isSelected
                    ? "bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-950/30 scale-105"
                    : "bg-[#141414] border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-bold leading-tight">{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Card Showcase Detail Industri Terpilih */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Sisi Kiri: Deskripsi & Keunggulan */}
            <div className="lg:col-span-7 space-y-4">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 inline-block">
                {activeShowcase.badge}
              </span>

              <h3 className="text-xl sm:text-3xl font-extrabold text-white leading-tight">
                {activeShowcase.headline}
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                {activeShowcase.tagline}
              </p>

              <div className="space-y-2.5 pt-2">
                {activeShowcase.points.map((pt, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-purple-900/30"
                >
                  <span>Gunakan Preset {activeShowcase.title}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Sisi Kanan: Metric Highlight & Visual Snapshot */}
            <div className="lg:col-span-5 bg-[#181818] border border-[#303030] rounded-2xl p-6 text-center space-y-4 shadow-xl">
              <span className="text-xs text-gray-400 block font-semibold">Tolok Ukur Efisiensi Operasional</span>
              <div className="p-4 rounded-xl bg-[#121212] border border-[#242424]">
                <span className="text-3xl sm:text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 block">
                  {activeShowcase.metricValue}
                </span>
                <span className="text-xs text-gray-300 font-medium mt-1 block">
                  {activeShowcase.metricLabel}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 italic">
                💡 Semua form penerimaan unit, diagnosa, dan kosakata otomatis aktif begitu Anda memilih profil ini saat registrasi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. 4 FITUR UTAMA ENGINE KELAS ENTERPRISE
          ===================================================================== */}
      <section id="fitur" className="relative z-10 max-w-6xl mx-auto px-4 py-16 border-t border-[#1f1f1f]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
            CORE PLATFORM CAPABILITIES
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
            Teknologi Hebat di Balik Toko Anda
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Empat pilar utama yang menjaga kasir Anda tetap cepat, stok Anda anti-bocor, dan omzet Anda meningkat:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fitur 1: POS Offline-First */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141414] border border-[#262626] hover:border-purple-500/40 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
              Kasir POS Cepat & Tetap Bisa Jualan Tanpa Internet
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Koneksi internet mati di toko? Tidak masalah. Kasir tetap bisa melayani antrean pembeli, scan barcode, 
              dan cetak struk nota. Begitu internet aktif kembali, semua data otomatis disinkronkan ke server pusat di background.
            </p>
          </div>

          {/* Fitur 2: Stok Multi-Lokasi & Karantina */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141414] border border-[#262626] hover:border-blue-500/40 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Warehouse className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
              Stok Multi-Lokasi & Gudang Karantina Barang Rusak
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Pantau posisi stok real-time antara Gudang Pusat dan Toko Cabang. Pisahkan barang cacat/rusak ke 
              Gudang Karantina agar tidak sengaja terjual ke konsumen, dan lakukan retur klaim ke supplier tanpa kehilangan uang modal.
            </p>
          </div>

          {/* Fitur 3: AI Mass Onboarding 300 Produk */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141414] border border-[#262626] hover:border-amber-500/40 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
              AI Mass Onboarding & Sinkronisasi E-Commerce
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Punya ratusan SKU barang di toko fisik? Cukup upload Excel mentah, kecerdasan buatan kami otomatis 
              membuatkan judul SEO, estimasi berat pengiriman, dan kategori resmi Shopee & TikTok Shop dalam sekejap.
            </p>
          </div>

          {/* Fitur 4: CRM 360 & Bot WhatsApp */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141414] border border-[#262626] hover:border-emerald-500/40 transition-all space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
              Customer 360, Auto-Tiering & WhatsApp Lifecycle
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Kasir cukup ketik nama pelanggan di POS, sistem otomatis memberikan harga Retail, Reseller, atau Teknisi. 
              Riwayat nota tersimpan rapi untuk pengecekan retur barang, plus pesan WhatsApp otomatis purna-jual.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. TABEL HARGA TRANSPARAN (FREEMIUM MANDIRI)
          ===================================================================== */}
      <section id="harga" className="relative z-10 max-w-5xl mx-auto px-4 py-16 border-t border-[#1f1f1f]">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-widest font-mono">
            PRICING MODEL
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
            Harga Transparan, Tanpa Jebakan
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Operasional dasar kasir dan stok gratis selamanya. Anda hanya membayar jika membutuhkan otomasi AI tingkat lanjut.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Paket 1: Starter (Gratis Selamanya) */}
          <div className="bg-[#141414] border border-[#282828] rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Operasional Dasar
              </span>
              <h3 className="text-2xl font-bold text-white">Paket Starter</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white font-mono">Rp 0</span>
                <span className="text-xs text-gray-400">/ selamanya</span>
              </div>
              <p className="text-xs text-gray-400">
                Semua yang Anda butuhkan untuk menjalankan kasir toko fisik harian tanpa pusing biaya bulanan.
              </p>

              <div className="pt-4 border-t border-[#222] space-y-2.5 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Kasir POS & Scan Barcode Tanpa Batas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Transaksi Offline (Bisa jualan saat mati internet)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cetak Nota Struk Thermal Bluetooth</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tutup Shift Kasir & Blind Balancing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pencatatan Stok & Mutasi Multi-Gudang</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Database Pelanggan & Auto-Tiering Harga</span>
                </div>
              </div>
            </div>

            <Link
              href="/register"
              className="w-full py-3.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-white font-bold text-xs transition-colors text-center block border border-[#333]"
            >
              Daftar Gratis (Mulai Sekarang)
            </Link>
          </div>

          {/* Paket 2: Pro AI & E-Commerce (Berbayar / Gated) */}
          <div className="bg-gradient-to-b from-purple-950/40 via-[#161616] to-[#141414] border-2 border-purple-500/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-2xl shadow-purple-950/30 relative">
            <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-lg">
              Rekomendasi Skala Usaha
            </div>

            <div className="space-y-4">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                Autonomous Intelligence
              </span>
              <h3 className="text-2xl font-bold text-white">Paket Pro AI</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white font-mono">Rp 149.000</span>
                <span className="text-xs text-gray-400">/ bulan</span>
              </div>
              <p className="text-xs text-gray-400">
                Otomatisasi tingkat lanjut untuk meningkatkan penjualan online dan asisten kecerdasan buatan.
              </p>

              <div className="pt-4 border-t border-[#262626] space-y-2.5 text-xs text-gray-200">
                <div className="flex items-center gap-2 font-semibold text-purple-300">
                  <Star className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400" />
                  <span>Semua fitur di Paket Starter</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>AI Mass Onboarding 300 Produk ke Shopee & TikTok</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Bot CS WhatsApp 24 Jam Otomatis Ramah Konsumen</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Laporan Laba Rugi Eksekutif via Bot Telegram CFO</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Kustomisasi Form & Field Khusus via Teknisi AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Prioritas Konsultasi Bisnis Command Center</span>
                </div>
              </div>
            </div>

            <Link
              href="/register"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition-all text-center block hover:scale-105 active:scale-95"
            >
              Mulai dengan Starter & Upgrade Kapan Saja
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. TANYA JAWAB UMUM (FAQ)
          ===================================================================== */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-4 py-16 border-t border-[#1f1f1f]">
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">FAQ</span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Pertanyaan yang Sering Diajukan</h2>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] space-y-1.5">
            <h4 className="font-bold text-sm text-white">Apakah kasir POS benar-benar gratis selamanya?</h4>
            <p className="text-gray-400 leading-relaxed">
              Ya, 100%! Anda bisa menggunakan kasir POS, mencetak struk belanja, mencatat stok, dan tutup kasir tanpa dipungut biaya bulanan selamanya.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] space-y-1.5">
            <h4 className="font-bold text-sm text-white">Bagaimana jika koneksi internet di toko saya mati atau tidak stabil?</h4>
            <p className="text-gray-400 leading-relaxed">
              NEXUS OS menggunakan arsitektur <em>Offline-First (Dexie.js IndexedDB)</em>. Kasir Anda tetap bisa memproses transaksi dan mencetak struk seperti biasa. Begitu internet toko tersambung kembali, sistem otomatis mengirimkan data transaksi ke cloud tanpa ada data yang hilang.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] space-y-1.5">
            <h4 className="font-bold text-sm text-white">Bagaimana jika saat mendaftar saya salah memilih jenis usaha?</h4>
            <p className="text-gray-400 leading-relaxed">
              Sangat mudah! Anda tidak perlu membuat akun baru. Cukup buka widget Konsultan AI / Command Center kami di pojok layar dan katakan jenis usaha Anda yang sebenarnya. Sistem akan menyesuaikan profil toko Anda seketika tanpa menghapus data produk yang sudah ada.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. FOOTER & CTA PENUTUP
          ===================================================================== */}
      <footer className="relative z-10 border-t border-[#1f1f1f] bg-[#0b0b0b] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
              N
            </div>
            <span>© 2024 NEXUS OS • Universal Business Operating System Indonesia</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <Link href="/register" className="hover:text-white transition-colors">Daftar Akun</Link>
            <span>•</span>
            <Link href="/pos" className="hover:text-white transition-colors">Demo POS</Link>
            <span>•</span>
            <Link href="/admin" className="hover:text-white transition-colors">Command Center</Link>
          </div>
        </div>
      </footer>

      {/* Widget Chat AI Sales Frontliner */}
      <AISalesFrontliner />
    </div>
  );
}
