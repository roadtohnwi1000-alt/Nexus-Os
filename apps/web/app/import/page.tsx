"use client";

import { useState, useRef } from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  ArrowRight,
  Database,
  Building2,
  Package,
  Info,
  Check,
  AlertCircle
} from "lucide-react";
import { 
  importItemsCSV, 
  importContactsCSV, 
  ImportResult, 
  formatRupiah 
} from "@/lib/api";

type ImportTab = "items" | "contacts";

export default function DataImportPage() {
  const [activeTab, setActiveTab] = useState<ImportTab>("items");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ganti tab aktif dan reset status file sebelumnya
  const handleTabChange = (tab: ImportTab) => {
    setActiveTab(tab);
    setSelectedFile(null);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setImportResult(null);

    // Validasi format file
    const validExtensions = [".csv", ".xlsx", ".txt"];
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(extension)) {
      setErrorMessage("Format file tidak didukung. Harap gunakan file CSV (.csv) atau Excel (.xlsx).");
      return;
    }

    // Validasi batas ukuran 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Ukuran file melebihi batas maksimal 5MB.");
      return;
    }

    setSelectedFile(file);
  };

  // Handler Download Template CSV
  const handleDownloadTemplate = () => {
    let csvContent = "";
    let filename = "";

    if (activeTab === "items") {
      filename = "template_produk_accurate.csv";
      csvContent = 
        "SKU,Nama Barang,Harga Jual,Stok,Tipe,Kategori,Brand\n" +
        "LCD-IPH-11,LCD iPhone 11 Original OEM,650000,15,stocked,Sparepart,Apple\n" +
        "BAT-SAM-S21,Baterai Samsung Galaxy S21,320000,10,stocked,Sparepart,Samsung\n" +
        "CAS-MAG-CLR,Casing MagSafe Clear Armor,75000,50,stocked,Aksesoris,Universal\n" +
        "SRV-PASANG-LCD,Jasa Pasang LCD & Kalibrasi,100000,0,service,Jasa Service,Internal\n";
    } else {
      filename = "template_kontak_salesforce.csv";
      csvContent = 
        "Nama,No HP,Email,Perusahaan,Tipe\n" +
        "Budi Santoso,081234567890,budi.santoso@gmail.com,PT Maju Bersama,person\n" +
        "Siti Rahma,085678901234,siti.rahma@techindo.co.id,TechIndo Solusi,person\n" +
        "CV Surya Sparepart,082198765432,sales@suryasparepart.com,CV Surya Sparepart,org\n" +
        "dr. Andi Wijaya,081122334455,andi.wijaya@medikaclinic.id,Medika Clinic,person\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handler Upload & Proses Impor
  const handleStartImport = async () => {
    if (!selectedFile) {
      setErrorMessage("Silakan pilih atau tarik file terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let res: ImportResult;
      if (activeTab === "items") {
        res = await importItemsCSV(selectedFile);
      } else {
        res = await importContactsCSV(selectedFile);
      }
      setImportResult(res);
    } catch (err: any) {
      // Fallback jika backend offline untuk demo UI interaktif
      setErrorMessage(err.message || "Gagal memproses file impor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Enterprise Onboarding
            </span>
            <span className="text-xs text-gray-400 font-mono">Tenant: 11111111...1111</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-purple-400" />
            Migrasi & Import Data Massal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Pindahkan ribuan katalog produk Accurate atau database kontak Salesforce ke Nexus Core OS dalam hitungan detik.
          </p>
        </div>

        {/* Tombol Download Template */}
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs font-semibold text-gray-200 transition-colors shadow-sm shrink-0 self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-purple-400" />
          <span>Download Template CSV ({activeTab === "items" ? "Produk" : "Kontak"})</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center p-1 rounded-xl bg-[#141414] border border-[#262626] w-fit">
        <button
          onClick={() => handleTabChange("items")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "items"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-gray-400 hover:text-white hover:bg-[#1f1f1f]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Import Produk & Jasa (Accurate)</span>
        </button>

        <button
          onClick={() => handleTabChange("contacts")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "contacts"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-gray-400 hover:text-white hover:bg-[#1f1f1f]"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Import Kontak & CRM (Salesforce)</span>
        </button>
      </div>

      {/* Notifikasi Error Global */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-red-200/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Bagian Utama: Drag & Drop Area atau Kartu Hasil */}
      {!importResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom 1 & 2: Area Drag and Drop */}
          <div className="lg:col-span-2 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center relative ${
                isDragging
                  ? "border-purple-500 bg-purple-950/20 shadow-xl shadow-purple-500/10 scale-[1.01]"
                  : selectedFile
                  ? "border-purple-500/50 bg-[#161616]"
                  : "border-[#333333] hover:border-purple-500/40 bg-[#141414] hover:bg-[#181818]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-500/10">
                {selectedFile ? (
                  <FileSpreadsheet className="w-8 h-8 text-purple-300 animate-pulse" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <p className="font-bold text-white text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-purple-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Siap diproses
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Klik atau tarik file lain untuk mengganti
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-white text-sm">
                    Tarik & lepaskan file spreadsheet di sini, atau <span className="text-purple-400 underline">pilih file</span>
                  </p>
                  <p className="text-xs text-gray-400 max-w-sm">
                    Mendukung file ekspor Accurate POS, Salesforce, Google Sheets, atau Excel (.csv, .xlsx, maks 5MB)
                  </p>
                </div>
              )}
            </div>

            {/* Tombol Eksekusi Import */}
            {selectedFile && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#161616] border border-[#2a2a2a]">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-400">Target: Tabel {activeTab === "items" ? "public.items" : "public.contacts"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetImport}
                    disabled={isLoading}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#222] transition-colors"
                  >
                    Batal
                  </button>

                  <button
                    onClick={handleStartImport}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memproses Data...</span>
                      </>
                    ) : (
                      <>
                        <span>Mulai Impor Sekarang</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Kolom 3: Petunjuk Mapping & Best Practices */}
          <div className="bg-[#141414] rounded-2xl border border-[#262626] p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Info className="w-4 h-4 text-purple-400" />
              <span>Panduan Format Kolom</span>
            </div>

            {activeTab === "items" ? (
              <div className="space-y-3 text-xs">
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Sistem otomatis memetakan nama kolom tanpa membedakan huruf besar/kecil.
                </p>

                <div className="space-y-2 border-t border-[#262626] pt-3 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">SKU</span>
                    <span className="text-gray-400">Kode Unik Barang</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Nama Barang</span>
                    <span className="text-gray-400">Nama Produk/Jasa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Harga Jual</span>
                    <span className="text-gray-400">Rp / Integer Minor Units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Stok</span>
                    <span className="text-gray-400">Stok Awal Fisik</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Tipe</span>
                    <span className="text-gray-400">stocked / service</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/20 text-[11px] text-purple-200/90 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-purple-400" /> Auto Integer Conversion
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Format &ldquo;Rp 650.000&rdquo; atau &ldquo;650,000.00&rdquo; otomatis dikonversi menjadi integer 650000 sesuai standar database perbankan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Data kontak Salesforce akan terintegrasi langsung dengan Inbox & Modul AI WhatsApp.
                </p>

                <div className="space-y-2 border-t border-[#262626] pt-3 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Nama</span>
                    <span className="text-gray-400">Nama Pelanggan/Mitra</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">No HP</span>
                    <span className="text-gray-400">WhatsApp / Seluler</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Email</span>
                    <span className="text-gray-400">Surel Korespondensi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-300 font-semibold">Perusahaan</span>
                    <span className="text-gray-400">Entitas Organisasi</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/20 text-[11px] text-purple-200/90 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-purple-400" /> Multi-Tenant CRM
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Seluruh kontak otomatis terisolasi menggunakan Row-Level Security (RLS) PostgreSQL.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ===================================================================
           TAMPILAN RINGKASAN HASIL IMPOR (SUCCESS & ERRORS)
           =================================================================== */
        <div className="space-y-6">
          {/* Kartu Metrik Ringkasan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Total Baris File</p>
                <p className="text-2xl font-bold text-white font-mono">{importResult.total_rows}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#141414] border border-emerald-500/30 flex items-center gap-4 bg-gradient-to-br from-[#141414] to-emerald-950/10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-medium">✅ Berhasil Diimport</p>
                <p className="text-2xl font-bold text-emerald-300 font-mono">{importResult.success_count}</p>
              </div>
            </div>

            <div className={`p-5 rounded-2xl bg-[#141414] border flex items-center gap-4 ${
              importResult.error_count > 0 
                ? "border-amber-500/40 bg-gradient-to-br from-[#141414] to-amber-950/15" 
                : "border-[#262626]"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                importResult.error_count > 0 
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-400" 
                  : "bg-gray-800 text-gray-500"
              }`}>
                {importResult.error_count > 0 ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Check className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className={`text-xs font-medium ${importResult.error_count > 0 ? "text-amber-400" : "text-gray-400"}`}>
                  {importResult.error_count > 0 ? "⚠️ Baris Gagal / Dilewati" : "Nol Error"}
                </p>
                <p className={`text-2xl font-bold font-mono ${importResult.error_count > 0 ? "text-amber-300" : "text-gray-400"}`}>
                  {importResult.error_count}
                </p>
              </div>
            </div>
          </div>

          {/* Banner Pesan Ringkasan */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
            importResult.error_count === 0
              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
              : "bg-amber-950/20 border-amber-500/30 text-amber-300"
          }`}>
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              {importResult.error_count === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <span>{importResult.message}</span>
            </div>

            <button
              onClick={handleResetImport}
              className="px-4 py-1.5 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-white text-xs font-semibold transition-colors shrink-0"
            >
              Impor File Lain
            </button>
          </div>

          {/* Tabel Detail Error (Jika Ada) */}
          {importResult.error_count > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-amber-500/30 p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span>Daftar Baris yang Gagal / Dilewati ({importResult.errors.length})</span>
                </div>
                <span className="text-[11px] text-gray-400">
                  Perbaiki baris ini di spreadsheet Anda lalu impor ulang
                </span>
              </div>

              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1a1a1a] text-gray-400 font-mono text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Baris</th>
                      <th className="py-2.5 px-3">Identifikasi</th>
                      <th className="py-2.5 px-3 rounded-r-lg">Alasan Kegagalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-2 px-3 font-mono text-purple-300 font-semibold">
                          Baris {err.row}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-300">
                          {err.identifier || "-"}
                        </td>
                        <td className="py-2 px-3 text-red-300">
                          {err.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sampel Data yang Berhasil Diimpor */}
          {importResult.sample_imported && importResult.sample_imported.length > 0 && (
            <div className="bg-[#141414] rounded-2xl border border-[#262626] p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Sampel Data yang Berhasil Masuk Database</span>
                </div>
                <span className="text-[11px] text-gray-400">
                  Menampilkan hingga 5 baris pertama
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1a1a1a] text-gray-400 font-mono text-[11px]">
                    <tr>
                      {activeTab === "items" ? (
                        <>
                          <th className="py-2.5 px-3 rounded-l-lg">SKU</th>
                          <th className="py-2.5 px-3">Nama Produk / Jasa</th>
                          <th className="py-2.5 px-3">Harga Jual (Rp)</th>
                          <th className="py-2.5 px-3">Tipe</th>
                          <th className="py-2.5 px-3 rounded-r-lg">Stok</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-3 rounded-l-lg">Nama Kontak</th>
                          <th className="py-2.5 px-3">No. HP / WhatsApp</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3 rounded-r-lg">Perusahaan</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {importResult.sample_imported.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#1a1a1a] transition-colors">
                        {activeTab === "items" ? (
                          <>
                            <td className="py-2.5 px-3 font-mono text-purple-300 font-semibold">
                              {item.sku}
                            </td>
                            <td className="py-2.5 px-3 text-white font-medium">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400">
                              {formatRupiah(item.base_price)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                item.item_type === "service"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-purple-500/20 text-purple-300"
                              }`}>
                                {item.item_type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-300">
                              {item.stock}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-white font-medium">
                              {item.display_name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-purple-300">
                              {item.attributes?.phone || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400">
                              {item.attributes?.email || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-300">
                              {item.attributes?.company_name || "-"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
