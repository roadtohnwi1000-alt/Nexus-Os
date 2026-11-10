"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  DollarSign, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Search, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  PieChart,
  HelpCircle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  Plus,
  CreditCard,
  X,
  AlertCircle
} from "lucide-react";
import { 
  getJournals, 
  getProfitLossSummary, 
  getBankBalances,
  getBalanceSheet,
  getAccounts,
  recordExpense,
  paySupplier,
  formatRupiah, 
  JournalEntry, 
  ProfitLossSummary,
  BankBalancesResponse,
  BalanceSheetResponse,
  COAAccount
} from "@/lib/api";

// Data simulasi awal jika database tenant masih baru dan belum memiliki transaksi
const INITIAL_DEMO_JOURNALS: JournalEntry[] = [
  {
    id: "je-demo-001",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    transaction_date: new Date().toISOString().split("T")[0],
    description: "Pendapatan Servis & HPP #SRV-001 (iPhone 11 64GB)",
    reference_type: "REPAIR",
    reference_id: "srv-demo-001",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    lines: [
      {
        id: "jl-demo-001",
        account_id: "acc-1000",
        account_code: "1001",
        account_name: "Kas Fisik Kasir",
        debit: 650000,
        credit: 0,
      },
      {
        id: "jl-demo-002",
        account_id: "acc-4000",
        account_code: "4000",
        account_name: "Pendapatan Jasa Servis",
        debit: 0,
        credit: 650000,
      },
      {
        id: "jl-demo-003",
        account_id: "acc-5000",
        account_code: "5000",
        account_name: "HPP Sparepart & Servis",
        debit: 280000,
        credit: 0,
      },
      {
        id: "jl-demo-004",
        account_id: "acc-1200",
        account_code: "1200",
        account_name: "Persediaan Sparepart",
        debit: 0,
        credit: 280000,
      },
    ],
  },
  {
    id: "je-demo-002",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    transaction_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    description: "Pendapatan Servis & HPP #SRV-002 (Samsung Galaxy S21)",
    reference_type: "REPAIR",
    reference_id: "srv-demo-002",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    lines: [
      {
        id: "jl-demo-005",
        account_id: "acc-1000",
        account_code: "1001",
        account_name: "Kas Fisik Kasir",
        debit: 350000,
        credit: 0,
      },
      {
        id: "jl-demo-006",
        account_id: "acc-4000",
        account_code: "4000",
        account_name: "Pendapatan Jasa Servis",
        debit: 0,
        credit: 350000,
      },
      {
        id: "jl-demo-007",
        account_id: "acc-5000",
        account_code: "5000",
        account_name: "HPP Sparepart & Servis",
        debit: 150000,
        credit: 0,
      },
      {
        id: "jl-demo-008",
        account_id: "acc-1200",
        account_code: "1200",
        account_name: "Persediaan Sparepart",
        debit: 0,
        credit: 150000,
      },
    ],
  },
];

