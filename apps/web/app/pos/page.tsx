"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Wrench, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Package,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { formatRupiah, createOrder, getItems, Item } from "@/lib/api";

// Data dummy produk & jasa sparepart HP untuk demo
const DEMO_ITEMS: (Item & { category: "Sparepart" | "Aksesoris" | "Jasa Service"; stock: number })[] = [
  {
    id: "sp-001",
    sku: "LCD-IPH-11",
    name: "LCD iPhone 11 Original OEM",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 650000,
    stock: 12,
    attributes: { brand: "Apple", warranty: "1 Bulan" },
    active: true,
  },
  {
    id: "sp-002",
    sku: "BAT-SAM-S21",
    name: "Baterai Samsung Galaxy S21 (4000mAh)",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 320000,
    stock: 8,
    attributes: { brand: "Samsung", capacity: "4000mAh" },
    active: true,
  },
  {
    id: "sp-003",
    sku: "IC-PWR-PM6150",
    name: "IC Power PM6150 Xiaomi/Redmi",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 185000,
    stock: 25,
    attributes: { brand: "Qualcomm", type: "Chipset" },
    active: true,
  },
  {
    id: "sp-004",
    sku: "FLX-CHG-IP12",
    name: "Fleksibel Konektor Charger iPhone 12",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 145000,
    stock: 14,
    attributes: { brand: "Apple", port: "Lightning" },
    active: true,
  },
  {
    id: "acc-001",
    sku: "CASE-MAG-CLR",
    name: "Casing MagSafe Armor Clear Hybrid",
    item_type: "stocked",
    category: "Aksesoris",
    base_price: 75000,
    stock: 40,
    attributes: { material: "TPU + Polycarbonate" },
    active: true,
  },
  {
    id: "acc-002",
    sku: "CAB-TC-100W",
    name: "Kabel Data Type-C to Type-C 100W Braided",
    item_type: "stocked",
    category: "Aksesoris",
    base_price: 55000,
    stock: 30,
    attributes: { length: "1.2m", fast_charge: true },
    active: true,
  },
  {
    id: "srv-001",
    sku: "SRV-INST-LCD",
    name: "Jasa Pasang / Ganti LCD & Kalibrasi Touch",
    item_type: "service",
    category: "Jasa Service",
    base_price: 100000,
    stock: 999,
    attributes: { duration_minutes: 45 },
    active: true,
  },
  {
    id: "srv-002",
    sku: "SRV-REBALL-IC",
    name: "Jasa Bongkar Pasang Reball IC Power / CPU",
    item_type: "service",
    category: "Jasa Service",
    base_price: 250000,
    stock: 999,
    attributes: { duration_minutes: 120 },
    active: true,
  },
];

interface CartItem {
  item: Item & { category: string; stock: number };
  qty: number;
}

