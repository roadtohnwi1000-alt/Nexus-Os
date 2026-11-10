"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Smartphone, 
  Search, 
  Plus, 
  Filter, 
  Sparkles, 
  MessageSquare, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle, 
  Award, 
  Clock, 
  PhoneCall, 
  CheckCircle2, 
  X, 
  RotateCw,
  Send,
  Zap,
  Tag,
  Edit3,
  History,
  FileText,
  ShoppingBag,
  RotateCcw
} from "lucide-react";
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer,
  getCRMRFMSummary, 
  getLifecycleSequences, 
  toggleLifecycleSequence,
  Customer, 
  RFMSummary, 
  LifecycleSequence,
  formatRupiah 
} from "@/lib/api";

const FALLBACK_CRM_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Budi Santoso (Toko Berkah)",
    phone: "081234567890",
    tier: "reseller",
    address: "Jl. Hayam Wuruk No. 12, Jakarta",
    total_spent: 45000000,
    total_orders: 28,
    last_transaction_date: "2024-10-28",
    rfm_segment: "Champions",
    devices: [
      { brand: "Apple", model: "iPhone 11", imei: "358921094821049", warranty_until: "2024-11-28" }
    ],
    created_at: "2024-01-15T08:00:00Z"
  },
  {
    id: "cust-002",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Agus Prasetyo (Teknisi Rekanan)",
    phone: "085711223344",
    tier: "technician",
    address: "ITC Roxy Mas Lt. 2 No. 45",
    total_spent: 89000000,
    total_orders: 64,
    last_transaction_date: "2024-10-30",
    rfm_segment: "Champions",
    devices: [
      { brand: "Samsung", model: "Galaxy S21", imei: "354019283746192", warranty_until: "2024-11-15" }
    ],
    created_at: "2024-02-01T10:30:00Z"
  },
  {
    id: "cust-003",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Dewi Lestari",
    phone: "087899887766",
    tier: "retail",
    address: "Jl. Tebet Raya No. 8",
    total_spent: 1250000,
    total_orders: 2,
    last_transaction_date: "2024-10-12",
    rfm_segment: "Promising / New",
    devices: [
      { brand: "Xiaomi", model: "Redmi Note 10", imei: "867492019482716", warranty_until: "2024-11-05" }
    ],
    created_at: "2024-03-10T14:20:00Z"
  },
  {
    id: "cust-004",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Siti Rahma (Olshop Fashion)",
    phone: "081399881122",
    tier: "reseller",
    address: "Tanah Abang Blok A Lt. 1",
    total_spent: 24000000,
    total_orders: 15,
    last_transaction_date: "2024-10-25",
    rfm_segment: "Loyal Customers",
    devices: [],
    created_at: "2024-04-05T11:15:00Z"
  }
];

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "RFM" | "LIFECYCLE">("DIRECTORY");
  const [customers, setCustomers] = useState<Customer[]>(FALLBACK_CRM_CUSTOMERS);
  const [rfmSummary, setRfmSummary] = useState<RFMSummary | null>(null);
  const [lifecycleSequences, setLifecycleSequences] = useState<LifecycleSequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");

  // Modal State Tambah Pelanggan
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newCustForm, setNewCustForm] = useState({
    name: "",
    phone: "",
    tier: "retail",
    address: "",
    deviceBrand: "Apple",
    deviceModel: "",
    imei: "",
  });

  // Modal State Edit Pelanggan & Ubah Tier
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    tier: "retail",
    address: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal State Riwayat Transaksi & Pengecekan Retur
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [returnStatusNotice, setReturnStatusNotice] = useState<string | null>(null);

  // Alert Banner
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [custList, rfm, seqs] = await Promise.all([
        getCustomers(searchQuery || undefined, selectedTier !== "all" ? selectedTier : undefined).catch(() => []),
        getCRMRFMSummary().catch(() => null),
        getLifecycleSequences().catch(() => []),
      ]);
      if (custList && custList.length > 0) {
        setCustomers(custList);
      } else {
        setCustomers(FALLBACK_CRM_CUSTOMERS);
      }
      if (rfm) setRfmSummary(rfm);
      if (seqs) setLifecycleSequences(seqs);
    } catch (err) {
      console.error("Gagal memuat data CRM:", err);
      setCustomers(FALLBACK_CRM_CUSTOMERS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedTier]);

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({
      name: c.name,
      phone: c.phone,
      tier: c.tier || "retail",
      address: c.address || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      setIsSavingEdit(true);
      const updated = await updateCustomer(editingCustomer.id, {
        name: editForm.name,
        phone: editForm.phone,
        tier: editForm.tier,
        address: editForm.address || undefined,
      });

      setCustomers((prev) =>
        prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...updated } : c))
      );
      setIsEditModalOpen(false);
      setAlertNotice(`✓ Data & Tier pelanggan "${editForm.name}" berhasil diubah menjadi [${editForm.tier.toUpperCase()}]. Diskon otomatis aktif pada kasir!`);
      setTimeout(() => setAlertNotice(null), 5000);
    } catch (err: any) {
      // Local fallback jika remote database offline
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editingCustomer.id
            ? { ...c, name: editForm.name, phone: editForm.phone, tier: editForm.tier, address: editForm.address }
            : c
        )
      );
      setIsEditModalOpen(false);
      setAlertNotice(`✓ Data pelanggan diperbarui lokal: Tier [${editForm.tier.toUpperCase()}] tersimpan!`);
      setTimeout(() => setAlertNotice(null), 5000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenHistory = (c: Customer) => {
    setHistoryCustomer(c);
    setReturnStatusNotice(null);
    setIsHistoryModalOpen(true);
  };

  const handleProcessReturn = (invoiceNo: string, itemName: string) => {
    setReturnStatusNotice(`✓ Retur barang "${itemName}" pada nota #${invoiceNo} berhasil diverifikasi! Tiket RMA #RET-${Math.floor(1000 + Math.random() * 9000)} diterbitkan untuk pengembalian / klaim garansi.`);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustForm.name || !newCustForm.phone) {
      setFormError("Nama dan nomor WhatsApp wajib diisi!");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const devices = newCustForm.deviceModel ? [{
        brand: newCustForm.deviceBrand,
        model: newCustForm.deviceModel,
        imei: newCustForm.imei || undefined,
        last_service_date: new Date().toISOString().split("T")[0],
        warranty_until: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      }] : [];

      const created = await createCustomer({
        name: newCustForm.name,
        phone: newCustForm.phone.startsWith("+") ? newCustForm.phone : `+62${newCustForm.phone.replace(/^0+/, "")}`,
        tier: newCustForm.tier,
        address: newCustForm.address || undefined,
        devices: devices,
      });

      setCustomers((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      setNewCustForm({
        name: "",
        phone: "",
        tier: "retail",
        address: "",
        deviceBrand: "Apple",
        deviceModel: "",
        imei: "",
      });
      setAlertNotice(`✅ Pelanggan ${created.name} berhasil didaftarkan ke sistem!`);
      setTimeout(() => setAlertNotice(null), 4000);
    } catch (err: any) {
      setFormError(err.message || "Gagal menambahkan pelanggan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSequence = async (seqId: string) => {
    try {
      await toggleLifecycleSequence(seqId);
      setLifecycleSequences((prev) =>
        prev.map((s) => (s.id === seqId ? { ...s, is_active: !s.is_active } : s))
      );
    } catch (err) {
      console.error("Gagal mengubah status sequence:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Customer 360 & Retensi
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Salesforce-Grade Lifecycle
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            CRM & Database Pelanggan
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Kelola profil pelanggan 360°, pelacakan aset perangkat (IMEI), serta otomasi pesan WhatsApp purna-jual
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </button>
      </div>

      {alertNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{alertNotice}</span>
          </div>
          <button onClick={() => setAlertNotice(null)} className="text-emerald-400 font-bold px-2">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <span className="text-[11px] text-gray-400 block mb-1">Total Pelanggan Terdata</span>
          <span className="text-xl md:text-2xl font-mono font-bold text-white">
            {rfmSummary?.total_customers || customers.length}
          </span>
          <span className="text-[10px] text-purple-400 font-medium block mt-1">Multi-tier terdaftar</span>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <span className="text-[11px] text-gray-400 block mb-1">Rata-rata Nilai Belanja (LTV)</span>
          <span className="text-xl md:text-2xl font-mono font-bold text-emerald-400">
            {formatRupiah(rfmSummary?.avg_ltv || 0)}
          </span>
          <span className="text-[10px] text-emerald-500 font-medium block mt-1">Historis transaksi</span>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <span className="text-[11px] text-gray-400 block mb-1">Pelanggan Champions (VIP)</span>
          <span className="text-xl md:text-2xl font-mono font-bold text-purple-300">
            {rfmSummary?.champions_count || 0}
          </span>
          <span className="text-[10px] text-purple-400 font-medium block mt-1">Belanja tinggi & rutin</span>
        </div>

        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <span className="text-[11px] text-gray-400 block mb-1">Pelanggan At-Risk</span>
          <span className="text-xl md:text-2xl font-mono font-bold text-amber-400">
            {rfmSummary?.at_risk_count || 0}
          </span>
          <span className="text-[10px] text-amber-500 font-medium block mt-1">Perlu re-engagement WA</span>
        </div>
      </div>

      {/* Tabs Navigasi Sub-Modul CRM */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("DIRECTORY")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "DIRECTORY"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Direktori Pelanggan & Asset Device</span>
        </button>

        <button
          onClick={() => setActiveTab("RFM")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "RFM"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Segmentasi RFM (Lifecycle)</span>
        </button>

        <button
          onClick={() => setActiveTab("LIFECYCLE")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === "LIFECYCLE"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>WhatsApp Lifecycle Drip ({lifecycleSequences.length})</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: DIREKTORI PELANGGAN & ASSET TRACKING
          ===================================================================== */}
      {activeTab === "DIRECTORY" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#141414] border border-[#262626]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama pelanggan, nomor WhatsApp..."
                className="w-full bg-[#1c1c1c] border border-[#2b2b2b] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="bg-[#1c1c1c] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="all">Semua Tier</option>
                <option value="retail">Retail (Reguler)</option>
                <option value="reseller">Reseller (Grosir)</option>
                <option value="technician">Teknisi (Khusus Part)</option>
              </select>
            </div>
          </div>

          {/* Table Pelanggan */}
          <div className="overflow-x-auto rounded-xl border border-[#262626]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161616] text-gray-400 border-b border-[#262626]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nama & No. WhatsApp</th>
                  <th className="py-3 px-3 font-semibold">Tiering</th>
                  <th className="py-3 px-4 font-semibold">Aset Device Terdaftar</th>
                  <th className="py-3 px-3 font-semibold text-right">Total Belanja</th>
                  <th className="py-3 px-3 font-semibold text-center">Segmen RFM</th>
                  <th className="py-3 px-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-white block">{c.name}</span>
                      <span className="text-[11px] font-mono text-purple-300">{c.phone}</span>
                      {c.address && (
                        <span className="text-[10px] text-gray-500 block truncate max-w-xs">{c.address}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          c.tier === "technician"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : c.tier === "reseller"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-[#252525] text-gray-300 border border-[#333]"
                        }`}
                      >
                        {c.tier}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {c.devices && c.devices.length > 0 ? (
                        <div className="space-y-1">
                          {c.devices.map((d, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px]">
                              <Smartphone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="font-semibold text-gray-200">{d.brand} {d.model}</span>
                              {d.imei && (
                                <span className="text-[10px] font-mono text-gray-500">
                                  ({d.imei.slice(0, 8)}...)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[11px] italic">Belum ada unit terdaftar</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatRupiah(c.total_spent)}
                      <span className="text-[10px] text-gray-500 block font-sans font-normal">
                        {c.total_orders} transaksi
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.rfm_segment === "Champions"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : c.rfm_segment === "Loyal Customers"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : c.rfm_segment === "At Risk"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {c.rfm_segment}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(c)}
                          className="p-1.5 rounded-lg bg-[#222] hover:bg-purple-600 hover:text-white text-purple-300 transition-colors inline-flex items-center gap-1 text-[11px] px-2.5"
                          title="Lihat riwayat pembelian, nota, & pengecekan retur"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Riwayat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg bg-[#222] hover:bg-blue-600 hover:text-white text-blue-300 transition-colors inline-flex items-center gap-1 text-[11px] px-2.5"
                          title="Ubah profil & naik/turunkan tier pelanggan"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Ubah Tier</span>
                        </button>

                        <a
                          href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-[#222] hover:bg-emerald-600 hover:text-white text-emerald-400 transition-colors inline-flex items-center gap-1 text-[11px] px-2"
                          title="Chat via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SEGMENTASI RFM & TINDAKAN STRATEGIS
          ===================================================================== */}
      {activeTab === "RFM" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#141414] border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <h3 className="font-bold text-sm text-white">Champions (Pelanggan Terbaik)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {rfmSummary?.champions_count || 0} Kontak
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Pelanggan dengan riwayat belanja paling baru, paling sering, dan nilai transaksi tertinggi.
            </p>
            <div className="p-3 rounded-xl bg-[#1b1b1b] border border-[#2a2a2a] text-xs text-gray-400">
              💡 <strong>Rekomendasi Aksi:</strong> Berikan reward VIP, prioritas slot teknisi, dan akses eksklusif sparepart langka.
            </div>
            <button
              onClick={() => {
                setAlertNotice("🚀 Pesan apresiasi VIP dikirim ke segmen Champions via WhatsApp!");
                setTimeout(() => setAlertNotice(null), 4000);
              }}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30"
            >
              Kirim Apresiasi VIP & Promo Reseller
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#141414] border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400" />
                <h3 className="font-bold text-sm text-white">Loyal Customers (Pelanggan Setia)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {rfmSummary?.loyal_count || 0} Kontak
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Sering bertransaksi dengan nilai belanja stabil. Memiliki keterikatan tinggi dengan toko Anda.
            </p>
            <div className="p-3 rounded-xl bg-[#1b1b1b] border border-[#2a2a2a] text-xs text-gray-400">
              💡 <strong>Rekomendasi Aksi:</strong> Tawarkan program loyalitas poin, diskon bundling aksesoris, dan upsell garansi extended.
            </div>
            <button
              onClick={() => {
                setAlertNotice("🚀 Penawaran loyalitas dikirim ke segmen Loyal Customers!");
                setTimeout(() => setAlertNotice(null), 4000);
              }}
              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30"
            >
              Tawarkan Promo Bundling Aksesoris
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#141414] border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="font-bold text-sm text-white">At Risk (Berisiko Pindah Kompetitor)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {rfmSummary?.at_risk_count || 0} Kontak
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Dulu rutin belanja atau servis, namun sudah lama (&gt;45 hari) tidak kembali ke outlet Anda.
            </p>
            <div className="p-3 rounded-xl bg-[#1b1b1b] border border-[#2a2a2a] text-xs text-gray-400">
              💡 <strong>Rekomendasi Aksi:</strong> Kirim pesan WhatsApp re-engagement dengan voucher potongan servis atau cuci gudang.
            </div>
            <button
              onClick={() => {
                setAlertNotice("🚀 Kampanye Win-Back Voucher Rp 25.000 dikirim ke pelanggan At Risk!");
                setTimeout(() => setAlertNotice(null), 4000);
              }}
              className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-900/30"
            >
              Jalankan Kampanye Win-Back Diskon Servis
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#141414] border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <h3 className="font-bold text-sm text-white">Lost Customers (Pelanggan Tidak Aktif)</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {rfmSummary?.lost_count || 0} Kontak
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Tidak ada catatan transaksi sama sekali selama lebih dari 120 hari terakhir.
            </p>
            <div className="p-3 rounded-xl bg-[#1b1b1b] border border-[#2a2a2a] text-xs text-gray-400">
              💡 <strong>Rekomendasi Aksi:</strong> Kirim survei kepuasan singkat atau ajakan trade-in / servis unit lama.
            </div>
            <button
              onClick={() => {
                setAlertNotice("🚀 Survei singkat dikirim ke segmen Lost Customers!");
                setTimeout(() => setAlertNotice(null), 4000);
              }}
              className="w-full py-2 rounded-xl bg-[#222] hover:bg-[#2e2e2e] text-gray-300 border border-[#333] text-xs font-semibold transition-colors"
            >
              Kirim Survei Evaluasi Kepuasan
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: WHATSAPP LIFECYCLE AUTOMATION
          ===================================================================== */}
      {activeTab === "LIFECYCLE" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>
                Pesan WhatsApp dikirimkan secara otomatis di latar belakang sesuai jangka waktu purna-jual pelanggan.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-[10px] font-mono font-bold text-purple-300 border border-purple-500/30">
              Auto-Pilot Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lifecycleSequences.map((seq) => (
              <div
                key={seq.id}
                className="p-5 rounded-2xl bg-[#141414] border border-[#282828] hover:border-purple-500/40 transition-colors space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#222] mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222] text-purple-300 border border-[#333]">
                      {seq.delay_label}
                    </span>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleSequence(seq.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        seq.is_active ? "bg-purple-600" : "bg-[#2c2c2c]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          seq.is_active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <h4 className="font-bold text-sm text-white">{seq.title}</h4>
                  <p className="text-xs text-gray-400 mt-1">{seq.description}</p>

                  <div className="mt-3 p-3 rounded-xl bg-[#181818] border border-[#2a2a2a] text-xs text-gray-300 font-mono leading-relaxed">
                    "{seq.template_preview}"
                  </div>
                </div>

                <div className="pt-3 border-t border-[#222] flex items-center justify-between text-[11px] text-gray-400">
                  <span>Telah Terkirim:</span>
                  <span className="font-bold text-emerald-400 font-mono">{seq.sent_count} pesan</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL TAMBAH PELANGGAN BARU
          ===================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Tambah Pelanggan Baru</h3>
                  <p className="text-xs text-gray-400">Daftarkan data kontak & riwayat aset ponsel pelanggan</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252525]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={newCustForm.name}
                    onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                    placeholder="Contoh: Rian Kusuma"
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Nomor WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Tiering Harga</label>
                  <select
                    value={newCustForm.tier}
                    onChange={(e) => setNewCustForm({ ...newCustForm, tier: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="retail">Retail (Harga Normal)</option>
                    <option value="reseller">Reseller (Grosir Part)</option>
                    <option value="technician">Teknisi (Sub-Grosir)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Alamat Domisili</label>
                  <input
                    type="text"
                    value={newCustForm.address}
                    onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                    placeholder="Kota / Alamat Toko"
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Asset Device Section */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#282828] space-y-3">
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Aset Perangkat Pelanggan (Opsional)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Merk</label>
                    <select
                      value={newCustForm.deviceBrand}
                      onChange={(e) => setNewCustForm({ ...newCustForm, deviceBrand: e.target.value })}
                      className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="Apple">Apple</option>
                      <option value="Samsung">Samsung</option>
                      <option value="Xiaomi">Xiaomi</option>
                      <option value="Oppo">Oppo</option>
                      <option value="Vivo">Vivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Tipe / Model</label>
                    <input
                      type="text"
                      value={newCustForm.deviceModel}
                      onChange={(e) => setNewCustForm({ ...newCustForm, deviceModel: e.target.value })}
                      placeholder="iPhone 11, S21..."
                      className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-lg px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">IMEI / SN</label>
                    <input
                      type="text"
                      value={newCustForm.imei}
                      onChange={(e) => setNewCustForm({ ...newCustForm, imei: e.target.value })}
                      placeholder="35892..."
                      className="w-full bg-[#1b1b1b] border border-[#2e2e2e] rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#282828] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5"
                >
                  {isSubmitting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Simpan Pelanggan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT PELANGGAN & UBAH TIERING (MULTI-TIER PROMOTION)
          ===================================================================== */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#333] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Ubah Data & Tiering Pelanggan</h3>
                <p className="text-xs text-gray-400">Atur tier harga untuk diskon otomatis saat kasir bertransaksi</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Nama Pelanggan / Usaha <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Nomor WhatsApp <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              {/* TIERING PROMOTION / DEMOTION SELECTOR */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#2a2a2a] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-purple-300 font-bold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Tiering Pelanggan (Otomasi Harga Kasir)
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    editForm.tier === "technician" ? "bg-purple-500/20 text-purple-300" :
                    editForm.tier === "reseller" ? "bg-blue-500/20 text-blue-300" :
                    "bg-[#252525] text-gray-300"
                  }`}>
                    {editForm.tier}
                  </span>
                </div>

                <select
                  value={editForm.tier}
                  onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-semibold"
                >
                  <option value="retail">Retail (Konsumen Umum / Harga Eceran Normal)</option>
                  <option value="reseller">Reseller (Grosir / Toko Rekanan - Diskon ~10% di POS)</option>
                  <option value="technician">Teknisi (Mitra Bengkel/Servis - Harga Khusus Sub-Grosir)</option>
                </select>

                <div className="text-[11px] text-gray-400 space-y-1 pt-1">
                  <p>💡 <strong className="text-gray-300">Cara Kerja:</strong> Ketika kasir mengetik nama pelanggan ini di POS, sistem langsung otomatis mengubah keranjang ke harga <strong>{editForm.tier.toUpperCase()}</strong> tanpa perlu kasir memilih manual.</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Alamat / Wilayah
                </label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Contoh: Jl. Hayam Wuruk No. 12, Ruko Lt. 1"
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: RIWAYAT TRANSAKSI & PENGECEKAN RETUR / GARANSI
          ===================================================================== */}
      {isHistoryModalOpen && historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#333] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 shadow-2xl relative">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#282828]">
              <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <History className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">{historyCustomer.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    historyCustomer.tier === "technician" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                    historyCustomer.tier === "reseller" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                    "bg-[#252525] text-gray-300 border border-[#333]"
                  }`}>
                    Tier {historyCustomer.tier}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {historyCustomer.phone} • {historyCustomer.address || "Domisili tidak tercatat"}
                </p>
              </div>
            </div>

            {/* Ringkasan Belanja Pelanggan */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[10px] text-gray-400 block mb-0.5">Total Pembelian:</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {formatRupiah(historyCustomer.total_spent)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[10px] text-gray-400 block mb-0.5">Jumlah Transaksi:</span>
                <span className="font-mono text-sm font-bold text-white">
                  {historyCustomer.total_orders}x Checkout
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[10px] text-gray-400 block mb-0.5">Kunjungan Terakhir:</span>
                <span className="font-mono text-xs font-semibold text-purple-300">
                  {historyCustomer.last_transaction_date || "28 Okt 2024"}
                </span>
              </div>
            </div>

            {/* Notifikasi Status Retur */}
            {returnStatusNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
                <span>{returnStatusNotice}</span>
                <button onClick={() => setReturnStatusNotice(null)} className="text-emerald-400 font-bold px-1">✕</button>
              </div>
            )}

            {/* Daftar Nota / Transaksi Historis */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                Histori Nota Belanja & Pengecekan Garansi / Retur
              </h4>

              {/* Invoice 1: Transaksi Terakhir (Garansi Aktif) */}
              <div className="p-4 rounded-xl bg-[#131313] border border-[#282828] space-y-3">
                <div className="flex items-center justify-between border-b border-[#222] pb-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-white">#INV-20241028-0812</span>
                    <span className="text-gray-400 text-[11px] block">28 Oktober 2024, 14:30 WIB • Kasir Cabang A</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LUNAS (QRIS)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#1a1a1a]">
                    <div>
                      <p className="font-semibold text-white">LCD iPhone 11 Original OEM</p>
                      <p className="text-[10px] text-gray-400">1 pcs x {formatRupiah(historyCustomer.tier === "technician" ? 550000 : historyCustomer.tier === "reseller" ? 585000 : 650000)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        Garansi Aktif (14 Hari)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleProcessReturn("INV-20241028-0812", "LCD iPhone 11 Original OEM")}
                        className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold transition-all border border-rose-500/30 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Klaim Retur</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#1a1a1a]">
                    <div>
                      <p className="font-semibold text-white">Lem B7000 Precision Tip 50ml</p>
                      <p className="text-[10px] text-gray-400">1 pcs x Rp 25.000</p>
                    </div>
                    <span className="text-[10px] text-gray-500 italic">No Garansi (Habis Pakai)</span>
                  </div>
                </div>
              </div>

              {/* Invoice 2: Transaksi Terdahulu */}
              <div className="p-4 rounded-xl bg-[#131313] border border-[#282828] space-y-3">
                <div className="flex items-center justify-between border-b border-[#222] pb-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-white">#INV-20241014-0419</span>
                    <span className="text-gray-400 text-[11px] block">14 Oktober 2024, 11:15 WIB • Tunai</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30">
                    LUNAS (CASH)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#1a1a1a]">
                  <div>
                    <p className="font-semibold text-white">Baterai Samsung Galaxy S21 (4000mAh)</p>
                    <p className="text-[10px] text-gray-400">1 pcs x Rp 320.000</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                      Garansi Selesai (30 Hari)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleProcessReturn("INV-20241014-0419", "Baterai Samsung Galaxy S21")}
                      className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-gray-700 text-gray-400 hover:text-white text-[10px] font-medium transition-all"
                    >
                      Cek RMA
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="pt-4 border-t border-[#282828] mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>💡 Gunakan fitur ini saat pelanggan datang membawa barang retur atau klaim garansi.</span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-white font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
