"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
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
  RefreshCw, 
  Users, 
  CreditCard, 
  Wallet, 
  QrCode, 
  Building2, 
  X, 
  Receipt, 
  ShieldCheck, 
  Percent,
  Wifi,
  WifiOff,
  RotateCw,
  History,
  CloudOff,
  Lock,
  Unlock,
  Coins,
  DollarSign,
  LayoutGrid,
  LayoutList,
  Barcode,
  ChevronDown,
  Check,
  UserCheck,
  UserPlus,
  User
} from "lucide-react";
import { 
  getActiveBusinessPreset, 
  setActiveBusinessPreset, 
  BUSINESS_PRESETS, 
  BusinessType, 
  BusinessPresetConfig 
} from "@/lib/tenant-preset";
import { 
  formatRupiah, 
  createOrder, 
  getItems, 
  Item,
  getCustomers,
  createCustomer,
  Customer,
  getCurrentShift,
  openShift,
  closeShift,
  ShiftResponse,
  fetchTeamMembers,
  verifyStaffPin,
  TeamMemberAPI
} from "@/lib/api";
import {
  getActiveStaff,
  setActiveStaff,
  StaffMember,
  ROLE_LABELS,
  ROLE_BADGE_COLORS
} from "@/lib/rbac";
import ReceiptModal, { ReceiptData } from "@/components/ReceiptModal";
import { 
  db, 
  saveLocalCart, 
  clearLocalCart, 
  enqueuePendingTransaction, 
  PricingTier 
} from "@/lib/db";
import { 
  syncPendingTransactions, 
  registerAutoSyncEngine 
} from "@/lib/sync-engine";

// Data dummy produk & jasa multi-industri (Retail, Bengkel, HVAC, Gadget, Fashion, E-Com)
const DEMO_ITEMS: (Item & { category: string; stock: number })[] = [
  // 1. RETAIL & KELONTONG UMUM
  {
    id: "ret-001",
    sku: "KOPI-ARB-250G",
    name: "Kopi Arabika Gayo Specialty Roast 250g",
    item_type: "stocked",
    category: "Makanan & Minuman",
    base_price: 65000,
    price_retail: 65000,
    price_reseller: 58000,
    price_technician: 55000,
    stock: 24,
    attributes: { origin: "Aceh Gayo", roast: "Medium" },
    active: true,
  },
  {
    id: "ret-002",
    sku: "MINYAK-GRG-2L",
    name: "Minyak Goreng Kelapa Sawit Pouch 2 Liter",
    item_type: "stocked",
    category: "Kebutuhan Pokok",
    base_price: 34000,
    price_retail: 34000,
    price_reseller: 32000,
    price_technician: 31000,
    stock: 50,
    attributes: { volume: "2 Liter", brand: "Bimoli" },
    active: true,
  },
  // 2. BENGKEL MOTOR & MOBIL
  {
    id: "bgk-001",
    sku: "OLI-SHL-10W40",
    name: "Oli Mesin Shell Advance AX7 10W-40 4T 0.8L Semi Sintetis",
    item_type: "stocked",
    category: "Oli & Pelumas",
    base_price: 58000,
    price_retail: 58000,
    price_reseller: 52000,
    price_technician: 49000,
    stock: 18,
    attributes: { viscosity: "10W-40", volume: "0.8L" },
    active: true,
  },
  {
    id: "bgk-002",
    sku: "KAMPAS-REM-VARIO",
    name: "Kampas Rem Depan Honda Vario 125/150 Original AHM Non-Asbestos",
    item_type: "stocked",
    category: "Pengereman",
    base_price: 45000,
    price_retail: 45000,
    price_reseller: 40000,
    price_technician: 37000,
    stock: 15,
    attributes: { part_number: "06455-K59-A71", type: "Depan" },
    active: true,
  },
  {
    id: "bgk-srv-01",
    sku: "SRV-TUNE-UP",
    name: "Jasa Servis Ringan / Tune Up Injeksi & Reset ECU Motor",
    item_type: "service",
    category: "Jasa Servis",
    base_price: 60000,
    price_retail: 60000,
    price_reseller: 55000,
    price_technician: 50000,
    stock: 999,
    attributes: { duration_minutes: 30 },
    active: true,
  },
  // 3. HVAC & SERVIS AC
  {
    id: "hvac-001",
    sku: "FREON-R32-3KG",
    name: "Gas Freon R32 Original Tabung 3 Kg Refrigerant",
    item_type: "stocked",
    category: "Gas Freon",
    base_price: 185000,
    price_retail: 185000,
    price_reseller: 165000,
    price_technician: 155000,
    stock: 10,
    attributes: { gas: "R32", purity: "99.9%" },
    active: true,
  },
  {
    id: "hvac-002",
    sku: "PIPA-AC-TMBG",
    name: "Pipa Tembaga AC Saeki 1/4 + 3/8 Inch Ketebalan 0.61mm (per Meter)",
    item_type: "stocked",
    category: "Pipa & Isolasi",
    base_price: 48000,
    price_retail: 48000,
    price_reseller: 44000,
    price_technician: 41000,
    stock: 80,
    attributes: { spec: "1/4 + 3/8", thick: "0.61mm" },
    active: true,
  },
  {
    id: "hvac-srv-01",
    sku: "SRV-CUCI-AC",
    name: "Jasa Cuci Steam AC Split 0.5 - 2 PK Standard & Desinfektan",
    item_type: "service",
    category: "Jasa Cuci & Pasang",
    base_price: 75000,
    price_retail: 75000,
    price_reseller: 70000,
    price_technician: 65000,
    stock: 999,
    attributes: { duration_minutes: 45 },
    active: true,
  },
  // 4. GADGET & SPAREPART HP
  {
    id: "sp-001",
    sku: "LCD-IPH-11",
    name: "LCD iPhone 11 Original OEM Assembly Display TrueTone",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 650000,
    price_retail: 650000,
    price_reseller: 585000,
    price_technician: 550000,
    stock: 12,
    attributes: { brand: "Apple", warranty: "1 Bulan" },
    active: true,
  },
  {
    id: "sp-005",
    sku: "LCD-IPH-13PRO",
    name: "LCD Touchscreen iPhone 13 Pro Fullset OLED 120Hz ProMotion Original Assembly",
    item_type: "stocked",
    category: "Sparepart",
    base_price: 1850000,
    price_retail: 1850000,
    price_reseller: 1650000,
    price_technician: 1550000,
    stock: 0,
    attributes: { brand: "Apple", warranty: "1 Bulan" },
    active: true,
  },
  {
    id: "acc-001",
    sku: "CASE-MAG-CLR",
    name: "Casing MagSafe Armor Clear Hybrid Shockproof",
    item_type: "stocked",
    category: "Aksesoris",
    base_price: 75000,
    price_retail: 75000,
    price_reseller: 65000,
    price_technician: 60000,
    stock: 40,
    attributes: { material: "TPU + Polycarbonate" },
    active: true,
  },
  {
    id: "srv-001",
    sku: "SRV-INST-LCD",
    name: "Jasa Pasang / Ganti LCD & Kalibrasi Touchscreen",
    item_type: "service",
    category: "Jasa Service",
    base_price: 100000,
    price_retail: 100000,
    price_reseller: 90000,
    price_technician: 75000,
    stock: 999,
    attributes: { duration_minutes: 45 },
    active: true,
  },
  // 5. FASHION & SELLER ONLINE
  {
    id: "fas-001",
    sku: "TSHIRT-CTN-BLK-L",
    name: "Kaos Polos Heavyweight Cotton Combed 24s Hitam Size L",
    item_type: "stocked",
    category: "Atasan / Baju",
    base_price: 55000,
    price_retail: 55000,
    price_reseller: 48000,
    price_technician: 45000,
    stock: 35,
    attributes: { size: "L", color: "Jet Black" },
    active: true,
  },
];

interface CartItem {
  item: Item & { category: string; stock: number };
  qty: number;
}

interface SplitPaymentLine {
  payment_method: "CASH" | "QRIS" | "TRANSFER";
  amount: number;
}

// Fungsi helper menghitung harga item berdasarkan tier pelanggan yang aktif
function getItemPrice(item: Item, tier: PricingTier): number {
  if (tier === "reseller") {
    return item.price_reseller ?? Math.round(item.base_price * 0.90);
  }
  if (tier === "technician") {
    return item.price_technician ?? Math.round(item.base_price * 0.85);
  }
  return item.price_retail ?? item.base_price;
}

// Pelanggan default bawaan sistem untuk checkout kasir cerdas & auto-tiering
const DEFAULT_POS_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    name: "Budi Santoso (Toko Berkah)",
    phone: "081234567890",
    tier: "reseller",
    address: "Jl. Hayam Wuruk No. 12, Jakarta",
    total_spent: 45000000,
    total_orders: 28,
    rfm_segment: "Champions",
    devices: [],
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
    rfm_segment: "Champions",
    devices: [],
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
    rfm_segment: "Promising / New",
    devices: [],
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
    rfm_segment: "Loyal Customers",
    devices: [],
    created_at: "2024-04-05T11:15:00Z"
  }
];

