import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ marginBottom: "40px", borderBottom: "1px solid #1e293b", paddingBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span
            style={{
              padding: "4px 10px",
              background: "#3b82f6",
              color: "#fff",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            FASE 0: FOUNDATION
          </span>
          <span style={{ color: "#10b981", fontSize: "14px", fontWeight: 500 }}>
            ● Sistem Siap Diinisialisasi
          </span>
        </div>
        <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>
          Nexus Core OS
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "16px", margin: 0, maxWidth: "680px" }}>
          Unified AI-Powered Commerce Platform (ERP + CRM + POS + AI Layer) berarsitektur Multi-Tenant Modular Monolith.
        </p>
      </header>

      {/* Grid Status Arsitektur */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginTop: 0, color: "#60a5fa" }}>
            1. Multi-Tenancy & The Vault (DB)
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "1.6" }}>
            PostgreSQL via Supabase Cloud diisolasi penuh menggunakan <strong>Row-Level Security (RLS)</strong> dan fungsi <code>app.tenant_id()</code>. Seluruh data bisnis terisolasi secara default (fail-closed).
          </p>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "12px" }}>
            Status: Skema <code>001_foundation.sql</code> Terdefinisi
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginTop: 0, color: "#34d399" }}>
            2. Core Backend (FastAPI)
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "1.6" }}>
            FastAPI menyuntikkan tenant context langsung ke session Postgres lewat <code>SET LOCAL app.tenant_id</code> di dalam blok transaksi aman, mencegah kebocoran koneksi antar-tenant di connection pool.
          </p>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "12px" }}>
            Status: Dependency & Endpoints Siap di <code>apps/core-api</code>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginTop: 0, color: "#fbbf24" }}>
            3. AI Sandbox (Zona B)
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "1.6" }}>
            Engine LangGraph diisolasi di Zona B. AI dilarang menulis langsung ke pesanan atau stok riil. Seluruh rekomendasi AI masuk ke antrean <code>ai_drafts</code> untuk Human-in-the-Loop review.
          </p>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "12px" }}>
            Status: Isolated Worker di <code>apps/ai-worker</code>
          </div>
        </div>
      </section>

      {/* 5 Aturan Besar (The 5 Iron Rules) */}
      <section style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "28px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: 700, marginTop: 0, color: "#f87171", display: "flex", alignItems: "center", gap: "8px" }}>
          🛡️ 5 Aturan Besar Arsitektur (The Iron Rules)
        </h3>
        <ol style={{ paddingLeft: "20px", color: "#cbd5e1", fontSize: "14px", lineHeight: "1.8", margin: 0 }}>
          <li>
            <strong>Multi-Tenancy & RLS:</strong> SEMUA tabel bisnis wajib memiliki <code>tenant_id</code> dan mengaktifkan RLS dengan <code>current_setting(&apos;app.tenant_id&apos;)</code>.
          </li>
          <li>
            <strong>Representasi Uang:</strong> Dilarang menggunakan FLOAT/DECIMAL. Wajib menggunakan <code>BIGINT</code> (minor units / cents) untuk akurasi mutlak 0-drift.
          </li>
          <li>
            <strong>AI Sandbox:</strong> AI hanya boleh menulis ke tabel <code>ai_drafts</code>, dilarang menulis langsung ke <code>orders</code> atau <code>stock</code>.
          </li>
          <li>
            <strong>Append-Only Stock:</strong> Stok fisik tidak pernah di-UPDATE. Menggunakan mutasi <code>stock_movements</code> (immutable) dan cache <code>stock_levels</code>.
          </li>
          <li>
            <strong>Idempotency:</strong> Semua endpoint POST mutasi state wajib menerima dan memvalidasi header <code>Idempotency-Key</code>.
          </li>
        </ol>
      </section>
    </main>
  );
}
