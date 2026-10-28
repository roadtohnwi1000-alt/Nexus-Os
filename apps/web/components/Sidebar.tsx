"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  BrainCircuit, 
  Inbox, 
  Sparkles, 
  ShieldCheck,
  Smartphone,
  ChevronRight,
  UploadCloud
} from "lucide-react";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Point of Sale (POS)",
    href: "/pos",
    icon: ShoppingCart,
    badge: "Live",
  },
  {
    name: "AI Training",
    href: "/ai-training",
    icon: BrainCircuit,
    badge: null,
  },
  {
    name: "AI Inbox",
    href: "/ai-inbox",
    icon: Inbox,
    badge: "Review",
  },
  {
    name: "Data Import",
    href: "/import",
    icon: UploadCloud,
    badge: "Accurate",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // State untuk menampilkan jumlah item di keranjang POS secara real-time
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // Fungsi untuk membaca total qty dari localStorage
    const updateCartCount = () => {
      try {
        const saved = localStorage.getItem("nexus_pos_cart");
        if (saved) {
          const parsed = JSON.parse(saved) as Array<{ qty: number }>;
          const total = parsed.reduce((sum, ci) => sum + (ci.qty || 0), 0);
          setCartCount(total);
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
    };

    // Baca saat pertama mount
    updateCartCount();

    // Dengarkan perubahan dari tab lain (event "storage" hanya muncul di tab berbeda)
    window.addEventListener("storage", updateCartCount);

    // Poll setiap detik untuk menangkap perubahan dari tab yang sama
    const interval = setInterval(updateCartCount, 1000);

    return () => {
      window.removeEventListener("storage", updateCartCount);
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="w-64 bg-[#141414] border-r border-[#262626] flex flex-col justify-between h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-[#262626] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white">NEXUS</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  OS
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono tracking-wider">ENTERPRISE CORE</p>
            </div>
          </Link>
        </div>

        {/* Tenant Indicator */}
        <div className="mx-3 mt-4 p-3 rounded-lg bg-[#1a1a1a] border border-[#2b2b2b]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active Tenant</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-medium text-white truncate">FixPhone & Parts</p>
              <p className="text-[10px] text-gray-400 font-mono truncate">11111111-1111...1111</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5 mt-3">
          <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Main Menu</p>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-[#1f1f1f] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-purple-400" : "text-gray-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? "bg-purple-500 text-white" : "bg-[#262626] text-gray-400"
                  }`}>
                    {/* Untuk POS: tampilkan jumlah item di keranjang jika ada, fallback ke badge statis */}
                    {item.href === "/pos" && cartCount > 0 ? cartCount : item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-[#262626] bg-[#111111]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center text-xs font-bold text-white border border-purple-500/30">
            A
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-medium text-white truncate">Administrator</p>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-purple-400" /> RLS Protected
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
