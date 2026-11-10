"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShoppingCart, 
  Warehouse, 
  Users, 
  Wrench, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  DollarSign, 
  ShieldCheck, 
  Receipt, 
  Package, 
  ChevronRight,
  Eye,
  Lock
} from "lucide-react";
import { formatRupiah } from "@/lib/api";
import { getActiveBusinessPreset, BusinessPresetConfig } from "@/lib/tenant-preset";
import { getActiveStaff, StaffMember, ROLE_LABELS } from "@/lib/rbac";
import AISalesFrontliner from "@/components/AISalesFrontliner";

export default function StoreDashboardPage() {
  const [activePreset, setActivePreset] = useState<BusinessPresetConfig>(() => getActiveBusinessPreset());
  const [activeStaff, setActiveStaff] = useState<StaffMember>(() => getActiveStaff());
  const [businessName, setBusinessName] = useState<string>("Toko Anda");

  useEffect(() => {
    // Baca nama toko dari localStorage jika ada
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("nexus_active_business_name");
      if (savedName) setBusinessName(savedName);
    }

    const handlePresetChange = (e: any) => {
      if (e.detail) setActivePreset(e.detail);
    };
    const handleStaffChange = (e: any) => {
      if (e.detail) setActiveStaff(e.detail);
    };

    window.addEventListener("nexus_preset_changed", handlePresetChange);
    window.addEventListener("nexus_staff_changed", handleStaffChange);

    return () => {
      window.removeEventListener("nexus_preset_changed", handlePresetChange);
      window.removeEventListener("nexus_staff_changed", handleStaffChange);
    };
  }, []);

  const canViewFinancials = activeStaff.permissions?.can_view_profit_margin ?? true;

  // Data transaksi ringkasan dummy yang relevan
  const RECENT_TRANSACTIONS = [
    { id: "ORD-9481", time: "10:45", customer: "Budi Santoso", items: "3 item", total: 325000, method: "QRIS", cashier: "Budi" },
    { id: "ORD-9480", time: "10:32", customer: "Agus Prasetyo", items: "1 item", total: 180000, method: "CASH", cashier: "Budi" },
    { id: "ORD-9479", time: "10:15", customer: "Pelanggan Umum", items: "2 item", total: 95000, method: "CASH", cashier: "Owner" },
    { id: "ORD-9478", time: "09:50", customer: "Siti Rahma", items: "5 item", total: 720000, method: "TRANSFER", cashier: "Owner" },
  ];

  const LOW_STOCK_ITEMS = [
    { name: activePreset.id === "BENGKEL" ? "Oli Mesin Matic 10W-40 0.8L" : "Kabel Data Type-C Fast 65W", stock: 2, min: 10 },
    { name: activePreset.id === "FASHION" ? "Kemeja Linen Putih Size M" : "Baterai Li-ion High Capacity", stock: 3, min: 15 },
    { name: activePreset.id === "HVAC" ? "Kapasitor AC 35uF Daikin/Panasonic" : "Adaptor Charger 30W GaN", stock: 1, min: 8 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Banner Selamat Datang & Profil Toko */}
      <div className="bg-gradient-to-r from-purple-950/40 via-[#181818] to-[#141414] border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-purple-600/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono uppercase tracking-wider">
                Profil Bisnis: {activePreset.name}
              </span>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Operasional Normal
              </span>
              <span className="text-xs text-gray-400">
                • Login sebagai: <strong className="text-white">{activeStaff.name}</strong> ({ROLE_LABELS[activeStaff.role]})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Dashboard Operasional {businessName}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 max-w-2xl">
              {activePreset.tagline}. Pantau omzet penjualan, stok barang menipis, dan kelola antrean kasir secara real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/25 transition-all hover:scale-105 active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Buka Kasir POS</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* METRICS CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Omzet Hari Ini */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Omzet Kasir Hari Ini</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            {canViewFinancials ? (
              <>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {formatRupiah(4850000)}
                </p>
                <p className="text-[11px] text-emerald-400 font-medium mt-1">
                  ▲ +18.4% dari kemarin
                </p>
              </>
            ) : (
              <div className="py-1">
                <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30">
                  <Lock className="w-3.5 h-3.5" /> Terkunci (Khusus Owner)
                </span>
                <p className="text-[10px] text-gray-500 mt-1">Akses laba & omzet disembunyikan oleh RBAC</p>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Total Transaksi */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Transaksi Selesai</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-white font-mono">34 Nota</p>
            <p className="text-[11px] text-gray-400 mt-1">Rata-rata Rp 142.600 / transaksi</p>
          </div>
        </div>

        {/* Metric 3: Produk Menipis */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">Stok Kritis Menipis</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono">3 Produk</p>
            <Link href="/inventory" className="text-[11px] text-purple-400 hover:underline mt-1 inline-block">
              Perlu restock segera →
            </Link>
          </div>
        </div>

        {/* Metric 4: Servis Aktif atau Pelanggan Baru */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold">
              {activePreset.hasServiceMode ? "Tiket Servis Aktif" : "Pelanggan Terdaftar"}
            </span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              {activePreset.hasServiceMode ? <Wrench className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            </span>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-white font-mono">
              {activePreset.hasServiceMode ? "5 Unit Servis" : "128 Kontak"}
            </p>
            <Link 
              href={activePreset.hasServiceMode ? "/repair" : "/crm"} 
              className="text-[11px] text-purple-400 hover:underline mt-1 inline-block"
            >
              Lihat detail {activePreset.hasServiceMode ? "perbaikan" : "CRM"} →
            </Link>
          </div>
        </div>
      </div>

      {/* DUA KOLOM: TRANSAKSI TERBARU & DAFTAR STOK KRITIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri (2/3): Transaksi Kasir Terbaru */}
        <div className="lg:col-span-2 rounded-2xl border border-[#262626] bg-[#141414] p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Transaksi Kasir Terakhir Hari Ini</h2>
            </div>
            <Link href="/pos" className="text-xs text-purple-400 hover:underline">
              Buka Kasir POS →
            </Link>
          </div>

          <div className="divide-y divide-[#222]">
            {RECENT_TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1e1e1e] border border-[#2d2d2d] flex items-center justify-center font-mono font-bold text-purple-400 text-[10px]">
                    {tx.time}
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-2">
                      <span>{tx.customer}</span>
                      <span className="font-mono text-[10px] text-gray-500">{tx.id}</span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {tx.items} • Diproses oleh: <strong className="text-gray-300">{tx.cashier}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-bold text-white">
                    {canViewFinancials ? formatRupiah(tx.total) : "Rp ••••••"}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[#222] text-gray-400">
                    {tx.method}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom Kanan (1/3): Barang Menipis & Navigasi Cepat */}
        <div className="space-y-6">
          {/* Box Barang Menipis */}
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Peringatan Stok Menipis</span>
              </h3>
              <Link href="/inventory" className="text-[11px] text-purple-400 hover:underline">
                Kelola Stok
              </Link>
            </div>

            <div className="space-y-2.5">
              {LOW_STOCK_ITEMS.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#282828] flex items-center justify-between text-xs">
                  <div className="truncate flex-1 pr-2">
                    <p className="font-medium text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400">Batas minimum: {item.min} unit</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-bold text-[11px] shrink-0 border border-red-500/30">
                    Sisa: {item.stock}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shortcut Cepat */}
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 space-y-2.5 shadow-sm">
            <h3 className="text-xs font-bold text-white mb-2">Akses Cepat Modul</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/inventory"
                className="p-3 rounded-xl bg-[#1b1b1b] hover:bg-[#242424] border border-[#2a2a2a] flex flex-col justify-between transition-colors"
              >
                <Warehouse className="w-4 h-4 text-purple-400 mb-1" />
                <span className="font-semibold text-white">Stok Gudang</span>
                <span className="text-[10px] text-gray-400">Atur HPP & Multi-Tier</span>
              </Link>

              <Link
                href="/crm"
                className="p-3 rounded-xl bg-[#1b1b1b] hover:bg-[#242424] border border-[#2a2a2a] flex flex-col justify-between transition-colors"
              >
                <Users className="w-4 h-4 text-blue-400 mb-1" />
                <span className="font-semibold text-white">CRM Pelanggan</span>
                <span className="text-[10px] text-gray-400">Audit Retur & Tiering</span>
              </Link>

              <Link
                href="/settings/team"
                className="p-3 rounded-xl bg-[#1b1b1b] hover:bg-[#242424] border border-[#2a2a2a] flex flex-col justify-between transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="font-semibold text-white">Kelola Tim</span>
                <span className="text-[10px] text-gray-400">Hak Akses & PIN Staf</span>
              </Link>

              <Link
                href="/import"
                className="p-3 rounded-xl bg-[#1b1b1b] hover:bg-[#242424] border border-[#2a2a2a] flex flex-col justify-between transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-400 mb-1" />
                <span className="font-semibold text-white">AI Onboarding</span>
                <span className="text-[10px] text-gray-400">300 SKU Otomatis</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Chat Autonomous Copilot Toko */}
      <AISalesFrontliner />
    </div>
  );
}
