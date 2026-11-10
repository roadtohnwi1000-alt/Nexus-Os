"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClientHelpWidget from "@/components/ClientHelpWidget";

const PUBLIC_ROUTES = ["/", "/register", "/verify-otp", "/landing"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAdminRoute = pathname.startsWith("/admin");

  // Rute Publik atau Command Center Internal: Render full-screen tanpa menu/widget toko klien
  if (isPublicRoute || isAdminRoute) {
    return <div className="min-h-screen w-full bg-[#090d16] text-slate-100">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0f0f0f] text-gray-100">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Intake Chat Widget ke Tim Teknisi */}
      <ClientHelpWidget />
    </div>
  );
}
