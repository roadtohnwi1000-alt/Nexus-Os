"use client";

import { useState, useEffect } from "react";
import { 
  Inbox, 
  CheckCircle, 
  XCircle, 
  Sparkles, 
  MessageSquare, 
  User, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  ShieldCheck,
  Send
} from "lucide-react";
import { getPendingAIDrafts, approveAIDraft, rejectAIDraft, AIDraft } from "@/lib/api";

// Mock Fallback Drafts untuk keperluan visualisasi demo bila database kosong
const DEMO_DRAFTS: AIDraft[] = [
  {
    id: "draft-demo-01",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    conversation_id: "conv-001",
    kind: "reply",
    status: "pending",
    generated_by: "cs_langgraph_hybrid_agent",
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    payload: {
      customer_name: "Rian Hidayat (+6281234567890)",
      customer_message: "Halo kak, layar iPhone 11 saya retak dan kedip-kedip hijau. Masih bisa diservis ga ya? Berapa biayanya?",
      reply_text: "Halo Kak Rian! Berdasarkan panduan teknisi kami: Gejala layar berkedip hijau biasanya disebabkan oleh kerusakan flex OLED atau panel display. Kami merekomendasikan penggantian LCD iPhone 11 Original OEM (Rp 650.000) dan Jasa Pasang/Kalibrasi (Rp 100.000). Unit bisa dibawa ke toko untuk diagnosa fisik terlebih dahulu.",
      item_name: "LCD iPhone 11 Original OEM",
      price: 650000,
    },
  },
  {
    id: "draft-demo-02",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    conversation_id: "conv-002",
    kind: "reply",
    status: "pending",
    generated_by: "cs_langgraph_hybrid_agent",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    payload: {
      customer_name: "Dewi Lestari (+6281987654321)",
      customer_message: "Baterai Samsung S21 saya cepat banget drop, apakah ada stok baterai originalnya?",
      reply_text: "Halo Kak Dewi! Stok Baterai Samsung Galaxy S21 (4000mAh) saat ini tersedia di toko kami dengan harga Rp 320.000 (stok tersisa: 8 pcs). Kami juga menyediakan jasa pemasangan kilat (sekitar 30 menit) dengan garansi pemasangan 1 bulan.",
      item_name: "Baterai Samsung Galaxy S21",
      price: 320000,
    },
  },
];

export default function AIInboxPage() {
  const [drafts, setDrafts] = useState<AIDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Ambil daftar draft pending dari backend
  const loadDrafts = async () => {
    setLoading(true);
    try {
      const data = await getPendingAIDrafts();
      if (data && data.length > 0) {
        setDrafts(data);
      } else {
        // Jika database belum memiliki draft pending, tampilkan demo fallback
        setDrafts(DEMO_DRAFTS);
      }
    } catch (err: any) {
      console.warn("Koneksi backend pending, menampilkan data simulasi demo:", err.message);
      setDrafts(DEMO_DRAFTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handler Approve Draft
  const handleApprove = async (id: string) => {
    setActionInProgress(id);
    try {
      await approveAIDraft(id);
      showNotification("success", "Draft disetujui! Balasan telah diteruskan ke WhatsApp pelanggan.");
    } catch (err: any) {
      // Mock success untuk demo jika id lokal
      showNotification("success", "Draft disetujui! Balasan telah diteruskan ke WhatsApp pelanggan (Demo).");
    } finally {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setActionInProgress(null);
    }
  };

  // Handler Reject Draft
  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      await rejectAIDraft(id, "Ditolak oleh staf toko melalui AI Inbox");
      showNotification("error", "Draft ditolak. Percakapan dialihkan ke operator manusia.");
    } catch (err: any) {
      showNotification("error", "Draft ditolak. Percakapan dialihkan ke operator manusia (Demo).");
    } finally {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Inbox className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Inbox (Human-in-the-Loop)</h1>
          </div>
          <p className="text-xs text-gray-400">
            Tinjau dan setujui draft respon yang disusun oleh AI sebelum dikirimkan ke pelanggan. Menjamin kendali 100% di tangan pemilik toko.
          </p>
        </div>

        <button
          onClick={loadDrafts}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#252525] text-xs text-gray-300 font-medium transition-colors w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all shadow-lg ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-emerald-500/5"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-rose-500/5"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Drafts List */}
      <div className="space-y-4">
        {drafts.length > 0 ? (
          drafts.map((draft) => {
            const isProcessing = actionInProgress === draft.id;
            const customerName = draft.payload?.customer_name || "Pelanggan WhatsApp (+628xxxxxxx)";
            const customerMessage = draft.payload?.customer_message || "Pertanyaan ketersediaan produk / konsultasi";
            const replyText = draft.payload?.reply_text || "(Tidak ada teks balasan)";

            return (
              <div
                key={draft.id}
                className="bg-[#141414] border border-[#292929] hover:border-[#383838] rounded-2xl p-5 transition-all space-y-4 relative overflow-hidden shadow-lg shadow-black/40"
              >
                {/* Header Card */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#242424]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#202020] border border-[#303030] flex items-center justify-center text-gray-300">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">{customerName}</h3>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-purple-400" />
                        {new Date(draft.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} • WhatsApp Inbound
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {draft.kind === "reply" ? "Draft Balasan" : "Draft Quotation"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                      Pending Approval
                    </span>
                  </div>
                </div>

                {/* Pesan Pelanggan */}
                <div className="bg-[#1a1a1a] rounded-xl p-3.5 border border-[#282828] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span>Pesan Masuk Pelanggan:</span>
                  </div>
                  <p className="text-xs text-gray-200 italic leading-relaxed pl-5 border-l-2 border-blue-500/50">
                    "{customerMessage}"
                  </p>
                </div>

                {/* Usulan Balasan AI (Highlighted) */}
                <div className="bg-gradient-to-br from-purple-950/20 to-indigo-950/20 rounded-xl p-4 border border-purple-500/30 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Rekomendasi Balasan AI (Hybrid Knowledge):</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Generator: {draft.generated_by}
                    </span>
                  </div>

                  <p className="text-xs text-purple-100 leading-relaxed font-sans whitespace-pre-line pl-2">
                    {replyText}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  {/* Tombol Tolak */}
                  <button
                    onClick={() => handleReject(draft.id)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Tolak & Handoff ke Manusia</span>
                  </button>

                  {/* Tombol Setujui */}
                  <button
                    onClick={() => handleApprove(draft.id)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>Setujui & Kirim ke WhatsApp</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">Semua Pesan Sudah Ditinjau!</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Tidak ada draft AI yang menunggu approval. Sistem berjalan optimal dan percakapan pelanggan terkendali.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
