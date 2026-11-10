export type BusinessType = 
  | "RETAIL" 
  | "BENGKEL" 
  | "HVAC" 
  | "SELLER_ONLINE" 
  | "GADGET" 
  | "FASHION";

export interface ServiceFieldConfig {
  unitLabel: string;
  unitPlaceholder: string;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  issueLabel: string;
  issuePlaceholder: string;
  costLabel: string;
}

export interface BusinessPresetConfig {
  id: BusinessType;
  name: string;
  shortTag: string;
  tagline: string;
  posTitle: string;
  itemTypeLabel: string;
  skuLabel: string;
  hasServiceMode: boolean;
  serviceNavTitle: string | null;
  serviceModalTitle: string;
  serviceFields: ServiceFieldConfig;
  categories: string[];
}

export const BUSINESS_PRESETS: Record<BusinessType, BusinessPresetConfig> = {
  RETAIL: {
    id: "RETAIL",
    name: "Toko Retail & Kelontong",
    shortTag: "Retail",
    tagline: "Penjualan cepat, scan barcode, dan manajemen stok toko",
    posTitle: "Kasir & Point of Sale",
    itemTypeLabel: "Produk & Barang",
    skuLabel: "Barcode / SKU",
    hasServiceMode: false,
    serviceNavTitle: null,
    serviceModalTitle: "Layanan Khusus",
    serviceFields: {
      unitLabel: "Keterangan Pesanan",
      unitPlaceholder: "Catatan khusus pesanan...",
      issueLabel: "Instruksi Tambahan",
      issuePlaceholder: "Misal: bungkus kado, antar sore...",
      costLabel: "Biaya Layanan Tambahan (Rp)",
    },
    categories: ["All", "Makanan & Minuman", "Kebutuhan Pokok", "Alat Tulis", "Lainnya"],
  },
  BENGKEL: {
    id: "BENGKEL",
    name: "Bengkel Motor & Mobil",
    shortTag: "Bengkel",
    tagline: "Pengerjaan servis, pergantian sparepart, dan komisi mekanik",
    posTitle: "Kasir & Servis Bengkel",
    itemTypeLabel: "Sparepart & Jasa Mekanik",
    skuLabel: "No. Part / SKU",
    hasServiceMode: true,
    serviceNavTitle: "Servis Kendaraan",
    serviceModalTitle: "Penerimaan Servis Kendaraan",
    serviceFields: {
      unitLabel: "Merk & Tipe Kendaraan",
      unitPlaceholder: "Honda Vario 150 / Avanza 2018",
      secondaryLabel: "Nomor Polisi (Plat)",
      secondaryPlaceholder: "B 1234 XYZ",
      issueLabel: "Keluhan & Permintaan Servis",
      issuePlaceholder: "Ganti oli mesin, rem bunyi, servis berkala...",
      costLabel: "Estimasi Biaya Jasa Mekanik (Rp)",
    },
    categories: ["All", "Oli & Pelumas", "Sparepart Mesin", "Pengereman", "Jasa Servis"],
  },
  HVAC: {
    id: "HVAC",
    name: "Kontraktor HVAC & Servis AC",
    shortTag: "HVAC / AC",
    tagline: "Penjadwalan cuci AC, perbaikan freon, dan material instalasi",
    posTitle: "Kasir & Layanan HVAC / AC",
    itemTypeLabel: "Material & Jasa Teknisi AC",
    skuLabel: "Kode Part / Material",
    hasServiceMode: true,
    serviceNavTitle: "Pekerjaan AC",
    serviceModalTitle: "Order Layanan Servis & Pasang AC",
    serviceFields: {
      unitLabel: "Merk & Kapasitas AC (PK)",
      unitPlaceholder: "Daikin Inverter 1 PK / Panasonic 1/2 PK",
      secondaryLabel: "Lokasi Unit & Lantai",
      secondaryPlaceholder: "Lantai 2 - Kamar Utama / Ruko Lt 1",
      issueLabel: "Keluhan & Jenis Pekerjaan",
      issuePlaceholder: "AC tidak dingin, cuci rutin, tambah freon R32...",
      costLabel: "Estimasi Jasa Pengerjaan Teknisi (Rp)",
    },
    categories: ["All", "Pipa & Isolasi", "Gas Freon", "Komponen Elektrik", "Jasa Cuci & Pasang"],
  },
  SELLER_ONLINE: {
    id: "SELLER_ONLINE",
    name: "Seller Online & E-Commerce",
    shortTag: "E-Commerce",
    tagline: "Order fulfillment multi-channel (TikTok Shop, Shopee, Tokopedia)",
    posTitle: "Kasir & Order Fulfillment",
    itemTypeLabel: "Katalog Produk Marketplace",
    skuLabel: "SKU Induk / SKU Varian",
    hasServiceMode: false,
    serviceNavTitle: null,
    serviceModalTitle: "Layanan Packing Khusus",
    serviceFields: {
      unitLabel: "Channel Pesanan",
      unitPlaceholder: "Shopee / TikTok Shop / Tokopedia",
      secondaryLabel: "Nomor Resi / Pesanan",
      secondaryPlaceholder: "SPX-ID-123456789",
      issueLabel: "Catatan Packing",
      issuePlaceholder: "Extra bubble wrap, packing kayu...",
      costLabel: "Ongkir / Packing Tambahan (Rp)",
    },
    categories: ["All", "Best Seller", "Produk Flash Sale", "Aksesoris", "Kemasan & Packing"],
  },
  GADGET: {
    id: "GADGET",
    name: "Retail Gadget & Servis HP",
    shortTag: "Gadget / HP",
    tagline: "Suku cadang smartphone, aksesoris, dan reparasi perangkat",
    posTitle: "Kasir Gadget & Suku Cadang",
    itemTypeLabel: "Suku Cadang & Aksesoris",
    skuLabel: "IMEI / Barcode / SKU",
    hasServiceMode: true,
    serviceNavTitle: "Pusat Servis HP",
    serviceModalTitle: "Penerimaan Servis Perangkat HP",
    serviceFields: {
      unitLabel: "Tipe & Seri HP/Gadget",
      unitPlaceholder: "iPhone 11 64GB / Samsung S21",
      secondaryLabel: "Nomor IMEI / Seri",
      secondaryPlaceholder: "354872091827364",
      issueLabel: "Keluhan Kerusakan",
      issuePlaceholder: "Layar pecah, baterai drop, mati total...",
      costLabel: "Estimasi Biaya Jasa Servis (Rp)",
    },
    categories: ["All", "Sparepart", "Aksesoris", "Jasa Service"],
  },
  FASHION: {
    id: "FASHION",
    name: "Butik & Toko Pakaian",
    shortTag: "Fashion",
    tagline: "Varian ukuran & warna, diskon member, dan kasir butik",
    posTitle: "Kasir Butik & Fashion",
    itemTypeLabel: "Pakaian & Aksesoris Gaya",
    skuLabel: "Barcode / SKU Ukuran",
    hasServiceMode: false,
    serviceNavTitle: null,
    serviceModalTitle: "Layanan Permak Pakaian",
    serviceFields: {
      unitLabel: "Jenis Pakaian",
      unitPlaceholder: "Celana Jeans / Kemeja Linen",
      issueLabel: "Instruksi Permak / Potong",
      issuePlaceholder: "Potong bawah 3 cm, kecilkan pinggang...",
      costLabel: "Biaya Jasa Permak (Rp)",
    },
    categories: ["All", "Atasan / Baju", "Bawahan / Celana", "Dress & Outer", "Aksesoris Fashion"],
  },
};

