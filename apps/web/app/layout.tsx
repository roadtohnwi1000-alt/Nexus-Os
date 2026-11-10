import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "NEXUS OS | Universal Business Operating System & Autonomous Commerce",
  description: "Satu Platform Kasir POS Cepat, Multi-Gudang, dan Otomasi AI untuk Semua Jenis Usaha di Indonesia",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#0d0d0d] text-gray-100 min-h-screen antialiased">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
