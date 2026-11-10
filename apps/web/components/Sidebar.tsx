"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  BrainCircuit, 
  Sparkles, 
  ShieldCheck,
  Smartphone, 
  ChevronRight, 
  Wrench, 
  Warehouse, 
  BarChart3, 
  Users,
  Share2,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Building2,
  ShoppingBag,
  Store,
  Video
} from "lucide-react";
import { 
  getActiveBusinessPreset, 
  BusinessPresetConfig, 
  DEFAULT_BUSINESS_TYPE 
} from "@/lib/tenant-preset";
import { 
  getActiveStaff, 
  StaffMember, 
  ROLE_LABELS 
} from "@/lib/rbac";

// Navigasi Bisnis Murni untuk Klien (Main App - Ritel HP & Servis)
const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/dashboard",
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
    name: "Manajemen Stok",
    href: "/inventory",
    icon: Warehouse,
    badge: "Multi",
  },
  {
    name: "Pusat Servis",
    href: "/repair",
    icon: Wrench,
    badge: "HP",
  },
  {
    name: "CRM & Pelanggan",
    href: "/crm",
    icon: Users,
    badge: "360°",
  },
  {
    name: "Pengaturan Tim",
    href: "/settings/team",
    icon: ShieldCheck,
    badge: "RBAC",
  },
  {
    name: "Data Intelligence",
    href: "/intelligence",
    icon: Sparkles,
    badge: "AI",
  },
  {
    name: "Studio Video Remotion",
    href: "/studio",
    icon: Video,
    badge: "9:16",
  },
  {
    name: "Distribusi & Atribusi",
    href: "/publishing",
    icon: Share2,
    badge: "Loop",
  },
  {
    name: "Marketing & E-Comm",
    href: "/marketing",
    icon: Share2,
    badge: "Auto",
  },
  {
    name: "Kloning E-Commerce",
    href: "/ecommerce/cloner",
    icon: ShoppingBag,
    badge: "TikTok",
  },
  {
    name: "Storefront Online",
    href: "/store/demo-store",
    icon: Store,
    badge: "Web",
  },
  {
    name: "Laporan Keuangan",
    href: "/reports",
    icon: BarChart3,
    badge: "GL",
  },
  {
    name: "C-Suite Advisory",
    href: "/advisory",
    icon: BrainCircuit,
    badge: "Exec",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // State Preset Bisnis Aktif (Universal Multi-Tenant)
  const [activePreset, setActivePreset] = useState<BusinessPresetConfig>(() => getActiveBusinessPreset());

  // State untuk menampilkan jumlah item di keranjang POS secara real-time
  const [cartCount, setCartCount] = useState(0);

  // State Collapsible Sidebar (Minimize ke ikon saja sesuai Catatan Hal 11)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // State Staf / Kasir Aktif (RBAC)
  const [activeStaff, setActiveStaffState] = useState<StaffMember>(() => getActiveStaff());

  // State Tema: Dark Mode vs Light Mode Pastel
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    // Sinkronisasi pergantian staf kasir secara real-time
    const handleStaffChange = (e: any) => {
      if (e.detail) {
        setActiveStaffState(e.detail);
      }
    };
    window.addEventListener("nexus_staff_changed", handleStaffChange);

    // Sinkronisasi preset bisnis secara real-time saat diubah dari halaman mana pun
    const handlePresetChange = (e: any) => {
      if (e.detail) {
        setActivePreset(e.detail);
      }
    };
    window.addEventListener("nexus_preset_changed", handlePresetChange);

    // Baca status collapse & tema dari localStorage
    try {
      const savedCollapse = localStorage.getItem("nexus_sidebar_collapsed");
      if (savedCollapse === "true") setIsCollapsed(true);

      const savedTheme = localStorage.getItem("nexus_theme");
      if (savedTheme === "pastel-light") {
        setIsLightMode(true);
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
    } catch {}

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

    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    const interval = setInterval(updateCartCount, 1000);

    return () => {
      window.removeEventListener("nexus_staff_changed", handleStaffChange);
      window.removeEventListener("nexus_preset_changed", handlePresetChange);
      window.removeEventListener("storage", updateCartCount);
      clearInterval(interval);
    };
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    try {
      localStorage.setItem("nexus_sidebar_collapsed", String(nextState));
    } catch {}
  };

  const toggleTheme = () => {
    const nextTheme = !isLightMode;
    setIsLightMode(nextTheme);
    try {
      if (nextTheme) {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        localStorage.setItem("nexus_theme", "pastel-light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
        localStorage.setItem("nexus_theme", "dark");
      }
    } catch {}
  };

  return (
    <aside 
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } bg-[#141414] border-r border-[#262626] flex flex-col justify-between h-screen sticky top-0 select-none z-30 transition-all duration-300 ease-in-out`}
    >
      {/* Brand Header */}
      <div>
        <div className={`p-4 border-b border-[#262626] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg tracking-tight text-white">NEXUS</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    OS
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
                  {activePreset.shortTag} EDITION
                </p>
              </div>
            )}
          </Link>

          {/* Tombol Minimize Sidebar */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              title="Perkecil Sidebar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Jika Collapsed, tombol expand ditaruh di bawah logo */}
        {isCollapsed && (
          <div className="flex justify-center pt-2">
            <button
              onClick={toggleCollapse}
              title="Perbesar Sidebar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tenant Active Indicator (Adaptif sesuai Profil Bisnis) */}
        {!isCollapsed ? (
          <div className="mx-3 mt-3 p-2.5 rounded-xl bg-[#1a1a1a] border border-[#2b2b2b]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Profil Usaha</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{activePreset.name}</p>
                <p className="text-[10px] text-gray-400 font-mono truncate">{activePreset.tagline}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mt-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" title={activePreset.name} />
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-2 space-y-1 mt-2">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Menu Utama
            </p>
          )}

          {NAV_ITEMS.filter((item) => {
            // Sembunyikan modul servis jika profil bisnis tidak memiliki layanan servis (misal: Toko Retail, Fashion, E-Com)
            if (item.href === "/repair" && !activePreset.hasServiceMode) return false;
            return true;
          }).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const displayName = item.href === "/repair" && activePreset.serviceNavTitle 
              ? activePreset.serviceNavTitle 
              : item.name;
            const badgeValue = item.href === "/repair" ? activePreset.shortTag : item.badge;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? displayName : undefined}
                className={`flex items-center ${
                  isCollapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2"
                } rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-[#1f1f1f] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-400" : "text-gray-400"}`} />
                  {!isCollapsed && <span>{displayName}</span>}
                </div>

                {!isCollapsed && (
                  badgeValue ? (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive ? "bg-purple-500 text-white" : "bg-[#262626] text-gray-400"
                    }`}>
                      {item.href === "/pos" && cartCount > 0 ? cartCount : badgeValue}
                    </span>
                  ) : (
                    isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                  )
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Theme Toggle */}
      <div className="p-3 border-t border-[#262626] bg-[#111111] space-y-2">
        {/* Tombol Theme Toggle (Catatan Hal 11: Dark Mode & Soft Pastel) */}
        <button
          onClick={toggleTheme}
          title={isLightMode ? "Ganti ke Dark Mode" : "Ganti ke Tema Pastel Lembut"}
          className={`w-full flex items-center ${
            isCollapsed ? "justify-center" : "justify-between px-2.5"
          } py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#242424] text-xs text-gray-300 transition-colors border border-[#2c2c2c]`}
        >
          <div className="flex items-center gap-2">
            {isLightMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            )}
            {!isCollapsed && (
              <span className="text-[11px]">{isLightMode ? "Tema Pastel" : "Dark Mode"}</span>
            )}
          </div>
          {!isCollapsed && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#2b2b2b] text-gray-400">
              Ubah
            </span>
          )}
        </button>

        {/* User Badge (RBAC Dynamic) */}
        <Link
          href="/settings/team"
          title="Buka Pengaturan Tim & Hak Akses Staf"
          className={`flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#1a1a1a] transition-colors ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center text-xs font-bold text-white border border-purple-500/30 shrink-0">
            {activeStaff?.name ? activeStaff.name.slice(0, 2).toUpperCase() : "OW"}
          </div>
          {!isCollapsed && (
            <div className="truncate flex-1">
              <p className="text-xs font-medium text-white truncate">
                {activeStaff?.name || "Owner Toko"}
              </p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                {ROLE_LABELS[activeStaff?.role] || "Owner"}
              </p>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
