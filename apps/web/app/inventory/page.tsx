"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Warehouse, 
  Store, 
  ArrowRightLeft, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Package, 
  ArrowRight, 
  DollarSign, 
  Building2, 
  Boxes, 
  TrendingDown, 
  Layers, 
  ShieldCheck, 
  Check,
  UploadCloud,
  PackagePlus,
  RotateCcw,
  ShieldAlert,
  LayoutGrid,
  LayoutList,
  Tag,
  Edit3,
  Percent,
  TrendingUp,
  ShoppingCart,
  CreditCard
} from "lucide-react";
import { 
  getLocations, 
  getStock, 
  transferStock, 
  getItems,
  updateItemPrice,
  formatRupiah,
  createGRN,
  returnToSupplier,
  transferToQuarantine,
  getQuarantineItems,
  Location, 
  StockItem, 
  Item,
  QuarantineItem
} from "@/lib/api";

// Definisi lokasi default jika database baru pertama kali digunakan
const DEFAULT_LOCATIONS: Location[] = [
  {
    id: "loc-wh-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Gudang Pusat (Central Hub)",
    type: "warehouse",
    is_active: true,
  },
  {
    id: "loc-str-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Toko Cabang A (Mall)",
    type: "store",
    is_active: true,
  },
  {
    id: "loc-str-002",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Toko Cabang B (Ruko)",
    type: "store",
    is_active: true,
  },
];

// Data matrix inventaris multi-lokasi & multi-tier harga fleksibel
interface MatrixItem {
  id: string;
  sku: string;
  marketplace_sku?: string;
  name: string;
  category: string;
  base_price: number; // HPP / Modal Supplier
  price_retail?: number; // Offline Retail
  price_reseller?: number; // Offline Reseller
  price_technician?: number; // Offline Teknisi
  stocks: { [locationId: string]: number };
}

const INITIAL_MATRIX_ITEMS: MatrixItem[] = [
  {
    id: "sp-001",
    sku: "LCD-IPH-11",
    marketplace_sku: "SHP-LCD-IP11",
    name: "LCD iPhone 11 Original OEM",
    category: "Sparepart",
    base_price: 650000,
    price_retail: 850000,
    price_reseller: 750000,
    price_technician: 720000,
    stocks: {
      "loc-wh-001": 25,
      "loc-str-001": 4,
      "loc-str-002": 2,
    },
  },
  {
    id: "sp-002",
    sku: "BAT-SAM-S21",
    marketplace_sku: "TKP-BAT-S21",
    name: "Baterai Samsung Galaxy S21 (4000mAh)",
    category: "Sparepart",
    base_price: 320000,
    price_retail: 450000,
    price_reseller: 390000,
    price_technician: 360000,
    stocks: {
      "loc-wh-001": 18,
      "loc-str-001": 5,
      "loc-str-002": 3,
    },
  },
  {
    id: "sp-003",
    sku: "IC-PWR-PM6150",
    marketplace_sku: "TT-IC-PM6150",
    name: "IC Power PM6150 Xiaomi/Redmi",
    category: "Sparepart",
    base_price: 185000,
    price_retail: 260000,
    price_reseller: 220000,
    price_technician: 200000,
    stocks: {
      "loc-wh-001": 40,
      "loc-str-001": 6,
      "loc-str-002": 0,
    },
  },
  {
    id: "sp-004",
    sku: "FLX-CHG-IP12",
    marketplace_sku: "SHP-FLX-IP12",
    name: "Fleksibel Konektor Charger iPhone 12",
    category: "Sparepart",
    base_price: 145000,
    price_retail: 210000,
    price_reseller: 180000,
    price_technician: 165000,
    stocks: {
      "loc-wh-001": 30,
      "loc-str-001": 2,
      "loc-str-002": 4,
    },
  },
  {
    id: "acc-001",
    sku: "CAS-MAG-CLR",
    marketplace_sku: "TT-CAS-MAG-CLR",
    name: "Casing MagSafe Armor Clear Hybrid",
    category: "Aksesoris",
    base_price: 75000,
    price_retail: 125000,
    price_reseller: 95000,
    price_technician: 90000,
    stocks: {
      "loc-wh-001": 60,
      "loc-str-001": 15,
      "loc-str-002": 20,
    },
  },
  {
    id: "acc-002",
    sku: "CAB-TC-100W",
    marketplace_sku: "SHP-CAB-TC100W",
    name: "Kabel Data Type-C to Type-C 100W Braided",
    category: "Aksesoris",
    base_price: 55000,
    price_retail: 95000,
    price_reseller: 75000,
    price_technician: 70000,
    stocks: {
      "loc-wh-001": 80,
      "loc-str-001": 20,
      "loc-str-002": 15,
    },
  },
];

