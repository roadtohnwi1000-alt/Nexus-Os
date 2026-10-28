import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Nexus Core OS | Enterprise Unified Commerce & AI Dashboard",
  description: "AI-Powered Multi-Tenant ERP, CRM, POS, and AI Operations Platform",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#0f0f0f] text-gray-100 min-h-screen flex antialiased">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
