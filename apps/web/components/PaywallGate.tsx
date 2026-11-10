"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Lock, 
  Crown, 
  CheckCircle2, 
  ArrowRight, 
  MessageSquare, 
  Zap, 
  Eye, 
  ShieldAlert 
} from "lucide-react";
import { fetchPlanStatus, requestPlanUpgrade, PlanStatusAPI } from "@/lib/api";

interface PaywallGateProps {
  featureKey: string;
  featureTitle: string;
  featureDescription: string;
  benefits?: string[];
  children: React.ReactNode;
  badgeText?: string;
}

export default function PaywallGate({
  featureKey,
  featureTitle,
  featureDescription,
  benefits = [
    "Otomasi cerdas bertenaga Multi-Agent AI Swarm",
    "Hemat hingga 20+ jam kerja operasional setiap minggu",
    "Dukungan prioritas langsung dari Tim Konsultan NEXUS",
    "Sinkronisasi real-time tanpa batas kuota transaksi",
  ],
  children,
  badgeText = "PRO AI FEATURE",
}: PaywallGateProps) {
  const [planStatus, setPlanStatus] = useState<PlanStatusAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadPlan = async () => {
      try {
        const status = await fetchPlanStatus();
        if (mounted) setPlanStatus(status);
      } catch (e) {
        // Fallback default
        if (mounted) {
          setPlanStatus({
            plan_tier: "STARTER",
            plan_name: "Nexus Starter (Freemium)",
            max_staff_limit: 3,
            current_staff_count: 2,
            is_unlimited_staff: false,
            features: {
              pos: true,
              inventory: true,
              crm: true,
              ai_mass_onboarding: false,
              whatsapp_smartbot: false,
              csuite_advisor: false,
            },
            upgrade_price_monthly: 149000,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPlan();
    return () => { mounted = false; };
  }, []);

  const handleWhatsAppUpgrade = async () => {
    try {
      setRequesting(true);
      const res = await requestPlanUpgrade(featureTitle);
      if (res.whatsapp_url) {
        window.open(res.whatsapp_url, "_blank");
      }
    } catch (e) {
      // Direct fallback WhatsApp
      const fallbackUrl = `https://wa.me/6281234567890?text=${encodeURIComponent(
        `Halo Tim NEXUS OS, saya ingin aktivasi Paket Pro AI untuk membuka fitur ${featureTitle} di toko saya.`
      )}`;
      window.open(fallbackUrl, "_blank");
    } finally {
      setRequesting(false);
    }
  };

  // Jika paket PRO_AI atau demo mode aktif, tampilkan konten fitur asli
  const isFeatureAllowed = planStatus?.features?.[featureKey] ?? false;

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 animate-pulse flex items-center justify-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400 animate-spin" />
        Memeriksa hak akses paket...
      </div>
    );
  }

  if (isFeatureAllowed || demoUnlocked) {
    return (
      <div className="relative">
        {demoUnlocked && (
          <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <strong>Mode Simulasi Sandbox Aktif:</strong> Anda sedang melihat preview fitur Pro AI.
            </span>
            <button
              onClick={() => setDemoUnlocked(false)}
              className="text-gray-400 hover:text-white underline text-[11px]"
            >
              Tutup Preview
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#181511] via-[#121110] to-[#0d0c0b] p-8 text-white shadow-2xl">
      {/* Background glow effects */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
        {/* Badge & Lock Icon */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-sm">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>{badgeText}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-amber-400" />
            {featureTitle}
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed max-w-lg mx-auto">
            {featureDescription}
          </p>
        </div>

        {/* Benefits Checklist Card */}
        <div className="p-4 rounded-xl bg-black/40 border border-[#2a2620] text-left space-y-2.5 max-w-lg mx-auto backdrop-blur-sm">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Keunggulan Eksklusif Paket Pro AI:
          </p>
          <div className="space-y-2">
            {benefits.map((b, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Comparison Teaser */}
        <div className="py-2 flex items-center justify-center gap-4 text-xs">
          <div className="text-gray-400">
            Paket Anda Saat Ini: <span className="text-gray-200 font-semibold">Starter (Rp 0)</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="text-amber-300 font-semibold">
            Hanya Rp 149.000 / bulan (Hemat 80% vs Staf Tambahan)
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleWhatsAppUpgrade}
            disabled={requesting}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg shadow-amber-500/20"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>{requesting ? "Menyiapkan WhatsApp..." : "Aktivasi via WhatsApp (Rp 149rb)"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setDemoUnlocked(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#222] hover:bg-[#2a2a2a] border border-[#333] hover:border-amber-500/40 text-gray-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Coba Simulasi Demo</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-500">
          Aktivasi instan dalam 2 menit. Tanpa komitmen tahunan, batalkan kapan saja.
        </p>
      </div>
    </div>
  );
}