export default function MultiLocationInventoryPage() {
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [matrixItems, setMatrixItems] = useState<MatrixItem[]>(INITIAL_MATRIX_ITEMS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);

  // Tab View: Multi-Location Matrix vs Quarantine Defect Flow
  const [inventoryTab, setInventoryTab] = useState<"MATRIX" | "QUARANTINE">("MATRIX");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [quarantineList, setQuarantineList] = useState<QuarantineItem[]>([
    {
      item_id: "sp-001",
      sku: "LCD-IPH-11",
      name: "LCD iPhone 11 Original OEM",
      category: "Sparepart",
      base_price: 650000,
      quarantine_qty: 3,
      location_id: "loc-q-001",
      location_name: "Gudang Karantina / Defect",
      total_defect_value: 1950000
    },
    {
      item_id: "sp-002",
      sku: "BAT-SAM-S21",
      name: "Baterai Samsung Galaxy S21 (4000mAh)",
      category: "Sparepart",
      base_price: 320000,
      quarantine_qty: 2,
      location_id: "loc-q-001",
      location_name: "Gudang Karantina / Defect",
      total_defect_value: 640000
    }
  ]);

  // Modal Transfer Stok
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    item_id: "",
    from_location_id: "",
    to_location_id: "",
    qty: 1,
    reason: "Distribusi stok operasional toko",
  });
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Modal Retur ke Supplier
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    item_id: "",
    supplier_name: "PT Sinar Sparepart Indonesia",
    qty: 1,
    reason: "Layar bergaris / Defect pabrik",
    return_price: 650000
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Modal Karantinakan Barang Rusak
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);
  const [quarantineForm, setQuarantineForm] = useState({
    item_id: "",
    from_location_id: "",
    qty: 1,
    notes: "Ditemukan retak saat unboxing toko"
  });
  const [isSubmittingQuarantine, setIsSubmittingQuarantine] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State Edit Harga & Channel Jual Fleksibel
  const [isEditPriceModalOpen, setIsEditPriceModalOpen] = useState(false);
  const [selectedItemForPrice, setSelectedItemForPrice] = useState<MatrixItem | null>(null);
  const [priceEditForm, setPriceEditForm] = useState({
    base_price: 100000,
    price_retail: 150000,
    price_reseller: 135000,
    price_technician: 125000,
    marketplace_sku: "",
    marketplace_fee_pct: 12,
  });
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  const handleOpenEditPrice = (item: MatrixItem) => {
    setSelectedItemForPrice(item);
    setPriceEditForm({
      base_price: item.base_price,
      price_retail: item.price_retail ?? Math.round(item.base_price * 1.3),
      price_reseller: item.price_reseller ?? Math.round(item.base_price * 1.15),
      price_technician: item.price_technician ?? Math.round(item.base_price * 1.1),
      marketplace_sku: item.marketplace_sku || item.sku,
      marketplace_fee_pct: 12,
    });
    setIsEditPriceModalOpen(true);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForPrice) return;
    try {
      setIsSavingPrice(true);
      const updated = await updateItemPrice(selectedItemForPrice.id, {
        base_price: Number(priceEditForm.base_price),
        price_retail: Number(priceEditForm.price_retail),
        price_reseller: Number(priceEditForm.price_reseller),
        price_technician: Number(priceEditForm.price_technician),
        marketplace_sku: priceEditForm.marketplace_sku || undefined,
      });

      setMatrixItems((prev) =>
        prev.map((it) =>
          it.id === selectedItemForPrice.id
            ? {
                ...it,
                base_price: updated.base_price,
                price_retail: updated.price_retail ?? Number(priceEditForm.price_retail),
                price_reseller: updated.price_reseller ?? Number(priceEditForm.price_reseller),
                price_technician: updated.price_technician ?? Number(priceEditForm.price_technician),
                marketplace_sku: updated.marketplace_sku ?? priceEditForm.marketplace_sku,
              }
            : it
        )
      );

      setIsEditPriceModalOpen(false);
      setPriceNotice(`✓ Harga "${selectedItemForPrice.name}" berhasil diperbarui! Retail: ${formatRupiah(priceEditForm.price_retail)}, Reseller: ${formatRupiah(priceEditForm.price_reseller)}`);
      setTimeout(() => setPriceNotice(null), 5000);
    } catch (err: any) {
      // In-memory update jika remote database offline
      setMatrixItems((prev) =>
        prev.map((it) =>
          it.id === selectedItemForPrice.id
            ? {
                ...it,
                base_price: Number(priceEditForm.base_price),
                price_retail: Number(priceEditForm.price_retail),
                price_reseller: Number(priceEditForm.price_reseller),
                price_technician: Number(priceEditForm.price_technician),
                marketplace_sku: priceEditForm.marketplace_sku,
              }
            : it
        )
      );
      setIsEditPriceModalOpen(false);
      setPriceNotice(`✓ Harga lokal "${selectedItemForPrice.name}" diperbarui: Retail ${formatRupiah(priceEditForm.price_retail)}.`);
      setTimeout(() => setPriceNotice(null), 5000);
    } finally {
      setIsSavingPrice(false);
    }
  };

  // 1. Fetch data lokasi & stok dari backend
  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    setIsLoading(true);
    try {
      const [backendLocations, backendStock, catalogItems, backendQuarantine] = await Promise.all([
        getLocations().catch(() => []),
        getStock().catch(() => []),
        getItems().catch(() => []),
        getQuarantineItems().catch(() => [])
      ]);

      if (backendLocations && backendLocations.length > 0) {
        setLocations(backendLocations);
      }

      if (backendQuarantine && backendQuarantine.length > 0) {
        setQuarantineList(backendQuarantine);
      }

      // Gabungkan stok per lokasi jika tersedia di backend
      if (backendStock && backendStock.length > 0) {
        const itemMap: { [itemId: string]: MatrixItem } = {};
        const catalogMap = new Map((catalogItems || []).map((ci: Item) => [ci.id, ci]));

        backendStock.forEach((st) => {
          if (!itemMap[st.item_id]) {
            const catItem = catalogMap.get(st.item_id);
            itemMap[st.item_id] = {
              id: st.item_id,
              sku: st.sku,
              marketplace_sku: catItem?.marketplace_sku,
              name: st.name,
              category: st.category || "Sparepart",
              base_price: st.base_price,
              price_retail: catItem?.price_retail ?? Math.round(st.base_price * 1.3),
              price_reseller: catItem?.price_reseller ?? Math.round(st.base_price * 1.15),
              price_technician: catItem?.price_technician ?? Math.round(st.base_price * 1.1),
              stocks: {},
            };
          }
          if (st.location_id) {
            itemMap[st.item_id].stocks[st.location_id] = st.on_hand;
          }
        });

        const combinedList = Object.values(itemMap);
        if (combinedList.length > 0) {
          setMatrixItems(combinedList);
        }
      }
    } catch (err) {
      console.warn("Menggunakan data matrix stok lokal");
    } finally {
      setIsLoading(false);
    }
  };

  // Kalkulasi ringkasan metrik per lokasi
  const locationSummaries = useMemo(() => {
    return locations.map((loc) => {
      let totalUnits = 0;
      let totalValuation = 0;
      let variantCount = 0;

      matrixItems.forEach((itm) => {
        const qty = itm.stocks[loc.id] || 0;
        if (qty > 0) {
          variantCount += 1;
          totalUnits += qty;
          totalValuation += qty * itm.base_price;
        }
      });

      return {
        ...loc,
        variantCount,
        totalUnits,
        totalValuation,
      };
    });
  }, [locations, matrixItems]);

  // Filter matrix stok forgiving (multi-token matching untuk nama, SKU, dan kategori)
  const filteredMatrix = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    return matrixItems.filter((itm) => {
      const matchesCat = selectedCategory === "All" || itm.category === selectedCategory;
      if (!matchesCat) return false;
      if (tokens.length === 0) return true;

      const searchCorpus = [itm.name, itm.sku, itm.category || ""].join(" ").toLowerCase();
      return tokens.every((token) => searchCorpus.includes(token));
    });
  }, [matrixItems, searchQuery, selectedCategory]);

  // Buka modal transfer untuk item tertentu
  const handleOpenTransferForItem = (item: MatrixItem) => {
    const locWh = locations.find((l) => l.type === "warehouse") || locations[0];
    const locStr = locations.find((l) => l.type === "store" && l.id !== locWh.id) || locations[1] || locations[0];

    setTransferForm({
      item_id: item.id,
      from_location_id: locWh ? locWh.id : "",
      to_location_id: locStr ? locStr.id : "",
      qty: 1,
      reason: "Distribusi stok dari gudang ke toko cabang",
    });
    setIsTransferModalOpen(true);
    setFeedbackMsg(null);
  };

  // Handler Submit Transfer Stok
  const handleProcessTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.from_location_id === transferForm.to_location_id) {
      setFeedbackMsg({ type: "error", text: "Lokasi asal dan lokasi tujuan tidak boleh sama!" });
      return;
    }

    if (transferForm.qty <= 0) {
      setFeedbackMsg({ type: "error", text: "Jumlah kuantitas transfer harus lebih besar dari 0!" });
      return;
    }

    const currentItem = matrixItems.find((i) => i.id === transferForm.item_id);
    const availableAtSource = currentItem?.stocks[transferForm.from_location_id] || 0;

    if (availableAtSource < transferForm.qty) {
      setFeedbackMsg({ 
        type: "error", 
        text: `Stok pada lokasi asal tidak mencukupi! Tersedia: ${availableAtSource} unit, diminta: ${transferForm.qty} unit.` 
      });
      return;
    }

    setIsSubmittingTransfer(true);
    setFeedbackMsg(null);

    try {
      try {
        await transferStock({
          item_id: transferForm.item_id,
          from_location_id: transferForm.from_location_id,
          to_location_id: transferForm.to_location_id,
          qty: Number(transferForm.qty),
          reason: transferForm.reason,
        });
      } catch (apiErr) {
        // Fallback update lokal jika offline
        console.log("Memperbarui matrix inventaris lokal");
      }

      // Update state matrix lokal
      setMatrixItems((prev) =>
        prev.map((item) => {
          if (item.id === transferForm.item_id) {
            const fromQty = (item.stocks[transferForm.from_location_id] || 0) - Number(transferForm.qty);
            const toQty = (item.stocks[transferForm.to_location_id] || 0) + Number(transferForm.qty);
            return {
              ...item,
              stocks: {
                ...item.stocks,
                [transferForm.from_location_id]: Math.max(0, fromQty),
                [transferForm.to_location_id]: toQty,
              },
            };
          }
          return item;
        })
      );

      const fromName = locations.find((l) => l.id === transferForm.from_location_id)?.name || "Lokasi Asal";
      const toName = locations.find((l) => l.id === transferForm.to_location_id)?.name || "Lokasi Tujuan";

      setIsTransferModalOpen(false);
      setFeedbackMsg({ 
        type: "success", 
        text: `Berhasil mentransfer ${transferForm.qty} unit '${currentItem?.name}' dari ${fromName} ke ${toName}!` 
      });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal memproses mutasi transfer stok." });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.item_id || returnForm.qty <= 0) return;

    setIsSubmittingReturn(true);
    try {
      const res = await returnToSupplier({
        item_id: returnForm.item_id,
        supplier_name: returnForm.supplier_name,
        qty: Number(returnForm.qty),
        return_price: Number(returnForm.return_price),
        reason: returnForm.reason
      });

      // Update local quarantine list
      setQuarantineList((prev) =>
        prev
          .map((q) => q.item_id === returnForm.item_id ? { ...q, quarantine_qty: res.remaining_quarantine_stock, total_defect_value: res.remaining_quarantine_stock * q.base_price } : q)
          .filter((q) => q.quarantine_qty > 0)
      );

      setIsReturnModalOpen(false);
      setFeedbackMsg({
        type: "success",
        text: `✓ ${res.message} Akuntansi: Hutang Usaha (AP) berhasil dikurangi Rp ${res.total_return_value.toLocaleString("id-ID")}.`
      });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal memproses retur ke supplier." });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleQuarantineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarantineForm.item_id || !quarantineForm.from_location_id || quarantineForm.qty <= 0) return;

    setIsSubmittingQuarantine(true);
    try {
      await transferToQuarantine({
        item_id: quarantineForm.item_id,
        from_location_id: quarantineForm.from_location_id,
        qty: Number(quarantineForm.qty),
        notes: quarantineForm.notes
      });

      // Refresh data
      await fetchInventoryData();

      setIsQuarantineModalOpen(false);
      setFeedbackMsg({
        type: "success",
        text: `✓ Berhasil memindahkan ${quarantineForm.qty} unit barang rusak ke Gudang Karantina / Defect.`
      });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Gagal memindahkan barang ke karantina." });
    } finally {
      setIsSubmittingQuarantine(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Multi-Location Engine
            </span>
            <span className="text-xs text-gray-400 font-mono">1 Gudang Pusat + 2 Toko Cabang</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Warehouse className="w-6 h-6 text-purple-400" />
            Manajemen Stok & Multi-Lokasi
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Pemantauan posisi stok real-time antar cabang dan mutasi transfer barang dengan immutable stock ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchInventoryData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] text-gray-400 hover:text-white transition-colors"
            title="Muat Ulang Stok"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          </button>

          <Link
            href="/inventory/grn"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/40 transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Penerimaan GRN</span>
          </Link>

          <button
            onClick={() => {
              const defaultItem = matrixItems[0];
              const locWh = locations.find((l) => l.type === "warehouse") || locations[0];
              setQuarantineForm({
                item_id: defaultItem ? defaultItem.id : "",
                from_location_id: locWh ? locWh.id : "",
                qty: 1,
                notes: "Ditemukan defect saat pengecekan fisik toko"
              });
              setIsQuarantineModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>+ Karantina Defect</span>
          </button>

          <button
            onClick={() => {
              const firstQ = quarantineList[0];
              const firstItem = matrixItems[0];
              setReturnForm({
                item_id: firstQ ? firstQ.item_id : firstItem?.id || "",
                supplier_name: "PT Sinar Sparepart Indonesia",
                qty: firstQ ? firstQ.quarantine_qty : 1,
                reason: "Defect pabrik / Layar bergaris",
                return_price: firstQ ? firstQ.base_price : 100000
              });
              setIsReturnModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-semibold text-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span>↩️ Retur Supplier</span>
          </button>

          <Link
            href="/reports"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition-colors"
            title="Buka modul pelunasan hutang supplier (AP Settlement) di Laporan Keuangan"
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>Bayar Hutang (AP)</span>
          </Link>

          <a
            href="/import"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] border border-[#333] text-gray-200 font-semibold text-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>Import KetoKo</span>
          </a>

          <button
            onClick={() => {
              const defaultItem = matrixItems[0];
              const locWh = locations.find((l) => l.type === "warehouse") || locations[0];
              const locStr = locations.find((l) => l.type === "store" && l.id !== locWh.id) || locations[1] || locations[0];
              setTransferForm({
                item_id: defaultItem ? defaultItem.id : "",
                from_location_id: locWh ? locWh.id : "",
                to_location_id: locStr ? locStr.id : "",
                qty: 1,
                reason: "Transfer distribusi stok cabang",
              });
              setIsTransferModalOpen(true);
              setFeedbackMsg(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/30"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>+ Transfer Cabang</span>
          </button>
        </div>
      </div>

      {priceNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{priceNotice}</span>
          </div>
          <button onClick={() => setPriceNotice(null)} className="text-emerald-400 font-bold px-2">✕</button>
        </div>
      )}

      {/* Sub-Tabs: Multi-Location Matrix vs Quarantine Defect */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
        <button
          onClick={() => setInventoryTab("MATRIX")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            inventoryTab === "MATRIX"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-[#181818] text-gray-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stok Multi-Lokasi (Gudang & Toko)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#252525] text-gray-300">
            {matrixItems.length}
          </span>
        </button>

        <button
          onClick={() => setInventoryTab("QUARANTINE")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            inventoryTab === "QUARANTINE"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
              : "bg-[#181818] text-amber-400 hover:text-white hover:bg-[#222]"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Barang Defect / Karantina (Quarantine Flow)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold">
            {quarantineList.reduce((sum, q) => sum + q.quarantine_qty, 0)} pcs
          </span>
        </button>
      </div>

      {/* Banner Parallel Run & KetoKo Validation */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Mode Parallel Run Aktif:</strong> Laporan stok dan kartu mutasi di Nexus OS berfungsi sebagai pembanding independen terhadap sistem KetoKo. Data transaksi terisolasi dan siap dipetakan ke TikTok Shop via <code>marketplace_sku</code>.
          </span>
        </div>
        <a href="/import" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline shrink-0">
          Upload Export KetoKo →
        </a>
      </div>

      {/* Alert Feedback */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
          feedbackMsg.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          KONTEN TAB 1: STOK MULTI-LOKASI MATRIX
          ===================================================================== */}
      {inventoryTab === "MATRIX" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {locationSummaries.map((loc) => {
          const isWarehouse = loc.type === "warehouse";

          return (
            <div
              key={loc.id}
              className={`p-5 rounded-2xl bg-[#141414] border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                isWarehouse 
                  ? "border-purple-500/40 bg-gradient-to-br from-[#141414] to-purple-950/15 shadow-lg shadow-purple-500/5" 
                  : "border-[#262626] hover:border-[#333]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isWarehouse 
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" 
                        : "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    }`}>
                      {isWarehouse ? <Warehouse className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{loc.name}</h3>
                      <p className="text-[10px] text-gray-400 capitalize">{isWarehouse ? "Buffer Stok Utama" : "Counter Servis & Retail"}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isWarehouse 
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/30" 
                      : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  }`}>
                    {isWarehouse ? "Gudang" : "Toko"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#222] text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase">Total Unit Fisik:</span>
                    <p className="text-xl font-bold font-mono text-white mt-0.5">{loc.totalUnits} <span className="text-xs text-gray-500 font-normal">pcs</span></p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase">Varian Item:</span>
                    <p className="text-xl font-bold font-mono text-purple-300 mt-0.5">{loc.variantCount} <span className="text-xs text-gray-500 font-normal">SKU</span></p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between text-xs">
                <span className="text-gray-400 text-[11px]">Nilai Valuasi Aset:</span>
                <span className="font-mono font-bold text-emerald-400">{formatRupiah(loc.totalValuation)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================================
          BAGIAN TENGAH: TABEL STOK MULTI-LOKASI MATRIX
          ===================================================================== */}
      <div className="bg-[#141414] rounded-2xl border border-[#262626] p-5 space-y-4">
        {/* Kontrol Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari sparepart, LCD, baterai, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 bg-[#1c1c1c] p-1 rounded-xl border border-[#2e2e2e] overflow-x-auto">
              {(["All", "Sparepart", "Aksesoris"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-gray-400 hover:text-white hover:bg-[#252525]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Toggle Tampilan Grid / List */}
            <div className="flex items-center gap-1 bg-[#1c1c1c] p-1 rounded-xl border border-[#2e2e2e]">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-[#252525]"
                }`}
                title="Tampilan Tabel (List View)"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-[#252525]"
                }`}
                title="Tampilan Kartu (Grid View)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* TAMPILAN 1: TABEL DATA MATRIX (LIST VIEW) */}
        {viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181818] text-gray-400 font-mono text-[11px] border-b border-[#262626]">
                <tr>
                  <th className="py-3 px-3.5 rounded-l-lg">Produk & SKU</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Harga Satuan</th>
                  {locations.map((loc) => (
                    <th key={loc.id} className="py-3 px-3 text-center">
                      {loc.name.split(" ")[0]} {loc.name.split(" ")[1] || ""}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center">Total Stok</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right rounded-r-lg">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#222]">
                {filteredMatrix.map((item) => {
                  const totalStock = Object.values(item.stocks).reduce((sum, q) => sum + (q || 0), 0);
                  const isLow = totalStock < 10 && totalStock > 0;
                  const isOutOfStock = totalStock === 0;

                  return (
                    <tr key={item.id} className="hover:bg-[#1a1a1a] transition-colors group">
                      <td className="py-3 px-3.5">
                        <p className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-[10px] font-mono text-gray-400">{item.sku}</p>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#222] text-gray-300 border border-[#303030]">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                            <span>{formatRupiah(item.price_retail || Math.round(item.base_price * 1.3))}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-sans font-normal">Retail</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                            <span>HPP: {formatRupiah(item.base_price)}</span>
                            <span>•</span>
                            <span className="text-blue-300">Grosir: {formatRupiah(item.price_reseller || Math.round(item.base_price * 1.15))}</span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom Stok Tiap Lokasi */}
                      {locations.map((loc) => {
                        const qty = item.stocks[loc.id] || 0;
                        return (
                          <td key={loc.id} className="py-3 px-3 text-center font-mono">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                              qty === 0 
                                ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                                : qty <= 3 
                                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" 
                                : "bg-[#222] text-white border border-[#2e2e2e]"
                            }`}>
                              {qty}
                            </span>
                          </td>
                        );
                      })}

                      {/* Total Stok Seluruh Lokasi */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-sm text-purple-300">
                          {totalStock}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          isOutOfStock
                            ? "bg-red-500/20 text-red-300 border-red-500/30"
                            : isLow
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        }`}>
                          {isOutOfStock ? "Habis" : isLow ? "Menipis" : "Aman"}
                        </span>
                      </td>

                      {/* Tombol Mutasi & Edit Harga */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPrice(item)}
                            className="px-2 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-medium text-xs transition-all flex items-center gap-1 border border-emerald-500/30"
                            title="Atur harga modal, retail, reseller, teknisi, & marketplace"
                          >
                            <Tag className="w-3 h-3" />
                            <span>Edit Harga</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTransferForItem(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white font-medium text-xs transition-all flex items-center gap-1.5 border border-purple-500/30"
                            title="Transfer item ini antar lokasi"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Transfer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredMatrix.length === 0 && (
              <div className="h-44 flex flex-col items-center justify-center text-center text-gray-500">
                <Boxes className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Tidak ada item yang sesuai dengan pencarian.</p>
              </div>
            )}
          </div>
        ) : (
          /* TAMPILAN 2: KARTU GRID (GRID VIEW) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatrix.map((item) => {
              const totalStock = Object.values(item.stocks).reduce((sum, q) => sum + (q || 0), 0);
              const isLow = totalStock < 10 && totalStock > 0;
              const isOutOfStock = totalStock === 0;

              return (
                <div 
                  key={item.id} 
                  className="bg-[#181818] border border-[#282828] hover:border-purple-500/40 rounded-2xl p-4.5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-purple-950/20 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222] text-gray-300 border border-[#333]">
                          {item.sku}
                        </span>
                        <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors mt-1.5">
                          {item.name}
                        </h4>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0 ${
                        isOutOfStock
                          ? "bg-red-500/20 text-red-300 border-red-500/30"
                          : isLow
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}>
                        {isOutOfStock ? "Habis" : isLow ? "Menipis" : "Aman"}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-[#242424] space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-gray-400">Harga Retail Offline:</span>
                        <span className="font-mono text-sm font-bold text-white">
                          {formatRupiah(item.price_retail || Math.round(item.base_price * 1.3))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>Modal (HPP): {formatRupiah(item.base_price)}</span>
                        <span className="text-blue-300">Grosir: {formatRupiah(item.price_reseller || Math.round(item.base_price * 1.15))}</span>
                      </div>
                    </div>

                    {/* Breakdown Stok per Lokasi */}
                    <div className="space-y-1.5 bg-[#121212] p-2.5 rounded-xl border border-[#222]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
                        <span>Sebaran Lokasi</span>
                        <span className="text-purple-300 font-mono">Total: {totalStock} pcs</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {locations.map((loc) => {
                          const qty = item.stocks[loc.id] || 0;
                          return (
                            <div key={loc.id} className="text-center p-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                              <p className="text-[9px] text-gray-400 truncate">{loc.name.split(" ")[0]}</p>
                              <p className={`font-mono text-xs font-bold mt-0.5 ${
                                qty === 0 ? "text-red-400" : qty <= 3 ? "text-amber-300" : "text-white"
                              }`}>
                                {qty}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Transfer & Edit Harga */}
                  <div className="pt-3 mt-3 border-t border-[#242424] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPrice(item)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-emerald-500/30"
                      title="Atur harga jual multi-tier & e-commerce"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Edit Harga</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenTransferForItem(item)}
                      className="flex-1 py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-purple-500/30"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transfer</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMatrix.length === 0 && (
              <div className="col-span-full h-44 flex flex-col items-center justify-center text-center text-gray-500">
                <Boxes className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Tidak ada item yang sesuai dengan pencarian.</p>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* =====================================================================
          KONTEN TAB 2: BARANG DEFECT & KARANTINA (QUARANTINE FLOW)
          ===================================================================== */}
      {inventoryTab === "QUARANTINE" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#141414] border border-amber-500/30">
              <span className="text-[10px] text-amber-400 uppercase font-semibold block">TOTAL BARANG DI KARANTINA</span>
              <p className="text-2xl font-bold font-mono text-amber-300 mt-1">
                {quarantineList.reduce((sum, q) => sum + q.quarantine_qty, 0)} <span className="text-xs font-normal">pcs</span>
              </p>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Menunggu klaim atau retur ke supplier</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-rose-500/30">
              <span className="text-[10px] text-rose-400 uppercase font-semibold block">TOTAL VALUASI DEFECT KLAIM</span>
              <p className="text-2xl font-bold font-mono text-rose-300 mt-1">
                {formatRupiah(quarantineList.reduce((sum, q) => sum + q.total_defect_value, 0))}
              </p>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Potensi pemotongan Hutang Usaha (AP)</span>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">PROSES RETUR CEPAT</span>
                <p className="text-xs text-gray-300 mt-1">Kembalikan barang rusak ke supplier pengirim.</p>
              </div>
              <button
                onClick={() => {
                  const firstQ = quarantineList[0];
                  if (firstQ) {
                    setReturnForm({
                      item_id: firstQ.item_id,
                      supplier_name: "PT Sinar Sparepart Indonesia",
                      qty: firstQ.quarantine_qty,
                      reason: "Layar bergaris / Defect pabrik",
                      return_price: firstQ.base_price
                    });
                    setIsReturnModalOpen(true);
                  }
                }}
                disabled={quarantineList.length === 0}
                className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retur Semua
              </button>
            </div>
          </div>

          <div className="bg-[#141414] rounded-2xl border border-amber-500/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Daftar Barang Defect / Rusak di Gudang Karantina
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Barang di lokasi karantina dipisahkan dari stok siap jual untuk mencegah kasir menjual barang cacat.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#262626] text-gray-400 uppercase font-semibold">
                    <th className="pb-3">SKU & Nama Barang</th>
                    <th className="pb-3">Kategori</th>
                    <th className="pb-3 text-center">Lokasi Karantina</th>
                    <th className="pb-3 text-right">HPP Satuan</th>
                    <th className="pb-3 text-center text-amber-400">Qty Defect</th>
                    <th className="pb-3 text-right text-rose-300">Total Nilai Defect</th>
                    <th className="pb-3 text-right">Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202020]">
                  {quarantineList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Tidak ada barang di gudang karantina (Semua stok dalam kondisi normal).
                      </td>
                    </tr>
                  ) : (
                    quarantineList.map((q) => (
                      <tr key={q.item_id} className="hover:bg-[#1a1a1a] transition">
                        <td className="py-3">
                          <div className="font-semibold text-white">{q.name}</div>
                          <div className="font-mono text-[10px] text-gray-500">{q.sku}</div>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                            {q.category}
                          </span>
                        </td>
                        <td className="py-3 text-center font-mono text-gray-400">{q.location_name}</td>
                        <td className="py-3 text-right font-mono text-gray-300">{formatRupiah(q.base_price)}</td>
                        <td className="py-3 text-center font-mono font-bold text-amber-400">
                          {q.quarantine_qty} pcs
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-rose-300">
                          {formatRupiah(q.total_defect_value)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              setReturnForm({
                                item_id: q.item_id,
                                supplier_name: "PT Sinar Sparepart Indonesia",
                                qty: q.quarantine_qty,
                                reason: "Defect pabrik / Tidak berfungsi",
                                return_price: q.base_price
                              });
                              setIsReturnModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/60 border border-rose-500/40 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 ml-auto"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Proses Retur Supplier</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL TRANSFER STOK ANTAR LOKASI
          ===================================================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Mutasi Transfer Stok</h3>
                  <p className="text-[10px] text-gray-400">Pindahkan stok fisik antar gudang atau toko cabang</p>
                </div>
              </div>

              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessTransfer} className="space-y-3.5 text-xs">
              {/* Pilihan Produk */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Pilih Produk / Sparepart *
                </label>
                <select
                  value={transferForm.item_id}
                  onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  required
                >
                  <option value="" disabled>-- Pilih Barang --</option>
                  {matrixItems.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.name} ({itm.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rute Transfer: Dari Lokasi -> Ke Lokasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Dari Lokasi (Asal) *
                  </label>
                  <select
                    value={transferForm.from_location_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_location_id: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                    required
                  >
                    {locations.map((loc) => {
                      const currentItem = matrixItems.find((i) => i.id === transferForm.item_id);
                      const currentStock = currentItem?.stocks[loc.id] || 0;
                      return (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} (Tersedia: {currentStock} unit)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Ke Lokasi (Tujuan) *
                  </label>
                  <select
                    value={transferForm.to_location_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_location_id: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kuantitas Transfer */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Jumlah yang Ditransfer (Unit) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferForm.qty}
                  onChange={(e) => setTransferForm({ ...transferForm, qty: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Memo Alasan Mutasi */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Catatan / Memo Mutasi
                </label>
                <input
                  type="text"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="Contoh: Pengisian display counter atau permintaan teknisi"
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Tombol Konfirmasi */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#222]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingTransfer ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses Transfer...</span>
                    </>
                  ) : (
                    <>
                      <span>Proses Transfer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =====================================================================
          MODAL RETUR BARANG DEFECT KE SUPPLIER
          ===================================================================== */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-rose-500/40 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Retur Barang Defect ke Supplier</h3>
                  <p className="text-[10px] text-gray-400">Pengembalian barang rusak & pemotongan Hutang Usaha (AP)</p>
                </div>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Nama Supplier Tujuan *
                </label>
                <input
                  type="text"
                  value={returnForm.supplier_name}
                  onChange={(e) => setReturnForm({ ...returnForm, supplier_name: e.target.value })}
                  required
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Pilih Barang Defect yang Diretur *
                </label>
                <select
                  value={returnForm.item_id}
                  onChange={(e) => {
                    const sel = matrixItems.find(it => it.id === e.target.value) || quarantineList.find(q => q.item_id === e.target.value);
                    setReturnForm({
                      ...returnForm,
                      item_id: e.target.value,
                      return_price: sel ? (sel as any).base_price : 100000
                    });
                  }}
                  required
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                >
                  <option value="" disabled>-- Pilih Barang --</option>
                  {quarantineList.map((q) => (
                    <option key={q.item_id} value={q.item_id}>
                      {q.name} ({q.sku}) • Tersedia di Karantina: {q.quarantine_qty} pcs
                    </option>
                  ))}
                  {matrixItems.filter(it => !quarantineList.some(q => q.item_id === it.id)).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Jumlah Retur (Unit) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={returnForm.qty}
                    onChange={(e) => setReturnForm({ ...returnForm, qty: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Harga Retur Satuan (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={returnForm.return_price}
                    onChange={(e) => setReturnForm({ ...returnForm, return_price: Math.max(0, Number(e.target.value)) })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Alasan Retur Supplier *
                </label>
                <input
                  type="text"
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  placeholder="Contoh: Flek hitam pada LCD / Tidak mengisi daya"
                  required
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Accounting Impact Preview */}
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-[11px] text-rose-300 space-y-1">
                <span className="font-semibold block text-white">Dampak Akuntansi Otomatis:</span>
                <div>• Total Potongan Hutang: <strong>{formatRupiah(returnForm.qty * (returnForm.return_price || 0))}</strong></div>
                <div className="text-[10px] text-gray-400">Jurnal: DEBIT Hutang Usaha (2000) • KREDIT Persediaan (1200)</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-900/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingReturn ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Konfirmasi Retur Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL KARANTINAKAN BARANG DEFECT DARI CABANG
          ===================================================================== */}
      {isQuarantineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Karantinakan Barang Cacat / Rusak</h3>
                  <p className="text-[10px] text-gray-400">Pindahkan stok cacat dari display/toko ke Gudang Karantina</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuarantineModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuarantineSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Pilih Produk Rusak *
                </label>
                <select
                  value={quarantineForm.item_id}
                  onChange={(e) => setQuarantineForm({ ...quarantineForm, item_id: e.target.value })}
                  required
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="" disabled>-- Pilih Barang --</option>
                  {matrixItems.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.name} ({itm.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Lokasi Asal Barang Rusak *
                  </label>
                  <select
                    value={quarantineForm.from_location_id}
                    onChange={(e) => setQuarantineForm({ ...quarantineForm, from_location_id: e.target.value })}
                    required
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                    Kuantitas Defect (Unit) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quarantineForm.qty}
                    onChange={(e) => setQuarantineForm({ ...quarantineForm, qty: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                  Keterangan Kendala / Kerusakan Fisik *
                </label>
                <input
                  type="text"
                  value={quarantineForm.notes}
                  onChange={(e) => setQuarantineForm({ ...quarantineForm, notes: e.target.value })}
                  placeholder="Contoh: Retak saat unboxing pengiriman ekspedisi"
                  required
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsQuarantineModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuarantine}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-900/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingQuarantine ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>Pindahkan ke Karantina</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT HARGA & MULTI-CHANNEL PRICING MATRIX
          ===================================================================== */}
      {isEditPriceModalOpen && selectedItemForPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#333] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsEditPriceModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#282828]">
              <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">{selectedItemForPrice.name}</h3>
                <p className="text-xs text-gray-400 font-mono">
                  SKU: {selectedItemForPrice.sku} • Kategori: {selectedItemForPrice.category}
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* 1. HARGA POKOK / HPP SUPPLIER */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300">
                    1. Harga Modal Supplier (HPP / Base Price) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">Moving Average Cost</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500">Rp</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={priceEditForm.base_price}
                    onChange={(e) => setPriceEditForm({ ...priceEditForm, base_price: Number(e.target.value) })}
                    className="w-full bg-[#1b1b1b] border border-[#333] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  Harga beli pokok dari vendor/supplier sebagai dasar kalkulasi margin keuntungan.
                </p>
              </div>

              {/* 2. TIER HARGA OFFLINE TOKO (RETAIL, RESELLER, TEKNISI) */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    2. Harga Jual Toko Offline (Multi-Tier)
                  </label>
                  <span className="text-[10px] text-gray-400">Kasir POS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Retail */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 block">
                      Retail (Umum)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={priceEditForm.price_retail}
                      onChange={(e) => setPriceEditForm({ ...priceEditForm, price_retail: Number(e.target.value) })}
                      className="w-full bg-[#1b1b1b] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-[9px] text-emerald-400 block font-mono">
                      Margin: +{formatRupiah(Math.max(0, priceEditForm.price_retail - priceEditForm.base_price))}
                    </span>
                  </div>

                  {/* Reseller */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 block">
                      Reseller (Grosir)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={priceEditForm.price_reseller}
                      onChange={(e) => setPriceEditForm({ ...priceEditForm, price_reseller: Number(e.target.value) })}
                      className="w-full bg-[#1b1b1b] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-[9px] text-blue-300 block font-mono">
                      Margin: +{formatRupiah(Math.max(0, priceEditForm.price_reseller - priceEditForm.base_price))}
                    </span>
                  </div>

                  {/* Teknisi */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 block">
                      Teknisi / Mitra
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={priceEditForm.price_technician}
                      onChange={(e) => setPriceEditForm({ ...priceEditForm, price_technician: Number(e.target.value) })}
                      className="w-full bg-[#1b1b1b] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-[9px] text-purple-300 block font-mono">
                      Margin: +{formatRupiah(Math.max(0, priceEditForm.price_technician - priceEditForm.base_price))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. MULTI-CHANNEL E-COMMERCE & MARKUP FEE KALKULATOR */}
              <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    3. Penjualan Online E-Commerce (Shopee / TikTok)
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Marketplace Sync
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      SKU Marketplace / Toko Online
                    </label>
                    <input
                      type="text"
                      value={priceEditForm.marketplace_sku}
                      onChange={(e) => setPriceEditForm({ ...priceEditForm, marketplace_sku: e.target.value })}
                      placeholder="Contoh: SHP-LCD-IP11"
                      className="w-full bg-[#1b1b1b] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      Estimasi Potongan Admin Fee (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={priceEditForm.marketplace_fee_pct}
                        onChange={(e) => setPriceEditForm({ ...priceEditForm, marketplace_fee_pct: Number(e.target.value) })}
                        className="w-20 bg-[#1b1b1b] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none text-center"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#181818] border border-[#2b2b2b] text-[11px] text-gray-400 flex items-center justify-between">
                  <span>
                    Harga E-Commerce yang disarankan (+{priceEditForm.marketplace_fee_pct}% Fee):
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-xs">
                    {formatRupiah(Math.round((priceEditForm.price_retail * (1 + priceEditForm.marketplace_fee_pct / 100)) / 1000) * 1000)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditPriceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5"
                >
                  {isSavingPrice ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Perubahan Harga</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
