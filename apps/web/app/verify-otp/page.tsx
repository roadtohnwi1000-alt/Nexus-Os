"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ShieldCheck, 
  RotateCw, 
  ArrowRight, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  RefreshCw,
  Zap,
  ArrowLeft
} from "lucide-react";
import { verifyOTP, resendOTP } from "@/lib/api";
import { setActiveBusinessPreset, BusinessType } from "@/lib/tenant-preset";
import AISalesFrontliner from "@/components/AISalesFrontliner";

export default function VerifyOTPPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("Toko Anda");
  const [businessType, setBusinessType] = useState<BusinessType>("RETAIL");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);

  // 4 Kotak Input OTP
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    // Ambil phone dari URL query atau sessionStorage
    const phoneParam = searchParams.get("phone");
    const storedPhone = typeof window !== "undefined" ? sessionStorage.getItem("nexus_pending_phone") : "";
    const effectivePhone = phoneParam || storedPhone || "+6281234567890";
    setPhone(effectivePhone);

    if (typeof window !== "undefined") {
      const storedName = sessionStorage.getItem("nexus_pending_business_name");
      const storedType = sessionStorage.getItem("nexus_pending_business_type") as BusinessType;
      const storedOtpPreview = sessionStorage.getItem("nexus_pending_otp_preview");
      if (storedName) setBusinessName(storedName);
      if (storedType) setBusinessType(storedType);
      if (storedOtpPreview) setOtpPreview(storedOtpPreview);
    }

    // Auto-focus kotak pertama
    inputRefs[0].current?.focus();
  }, [searchParams]);

  // Timer hitung mundur kirim ulang
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleDigitChange = (index: number, value: string) => {
    // Hanya izinkan angka
    const cleanVal = value.replace(/[^0-9]/g, "");
    if (!cleanVal && value !== "") return;

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal.slice(-1); // Ambil digit terakhir
    setOtpDigits(newDigits);
    setErrorMessage(null);

    // Auto-focus ke kotak berikutnya
    if (cleanVal && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Jika ke-4 digit sudah terisi, otomatis verifikasi
    if (cleanVal && index === 3) {
      const fullCode = newDigits.join("");
      if (fullCode.length === 4) {
        triggerVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 4);
    if (pasteData.length > 0) {
      const newDigits = ["", "", "", ""];
      for (let i = 0; i < pasteData.length; i++) {
        newDigits[i] = pasteData[i];
      }
      setOtpDigits(newDigits);
      if (pasteData.length === 4) {
        triggerVerify(pasteData);
      } else {
        inputRefs[Math.min(pasteData.length, 3)].current?.focus();
      }
    }
  };

  const triggerVerify = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || otpDigits.join("");
    if (fullCode.length < 4) {
      setErrorMessage("Silakan masukkan 4-digit kode OTP lengkap!");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);

      const res = await verifyOTP({
        phone: phone,
        otp_code: fullCode,
      });

      setSuccessMessage(`✓ Verifikasi berhasil! Mengaktifkan profil toko "${res.business_name}"...`);

      // Terapkan preset bisnis yang dipilih ke sistem
      setActiveBusinessPreset(res.business_type as BusinessType);

      if (typeof window !== "undefined") {
        if (res.token) {
          localStorage.setItem("nexus_auth_token", res.token);
        }
        localStorage.setItem("nexus_active_tenant_id", res.tenant_id);
        localStorage.setItem("nexus_active_business_name", res.business_name);
        sessionStorage.removeItem("nexus_pending_otp_preview");
      }

      // Alihkan langsung ke layar POS Kasir yang sudah siap jualan
      setTimeout(() => {
        router.push(res.redirect_url || "/pos");
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Kode OTP salah atau telah kedaluwarsa!");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;

    try {
      setIsResending(true);
      setErrorMessage(null);

      const res = await resendOTP(phone);
      if (res.otp_preview) {
        setOtpPreview(res.otp_preview);
      }

      setCountdown(60);
      setOtpDigits(["", "", "", ""]);
      inputRefs[0].current?.focus();
      setSuccessMessage("✓ Kode OTP baru telah dikirimkan ke WhatsApp Anda!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengirim ulang OTP.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-slate-100 flex flex-col justify-between selection:bg-purple-600 selection:text-white">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/30 rounded-full blur-[140px]" />
      </div>

      {/* Navbar Minimalis */}
      <header className="relative z-10 border-b border-[#222] bg-[#121212]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-purple-900/40">
            N
          </div>
          <span className="font-bold text-sm tracking-tight text-white">NEXUS OS</span>
        </Link>

        <Link
          href="/register"
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ubah Data Registrasi</span>
        </Link>
      </header>

      {/* Konten Utama Verifikasi OTP */}
      <main className="relative z-10 flex-1 max-w-md mx-auto w-full px-4 py-12 flex flex-col items-center justify-center">
        <div className="w-full bg-[#141414] border border-[#282828] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm text-center">
          {/* Ikon WhatsApp OTP */}
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-950/30">
            <MessageSquare className="w-7 h-7" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Verifikasi WhatsApp OTP
          </h2>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Kami telah mengirimkan 4-digit kode ke nomor WhatsApp:
          </p>
          <p className="text-sm font-mono font-bold text-purple-300 mt-0.5">
            {phone}
          </p>

          {/* Banner Sandbox Testing Helper (Mempermudah Uji Coba Tanpa Saldo WA) */}
          {otpPreview && (
            <div className="mt-4 p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between gap-2">
              <div className="text-left">
                <span className="text-[10px] text-purple-400 block font-semibold uppercase">Mode Uji Coba / Sandbox:</span>
                <span className="font-mono font-bold text-white text-sm">Kode: {otpPreview}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const digits = otpPreview.split("");
                  setOtpDigits(digits);
                  triggerVerify(otpPreview);
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors"
              >
                Gunakan Kode Ini
              </button>
            </div>
          )}

          {/* Feedback Banner */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 4 Kotak Input OTP */}
          <div className="flex items-center justify-center gap-3 my-6" onPaste={handlePaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={inputRefs[i]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={isVerifying}
                className="w-14 h-16 bg-[#1a1a1a] border border-[#333] focus:border-purple-500 rounded-xl text-center font-mono text-2xl font-bold text-white focus:outline-none transition-all shadow-inner"
              />
            ))}
          </div>

          {/* Tombol Verifikasi */}
          <button
            type="button"
            disabled={isVerifying || otpDigits.join("").length < 4}
            onClick={() => triggerVerify()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <>
                <span>Aktivasi Toko & Masuk Kasir</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Timer Kirim Ulang OTP */}
          <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between text-xs text-gray-400">
            <span>Belum menerima pesan WhatsApp?</span>
            {countdown > 0 ? (
              <span className="font-mono text-gray-500">Kirim ulang ({countdown}s)</span>
            ) : (
              <button
                type="button"
                disabled={isResending}
                onClick={handleResend}
                className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
              >
                {isResending ? <RotateCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>Kirim Ulang OTP</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1f1f1f] py-4 text-center text-xs text-gray-500">
        © 2024 NEXUS OS • Universal Business Operating System Indonesia
      </footer>

      <AISalesFrontliner currentBusinessType={businessType} />
    </div>
  );
}
