"use client";

import { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  HelpCircle, 
  RotateCw,
  CheckCircle2,
  Paperclip
} from "lucide-react";
import { sendTelegramCopilotMessage } from "@/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
  ticketNumber?: string;
}

export default function ClientHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "bot",
      text: "Halo! Saya adalah Asisten Toko & Jalur Intake Teknisi Internal. Ada yang bisa kami bantu terkait panduan fitur, kendala teknis, atau permintaan pengaturan baru?",
      time: "Baru saja",
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputValue).trim();
    if (!textToSend || isLoading) return;

    const userTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      time: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputValue("");
    setIsLoading(true);

    try {
      const res = await sendTelegramCopilotMessage({
        message: textToSend,
        sender_name: "Staff Toko (FixPhone)",
      });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        ticketNumber: res.ticket_data?.ticket_number,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "bot",
        text: "Maaf, pesan Anda sudah dicatat ke sistem internal. Tim teknisi akan segera mengeceknya.",
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 select-none">
      {/* Floating Trigger Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xl shadow-purple-900/30 hover:scale-105 transition-all cursor-pointer border border-purple-400/30"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
          </div>
          <span>Bantuan & Asisten Toko</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] h-[520px] bg-[#161616] border border-[#2b2b2b] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 bg-[#1a1a1a] border-b border-[#2b2b2b] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                  Asisten & Intake Teknisi
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                </h3>
                <p className="text-[10px] text-gray-400">Jalur Resmi Tim Bantuan Nexus OS</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252525] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#111111] text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] ${
                    m.sender === "user" ? "bg-purple-600" : "bg-[#252525] text-purple-400 border border-purple-500/20"
                  }`}
                >
                  {m.sender === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>

                <div
                  className={`rounded-2xl p-3 space-y-1 ${
                    m.sender === "user"
                      ? "bg-purple-600 text-white rounded-tr-none shadow-sm"
                      : "bg-[#1c1c1c] text-gray-200 border border-[#2c2c2c] rounded-tl-none shadow-sm"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  {m.ticketNumber && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#333] text-[10px] text-amber-300 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Tiket dibuat: #{m.ticketNumber}</span>
                    </div>
                  )}
                  <span className="text-[9px] text-gray-400 block text-right">{m.time}</span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 mr-auto text-xs text-gray-400 items-center">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Menghubungkan ke tim teknisi AI...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-[#171717] border-t border-[#262626] flex items-center gap-1.5 overflow-x-auto text-[10px]">
            <button
              onClick={() => handleSendMessage("Bagaimana cara tutup shift dan blind balancing?")}
              className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-gray-300 border border-[#333] whitespace-nowrap transition-colors"
            >
              🔒 Tutup Shift
            </button>
            <button
              onClick={() => handleSendMessage("Bagaimana cara retur sparepart defect ke supplier?")}
              className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-gray-300 border border-[#333] whitespace-nowrap transition-colors"
            >
              ↩️ Retur Supplier
            </button>
            <button
              onClick={() => handleSendMessage("Saya butuh bantuan kendala teknis cetak nota POS")}
              className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-gray-300 border border-[#333] whitespace-nowrap transition-colors"
            >
              🛠️ Lapor Kendala
            </button>
          </div>

          {/* Input Box */}
          <div className="p-3 bg-[#1a1a1a] border-t border-[#282828] flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaan atau laporan Anda..."
              disabled={isLoading}
              className="flex-1 bg-[#121212] border border-[#2d2d2d] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-all shadow-md shadow-purple-900/30"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
