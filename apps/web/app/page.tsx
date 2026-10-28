import Link from "next/link";
import { 
  ShoppingCart, 
  BrainCircuit, 
  Inbox, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Wrench,
  Clock
} from "lucide-react";
import { formatRupiah } from "@/lib/api";

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Banner Selamat Datang */}
      <div className="bg-gradient-to-r from-purple-950/40 via-[#181818] to-[#141414] border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-purple-600/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono uppercase tracking-wider">
                Nexus Core OS • Enterprise
              </span>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Sistem Operasional Normal
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Selamat Datang di FixPhone & Parts Control Center
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl">
              Platform terintegrasi POS, manajemen servis unit handphone, basis pengetahuan ahli, dan asisten AI otonom dengan supervisi manusia (Human-in-the-Loop).
            </p>
          </div>

          <Link
            href="/pos"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all w-fit"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Buka Kasir POS</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Estimasi Omzet Hari Ini</span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-white font-mono">{formatRupiah(3850000)}</p>
            <p className="text-[10px] text-emerald-400 font-medium mt-1">▲ +18.4% dari kemarin</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Unit HP Dalam Servis</span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Smartphone className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-white font-mono">14 Unit</p>
            <p className="text-[10px] text-gray-400 mt-1">4 unit siap diambil pelanggan</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Draft AI Butuh Approval</span>
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Inbox className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-purple-300 font-mono">2 Pesan</p>
            <Link href="/ai-inbox" className="text-[10px] text-purple-400 hover:underline mt-1 block">
              Tinjau di AI Inbox →
            </Link>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium">Basis Pengetahuan Aktif</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <BrainCircuit className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl font-black text-white font-mono">18 Modul</p>
            <Link href="/ai-training" className="text-[10px] text-amber-400 hover:underline mt-1 block">
              Kelola di AI Studio →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Action Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Action 1: POS & Kasir */}
        <Link
          href="/pos"
          className="group bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-purple-500/50 rounded-2xl p-6 transition-all flex flex-col justify-between shadow-lg"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-600/15 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors mb-1">
              Point of Sale & Kasir Servis
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Pencatatan penjualan sparepart HP, aksesoris, serta modul penerimaan servis unit dengan form diagnosa kerusakan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Buka Kasir Sekarang</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Action 2: AI Training */}
        <Link
          href="/ai-training"
          className="group bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-purple-500/50 rounded-2xl p-6 transition-all flex flex-col justify-between shadow-lg"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors mb-1">
              AI Training & Expert Studio
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Latih chatbot toko dengan panduan perbaikan, FAQ diagnosa unit, dan aturan bisnis tanpa risiko halusinasi harga.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Konfigurasi Otak AI</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Action 3: AI Inbox */}
        <Link
          href="/ai-inbox"
          className="group bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-purple-500/50 rounded-2xl p-6 transition-all flex flex-col justify-between shadow-lg"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Inbox className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors mb-1">
              AI Inbox & Supervised Approval
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Tinjau draft pesan otomatis sebelum dikirim ke WhatsApp pelanggan. Setujui atau alihkan ke operator manusia dengan 1 klik.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Buka Inbox Verifikasi</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Security Architecture Summary */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 text-xs text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-white">PostgreSQL Row-Level Security (RLS) Active</p>
            <p className="text-[11px] text-gray-400">
              Tenant ID terisolasi penuh pada level kernel database (Zero cross-tenant leakage).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-purple-300 bg-[#1c1c1c] px-3 py-1.5 rounded-lg border border-[#2b2b2b]">
          <span>Zone B AI Worker</span>
          <span className="text-gray-500">•</span>
          <span>FastAPI Zone A</span>
        </div>
      </div>
    </div>
  );
}