export default function POSPage() {
  const [itemsList, setItemsList] = useState(DEMO_ITEMS);

  // State Preset Bisnis Aktif & Modal Pemilih (Universal Multi-Tenant)
  const [activePreset, setActivePreset] = useState<BusinessPresetConfig>(() => getActiveBusinessPreset());
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  const [selectedTab, setSelectedTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Handler Ganti Preset Bisnis (Memancarkan event global ke seluruh app)
  const handleSelectPreset = (pId: BusinessType) => {
    const chosen = setActiveBusinessPreset(pId);
    setActivePreset(chosen);
    setSelectedTab("All");
    setIsPresetModalOpen(false);
    setSyncingNotice(`✓ Berhasil mengubah profil bisnis: ${chosen.name}`);
    setTimeout(() => setSyncingNotice(null), 3500);
  };

  useEffect(() => {
    const handlePresetChange = (e: any) => {
      if (e.detail) {
        setActivePreset(e.detail);
        setSelectedTab("All");
      }
    };
    window.addEventListener("nexus_preset_changed", handlePresetChange);
    return () => window.removeEventListener("nexus_preset_changed", handlePresetChange);
  }, []);
  
  // ===========================================================================
  // 1. DEXIE.JS OFFLINE-FIRST STATE MANAGEMENT (IndexedDB)
  // ===========================================================================
  const liveCartRecord = useLiveQuery(() => db.local_cart.get("active_cart"));
  const pendingTxList = useLiveQuery(() => db.pending_transactions.toArray()) ?? [];

  const pendingCount = useMemo(() => {
    return pendingTxList.filter((tx) => tx.status === "PENDING").length;
  }, [pendingTxList]);

  const failedCount = useMemo(() => {
    return pendingTxList.filter((tx) => tx.status === "FAILED").length;
  }, [pendingTxList]);

  // Status Jaringan & Background Sync
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncingNotice, setSyncingNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOutboxModalOpen, setIsOutboxModalOpen] = useState<boolean>(false);

  // State Keranjang & Checkout (Sinkronisasi Langsung ke localStorage agar tidak hilang saat navigasi)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nexus_pos_cart");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn("Gagal membaca cart dari localStorage", e);
      }
    }
    return [];
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Toggle Tampilan Katalog: "list" (Default untuk judul panjang) atau "grid"
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexus_pos_view_mode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return "list";
  });

  const handleToggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexus_pos_view_mode", mode);
    }
  };

  // 1. State Multi-Tiering Harga: 'retail' (default), 'reseller', 'technician'
  const [pricingTier, setPricingTier] = useState<PricingTier>("retail");
  const [customerPhone, setCustomerPhone] = useState("");

  // State Identifikasi Pelanggan & Auto-Tiering
  const [crmCustomers, setCrmCustomers] = useState<Customer[]>(DEFAULT_POS_CUSTOMERS);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState<{
    name: string;
    phone: string;
    tier: PricingTier;
    address: string;
  }>({
    name: "",
    phone: "",
    tier: "retail",
    address: "",
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Filter pelanggan berdasarkan nama, telepon, atau alamat
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return crmCustomers.slice(0, 8);
    const q = customerSearchQuery.toLowerCase();
    return crmCustomers.filter((c) => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) ||
      (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [crmCustomers, customerSearchQuery]);

  // Load pelanggan dari CRM backend pada inisialisasi
  useEffect(() => {
    getCustomers()
      .then((data) => {
        if (data && data.length > 0) {
          const ids = new Set(data.map((c) => c.id));
          const merged = [...data, ...DEFAULT_POS_CUSTOMERS.filter((c) => !ids.has(c.id))];
          setCrmCustomers(merged);
        }
      })
      .catch((err) => {
        console.warn("Gagal fetch CRM customers, using fallback list:", err);
      });
  }, []);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerPhone(cust.phone);
    setCustomerSearchQuery(cust.name);
    setIsCustomerDropdownOpen(false);
    
    // Auto-Tiering: Sesuaikan tier harga secara otomatis berdasarkan profil CRM!
    const targetTier: PricingTier = 
      cust.tier === "reseller" ? "reseller" : 
      cust.tier === "technician" ? "technician" : "retail";
    setPricingTier(targetTier);

    // Sinkronkan ke service form jika mode pengerjaan/servis aktif
    setServiceForm((prev) => ({
      ...prev,
      customerName: cust.name,
      customerPhone: cust.phone,
    }));
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    setCustomerPhone("");
    setPricingTier("retail");
    setIsCustomerDropdownOpen(false);
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim() || !quickAddForm.phone.trim()) return;

    try {
      setIsSavingCustomer(true);
      const newCust = await createCustomer({
        name: quickAddForm.name.trim(),
        phone: quickAddForm.phone.trim(),
        tier: quickAddForm.tier,
        address: quickAddForm.address.trim() || undefined,
      });
      setCrmCustomers((prev) => [newCust, ...prev]);
      handleSelectCustomer(newCust);
      setIsQuickAddOpen(false);
      setQuickAddForm({ name: "", phone: "", tier: "retail", address: "" });
    } catch (err) {
      // In-memory fallback jika backend offline
      const mockNew: Customer = {
        id: `cust_${Date.now()}`,
        tenant_id: "11111111-1111-1111-1111-111111111111",
        name: quickAddForm.name.trim(),
        phone: quickAddForm.phone.trim(),
        tier: quickAddForm.tier,
        address: quickAddForm.address.trim() || undefined,
        total_spent: 0,
        total_orders: 0,
        rfm_segment: "Promising / New",
        devices: [],
        created_at: new Date().toISOString(),
      };
      setCrmCustomers((prev) => [mockNew, ...prev]);
      handleSelectCustomer(mockNew);
      setIsQuickAddOpen(false);
      setQuickAddForm({ name: "", phone: "", tier: "retail", address: "" });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // 2. State Split Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPaymentLine[]>([
    { payment_method: "CASH", amount: 0 }
  ]);

  // State Mode Servis HP & Form Penerimaan Unit
  const [isServiceMode, setIsServiceMode] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    customerName: "",
    customerPhone: "",
    deviceModel: "",
    issueDescription: "",
    estimatedCost: 150000,
  });

  // 3. State Receipt / Nota Struk Digital
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // 4. State Shift Kasir & Blind Balancing
  const [activeShift, setActiveShift] = useState<ShiftResponse | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState<boolean>(true);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);

  // 5. State Staf Kasir Aktif & Switcher PIN (RBAC)
  const [activeStaffUser, setActiveStaffUser] = useState<StaffMember>(() => getActiveStaff());
  const [isStaffSwitchModalOpen, setIsStaffSwitchModalOpen] = useState(false);
  const [availableStaffList, setAvailableStaffList] = useState<TeamMemberAPI[]>([]);
  const [selectedStaffToSwitch, setSelectedStaffToSwitch] = useState<TeamMemberAPI | null>(null);
  const [switchPinInput, setSwitchPinInput] = useState("");
  const [switchPinError, setSwitchPinError] = useState<string | null>(null);

  const [shiftOpenForm, setShiftOpenForm] = useState({
    cashierId: "CSH-01",
    cashierName: activeStaffUser?.name || "Budi (Kasir)",
    openingCash: 500000,
    notes: "Modal uang pecahan kecil",
  });
  const [shiftCloseForm, setShiftCloseForm] = useState({
    closingCash: 0,
    notes: "",
  });
  const [blindBalancingResult, setBlindBalancingResult] = useState<ShiftResponse | null>(null);
  const [isSubmittingShift, setIsSubmittingShift] = useState<boolean>(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Sinkronisasi pergantian staf kasir secara real-time
  useEffect(() => {
    const handleStaffChange = (e: any) => {
      if (e.detail) {
        setActiveStaffUser(e.detail);
        setShiftOpenForm((prev) => ({ ...prev, cashierName: e.detail.name }));
      }
    };
    window.addEventListener("nexus_staff_changed", handleStaffChange);
    return () => window.removeEventListener("nexus_staff_changed", handleStaffChange);
  }, []);

  // Memuat daftar staf saat modal ganti kasir dibuka
  const handleOpenStaffModal = async () => {
    setIsStaffSwitchModalOpen(true);
    try {
      const data = await fetchTeamMembers();
      setAvailableStaffList(data);
    } catch (e) {
      console.warn("Gagal mengambil daftar staf:", e);
    }
  };

  const handleConfirmSwitchStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffToSwitch) return;

    try {
      setSwitchPinError(null);
      const res = await verifyStaffPin(switchPinInput, selectedStaffToSwitch.id);
      if (res.success && res.staff) {
        const staffObj: StaffMember = {
          id: res.staff.id,
          name: res.staff.name,
          username: res.staff.username,
          role: res.staff.role,
          is_active: res.staff.is_active,
          permissions: res.staff.permissions,
        };
        setActiveStaff(staffObj);
        setActiveStaffUser(staffObj);
        setIsStaffSwitchModalOpen(false);
        setSelectedStaffToSwitch(null);
        setSwitchPinInput("");
        setSyncingNotice(`👤 Kasir aktif berhasil diganti menjadi: ${res.staff.name}`);
        setTimeout(() => setSyncingNotice(null), 4000);
      }
    } catch (err: any) {
      setSwitchPinError(err.message || "PIN yang dimasukkan salah!");
    }
  };

  // Load shift kasir aktif saat inisialisasi
  const loadActiveShift = async () => {
    try {
      setIsShiftLoading(true);
      const res = await getCurrentShift();
      setActiveShift(res.active_shift);
    } catch (e) {
      console.error("Gagal mengambil data shift kasir:", e);
    } finally {
      setIsShiftLoading(false);
    }
  };

  useEffect(() => {
    loadActiveShift();
  }, []);

  const handleOpenShift = async () => {
    try {
      setIsSubmittingShift(true);
      setShiftError(null);
      const res = await openShift({
        cashier_id: shiftOpenForm.cashierId,
        cashier_name: shiftOpenForm.cashierName,
        opening_cash: Number(shiftOpenForm.openingCash) || 0,
        notes: shiftOpenForm.notes || undefined,
      });
      setActiveShift(res);
      setIsOpenShiftModalOpen(false);
      setSyncingNotice(`🟢 Shift berhasil dibuka oleh ${res.cashier_name} (Modal: ${formatRupiah(res.opening_cash)})`);
      setTimeout(() => setSyncingNotice(null), 5000);
    } catch (err: any) {
      setShiftError(err.message || "Gagal membuka shift kasir");
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleCloseShift = async () => {
    try {
      setIsSubmittingShift(true);
      setShiftError(null);
      const res = await closeShift({
        shift_id: activeShift?.id,
        closing_cash: Number(shiftCloseForm.closingCash) || 0,
        notes: shiftCloseForm.notes || undefined,
      });
      setBlindBalancingResult(res);
      setActiveShift(null);
    } catch (err: any) {
      setShiftError(err.message || "Gagal menutup shift kasir");
    } finally {
      setIsSubmittingShift(false);
    }
  };

  // Hydrate cart dari Dexie IndexedDB jika localStorage kosong
  useEffect(() => {
    if (cart.length === 0 && liveCartRecord) {
      if (liveCartRecord.items && Array.isArray(liveCartRecord.items) && liveCartRecord.items.length > 0) {
        setCart(liveCartRecord.items as unknown as CartItem[]);
      }
      if (liveCartRecord.pricing_tier) {
        setPricingTier(liveCartRecord.pricing_tier);
      }
      if (liveCartRecord.customer_phone) {
        setCustomerPhone(liveCartRecord.customer_phone);
      }
      if (liveCartRecord.service_mode !== undefined) {
        setIsServiceMode(liveCartRecord.service_mode);
      }
      if (liveCartRecord.service_form) {
        setServiceForm(liveCartRecord.service_form);
      }
    }
    setIsLoaded(true);
  }, [liveCartRecord]);

  // Auto-persist cart ke localStorage dan Dexie IndexedDB setiap ada perubahan
  useEffect(() => {
    if (typeof window !== "undefined" && isLoaded) {
      try {
        localStorage.setItem("nexus_pos_cart", JSON.stringify(cart));
      } catch (e) {
        console.warn("Gagal menyimpan cart ke localStorage", e);
      }

      saveLocalCart({
        id: "active_cart",
        items: cart,
        pricing_tier: pricingTier,
        customer_phone: customerPhone,
        service_mode: isServiceMode,
        service_form: serviceForm,
      });
    }
  }, [cart, pricingTier, customerPhone, isServiceMode, serviceForm, isLoaded]);

  // Pantau konektivitas jaringan & daftarkan background sync engine
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        setSyncingNotice("Internet terhubung kembali. Memulai sinkronisasi otomatis...");
        setTimeout(() => setSyncingNotice(null), 4000);
      };

      const handleOffline = () => {
        setIsOnline(false);
        setSyncingNotice("Mode Offline Aktif: Transaksi akan disimpan di database lokal browser.");
        setTimeout(() => setSyncingNotice(null), 5000);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Register background sync engine (online event + interval 30s)
      const unregisterSync = registerAutoSyncEngine((res) => {
        if (res.synced > 0) {
          setSyncingNotice(`✓ Berhasil menyinkronkan ${res.synced} transaksi offline ke server!`);
          setTimeout(() => setSyncingNotice(null), 4500);
        }
        if (res.failed > 0) {
          setErrorMessage(`⚠️ Ada ${res.failed} transaksi gagal sinkron (stok tidak cukup/konflik). Buka Outbox.`);
        }
      });

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        unregisterSync();
      };
    }
  }, []);

  // Handler Manual Sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPendingTransactions();
      if (res.synced > 0) {
        setSyncingNotice(`✓ ${res.synced} transaksi berhasil disinkronkan ke server.`);
        setTimeout(() => setSyncingNotice(null), 4000);
      } else if (res.pendingRemaining === 0 && res.failed === 0) {
        setSyncingNotice("Semua transaksi lokal sudah tersinkronisasi.");
        setTimeout(() => setSyncingNotice(null), 3000);
      }
      if (res.failed > 0) {
        setErrorMessage(`Perhatian: ${res.failed} transaksi gagal sinkron. Buka outbox untuk melihat rincian.`);
      }
    } catch (err: any) {
      setErrorMessage("Gagal menjalankan sinkronisasi: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fastScanAlert, setFastScanAlert] = useState<string | null>(null);

  // Ambil data items dari backend jika ada
  useEffect(() => {
    async function loadBackendItems() {
      try {
        const backendItems = await getItems();
        if (backendItems && backendItems.length > 0) {
          const mapped = backendItems.map((bi) => ({
            ...bi,
            category: (bi.item_type === "service" ? "Jasa Service" : "Sparepart") as any,
            stock: bi.stock ?? 20,
            price_retail: bi.price_retail ?? bi.base_price,
            price_reseller: bi.price_reseller ?? Math.round(bi.base_price * 0.90),
            price_technician: bi.price_technician ?? Math.round(bi.base_price * 0.85),
          }));
          setItemsList((prev) => [...mapped, ...prev.filter((d) => !mapped.some((m) => m.name === d.name))]);
        }
      } catch (err) {
        console.log("Menggunakan katalog lokal untuk demo POS");
      }
    }
    loadBackendItems();
  }, []);

  // Filter Items yang sangat forgiving (multi-token, SKU, Barcode, Marketplace SKU, Brand)
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    return itemsList.filter((item) => {
      const matchesTab = selectedTab === "All" || item.category === selectedTab;
      if (!matchesTab) return false;
      if (tokens.length === 0) return true;

      const searchCorpus = [
        item.name,
        item.sku,
        item.marketplace_sku || "",
        (item.attributes?.barcode as string) || "",
        (item.attributes?.brand as string) || "",
        item.category || "",
      ].join(" ").toLowerCase();

      return tokens.every((token) => searchCorpus.includes(token));
    });
  }, [itemsList, selectedTab, searchQuery]);

  // Handler keyboard shortcut & Barcode Scanner (Enter langsung masuk keranjang)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = searchQuery.trim().toLowerCase();
      if (!query) return;

      // 1. Cek exact match pada SKU, Marketplace SKU, atau Barcode
      const exactMatch = itemsList.find(
        (it) =>
          it.sku.toLowerCase() === query ||
          it.marketplace_sku?.toLowerCase() === query ||
          (it.attributes?.barcode as string)?.toLowerCase() === query
      );

      // 2. Jika tidak ada exact, tapi hasil filter hanya 1 item
      const targetItem = exactMatch || (filteredItems.length === 1 ? filteredItems[0] : null);

      if (targetItem) {
        addToCart(targetItem);
        setFastScanAlert(`✓ ${targetItem.name} ditambahkan ke keranjang`);
        setSearchQuery("");
        setTimeout(() => setFastScanAlert(null), 2500);
      }
    }
  };

  // Tambah item ke keranjang dengan validasi stok fisik
  const addToCart = (item: any) => {
    // 1. Cek jika produk berjenis fisik dan stoknya habis
    if (item.item_type !== "service" && (item.stock === undefined || item.stock <= 0)) {
      setFastScanAlert(`⚠️ Stok ${item.name} habis (0 unit)! Tidak dapat ditambahkan.`);
      setTimeout(() => setFastScanAlert(null), 3000);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        // Cek jika kuantitas di keranjang sudah menyentuh batas stok maksimal
        if (item.item_type !== "service" && existing.qty >= item.stock) {
          setFastScanAlert(`⚠️ Stok maksimal ${item.name} hanya ${item.stock} unit.`);
          setTimeout(() => setFastScanAlert(null), 3000);
          return prev;
        }
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  // Ubah kuantitas item dengan validasi batas stok
  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const newQty = ci.qty + delta;
            // Validasi jika menambah kuantitas melebihi stok yang ada
            if (delta > 0 && ci.item.item_type !== "service" && newQty > (ci.item.stock ?? 999)) {
              setFastScanAlert(`⚠️ Stok maksimal hanya ${ci.item.stock} unit.`);
              setTimeout(() => setFastScanAlert(null), 3000);
              return ci;
            }
            return newQty > 0 ? { ...ci, qty: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Hapus item dari keranjang
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  // Bersihkan seluruh keranjang
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("nexus_pos_cart");
    }
    clearLocalCart();
  };

  // ===========================================================================
  // KALKULASI FINANSIAL DINAMIS SESUAI TIER PELANGGAN
  // ===========================================================================
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, ci) => {
      const unitPrice = getItemPrice(ci.item, pricingTier);
      return acc + unitPrice * ci.qty;
    }, 0);
  }, [cart, pricingTier]);

  const serviceCost = isServiceMode ? Number(serviceForm.estimatedCost) || 0 : 0;
  const grandTotal = cartSubtotal + serviceCost;

  // Total terbayar dalam modal split payment
  const totalPaidInModal = useMemo(() => {
    return splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [splitPayments]);

  const paymentRemaining = grandTotal - totalPaidInModal;

  // ===========================================================================
  // HANDLERS: MODAL SPLIT PAYMENT
  // ===========================================================================
  const handleOpenPaymentModal = () => {
    // Validasi shift kasir aktif
    if (!activeShift) {
      setErrorMessage("Shift kasir belum dibuka! Silakan Buka Shift Kasir terlebih dahulu sebelum transaksi.");
      setIsOpenShiftModalOpen(true);
      return;
    }

    if (cart.length === 0 && !isServiceMode) {
      setErrorMessage("Keranjang belanja masih kosong!");
      return;
    }

    if (isServiceMode && (!serviceForm.customerName || !serviceForm.deviceModel)) {
      setErrorMessage("Nama pemilik dan tipe HP wajib diisi pada Mode Servis!");
      return;
    }

    setErrorMessage(null);
    // Inisialisasi awal 1 baris CASH sebesar grandTotal
    setSplitPayments([
      { payment_method: "CASH", amount: grandTotal }
    ]);
    setIsPaymentModalOpen(true);
  };

  const handleAddPaymentMethod = () => {
    // Tambahkan baris baru dengan metode QRIS atau TRANSFER sebesar sisa jika ada
    const nextAmount = Math.max(0, paymentRemaining);
    const availableMethods: ("CASH" | "QRIS" | "TRANSFER")[] = ["QRIS", "TRANSFER", "CASH"];
    const existingMethods = splitPayments.map((p) => p.payment_method);
    const chosenMethod = availableMethods.find((m) => !existingMethods.includes(m)) || "QRIS";

    setSplitPayments((prev) => [
      ...prev,
      { payment_method: chosenMethod, amount: nextAmount }
    ]);
  };

  const handleRemovePaymentMethod = (index: number) => {
    if (splitPayments.length <= 1) return;
    setSplitPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePayment = (index: number, field: "payment_method" | "amount", value: any) => {
    setSplitPayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleFillRemaining = (index: number) => {
    const currentLine = splitPayments[index];
    const otherLinesTotal = splitPayments.reduce((sum, p, i) => (i === index ? sum : sum + (Number(p.amount) || 0)), 0);
    const newAmount = Math.max(0, grandTotal - otherLinesTotal);
    handleUpdatePayment(index, "amount", newAmount);
  };

  // Handler Proses Pembayaran Akhir (Offline-First Ready)
  const handleProcessOrder = async () => {
    if (paymentRemaining !== 0) {
      setErrorMessage("Total pembayaran harus sama persis dengan total tagihan!");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Generate Idempotency Key (UUID v4)
      const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const orderPayload = {
        idempotency_key: idempotencyKey,
        pricing_tier: pricingTier,
        contact_id: selectedCustomer?.id,
        items: cart.map((ci) => ({
          item_id: ci.item.id.includes("-") && ci.item.id.length > 20 ? ci.item.id : "33333333-3333-3333-3333-333333333333",
          qty: ci.qty,
        })),
        payments: splitPayments.map((p) => ({
          payment_method: p.payment_method,
          amount: Number(p.amount),
        })),
        service_details: isServiceMode ? {
          customer_name: serviceForm.customerName || selectedCustomer?.name || "Pelanggan Jasa",
          customer_phone: serviceForm.customerPhone || selectedCustomer?.phone || "",
          device_model: serviceForm.deviceModel,
          issue_description: serviceForm.issueDescription,
          estimated_cost: serviceCost,
        } : undefined,
      };

      const customerDisplayName = selectedCustomer?.name 
        ? selectedCustomer.name
        : (isServiceMode 
          ? (serviceForm.customerName || "Pelanggan Jasa") 
          : (customerPhone ? `Pelanggan (${customerPhone})` : "Pelanggan Umum (Guest)"));

      const finalReceiptData: ReceiptData = {
        orderId: `ORD-${idempotencyKey.slice(0, 8).toUpperCase()}`,
        date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
        customerName: customerDisplayName,
        customerPhone: customerPhone || (isServiceMode ? serviceForm.customerPhone : ""),
        totalAmount: grandTotal,
        cashierName: activeStaffUser?.name || "Kasir Toko",
        pricingTier: pricingTier,
        items: cart.map((ci) => ({
          name: ci.item.name,
          qty: ci.qty,
          price: getItemPrice(ci.item, pricingTier),
          total: getItemPrice(ci.item, pricingTier) * ci.qty,
        })),
        payments: splitPayments,
      };

      // 2. CHECK NETWORK CONNECTIVITY
      const isCurrentlyOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

      if (!isCurrentlyOnline) {
        // =====================================================================
        // JALUR 1: OFFLINE MODE (Internet Mati)
        // Simpan transaksi ke Dexie.js IndexedDB (Local Outbox)
        // =====================================================================
        await enqueuePendingTransaction({
          idempotency_key: idempotencyKey,
          payload_order: orderPayload,
          receipt_snapshot: finalReceiptData,
        });

        setReceiptData(finalReceiptData);
        setIsReceiptModalOpen(true);

        setOrderSuccess({
          orderId: finalReceiptData.orderId,
          total: grandTotal,
          tier: pricingTier,
          payments: splitPayments,
          itemCount: cart.reduce((sum, ci) => sum + ci.qty, 0),
          isService: isServiceMode,
          customerName: serviceForm.customerName,
          deviceModel: serviceForm.deviceModel,
          offlineSaved: true,
        });

        // Kosongkan keranjang & persist ke Dexie
        setCart([]);
        await clearLocalCart();
        setIsPaymentModalOpen(false);
        setIsServiceMode(false);
        setServiceForm({
          customerName: "",
          customerPhone: "",
          deviceModel: "",
          issueDescription: "",
          estimatedCost: 150000,
        });

        setSyncingNotice("⚡ Transaksi tersimpan offline di browser! Akan otomatis disinkronkan saat internet aktif.");
        setTimeout(() => setSyncingNotice(null), 5000);
        return;
      }

      // =====================================================================
      // JALUR 2: ONLINE MODE
      // Kirim ke server backend dengan Idempotency-Key
      // =====================================================================
      let result;
      try {
        result = await createOrder(orderPayload);
      } catch (e: any) {
        // Deteksi jika terjadi kegagalan jaringan tiba-tiba (Network Error / timeout)
        const isNetworkErr = !navigator.onLine || 
          e.message?.includes("Failed to fetch") || 
          e.message?.includes("NetworkError") || 
          e.name === "TypeError";

        if (isNetworkErr) {
          // Koneksi drop saat request -> selamatkan transaksi ke Dexie Local Outbox
          await enqueuePendingTransaction({
            idempotency_key: idempotencyKey,
            payload_order: orderPayload,
            receipt_snapshot: finalReceiptData,
          });

          setReceiptData(finalReceiptData);
          setIsReceiptModalOpen(true);

          setOrderSuccess({
            orderId: finalReceiptData.orderId,
            total: grandTotal,
            tier: pricingTier,
            payments: splitPayments,
            itemCount: cart.reduce((sum, ci) => sum + ci.qty, 0),
            isService: isServiceMode,
            customerName: serviceForm.customerName,
            deviceModel: serviceForm.deviceModel,
            offlineSaved: true,
          });

          setCart([]);
          await clearLocalCart();
          setIsPaymentModalOpen(false);

          setSyncingNotice("⚡ Koneksi terputus saat request. Transaksi diamankan di Local Outbox!");
          setTimeout(() => setSyncingNotice(null), 5000);
          return;
        }

        // Jika error domain bisnis (misal: 409 Conflict Stok Habis)
        throw e;
      }

      const generatedOrderId = result.id || finalReceiptData.orderId;
      finalReceiptData.orderId = generatedOrderId;

      setReceiptData(finalReceiptData);
      setIsReceiptModalOpen(true);

      setOrderSuccess({
        orderId: generatedOrderId,
        total: grandTotal,
        tier: pricingTier,
        payments: splitPayments,
        itemCount: cart.reduce((sum, ci) => sum + ci.qty, 0),
        isService: isServiceMode,
        customerName: serviceForm.customerName,
        deviceModel: serviceForm.deviceModel,
        offlineSaved: false,
      });

      // Reset Form & Keranjang
      setCart([]);
      await clearLocalCart();
      setIsPaymentModalOpen(false);
      setIsServiceMode(false);
      setServiceForm({
        customerName: "",
        customerPhone: "",
        deviceModel: "",
        issueDescription: "",
        estimatedCost: 150000,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses pembayaran pesanan POS");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] text-slate-100">
      {/* =====================================================================
          BAGIAN KIRI (70%): KATALOG SPAREPART & JASA
          ===================================================================== */}
      <div className="lg:w-[70%] flex flex-col h-full bg-[#141414] rounded-2xl border border-[#262626] p-5 overflow-hidden">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#262626] mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Preset Bisnis Dropdown Button */}
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(true)}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-purple-900/20"
                title="Klik untuk Ganti Profil Industri Bisnis (Retail, Bengkel, HVAC, E-Commerce, Gadget, Fashion)"
              >
                <span>🏢</span>
                <span>Profil: <strong>{activePreset.shortTag}</strong></span>
                <ChevronDown className="w-3 h-3 text-purple-400" />
              </button>

              {/* Active Cashier Badge & Quick PIN Switcher (RBAC) */}
              <button
                type="button"
                onClick={handleOpenStaffModal}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-900/20"
                title="Klik untuk Ganti Kasir atau Kunci POS"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Kasir: <strong>{activeStaffUser.name.split(" ")[0]}</strong></span>
                <ChevronDown className="w-3 h-3 text-blue-400" />
              </button>

              {/* Online / Offline Status Badge */}
              {isOnline ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  Online
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  Offline Mode
                </span>
              )}

              {/* Pending Transactions Pill (with Quick Sync) */}
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title={isOnline ? "Klik untuk kirim transaksi antrean sekarang" : "Menunggu internet terhubung untuk sinkronisasi"}
                >
                  <RotateCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{pendingCount} Pending</span>
                  {isOnline && <span className="text-[10px] underline ml-0.5">Sync</span>}
                </button>
              )}

              {/* Outbox Modal Trigger */}
              <button
                type="button"
                onClick={() => setIsOutboxModalOpen(true)}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#262626] text-gray-300 hover:text-white hover:bg-[#333] border border-[#383838] transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Buka Local Outbox (IndexedDB)"
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span>Outbox ({pendingTxList.length})</span>
                {failedCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {failedCount} err
                  </span>
                )}
              </button>

              {/* Shift Management Pill & Blind Balancing Trigger */}
              {activeShift ? (
                <button
                  type="button"
                  onClick={() => {
                    setBlindBalancingResult(null);
                    setShiftCloseForm({ closingCash: 0, notes: "" });
                    setShiftError(null);
                    setIsCloseShiftModalOpen(true);
                  }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-900/30"
                  title="Shift Kasir Aktif. Klik untuk Tutup Shift (Blind Balancing)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>Shift: <strong>{activeShift.cashier_name}</strong></span>
                  <span className="text-[10px] text-emerald-400 font-mono">({formatRupiah(activeShift.opening_cash)})</span>
                  <Lock className="w-3 h-3 text-emerald-400 ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShiftError(null);
                    setIsOpenShiftModalOpen(true);
                  }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
                  title="Shift Kasir Belum Dibuka. Klik untuk Buka Shift"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Buka Shift Kasir</span>
                </button>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-purple-400" />
              {activePreset.posTitle}
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">
              {activePreset.tagline}
            </p>
          </div>

          {/* Search Input (Fast Typing & Barcode Scanner Ready) */}
          <div className="flex flex-col gap-1 w-full md:w-80">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Scan ${activePreset.skuLabel} / Cari nama...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-[#1c1c1c] border border-[#2e2e2e] focus:border-purple-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
            {fastScanAlert && (
              <span className="text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                {fastScanAlert}
              </span>
            )}
          </div>
        </div>

        {/* Syncing / Offline Notification Banner */}
        {syncingNotice && (
          <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <RotateCw className={`w-3.5 h-3.5 text-purple-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{syncingNotice}</span>
            </div>
            <button
              onClick={() => setSyncingNotice(null)}
              className="text-purple-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded hover:bg-purple-800/30"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Kategori Dinamis Sesuai Profil Bisnis & Toggle List / Grid View */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222] gap-2 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto">
            {activePreset.categories.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTab === tab
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-[#1c1c1c] text-gray-400 hover:text-white hover:bg-[#252525]"
                }`}
              >
                {tab === "All" ? "Semua Katalog" : tab}
              </button>
            ))}
          </div>

          {/* Toggle View Mode: Grid vs List */}
          <div className="flex items-center bg-[#1c1c1c] p-1 rounded-xl border border-[#2b2b2b] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Tampilan Baris Vertikal (Judul panjang terlihat penuh)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Tampilan Kotak Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>

        {/* Katalog Produk: Render Sesuai Mode (List vs Grid) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {viewMode === "list" ? (
            /* TAMPILAN LIST VERTIKAL (PANJANG NAMA TERLIHAT LENGKAP & RAPI) */
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const currentTierPrice = getItemPrice(item, pricingTier);
                const isDiscounted = pricingTier !== "retail" && currentTierPrice < item.base_price;
                const isOutOfStock = item.item_type !== "service" && item.stock <= 0;

                return (
                  <div
                    key={item.id}
                    className={`bg-[#1a1a1a] hover:bg-[#202020] border ${
                      isOutOfStock ? "border-rose-900/30 opacity-70" : "border-[#292929] hover:border-purple-500/50"
                    } rounded-xl p-3.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3`}
                  >
                    {/* Info Utama: SKU, Nama Lengkap, & Atribut */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-gray-400 px-2 py-0.5 rounded bg-[#242424] border border-[#303030]">
                          {item.sku}
                        </span>
                        {item.item_type === "service" ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Jasa Teknis
                          </span>
                        ) : isOutOfStock ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            Stok Habis (0)
                          </span>
                        ) : item.stock <= 5 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Sisa: {item.stock} pcs
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Stok: {item.stock} pcs
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                          {item.category}
                        </span>
                      </div>

                      {/* Judul Barang (Lengkap Tanpa Pemotongan) */}
                      <h3 className="font-semibold text-sm text-white group-hover:text-purple-300 transition-colors leading-snug">
                        {item.name}
                      </h3>

                      {item.attributes && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {Object.entries(item.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" • ")}
                        </p>
                      )}
                    </div>

                    {/* Harga & Tombol Tambah */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#262626]">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1.5 md:justify-end">
                          <span className="text-base font-bold text-white tracking-tight">
                            {formatRupiah(currentTierPrice)}
                          </span>
                          {isDiscounted && (
                            <span className="text-[11px] text-gray-500 line-through">
                              {formatRupiah(item.base_price)}
                            </span>
                          )}
                        </div>
                        {pricingTier !== "retail" && (
                          <span className="text-[10px] text-purple-400 font-semibold block uppercase">
                            Tier: {pricingTier}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => addToCart(item)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isOutOfStock
                            ? "bg-[#252525] text-gray-500 cursor-not-allowed border border-[#333]"
                            : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 active:scale-95 cursor-pointer"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isOutOfStock ? "Habis" : "Tambah"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TAMPILAN GRID KOTAK */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const currentTierPrice = getItemPrice(item, pricingTier);
                const isDiscounted = pricingTier !== "retail" && currentTierPrice < item.base_price;
                const isOutOfStock = item.item_type !== "service" && item.stock <= 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isOutOfStock) addToCart(item);
                    }}
                    className={`group bg-[#1a1a1a] hover:bg-[#202020] border ${
                      isOutOfStock ? "border-rose-900/30 opacity-70 cursor-not-allowed" : "border-[#292929] hover:border-purple-500/50 cursor-pointer"
                    } rounded-xl p-4 transition-all duration-200 flex flex-col justify-between hover:shadow-lg hover:shadow-purple-500/5 relative overflow-hidden`}
                  >
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
                              : isOutOfStock
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold"
                              : item.stock <= 5
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {item.item_type === "service"
                            ? "Jasa Teknis"
                            : isOutOfStock
                            ? "Stok Habis (0)"
                            : `Stok: ${item.stock}`}
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
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-white tracking-tight">
                            {formatRupiah(currentTierPrice)}
                          </span>
                          {isDiscounted && (
                            <span className="text-[11px] text-gray-500 line-through">
                              {formatRupiah(item.base_price)}
                            </span>
                          )}
                        </div>
                        {pricingTier !== "retail" && (
                          <span className="text-[10px] text-purple-400 font-semibold block uppercase">
                            Tier: {pricingTier}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isOutOfStock
                            ? "bg-[#252525] text-gray-500 cursor-not-allowed"
                            : "bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500">
              <Package className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Tidak ada produk atau jasa yang cocok dengan pencarian.</p>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          BAGIAN KANAN (30%): KERANJANG, TIER PELANGGAN, & CHECKOUT
          ===================================================================== */}
      <div className="lg:w-[30%] flex flex-col h-full bg-[#141414] rounded-2xl border border-[#262626] p-5 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <h2 className="font-bold text-sm text-white">Keranjang Kasir</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">
              {cart.reduce((sum, ci) => sum + ci.qty, 0)} Items
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Kosongkan semua item di keranjang?")) {
                    setCart([]);
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("nexus_pos_cart");
                    }
                  }
                }}
                className="text-[11px] text-gray-400 hover:text-rose-400 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
                title="Reset Keranjang Kasir"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. IDENTIFIKASI PELANGGAN & AUTO-TIERING HARGA */}
        <div className="mb-3 p-3 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Identifikasi Pelanggan
            </label>
            {selectedCustomer ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Terdaftar
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {pricingTier === "retail" ? "Retail (Eceran)" : pricingTier === "reseller" ? "Reseller (-10%)" : "Teknisi (Khusus)"}
              </span>
            )}
          </div>

          {/* JIKA PELANGGAN TELAH DIPILIH */}
          {selectedCustomer ? (
            <div className="p-2.5 rounded-lg bg-[#141414] border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-gray-400 hover:text-rose-400 p-1 text-xs shrink-0 transition-colors flex items-center gap-0.5"
                  title="Ganti Pelanggan"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Ganti</span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#262626] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-300 font-medium">✓ Tier Otomatis:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    pricingTier === "technician" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                    pricingTier === "reseller" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                    "bg-[#252525] text-gray-300 border border-[#333]"
                  }`}>
                    {pricingTier}
                  </span>
                </div>
                
                {/* Kasir bisa override manual jika butuh */}
                <select
                  value={pricingTier}
                  onChange={(e) => setPricingTier(e.target.value as PricingTier)}
                  className="bg-[#121212] border border-[#333] rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-purple-400"
                  title="Override tier harga manual"
                >
                  <option value="retail">Retail</option>
                  <option value="reseller">Reseller</option>
                  <option value="technician">Teknisi</option>
                </select>
              </div>
            </div>
          ) : (
            /* JIKA BELUM MEMILIH PELANGGAN: INPUT PENCARIAN AUTOCOMPLETE */
            <div className="relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  placeholder="Tanyakan nama / no. WA pelanggan..."
                  className="w-full bg-[#121212] border border-[#333] rounded-lg pl-8 pr-7 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearchQuery("");
                      setIsCustomerDropdownOpen(false);
                    }}
                    className="text-gray-400 hover:text-white absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* DROPDOWN AUTOCOMPLETE HASIL PENCARIAN */}
              {isCustomerDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-[#181818] border border-[#333] rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    <div className="divide-y divide-[#242424]">
                      {filteredCustomers.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-left p-2.5 hover:bg-[#252525] transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-xs font-semibold text-white group-hover:text-purple-300">
                              {cust.name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {cust.phone} {cust.address ? `• ${cust.address.slice(0, 18)}...` : ""}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                            cust.tier === "technician" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                            cust.tier === "reseller" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                            "bg-[#252525] text-gray-300 border border-[#333]"
                          }`}>
                            {cust.tier}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-gray-400">
                      Pelanggan "{customerSearchQuery}" belum terdaftar.
                    </div>
                  )}

                  {/* OPSI TAMBAH PELANGGAN CEPAT & GUEST */}
                  <div className="p-2 border-t border-[#262626] bg-[#141414] flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddForm(prev => ({
                          ...prev,
                          name: customerSearchQuery.trim() || "",
                          phone: customerSearchQuery.match(/^[0-9+]+$/) ? customerSearchQuery.trim() : "",
                        }));
                        setIsQuickAddOpen(true);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Tambah Baru</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomerDropdownOpen(false);
                        setPricingTier("retail");
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white text-[11px] font-medium transition-colors"
                    >
                      Guest (Umum)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toggle Mode Terima Servis (Hanya tampil jika profil industri memiliki modul servis) */}
        {activePreset.hasServiceMode && (
          <div className="mb-3 p-3 rounded-xl bg-[#1c1c1c] border border-[#2e2e2e] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Wrench className={`w-4 h-4 ${isServiceMode ? "text-purple-400" : "text-gray-400"}`} />
              <div>
                <p className="text-xs font-semibold text-white leading-tight">
                  Mode {activePreset.serviceNavTitle || "Layanan Pengerjaan"}
                </p>
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
        )}

        {/* Form Error Banner */}
        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Isi Keranjang / Form Servis */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {/* Form Servis jika Mode Servis Aktif & Diizinkan Profil */}
          {isServiceMode && activePreset.hasServiceMode && (
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2 mb-2">
              <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> {activePreset.serviceModalTitle}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">Nama Pelanggan</label>
                  <input
                    type="text"
                    placeholder="Budi Santoso"
                    value={serviceForm.customerName}
                    onChange={(e) => setServiceForm({ ...serviceForm, customerName: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">No HP / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={serviceForm.customerPhone}
                    onChange={(e) => setServiceForm({ ...serviceForm, customerPhone: e.target.value })}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">
                  {activePreset.serviceFields.unitLabel}
                </label>
                <input
                  type="text"
                  placeholder={activePreset.serviceFields.unitPlaceholder}
                  value={serviceForm.deviceModel}
                  onChange={(e) => setServiceForm({ ...serviceForm, deviceModel: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              {activePreset.serviceFields.secondaryLabel && (
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-semibold">
                    {activePreset.serviceFields.secondaryLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={activePreset.serviceFields.secondaryPlaceholder}
                    className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">
                  {activePreset.serviceFields.issueLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={activePreset.serviceFields.issuePlaceholder}
                  value={serviceForm.issueDescription}
                  onChange={(e) => setServiceForm({ ...serviceForm, issueDescription: e.target.value })}
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 uppercase font-semibold">
                  {activePreset.serviceFields.costLabel}
                </label>
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
            cart.map(({ item, qty }) => {
              const unitPrice = getItemPrice(item, pricingTier);
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#1a1a1a] border border-[#2b2b2b] flex items-center justify-between gap-2"
                >
                  <div className="truncate flex-1">
                    <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-purple-400 font-mono">
                        {formatRupiah(unitPrice)}
                      </p>
                      {pricingTier !== "retail" && (
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                          {pricingTier}
                        </span>
                      )}
                    </div>
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
              );
            })
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
            <span>Subtotal ({pricingTier}):</span>
            <span className="font-mono text-white">{formatRupiah(cartSubtotal)}</span>
          </div>

          {isServiceMode && (
            <div className="flex justify-between text-purple-300">
              <span>Biaya Jasa Servis:</span>
              <span className="font-mono">{formatRupiah(serviceCost)}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-[#262626] text-sm">
            <span className="font-bold text-white">Total Tagihan:</span>
            <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 font-mono">
              {formatRupiah(grandTotal)}
            </span>
          </div>

          {/* Tombol Buka Modal Pembayaran / Split Payment */}
          <button
            onClick={handleOpenPaymentModal}
            disabled={isSubmitting || (cart.length === 0 && !isServiceMode)}
            className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>BAYAR / SPLIT PAYMENT</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Hint Keunggulan Split Payment vs Sistem Lama */}
          <div className="mt-2.5 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 flex items-start gap-1.5 leading-snug">
            <span className="text-purple-400 font-bold shrink-0">⚡ Keunggulan Nexus:</span>
            <span>Fitur <strong>Split Payment</strong> ini tidak ada di sistem lama (KetoKo), bisa kombinasi Cash + QRIS + Transfer dalam satu transaksi!</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: SPLIT PAYMENT MODAL (TUNAI, QRIS, TRANSFER)
          ===================================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative space-y-5">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-[#282828]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Pembayaran & Split Payment</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Tagihan Box */}
            <div className="bg-[#121212] p-4 rounded-xl border border-[#262626] flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block font-medium">
                  Total Yang Harus Dibayar
                </span>
                <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400 font-mono">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase block font-semibold">Tier Harga</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                  {pricingTier}
                </span>
              </div>
            </div>

            {/* Input WhatsApp Pelanggan (Opsional) */}
            <div className="bg-[#121212] p-3 rounded-xl border border-[#262626]">
              <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
                No. WhatsApp Pelanggan (Kirim Struk Digital via WA)
              </label>
              <input
                type="text"
                placeholder="Contoh: 081299887766 atau 628..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
              />
            </div>

            {/* List Metode Pembayaran Split Payment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Metode Pembayaran ({splitPayments.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddPaymentMethod}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Metode
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {splitPayments.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-[#121212] p-3 rounded-xl border border-[#2b2b2b]"
                  >
                    {/* Icon Metode */}
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0">
                      {p.payment_method === "CASH" && <Wallet className="w-4 h-4 text-emerald-400" />}
                      {p.payment_method === "QRIS" && <QrCode className="w-4 h-4 text-blue-400" />}
                      {p.payment_method === "TRANSFER" && <Building2 className="w-4 h-4 text-purple-400" />}
                    </div>

                    {/* Dropdown Metode */}
                    <select
                      value={p.payment_method}
                      onChange={(e) => handleUpdatePayment(idx, "payment_method", e.target.value)}
                      className="bg-[#1c1c1c] text-xs font-semibold text-white border border-[#333] rounded-lg px-2.5 py-2 focus:outline-none focus:border-purple-400"
                    >
                      <option value="CASH">Tunai (CASH)</option>
                      <option value="QRIS">QRIS Dinamis / Statis</option>
                      <option value="TRANSFER">Transfer Bank</option>
                    </select>

                    {/* Input Jumlah Nominal */}
                    <div className="flex-1 relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">Rp</span>
                      <input
                        type="number"
                        min={0}
                        value={p.amount}
                        onChange={(e) => handleUpdatePayment(idx, "amount", Number(e.target.value))}
                        className="w-full bg-[#1c1c1c] text-xs font-mono font-bold text-white border border-[#333] rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {/* Tombol Isi Sisa Tagihan */}
                    <button
                      type="button"
                      onClick={() => handleFillRemaining(idx)}
                      className="px-2 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-[10px] font-semibold rounded-lg border border-purple-500/30 whitespace-nowrap"
                      title="Isi nominal dengan sisa tagihan"
                    >
                      Isi Sisa
                    </button>

                    {/* Hapus Baris */}
                    {splitPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentMethod(idx)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg transition-colors"
                        title="Hapus baris metode pembayaran ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Indikator Status Keseimbangan Pembayaran */}
            <div className="p-3.5 rounded-xl border text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-400 font-medium">Total Terbayar:</span>
                <span className="font-mono font-bold text-white">{formatRupiah(totalPaidInModal)}</span>
              </div>

              {paymentRemaining > 0 ? (
                <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-amber-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Sisa Yang Harus Dibayar:
                  </span>
                  <span className="font-mono text-sm">{formatRupiah(paymentRemaining)}</span>
                </div>
              ) : paymentRemaining === 0 ? (
                <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Pembayaran Pas (Lunas)
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Siap Diproses
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-cyan-400 font-semibold">
                  <span>Kembalian Tunai:</span>
                  <span className="font-mono text-sm">{formatRupiah(Math.abs(paymentRemaining))}</span>
                </div>
              )}
            </div>

            {/* Tombol Eksekusi Pembayaran */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-1/3 py-2.5 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleProcessOrder}
                disabled={isSubmitting || paymentRemaining !== 0}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses Transaksi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PROSES PEMBAYARAN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: NOTIFIKASI SUKSES ORDER (STRUK & RINCIAN SPLIT PAYMENT)
          ===================================================================== */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-purple-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative">
            {orderSuccess.offlineSaved ? (
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                <CloudOff className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}

            <h3 className="text-lg font-bold text-white mb-1">
              {orderSuccess.offlineSaved ? "Disimpan di Local Outbox (Offline)" : "Transaksi Berhasil Diterbitkan!"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {orderSuccess.offlineSaved
                ? "Komputer sedang offline. Struk dapat langsung dicetak untuk pelanggan; transaksi akan otomatis dikirim ke server saat internet aktif kembali."
                : "Data transaksi, mutasi stok, dan ayat jurnal split payment telah dicatat di server cloud."}
            </p>

            <div className="bg-[#121212] rounded-xl p-4 border border-[#282828] text-left text-xs space-y-2 mb-5">
              <div className="flex justify-between">
                <span className="text-gray-400">Order ID:</span>
                <span className="font-mono text-purple-300 font-semibold">{orderSuccess.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status Penyimpanan:</span>
                <span className={`font-mono font-semibold ${orderSuccess.offlineSaved ? "text-amber-400" : "text-emerald-400"}`}>
                  {orderSuccess.offlineSaved ? "LOCAL INDEXEDDB (OFFLINE)" : "CLOUD BACKEND (CONFIRMED)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tier Pelanggan:</span>
                <span className="font-mono text-purple-400 font-semibold uppercase">{orderSuccess.tier || "RETAIL"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Nominal:</span>
                <span className="font-mono text-emerald-400 font-bold">{formatRupiah(orderSuccess.total)}</span>
              </div>

              {/* Rincian Split Payment */}
              {orderSuccess.payments && orderSuccess.payments.length > 0 && (
                <div className="border-t border-[#222] pt-2 mt-2 space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Rincian Split Payment:</span>
                  {orderSuccess.payments.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px] text-slate-300">
                      <span>• {p.payment_method}:</span>
                      <span className="font-mono font-medium">{formatRupiah(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

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

            <div className="space-y-2">
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/30"
              >
                <Receipt className="w-4 h-4" />
                <span>Cetak Struk / Kirim via WhatsApp</span>
              </button>

              <button
                onClick={() => setOrderSuccess(null)}
                className="w-full py-2.5 rounded-xl bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold transition-colors"
              >
                Tutup & Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: LOCAL OUTBOX (INDEXEDDB PENDING TRANSACTIONS)
          ===================================================================== */}
      {isOutboxModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#333] rounded-2xl max-w-2xl w-full p-6 text-left shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2a2a2a] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Local Outbox (Offline-First Queue)
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      Dexie.js IndexedDB
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Daftar transaksi yang disimpan lokal saat offline. Sistem otomatis menyinkronkan saat online.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOutboxModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#282828] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Stat Bar */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="bg-[#141414] border border-[#262626] rounded-xl p-2.5">
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Antrean</span>
                <span className="text-base font-bold text-white">{pendingTxList.length}</span>
              </div>
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-2.5">
                <span className="text-[10px] text-amber-400 block font-semibold uppercase">Pending</span>
                <span className="text-base font-bold text-amber-300">{pendingCount}</span>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5">
                <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Tersinkron</span>
                <span className="text-base font-bold text-emerald-300">
                  {pendingTxList.filter((t) => t.status === "SYNCED").length}
                </span>
              </div>
              <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-2.5">
                <span className="text-[10px] text-rose-400 block font-semibold uppercase">Gagal / Konflik</span>
                <span className="text-base font-bold text-rose-300">{failedCount}</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#252525]">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5" /> Jaringan Aktif
                  </span>
                ) : (
                  <span className="text-xs text-rose-400 flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5" /> Offline - Sambungkan internet untuk sinkronisasi
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {pendingTxList.some((t) => t.status === "SYNCED") && (
                  <button
                    onClick={async () => {
                      await db.pending_transactions.where("status").equals("SYNCED").delete();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-medium transition-colors"
                  >
                    Bersihkan Tersinkron
                  </button>
                )}

                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline || pendingCount === 0}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-purple-900/30"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}</span>
                </button>
              </div>
            </div>

            {/* Transaction List (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {pendingTxList.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium">Semua data transaksi sinkron!</p>
                  <p className="text-xs text-gray-600">Tidak ada transaksi yang tertunda di IndexedDB browser.</p>
                </div>
              ) : (
                pendingTxList.map((tx) => {
                  const txTotal = tx.payload_order?.payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0;
                  const itemCount = tx.payload_order?.items?.reduce((s, i) => s + (i.qty || 1), 0) || 0;

                  return (
                    <div
                      key={tx.idempotency_key}
                      className="bg-[#141414] border border-[#282828] hover:border-[#383838] rounded-xl p-3.5 text-xs transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-300">
                              #{tx.idempotency_key.slice(0, 16)}...
                            </span>
                            {tx.status === "PENDING" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <RotateCw className="w-2.5 h-2.5" /> PENDING
                              </span>
                            )}
                            {tx.status === "SYNCED" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> SYNCED
                              </span>
                            )}
                            {tx.status === "FAILED" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5" /> FAILED
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500">
                            {new Date(tx.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "medium",
                            })}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-400 block text-sm">
                            {formatRupiah(txTotal)}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {itemCount} item • Tier: {tx.payload_order?.pricing_tier || "retail"}
                          </span>
                        </div>
                      </div>

                      {/* Error Banner jika FAILED (e.g. 409 Conflict Stok Habis) */}
                      {tx.status === "FAILED" && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200 text-[11px] flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold block">Gagal Sinkronisasi:</span>
                            <span>{tx.error_message || "Konflik stok pada server cloud."}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="pt-4 border-t border-[#2a2a2a] mt-3 flex justify-end">
              <button
                onClick={() => setIsOutboxModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Komponen Cetak Struk & Kirim WhatsApp POS */}
      {receiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          type="SALE"
          transactionData={receiptData}
        />
      )}

      {/* =====================================================================
          MODAL 1: BUKA SHIFT KASIR
          ===================================================================== */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Buka Shift Kasir Baru</h3>
                  <p className="text-xs text-gray-400">Wajib diisi sebelum memproses transaksi kasir</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252525]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{shiftError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">ID Kasir</label>
                  <input
                    type="text"
                    value={shiftOpenForm.cashierId}
                    onChange={(e) => setShiftOpenForm({ ...shiftOpenForm, cashierId: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Nama Kasir</label>
                  <input
                    type="text"
                    value={shiftOpenForm.cashierName}
                    onChange={(e) => setShiftOpenForm({ ...shiftOpenForm, cashierName: e.target.value })}
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-gray-300">
                    Modal Kas Awal di Laci (Opening Cash)
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {formatRupiah(Number(shiftOpenForm.openingCash) || 0)}
                  </span>
                </div>
                <div className="relative">
                  <Coins className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={shiftOpenForm.openingCash}
                    onChange={(e) => setShiftOpenForm({ ...shiftOpenForm, openingCash: Number(e.target.value) })}
                    placeholder="Contoh: 500000"
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400">Pilihan Cepat:</span>
                  {[200000, 500000, 1000000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setShiftOpenForm({ ...shiftOpenForm, openingCash: val })}
                      className="px-2 py-0.5 rounded bg-[#222] hover:bg-[#333] border border-[#333] text-[10px] text-gray-300 font-mono transition-colors"
                    >
                      {formatRupiah(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-300 block mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={shiftOpenForm.notes}
                  onChange={(e) => setShiftOpenForm({ ...shiftOpenForm, notes: e.target.value })}
                  placeholder="Contoh: Pecahan uang 10rb, 20rb, dan 50rb"
                  className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="pt-5 border-t border-[#282828] mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingShift || !shiftOpenForm.cashierName}
                onClick={handleOpenShift}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2"
              >
                {isSubmittingShift ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                <span>Mulai Shift Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: TUTUP SHIFT KASIR & BLIND BALANCING
          ===================================================================== */}
      {isCloseShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {blindBalancingResult ? "Hasil Blind Balancing" : "Tutup Shift & Blind Balancing"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {blindBalancingResult ? "Verifikasi perbandingan kas fisik vs sistem" : "Audit kas fisik kasir secara objektif"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCloseShiftModalOpen(false);
                  setBlindBalancingResult(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252525]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{shiftError}</span>
              </div>
            )}

            {!blindBalancingResult ? (
              /* FORM INPUT BLIND BALANCING */
              <div className="space-y-4">
                {/* Info Shift Aktif */}
                <div className="p-3 rounded-xl bg-[#121212] border border-[#282828] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Petugas Kasir:</span>
                    <span className="font-bold text-white">{activeShift?.cashier_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px]">Modal Awal:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatRupiah(activeShift?.opening_cash || 0)}
                    </span>
                  </div>
                </div>

                {/* Banner Penjelasan Blind Balancing */}
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block">🔒 Mekanisme Blind Balancing:</span>
                    <span>
                      Untuk menjaga integritas dan transparansi audit, sistem menyembunyikan perkiraan omzet kasir.
                      Silakan hitung uang tunai di laci fisik dan masukkan jumlah totalnya di bawah ini.
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-300">
                      Total Uang Fisik di Laci Kasir (Closing Cash)
                    </label>
                    <span className="text-xs font-mono font-bold text-purple-400">
                      {formatRupiah(Number(shiftCloseForm.closingCash) || 0)}
                    </span>
                  </div>
                  <div className="relative">
                    <Coins className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={shiftCloseForm.closingCash || ""}
                      onChange={(e) => setShiftCloseForm({ ...shiftCloseForm, closingCash: Number(e.target.value) })}
                      placeholder="Masukkan total hitungan fisik laci..."
                      className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl pl-9 pr-3 py-2.5 text-base font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                    Catatan Penutupan / Keterangan Selisih (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={shiftCloseForm.notes}
                    onChange={(e) => setShiftCloseForm({ ...shiftCloseForm, notes: e.target.value })}
                    placeholder="Contoh: Ada uang kembalian 2.000 tidak diambil pelanggan..."
                    className="w-full bg-[#121212] border border-[#2b2b2b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-[#282828] mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCloseShiftModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 text-xs font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingShift}
                    onClick={handleCloseShift}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-amber-900/30 flex items-center gap-2"
                  >
                    {isSubmittingShift ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span>Submit & Hitung Selisih</span>
                  </button>
                </div>
              </div>
            ) : (
              /* KARTU KOMPARASI HASIL BLIND BALANCING */
              <div className="space-y-4">
                {/* 4 Kartu Metrik */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#121212] border border-[#282828]">
                    <span className="text-gray-400 block text-[10px]">Modal Kas Awal:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatRupiah(blindBalancingResult.opening_cash)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121212] border border-[#282828]">
                    <span className="text-gray-400 block text-[10px]">Penjualan Kas (Sistem):</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatRupiah(blindBalancingResult.cash_sales || 0)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121212] border border-[#282828]">
                    <span className="text-gray-400 block text-[10px]">Total Kas Ekspektasi:</span>
                    <span className="font-mono font-bold text-purple-300 text-sm">
                      {formatRupiah(blindBalancingResult.expected_cash || 0)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121212] border border-[#282828]">
                    <span className="text-gray-400 block text-[10px]">Kas Fisik Diinput:</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">
                      {formatRupiah(blindBalancingResult.closing_cash || 0)}
                    </span>
                  </div>
                </div>

                {/* Status Variansi */}
                {(blindBalancingResult.variance === 0 || blindBalancingResult.variance === null) ? (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-sm block text-emerald-300 mb-0.5">
                        ✅ KAS SEIMBANG / KLOP (Selisih: Rp 0)
                      </span>
                      <span>
                        Luar biasa! Hitungan fisik kasir cocok 100% dengan catatan sistem. Transaksi shift telah berhasil ditutup dan dibukukan.
                      </span>
                    </div>
                  </div>
                ) : (blindBalancingResult.variance || 0) < 0 ? (
                  <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-sm block text-rose-300 mb-0.5">
                        ❌ DEFISIT / MINUS KAS: {formatRupiah(blindBalancingResult.variance || 0)}
                      </span>
                      <span>
                        Terdapat kekurangan kas fisik di laci kasir sebesar{" "}
                        <strong className="text-rose-300">{formatRupiah(Math.abs(blindBalancingResult.variance || 0))}</strong>{" "}
                        dibandingkan perhitungan sistem. Selisih ini telah dicatat permanen dalam audit trail shift.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-sm block text-blue-300 mb-0.5">
                        ⚠️ SURPLUS / LEBIH KAS: +{formatRupiah(blindBalancingResult.variance || 0)}
                      </span>
                      <span>
                        Terdapat kelebihan kas fisik di laci kasir sebesar{" "}
                        <strong className="text-blue-300">+{formatRupiah(blindBalancingResult.variance || 0)}</strong>.
                        Kelebihan ini telah didokumentasikan dalam log shift.
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[#282828] mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCloseShiftModalOpen(false);
                      setBlindBalancingResult(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/30"
                  >
                    Selesai & Tutup Jendela
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: PEMILIH PROFIL BISNIS / INDUSTRI UNIVERSAL
          ===================================================================== */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#282828] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Pilih Profil Industri Bisnis</h3>
                  <p className="text-xs text-gray-400">
                    Antarmuka kasir & terminologi toko akan otomatis menyesuaikan bidang usaha Anda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPresetModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252525]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {(Object.keys(BUSINESS_PRESETS) as BusinessType[]).map((key) => {
                const preset = BUSINESS_PRESETS[key];
                const isSelected = activePreset.id === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-purple-950/30 border-purple-500 shadow-md shadow-purple-900/20"
                        : "bg-[#141414] border-[#292929] hover:border-purple-500/50 hover:bg-[#1a1a1a]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {preset.id === "RETAIL" && "🛒"}
                          {preset.id === "BENGKEL" && "🔧"}
                          {preset.id === "HVAC" && "❄️"}
                          {preset.id === "SELLER_ONLINE" && "📦"}
                          {preset.id === "GADGET" && "📱"}
                          {preset.id === "FASHION" && "👗"}
                          <span>{preset.name}</span>
                        </span>
                        {isSelected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-600 text-white flex items-center gap-1">
                            <Check className="w-3 h-3" /> Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug mb-2">
                        {preset.tagline}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[10px] text-purple-300">
                      <span>Modul: {preset.hasServiceMode ? "Kasir + Servis" : "Kasir Cepat"}</span>
                      <span className="font-mono text-gray-500">Preset: {preset.shortTag}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#282828] mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>💡 Pilihan preset tersimpan otomatis dan bisa diubah kapan saja.</span>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-gray-300 font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: DAFTARKAN PELANGGAN BARU CEPAT (POS REGISTRATION)
          ===================================================================== */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsQuickAddOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Daftarkan Pelanggan Baru</h3>
                <p className="text-xs text-gray-400">Input data singkat untuk aktivasi auto-tiering di kasir</p>
              </div>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Nama Pelanggan / Usaha <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickAddForm.name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  placeholder="Contoh: Budi Santoso / Bengkel Hendra"
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Nomor WhatsApp <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickAddForm.phone}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                  placeholder="Contoh: 08123456789"
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Tiering Harga Awal <span className="text-rose-400">*</span>
                </label>
                <select
                  value={quickAddForm.tier}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, tier: e.target.value as PricingTier })}
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="retail">Retail (Konsumen Umum / Eceran)</option>
                  <option value="reseller">Reseller (Grosir / Toko Rekanan - Diskon 10%)</option>
                  <option value="technician">Teknisi (Mitra Jasa / Servis - Harga Khusus)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  💡 Tier ini akan otomatis aktif setiap kali kasir mengetik nama pelanggan ini.
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Alamat / Catatan Lokasi (Opsional)
                </label>
                <input
                  type="text"
                  value={quickAddForm.address}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, address: e.target.value })}
                  placeholder="Contoh: Ruko ITC Lt 2 No 10"
                  className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2b2b2b] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-900/30"
                >
                  {isSavingCustomer ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan & Pilih Pelanggan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =====================================================================
          MODAL: GANTI KASIR / KUNCI POS (STAFF SWITCHER RBAC)
          ===================================================================== */}
      {isStaffSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsStaffSwitchModalOpen(false);
                setSelectedStaffToSwitch(null);
                setSwitchPinInput("");
                setSwitchPinError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Ganti Kasir / Kunci POS</h3>
                <p className="text-xs text-gray-400">Kasir aktif: <strong>{activeStaffUser.name}</strong></p>
              </div>
            </div>

            {!selectedStaffToSwitch ? (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-300 font-semibold">Pilih staf kasir yang akan bertugas:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {availableStaffList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Memuat daftar staf...
                    </div>
                  ) : (
                    availableStaffList.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaffToSwitch(st);
                          setSwitchPinInput("");
                          setSwitchPinError(null);
                        }}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                          activeStaffUser.id === st.id 
                            ? "bg-purple-950/25 border-purple-500 text-white" 
                            : "bg-[#141414] border-[#292929] hover:bg-[#202020] text-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-xs text-blue-300">
                            {st.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{st.name}</p>
                            <p className="text-[10px] text-gray-400">Posisi: {ROLE_LABELS[st.role] || st.role}</p>
                          </div>
                        </div>
                        {activeStaffUser.id === st.id ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                            Sedang Aktif
                          </span>
                        ) : (
                          <span className="text-xs text-blue-400 font-medium">Pilih & Masukkan PIN →</span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-[#262626] flex items-center justify-between">
                  <a
                    href="/settings/team"
                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                  >
                    ⚙️ Buka Pengaturan Tim
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsStaffSwitchModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#222] text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmSwitchStaff} className="space-y-4">
                <div className="p-3 rounded-xl bg-[#141414] border border-[#2a2a2a] flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-xs text-purple-300">
                    {selectedStaffToSwitch.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Konfirmasi PIN: {selectedStaffToSwitch.name}</p>
                    <p className="text-[10px] text-gray-400">Ketik 4 digit PIN untuk verifikasi login kasir</p>
                  </div>
                </div>

                {switchPinError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{switchPinError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-gray-300 font-semibold block">
                    PIN Kasir (4-6 Digit Angka)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    autoFocus
                    required
                    value={switchPinInput}
                    onChange={(e) => setSwitchPinInput(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••"
                    className="w-full bg-[#121212] border border-[#2e2e2e] rounded-xl px-4 py-3 text-base text-white text-center font-mono tracking-widest focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaffToSwitch(null);
                      setSwitchPinInput("");
                      setSwitchPinError(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2b2b2b] text-gray-300 text-xs font-semibold"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30"
                  >
                    Konfirmasi & Aktifkan Kasir
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
