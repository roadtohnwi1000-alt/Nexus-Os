"use client";

import { useState, useEffect } from "react";
import { 
  Wrench, 
  Plus, 
  Search, 
  Smartphone, 
  KeyRound, 
  Hash, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  X, 
  User, 
  RefreshCw, 
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Package,
  Sparkles,
  Receipt,
  Printer,
  Send,
  ShieldCheck,
  CheckSquare,
  DollarSign,
  Award
} from "lucide-react";
import { 
  getRepairTickets, 
  createRepairTicket, 
  updateRepairTicketStatus, 
  addRepairPart, 
  getItems, 
  formatRupiah,
  RepairTicket,
  RepairPart,
  Item
} from "@/lib/api";
import ReceiptModal, { ReceiptData } from "@/components/ReceiptModal";

// Definisi kolom tahapan servis utama pada Kanban Board
const KANBAN_COLUMNS = [
  { key: "Intake", label: "Intake (Masuk)", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
  { key: "Diagnosis", label: "Diagnosis / Cek", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  { key: "Repairing", label: "Pengerjaan (Repairing)", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
  { key: "QC", label: "Quality Control (QC)", color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" },
  { key: "Done", label: "Selesai (Siap Ambil)", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
] as const;

// Data awal demo jika database masih kosong untuk visualisasi langsung
const INITIAL_DEMO_TICKETS: RepairTicket[] = [
  {
    id: "srv-demo-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    customer_name: "Budi Santoso",
    device_model: "iPhone 11 64GB Black",
    device_imei: "358742091234567",
    device_password_pattern: "PIN: 123456",
    complaint: "Layar pecah parah, sentuh tidak respon, tampilan bergaris vertikal hijau",
    status: "Intake",
    estimated_cost: 650000,
    final_cost: null,
    parts: [],
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "srv-demo-002",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    customer_name: "Siti Rahmawati",
    device_model: "Samsung Galaxy S21 5G",
    device_imei: "354189021876543",
    device_password_pattern: "Pola Huruf N",
    complaint: "Baterai kembung mendesak backdoor, cepat drop dari 80% ke 10%",
    status: "Diagnosis",
    estimated_cost: 350000,
    final_cost: null,
    parts: [],
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "srv-demo-003",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    customer_name: "Agus Pratama",
    device_model: "Xiaomi Redmi Note 10 Pro",
    device_imei: "867543021984210",
    device_password_pattern: "PIN: 000000",
    complaint: "Mati total mendadak saat dicas semalaman, IC Power diduga konslet",
    status: "Repairing",
    estimated_cost: 400000,
    final_cost: 450000,
    parts: [
      {
        id: "part-001",
        repair_ticket_id: "srv-demo-003",
        item_id: "sp-003",
        item_name: "IC Power PM6150",
        item_sku: "IC-PWR-PM6150",
        qty: 1,
        hpp_at_use: 185000,
        created_at: new Date().toISOString(),
      }
    ],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: "srv-demo-004",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    customer_name: "dr. Hendra",
    device_model: "iPhone 12 Pro Max",
    device_imei: "359871029481234",
    device_password_pattern: "PIN: 998877",
    complaint: "Kamera belakang goyang getar berisik (OIS rusak paska pasang di motor)",
    status: "QC",
    estimated_cost: 850000,
    final_cost: 850000,
    parts: [],
    created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
  {
    id: "srv-demo-005",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    customer_name: "Citra Dewi",
    device_model: "Oppo Reno 6",
    device_imei: "865431092837412",
    device_password_pattern: "Pola Garis Bawah",
    complaint: "Ganti port charging Type-C, unit sudah dites charging 100% normal",
    status: "Done",
    estimated_cost: 150000,
    final_cost: 150000,
    parts: [],
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  }
];

export default function RepairCenterPage() {
  const [tickets, setTickets] = useState<RepairTicket[]>(INITIAL_DEMO_TICKETS);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);

  // Form Tiket Baru
  const [newTicketForm, setNewTicketForm] = useState({
    device_model: "",
    device_imei: "",
    complaint: "",
    device_password_pattern: "",
    estimated_cost: 250000,
    customer_name: "",
  });

  // State Update Status pada Drawer Detail
  const [statusDraft, setStatusDraft] = useState<string>("Intake");
  const [finalCostDraft, setFinalCostDraft] = useState<number>(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // State QC Checklist
  const [qcChecklist, setQcChecklist] = useState({
    screen_touch: true,
    cameras: true,
    speaker_mic: true,
    charging_port: true,
    signal_wifi: true,
    biometrics: true,
  });

  // State Komisi Teknisi
  const [selectedTechnician, setSelectedTechnician] = useState("Dimas (Teknisi Senior)");
  const [commissionRate, setCommissionRate] = useState(25);

  // State Tambah Sparepart
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [partQty, setPartQty] = useState<number>(1);
  const [partHpp, setPartHpp] = useState<number>(150000);
  const [isAddingPart, setIsAddingPart] = useState(false);

  // Pesan alert / error
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Fetch data tiket & item katalog saat mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [backendTickets, catalogItems] = await Promise.all([
        getRepairTickets().catch(() => []),
        getItems().catch(() => [])
      ]);

      if (backendTickets && backendTickets.length > 0) {
        setTickets(backendTickets);
      }
      if (catalogItems && catalogItems.length > 0) {
        setAvailableItems(catalogItems);
        setSelectedItemId(catalogItems[0]?.id || "");
        setPartHpp(catalogItems[0]?.base_price || 150000);
      }
    } catch (err) {
      console.warn("Menggunakan data lokal pusat servis");
    } finally {
      setIsLoading(false);
    }
  };

  // Pilih kartu tiket untuk melihat detail
  const handleSelectTicket = (ticket: RepairTicket) => {
    setSelectedTicket(ticket);
    setStatusDraft(ticket.status);
    setFinalCostDraft(ticket.final_cost || ticket.estimated_cost || 0);
    setFeedbackMsg(null);
  };

  // Handler Buat Tiket Servis Baru
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.device_model || !newTicketForm.complaint) {
      setFeedbackMsg({ type: "error", text: "Model perangkat dan keluhan kerusakan wajib diisi!" });
      return;
    }

    setIsLoading(true);
    try {
      let created: RepairTicket;
      try {
        created = await createRepairTicket({
          device_model: newTicketForm.device_model,
          device_imei: newTicketForm.device_imei || undefined,
          complaint: newTicketForm.complaint,
          device_password_pattern: newTicketForm.device_password_pattern || undefined,
          estimated_cost: Number(newTicketForm.estimated_cost) || 0,
        });
      } catch (apiErr) {
        // Fallback demo lokal
        created = {
          id: `srv-${Date.now().toString().slice(-6)}`,
          tenant_id: "11111111-1111-1111-1111-111111111111",
          customer_name: newTicketForm.customer_name || "Pelanggan Meja Intake",
          device_model: newTicketForm.device_model,
          device_imei: newTicketForm.device_imei || null,
          device_password_pattern: newTicketForm.device_password_pattern || null,
          complaint: newTicketForm.complaint,
          status: "Intake",
          estimated_cost: Number(newTicketForm.estimated_cost) || 0,
          final_cost: null,
          parts: [],
          created_at: new Date().toISOString(),
        };
      }

      setTickets((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setNewTicketForm({
        device_model: "",
        device_imei: "",
        complaint: "",
        device_password_pattern: "",
        estimated_cost: 250000,
        customer_name: "",
      });
      setFeedbackMsg({ type: "success", text: `Tiket servis #${created.id.slice(0, 8)} berhasil didaftarkan!` });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal membuat tiket servis." });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Update Status Servis
  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;

    // Aturan Bisnis: Jika status 'Repairing' atau 'Done', final_cost wajib > 0
    if ((statusDraft === "Repairing" || statusDraft === "Done") && finalCostDraft <= 0) {
      setFeedbackMsg({ 
        type: "error", 
        text: `Status '${statusDraft}' mewajibkan pengisian Biaya Akhir (Final Cost) yang valid!` 
      });
      return;
    }

    setIsUpdatingStatus(true);
    setFeedbackMsg(null);

    try {
      let updated: RepairTicket;
      try {
        updated = await updateRepairTicketStatus(selectedTicket.id, {
          status: statusDraft,
          final_cost: (statusDraft === "Repairing" || statusDraft === "Done") ? finalCostDraft : undefined,
        });
      } catch (apiErr) {
        // Fallback update lokal
        updated = {
          ...selectedTicket,
          status: statusDraft as any,
          final_cost: (statusDraft === "Repairing" || statusDraft === "Done") ? finalCostDraft : selectedTicket.final_cost,
          updated_at: new Date().toISOString(),
        };
      }

      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setSelectedTicket(updated);
      setFeedbackMsg({ type: "success", text: `Status tiket berhasil diubah menjadi '${statusDraft}'!` });

      // Jika status berubah ke 'Done' atau 'Taken', otomatis buka Nota Servis Resmi
      if (statusDraft === "Done" || statusDraft === "Taken") {
        const partsCost = (updated.parts || []).reduce((sum, p) => sum + (p.hpp_at_use || 0) * (p.qty || 1), 0);
        const finalCost = updated.final_cost || finalCostDraft || 0;
        const laborCost = Math.max(0, finalCost - partsCost);

        setReceiptModalData({
          ticketId: updated.id,
          date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
          customerName: updated.customer_name || "Pelanggan Meja Servis",
          customerPhone: (updated as any).customer_phone || "",
          deviceModel: updated.device_model,
          deviceImei: updated.device_imei || "-",
          devicePasswordPattern: updated.device_password_pattern || "-",
          complaint: updated.complaint,
          totalAmount: finalCost,
          laborCost: laborCost,
          parts: (updated.parts || []).map((p) => ({
            name: p.item_name || "Suku Cadang",
            qty: p.qty,
            price: p.hpp_at_use,
            total: p.hpp_at_use * p.qty,
          })),
          warrantyDays: 30,
          technicianName: "Teknisi Mas Dimas",
          status: statusDraft,
        });
        setIsReceiptModalOpen(true);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal memperbarui status tiket." });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handler Tambah Sparepart ke Tiket
  const handleAddPart = async () => {
    if (!selectedTicket) return;

    const chosenItem = availableItems.find((i) => i.id === selectedItemId) || {
      id: selectedItemId || "sp-custom",
      name: "Sparepart Komponen Servis",
      sku: "SP-PART",
    };

    setIsAddingPart(true);
    setFeedbackMsg(null);

    try {
      let newPart: RepairPart;
      try {
        newPart = await addRepairPart(selectedTicket.id, {
          item_id: chosenItem.id,
          qty: Number(partQty) || 1,
          hpp_at_use: Number(partHpp) || 150000,
        });
      } catch (apiErr) {
        // Fallback part lokal
        newPart = {
          id: `part-${Date.now().toString().slice(-5)}`,
          repair_ticket_id: selectedTicket.id,
          item_id: chosenItem.id,
          item_name: chosenItem.name,
          item_sku: chosenItem.sku,
          qty: Number(partQty) || 1,
          hpp_at_use: Number(partHpp) || 150000,
          created_at: new Date().toISOString(),
        };
      }

      const updatedTicket: RepairTicket = {
        ...selectedTicket,
        parts: [...(selectedTicket.parts || []), newPart],
      };

      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updatedTicket : t)));
      setSelectedTicket(updatedTicket);
      setFeedbackMsg({ type: "success", text: `Sparepart '${newPart.item_name || "Komponen"}' berhasil dialokasikan!` });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal menambahkan sparepart." });
    } finally {
      setIsAddingPart(false);
    }
  };

  // Filter pencarian tiket
  const filteredTickets = tickets.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.device_model.toLowerCase().includes(q) ||
      t.complaint.toLowerCase().includes(q) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
      (t.device_imei && t.device_imei.includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Modul Retail & Servis HP
            </span>
            <span className="text-xs text-gray-400 font-mono">Workflow Kanban Real-Time</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-purple-400" />
            Pusat Servis & Tiket Reparasi HP
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manajemen alur kerja servis unit pelanggan mulai dari meja penerimaan (Intake) hingga QC dan pelunasan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] text-gray-400 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tiket Servis Baru</span>
          </button>
        </div>
      </div>

      {/* Baris Pencarian & Metrik */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari model HP, IMEI, atau pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
          <span>Total Unit: <strong className="text-white">{tickets.length}</strong></span>
          <span>•</span>
          <span>Dikerjakan: <strong className="text-purple-400">{tickets.filter(t => t.status === "Repairing").length}</strong></span>
          <span>•</span>
          <span>Siap Diambil: <strong className="text-emerald-400">{tickets.filter(t => t.status === "Done").length}</strong></span>
        </div>
      </div>

      {/* Alert Notifikasi */}
      {feedbackMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
          feedbackMsg.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          KANBAN BOARD: 5 TAHAPAN STATUS SERVIS
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => {
          const columnTickets = filteredTickets.filter((t) => t.status === col.key);

          return (
            <div
              key={col.key}
              className="bg-[#121212] rounded-2xl border border-[#242424] p-3.5 flex flex-col min-h-[500px]"
            >
              {/* Header Kolom */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222]">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    col.key === "Done" ? "bg-emerald-500" :
                    col.key === "Repairing" ? "bg-purple-500" :
                    col.key === "Diagnosis" ? "bg-amber-500" :
                    col.key === "QC" ? "bg-cyan-500" : "bg-blue-500"
                  }`} />
                  <h3 className="font-bold text-xs text-white">{col.label}</h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${col.color}`}>
                  {columnTickets.length} Unit
                </span>
              </div>

              {/* List Kartu Tiket */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-22rem)] pr-0.5">
                {columnTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className="p-3.5 rounded-xl bg-[#191919] hover:bg-[#202020] border border-[#2b2b2b] hover:border-purple-500/50 cursor-pointer transition-all duration-200 group relative overflow-hidden shadow-sm"
                  >
                    {/* Aksen Gradien Atas saat Hover */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/0 to-transparent group-hover:via-purple-500 transition-all" />

                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-gray-400 bg-[#242424] px-1.5 py-0.5 rounded border border-[#303030]">
                        #{ticket.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] font-medium text-purple-300 font-mono">
                        {formatRupiah(ticket.final_cost || ticket.estimated_cost || 0)}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors flex items-center gap-1.5 mb-1">
                      <Smartphone className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">{ticket.device_model}</span>
                    </h4>

                    <p className="text-[11px] text-gray-400 line-clamp-2 mb-2.5 leading-snug">
                      {ticket.complaint}
                    </p>

                    <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[10px] text-gray-500">
                      <div className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{ticket.customer_name || "Pelanggan Langsung"}</span>
                      </div>
                      {ticket.parts && ticket.parts.length > 0 && (
                        <span className="text-[10px] text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30 font-mono">
                          {ticket.parts.length} part
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {columnTickets.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-center text-gray-600 p-4 border border-dashed border-[#222] rounded-xl">
                    <Layers className="w-6 h-6 mb-1 opacity-30" />
                    <p className="text-[11px]">Kosong</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================================
          MODAL / DRAWER DETAIL TIKET SERVIS
          ===================================================================== */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-5">
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-[#262626]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222] text-gray-400 border border-[#333]">
                    ID: {selectedTicket.id}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Status: {selectedTicket.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                  {selectedTicket.device_model}
                </h2>
                <p className="text-xs text-gray-400">
                  Pelanggan: <strong className="text-gray-200">{selectedTicket.customer_name || "Pelanggan Langsung"}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="w-8 h-8 rounded-lg bg-[#222] hover:bg-[#2e2e2e] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Informasi Diagnosa & Keamanan Perangkat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#191919] p-3.5 rounded-xl border border-[#262626]">
              <div>
                <span className="text-gray-400 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
                  <Hash className="w-3.5 h-3.5 text-purple-400" /> IMEI / Serial Number
                </span>
                <p className="font-mono text-gray-200">{selectedTicket.device_imei || "(Tidak dicatat)"}</p>
              </div>

              <div>
                <span className="text-gray-400 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Pola Kunci / PIN Layar
                </span>
                <p className="font-mono text-amber-300 font-semibold">{selectedTicket.device_password_pattern || "(Tanpa Kunci)"}</p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-[#2a2a2a]">
                <span className="text-gray-400 text-[10px] uppercase font-semibold">Keluhan Kerusakan:</span>
                <p className="text-gray-200 mt-0.5 leading-relaxed bg-[#141414] p-2.5 rounded-lg border border-[#222]">
                  {selectedTicket.complaint}
                </p>
              </div>
            </div>

            {/* Section Ubah Status Servis HP */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Pembaruan Status & Biaya Pengerjaan
                </h4>
                <span className="text-[10px] text-gray-400">Aturan: Repairing/Done wajib isi Final Cost</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Tahapan Status:</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="Intake">Intake (Unit Masuk)</option>
                    <option value="Diagnosis">Diagnosis (Pemeriksaan)</option>
                    <option value="Waiting Approval">Waiting Approval (Tunggu Persetujuan)</option>
                    <option value="Repairing">Repairing (Pengerjaan Teknis)</option>
                    <option value="QC">QC (Quality Control)</option>
                    <option value="Done">Done (Selesai Servis)</option>
                    <option value="Taken">Taken (Sudah Diambil Pelanggan)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Biaya Akhir / Final Cost (Rp):
                  </label>
                  <input
                    type="number"
                    value={finalCostDraft}
                    onChange={(e) => setFinalCostDraft(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                    placeholder="Contoh: 750000"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateStatus}
                disabled={isUpdatingStatus}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan Status...</span>
                  </>
                ) : (
                  <>
                    <span>Simpan Perubahan Status</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Section Quality Control (QC) Checklist */}
            <div className="p-4 rounded-xl bg-[#161616] border border-[#2b2b2b] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Quality Control (QC) 6 Titik Pemeriksaan
                </h4>
                <span className="text-[10px] text-gray-400">Verifikasi sebelum unit diambil</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.screen_touch}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, screen_touch: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Layar & Touchscreen</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.cameras}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, cameras: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Kamera Depan/Belakang</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.speaker_mic}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, speaker_mic: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Speaker & Mikrofon</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.charging_port}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, charging_port: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Port Fast Charging</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.signal_wifi}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, signal_wifi: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Sinyal SIM & WiFi</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e] cursor-pointer hover:border-cyan-500/40 transition">
                  <input
                    type="checkbox"
                    checked={qcChecklist.biometrics}
                    onChange={(e) => setQcChecklist({ ...qcChecklist, biometrics: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className="text-gray-300 text-[11px]">Biometrik (Face/Finger)</span>
                </label>
              </div>
            </div>

            {/* Section Kalkulator Komisi Teknisi */}
            <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Alokasi Komisi Teknisi & Laba Servis
                </h4>
                <span className="text-[10px] text-gray-400 font-mono">Bagi Hasil Jasa Bersih</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Teknisi Penanggung Jawab:</label>
                  <select
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Dimas (Teknisi Senior)">Mas Dimas (Spesialis Mesin & IC)</option>
                    <option value="Rian (Teknisi Junior)">Mas Rian (Spesialis LCD & Baterai)</option>
                    <option value="Bayu (Teknisi Software)">Mas Bayu (Spesialis Flashing & Bypass)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Rate Komisi Jasa (%):</label>
                  <input
                    type="number"
                    min={5}
                    max={80}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {(() => {
                const totalPartsCost = (selectedTicket.parts || []).reduce((sum, p) => sum + (p.hpp_at_use || 0) * (p.qty || 1), 0);
                const finalAmt = selectedTicket.final_cost || finalCostDraft || 0;
                const netLaborFee = Math.max(0, finalAmt - totalPartsCost);
                const techCommissionAmt = Math.round(netLaborFee * (commissionRate / 100));
                const storeProfit = Math.max(0, netLaborFee - techCommissionAmt);

                return (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#333] text-center font-mono">
                    <div className="p-2 rounded-lg bg-[#141414] border border-[#2a2a2a]">
                      <p className="text-[9px] text-gray-400">Jasa Bersih</p>
                      <p className="text-xs font-bold text-white mt-0.5">{formatRupiah(netLaborFee)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[9px] text-amber-300">Komisi Teknisi ({commissionRate}%)</p>
                      <p className="text-xs font-bold text-amber-300 mt-0.5">{formatRupiah(techCommissionAmt)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[9px] text-emerald-300">Laba Bersih Toko</p>
                      <p className="text-xs font-bold text-emerald-300 mt-0.5">{formatRupiah(storeProfit)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Section Sparepart yang Digunakan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-400" />
                  Sparepart Fisik yang Digunakan ({selectedTicket.parts?.length || 0})
                </h4>
                <span className="text-[10px] text-gray-400">Snapshot HPP untuk General Ledger</span>
              </div>

              {/* List Sparepart yang Sudah Ada */}
              <div className="space-y-2">
                {selectedTicket.parts && selectedTicket.parts.length > 0 ? (
                  selectedTicket.parts.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-2.5 rounded-lg bg-[#181818] border border-[#282828] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white">{p.item_name || "Komponen Sparepart"}</p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          SKU: {p.item_sku || "-"} • Qty: {p.qty} unit
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-purple-300 font-bold">{formatRupiah(p.hpp_at_use * p.qty)}</p>
                        <p className="text-[10px] text-gray-500">HPP: {formatRupiah(p.hpp_at_use)}/unit</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-2 bg-[#181818] rounded-lg border border-dashed border-[#282828]">
                    Belum ada sparepart yang dialokasikan ke unit servis ini.
                  </p>
                )}
              </div>

              {/* Form Pasang Sparepart Baru */}
              <div className="p-3 rounded-xl bg-[#181818] border border-[#2b2b2b] space-y-2.5">
                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Alokasikan Sparepart dari Katalog:</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-3">
                    <select
                      value={selectedItemId}
                      onChange={(e) => {
                        setSelectedItemId(e.target.value);
                        const itm = availableItems.find(i => i.id === e.target.value);
                        if (itm) setPartHpp(itm.base_price || 150000);
                      }}
                      className="w-full bg-[#141414] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      {availableItems.length > 0 ? (
                        availableItems.map((itm) => (
                          <option key={itm.id} value={itm.id}>
                            {itm.name} ({itm.sku}) - {formatRupiah(itm.base_price)}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="sp-001">LCD iPhone 11 Original OEM (Rp 650.000)</option>
                          <option value="sp-002">Baterai Samsung Galaxy S21 (Rp 320.000)</option>
                          <option value="sp-003">IC Power PM6150 Xiaomi/Redmi (Rp 185.000)</option>
                          <option value="sp-004">Fleksibel Konektor Charger iPhone 12 (Rp 145.000)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase">Qty:</label>
                    <input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(Number(e.target.value))}
                      className="w-full bg-[#141414] border border-[#333] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-gray-400 uppercase">HPP Satuan (Rp):</label>
                    <input
                      type="number"
                      value={partHpp}
                      onChange={(e) => setPartHpp(Number(e.target.value))}
                      className="w-full bg-[#141414] border border-[#333] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddPart}
                  disabled={isAddingPart}
                  className="w-full py-2 rounded-lg bg-[#252525] hover:bg-[#303030] text-purple-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-purple-500/20"
                >
                  {isAddingPart ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Pasang Sparepart ke Tiket</span>
                </button>
              </div>

              {/* Tombol Cetak Nota Servis & Kirim WhatsApp */}
              <div className="pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    const partsCost = (selectedTicket.parts || []).reduce((sum, p) => sum + (p.hpp_at_use || 0) * (p.qty || 1), 0);
                    const finalCost = selectedTicket.final_cost || selectedTicket.estimated_cost || 0;
                    const laborCost = Math.max(0, finalCost - partsCost);

                    setReceiptModalData({
                      ticketId: selectedTicket.id,
                      date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
                      customerName: selectedTicket.customer_name || "Pelanggan Meja Servis",
                      customerPhone: (selectedTicket as any).customer_phone || "",
                      deviceModel: selectedTicket.device_model,
                      deviceImei: selectedTicket.device_imei || "-",
                      devicePasswordPattern: selectedTicket.device_password_pattern || "-",
                      complaint: selectedTicket.complaint,
                      totalAmount: finalCost,
                      laborCost: laborCost,
                      parts: (selectedTicket.parts || []).map((p) => ({
                        name: p.item_name || "Suku Cadang",
                        qty: p.qty,
                        price: p.hpp_at_use,
                        total: p.hpp_at_use * p.qty,
                      })),
                      warrantyDays: 30,
                      technicianName: "Teknisi Mas Dimas",
                      status: selectedTicket.status,
                    });
                    setIsReceiptModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/30"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Cetak Nota Servis / Kirim WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL BUAT TIKET SERVIS BARU (INTAKE)
          ===================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Penerimaan Unit Servis Baru</h3>
                  <p className="text-[10px] text-gray-400">Pendaftaran tiket di meja kasir / intake</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Model / Seri HP *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: iPhone 13 Pro 128GB Sierra Blue"
                  value={newTicketForm.device_model}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, device_model: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Nama Pemilik / Pelanggan
                  </label>
                  <input
                    type="text"
                    placeholder="Budi Santoso"
                    value={newTicketForm.customer_name}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, customer_name: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    IMEI / Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="358742091234567"
                    value={newTicketForm.device_imei}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, device_imei: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  PIN Kunci Layar / Pola Sandi (Untuk QC)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: PIN: 123456 atau Pola Huruf Z"
                  value={newTicketForm.device_password_pattern}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, device_password_pattern: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Keluhan Kerusakan Lengkap *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Layar blank hitam, touch mati sebagian, kamera getar..."
                  value={newTicketForm.complaint}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, complaint: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Estimasi Biaya Awal (Rp):
                </label>
                <input
                  type="number"
                  value={newTicketForm.estimated_cost}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, estimated_cost: Number(e.target.value) })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#222]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Daftarkan Tiket Servis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Komponen Cetak Nota Servis & Kirim WhatsApp */}
      {receiptModalData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          type="REPAIR"
          transactionData={receiptModalData}
        />
      )}
    </div>
  );
}
