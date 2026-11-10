"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { 
  Store, 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  CheckCircle2, 
  ExternalLink, 
  MessageCircle, 
  MapPin, 
  ShieldCheck, 
  Sparkles,
  Phone,
  Package,
  Layers,
  ArrowRight
} from "lucide-react";
import { 
  getPublicStorefront, 
  formatRupiah, 
  PublicStorefrontResponse, 
  StorefrontItem 
} from "@/lib/api";

interface CartItem {
  item: StorefrontItem;
  qty: number;
}

export default function PublicStorefrontPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "demo-store";

  const [storeData, setStoreData] = useState<PublicStorefrontResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Shopping Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Form Checkout WhatsApp
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    async function loadStore() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data = await getPublicStorefront(slug);
        setStoreData(data);
      } catch (err: any) {
        console.error("Gagal memuat etalase toko:", err);
        setErrorMsg(err.message || "Gagal memuat katalog toko.");
      } finally {
        setIsLoading(false);
      }
    }
    loadStore();
  }, [slug]);

  // Kategori unik
  const categories = useMemo(() => {
    if (!storeData?.items) return ["ALL"];
    const cats = new Set<string>();
    cats.add("ALL");
    storeData.items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [storeData]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!storeData?.items) return [];
    return storeData.items.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [storeData, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (item: StorefrontItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { item, qty: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.qty + delta;
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const totalCartPrice = useMemo(() => {
    return cart.reduce((acc, c) => acc + c.item.price * c.qty, 0);
  }, [cart]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, c) => acc + c.qty, 0);
  }, [cart]);

  // Generate WhatsApp Direct Order Link
  const handleCheckoutWhatsApp = () => {
    if (cart.length === 0) return;
    if (!customerName.trim()) {
      alert("Harap masukkan nama pemesan terlebih dahulu.");
      return;
    }

    const waNumber = storeData?.whatsapp_number || "6281234567890";
    const cleanWa = waNumber.replace(/\D/g, "");

    let message = `Halo ${storeData?.store_name || "Toko"}! 👋\nSaya ingin memesan produk dari katalog online Anda:\n\n`;
    cart.forEach((c, idx) => {
      message += `${idx + 1}. *${c.item.name}* (${c.qty}x) - ${formatRupiah(c.item.price * c.qty)}\n`;
    });

    message += `\n*Total Tagihan:* ${formatRupiah(totalCartPrice)}`;
    message += `\n*Nama Pemesan:* ${customerName.trim()}`;
    if (customerAddress.trim()) {
      message += `\n*Alamat / Pengiriman:* ${customerAddress.trim()}`;
    }
    message += `\n\nMohon konfirmasi ketersediaan stok & nomor rekening pembayarannya ya. Terima kasih!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanWa}?text=${encoded}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Store className="w-12 h-12 text-purple-500 animate-pulse mx-auto" />
          <p className="text-sm text-slate-400">Menyiapkan etalase toko online...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* =========================================================================
          STOREFRONT HEADER BANNER
      ========================================================================= */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> BUKA
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-400" /> Toko Resmi Terverifikasi
                </span>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Store className="w-8 h-8 text-purple-400" />
                {storeData?.store_name}
              </h1>

              <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
                {storeData?.description || storeData?.tagline}
              </p>

              {storeData?.address && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{storeData.address}</span>
                </div>
              )}
            </div>

            {/* Quick Contact & Cart Button Header */}
            <div className="flex items-center gap-3">
              <a
                href={`https://wa.me/${storeData?.whatsapp_number?.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat Kasir WhatsApp</span>
              </a>

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl transition-colors"
                title="Lihat Keranjang Belanja"
              >
                <ShoppingCart className="w-5 h-5 text-purple-400" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-pink-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow">
                    {totalCartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CATALOG SECTION: SEARCH & CATEGORY FILTER
      ========================================================================= */}
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari produk atau suku cadang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Kategori Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {cat === "ALL" ? "Semua Produk" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================================
            PRODUCT GRID
        ========================================================================= */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm space-y-2">
            <Package className="w-12 h-12 text-slate-700 mx-auto" />
            <p>Tidak ada produk yang cocok dengan pencarian Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-purple-950/20 space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono">
                      {item.category || "Umum"}
                    </span>
                    <span className={`font-semibold ${item.stock_available > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {item.stock_available > 0 ? `Stok ${item.stock_available}` : "Habis"}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">
                    {item.name}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Harga</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  <button
                    onClick={() => addToCart(item)}
                    disabled={item.stock_available <= 0}
                    className="p-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-colors shadow-md shadow-purple-950/40 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Beli</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          FLOATING SHOPPING CART DRAWER (WHATSAPP CHECKOUT)
      ========================================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl animate-in slide-in-from-right">
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white">Keranjang Belanja</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300">
                  {totalCartCount} item
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-20 text-center text-slate-500 text-xs">
                  Keranjang belanja masih kosong.
                </div>
              ) : (
                cart.map(({ item, qty }) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-200 truncate">{item.name}</p>
                      <p className="font-mono text-emerald-400 font-bold mt-0.5">
                        {formatRupiah(item.price * qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
                      <button
                        onClick={() => updateCartQty(item.id, -1)}
                        className="p-1 hover:text-purple-400"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono px-1.5 font-bold">{qty}</span>
                      <button
                        onClick={() => updateCartQty(item.id, 1)}
                        className="p-1 hover:text-purple-400"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Checkout Form & Direct WhatsApp Button */}
            {cart.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nama Pemesan (contoh: Budi Santoso) *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Alamat / Catatan Pengiriman (Opsional)"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-white pt-1">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-emerald-400 text-base">{formatRupiah(totalCartPrice)}</span>
                </div>

                <button
                  onClick={handleCheckoutWhatsApp}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Pesanan via WhatsApp</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
