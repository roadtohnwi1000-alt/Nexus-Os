"use client";

import { useState, useEffect } from "react";
import { 
  BrainCircuit, 
  BookOpen, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Lightbulb
} from "lucide-react";
import { 
  getExpertKnowledge, 
  addExpertKnowledge, 
  deleteExpertKnowledge, 
  getGuidelines, 
  addGuideline, 
  deleteGuideline, 
  ExpertKnowledge, 
  AIGuideline 
} from "@/lib/api";

export default function AITrainingPage() {
  const [activeTab, setActiveTab] = useState<"expert" | "guidelines">("expert");
  
  // Data lists
  const [knowledgeList, setKnowledgeList] = useState<ExpertKnowledge[]>([]);
  const [guidelinesList, setGuidelinesList] = useState<AIGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states
  const [expertForm, setExpertForm] = useState({ topic: "", content: "" });
  const [guidelineForm, setGuidelineForm] = useState({
    category: "consultation_flow" as "tone_of_voice" | "escalation_rules" | "consultation_flow" | "safety_rules",
    instruction: "",
  });

  // Load data dari backend
  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, guideData] = await Promise.all([
        getExpertKnowledge().catch(() => []),
        getGuidelines().catch(() => []),
      ]);
      setKnowledgeList(expData || []);
      setGuidelinesList(guideData || []);
    } catch (err: any) {
      console.error("Gagal memuat data AI training:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Submit Expert Knowledge
  const handleAddExpertKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expertForm.topic.trim() || !expertForm.content.trim()) {
      showNotification("error", "Topik dan isi pengetahuan tidak boleh kosong.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpertKnowledge(expertForm);
      showNotification("success", "Basis pengetahuan ahli berhasil ditambahkan ke otak AI.");
      setExpertForm({ topic: "", content: "" });
      await loadData();
    } catch (err: any) {
      showNotification("error", err.message || "Gagal menyimpan pengetahuan ahli.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Guideline
  const handleAddGuideline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidelineForm.instruction.trim()) {
      showNotification("error", "Instruksi aturan bisnis tidak boleh kosong.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addGuideline(guidelineForm);
      showNotification("success", "Aturan operasional AI berhasil diterapkan.");
      setGuidelineForm({ category: "consultation_flow", instruction: "" });
      await loadData();
    } catch (err: any) {
      showNotification("error", err.message || "Gagal menyimpan panduan AI.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Handlers
  const handleDeleteKnowledge = async (id: string) => {
    try {
      await deleteExpertKnowledge(id);
      showNotification("success", "Data pengetahuan berhasil dihapus.");
      setKnowledgeList((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      showNotification("error", err.message || "Gagal menghapus data.");
    }
  };

  const handleDeleteGuideline = async (id: string) => {
    try {
      await deleteGuideline(id);
      showNotification("success", "Aturan guideline berhasil dihapus.");
      setGuidelinesList((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      showNotification("error", err.message || "Gagal menghapus aturan.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">AI Training & Knowledge Studio</h1>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl">
              Latih AI toko Anda dengan memasukkan panduan teknis, solusi troubleshooting, dan batasan etika. AI akan berkonsultasi secara cerdas menggunakan data ini tanpa perlu fine-tuning model.
            </p>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] hover:bg-[#252525] text-xs text-gray-300 font-medium transition-colors w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Global Alert Notification */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
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
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-[#262626] gap-2">
        <button
          onClick={() => setActiveTab("expert")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "expert"
              ? "border-purple-500 text-purple-300 bg-purple-500/5"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Expert Knowledge (Konsultasi & Diagnosa)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#222] text-gray-400 font-mono">
            {knowledgeList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("guidelines")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "guidelines"
              ? "border-purple-500 text-purple-300 bg-purple-500/5"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Business Rules & Guardrails</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#222] text-gray-400 font-mono">
            {guidelinesList.length}
          </span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: EXPERT KNOWLEDGE
          ===================================================================== */}
      {activeTab === "expert" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Form Input Knowledge */}
          <div className="lg:col-span-1 bg-[#141414] border border-[#262626] rounded-2xl p-5 h-fit">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#262626]">
              <Lightbulb className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Tambah Pengetahuan Ahli</h2>
            </div>

            <form onSubmit={handleAddExpertKnowledge} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Topik Masalah / Diagnosa *
                </label>
                <input
                  type="text"
                  placeholder="Misal: iPhone 11 Mati Total / IC Power"
                  value={expertForm.topic}
                  onChange={(e) => setExpertForm({ ...expertForm, topic: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Penjelasan & Solusi Teknis *
                </label>
                <textarea
                  rows={5}
                  placeholder="Biasanya disebabkan oleh short pada IC Power atau baterai drop. Sarankan pelanggan untuk cek ampere charger dulu sebelum dibongkar..."
                  value={expertForm.content}
                  onChange={(e) => setExpertForm({ ...expertForm, content: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-[11px] text-purple-300 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Tips Pelatihan
                </p>
                <p className="text-gray-400">
                  Sebutkan nama produk sparepart di dalam solusi agar AI dapat merekomendasikan stok secara otomatis ke pelanggan.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Simpan Pengetahuan Ahli</span>
              </button>
            </form>
          </div>

          {/* Kolom Kanan: Tabel / Daftar Knowledge */}
          <div className="lg:col-span-2 bg-[#141414] border border-[#262626] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-4">
              Basis Pengetahuan Tersimpan ({knowledgeList.length})
            </h2>

            {knowledgeList.length > 0 ? (
              <div className="space-y-3">
                {knowledgeList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[#1a1a1a] border border-[#292929] hover:border-[#383838] transition-all flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                          {item.topic}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Aktif
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                        {item.content}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono pt-1">
                        Dibuat: {new Date(item.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteKnowledge(item.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#252525] transition-colors"
                      title="Hapus Pengetahuan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500">
                <BookOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Belum ada basis pengetahuan yang diinput.</p>
                <p className="text-[10px] text-gray-600">Gunakan form di sebelah kiri untuk menambah.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: BUSINESS RULES & GUIDELINES
          ===================================================================== */}
      {activeTab === "guidelines" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Form Input Guideline */}
          <div className="lg:col-span-1 bg-[#141414] border border-[#262626] rounded-2xl p-5 h-fit">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#262626]">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Tambah Aturan AI</h2>
            </div>

            <form onSubmit={handleAddGuideline} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Kategori Aturan *
                </label>
                <select
                  value={guidelineForm.category}
                  onChange={(e) => setGuidelineForm({ ...guidelineForm, category: e.target.value as any })}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="consultation_flow">Alur Konsultasi (Consultation Flow)</option>
                  <option value="safety_rules">Batasan & Larangan (Safety Rules)</option>
                  <option value="tone_of_voice">Gaya Bahasa (Tone of Voice)</option>
                  <option value="escalation_rules">Eskalasi ke Manusia (Escalation)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Instruksi Aturan *
                </label>
                <textarea
                  rows={4}
                  placeholder="Misal: Jangan pernah merekomendasikan produk mengandung alkohol kepada pelanggan."
                  value={guidelineForm.instruction}
                  onChange={(e) => setGuidelineForm({ ...guidelineForm, instruction: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Simpan Aturan Operasional</span>
              </button>
            </form>
          </div>

          {/* Kolom Kanan: Tabel / Daftar Guidelines */}
          <div className="lg:col-span-2 bg-[#141414] border border-[#262626] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-4">
              Aturan Bisnis & Guardrails Aktif ({guidelinesList.length})
            </h2>

            {guidelinesList.length > 0 ? (
              <div className="space-y-3">
                {guidelinesList.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl bg-[#1a1a1a] border border-[#292929] hover:border-[#383838] transition-all flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {rule.category.replace("_", " ")}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Enforced
                        </span>
                      </div>
                      <p className="text-xs text-white font-medium">
                        "{rule.instruction}"
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        Dibuat: {new Date(rule.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteGuideline(rule.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-[#252525] transition-colors"
                      title="Hapus Aturan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500">
                <ShieldAlert className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Belum ada aturan operasional yang dikonfigurasi.</p>
                <p className="text-[10px] text-gray-600">Gunakan form di sebelah kiri untuk menambah aturan.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
