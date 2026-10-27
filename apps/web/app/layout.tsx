import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nexus Core OS | Unified Commerce Platform",
  description: "AI-Powered Multi-Tenant ERP, CRM, and POS Operating System",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
          backgroundColor: "#090d16",
          color: "#e2e8f0",
        }}
      >
        {children}
      </body>
    </html>
  );
}
