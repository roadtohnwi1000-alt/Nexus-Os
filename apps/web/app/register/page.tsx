"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  User, 
  Phone, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  RotateCw,
  AlertCircle,
  HelpCircle,
  Check
} from "lucide-react";
import { registerTenant } from "@/lib/api";
import { BUSINESS_PRESETS, BusinessType, setActiveBusinessPreset } from "@/lib/tenant-preset";
import AISalesFrontliner from "@/components/AISalesFrontliner";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    owner_name: "",
    business_name: "",
    business_type: "RETAIL" as BusinessType,
    phone: "",
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.business_name.trim() || !form.phone.trim() || !form.password.trim()) {
      setErrorMessage("Semua kolom bertanda bintang (*) wajib diisi!");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await registerTenant({
        owner_name: form.owner_name.trim(),
        business_name: form.business_name.trim(),
        business_type: form.business_type,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
      });

      // Simpan session sementara untuk verifikasi OTP
      if (typeof window !== "undefined") {
        sessionStorage.setItem("nexus_pending_phone", res.phone);
        sessionStorage.setItem("nexus_pending_tenant_id", res.tenant_id);
        sessionStorage.setItem("nexus_pending_business_name", res.business_name);
        sessionStorage.setItem("nexus_pending_business_type", res.business_type);
        if (res.otp_preview) {
          sessionStorage.setItem("nexus_pending_otp_preview", res.otp_preview);
        }
      }

      // Terapkan preset yang dipilih ke local store
      setActiveBusinessPreset(form.business_type);

      // Alihkan ke halaman verifikasi WhatsApp OTP
      router.push(`/verify-otp?phone=${encodeURIComponent(res.phone)}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mendaftarkan akun. Silakan periksa kembali data Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const PRESET_OPTIONS: { id: BusinessType; name: string; icon: string; desc: string }[] = [
    { id: "RETAIL", name: "Ritel & Minimarket", icon: "🛒", desc: "Toko sembako, kelontong, eceran barcode" },
    { id: "BENGKEL", name: "Bengkel Motor / Mobil", icon: "🔧", desc: "Servis plat nomor, riwayat montir, oli" },
    { id: "HVAC", name: "Servis AC & HVAC", icon: "❄️", desc: "Pekerjaan AC, cek PK, freon, garansi cuci" },
    { id: "SELLER_ONLINE", name: "Seller TikTok & Shopee", icon: "📦", desc: "Toko online, e-commerce sync, mass upload" },
    { id: "GADGET", name: "Pusat HP & Suku Cadang", icon: "📱", desc: "Servis IMEI, layar sentuh, multi-tier part" },
    { id: "FASHION", name: "Butik & Pakaian", icon: "👗", desc: "Varian ukuran (S/M/L/XL), warna, barcode tag" },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-slate-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      {/* Background Decorative Gradient */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/30 rounded-full blur-[128px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/30 rounded-full blur-[128px]" />
      </div>

      {/* Navbar Minimalis */}
      <header className="relative z-10 border-b border-[#222] bg-[#121212]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-purple-900/40">
            N
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block">NEXUS OS</span>
            <span className="text-[10px] text-gray-400 block -mt-1">Universal Business Suite</span>
          </div>
        </Link>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400 hidden sm:inline">Sudah punya akun toko?</span>
          <Link
            href="/pos"
            className="px-3.5 py-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-white font-semibold transition-colors border border-[#333]"
          >
            Masuk Kasir
          </Link>
        </div>
      </header>

      {/* Konten Utama Form Registrasi 30 Detik */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Banner Kepercayaan */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Freemium Mandiri • Kasir POS & Stok Gratis Selamanya</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-white text-center tracking-tight max-w-xl leading-tight">
          Mulai Toko Anda dalam <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">30 Detik</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 text-center max-w-md mt-2 mb-8">
          Daftar instan tanpa kartu kredit. Sistem langsung menyesuaikan istilah dan form sesuai jenis usaha Anda.
        </p>

        {/* Card Formulir Registrasi */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. SELEKSI PROFIL BISNIS (6 CARD DENGAN IKON) */}
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-2 flex items-center justify-between">
                <span>1. Pilih Jenis Usaha Anda <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-gray-400 font-normal">Dapat disesuaikan kapan saja lewat AI</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PRESET_OPTIONS.map((opt) => {
                  const isSelected = form.business_type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, business_type: opt.id })}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 shadow-md shadow-purple-900/30"
                          : "bg-[#181818] border-[#292929] hover:border-[#3a3a3a] hover:bg-[#1e1e1e]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{opt.icon}</span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-white leading-tight">{opt.name}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5 leading-snug line-clamp-2">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. INFORMASI USAHA & OWNER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Nama Toko / Usaha <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    placeholder="Contoh: Toko Berkah / Hendra Motor"
                    className="w-full bg-[#181818] border border-[#2c2c2c] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Nama Pemilik Usaha <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    placeholder="Nama lengkap Anda"
                    className="w-full bg-[#181818] border border-[#2c2c2c] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            </div>

            {/* 3. NOMOR WHATSAPP & PASSWORD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Nomor WhatsApp Aktif <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#2c2c2c] bg-[#202020] text-gray-300 text-xs font-mono">
                    🇮🇩 +62
                  </span>
                  <input
                    type="text"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="81234567890"
                    className="w-full bg-[#181818] border border-[#2c2c2c] rounded-r-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Kode OTP 4-digit akan dikirimkan ke nomor WhatsApp ini.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Password Akun Owner <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-[#181818] border border-[#2c2c2c] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Digunakan untuk login utama pemilik usaha.
                </p>
              </div>
            </div>

            {/* Tombol Submit Pendaftaran */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-purple-900/40 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Mempersiapkan Toko & Mengirim OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan Verifikasi WhatsApp OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Checklist Garansi Klien */}
            <div className="pt-3 border-t border-[#222] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                POS Kasir Cepat
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Bisa Kerja Offline
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Manajemen Stok Rapi
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Bebas Biaya Bulanan
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* Footer Minimalis */}
      <footer className="relative z-10 border-t border-[#1f1f1f] py-4 text-center text-xs text-gray-500">
        © 2024 NEXUS OS • Universal Business Operating System Indonesia
      </footer>

      {/* Widget Chat AI Sales Frontliner */}
      <AISalesFrontliner
        currentBusinessType={form.business_type}
        onSelectPreset={(p) => setForm((prev) => ({ ...prev, business_type: p as BusinessType }))}
      />
    </div>
  );
}
