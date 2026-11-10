"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Volume2, Sparkles, CheckCircle, ShieldAlert, ShoppingBag, Flame } from "lucide-react";
import { VideoProductionJob, SubtitleCue } from "@/lib/api";

interface RemotionVideoCanvasProps {
  job: VideoProductionJob;
  activeVariantIndex?: number;
  onSceneClick?: (sceneIndex: number) => void;
}

export default function RemotionVideoCanvas({
  job,
  activeVariantIndex = 0,
  onSceneClick,
}: RemotionVideoCanvasProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalDurationSec = 60;
  const activeScript = job.active_script || job.script_variants[activeVariantIndex] || job.script_variants[0];
  const scenes = activeScript?.scenes || [];
  const subtitles = job.audio_bundle?.subtitles_payload || [];
  const waveforms = job.audio_bundle?.waveform_data || Array(40).fill(0.4);

  // Deteksi Scene Aktif berdasarkan waktu playhead
  const currentSceneIndex = (() => {
    if (currentTimeSec < 3) return 1;
    if (currentTimeSec < 15) return 2;
    if (currentTimeSec < 45) return 3;
    return 4;
  })();

  const currentScene = scenes.find((s) => s.scene_index === currentSceneIndex) || scenes[0];

  // Efek playback timer
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTimeSec((prev) => {
          if (prev >= totalDurationSec) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.25;
        });
      }, 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalDurationSec]);

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
  };

  const jumpToScene = (startSec: number, sceneIdx: number) => {
    setCurrentTimeSec(startSec);
    if (onSceneClick) onSceneClick(sceneIdx);
  };

  // Subtitle kata yang aktif saat ini
  const currentMs = currentTimeSec * 1000;
  const activeSubtitles = subtitles.filter(
    (sub) => sub.scene_index === currentSceneIndex && sub.start_ms <= currentMs + 2000 && sub.end_ms >= currentMs - 2500
  );

  const formattedTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formattedPrice = `Rp ${(job.price_idr || 249000).toLocaleString("id-ID")}`;

  return (
    <div className="flex flex-col items-center">
      {/* 9:16 Vertical Video Frame Mockup */}
      <div className="relative w-[340px] h-[604px] sm:w-[360px] sm:h-[640px] bg-slate-950 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-cyan-500/20 overflow-hidden flex flex-col justify-between">
        
        {/* Phone Notch & Top Status */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-slate-900 rounded-b-2xl z-30 flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
          <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
        </div>

        {/* Video Canvas Layers Container */}
        <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-slate-900 flex flex-col justify-between p-4 z-10 select-none">
          
          {/* Dynamic Background Simulation */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950/40 opacity-90 z-0"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.18),transparent_65%)] z-0"></div>

          {/* Top Overlay: Progress Bar & Category Pill */}
          <div className="relative z-20 flex flex-col gap-2 pt-5">
            {/* 4-Scene Segmented Progress Bar */}
            <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5">
              {[
                { idx: 1, max: 3 },
                { idx: 2, max: 15 },
                { idx: 3, max: 45 },
                { idx: 4, max: 60 },
              ].map((seg) => {
                const isActive = currentSceneIndex === seg.idx;
                const isPassed = currentSceneIndex > seg.idx;
                return (
                  <div
                    key={seg.idx}
                    className="h-full rounded-full bg-slate-700/60 overflow-hidden transition-all"
                  >
                    <div
                      className={`h-full transition-all duration-200 ${
                        isPassed ? "bg-cyan-400 w-full" : isActive ? "bg-cyan-400 w-3/4 animate-pulse" : "w-0"
                      }`}
                    ></div>
                  </div>
                );
              })}
            </div>

            {/* Header Tags */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-cyan-400 flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3" /> Remotion 9:16
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" /> Sisa {job.stock_remaining || 15} Pcs
              </span>
            </div>
          </div>

          {/* Center Stage: Dynamic Visual Hook & Kinetic On-Screen Text */}
          <div className="relative z-20 flex flex-col items-center justify-center my-auto text-center px-2">
            {/* Visual Hook / Alert Badge */}
            {currentSceneIndex === 1 && (
              <div className="animate-bounce mb-3 px-3 py-1 bg-red-600/90 text-white font-extrabold text-xs tracking-wider uppercase rounded-md shadow-lg shadow-red-500/30 border border-red-400">
                🚨 PERINGATAN KERAS 🚨
              </div>
            )}

            {currentSceneIndex === 2 && (
              <div className="mb-2 px-3 py-1 bg-amber-500/90 text-slate-950 font-extrabold text-xs tracking-wider uppercase rounded-md shadow-lg shadow-amber-500/30">
                ⚠️ MASALAH SERIUS
              </div>
            )}

            {/* Big Headline Caption */}
            <div className="text-lg sm:text-xl font-black text-white leading-tight uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight">
              {currentScene?.on_screen_text || "PROMO SPECIAL NEXUS OS"}
            </div>

            {/* Kinetic Karaoke Subtitles (Highlight per word) */}
            <div className="mt-4 min-h-[56px] px-3 py-2 bg-slate-950/70 backdrop-blur-md rounded-xl border border-slate-700/60 max-w-full">
              <p className="text-xs sm:text-sm font-semibold leading-relaxed flex flex-wrap justify-center gap-1">
                {activeSubtitles.length > 0 ? (
                  activeSubtitles.map((sub, i) => {
                    const isSpoken = currentMs >= sub.start_ms && currentMs <= sub.end_ms;
                    return (
                      <span
                        key={i}
                        className={`transition-colors duration-100 ${
                          isSpoken
                            ? "text-cyan-300 font-extrabold scale-110 underline decoration-cyan-400"
                            : sub.is_emphasis
                            ? "text-amber-400 font-bold"
                            : "text-slate-300"
                        }`}
                      >
                        {sub.word}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400 italic text-xs">
                    "{currentScene?.narration || "Menunggu audio playhead..."}"
                  </span>
                )}
              </p>
            </div>

            {/* Floating 3D Product Card (Scene 3 & 4) */}
            {(currentSceneIndex === 3 || currentSceneIndex === 4) && (
              <div className="mt-4 w-full p-2.5 rounded-2xl bg-gradient-to-br from-slate-900/95 to-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{job.product_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-black text-amber-400">{formattedPrice}</span>
                    <span className="text-[10px] text-slate-400 line-through">
                      Rp {((job.price_idr || 249000) * 1.35).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="text-[10px] text-cyan-400 font-medium">Garansi Resmi 18 Bulan</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Overlay: Outro CTA & Audio Waveform */}
          <div className="relative z-20 flex flex-col gap-2 pb-2">
            {/* CTA Outro Button (Scene 4) */}
            {currentSceneIndex === 4 ? (
              <div className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/30 text-center animate-pulse flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110">
                <ShoppingBag className="w-4 h-4" /> Beli di Keranjang Kuning
              </div>
            ) : (
              <div className="text-center text-[10px] text-slate-400 font-medium">
                Scene {currentSceneIndex}/4: {currentScene?.name} ({currentScene?.start_sec}s - {currentScene?.end_sec}s)
              </div>
            )}

            {/* Audio Waveform Live Visualizer */}
            <div className="flex items-end justify-center gap-1 h-7 px-3 py-1 bg-slate-950/80 rounded-lg border border-slate-800">
              {waveforms.slice(0, 28).map((val, i) => {
                const dynamicHeight = isPlaying ? Math.max(15, Math.min(100, val * 100 * (0.8 + 0.4 * Math.sin(currentTimeSec * 5 + i)))) : val * 35;
                return (
                  <div
                    key={i}
                    style={{ height: `${dynamicHeight}%` }}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isPlaying ? "bg-cyan-400" : "bg-slate-700"
                    }`}
                  ></div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Playback Bar Controls */}
        <div className="relative z-30 pt-2 pb-1 px-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors shadow-md"
              title={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>
            <button
              onClick={resetPlayback}
              className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              title="Ulang dari awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-slate-300">
              {formattedTime(currentTimeSec)} / {formattedTime(totalDurationSec)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-mono">1080x1920</span>
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                isMuted ? "border-red-500/40 text-red-400" : "border-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <Volume2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Scene Jump Bar Below Mockup */}
      <div className="flex items-center gap-1.5 mt-4">
        {scenes.map((s) => (
          <button
            key={s.scene_index}
            onClick={() => jumpToScene(s.start_sec, s.scene_index)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              currentSceneIndex === s.scene_index
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            S{s.scene_index}: {s.name} ({s.start_sec}-{s.end_sec}s)
          </button>
        ))}
      </div>
    </div>
  );
}