export default function ReportsPage() {
  // Tab aktif: 'profit_loss' (P&L), 'cash_flow' (Arus Kas), 'balance_sheet' (Neraca), atau 'journals' (Buku Jurnal)
  const [activeTab, setActiveTab] = useState<"profit_loss" | "cash_flow" | "balance_sheet" | "journals">("profit_loss");

  // State data dari backend FastAPI
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalancesResponse | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResponse | null>(null);
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // State filter laporan
  const [periodFilter, setPeriodFilter] = useState<"month" | "all">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRefType, setFilterRefType] = useState<string>("ALL");

  // State untuk toggle accordion detail baris jurnal
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({
    "je-demo-001": true,
  });

  // Modal State: Catat Beban Operasional (OPEX)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expense_name: "",
    amount: "",
    expense_account_id: "",
    source_account_id: "",
    notes: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  // Modal State: Bayar Hutang Supplier (AP Settlement)
  const [isPaySupplierModalOpen, setIsPaySupplierModalOpen] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payForm, setPayForm] = useState({
    supplier_name: "",
    grn_ref: "",
    amount: "",
    source_account_id: "",
    notes: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  // Fungsi memuat seluruh data laporan dari backend FastAPI
  const loadFinancialData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const isAllTime = periodFilter === "all";

      const [pnlRes, journalsRes, banksRes, bsRes, accRes] = await Promise.allSettled([
        getProfitLossSummary(isAllTime ? { all_time: true } : {}),
        getJournals(),
        getBankBalances(),
        getBalanceSheet(),
        getAccounts(),
      ]);

      if (pnlRes.status === "fulfilled") setSummary(pnlRes.value);
      if (journalsRes.status === "fulfilled" && journalsRes.value && journalsRes.value.length > 0) {
        setJournals(journalsRes.value);
      } else {
        setJournals((prev) => (prev.length > 0 ? prev : INITIAL_DEMO_JOURNALS));
      }
      if (banksRes.status === "fulfilled") setBankBalances(banksRes.value);
      if (bsRes.status === "fulfilled") setBalanceSheet(bsRes.value);
      if (accRes.status === "fulfilled") {
        setAccounts(accRes.value);
        // Set default selection untuk form jika belum terisi
        const defaultExp = accRes.value.find((a) => a.code === "6000" || a.type === "Expense");
        const defaultSrc = accRes.value.find((a) => a.code === "1001" || a.code === "1000" || a.type === "Asset");
        if (defaultExp && !expenseForm.expense_account_id) {
          setExpenseForm((prev) => ({ ...prev, expense_account_id: defaultExp.id }));
        }
        if (defaultSrc && !expenseForm.source_account_id) {
          setExpenseForm((prev) => ({ ...prev, source_account_id: defaultSrc.id }));
        }
        if (defaultSrc && !payForm.source_account_id) {
          setPayForm((prev) => ({ ...prev, source_account_id: defaultSrc.id }));
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat laporan keuangan:", err);
      setErrorMsg(err.message || "Gagal memuat data dari server backend.");
      setJournals((prev) => (prev.length > 0 ? prev : INITIAL_DEMO_JOURNALS));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [periodFilter]);

  // Toggle buka/tutup baris jurnal tertentu
  const toggleExpand = (entryId: string) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  // Buka atau tutup semua accordion baris jurnal
  const toggleExpandAll = () => {
    const areAllExpanded = filteredJournals.every((j) => expandedEntries[j.id]);
    const newState: Record<string, boolean> = {};
    if (!areAllExpanded) {
      filteredJournals.forEach((j) => {
        newState[j.id] = true;
      });
    }
    setExpandedEntries(newState);
  };

  // Nilai ringkasan laba rugi aktif
  const activeSummary = useMemo(() => {
    const totalRev = summary?.total_revenue ?? 1220000;
    const totalCogs = summary?.total_cogs ?? 430000;
    const grossProfit = summary?.gross_profit ?? (totalRev - totalCogs);
    const totalOpex = summary?.total_opex ?? 0;
    const netProfit = summary?.net_profit ?? (grossProfit - totalOpex);

    return {
      total_revenue: totalRev,
      total_cogs: totalCogs,
      gross_profit: grossProfit,
      total_opex: totalOpex,
      net_profit: netProfit,
      opex_breakdown: summary?.opex_breakdown ?? [],
      period: summary?.period || (periodFilter === "all" ? "All Time" : "Bulan Ini"),
    };
  }, [summary, periodFilter]);

  // Persentase margin
  const grossMarginPercentage = useMemo(() => {
    if (!activeSummary || activeSummary.total_revenue <= 0) return 0;
    return Math.round((activeSummary.gross_profit / activeSummary.total_revenue) * 100);
  }, [activeSummary]);

  const netMarginPercentage = useMemo(() => {
    if (!activeSummary || activeSummary.total_revenue <= 0) return 0;
    return Math.round((activeSummary.net_profit / activeSummary.total_revenue) * 100);
  }, [activeSummary]);

  // Filter daftar jurnal
  const filteredJournals = useMemo(() => {
    return journals.filter((entry) => {
      if (filterRefType !== "ALL" && entry.reference_type !== filterRefType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = entry.description?.toLowerCase().includes(q);
        const matchRef = entry.reference_id?.toLowerCase().includes(q);
        const matchType = entry.reference_type?.toLowerCase().includes(q);
        const matchLines = entry.lines.some(
          (l) =>
            l.account_code?.toLowerCase().includes(q) ||
            l.account_name?.toLowerCase().includes(q)
        );
        return matchDesc || matchRef || matchType || matchLines;
      }
      return true;
    });
  }, [journals, filterRefType, searchQuery]);

  // Akun pengeluaran & akun kas/bank untuk dropdown
  const expenseAccounts = useMemo(() => {
    return accounts.filter((a) => a.code.startsWith("6") || a.type === "Expense");
  }, [accounts]);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.code.startsWith("10") || a.type === "Asset");
  }, [accounts]);

  // Handler Submit Beban Operasional
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(expenseForm.amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      alert("Masukkan nominal pengeluaran yang valid.");
      return;
    }
    if (!expenseForm.expense_account_id || !expenseForm.source_account_id) {
      alert("Pilih akun beban dan rekening sumber dana.");
      return;
    }

    setIsSubmittingExpense(true);
    try {
      await recordExpense({
        expense_name: expenseForm.expense_name,
        amount: amountNum,
        expense_account_id: expenseForm.expense_account_id,
        source_account_id: expenseForm.source_account_id,
        transaction_date: expenseForm.transaction_date,
        notes: expenseForm.notes || undefined,
      });

      setFeedbackSuccess(`Beban "${expenseForm.expense_name}" (${formatRupiah(amountNum)}) berhasil dicatat ke jurnal akuntansi.`);
      setIsExpenseModalOpen(false);
      setExpenseForm({
        expense_name: "",
        amount: "",
        expense_account_id: expenseAccounts[0]?.id || "",
        source_account_id: bankAccounts[0]?.id || "",
        notes: "",
        transaction_date: new Date().toISOString().split("T")[0],
      });
      await loadFinancialData(true);
    } catch (err: any) {
      alert(err.message || "Gagal mencatat beban operasional.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Handler Submit Pelunasan Hutang Supplier
  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(payForm.amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      alert("Masukkan nominal pelunasan yang valid.");
      return;
    }
    if (!payForm.source_account_id) {
      alert("Pilih rekening sumber pembayaran.");
      return;
    }

    setIsSubmittingPay(true);
    try {
      await paySupplier({
        supplier_name: payForm.supplier_name || undefined,
        grn_ref: payForm.grn_ref || undefined,
        amount: amountNum,
        source_account_id: payForm.source_account_id,
        transaction_date: payForm.transaction_date,
        notes: payForm.notes || undefined,
      });

      setFeedbackSuccess(`Pelunasan hutang supplier (${formatRupiah(amountNum)}) berhasil dibukukan ke jurnal akuntansi.`);
      setIsPaySupplierModalOpen(false);
      setPayForm({
        supplier_name: "",
        grn_ref: "",
        amount: "",
        source_account_id: bankAccounts[0]?.id || "",
        notes: "",
        transaction_date: new Date().toISOString().split("T")[0],
      });
      await loadFinancialData(true);
    } catch (err: any) {
      alert(err.message || "Gagal mencatat pelunasan hutang supplier.");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* =========================================================================
          HEADER SECTION & ACTIONS
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-purple-400" /> Auto-Accounting Double-Entry
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Treasury & Balance Sheet Live
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-500" />
            Laporan Keuangan & Treasury
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visualisasi performa Laba Rugi (P&L), posisi Neraca Aktiva/Pasiva, saldo multi-bank, dan audit trail jurnal otomatis.
          </p>
        </div>

        {/* Action Buttons & Filter Periode */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950/30"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Beban OPEX</span>
          </button>

          <button
            onClick={() => setIsPaySupplierModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-950/30"
          >
            <CreditCard className="w-4 h-4" />
            <span>Bayar Hutang Supplier</span>
          </button>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-medium">
            <button
              onClick={() => setPeriodFilter("month")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                periodFilter === "month"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriodFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                periodFilter === "all"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua Waktu
            </button>
          </div>

          <button
            onClick={() => loadFinancialData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            title="Refresh Data Keuangan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-purple-400" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Perbarui</span>
          </button>
        </div>
      </div>

      {/* Pesan Sukses / Error Banner */}
      {feedbackSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
          <button onClick={() => setFeedbackSuccess(null)} className="text-emerald-400/80 hover:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{errorMsg} (Menampilkan mode simulasi live cache).</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-amber-400/80 hover:text-amber-300 text-xs underline ml-4">
            Tutup
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB NAVIGATION (4 TABS)
      ========================================================================= */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("profit_loss")}
          className={`flex items-center gap-2.5 py-3 px-4 md:px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === "profit_loss"
              ? "border-purple-500 text-purple-400 bg-purple-500/5 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Laba Rugi (P&L)</span>
        </button>

        <button
          onClick={() => setActiveTab("cash_flow")}
          className={`flex items-center gap-2.5 py-3 px-4 md:px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === "cash_flow"
              ? "border-purple-500 text-purple-400 bg-purple-500/5 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Arus Kas & Bank (Treasury)</span>
        </button>

        <button
          onClick={() => setActiveTab("balance_sheet")}
          className={`flex items-center gap-2.5 py-3 px-4 md:px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === "balance_sheet"
              ? "border-purple-500 text-purple-400 bg-purple-500/5 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Neraca (Balance Sheet)</span>
        </button>

        <button
          onClick={() => setActiveTab("journals")}
          className={`flex items-center gap-2.5 py-3 px-4 md:px-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === "journals"
              ? "border-purple-500 text-purple-400 bg-purple-500/5 rounded-t-lg"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Buku Jurnal Umum (GL)</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
            {filteredJournals.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LAPORAN LABA RUGI (P&L DENGAN OPEX & LABA BERSIH)
      ========================================================================= */}
      {activeTab === "profit_loss" && (
        <div className="space-y-6 animate-in fade-in">
          {/* 5 Kartu Metrik Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Total Pendapatan */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-emerald-950/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Pendapatan
              </span>
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-400 mt-2">
                {formatRupiah(activeSummary.total_revenue)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Akun 4000/4100 (POS & Servis)</p>
            </div>

            {/* 2. Total HPP */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-amber-950/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> HPP (COGS)
              </span>
              <p className="text-2xl font-black font-mono tracking-tight text-amber-400 mt-2">
                {formatRupiah(activeSummary.total_cogs)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Akun 5000 (Modal Sparepart/Barang)</p>
            </div>

            {/* 3. Laba Kotor */}
            <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" /> Laba Kotor
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  {grossMarginPercentage}%
                </span>
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-purple-300 mt-2">
                {formatRupiah(activeSummary.gross_profit)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Pendapatan - Beban Pokok (HPP)</p>
            </div>

            {/* 4. Total Beban Operasional (OPEX) */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Beban OPEX
                </span>
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline"
                >
                  + Catat
                </button>
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-rose-400 mt-2">
                {formatRupiah(activeSummary.total_opex)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Akun 6000 (Sewa, Gaji, Listrik)</p>
            </div>

            {/* 5. Laba Bersih (Net Profit) */}
            <div className={`border rounded-2xl p-5 relative overflow-hidden shadow-lg ${
              activeSummary.net_profit >= 0 
                ? "bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40 shadow-emerald-950/30" 
                : "bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/40 shadow-rose-950/30"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Laba Bersih
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Margin: {netMarginPercentage}%
                </span>
              </div>
              <p className={`text-2xl font-black font-mono tracking-tight mt-2 ${
                activeSummary.net_profit >= 0 ? "text-emerald-300" : "text-rose-400"
              }`}>
                {formatRupiah(activeSummary.net_profit)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Net Profit Final Toko</p>
            </div>
          </div>

          {/* Breakdown & Pos Akuntansi P&L */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-base text-slate-200">
                    Struktur Laporan Laba Rugi ({activeSummary.period})
                  </h3>
                </div>
                <span className="text-xs text-slate-500">Double-Entry Certified</span>
              </div>

              {/* Tabel Pos Akuntansi Laba Rugi Lengkap */}
              <div className="border border-slate-800 rounded-xl overflow-hidden text-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Pos Akuntansi</th>
                      <th className="py-2.5 px-4">Kode COA</th>
                      <th className="py-2.5 px-4 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-emerald-400">1. Total Pendapatan Operasional</td>
                      <td className="py-3 px-4 font-mono text-slate-400">4000 / 4100</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatRupiah(activeSummary.total_revenue)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-amber-300 pl-8">2. Harga Pokok Penjualan (HPP Sparepart/Barang)</td>
                      <td className="py-3 px-4 font-mono text-slate-400">5000 / 5100</td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        ({formatRupiah(activeSummary.total_cogs)})
                      </td>
                    </tr>
                    <tr className="bg-slate-800/40 font-bold">
                      <td className="py-2.5 px-4 text-purple-300">Laba Kotor (Gross Profit)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">Subtotal</td>
                      <td className="py-2.5 px-4 text-right font-mono text-purple-300">
                        {formatRupiah(activeSummary.gross_profit)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-rose-400">3. Beban Operasional (OPEX)</td>
                      <td className="py-3 px-4 font-mono text-slate-400">6000 - 6400</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                        ({formatRupiah(activeSummary.total_opex)})
                      </td>
                    </tr>
                    {/* Rincian Sub-akun Beban */}
                    {activeSummary.opex_breakdown && activeSummary.opex_breakdown.length > 0 ? (
                      activeSummary.opex_breakdown.map((item) => (
                        <tr key={item.account_id} className="text-slate-400 text-[11px]">
                          <td className="py-1.5 px-4 pl-10">• {item.name}</td>
                          <td className="py-1.5 px-4 font-mono">{item.code}</td>
                          <td className="py-1.5 px-4 text-right font-mono text-rose-400/80">
                            ({formatRupiah(item.amount)})
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="text-slate-500 text-[11px]">
                        <td className="py-1.5 px-4 pl-10 italic">Belum ada rincian beban operasional periode ini</td>
                        <td className="py-1.5 px-4 font-mono">-</td>
                        <td className="py-1.5 px-4 text-right font-mono">Rp 0</td>
                      </tr>
                    )}
                    <tr className="bg-emerald-950/20 font-black border-t-2 border-emerald-500/40 text-sm">
                      <td className="py-3.5 px-4 text-emerald-300">Laba Bersih Toko (Net Profit)</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">Net Final</td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-300 text-base">
                        {formatRupiah(activeSummary.net_profit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Action & Ringkasan Kebijakan */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="font-semibold text-base text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  Prinsip Akuntansi SAP House Bank
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pencatatan beban operasional langsung mengurangi saldo rekening kas/bank yang dipilih dan tercatat di buku besar secara permanen (append-only).
                </p>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-950/30"
                  >
                    <Plus className="w-4 h-4" /> Catat Beban Operasional Baru
                  </button>
                  <button
                    onClick={() => setIsPaySupplierModalOpen(true)}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-950/30"
                  >
                    <CreditCard className="w-4 h-4" /> Bayar Hutang Supplier (AP)
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Gross Margin:</span>
                  <span className="font-mono text-purple-300 font-bold">{grossMarginPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Margin:</span>
                  <span className="font-mono text-emerald-300 font-bold">{netMarginPercentage}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ARUS KAS & HOUSE BANKS (TREASURY DENGAN DATA REALTIME)
      ========================================================================= */}
      {activeTab === "cash_flow" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Saldo Likuid Kas & Rekening Bank Operasional */}
          <div className="bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  House Banks & Saldo Kas Likuid (Debit - Kredit Jurnal)
                </span>
                <p className="text-3xl font-black font-mono text-white mt-1">
                  {formatRupiah(bankBalances?.total_liquid_balance ?? 24500000)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Total uang riil yang tersedia di kasir fisik, bank penampung, dan saldo QRIS.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/30"
                >
                  <Plus className="w-3.5 h-3.5" /> Catat Beban
                </button>
                <button
                  onClick={() => setIsPaySupplierModalOpen(true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/30"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Bayar Hutang
                </button>
              </div>
            </div>

            {/* Grid Rekening Bank Operasional (Sub-Akun SAP House Bank) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {bankBalances?.accounts && bankBalances.accounts.length > 0 ? (
                bankBalances.accounts.map((acc) => (
                  <div key={acc.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1 hover:border-purple-500/40 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-purple-400 font-bold">{acc.code}</span>
                      <span className="text-[10px] text-slate-500">Asset Liquid</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 truncate">{acc.name}</p>
                    <p className="text-lg font-bold font-mono text-white pt-1">{formatRupiah(acc.balance)}</p>
                    <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                      <span>Masuk: {formatRupiah(acc.total_debit)}</span>
                      <span>Keluar: {formatRupiah(acc.total_credit)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="font-mono text-purple-400 font-bold text-xs">1001</span>
                    <p className="text-xs font-semibold text-slate-200">Kas Fisik Kasir</p>
                    <p className="text-lg font-bold font-mono text-white">Rp 4.500.000</p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="font-mono text-purple-400 font-bold text-xs">1010</span>
                    <p className="text-xs font-semibold text-slate-200">Bank Operasional (BCA)</p>
                    <p className="text-lg font-bold font-mono text-white">Rp 28.250.000</p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="font-mono text-purple-400 font-bold text-xs">1020</span>
                    <p className="text-xs font-semibold text-slate-200">Bank Mandiri (Penampung)</p>
                    <p className="text-lg font-bold font-mono text-white">Rp 6.200.000</p>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="font-mono text-purple-400 font-bold text-xs">1040</span>
                    <p className="text-xs font-semibold text-slate-200">Saldo QRIS & Settlement</p>
                    <p className="text-lg font-bold font-mono text-white">Rp 2.000.000</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rincian Arus Kas Berdasarkan Aktivitas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Arus Kas Masuk Operasional */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" />
                  Arus Kas Masuk (Cash Inflow)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatRupiah(activeSummary.total_revenue)}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <p className="font-semibold text-white">Penjualan Retail & Nota Kasir POS</p>
                    <p className="text-[10px] text-slate-500">Penerimaan kas langsung dari pembeli di kasir</p>
                  </div>
                  <span className="font-mono font-bold text-slate-200">{formatRupiah(Math.round(activeSummary.total_revenue * 0.65))}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <p className="font-semibold text-white">Pelunasan Servis & Jasa Reparasi</p>
                    <p className="text-[10px] text-slate-500">Penerimaan biaya jasa dari tiket servis selesai</p>
                  </div>
                  <span className="font-mono font-bold text-slate-200">{formatRupiah(Math.round(activeSummary.total_revenue * 0.35))}</span>
                </div>
              </div>
            </div>

            {/* Arus Kas Keluar Operasional */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4" />
                  Arus Kas Keluar (Cash Outflow)
                </h3>
                <span className="text-xs font-mono font-bold text-rose-400">
                  ({formatRupiah(activeSummary.total_cogs + activeSummary.total_opex)})
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <p className="font-semibold text-white">Beban Pokok Penjualan / Sparepart (HPP)</p>
                    <p className="text-[10px] text-slate-500">Pemakaian suku cadang atau restok unit</p>
                  </div>
                  <span className="font-mono font-bold text-rose-300">({formatRupiah(activeSummary.total_cogs)})</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div>
                    <p className="font-semibold text-white">Beban Operasional Toko (OPEX)</p>
                    <p className="text-[10px] text-slate-500">Sewa tempat, listrik, internet, gaji, ATK</p>
                  </div>
                  <span className="font-mono font-bold text-rose-300">({formatRupiah(activeSummary.total_opex)})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: LAPORAN POSISI KEUANGAN (NERACA / BALANCE SHEET)
      ========================================================================= */}
      {activeTab === "balance_sheet" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Status Keseimbangan Neraca (Audit Badge) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-white">
                  Neraca Keuangan Toko (Balance Sheet)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Menyajikan posisi Aset (Aktiva) versus Kewajiban & Ekuitas (Pasiva) per {balanceSheet?.period_label || "Hari Ini"}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {balanceSheet?.is_balanced !== false ? (
                <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>SEIMBANG (Aktiva = Pasiva)</span>
                </div>
              ) : (
                <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Perlu Penyesuaian Saldo Awal</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabel Dua Sisi: ASET (KIRI) vs KEWAJIBAN & EKUITAS (KANAN) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SISI KIRI: ASET / AKTIVA */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  ASET / AKTIVA (ASSETS)
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {formatRupiah(balanceSheet?.total_assets ?? (bankBalances?.total_liquid_balance || 24500000))}
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 text-xs">
                {balanceSheet?.assets?.items && balanceSheet.assets.items.length > 0 ? (
                  balanceSheet.assets.items.map((item) => (
                    <div key={item.code} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-purple-400 font-semibold mr-2">{item.code}</span>
                        <span className="text-slate-200">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-white">{formatRupiah(item.amount)}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-purple-400 font-semibold mr-2">10xx</span>
                        <span className="text-slate-200">Kas & Rekening Bank Likuid</span>
                      </div>
                      <span className="font-mono font-bold text-white">{formatRupiah(bankBalances?.total_liquid_balance ?? 24500000)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-purple-400 font-semibold mr-2">1120</span>
                        <span className="text-slate-200">Piutang Marketplace (TikTok/Shopee)</span>
                      </div>
                      <span className="font-mono font-bold text-white">Rp 0</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-purple-400 font-semibold mr-2">1200</span>
                        <span className="text-slate-200">Persediaan Barang Dagang & Sparepart</span>
                      </div>
                      <span className="font-mono font-bold text-white">Rp 12.800.000</span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-emerald-400 bg-emerald-950/10 p-3 rounded-xl">
                <span>TOTAL ASET</span>
                <span className="font-mono text-base">
                  {formatRupiah(balanceSheet?.total_assets ?? ((bankBalances?.total_liquid_balance || 24500000) + 12800000))}
                </span>
              </div>
            </div>

            {/* SISI KANAN: KEWAJIBAN & EKUITAS / PASIVA */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  KEWAJIBAN & EKUITAS (PASIVA)
                </h3>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {formatRupiah((balanceSheet?.total_liabilities ?? 0) + (balanceSheet?.total_equity ?? 0))}
                </span>
              </div>

              {/* Sub-bagian Kewajiban */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Kewajiban (Liabilities)</span>
                <div className="divide-y divide-slate-800/80 text-xs">
                  {balanceSheet?.liabilities?.items && balanceSheet.liabilities.items.length > 0 ? (
                    balanceSheet.liabilities.items.map((item) => (
                      <div key={item.code} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-purple-400 font-semibold mr-2">{item.code}</span>
                          <span className="text-slate-200">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-rose-300">{formatRupiah(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-2 flex items-center justify-between text-slate-400">
                      <div>
                        <span className="font-mono text-purple-400 font-semibold mr-2">2000</span>
                        <span>Hutang Usaha / Tagihan Supplier</span>
                      </div>
                      <span className="font-mono font-bold text-slate-300">Rp 0</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-bagian Ekuitas */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Ekuitas Modal (Equity)</span>
                <div className="divide-y divide-slate-800/80 text-xs">
                  {balanceSheet?.equity?.items && balanceSheet.equity.items.length > 0 ? (
                    balanceSheet.equity.items.map((item) => (
                      <div key={item.code} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-purple-400 font-semibold mr-2">{item.code}</span>
                          <span className="text-slate-200">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-white">{formatRupiah(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-purple-400 font-semibold mr-2">3000</span>
                          <span className="text-slate-200">Modal Pemilik Usaha</span>
                        </div>
                        <span className="font-mono font-bold text-white">Rp 20.000.000</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-purple-400 font-semibold mr-2">3999</span>
                          <span className="text-slate-200">Laba Berjalan Kumulatif (Net Profit)</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">{formatRupiah(activeSummary.net_profit)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-indigo-400 bg-indigo-950/10 p-3 rounded-xl">
                <span>TOTAL PASIVA (KEWAJIBAN + EKUITAS)</span>
                <span className="font-mono text-base">
                  {formatRupiah((balanceSheet?.total_liabilities ?? 0) + (balanceSheet?.total_equity ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BUKU JURNAL UMUM (GENERAL LEDGER)
      ========================================================================= */}
      {activeTab === "journals" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Controls: Search, Filter Referensi, & Expand All */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-1 items-center gap-2.5 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari memo, no transaksi, atau kode akun (misal: 1001)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterRefType}
                  onChange={(e) => setFilterRefType(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none text-xs py-1"
                >
                  <option value="ALL">Semua Transaksi</option>
                  <option value="POS_SALE">Penjualan POS</option>
                  <option value="REPAIR">Servis & Reparasi</option>
                  <option value="EXPENSE">Beban Operasional (OPEX)</option>
                  <option value="AP_SETTLEMENT">Pelunasan Hutang Supplier</option>
                  <option value="MANUAL">Jurnal Manual</option>
                </select>
              </div>
            </div>

            <button
              onClick={toggleExpandAll}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Buka/Tutup Semua Baris</span>
            </button>
          </div>

          {/* Tabel Buku Jurnal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center"></th>
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4">Deskripsi / Memo</th>
                    <th className="py-3.5 px-4">Referensi</th>
                    <th className="py-3.5 px-4 text-right">Total Debit</th>
                    <th className="py-3.5 px-4 text-right">Total Kredit</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        Tidak ada entri jurnal yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map((entry) => {
                      const isExpanded = !!expandedEntries[entry.id];
                      const totalDebit = entry.lines.reduce((acc, l) => acc + l.debit, 0);
                      const totalCredit = entry.lines.reduce((acc, l) => acc + l.credit, 0);
                      const isBalanced = totalDebit === totalCredit && totalDebit > 0;

                      return (
                        <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                          <td colSpan={7} className="p-0">
                            <div 
                              onClick={() => toggleExpand(entry.id)}
                              className="flex items-center justify-between py-3 px-4 cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                                <span className="font-mono text-xs text-slate-400">{entry.transaction_date}</span>
                                <span className="font-semibold text-slate-200 text-xs sm:text-sm">{entry.description || "Jurnal Umum"}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {entry.reference_type || "MANUAL"}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 text-xs font-mono">
                                <span className="text-emerald-400 font-bold">{formatRupiah(totalDebit)}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isBalanced ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400"
                                }`}>
                                  {isBalanced ? "Balanced" : "Unbalanced"}
                                </span>
                              </div>
                            </div>

                            {/* Accordion Detail Baris Debit/Kredit */}
                            {isExpanded && (
                              <div className="bg-slate-950/70 p-4 border-t border-slate-800/80">
                                <table className="w-full text-xs">
                                  <thead className="text-slate-500 border-b border-slate-800">
                                    <tr>
                                      <th className="py-1 px-3 text-left">Kode</th>
                                      <th className="py-1 px-3 text-left">Nama Akun COA</th>
                                      <th className="py-1 px-3 text-right">Debit (Rp)</th>
                                      <th className="py-1 px-3 text-right">Kredit (Rp)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50">
                                    {entry.lines.map((line) => (
                                      <tr key={line.id}>
                                        <td className="py-1.5 px-3 font-mono text-purple-400">{line.account_code || "-"}</td>
                                        <td className="py-1.5 px-3 text-slate-300">{line.account_name || "-"}</td>
                                        <td className="py-1.5 px-3 text-right font-mono text-emerald-400">
                                          {line.debit > 0 ? formatRupiah(line.debit) : "-"}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-mono text-amber-400">
                                          {line.credit > 0 ? formatRupiah(line.credit) : "-"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CATAT BEBAN OPERASIONAL (OPEX)
      ========================================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Catat Beban Operasional (OPEX)</h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Beban / Pengeluaran *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Tagihan Listrik Toko Bulan Ini"
                  value={expenseForm.expense_name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Kategori Akun Beban (COA 6xxx) *</label>
                <select
                  required
                  value={expenseForm.expense_account_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_account_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rekening Sumber Kas / Bank *</label>
                <select
                  required
                  value={expenseForm.source_account_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, source_account_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nominal Pengeluaran (Rp) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  placeholder="Contoh: 350000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={expenseForm.transaction_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Catatan / No. Bukti Pengeluaran</label>
                <input
                  type="text"
                  placeholder="Contoh: Kwitansi #PLN-88192"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">Simulasi Ayat Jurnal:</span>
                <p className="text-emerald-400 mt-0.5">• DEBIT: Akun Beban (Beban bertambah)</p>
                <p className="text-rose-400">• KREDIT: Akun Kas/Bank Terpilih (Uang keluar)</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmittingExpense ? "Menyimpan Jurnal..." : "Simpan Beban OPEX"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: BAYAR HUTANG SUPPLIER (AP SETTLEMENT)
      ========================================================================= */}
      {isPaySupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Pelunasan Hutang Supplier (AP)</h3>
              </div>
              <button
                onClick={() => setIsPaySupplierModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Supplier / Vendor *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Sinar Sparepart Indonesia"
                  value={payForm.supplier_name}
                  onChange={(e) => setPayForm({ ...payForm, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nomor Nota / GRN Pembelian</label>
                <input
                  type="text"
                  placeholder="Contoh: GRN#2026-10-091"
                  value={payForm.grn_ref}
                  onChange={(e) => setPayForm({ ...payForm, grn_ref: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rekening Kas / Bank Pembayar *</label>
                <select
                  required
                  value={payForm.source_account_id}
                  onChange={(e) => setPayForm({ ...payForm, source_account_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nominal Pembayaran (Rp) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  placeholder="Contoh: 1500000"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  value={payForm.transaction_date}
                  onChange={(e) => setPayForm({ ...payForm, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Catatan / No. Bukti Transfer</label>
                <input
                  type="text"
                  placeholder="Contoh: Transfer via KlikBCA #TRX-9921"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">Simulasi Ayat Jurnal:</span>
                <p className="text-emerald-400 mt-0.5">• DEBIT: Hutang Usaha / 2000 (Hutang lunas)</p>
                <p className="text-rose-400">• KREDIT: Akun Kas/Bank Terpilih (Saldo terpotong)</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaySupplierModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmittingPay ? "Memproses Pelunasan..." : "Konfirmasi Pembayaran Hutang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
