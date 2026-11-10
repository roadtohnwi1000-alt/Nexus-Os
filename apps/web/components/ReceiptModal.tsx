"use client";

import { useState } from "react";
import { 
  Printer, 
  Send, 
  X, 
  CheckCircle2, 
  Smartphone, 
  Wrench, 
  Receipt, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  User, 
  DollarSign,
  Copy,
  Check
} from "lucide-react";
import { formatRupiah } from "@/lib/api";

export interface ReceiptItemLine {
  name: string;
  qty: number;
  price: number;
  total?: number;
}

export interface ReceiptPaymentMethod {
  payment_method: string;
  amount: number;
}

export interface ReceiptData {
  orderId?: string;
  ticketId?: string;
  date?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  cashierName?: string;
  technicianName?: string;
  
  // Penjualan POS
  items?: ReceiptItemLine[];
  payments?: ReceiptPaymentMethod[];
  pricingTier?: string;
  cashChange?: number;

  // Servis HP
  deviceModel?: string;
  deviceImei?: string;
  devicePasswordPattern?: string;
  complaint?: string;
  parts?: ReceiptItemLine[];
  laborCost?: number;
  warrantyDays?: number;
  status?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "REPAIR" | "SALE";
  transactionData: ReceiptData;
}

/**
 * Membersihkan dan memformat nomor telepon agar sesuai dengan format WhatsApp internasional (+62).
 */
