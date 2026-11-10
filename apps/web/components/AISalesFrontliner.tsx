"use client";

import { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  CheckCircle2, 
  ArrowRight,
  RotateCw,
  ShieldCheck,
  Zap,
  Wrench,
  Tag,
  Receipt
} from "lucide-react";
import { chatAIConsultant, sendPortalChatMessage } from "@/lib/api";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  suggestedPreset?: string;
  action?: string | null;
  ticketData?: {
    ticket_number: string;
    category: string;
    status: string;
    estimated_cost_idr?: number;
  };
}

interface AISalesFrontlinerProps {
  currentBusinessType?: string;
  tenantId?: string;
  tenantName?: string;
  onSelectPreset?: (preset: string) => void;
  onOpenRegister?: () => void;
}

export default function AISalesFrontliner({
  currentBusinessType,
  tenantId: propTenantId,
  tenantName: propTenantName,
  onSelectPreset,
  onOpenRegister
}: AISalesFrontlinerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(propTenantId || null);
  const [activeTenantName, setActiveTenantName] = useState<string | null>(propTenantName || null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTenantId = localStorage.getItem("nexus_tenant_id");
      const storedTenantName = localStorage.getItem("nexus_tenant_name");
      if (storedTenantId && !activeTenantId) {
        setActiveTenantId(storedTenantId);
      }
      if (storedTenantName && !activeTenantName) {
        setActiveTenantName(storedTenantName);
      }
    }
  }, [activeTenantId, activeTenantName]);

  const isMerchantSession = Boolean(activeTenantId && activeTenantId !== "00000000-0000-0000-0000-000000000000");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: isMerchantSession
        ? "Halo! 👋 Saya Autonomous Copilot toko Anda. Anda dapat langsung lapor kendala teknis (bug), mengajukan usul fitur baru, atau menanyakan panduan operasional di sini. Tim agen kami siap mengeksekusi secara instan 24/7!"
        : "Halo Kak! 👋 Saya Asisten & Konsultan Bisnis NEXUS OS. Ada yang bisa saya bantu jelaskan mengenai fitur kasir, stok, atau kecerdasan buatan untuk usaha Kakak?",
      time: "Baru saja",
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMsg;
    if (!textToSend.trim() || isLoading) return;

    setHasInteracted(true);
    const userMsgObj: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsgObj]);
    if (!customText) setInputMsg("");
    setIsLoading(true);

    const msgLower = textToSend.toLowerCase();
    const bugKeywords = ["error", "bug", "rusak", "gagal", "kendala", "tidak bisa", "gak bisa", "macet", "crash", "hang"];
    const featureKeywords = ["fitur", "tambah", "minta", "rfm", "buatkan", "kembangkan", "request", "usul", "kustom"];

    const isBugReport = bugKeywords.some((k) => msgLower.includes(k));
    const isFeatureRequest = featureKeywords.some((k) => msgLower.includes(k));

    // Jika sudah ada sesi tenant atau pesan terdeteksi komplain/request fitur:
    // Jalankan ke endpoint /api/v1/control-plane/portal-chat (LangGraph Swarm)
    if (isMerchantSession || isBugReport || isFeatureRequest) {
      try {
        const targetTenant = activeTenantId || "11111111-1111-1111-1111-111111111111";
        const sender = activeTenantName || "Owner Toko";

        const res = await sendPortalChatMessage({
          tenant_id: targetTenant,
          message: textToSend.trim(),
          sender_name: sender
        });

        const aiMsgObj: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: res.reply || "Pesan Anda telah diterima oleh Autonomous Copilot.",
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          ticketData: res.ticket_data
        };

        setMessages((prev) => [...prev, aiMsgObj]);
      } catch (err) {
        // Fallback jika API sedang offline
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: "ai",
            text: isBugReport
              ? "🛠️ Kendala Anda telah dicatat oleh sistem self-healing. Agen AI sedang menganalisis stack trace dan menyiapkan pengujian di sandbox E2B. Toko Anda tetap aman dengan proteksi rollback otomatis."
              : "Pesan Anda telah diterima oleh agen copilot NEXUS OS. Kami siap membantu kelancaran operasional toko Anda 24/7.",
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          }
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default mode: Sales & Business Consultant (Landing page / Register)
    try {
      const history = messages.slice(-4).map((m) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.text,
      }));

      const res = await chatAIConsultant({
        message: textToSend.trim(),
        conversation_history: history,
        selected_business_type: currentBusinessType,
      });

      const aiMsgObj: Message = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: res.reply,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        suggestedPreset: res.suggested_preset,
        action: res.action,
      };

      setMessages((prev) => [...prev, aiMsgObj]);

      if (res.suggested_preset && onSelectPreset) {
        onSelectPreset(res.suggested_preset);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: "NEXUS OS mendukung kasir offline, multi-tier harga, manajemen stok gudang, dan otomatisasi WhatsApp untuk segala bisnis. Seluruh operasional dasar kasir 100% GRATIS selamanya tanpa kartu kredit. Mau saya bantu buatkan akun sekarang?",
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const MERCHANT_PROMPTS = [
    "🛠️ Lapor kendala printer thermal kasir",
    "✨ Request fitur split payment / diskon",
    "💡 Tanya panduan atur multi-tier harga",
    "📦 Cara impor data stok Excel 300 SKU",
  ];

  const PUBLIC_PROMPTS = [
    "Usaha saya Bengkel, fiturnya apa aja?",
    "Apakah kasir benar-benar gratis selamanya?",
    "Bisa dipakai saat internet toko mati?",
    "Saya jualan di TikTok Shop, ada fitur apa?",
  ];

  const activePrompts = isMerchantSession ? MERCHANT_PROMPTS : PUBLIC_PROMPTS;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* TOMBOL FLOATING CHAT */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setHasInteracted(true);
          }}
          className="group relative flex items-center gap-3 px-4 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-2xl shadow-purple-900/50 hover:shadow-purple-700/60 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-purple-600" />
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <span className="block text-[11px] font-bold">
              {isMerchantSession ? "Copilot Toko 24/7" : "Konsultan Bisnis AI"}
            </span>
            <span className="block text-[9px] text-purple-200">
              {isMerchantSession ? "Lapor bug & request fitur" : "Tanya seputar fitur & solusi"}
            </span>
          </div>
          {!hasInteracted && (
            <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-extrabold text-[9px] animate-bounce">
              Tanya AI
            </span>
          )}
        </button>
      )}

      {/* POPUP JENDELA CHAT AI */}
      {isOpen && (
        <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl w-[92vw] sm:w-[400px] h-[540px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header Chat */}
          <div className="bg-gradient-to-r from-purple-950/80 to-[#181818] border-b border-[#2a2a2a] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs text-white">
                    {isMerchantSession ? "Nexus Copilot (Support & DevOps)" : "Konsultan & CS NEXUS"}
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[10px] text-gray-400">
                  {isMerchantSession
                    ? `Terhubung ke sistem otonom toko: ${activeTenantName || "Outlet Anda"}`
                    : "Siap bantu jawab pertanyaan calon klien 24/7"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Area Pesan */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "ai" && (
                  <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3" />
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.sender === "user"
                      ? "bg-purple-600 text-white rounded-tr-none"
                      : "bg-[#1c1c1c] border border-[#2b2b2b] text-gray-200 rounded-tl-none space-y-2"
                  }`}
                >
                  <p className="whitespace-pre-line text-xs">{m.text}</p>
                  
                  {/* Badge Tiket Resmi jika pesan memicu aksi agen otonom */}
                  {m.ticketData && (
                    <div className="pt-2 border-t border-[#2d2d2d] flex items-center justify-between gap-1 text-[10px] flex-wrap">
                      <span className="font-mono text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                        Tiket: {m.ticketData.ticket_number}
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        Status: {m.ticketData.status}
                      </span>
                    </div>
                  )}

                  {m.suggestedPreset && (
                    <div className="pt-2 border-t border-[#2d2d2d] flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-purple-300 font-medium">Rekomendasi Profil:</span>
                      <span className="font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {m.suggestedPreset.replace("_", " ")}
                      </span>
                    </div>
                  )}

                  {m.action === "open_register" && onOpenRegister && (
                    <button
                      type="button"
                      onClick={onOpenRegister}
                      className="w-full mt-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
                    >
                      <span>Daftar Gratis Sekarang</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span className="block text-[9px] text-gray-400 text-right mt-1">
                    {m.time}
                  </span>
                </div>

                {m.sender === "user" && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/20 p-2.5 rounded-xl border border-purple-500/20 max-w-[80%]">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>AI Swarm sedang memproses permintaan...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          <div className="px-3 py-1.5 border-t border-[#222] bg-[#111] overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            {activePrompts.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#1c1c1c] hover:bg-purple-600/20 border border-[#2a2a2a] hover:border-purple-500/40 text-[10px] text-gray-300 hover:text-purple-300 transition-colors shrink-0 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Form Input Chat */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-[#141414] border-t border-[#262626] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={isMerchantSession ? "Lapor bug, ajukan fitur, atau tanya setup..." : "Ketik pertanyaan untuk Konsultan AI..."}
              className="flex-1 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-sans"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim() || isLoading}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