// Default universal fallback
export const DEFAULT_BUSINESS_TYPE: BusinessType = "RETAIL";

/**
 * Mengambil preset aktif dari localStorage browser jika ada, atau fallback ke default.
 */
export function getActiveBusinessPreset(): BusinessPresetConfig {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("nexus_active_business_preset") as BusinessType;
      if (saved && BUSINESS_PRESETS[saved]) {
        return BUSINESS_PRESETS[saved];
      }
    } catch (e) {
      console.warn("Gagal membaca preset bisnis dari localStorage", e);
    }
  }
  return BUSINESS_PRESETS[DEFAULT_BUSINESS_TYPE];
}

/**
 * Menyimpan preset bisnis aktif ke localStorage browser dan memancarkan event ke komponen lain.
 */
export function setActiveBusinessPreset(preset: BusinessType): BusinessPresetConfig {
  const chosen = BUSINESS_PRESETS[preset] || BUSINESS_PRESETS[DEFAULT_BUSINESS_TYPE];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("nexus_active_business_preset", preset);
      // Dispatch custom window event agar komponen lain (Sidebar, POS) langsung sinkron tanpa refresh
      window.dispatchEvent(new CustomEvent("nexus_preset_changed", { detail: chosen }));
    } catch (e) {
      console.warn("Gagal menyimpan preset bisnis ke localStorage", e);
    }
  }
  return chosen;
}