export function formatPhoneNumberForWA(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

/**
 * Format string pesan WhatsApp yang rapi dan elegan untuk dikirim ke pelanggan.
 */
export function generateWhatsAppMessage(type: "REPAIR" | "SALE", data: ReceiptData): string {
  const storeName = type === "REPAIR" ? "NEXUS HP REPAIR CENTER" : "NEXUS MOBILE & RETAIL";
  const dateStr = data.date || new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const invoiceNo = data.ticketId || data.orderId || "INV-LIVE";
  const customer = data.customerName || "Pelanggan Yth.";
  const total = formatRupiah(data.totalAmount || 0);

  if (type === "REPAIR") {
    let partsList = "";
    if (data.parts && data.parts.length > 0) {
      partsList = data.parts
        .map((p, i) => `  ${i + 1}. ${p.name} (${p.qty}x) - ${formatRupiah(p.price * p.qty)}`)
        .join("\n");
    }

    const labor = data.laborCost ? `• Biaya Jasa Servis : ${formatRupiah(data.laborCost)}\n` : "";
    const partsSection = partsList ? `🛠️ *SPAREPART & JASA TERPASANG:*\n${partsList}\n${labor}` : labor ? `🛠️ *JASA PERBAIKAN:*\n${labor}` : "";

    return (
`🧾 *NOTA SERVIS RESMI - ${storeName}* 🧾
----------------------------------------
No. Tiket  : *#${invoiceNo}*
Tanggal    : ${dateStr}
Pelanggan  : *${customer}*
Status     : ✅ *SELESAI & SIAP DIAMBIL*

📱 *DATA PERANGKAT:*
• Unit HP  : *${data.deviceModel || "-"}*
• IMEI     : ${data.deviceImei || "-"}
• Sandi/PIN: ${data.devicePasswordPattern || "-"}
• Keluhan  : ${data.complaint || "Perbaikan umum"}

${partsSection}----------------------------------------
💰 *TOTAL BIAYA : ${total}*
🛡️ *GARANSI:* ${data.warrantyDays || 30} Hari sejak nota ini diterbitkan (Segel toko utuh, tidak terkena cairan/benturan baru).
👨‍🔧 *Teknisi:* ${data.technicianName || "Tim Teknisi Nexus"}

📍 *ALAMAT TOKO & SERVIS:*
ITC Roxy Mas Lt. 2 Blok B No. 45, Jakarta Pusat
📞 Layanan Pelanggan: 0812-9988-7766

Terima kasih atas kepercayaan Anda mempercayakan perbaikan gadget pada kami! 🙏`
    );
  }

  // TIPE: SALE (STRUK POS PENJUALAN RETAIL)
  let itemsList = "";
  if (data.items && data.items.length > 0) {
    itemsList = data.items
      .map((it) => `• ${it.name}\n  ${it.qty}x @ ${formatRupiah(it.price)} = *${formatRupiah((it.total || it.price * it.qty))}*`)
      .join("\n");
  } else {
    itemsList = `• Pembelian Retail Suku Cadang/Aksesoris (${total})`;
  }

  let paymentDetails = "";
  if (data.payments && data.payments.length > 0) {
    paymentDetails = data.payments
      .map((p) => `  - ${p.payment_method}: ${formatRupiah(p.amount)}`)
      .join("\n");
  } else {
    paymentDetails = `  - CASH: ${total}`;
  }

  const tierBadge = data.pricingTier ? `Tier       : *${data.pricingTier.toUpperCase()}*\n` : "";

  return (
`🧾 *STRUK PEMBELIAN - ${storeName}* 🧾
----------------------------------------
No. Faktur : *#${invoiceNo}*
Tanggal    : ${dateStr}
Kasir      : ${data.cashierName || "Kasir Toko Cabang A"}
${tierBadge}Pelanggan  : *${customer}*

🛍️ *DAFTAR ITEM BELANJA:*
${itemsList}
----------------------------------------
💰 *TOTAL BELANJA : ${total}*

💳 *METODE PEMBAYARAN:*
${paymentDetails}
----------------------------------------
✅ *STATUS TRANSAKSI: LUNAS*

📍 *NEXUS MOBILE & ACCESSORIES*
Barang yang sudah dibeli bergaransi retur 2 hari (segel & nota utuh).
Terima kasih sudah berbelanja di Nexus OS! 🙏`
  );
}

export default function ReceiptModal({
  isOpen,
  onClose,
  type,
  transactionData,
}: ReceiptModalProps) {
  const [targetPhone, setTargetPhone] = useState(transactionData.customerPhone || "");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const invoiceNumber = transactionData.ticketId || transactionData.orderId || "INV-DEMO-001";
  const dateDisplay = transactionData.date || new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const totalDisplay = formatRupiah(transactionData.totalAmount || 0);

  // Trigger fungsi cetak browser
  const handlePrint = () => {
    window.print();
  };

  // Kirim WhatsApp
  const handleSendWA = () => {
    const rawPhone = targetPhone || transactionData.customerPhone || "08123456789";
    const cleanedPhone = formatPhoneNumberForWA(rawPhone);
    const message = generateWhatsAppMessage(type, {
      ...transactionData,
      customerPhone: rawPhone,
    });
    const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  // Salin teks pesan WhatsApp ke clipboard
  const handleCopyText = () => {
    const message = generateWhatsAppMessage(type, transactionData);
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* CSS Khusus Print Thermal / A4 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-card,
          #printable-receipt-card * {
            visibility: visible !important;
          }
          #printable-receipt-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-[#181818] border border-purple-500/40 rounded-2xl max-w-xl w-full p-5 sm:p-6 text-slate-100 shadow-2xl relative space-y-4 my-8">
        {/* Header Modal & Tombol Close */}
        <div className="flex items-center justify-between pb-3 border-b border-[#282828] no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">
              {type === "REPAIR" ? "Nota Servis Resmi" : "Struk Pembelian Kasir POS"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input No WA Pelanggan (Untuk Fitur Kirim Cepat) */}
        <div className="bg-[#121212] p-3 rounded-xl border border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <div className="w-full sm:flex-1">
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
              Nomor WhatsApp Tujuan
            </label>
            <input
              type="text"
              placeholder="08123456789 atau 62812..."
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSendWA}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-900/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </button>

            <button
              onClick={handleCopyText}
              className="px-2.5 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
              title="Salin Teks Pesan WhatsApp"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ===================================================================
            AREA DOKUMEN CETAK (PRINTABLE RECEIPT)
            =================================================================== */}
        <div
          id="printable-receipt-card"
          className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 font-mono text-xs shadow-md space-y-4 max-h-[60vh] overflow-y-auto"
        >
          {/* Header Toko */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase">
              {type === "REPAIR" ? "NEXUS HP REPAIR CENTER" : "NEXUS MOBILE & ACCESSORIES"}
            </h2>
            <p className="text-[10px] text-slate-600">
              ITC Roxy Mas Lt. 2 Blok B No. 45, Jakarta Pusat
            </p>
            <p className="text-[10px] text-slate-600">
              WhatsApp: 0812-9988-7766 | Telp: (021) 6388-9900
            </p>
          </div>

          {/* Meta Transaksi */}
          <div className="grid grid-cols-2 gap-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
            <div>
              <span className="text-slate-500">No. {type === "REPAIR" ? "Tiket" : "Faktur"}:</span>
              <p className="font-bold text-slate-900">#{invoiceNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Tanggal:</span>
              <p className="text-slate-900">{dateDisplay}</p>
            </div>
            <div>
              <span className="text-slate-500">Pelanggan:</span>
              <p className="font-semibold text-slate-900">{transactionData.customerName || "Pelanggan Umum"}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Petugas:</span>
              <p className="text-slate-900">{type === "REPAIR" ? transactionData.technicianName || "Teknisi Mas Dimas" : transactionData.cashierName || "Kasir Toko A"}</p>
            </div>
          </div>

          {/* =================================================================
              DOKUMEN SPESIFIK: NOTA SERVIS HP (REPAIR)
              ================================================================= */}
          {type === "REPAIR" && (
            <div className="space-y-3">
              {/* Data Fisik Gadget */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit Perangkat:</span>
                  <span className="font-bold text-slate-900">{transactionData.deviceModel || "iPhone 11 64GB"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IMEI:</span>
                  <span className="text-slate-800">{transactionData.deviceImei || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kunci Layar:</span>
                  <span className="text-slate-800">{transactionData.devicePasswordPattern || "-"}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-500">Keluhan:</span>
                  <span className="text-slate-800 text-right truncate max-w-[200px]">{transactionData.complaint || "Pengecekan teknis"}</span>
                </div>
              </div>

              {/* Rincian Pengerjaan & Suku Cadang */}
              <div>
                <p className="font-bold text-[11px] uppercase text-slate-700 mb-1.5">
                  Rincian Pengerjaan & Suku Cadang:
                </p>
                <div className="space-y-1 text-[11px]">
                  {transactionData.laborCost && (
                    <div className="flex justify-between">
                      <span>Jasa Servis & Kalibrasi QC</span>
                      <span>{formatRupiah(transactionData.laborCost)}</span>
                    </div>
                  )}

                  {transactionData.parts && transactionData.parts.length > 0 ? (
                    transactionData.parts.map((p, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{p.name} ({p.qty}x)</span>
                        <span>{formatRupiah(p.price * p.qty)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between text-slate-500 italic">
                      <span>Paket Layanan Servis Komprehensif</span>
                      <span>{totalDisplay}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              DOKUMEN SPESIFIK: STRUK PEMBELIAN KASIR (SALE)
              ================================================================= */}
          {type === "SALE" && (
            <div className="space-y-3">
              {transactionData.pricingTier && (
                <div className="flex justify-between text-[11px] pb-1 border-b border-slate-100">
                  <span className="text-slate-500">Kategori Harga:</span>
                  <span className="font-bold text-slate-900 uppercase">{transactionData.pricingTier}</span>
                </div>
              )}

              {/* Tabel Item Belanja */}
              <div>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500">
                      <th className="py-1">Barang</th>
                      <th className="py-1 text-center w-10">Qty</th>
                      <th className="py-1 text-right w-20">Harga</th>
                      <th className="py-1 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactionData.items && transactionData.items.length > 0 ? (
                      transactionData.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-1 pr-1 font-semibold text-slate-800">{it.name}</td>
                          <td className="py-1 text-center">{it.qty}</td>
                          <td className="py-1 text-right">{formatRupiah(it.price)}</td>
                          <td className="py-1 text-right font-semibold">{formatRupiah(it.total || it.price * it.qty)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-2 text-center text-slate-500">
                          1x Transaksi POS Kasir ({totalDisplay})
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rincian Split Payment */}
              {transactionData.payments && transactionData.payments.length > 0 && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px] space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Metode Pembayaran (Split Pay):</p>
                  {transactionData.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>• {p.payment_method}:</span>
                      <span className="font-semibold">{formatRupiah(p.amount)}</span>
                    </div>
                  ))}
                  {transactionData.cashChange && transactionData.cashChange > 0 && (
                    <div className="flex justify-between text-slate-700 border-t border-slate-200 pt-1">
                      <span>Kembalian Tunai:</span>
                      <span className="font-bold">{formatRupiah(transactionData.cashChange)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total Akhir */}
          <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline font-bold text-sm">
            <span>TOTAL:</span>
            <span className="text-base font-extrabold text-slate-900">{totalDisplay}</span>
          </div>

          {/* Status & Garansi */}
          <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] space-y-1 text-slate-600">
            {type === "REPAIR" ? (
              <>
                <p className="font-bold text-slate-800">
                  🛡️ GARANSI TOKO {transactionData.warrantyDays || 30} HARI
                </p>
                <p>Garansi berlaku jika segel baut utuh dan bukan akibat human error / kena air.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800">BARANG YANG SUDAH DIBELI DAPAT DITUKAR MAKS. 2 HARI</p>
                <p>Wajib membawa nota fisik asli dan segel aksesoris masih dalam kondisi utuh.</p>
              </>
            )}
            <p className="pt-1 text-[9px] text-slate-400">Dicetak otomatis oleh Nexus OS Smart Commerce</p>
          </div>
        </div>

        {/* Footer Actions Modal (Print & Tutup) */}
        <div className="flex items-center justify-between gap-3 pt-2 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold transition-colors"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendWA}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim ke WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-950/30"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Struk (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
