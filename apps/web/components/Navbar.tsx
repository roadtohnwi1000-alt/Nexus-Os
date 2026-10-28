"use client";

import { Bell, Sparkles, Database, Search } from "lucide-react";

export default function Navbar() {
  return (
    <header className="h-16 border-b border-[#262626] bg-[#141414]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search / Status info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-[#2b2b2b] text-xs text-gray-400">
          <Database className="w-3.5 h-3.5 text-purple-400" />
          <span>Core API:</span>
          <span className="text-emerald-400 font-mono font-medium">http://localhost:8000</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Sync Mode Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>Hybrid AI Ready</span>
        </div>

        {/* Notifications */}
        <button 
          title="Notifikasi Sistem"
          className="p-2 rounded-lg bg-[#1c1c1c] border border-[#2b2b2b] text-gray-400 hover:text-white hover:bg-[#252525] transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-purple-500 absolute top-1.5 right-1.5 ring-2 ring-[#141414]"></span>
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#262626]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-semibold text-xs text-white shadow-md">
            AD
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-white leading-tight">Admin Toko</p>
            <p className="text-[10px] text-gray-400">Superuser</p>
          </div>
        </div>
      </div>
    </header>
  );
}
