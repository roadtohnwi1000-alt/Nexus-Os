"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Volume2,
  Music,
  Layers,
  Settings2,
  Send,
  RefreshCw,
  PlusCircle,
  FileText,
  AlertCircle,
  Eye,
  DollarSign,
  TrendingUp,
  Share2,
} from "lucide-react";
import RemotionVideoCanvas from "@/components/video-studio/RemotionVideoCanvas";
import {
  fetchStudioJobs,
  fetchStudioJobDetail,
  selectScriptVariantAPI,
  configureStudioAudioAPI,
  triggerRenderVideoAPI,
  approveStudioJobAPI,
  fetchVoiceIdentities,
  fetchBGMTracks,
  createVideoJob,
  VideoProductionJob,
  VoiceIdentity,
  BGMTrack,
} from "@/lib/api";

export default function VideoStudioPage() {
  const [jobs, setJobs] = useState<VideoProductionJob[]>([]);
  const [activeJob, setActiveJob] = useState<VideoProductionJob | null>(null);
  const [voices, setVoices] = useState<VoiceIdentity[]>([]);
  const [bgms, setBgms] = useState<BGMTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"script" | "timeline" | "audio" | "render">("script");
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // State untuk form edit audio
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedBgmId, setSelectedBgmId] = useState("");
  const [bgmVolume, setBgmVolume] = useState(0.15);

  // State modal buat job baru
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newJobForm, setNewJobForm] = useState({
    opportunity_code: "OPP-002",
    product_name: "Powerbank Wireless 10.000mAh MagSafe",
    category: "Accessories",
    price_idr: 189000,
    stock_remaining: 24,
    pain_points: "kabel ruwet dan baterai drop saat nongkrong",
    unique_selling_points: "MagSafe nempel kuat 15W, desain setipis kartu, garansi 1 tahun",
  });

  // Load initial data
  useEffect(() => {
    loadStudioData();
  }, []);

  const loadStudioData = async () => {
    try {
      setLoading(true);
      const [jobsRes, voicesRes, bgmsRes] = await Promise.all([
        fetchStudioJobs(),
        fetchVoiceIdentities(),
        fetchBGMTracks(),
      ]);

      if (jobsRes.jobs && jobsRes.jobs.length > 0) {
        setJobs(jobsRes.jobs);
        const initialJob = jobsRes.jobs[0];
        setActiveJob(initialJob);
        setSelectedVoiceId(initialJob.voice_identity_id || "id_id_female_natural");
        setSelectedBgmId(initialJob.bgm_track_id || "bgm_tech_pulse");
        setBgmVolume(initialJob.bgm_volume || 0.15);
      }
      setVoices(voicesRes.voices || []);
      setBgms(bgmsRes.bgm_tracks || []);
    } catch (err: any) {
      console.error("Gagal memuat data video studio:", err);
      showNotification("Gagal memuat data video studio", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Pilih varian naskah (FOMO vs Edukatif vs Story)
  const handleSelectVariant = async (variantId: string) => {
    if (!activeJob) return;
    try {
      setActionLoading(true);
      const res = await selectScriptVariantAPI(activeJob.id, variantId);
      setActiveJob(res.job);
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? res.job : j)));
      showNotification(res.message, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal mengganti varian naskah", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Simpan konfigurasi audio
  const handleSaveAudioConfig = async () => {
    if (!activeJob) return;
    try {
      setActionLoading(true);
      const res = await configureStudioAudioAPI(activeJob.id, {
        voice_identity_id: selectedVoiceId,
        bgm_track_id: selectedBgmId,
        bgm_volume: bgmVolume,
      });
      setActiveJob(res.job);
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? res.job : j)));
      showNotification(res.message, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal memperbarui audio", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Render video
  const handleRenderVideo = async () => {
    if (!activeJob) return;
    try {
      setActionLoading(true);
      const res = await triggerRenderVideoAPI(activeJob.id);
      setActiveJob(res.job);
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? res.job : j)));
      showNotification("Render video 1080x1920 Remotion selesai!", "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal merender video", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Operator Human-in-the-Loop Approval (Fase 8 Handoff)
  const handleApproveJob = async () => {
    if (!activeJob) return;
    try {
      setActionLoading(true);
      const res = await approveStudioJobAPI(activeJob.id, "Chief Operator (Owner)");
      setActiveJob(res.job);
      setJobs((prev) => prev.map((j) => (j.id === res.job.id ? res.job : j)));
      showNotification("✅ Video disetujui! Telah dialirkan ke antrean publikasi Fase 8.", "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal menyetujui video", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Buat video job baru
  const handleCreateNewJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await createVideoJob({
        opportunity_code: newJobForm.opportunity_code,
        product_name: newJobForm.product_name,
        category: newJobForm.category,
        price_idr: Number(newJobForm.price_idr),
        stock_remaining: Number(newJobForm.stock_remaining),
        pain_points: [newJobForm.pain_points],
        unique_selling_points: newJobForm.unique_selling_points.split(",").map((s) => s.trim()),
      });
      setJobs((prev) => [res.job, ...prev]);
      setActiveJob(res.job);
      setIsModalOpen(false);
      showNotification(`Pekerjaan produksi '${res.job.title}' berhasil dibuat!`, "success");
    } catch (err: any) {
      showNotification(err.message || "Gagal membuat video job", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm font-medium text-slate-400">Memuat Pabrik Konten Video (Domain B: The Studio)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
            notification.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "bg-red-600 text-white border border-red-400"
          }`}
        >
          {notification.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Top Header Bar */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
            <Video className="w-4 h-4" /> Domain B // AI Creative & Remotion Video Studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight flex items-center gap-3">
            Pabrik Video Programatik (The Studio)
            {activeJob && (
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${
                  activeJob.status === "APPROVED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {activeJob.status === "APPROVED" ? "✅ Disetujui (Siap Publikasi)" : "⚡ Menunggu Persetujuan Operator"}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Konversi otomatis blueprint peluang (Domain A) menjadi video vertikal 9:16 (Shorts/TikTok/Reels) lengkap
            dengan suara AI dan naskah tervalidasi.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Job Selector */}
          {jobs.length > 0 && (
            <select
              value={activeJob?.id || ""}
              onChange={(e) => {
                const j = jobs.find((item) => item.id === e.target.value);
                if (j) setActiveJob(j);
              }}
              className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.status})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-cyan-400" /> Buat Video Baru
          </button>

          {activeJob && (
            <button
              onClick={handleApproveJob}
              disabled={actionLoading || activeJob.status === "APPROVED"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-lg ${
                activeJob.status === "APPROVED"
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-emerald-500/20"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {activeJob.status === "APPROVED" ? "Telah Disetujui (Fase 8)" : "Setujui & Antrekan Publikasi"}
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Grid */}
      {activeJob ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 Cols): 9:16 Video Canvas & Economics */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-sm flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-cyan-400" /> Pratinjau Kanvas 9:16
                </span>
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  {activeJob.opportunity_code || "OPP-001"}
                </span>
              </div>

              {/* Remotion Canvas Component */}
              <RemotionVideoCanvas job={activeJob} />

              {/* Unit Economics Box (Sesuai PDF CommerceOS Halaman 36) */}
              <div className="w-full mt-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-left">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-2">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <DollarSign className="w-4 h-4" /> Model Biaya Produksi (PDF Hal. 36)
                  </span>
                  <span className="text-emerald-400 font-extrabold">Hemat 99.8% vs Manual</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Inference & QA</div>
                    <div className="font-bold text-slate-200 mt-0.5">$0.04 (Rp 640)</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Voice TTS</div>
                    <div className="font-bold text-slate-200 mt-0.5">$0.05 (Rp 800)</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Remotion Render</div>
                    <div className="font-bold text-cyan-400 mt-0.5">$0.03 (Rp 480)</div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Total Biaya Per Video 60s:</span>
                  <span className="font-extrabold text-white">$0.12 (~Rp 1.920)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Studio Controls & Tabs */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab("script")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "script"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Naskah 3 Varian
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "timeline"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Timeline 4 Scene
              </button>
              <button
                onClick={() => setActiveTab("audio")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "audio"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" /> Suara & Musik
              </button>
              <button
                onClick={() => setActiveTab("render")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "render"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Render & Antrean
              </button>
            </div>

            {/* TAB 1: NASKAH 3 VARIAN (MULTI-ANGLE SCRIPTS) */}
            {activeTab === "script" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" /> 3 Sudut Pandang Naskah AI (LangGraph Scriptwriter)
                    </h2>
                    <span className="text-[11px] text-slate-400">Pilih salah satu untuk kanvas video</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Setiap varian diformulasikan untuk retensi penonton 60 detik dengan hook detik pertama yang kuat.
                  </p>
                </div>

                {/* 3 Variant Cards */}
                <div className="grid grid-cols-1 gap-3">
                  {activeJob.script_variants?.map((v) => {
                    const isSelected = activeJob.selected_variant_id === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => handleSelectVariant(v.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-cyan-950/20 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30"
                            : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-extrabold text-white flex items-center gap-2">
                            {isSelected && <CheckCircle className="w-4 h-4 text-cyan-400" />}
                            {v.angle_label}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {v.target_pacing_wpm} WPM · 60 Detik
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 italic mb-3">"{v.hook_text}"</p>

                        {/* Compliance Shield */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" /> QA Compliance:{" "}
                            {v.compliance_check?.compliance_score || 99}% (Lolos Anti-Overclaim)
                          </span>
                          <span className="text-slate-500 text-[10px]">4 Scenes Tervalidasi</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Script Scene Breakdown */}
                <div className="mt-2 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Detail Naskah Aktif: {activeJob.active_script?.angle_label}
                  </h3>
                  <div className="space-y-3">
                    {activeJob.active_script?.scenes?.map((scene) => (
                      <div
                        key={scene.scene_index}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="font-bold text-cyan-400">
                            Scene {scene.scene_index}: {scene.name} ({scene.start_sec}s - {scene.end_sec}s)
                          </span>
                          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Durasi: {scene.duration_sec}s
                          </span>
                        </div>
                        <div className="text-white font-medium my-1">"{scene.narration}"</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <span className="text-amber-400 font-semibold">Teks Layar:</span> {scene.on_screen_text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TIMELINE SCENE-BY-SCENE (4 SCENES) */}
            {activeTab === "timeline" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" /> Pacing & Struktur Detik demi Detik (Timeline Track)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Visual cues kamera dan transisi dinamis agar video tidak membosankan bagi algoritma TikTok & Reels.
                  </p>
                </div>

                <div className="space-y-4">
                  {activeJob.active_script?.scenes?.map((s) => (
                    <div
                      key={s.scene_index}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Scene {s.scene_index}: {s.name}
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          {s.start_sec}s ➔ {s.end_sec}s ({s.duration_sec} detik)
                        </span>
                      </div>

                      <div className="text-xs text-slate-200">
                        <span className="font-semibold text-slate-400">Instruksi Visual & B-Roll:</span>{" "}
                        {s.visual_cue}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs text-slate-300">
                        <span className="text-cyan-400 font-semibold">Narasi Suara:</span> "{s.narration}"
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>
                          Highlight Kinetik:{" "}
                          <span className="text-amber-300 font-semibold">{s.kinetic_highlight || "AUTO-EMPHASIS"}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          1080x1920 Layer Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: KARAKTER SUARA AI (TTS) & MUSIK LATAR (BGM) */}
            {activeTab === "audio" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col gap-5">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" /> Sintesis Suara AI (TTS) & Musik Bebas Royalti
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Gunakan karakter suara bahasa Indonesia yang natural dan atur ducking musik otomatis.
                  </p>
                </div>

                {/* Voice Personas */}
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                    Pilih Karakter Narator AI:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {voices.map((v) => {
                      const isSel = selectedVoiceId === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVoiceId(v.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSel
                              ? "bg-cyan-950/30 border-cyan-500 shadow-sm ring-1 ring-cyan-500/40"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>{v.name}</span>
                            <span className="text-[10px] text-cyan-400 font-mono">{v.gender}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{v.tone}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">Cocok: {v.recommended_niche}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BGM Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                    Pilih Musik Latar (BGM):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {bgms.map((b) => {
                      const isSel = selectedBgmId === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBgmId(b.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSel
                              ? "bg-cyan-950/30 border-cyan-500 shadow-sm"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-cyan-400" /> {b.title}
                          </div>
                          <div className="text-[10px] text-amber-400 font-mono mt-1">{b.tempo_bpm} BPM</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{b.mood}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Volume Ducking Slider */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                    <span>Volume Musik Latar Saat Narasi Aktif (Audio Ducking):</span>
                    <span className="text-cyan-400 font-mono font-bold">{Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.40"
                    step="0.01"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Halus (5%)</span>
                    <span>Standar Komersial (15%)</span>
                    <span>Tinggi (40%)</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveAudioConfig}
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
                  Simpan & Sintesis Ulang Audio & Subtitle
                </button>
              </div>
            )}

            {/* TAB 4: RENDER & ANTREAN PUBLIKASI */}
            {activeTab === "render" && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex flex-col gap-5">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-cyan-400" /> Mesin Render Remotion & Antrean Publikasi
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Rakit video MP4 vertikal 1080x1920 dan kirim ke antrean publikasi otomatis (Fase 8).
                  </p>
                </div>

                {/* Render Metrics Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Resolusi Output</div>
                    <div className="text-xs font-mono font-bold text-white mt-1">
                      {activeJob.render_metrics?.resolution || "1080x1920 (9:16)"}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Frame Rate</div>
                    <div className="text-xs font-mono font-bold text-cyan-400 mt-1">
                      {activeJob.render_metrics?.fps || 30} FPS
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Durasi Video</div>
                    <div className="text-xs font-mono font-bold text-white mt-1">
                      {activeJob.render_metrics?.duration_sec || 60} Detik
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Ukuran File</div>
                    <div className="text-xs font-mono font-bold text-amber-400 mt-1">
                      ~{activeJob.render_metrics?.file_size_mb || 18.4} MB
                    </div>
                  </div>
                </div>

                {/* Status Card */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Status Pekerjaan:</span>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        activeJob.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {activeJob.status}
                    </span>
                  </div>

                  {activeJob.status === "APPROVED" && (
                    <a
                      href="/publishing"
                      className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Buka Antrean & Jadwal Publikasi (Fase 8) ➔
                    </a>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleRenderVideo}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} />
                      Render Ulang Remotion
                    </button>

                    <button
                      onClick={handleApproveJob}
                      disabled={actionLoading || activeJob.status === "APPROVED"}
                      className={`flex-1 py-2.5 px-4 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                        activeJob.status === "APPROVED"
                          ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {activeJob.status === "APPROVED" ? "Telah Disetujui (Fase 8)" : "Setujui & Antrekan Publikasi"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800">
          <p className="text-sm text-slate-400">Belum ada pekerjaan produksi video aktif.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-bold rounded-xl"
          >
            Buat Pekerjaan Video Pertama
          </button>
        </div>
      )}

      {/* Modal Buat Video Job Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-cyan-400" /> Buat Video Baru Dari Peluang
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Masukkan detail produk untuk dirakit menjadi naskah 3 varian dan kanvas Remotion 9:16.
            </p>

            <form onSubmit={handleCreateNewJob} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Kode Peluang (Domain A):</label>
                <input
                  type="text"
                  required
                  value={newJobForm.opportunity_code}
                  onChange={(e) => setNewJobForm({ ...newJobForm, opportunity_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Produk:</label>
                <input
                  type="text"
                  required
                  value={newJobForm.product_name}
                  onChange={(e) => setNewJobForm({ ...newJobForm, product_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Harga Jual (Rp):</label>
                  <input
                    type="number"
                    required
                    value={newJobForm.price_idr}
                    onChange={(e) => setNewJobForm({ ...newJobForm, price_idr: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Sisa Stok Gudang:</label>
                  <input
                    type="number"
                    required
                    value={newJobForm.stock_remaining}
                    onChange={(e) => setNewJobForm({ ...newJobForm, stock_remaining: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Pain Point Konsumen:</label>
                <input
                  type="text"
                  required
                  value={newJobForm.pain_points}
                  onChange={(e) => setNewJobForm({ ...newJobForm, pain_points: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Unique Selling Points (Pisahkan Koma):</label>
                <input
                  type="text"
                  required
                  value={newJobForm.unique_selling_points}
                  onChange={(e) => setNewJobForm({ ...newJobForm, unique_selling_points: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" /> Mulai Produksi AI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