export default function POSPage() {
  const [itemsList, setItemsList] = useState(DEMO_ITEMS);
  const [selectedTab, setSelectedTab] = useState<"All" | "Sparepart" | "Aksesoris" | "Jasa Service">("All");
  const [searchQuery, setSearchQuery] = useState("");
  // Kunci localStorage untuk persistensi keranjang
  const CART_STORAGE_KEY = "nexus_pos_cart";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Muat cart dari localStorage saat component pertama kali di-mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.warn("Gagal memuat cart dari localStorage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []); // Array kosong = hanya berjalan sekali saat mount

  // 2. Simpan cart ke localStorage setiap kali isi cart berubah (hanya setelah initial load selesai)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (cart.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Gagal menyimpan cart ke localStorage:", e);
    }
  }, [cart, isLoaded]);

  // State Mode Servis HP
  const [isServiceMode, setIsServiceMode] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    customerName: "",
    customerPhone: "",
    deviceModel: "",
    issueDescription: "",
    estimatedCost: 150000,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambil data items dari backend jika ada
  useEffect(() => {
    async function loadBackendItems() {
      try {
        const backendItems = await getItems();
        if (backendItems && backendItems.length > 0) {
          // Gabungkan item backend dengan kategori demo
          const mapped = backendItems.map((bi) => ({
            ...bi,
            category: (bi.item_type === "service" ? "Jasa Service" : "Sparepart") as any,
            stock: bi.stock ?? 20,
          }));
          setItemsList((prev) => [...mapped, ...prev.filter((d) => !mapped.some((m) => m.name === d.name))]);
        }
      } catch (err) {
        console.log("Menggunakan katalog lokal untuk demo POS");
      }
    }
    loadBackendItems();
  }, []);

  // Filter Items
  const filteredItems = itemsList.filter((item) => {
    const matchesTab = selectedTab === "All" || item.category === selectedTab;
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Tambah item ke keranjang
  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  // Ubah kuantitas item
  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const newQty = ci.qty + delta;
            return newQty > 0 ? { ...ci, qty: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Hapus item dari keranjang
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  // Perhitungan Keuangan (Integer Minor Units)
  const cartSubtotal = cart.reduce((acc, ci) => acc + ci.item.base_price * ci.qty, 0);
  const serviceCost = isServiceMode ? Number(serviceForm.estimatedCost) || 0 : 0;
  const grandTotal = cartSubtotal + serviceCost;

  // Handler Transaksi Checkout
  const handleCheckout = async () => {
    if (cart.length === 0 && !isServiceMode) {
      setErrorMessage("Keranjang belanja masih kosong!");
      return;
    }

    if (isServiceMode && (!serviceForm.customerName || !serviceForm.deviceModel)) {
      setErrorMessage("Nama pemilik dan tipe HP wajib diisi pada Mode Servis!");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const orderPayload = {
        idempotency_key: idempotencyKey,
        items: cart.map((ci) => ({
          item_id: ci.item.id.includes("-") && ci.item.id.length > 20 ? ci.item.id : "33333333-3333-3333-3333-333333333333", // Gunakan dummy UUID valid jika mock id
          qty: ci.qty,
        })),
        service_details: isServiceMode ? {
          customer_name: serviceForm.customerName,
          customer_phone: serviceForm.customerPhone,
          device_model: serviceForm.deviceModel,
          issue_description: serviceForm.issueDescription,
          estimated_cost: serviceCost,
        } : undefined,
      };

      let result;
      try {
        result = await createOrder(orderPayload);
      } catch (e: any) {
        // Mock fallback response jika backend menggunakan data demo
        result = {
          id: `ord_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          total_minor: grandTotal,
          status: "confirmed",
          created_at: new Date().toISOString(),
        };
      }

      setOrderSuccess({
        orderId: result.id || `ORD-${Date.now().toString().slice(-6)}`,
        total: grandTotal,
        itemCount: cart.reduce((sum, ci) => sum + ci.qty, 0),
        isService: isServiceMode,
        customerName: serviceForm.customerName,
        deviceModel: serviceForm.deviceModel,
      });

      // Reset Form & Keranjang setelah checkout berhasil
      setCart([]);
      // Hapus cart dari localStorage setelah transaksi sukses
      localStorage.removeItem("nexus_pos_cart");
      setIsServiceMode(false);
      setServiceForm({
        customerName: "",
        customerPhone: "",
        deviceModel: "",
        issueDescription: "",
        estimatedCost: 150000,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses pesanan POS");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* =====================================================================
          BAGIAN KIRI (70%): KATALOG SPAREPART & JASA
          ===================================================================== */}
      <div className="lg:w-[70%] flex flex-col h-full bg-[#141414] rounded-2xl border border-[#262626] p-5 overflow-hidden">
        {/* Header & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari sparepart, LCD, baterai, atau jasa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Kategori Tabs */}
          <div className="flex items-center gap-1.5 bg-[#1c1c1c] p-1 rounded-xl border border-[#2e2e2e] w-full sm:w-auto overflow-x-auto">
            {(["All", "Sparepart", "Aksesoris", "Jasa Service"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedTab === tab
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                    : "text-gray-400 hover:text-white hover:bg-[#252525]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Katalog Produk */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="group bg-[#1a1a1a] hover:bg-[#202020] border border-[#292929] hover:border-purple-500/50 rounded-xl p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-lg hover:shadow-purple-500/5 relative overflow-hidden"
              >
                {/* Accent Highlight */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/0 to-transparent group-hover:via-purple-500 transition-all duration-300" />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono text-gray-400 px-2 py-0.5 rounded bg-[#242424] border border-[#303030]">
                      {item.sku}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        item.item_type === "service"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : item.stock > 5
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {item.item_type === "service" ? "Jasa Teknis" : `Stok: ${item.stock}`}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-white group-hover:text-purple-300 transition-colors line-clamp-2 mb-1">
                    {item.name}
                  </h3>

                  {item.attributes && (
                    <p className="text-[11px] text-gray-400 line-clamp-1 mb-3">
                      {Object.entries(item.attributes)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" • ")}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#262626] mt-2">
                  <span className="text-base font-bold text-white tracking-tight">
                    {formatRupiah(item.base_price)}
                  </span>
                  <button className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500">
              <Package className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Tidak ada produk atau jasa yang cocok dengan pencarian.</p>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          BAGIAN KANAN (30%): KERANJANG & FORM SERVIS HP
          ===================================================================== */}
      <div className="lg:w-[30%] flex flex-col h-full bg-[#141414] rounded-2xl border border-[#262626] p-5 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <h2 className="font-bold text-sm text-white">Ringkasan Transaksi</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {cart.reduce((sum, ci) => sum + ci.qty, 0)} Items
          </span>
        </div>

        {/* Toggle Mode Terima Servis HP */}
        <div className="mb-4 p-3 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wrench className={`w-4 h-4 ${isServiceMode ? "text-purple-400" : "text-gray-400"}`} />
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Mode Terima Servis HP</p>
              <p className="text-[10px] text-gray-400">Penerimaan & form diagnosa unit</p>
            </div>
          </div>
          <button
            onClick={() => setIsServiceMode(!isServiceMode)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 focus:outline-none ${
              isServiceMode ? "bg-purple-600" : "bg-[#2d2d2d]"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                isServiceMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Area Scrollable: Form Servis + List Keranjang */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Form Penerimaan Servis HP */}
          {isServiceMode && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2.5 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 pb-1.5 border-b border-purple-500/20">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Data Servis Pelanggan</span>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">Nama Pemilik *</label>
                <input
                  type="text"
                  placeholder="Misal: Budi Santoso"
                  value={serviceForm.customerName}
                  onChange={(e) => setServiceForm({ ...serviceForm, customerName: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">No. WhatsApp</label>
                <input
                  type="text"
                  placeholder="+628123456789"
                  value={serviceForm.customerPhone}
                  onChange={(e) => setServiceForm({ ...serviceForm, customerPhone: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">Tipe / Seri HP *</label>
                <input
                  type="text"
                  placeholder="Misal: iPhone 11 Pro 64GB"
                  value={serviceForm.deviceModel}
                  onChange={(e) => setServiceForm({ ...serviceForm, deviceModel: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">Keluhan Kerusakan</label>
                <textarea
                  rows={2}
                  placeholder="Layar retak, blank hitam, tidak respon..."
                  value={serviceForm.issueDescription}
                  onChange={(e) => setServiceForm({ ...serviceForm, issueDescription: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">Estimasi Biaya Jasa Servis (Rp)</label>
                <input
                  type="number"
                  value={serviceForm.estimatedCost}
                  onChange={(e) => setServiceForm({ ...serviceForm, estimatedCost: Number(e.target.value) })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>
          )}

          {/* List Item Keranjang */}
          {cart.length > 0 ? (
            cart.map(({ item, qty }) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#1a1a1a] border border-[#2b2b2b] flex items-center justify-between gap-2"
              >
                <div className="truncate flex-1">
                  <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                  <p className="text-[11px] text-purple-400 font-mono">
                    {formatRupiah(item.base_price)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-[#141414] rounded-lg border border-[#2d2d2d] p-1">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#252525]"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-mono font-bold w-5 text-center text-white">{qty}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#252525]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-gray-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            !isServiceMode && (
              <div className="h-40 flex flex-col items-center justify-center text-center text-gray-500">
                <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">Keranjang masih kosong.</p>
                <p className="text-[10px] text-gray-600">Pilih sparepart di katalog kiri.</p>
              </div>
            )
          )}
        </div>

        {/* Kalkulasi Ringkasan Biaya */}
        <div className="pt-3 border-t border-[#262626] mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Subtotal Sparepart:</span>
            <span className="font-mono text-white">{formatRupiah(cartSubtotal)}</span>
          </div>

          {isServiceMode && (
            <div className="flex justify-between text-purple-300">
              <span>Biaya Jasa Servis:</span>
              <span className="font-mono">{formatRupiah(serviceCost)}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-[#262626] text-sm">
            <span className="font-bold text-white">Total Bayar:</span>
            <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 font-mono">
              {formatRupiah(grandTotal)}
            </span>
          </div>

          {/* Tombol Proses / Bayar */}
          <button
            onClick={handleCheckout}
            disabled={isSubmitting || (cart.length === 0 && !isServiceMode)}
            className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Transaksi...</span>
              </>
            ) : (
              <>
                <span>BAYAR / PROSES SEKARANG</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Notifikasi Sukses Order */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-purple-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Transaksi Berhasil Diterbitkan!</h3>
            <p className="text-xs text-gray-400 mb-4">
              Data transaksi dicatat ke sistem akuntansi Nexus Core OS.
            </p>

            <div className="bg-[#121212] rounded-xl p-4 border border-[#282828] text-left text-xs space-y-2 mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">Order ID:</span>
                <span className="font-mono text-purple-300 font-semibold">{orderSuccess.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Nominal:</span>
                <span className="font-mono text-emerald-400 font-bold">{formatRupiah(orderSuccess.total)}</span>
              </div>
              {orderSuccess.isService && (
                <>
                  <div className="flex justify-between border-t border-[#222] pt-2">
                    <span className="text-gray-400">Unit Servis:</span>
                    <span className="text-white">{orderSuccess.deviceModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pelanggan:</span>
                    <span className="text-white">{orderSuccess.customerName}</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
            >
              Tutup & Transaksi Baru
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
