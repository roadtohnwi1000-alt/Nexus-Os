"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  PackagePlus, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  RefreshCw, 
  Warehouse, 
  Truck, 
  FileText, 
  Calculator, 
  AlertCircle,
  ClipboardCheck,
  ShieldCheck,
  BoxSelect
} from "lucide-react";
import { 
  getItems, 
  getLocations, 
  createGRN, 
  Item, 
  Location, 
  GRNResult, 
  formatRupiah 
} from "@/lib/api";

interface GRNRowState {
  item_id: string;
  qty: number;
  purchase_price: number;
  package_intact: boolean;
  physical_ok: boolean;
  qty_matched: boolean;
}

export default function GoodsReceiptNotePage() {
  const [itemsCatalog, setItemsCatalog] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectorName, setInspectorName] = useState("Staff Gudang (Andi)");
  const [inspectionStage, setInspectionStage] = useState<"INPUT" | "INSPECTION" | "VERIFIED">("INSPECTION");

  // Form State
  const [supplierName, setSupplierName] = useState("PT Sinar Sparepart Indonesia");
  const [deliveryOrderNumber, setDeliveryOrderNumber] = useState("DO-2026-8812");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [notes, setNotes] = useState("Penerimaan restok sparepart mingguan via ekspedisi");

  // Dynamic Rows
  const [rows, setRows] = useState<GRNRowState[]>([
    { 
      item_id: "", 
      qty: 10, 
      purchase_price: 320000,
      package_intact: true,
      physical_ok: true,
      qty_matched: true
    }
  ]);

  // Submission Result
  const [grnResult, setGrnResult] = useState<GRNResult | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, locsData] = await Promise.all([
        getItems(),
        getLocations()
      ]);
      setItemsCatalog(itemsData);
      setLocations(locsData);

      // Default ke Gudang Pusat
      const defaultLoc = locsData.find(l => l.name.toLowerCase().includes("pusat") || l.type === "warehouse");
      if (defaultLoc) {
        setSelectedLocationId(defaultLoc.id);
      } else if (locsData.length > 0) {
        setSelectedLocationId(locsData[0].id);
      }

      // Default item pertama jika ada
      if (itemsData.length > 0) {
        setRows([
          {
            item_id: itemsData[0].id,
            qty: 10,
            purchase_price: itemsData[0].base_price || 300000,
            package_intact: true,
            physical_ok: true,
            qty_matched: true
          }
        ]);
      }
    } catch (err) {
      console.warn("Gagal memuat katalog atau lokasi:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRow = () => {
    const firstItemId = itemsCatalog.length > 0 ? itemsCatalog[0].id : "";
    const firstItemPrice = itemsCatalog.length > 0 ? itemsCatalog[0].base_price || 150000 : 150000;
    setRows(prev => [...prev, { 
      item_id: firstItemId, 
      qty: 5, 
      purchase_price: firstItemPrice,
      package_intact: true,
      physical_ok: true,
      qty_matched: true
    }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof GRNRowState, value: any) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      // Jika ganti item, sesuaikan default purchase_price jika belum diubah
      if (field === "item_id") {
        const selectedItem = itemsCatalog.find(it => it.id === value);
        if (selectedItem) {
          copy[index].purchase_price = selectedItem.base_price || 100000;
        }
      }
      return copy;
    });
  };

  // Grand Total Calculation
  const grandTotal = rows.reduce((sum, r) => sum + (Number(r.qty || 0) * Number(r.purchase_price || 0)), 0);
  const totalQty = rows.reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0 || rows.some(r => !r.item_id || r.qty <= 0)) {
      alert("Mohon lengkapi seluruh item dan pastikan kuantitas > 0.");
      return;
    }

    setIsSubmitting(true);
    setGrnResult(null);

    try {
      const res = await createGRN({
        supplier_name: supplierName,
        delivery_order_number: deliveryOrderNumber,
        location_id: selectedLocationId || undefined,
        notes,
        items: rows.map(r => ({
          item_id: r.item_id,
          qty: Number(r.qty),
          purchase_price: Number(r.purchase_price)
        }))
      });

      setGrnResult(res);
    } catch (err: any) {
      alert("Gagal memproses GRN: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Link 
              href="/inventory"
              className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#1f1f1f] hover:bg-[#2a2a2a] text-gray-400 hover:text-white border border-[#333] transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Inventaris
            </Link>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <PackagePlus className="w-3.5 h-3.5 text-emerald-400" />
              Goods Receipt Note (GRN)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Penerimaan Barang Supplier & Moving Average HPP
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Merekam penerimaan fisik dari supplier, memperbarui stok Gudang Pusat, dan menghitung ulang HPP secara akurat menggunakan rumus Moving Average.
          </p>
        </div>
      </div>

      {/* Workflow Step Indicator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <p className="text-xs font-bold text-white">Surat Jalan (DO)</p>
            <p className="text-[10px] text-gray-400">Verifikasi dokumen pengiriman ekspedisi</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#141414] border border-emerald-500/30 bg-emerald-950/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-300">Pemeriksaan Fisik Lapangan</p>
            <p className="text-[10px] text-emerald-400/80">Cek kemasan, segel, dan unit tanpa cacat</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <div>
            <p className="text-xs font-bold text-white">Update Moving Average HPP</p>
            <p className="text-[10px] text-gray-400">Posting ke persediaan & jurnal hutang AP</p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal if Success */}
      {grnResult && (
        <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-4 animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Penerimaan Barang Berhasil Disimpan: <span className="font-mono text-emerald-300">{grnResult.grn_number}</span>
                </h3>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Surat Jalan: {grnResult.delivery_order_number || "-"} • Lokasi: {grnResult.location_name} • Total Biaya: {formatRupiah(grnResult.total_cost)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setGrnResult(null)}
              className="px-3 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-xs text-white"
            >
              ✕ Tutup
            </button>
          </div>

          <div className="overflow-x-auto bg-[#0f0f0f] rounded-xl border border-[#222] p-3 text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 pb-2">
                  <th className="pb-2">Barang</th>
                  <th className="pb-2 text-center">Qty Masuk</th>
                  <th className="pb-2 text-right">Harga Beli</th>
                  <th className="pb-2 text-right">Subtotal</th>
                  <th className="pb-2 text-right">HPP Lama</th>
                  <th className="pb-2 text-right text-emerald-400">HPP Baru (Moving Avg)</th>
                  <th className="pb-2 text-center">Stok Baru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1c1c]">
                {grnResult.details.map((d) => (
                  <tr key={d.item_id}>
                    <td className="py-2.5 font-medium text-white">
                      {d.item_name} <span className="font-mono text-[10px] text-gray-500">({d.sku})</span>
                    </td>
                    <td className="py-2.5 text-center font-bold text-white">+{d.qty_received}</td>
                    <td className="py-2.5 text-right font-mono text-gray-300">{formatRupiah(d.purchase_price)}</td>
                    <td className="py-2.5 text-right font-mono text-white">{formatRupiah(d.subtotal)}</td>
                    <td className="py-2.5 text-right font-mono text-gray-400 line-through">{formatRupiah(d.old_hpp)}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{formatRupiah(d.new_moving_average_hpp)}</td>
                    <td className="py-2.5 text-center font-mono text-gray-300">{d.new_total_stock} pcs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-emerald-400/90 pt-1">
            <span>✓ Auto-Journal Double-Entry: DEBIT Persediaan (1200) • KREDIT Hutang Usaha (2000)</span>
            <Link 
              href="/inventory"
              className="font-semibold underline hover:text-white"
            >
              Lihat di Daftar Inventaris →
            </Link>
          </div>
        </div>
      )}

      {/* Main GRN Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Fields Card */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            Informasi Dokumen Penerimaan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Nama Supplier:
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="Contoh: PT Sinar Sparepart"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                No. Surat Jalan (DO):
              </label>
              <input
                type="text"
                value={deliveryOrderNumber}
                onChange={(e) => setDeliveryOrderNumber(e.target.value)}
                required
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                placeholder="Contoh: DO-2026-8812"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Gudang Penerima:
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                required
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Catatan Penerimaan:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="Keterangan pengiriman"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Items Table */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Daftar Barang & Simulasi Moving Average HPP
            </h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 rounded-lg bg-[#222] hover:bg-[#2e2e2e] text-xs font-semibold text-emerald-400 flex items-center gap-1.5 border border-[#333] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Baris
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] text-gray-400 uppercase font-semibold">
                  <th className="pb-3 min-w-[240px]">Pilih Produk / Sparepart</th>
                  <th className="pb-3 text-center w-24">Qty Diterima</th>
                  <th className="pb-3 text-right w-36">Harga Beli (Rp)</th>
                  <th className="pb-3 text-right w-32">Subtotal</th>
                  <th className="pb-3 text-right w-44 text-emerald-400">HPP Moving Average</th>
                  <th className="pb-3 text-center w-48 text-cyan-300">Cek Fisik (QC Lapangan)</th>
                  <th className="pb-3 text-center w-12">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]">
                {rows.map((row, idx) => {
                  const selectedItem = itemsCatalog.find(it => it.id === row.item_id);
                  const subtotal = Number(row.qty || 0) * Number(row.purchase_price || 0);

                  // Simulasi Moving Average realtime di form:
                  const oldStock = 10; // asumsi stok lama
                  const oldHpp = selectedItem ? Number(selectedItem.base_price || 0) : 0;
                  const newQty = Number(row.qty || 0);
                  const newPrice = Number(row.purchase_price || 0);
                  const totalSimStock = oldStock + newQty;
                  const simulatedNewHpp = totalSimStock > 0 
                    ? Math.round(((oldStock * oldHpp) + (newQty * newPrice)) / totalSimStock)
                    : newPrice;

                  return (
                    <tr key={idx} className="hover:bg-[#1a1a1a] transition">
                      <td className="py-3">
                        <select
                          value={row.item_id}
                          onChange={(e) => handleRowChange(idx, "item_id", e.target.value)}
                          required
                          className="w-full bg-[#1c1c1c] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Pilih Barang --</option>
                          {itemsCatalog.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.sku}) • HPP: {formatRupiah(it.base_price || 0)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={row.qty}
                          onChange={(e) => handleRowChange(idx, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                          required
                          className="w-16 text-center bg-[#1c1c1c] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={row.purchase_price}
                          onChange={(e) => handleRowChange(idx, "purchase_price", parseInt(e.target.value) || 0)}
                          required
                          className="w-28 text-right bg-[#1c1c1c] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="py-3 text-right font-mono font-semibold text-white">
                        {formatRupiah(subtotal)}
                      </td>

                      <td className="py-3 text-right font-mono text-xs">
                        <span className="font-bold text-emerald-400">
                          {formatRupiah(simulatedNewHpp)}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          dari {formatRupiah(oldHpp)}
                        </div>
                      </td>

                      {/* Checklist Fisik Lapangan */}
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1.5 bg-[#181818] p-1.5 rounded-lg border border-[#2a2a2a]">
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-300" title="Kemasan Luar Segel Utuh">
                            <input
                              type="checkbox"
                              checked={row.package_intact}
                              onChange={(e) => handleRowChange(idx, "package_intact", e.target.checked)}
                              className="accent-emerald-500 rounded"
                            />
                            <span>Segel</span>
                          </label>
                          <span className="text-gray-600">|</span>
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-300" title="Kondisi Fisik Bebas Retak/Cacat">
                            <input
                              type="checkbox"
                              checked={row.physical_ok}
                              onChange={(e) => handleRowChange(idx, "physical_ok", e.target.checked)}
                              className="accent-emerald-500 rounded"
                            />
                            <span>Fisik OK</span>
                          </label>
                          <span className="text-gray-600">|</span>
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-300" title="Jumlah Fisik Cocok dengan Surat Jalan">
                            <input
                              type="checkbox"
                              checked={row.qty_matched}
                              onChange={(e) => handleRowChange(idx, "qty_matched", e.target.checked)}
                              className="accent-emerald-500 rounded"
                            />
                            <span>Cocok</span>
                          </label>
                        </div>
                      </td>

                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={rows.length <= 1}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Summary Footer */}
          <div className="pt-4 border-t border-[#262626] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400">
              Total Barang: <span className="font-bold text-white">{rows.length} SKU</span> ({totalQty} unit)
            </div>

            <div className="flex items-center gap-6 text-sm">
              <span className="text-gray-400">Total Nilai Penerimaan:</span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono">
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Physical Inspector Sign-off Card */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Petugas Pemeriksa Fisik (QC Receiving)</p>
              <p className="text-[10px] text-gray-400">Verifikasi fisik barang gudang sebelum posting ke HPP Moving Average</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="bg-[#1c1c1c] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="Nama Pemeriksa"
            />
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold whitespace-nowrap">
              Status: DRAFT_INSPECTED
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/inventory"
            className="px-5 py-2.5 rounded-xl bg-[#222] hover:bg-[#2c2c2c] text-xs font-semibold text-gray-300 transition"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || grandTotal <= 0}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isSubmitting ? "Menyimpan & Menjurnal..." : "Konfirmasi Penerimaan Barang (GRN)"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
