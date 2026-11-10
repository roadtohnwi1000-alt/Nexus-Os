/**
 * Nexus Core OS - API Client Helper
 * 
 * Modul komunikasi terpusat antara Next.js frontend dengan FastAPI backend.
 * Menginjeksi header multitenancy X-Tenant-ID secara otomatis ke setiap request.
 */

export const DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Format angka integer minor units ke representasi mata uang Rupiah.
 * Contoh: 25000 -> "Rp 25.000"
 */
export function formatRupiah(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Wrapper fetch native dengan injeksi otomatis header multitenant X-Tenant-ID.
 */
export async function fetchAPI<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("X-Tenant-ID")) {
    headers.set("X-Tenant-ID", DEMO_TENANT_ID);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      // Abaikan jika respons bukan JSON
    }
    throw new Error(errorDetail);
  }

  // Jika status 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// =============================================================================
// DOMAIN: ITEMS & KATALOG
// =============================================================================

export interface Item {
  id: string;
  name: string;
  sku: string;
  marketplace_sku?: string;
  item_type: "stocked" | "service" | "digital";
  base_price: number;
  price_retail?: number;
  price_reseller?: number;
  price_technician?: number;
  attributes: Record<string, any>;
  active: boolean;
  stock?: number;
}

export async function getItems(): Promise<Item[]> {
  try {
    return await fetchAPI<Item[]>("/api/v1/items");
  } catch (error) {
    console.warn("Gagal mengambil items dari backend, menggunakan fallback data lokal:", error);
    return [];
  }
}

export async function updateItemPrice(
  itemId: string, 
  payload: {
    name?: string;
    sku?: string;
    base_price?: number;
    price_retail?: number;
    price_reseller?: number;
    price_technician?: number;
    marketplace_sku?: string;
  }
): Promise<Item> {
  return await fetchAPI<Item>(`/api/v1/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// DOMAIN: ORDERS & POS
// =============================================================================

export interface OrderItemInput {
  item_id: string;
  qty: number;
}

export interface PaymentInput {
  payment_method: "CASH" | "QRIS" | "TRANSFER" | string;
  amount: number;
}

export interface CreateOrderPayload {
  contact_id?: string;
  idempotency_key: string;
  items: OrderItemInput[];
  pricing_tier?: "retail" | "reseller" | "technician" | string;
  payments?: PaymentInput[];
  service_details?: {
    customer_name: string;
    customer_phone: string;
    device_model: string;
    issue_description: string;
    estimated_cost: number;
  };
}

export async function createOrder(data: CreateOrderPayload): Promise<any> {
  return await fetchAPI("/api/v1/orders", {
    method: "POST",
    headers: {
      "Idempotency-Key": data.idempotency_key,
    },
    body: JSON.stringify(data),
  });
}

// =============================================================================
// DOMAIN: AI DRAFTS & HUMAN-IN-THE-LOOP APPROVAL
// =============================================================================

export interface AIDraft {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  kind: string;
  status: "pending" | "approved" | "rejected";
  payload: {
    conversation_id?: string;
    reply_text?: string;
    item_name?: string;
    price?: number;
    stock?: number;
    customer_name?: string;
    customer_message?: string;
    items?: Array<{ item_id: string; qty: number }>;
  };
  generated_by: string;
  rejection_reason?: string;
  created_at: string;
}

export async function getPendingAIDrafts(): Promise<AIDraft[]> {
  return await fetchAPI<AIDraft[]>("/api/v1/ai-drafts/?status_filter=pending");
}

export async function approveAIDraft(id: string): Promise<any> {
  return await fetchAPI(`/api/v1/ai-drafts/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectAIDraft(id: string, reason: string = "Ditolak oleh staf"): Promise<any> {
  return await fetchAPI(`/api/v1/ai-drafts/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// =============================================================================
// DOMAIN: AI TRAINING & EXPERT KNOWLEDGE
// =============================================================================

export interface ExpertKnowledge {
  id: string;
  tenant_id: string;
  topic: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIGuideline {
  id: string;
  tenant_id: string;
  category: "tone_of_voice" | "escalation_rules" | "consultation_flow" | "safety_rules";
  instruction: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getExpertKnowledge(): Promise<ExpertKnowledge[]> {
  return await fetchAPI<ExpertKnowledge[]>("/api/v1/ai-training/expert-knowledge");
}

export async function addExpertKnowledge(data: { topic: string; content: string; is_active?: boolean }): Promise<ExpertKnowledge> {
  return await fetchAPI<ExpertKnowledge>("/api/v1/ai-training/expert-knowledge", {
    method: "POST",
    body: JSON.stringify({ is_active: true, ...data }),
  });
}

export async function deleteExpertKnowledge(id: string): Promise<any> {
  return await fetchAPI(`/api/v1/ai-training/expert-knowledge/${id}`, {
    method: "DELETE",
  });
}

export async function getGuidelines(): Promise<AIGuideline[]> {
  return await fetchAPI<AIGuideline[]>("/api/v1/ai-training/guidelines");
}

export async function addGuideline(data: { category: string; instruction: string; is_active?: boolean }): Promise<AIGuideline> {
  return await fetchAPI<AIGuideline>("/api/v1/ai-training/guidelines", {
    method: "POST",
    body: JSON.stringify({ is_active: true, ...data }),
  });
}

export async function deleteGuideline(id: string): Promise<any> {
  return await fetchAPI(`/api/v1/ai-training/guidelines/${id}`, {
    method: "DELETE",
  });
}

// =============================================================================
// DOMAIN: DATA IMPORT (ACCURATE & SALESFORCE)
// =============================================================================

export interface RowErrorDetail {
  row: number;
  identifier?: string;
  reason: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  errors: RowErrorDetail[];
  sample_imported: any[];
}

export async function importItemsCSV(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return await fetchAPI<ImportResult>("/api/v1/import/items", {
    method: "POST",
    body: formData,
  });
}

export async function importContactsCSV(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return await fetchAPI<ImportResult>("/api/v1/import/contacts", {
    method: "POST",
    body: formData,
  });
}

// =============================================================================
// DOMAIN: HP RETAIL & REPAIR TICKETS
// =============================================================================

export interface RepairPart {
  id: string;
  repair_ticket_id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  qty: number;
  hpp_at_use: number;
  created_at?: string;
}

export interface RepairTicket {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  device_imei?: string | null;
  device_model: string;
  device_password_pattern?: string | null;
  complaint: string;
  status: "Intake" | "Diagnosis" | "Waiting Approval" | "Repairing" | "QC" | "Done" | "Taken";
  assigned_technician_id?: string | null;
  estimated_cost: number;
  final_cost?: number | null;
  parts: RepairPart[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateRepairTicketInput {
  device_model: string;
  device_imei?: string;
  complaint: string;
  customer_id?: string;
  estimated_cost?: number;
  device_password_pattern?: string;
  assigned_technician_id?: string;
}

export interface UpdateRepairTicketStatusInput {
  status: string;
  final_cost?: number;
  assigned_technician_id?: string;
}

export interface AddRepairPartInput {
  item_id: string;
  qty: number;
  hpp_at_use: number;
}

export async function getRepairTickets(status?: string): Promise<RepairTicket[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return await fetchAPI<RepairTicket[]>(`/api/v1/repair-tickets${query}`);
}

export async function createRepairTicket(data: CreateRepairTicketInput): Promise<RepairTicket> {
  return await fetchAPI<RepairTicket>("/api/v1/repair-tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRepairTicketStatus(
  ticketId: string, 
  data: UpdateRepairTicketStatusInput
): Promise<RepairTicket> {
  return await fetchAPI<RepairTicket>(`/api/v1/repair-tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addRepairPart(
  ticketId: string, 
  data: AddRepairPartInput
): Promise<RepairPart> {
  return await fetchAPI<RepairPart>(`/api/v1/repair-tickets/${ticketId}/parts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// =============================================================================
// DOMAIN: MULTI-LOCATION INVENTORY & STOCK
// =============================================================================

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  type: "warehouse" | "store";
  is_active: boolean;
  created_at?: string;
}

export interface StockItem {
  item_id: string;
  sku: string;
  name: string;
  item_type: string;
  category?: string;
  base_price: number;
  location_id?: string | null;
  location_name?: string | null;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface StockTransferInput {
  item_id: string;
  from_location_id: string;
  to_location_id: string;
  qty: number;
  reason?: string;
}

export interface StockTransferResult {
  success: boolean;
  message: string;
  item_id: string;
  item_name: string;
  from_location_name: string;
  to_location_name: string;
  transferred_qty: number;
  from_location_remaining: number;
  to_location_new_stock: number;
}

export async function getLocations(): Promise<Location[]> {
  return await fetchAPI<Location[]>("/api/v1/inventory/locations");
}

export async function getStock(locationId?: string, query?: string): Promise<StockItem[]> {
  const params = new URLSearchParams();
  if (locationId) params.append("location_id", locationId);
  if (query) params.append("q", query);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return await fetchAPI<StockItem[]>(`/api/v1/inventory/stock${qs}`);
}

export async function transferStock(data: StockTransferInput): Promise<StockTransferResult> {
  return await fetchAPI<StockTransferResult>("/api/v1/inventory/stock-movements", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface GRNItemInput {
  item_id: string;
  qty: number;
  purchase_price: number;
}

export interface GRNCreateInput {
  supplier_id?: string;
  supplier_name?: string;
  delivery_order_number?: string;
  location_id?: string;
  notes?: string;
  items: GRNItemInput[];
}

export interface GRNItemDetail {
  item_id: string;
  item_name: string;
  sku: string;
  qty_received: number;
  purchase_price: number;
  subtotal: number;
  old_hpp: number;
  new_moving_average_hpp: number;
  new_total_stock: number;
}

export interface GRNResult {
  success: boolean;
  message: string;
  grn_number: string;
  delivery_order_number?: string;
  location_name: string;
  total_cost: number;
  items_count: number;
  details: GRNItemDetail[];
  journal_created: boolean;
}

export interface ReturnToSupplierInput {
  supplier_id?: string;
  supplier_name?: string;
  item_id: string;
  qty: number;
  return_price?: number;
  from_location_id?: string;
  reason?: string;
  reference_no?: string;
}

export interface ReturnToSupplierResult {
  success: boolean;
  message: string;
  return_number: string;
  item_name: string;
  qty_returned: number;
  return_unit_price: number;
  total_return_value: number;
  remaining_quarantine_stock: number;
  journal_created: boolean;
}

export interface QuarantineItem {
  item_id: string;
  sku: string;
  name: string;
  category: string;
  base_price: number;
  quarantine_qty: number;
  location_id: string;
  location_name: string;
  total_defect_value: number;
}

/**
 * Menyimpan Goods Receipt Note (GRN) dan menghitung Moving Average HPP
 */
export async function createGRN(data: GRNCreateInput): Promise<GRNResult> {
  return await fetchAPI<GRNResult>("/api/v1/inventory/grn", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Melakukan retur barang defect ke supplier
 */
export async function returnToSupplier(data: ReturnToSupplierInput): Promise<ReturnToSupplierResult> {
  return await fetchAPI<ReturnToSupplierResult>("/api/v1/inventory/return-to-supplier", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Memindahkan barang rusak ke Gudang Karantina
 */
export async function transferToQuarantine(data: {
  item_id: string;
  from_location_id: string;
  qty: number;
  notes?: string;
}): Promise<any> {
  return await fetchAPI("/api/v1/inventory/quarantine-defect", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Mengambil daftar stok barang di lokasi Karantina / Defect
 */
export async function getQuarantineItems(): Promise<QuarantineItem[]> {
  return await fetchAPI<QuarantineItem[]>("/api/v1/inventory/quarantine-items");
}

// =============================================================================
// DOMAIN: FINANCIAL REPORTS & GENERAL LEDGER
// =============================================================================

export interface JournalLine {
  id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit: number;
  credit: number;
  created_at?: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  transaction_date: string;
  description?: string;
  reference_type?: "POS_SALE" | "REPAIR" | "PURCHASE" | "MANUAL" | "ADJUSTMENT" | string;
  reference_id?: string;
  lines: JournalLine[];
  created_at?: string;
}

export interface OpexBreakdownItem {
  account_id: string;
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossSummary {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_opex?: number;
  net_profit?: number;
  opex_breakdown?: OpexBreakdownItem[];
  period?: string;
}

export interface BankBalanceItem {
  id: string;
  code: string;
  name: string;
  balance: number;
  total_debit: number;
  total_credit: number;
}

export interface BankBalancesResponse {
  tenant_id: string;
  accounts: BankBalanceItem[];
  total_liquid_balance: number;
}

export interface BalanceSheetItem {
  code: string;
  name: string;
  amount: number;
}

export interface BalanceSheetSection {
  items: BalanceSheetItem[];
  subtotal: number;
}

export interface BalanceSheetResponse {
  as_of_date: string;
  period_label: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
}

export interface COAAccount {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  type: string;
  parent_id?: string | null;
  is_active: boolean;
}

/**
 * Mengambil daftar Chart of Accounts (COA) milik tenant aktif.
 */
export async function getAccounts(): Promise<COAAccount[]> {
  return await fetchAPI<COAAccount[]>("/api/v1/accounting/accounts");
}

/**
 * Mengambil daftar buku jurnal umum (General Ledger) beserta ayat debit dan kreditnya.
 */
export async function getJournals(referenceType?: string): Promise<JournalEntry[]> {
  const query = referenceType ? `?reference_type=${encodeURIComponent(referenceType)}` : "";
  return await fetchAPI<JournalEntry[]>(`/api/v1/accounting/journals${query}`);
}

/**
 * Mengambil ringkasan Laba Rugi (Pendapatan, HPP, OPEX, dan Laba Bersih) untuk periode aktif.
 */
export async function getProfitLossSummary(options?: {
  month?: number;
  year?: number;
  all_time?: boolean;
}): Promise<ProfitLossSummary> {
  const params = new URLSearchParams();
  if (options?.month) params.append("month", options.month.toString());
  if (options?.year) params.append("year", options.year.toString());
  if (options?.all_time) params.append("all_time", "true");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return await fetchAPI<ProfitLossSummary>(`/api/v1/accounting/profit-loss-summary${qs}`);
}

/**
 * Mengambil saldo real-time per masing-masing akun kas fisik & rekening bank operasional.
 */
export async function getBankBalances(): Promise<BankBalancesResponse> {
  return await fetchAPI<BankBalancesResponse>("/api/v1/accounting/bank-balances");
}

/**
 * Mencatat beban operasional (OPEX) baru secara double-entry.
 */
export async function recordExpense(payload: {
  expense_name: string;
  amount: number;
  expense_account_id: string;
  source_account_id: string;
  transaction_date?: string;
  notes?: string;
}): Promise<JournalEntry> {
  return await fetchAPI<JournalEntry>("/api/v1/accounting/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mencatat pelunasan hutang ke supplier (AP Settlement).
 */
export async function paySupplier(payload: {
  supplier_name?: string;
  supplier_id?: string;
  grn_ref?: string;
  amount: number;
  source_account_id: string;
  liability_account_id?: string;
  transaction_date?: string;
  notes?: string;
}): Promise<JournalEntry> {
  return await fetchAPI<JournalEntry>("/api/v1/accounting/pay-supplier", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil Laporan Posisi Keuangan (Neraca / Balance Sheet).
 */
export async function getBalanceSheet(asOf?: string): Promise<BalanceSheetResponse> {
  const qs = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
  return await fetchAPI<BalanceSheetResponse>(`/api/v1/accounting/balance-sheet${qs}`);
}

// =============================================================================
// DOMAIN: E-COMMERCE MIGRATION, CLONER & STOREFRONT BUILDER
// ==============================================================================

export interface ClonedProductInput {
  name: string;
  source_price: number;
  category?: string;
  sku?: string;
  stock?: number;
  description?: string;
  image_url?: string;
  weight_grams?: number;
}

export interface ClonedProductOutput {
  original_name: string;
  seo_title: string;
  original_price: number;
  target_price: number;
  markup_nominal: number;
  markup_pct: number;
  category_name: string;
  tiktok_category_id: string;
  tiktok_category_name: string;
  attributes: Record<string, string>;
  bullets: string[];
  sku: string;
  stock: number;
  weight_grams: number;
  status: string;
}

export interface CloneAnalyzeRequest {
  source_platform: string;
  target_platform: string;
  source_fee_pct: number;
  target_fee_pct: number;
  margin_buffer_pct: number;
  products: ClonedProductInput[];
}

export interface CloneAnalyzeResponse {
  total_products: number;
  source_platform: string;
  target_platform: string;
  avg_markup_pct: number;
  total_original_value: number;
  total_target_value: number;
  products: ClonedProductOutput[];
}

export interface StorefrontItem {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  price: number;
  base_price?: number;
  stock_available: number;
  image_url?: string;
  description?: string;
}

export interface PublicStorefrontResponse {
  store_name: string;
  slug: string;
  whatsapp_number: string;
  tagline?: string;
  description?: string;
  address?: string;
  banner_url?: string;
  total_items: number;
  items: StorefrontItem[];
}

export interface StorefrontSettings {
  store_name: string;
  slug: string;
  whatsapp_number: string;
  tagline?: string;
  description?: string;
  address?: string;
  banner_url?: string;
  logo_url?: string;
  is_active: boolean;
}

/**
 * Menjalankan analisa AI SEO rewrite, category mapping, dan markup kalkulator untuk kloning produk.
 */
export async function analyzeAndCloneProducts(payload: CloneAnalyzeRequest): Promise<CloneAnalyzeResponse> {
  return await fetchAPI<CloneAnalyzeResponse>("/api/v1/ecommerce/clone/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengunduh file batch upload resmi TikTok Shop Seller Center.
 */
export async function exportTikTokBatchCSV(products: ClonedProductOutput[]): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexus_token") : null;
  const res = await fetch("http://localhost:8000/api/v1/ecommerce/clone/export-tiktok", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Tenant-ID": typeof window !== "undefined" ? localStorage.getItem("nexus_tenant_id") || "11111111-1111-1111-1111-111111111111" : "11111111-1111-1111-1111-111111111111"
    },
    body: JSON.stringify(products),
  });
  if (!res.ok) throw new Error("Gagal mengunduh template TikTok Shop.");
  return await res.text();
}

/**
 * Mengambil data etalase web toko publik berdasarkan slug toko.
 */
export async function getPublicStorefront(slug: string): Promise<PublicStorefrontResponse> {
  return await fetchAPI<PublicStorefrontResponse>(`/api/v1/ecommerce/storefront/public/${encodeURIComponent(slug)}`);
}

/**
 * Mengambil konfigurasi etalase toko online tenant aktif.
 */
export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  return await fetchAPI<StorefrontSettings>("/api/v1/ecommerce/storefront/settings");
}

/**
 * Memperbarui konfigurasi etalase toko online tenant aktif.
 */
export async function updateStorefrontSettings(payload: StorefrontSettings): Promise<StorefrontSettings> {
  return await fetchAPI<StorefrontSettings>("/api/v1/ecommerce/storefront/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// DOMAIN: DATA SCIENCE & MARKET INTELLIGENCE
// =============================================================================

export interface RFMCustomer {
  customer_id: string;
  customer_name: string;
  phone: string;
  recency_days: number;
  frequency: number;
  monetary_total: number;
  segment: "Champions" | "Loyal Customers" | "At Risk" | "Lost" | "Promising / New" | string;
  badge_color: string;
  action: string;
  last_transaction?: string;
}

export interface RFMSegmentsResponse {
  tenant_id: string;
  analysis_date: string;
  summary: {
    champions: number;
    loyal: number;
    at_risk: number;
    lost: number;
    promising: number;
    total_customers: number;
  };
  customers: RFMCustomer[];
}

export interface PredictiveStockItem {
  item_id: string;
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  sold_last_30d: number;
  ads: number;
  days_until_stockout: number;
  status: "CRITICAL" | "WARNING" | "SAFE";
  recommended_reorder_qty: number;
  lead_time_days: number;
  risk_level: string;
}

export interface PredictiveStockResponse {
  tenant_id: string;
  period: string;
  critical_stockout_count: number;
  warning_stockout_count: number;
  items: PredictiveStockItem[];
}

export interface CompetitorListing {
  marketplace: string;
  seller: string;
  price: number;
  rating: number;
  sold: string;
}

export interface MarketIntelResponse {
  keyword: string;
  matched_item_name: string;
  our_price: number;
  market_average_price: number;
  market_min_price: number;
  market_max_price: number;
  price_difference_percentage: number;
  status_code: "UNCOMPETITIVE" | "UNDERPRICED" | "OPTIMAL";
  status_label: string;
  recommendation: string;
  competitor_listings: CompetitorListing[];
}

/**
 * Mengambil segmentasi pelanggan cerdas berdasarkan model RFM (Recency, Frequency, Monetary).
 */
export async function getRFMSegments(): Promise<RFMSegmentsResponse> {
  return await fetchAPI<RFMSegmentsResponse>("/api/v1/intelligence/rfm-segments");
}

/**
 * Mengambil prediksi kehabisan stok (< 7 hari) dan rekomendasi jumlah PO berdasarkan ADS (Average Daily Sales).
 */
export async function getPredictiveStock(): Promise<PredictiveStockResponse> {
  return await fetchAPI<PredictiveStockResponse>("/api/v1/intelligence/predictive-stock");
}

/**
 * Mengambil perbandingan intel pasar harga kompetitor marketplace (Shopee, Tokopedia).
 */
export async function getCompetitorPrices(keyword?: string): Promise<MarketIntelResponse> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
  return await fetchAPI<MarketIntelResponse>(`/api/v1/intelligence/market-intel${query}`);
}

// =============================================================================
// DOMAIN: API SIMULATOR & ADAPTER MOCKING (TIKTOK SHOP & WHATSAPP)
// =============================================================================

export interface NotificationLog {
  id: string;
  tenant_id: string;
  phone: string;
  message: string;
  template_name: string;
  status: string;
  channel: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface TikTokSimulationResult {
  simulation_webhook_payload: any;
  processing_result: {
    success: boolean;
    message: string;
    order_id: string;
    internal_order_id: string;
    buyer_name: string;
    buyer_phone: string;
    total_amount: number;
    total_cogs: number;
    items_processed: Array<{
      item_name: string;
      sku: string;
      marketplace_sku: string;
      qty: number;
      cost_price: number;
    }>;
    journal_entry_id?: string;
    wa_notification?: NotificationLog;
  };
}

export interface WASimulationResult {
  success: boolean;
  log: NotificationLog;
}

/**
 * Memicu simulasi order masuk dari TikTok Shop (Mock Adapter).
 */
export async function triggerSimulatedTikTokOrder(params?: {
  payment_method?: string;
  custom_items?: any[];
}): Promise<TikTokSimulationResult> {
  return await fetchAPI<TikTokSimulationResult>("/api/v1/simulator/tiktok-order", {
    method: "POST",
    body: JSON.stringify(params || {}),
  });
}

/**
 * Memicu simulasi pengiriman notifikasi WhatsApp (Mock Adapter).
 */
export async function triggerSimulatedWA(payload: {
  phone: string;
  template_type: "repair_done" | "aftercare_h1" | "aftercare_h7" | "aftercare_h14" | "custom";
  customer_name?: string;
  device_model?: string;
  ticket_id?: string;
  final_cost?: number;
  custom_message?: string;
}): Promise<WASimulationResult> {
  return await fetchAPI<WASimulationResult>("/api/v1/simulator/send-wa", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil daftar riwayat pesan WhatsApp yang terkirim (Simulasi).
 */
export async function getNotificationLogs(limit: number = 50): Promise<{ total: number; logs: NotificationLog[] }> {
  try {
    return await fetchAPI<{ total: number; logs: NotificationLog[] }>(`/api/v1/simulator/notification-logs?limit=${limit}`);
  } catch (error) {
    console.warn("Gagal mengambil log notifikasi, menggunakan fallback:", error);
    return {
      total: 2,
      logs: [
        {
          id: "wa-fallback-1",
          tenant_id: DEMO_TENANT_ID,
          phone: "+6281234567890",
          message: "Halo Budi! Servis iPhone 11 Anda (Tiket #REP-001) sudah selesai dan lolos QC teknisi. Total biaya: Rp 650.000.",
          template_name: "repair_done_notification",
          status: "SIMULATED_SENT",
          channel: "WHATSAPP",
          created_at: new Date().toISOString(),
        },
        {
          id: "wa-fallback-2",
          tenant_id: DEMO_TENANT_ID,
          phone: "+6281987654321",
          message: "Halo Kak Siti! Servis HP Anda sudah berjalan 1 hari (H+1). Mohon konfirmasi apakah touchscreen sudah responsif sempurna? Masa garansi aktif 30 hari.",
          template_name: "aftercare_h1_warranty",
          status: "SIMULATED_SENT",
          channel: "WHATSAPP",
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };
  }
}

// =============================================================================
// DOMAIN: WHATSAPP RAG SMARTBOT (ZERO-HALLUCINATION AGENT)
// =============================================================================

export interface MockWhatsAppReply {
  status: string;
  tenant_id: string;
  sender_phone: string;
  incoming_message: string;
  bot_reply: string;
  channel: string;
  timestamp: string;
}

export interface WhatsAppChatHistoryItem {
  id: string;
  phone: string;
  incoming_message: string;
  bot_reply: string;
  created_at: string;
}

/**
 * Mengirim pesan simulasi pelanggan ke WhatsApp RAG Smartbot.
 */
export async function sendMockWhatsAppMessage(payload: {
  phone: string;
  message: string;
}): Promise<MockWhatsAppReply> {
  return await fetchAPI<MockWhatsAppReply>("/api/v1/webhooks/mock-whatsapp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil riwayat percakapan WhatsApp RAG Smartbot dari database notification_logs.
 */
export async function getWhatsAppBotHistory(phone?: string): Promise<WhatsAppChatHistoryItem[]> {
  try {
    const qs = phone ? `?phone=${encodeURIComponent(phone)}` : "";
    const res = await fetchAPI<{ status: string; history: WhatsAppChatHistoryItem[] }>(`/api/v1/webhooks/whatsapp-history${qs}`);
    return res.history || [];
  } catch (err) {
    return [];
  }
}

// =============================================================================
// DOMAIN: NEXUS CONTROL PLANE & TELEGRAM COPILOT
// =============================================================================

export interface SupportTicketItem {
  id: string;
  ticket_number: string;
  tenant_id: string;
  business_name: string;
  category: "BUG" | "FEATURE_REQUEST" | "GENERAL" | string;
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | string;
  source: string;
  created_at: string;
  updated_at?: string;
}

export interface TelegramCopilotResponse {
  status: string;
  intent: string;
  ticket_created: boolean;
  ticket_data?: SupportTicketItem;
  reply: string;
}

/**
 * Mengirim pesan simulasi dari klien ke AI Telegram Copilot (Control Plane).
 */
export async function sendTelegramCopilotMessage(payload: {
  message: string;
  sender_name?: string;
  tenant_id?: string;
}): Promise<TelegramCopilotResponse> {
  return await fetchAPI<TelegramCopilotResponse>("/api/v1/control-plane/telegram-webhook", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil daftar seluruh tiket komplain support dari semua tenant (Control Plane View).
 */
export async function getSupportTickets(status?: string, category?: string): Promise<SupportTicketItem[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (category) params.append("category", category);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await fetchAPI<SupportTicketItem[]>(`/api/v1/control-plane/tickets${qs}`);
  } catch (err) {
    console.warn("Gagal mengambil daftar tiket support, menggunakan fallback demo:", err);
    return [
      {
        id: "tck-demo-1",
        ticket_number: "TCK-1001",
        tenant_id: DEMO_TENANT_ID,
        business_name: "Nexus HP Store (Demo Toko HP)",
        category: "BUG",
        subject: "Split Payment POS Offline Sync",
        description: "Transaksi split payment saat offline sempat pending di outbox browser, mohon dicek log sinkronisasinya.",
        status: "IN_PROGRESS",
        source: "TELEGRAM",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "tck-demo-2",
        ticket_number: "TCK-1002",
        tenant_id: DEMO_TENANT_ID,
        business_name: "Nexus HP Store (Demo Toko HP)",
        category: "FEATURE_REQUEST",
        subject: "Fitur Cetak Barcode Thermal Label 58mm",
        description: "Tolong tambahkan fitur cetak barcode label thermal 58mm langsung dari katalog inventori.",
        status: "OPEN",
        source: "TELEGRAM",
        created_at: new Date(Date.now() - 7200000).toISOString(),
      }
    ];
  }
}

/**
 * Memperbarui status tiket support oleh Super Admin ('OPEN' | 'IN_PROGRESS' | 'RESOLVED').
 */
export async function updateSupportTicketStatus(ticketId: string, newStatus: string): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus }),
  });
}

// =============================================================================
// DOMAIN: WEB COMMAND CENTER (SUPER ADMIN FLEET & DEVOPS APPROVAL)
// =============================================================================

export interface FleetTenantItem {
  tenant_id: string;
  business_name: string;
  plan_type: "BASIC" | "PREMIUM" | string;
  status: "ACTIVE" | "SUSPENDED" | string;
  health_status: "HEALTHY" | "DEGRADED" | "NEEDS_APPROVAL";
  active_tasks: number;
  token_cost_today: number;
  monthly_mrr: number;
  uptime_percent: number;
  ui_theme: string;
  enabled_modules: string[];
  feature_flags: Record<string, boolean>;
}

export interface ApprovalQueueItem {
  id: string;
  tenant_id: string;
  business_name: string;
  issue_id: string;
  issue_title: string;
  target_file: string;
  proposed_patch: string;
  sandbox_status: string;
  confidence_score: number;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  details?: string;
}

/**
 * Mengambil status armada seluruh tenant SaaS (Fleet Overview).
 */
export async function getFleetStatus(): Promise<FleetTenantItem[]> {
  try {
    return await fetchAPI<FleetTenantItem[]>("/api/v1/control-plane/fleet-status", {
      headers: {
        "X-Super-Admin": "true",
        "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
      },
    });
  } catch (err) {
    console.warn("Gagal mengambil fleet status, menggunakan fallback:", err);
    return [
      {
        tenant_id: "11111111-1111-1111-1111-111111111111",
        business_name: "Nexus HP Store (Demo Toko HP)",
        plan_type: "PREMIUM",
        status: "ACTIVE",
        health_status: "NEEDS_APPROVAL",
        active_tasks: 2,
        token_cost_today: 1.42,
        monthly_mrr: 750000,
        uptime_percent: 99.98,
        ui_theme: "dark",
        enabled_modules: ["pos", "repair", "inventory", "accounting", "intelligence", "copilot"],
        feature_flags: {
          enable_copilot: true,
          enable_advanced_analytics: true,
          enable_auto_po: false,
          enable_tiktok_sync: true,
        },
      },
      {
        tenant_id: "22222222-2222-2222-2222-222222222222",
        business_name: "Klinik Medika Sejahtera (Cabang Timur)",
        plan_type: "PREMIUM",
        status: "ACTIVE",
        health_status: "DEGRADED",
        active_tasks: 3,
        token_cost_today: 3.80,
        monthly_mrr: 1200000,
        uptime_percent: 99.45,
        ui_theme: "light",
        enabled_modules: ["emr", "billing", "inventory", "queue"],
        feature_flags: {
          enable_copilot: true,
          enable_advanced_analytics: true,
          enable_auto_po: true,
          enable_tiktok_sync: false,
        },
      },
      {
        tenant_id: "33333333-3333-3333-3333-333333333333",
        business_name: "Apotek Farmasi Prima",
        plan_type: "BASIC",
        status: "ACTIVE",
        health_status: "HEALTHY",
        active_tasks: 0,
        token_cost_today: 0.15,
        monthly_mrr: 450000,
        uptime_percent: 100.0,
        ui_theme: "dark",
        enabled_modules: ["pos", "inventory", "accounting"],
        feature_flags: {
          enable_copilot: false,
          enable_advanced_analytics: false,
          enable_auto_po: false,
          enable_tiktok_sync: false,
        },
      },
    ];
  }
}

/**
 * Mengambil antrean tindakan AI DevOps yang menunggu persetujuan (Approval Queue).
 */
export async function getApprovalQueue(): Promise<{ status: string; total_pending: number; queue: ApprovalQueueItem[] }> {
  try {
    return await fetchAPI<{ status: string; total_pending: number; queue: ApprovalQueueItem[] }>("/api/v1/control-plane/approval-queue", {
      headers: {
        "X-Super-Admin": "true",
        "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
      },
    });
  } catch (err) {
    console.warn("Gagal mengambil approval queue, fallback demo:", err);
    return {
      status: "success",
      total_pending: 1,
      queue: [
        {
          id: "act-devops-001",
          tenant_id: "11111111-1111-1111-1111-111111111111",
          business_name: "Nexus HP Store (Demo Toko HP)",
          issue_id: "TCK-1001",
          issue_title: "Fix: Penanganan Split Payment Null Key di Pos Sync Engine",
          target_file: "apps/core-api/app/api/v1/orders.py",
          proposed_patch: `@@ -570,7 +570,9 @@\n- payments = payload.payments\n+ payments = payload.payments or [{'payment_method': 'CASH', 'amount': payload.total_minor}]`,
          sandbox_status: "PASSED (E2B MicroVM)",
          confidence_score: 0.88,
          approval_status: "PENDING",
          created_at: new Date().toISOString(),
          details: "Menambahkan defensive fallback pada array split payments untuk mencegah HTTP 500.",
        },
      ],
    };
  }
}

/**
 * Menyetujui (Approve) atau menolak (Reject) tindakan AI DevOps oleh Super Admin.
 */
export async function approveAction(payload: {
  action_id: string;
  decision: "APPROVE" | "REJECT";
  reviewer_notes?: string;
}): Promise<any> {
  return await fetchAPI("/api/v1/control-plane/approve-action", {
    method: "POST",
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Memperbarui konfigurasi tema UI dan Feature Flags tenant (Feature Flags over Code Forking).
 */
export async function updateTenantConfig(
  tenantId: string,
  config: {
    ui_theme?: string;
    enabled_modules?: string[];
    feature_flags?: Record<string, boolean>;
  }
): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/config`, {
    method: "PATCH",
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
    body: JSON.stringify(config),
  });
}

/**
 * Memicu analisis self-healing LangGraph DevOps Swarm Agent dari Command Center.
 */
export async function triggerDevOpsSwarm(payload: {
  tenant_id: string;
  issue_description: string;
  business_name?: string;
}): Promise<any> {
  return await fetchAPI("/api/v1/control-plane/trigger-devops", {
    method: "POST",
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil riwayat percakapan chat copilot/helpdesk yang terisolasi ketat per tenant.
 */
export async function getTenantChatHistory(tenantId: string): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/chat-history`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Mengambil histori perubahan kode / patch visual Git terisolasi ketat per tenant.
 */
export async function getTenantCodeDiffs(tenantId: string, statusFilter?: string): Promise<any> {
  const query = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/code-diffs${query}`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Mengambil Unified Audit Trail lengkap (Chat, Diffs, Traces, Billing) terisolasi ketat per tenant.
 */
export async function getTenantAuditTrail(tenantId: string): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/audit-trail`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Playbook 5.7.1: Mengambil daftar insiden global yang dideduplikasi (anti-alert fatigue).
 */
export async function getGlobalIncidents(): Promise<any> {
  return await fetchAPI("/api/v1/control-plane/incidents", {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Playbook 5.7.2: Mengambil Automated Weekly Health Digest per tenant.
 */
export async function getTenantWeeklyHealthDigest(tenantId: string): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/health-digest`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Playbook 5.7.3: Memeriksa status Circuit Breaker tenant.
 */
export async function getTenantCircuitBreaker(tenantId: string): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/circuit-breaker`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Playbook 5.7.3: Mengubah status saklar Circuit Breaker (TRIP darurat / RESET).
 */
export async function updateTenantCircuitBreaker(
  tenantId: string,
  action: "TRIP" | "RESET",
  reason?: string
): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/tenants/${encodeURIComponent(tenantId)}/circuit-breaker`, {
    method: "POST",
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
    body: JSON.stringify({ action, reason }),
  });
}

// =============================================================================
// DOMAIN: BILLING TRACKER & CLIENT PORTAL HELPDESK
// =============================================================================

export interface BillingRecordItem {
  id: string;
  tenant_id: string;
  business_name?: string;
  task_id: string;
  task_type: "FEATURE_REQUEST" | "BUG_FIX" | "AUTO_DEPLOY";
  description: string;
  agent_duration_seconds: number;
  ai_token_cost: number;
  complexity_score: number;
  estimated_cost_idr: number;
  status: "PENDING_BILLING" | "BILLED" | "PAID";
  created_at: string;
}

export interface BillingResponse {
  status: string;
  total_records: number;
  total_cost_idr: number;
  total_tokens: number;
  pending_billing_idr: number;
  paid_idr: number;
  records: BillingRecordItem[];
}

export interface PortalMessageItem {
  id: string;
  tenant_id: string;
  sender: "CLIENT" | "AI";
  message: string;
  created_at: string;
}

export interface PortalChatResponse {
  status: string;
  reply: string;
  ticket_created: boolean;
  ticket_data?: {
    ticket_number: string;
    category: string;
    subject: string;
    status: string;
    estimated_cost_idr?: number;
  };
  billing_recorded: boolean;
  timestamp: string;
}

/**
 * Mengambil riwayat pesan chat di Client Portal Helpdesk.
 */
export async function getPortalMessages(tenantId: string): Promise<{ messages: PortalMessageItem[] }> {
  return await fetchAPI<{ messages: PortalMessageItem[] }>(
    `/api/v1/control-plane/portal-messages?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      headers: {
        "X-Tenant-ID": tenantId,
      },
    }
  );
}

/**
 * Mengirim pesan chat dari Client Portal ke AI Helpdesk.
 */
export async function sendPortalChatMessage(payload: {
  tenant_id: string;
  message: string;
  sender_name?: string;
}): Promise<PortalChatResponse> {
  return await fetchAPI<PortalChatResponse>("/api/v1/control-plane/portal-chat", {
    method: "POST",
    headers: {
      "X-Tenant-ID": payload.tenant_id,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil data penagihan komputasi AI (Billing Tracker).
 */
export async function getBillingRecords(filters?: {
  tenant_id?: string;
  task_type?: string;
  status?: string;
}): Promise<BillingResponse> {
  const params = new URLSearchParams();
  if (filters?.tenant_id) params.append("tenant_id", filters.tenant_id);
  if (filters?.task_type && filters.task_type !== "ALL") params.append("task_type", filters.task_type);
  if (filters?.status && filters.status !== "ALL") params.append("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  return await fetchAPI<BillingResponse>(`/api/v1/control-plane/billing${query}`, {
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": filters?.tenant_id || "00000000-0000-0000-0000-000000000000",
    },
  });
}

/**
 * Mengubah status penagihan task (Super Admin Invoicing).
 */
export async function updateBillingRecordStatus(
  recordId: string,
  newStatus: "PENDING_BILLING" | "BILLED" | "PAID"
): Promise<any> {
  return await fetchAPI(`/api/v1/control-plane/billing/${encodeURIComponent(recordId)}/status`, {
    method: "PATCH",
    headers: {
      "X-Super-Admin": "true",
      "X-Tenant-ID": "00000000-0000-0000-0000-000000000000",
    },
    body: JSON.stringify({ status: newStatus }),
  });
}

/**
 * Memicu pengerjaan feature request oleh DevOps Swarm Agent.
 */
export async function triggerFeatureTask(payload: {
  tenant_id: string;
  feature_description: string;
  business_name?: string;
}): Promise<any> {
  return await fetchAPI("/api/v1/control-plane/trigger-feature-task", {
    method: "POST",
    headers: {
      "X-Tenant-ID": payload.tenant_id,
    },
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// DOMAIN: CASHIER SHIFTS & BLIND BALANCING
// =============================================================================

export interface ShiftResponse {
  id: string;
  tenant_id: string;
  cashier_id: string;
  cashier_name: string;
  status: "OPEN" | "CLOSED";
  opening_cash: number;
  closing_cash?: number | null;
  cash_sales?: number;
  expected_cash?: number | null;
  variance?: number | null;
  notes?: string | null;
  opened_at: string;
  closed_at?: string | null;
}

export interface CurrentShiftResponse {
  active_shift: ShiftResponse | null;
}

export interface ShiftOpenPayload {
  cashier_id: string;
  cashier_name: string;
  opening_cash: number;
  notes?: string;
}

export interface ShiftClosePayload {
  shift_id?: string;
  closing_cash: number;
  notes?: string;
}

/**
 * Mengambil informasi shift kasir yang sedang aktif
 */
export async function getCurrentShift(): Promise<CurrentShiftResponse> {
  return await fetchAPI<CurrentShiftResponse>("/api/v1/shifts/current");
}

/**
 * Membuka shift kasir baru dengan modal awal (opening_cash)
 */
export async function openShift(payload: ShiftOpenPayload): Promise<ShiftResponse> {
  return await fetchAPI<ShiftResponse>("/api/v1/shifts/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Menutup shift kasir dengan Blind Balancing
 */
export async function closeShift(payload: ShiftClosePayload): Promise<ShiftResponse> {
  return await fetchAPI<ShiftResponse>("/api/v1/shifts/close", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Mengambil riwayat shift kasir terdahulu
 */
export async function getShiftHistory(limit: number = 20): Promise<ShiftResponse[]> {
  return await fetchAPI<ShiftResponse[]>(`/api/v1/shifts/history?limit=${limit}`);
}

// =============================================================================
// DOMAIN: C-SUITE EXECUTIVE ADVISORY
// =============================================================================

export interface DeadStockItem {
  sku: string;
  name: string;
  stock: number;
  unit_cost: number;
  frozen_capital: number;
  days_idle: number;
  action_suggestion: string;
}

export interface CategoryMarginItem {
  category: string;
  avg_margin_pct: number;
  revenue_share_pct: number;
  total_revenue: number;
  gross_profit: number;
  health: "EXCELLENT" | "HEALTHY" | "WATCH";
  recommendation: string;
}

export interface RestockRecommendationItem {
  sku: string;
  name: string;
  current_stock: number;
  daily_velocity: number;
  days_left: number;
  suggested_order_qty: number;
  supplier_name: string;
  estimated_unit_price: number;
  estimated_total_cost: number;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface AdvisoryStructuredData {
  type: "DEAD_STOCK_TABLE" | "CATEGORY_MARGIN_CARDS" | "RESTOCK_RECOMMENDATION_TABLE" | "ACTION_CONFIRMATION" | "CASH_FLOW_SUMMARY" | "COMPETITOR_PRICE_SCAN";
  summary?: any;
  items?: DeadStockItem[];
  categories?: CategoryMarginItem[];
  recommendations?: RestockRecommendationItem[];
  action?: string;
  details?: any;
  keyword?: string;
  our_price?: number;
  market_lowest?: number;
  market_average?: number;
  market_highest?: number;
  recommendation?: string;
}

export interface AdvisoryResponse {
  tool_called: string;
  structured_data: AdvisoryStructuredData | null;
  reply: string;
}

export interface AdvisoryQuickMetrics {
  frozen_capital: number;
  dead_items_count: number;
  avg_margin_pct: number;
  critical_restock_count: number;
  suggested_restock_budget: number;
}

/**
 * Mengirim pesan / instruksi ke C-Suite Executive Advisory Engine
 */
export async function sendAdvisoryMessage(message: string): Promise<AdvisoryResponse> {
  return await fetchAPI<AdvisoryResponse>("/api/v1/intelligence/advisory", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/**
 * Mengambil ringkasan metrik eksekutif cepat
 */
export async function getAdvisoryQuickMetrics(): Promise<AdvisoryQuickMetrics> {
  return await fetchAPI<AdvisoryQuickMetrics>("/api/v1/intelligence/advisory/quick-metrics");
}

export interface TelegramSimulateResponse {
  status: string;
  type: string;
  chat_id: number;
  reply: string;
  inline_keyboard?: any;
  tool_called?: string;
}

/**
 * Simulasi percakapan / action trigger Telegram bot pemilik toko
 */
export async function simulateCSuiteTelegram(user_query: string): Promise<TelegramSimulateResponse> {
  return await fetchAPI<TelegramSimulateResponse>("/api/v1/csuite/telegram/simulate", {
    method: "POST",
    body: JSON.stringify({ user_query }),
  });
}

/**
 * Mengambil status integrasi bot Telegram C-Suite
 */
export async function getCSuiteTelegramStatus(): Promise<any> {
  return await fetchAPI<any>("/api/v1/csuite/telegram/status");
}

// =============================================================================
// DOMAIN: OFFICIAL PRODUCTION-READY MARKETPLACE WEBHOOK
// =============================================================================

export interface MarketplaceWebhookPayload {
  platform: "TIKTOK_SHOP" | "SHOPEE";
  event_type?: string;
  order_id: string;
  buyer: {
    name: string;
    phone?: string;
    shipping_address?: string;
  };
  items: Array<{
    marketplace_sku: string;
    quantity: number;
    unit_price: number;
  }>;
  total_amount: number;
  payment_method?: string;
  timestamp?: number;
}

export interface MarketplaceWebhookResponse {
  success: boolean;
  platform: string;
  marketplace_order_id: string;
  nexus_order_id: string;
  status: string;
  reserved_items: any[];
  journal_entry_id?: string;
  message: string;
}

/**
 * Memicu webhook order marketplace resmi (TikTok Shop / Shopee)
 */
export async function triggerMarketplaceWebhook(
  payload: MarketplaceWebhookPayload
): Promise<MarketplaceWebhookResponse> {
  return await fetchAPI<MarketplaceWebhookResponse>("/api/v1/webhooks/marketplace", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// DOMAIN: CRM & CUSTOMER 360 RETENTION
// =============================================================================

export interface CustomerDevice {
  brand: string;
  model: string;
  imei?: string;
  last_service_date?: string;
  warranty_until?: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  tier: string;
  address?: string;
  total_spent: number;
  total_orders: number;
  last_transaction_date?: string;
  rfm_segment: string;
  devices: CustomerDevice[];
  created_at: string;
}

export interface CustomerCreatePayload {
  name: string;
  phone: string;
  tier: string;
  address?: string;
  devices?: CustomerDevice[];
}

export interface RFMSummary {
  total_customers: number;
  avg_ltv: number;
  champions_count: number;
  loyal_count: number;
  at_risk_count: number;
  lost_count: number;
  segments: Record<string, number>;
}

export interface LifecycleSequence {
  id: string;
  title: string;
  delay_label: string;
  description: string;
  template_preview: string;
  target_event: string;
  is_active: boolean;
  sent_count: number;
}

export async function getCustomers(search?: string, tier?: string): Promise<Customer[]> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (tier) params.append("tier", tier);
  const q = params.toString() ? `?${params.toString()}` : "";
  return await fetchAPI<Customer[]>(`/api/v1/crm/customers${q}`);
}

export async function createCustomer(payload: CustomerCreatePayload): Promise<Customer> {
  return await fetchAPI<Customer>("/api/v1/crm/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(
  customerId: string, 
  payload: Partial<CustomerCreatePayload>
): Promise<Customer> {
  return await fetchAPI<Customer>(`/api/v1/crm/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCRMRFMSummary(): Promise<RFMSummary> {
  return await fetchAPI<RFMSummary>("/api/v1/crm/rfm-summary");
}

export async function getLifecycleSequences(): Promise<LifecycleSequence[]> {
  return await fetchAPI<LifecycleSequence[]>("/api/v1/crm/lifecycle");
}

export async function toggleLifecycleSequence(sequenceId: string): Promise<any> {
  return await fetchAPI(`/api/v1/crm/lifecycle/${encodeURIComponent(sequenceId)}/toggle`, {
    method: "POST",
  });
}

// =============================================================================
// DOMAIN: SOCIAL & E-COMMERCE MARKETING STUDIO
// =============================================================================

export interface CampaignDraft {
  id: string;
  tenant_id: string;
  title: string;
  caption: string;
  channels: string[];
  category: "PROMO" | "EDUCATION" | "SERVICE_SHOWCASE" | "NEW_ARRIVAL";
  target_audience: string;
  hashtags: string[];
  suggested_media: string;
  linked_sku?: string;
  linked_item_name?: string;
  status: "DRAFT" | "SCHEDULED" | "POSTED" | "REJECTED";
  generated_at: string;
  posted_at?: string;
  simulated_url?: string;
}

export interface ECommerceStatus {
  platform: string;
  account_name: string;
  is_connected: boolean;
  sync_status: string;
  total_synced_items: number;
  pending_orders: number;
  last_sync_time: string;
}

export interface DraftGeneratePayload {
  item_id?: string;
  item_name: string;
  sku?: string;
  angle: "DISCOUNT_PROMO" | "EDUCATIONAL_TIPS" | "URGENCY_LIMITED_STOCK" | "SERVICE_EXCELLENCE";
  target_channels?: string[];
}

export async function getMarketingCampaigns(statusFilter: string = "DRAFT"): Promise<CampaignDraft[]> {
  return await fetchAPI<CampaignDraft[]>(`/api/v1/marketing/campaigns?status_filter=${statusFilter}`);
}

export async function generateMarketingDraft(payload: DraftGeneratePayload): Promise<CampaignDraft> {
  return await fetchAPI<CampaignDraft>("/api/v1/marketing/generate-draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveCampaignDraft(campaignId: string): Promise<CampaignDraft> {
  return await fetchAPI<CampaignDraft>(`/api/v1/marketing/campaigns/${encodeURIComponent(campaignId)}/approve`, {
    method: "POST",
  });
}

export async function rejectCampaignDraft(campaignId: string): Promise<any> {
  return await fetchAPI(`/api/v1/marketing/campaigns/${encodeURIComponent(campaignId)}/reject`, {
    method: "POST",
  });
}

export async function getECommerceChannelStatus(): Promise<ECommerceStatus[]> {
  return await fetchAPI<ECommerceStatus[]>("/api/v1/marketing/ecommerce-status");
}

// =============================================================================
// DOMAIN: AUTHENTICATION, ONBOARDING & AI SALES FRONTLINER
// =============================================================================

export interface RegisterPayload {
  owner_name: string;
  business_name: string;
  business_type: string;
  phone: string;
  email?: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  phone: string;
  tenant_id: string;
  business_name: string;
  business_type: string;
  otp_preview?: string;
}

export interface VerifyOTPPayload {
  phone: string;
  otp_code: string;
  tenant_id?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  token?: string;
  tenant_id: string;
  owner_name: string;
  business_name: string;
  business_type: string;
  redirect_url: string;
}

export interface AIConsultantPayload {
  message: string;
  conversation_history?: Array<{ role: string; content: string }>;
  selected_business_type?: string;
}

export interface AIConsultantResponse {
  reply: string;
  suggested_preset?: string;
  action?: string | null;
}

export async function registerTenant(payload: RegisterPayload): Promise<RegisterResponse> {
  return await fetchAPI<RegisterResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyOTP(payload: VerifyOTPPayload): Promise<VerifyOTPResponse> {
  return await fetchAPI<VerifyOTPResponse>("/api/v1/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resendOTP(phone: string): Promise<{ success: boolean; message: string; otp_preview?: string }> {
  return await fetchAPI("/api/v1/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function chatAIConsultant(payload: AIConsultantPayload): Promise<AIConsultantResponse> {
  return await fetchAPI<AIConsultantResponse>("/api/v1/auth/ai-consultant-chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// DOMAIN: TEAM, GRANULAR RBAC & PAYWALL
// =============================================================================

export interface TeamMemberAPI {
  id: string;
  tenant_id: string;
  name: string;
  username: string;
  role: "OWNER" | "CASHIER" | "TECHNICIAN" | "WAREHOUSE" | "CUSTOM";
  phone?: string | null;
  is_active: boolean;
  permissions: {
    can_access_pos: boolean;
    can_view_cost_price: boolean;
    can_view_profit_margin: boolean;
    can_edit_selling_price: boolean;
    can_give_discount: boolean;
    can_manage_inventory: boolean;
    can_access_crm: boolean;
    can_access_repair: boolean;
    can_access_settings: boolean;
  };
  created_at: string;
}

export interface CreateTeamMemberPayload {
  name: string;
  username: string;
  role: string;
  pin_code: string;
  phone?: string;
  permissions?: Record<string, boolean>;
}

export interface UpdateTeamMemberPayload {
  name?: string;
  role?: string;
  pin_code?: string;
  phone?: string;
  is_active?: boolean;
  permissions?: Record<string, boolean>;
}

export interface PlanStatusAPI {
  plan_tier: string;
  plan_name: string;
  max_staff_limit: number;
  current_staff_count: number;
  is_unlimited_staff: boolean;
  features: Record<string, boolean>;
  upgrade_price_monthly: number;
}

export async function fetchTeamMembers(tenantId = "default-tenant"): Promise<TeamMemberAPI[]> {
  return await fetchAPI<TeamMemberAPI[]>(`/api/v1/team/members?tenant_id=${tenantId}`);
}

export async function createTeamMember(payload: CreateTeamMemberPayload, tenantId = "default-tenant"): Promise<TeamMemberAPI> {
  return await fetchAPI<TeamMemberAPI>(`/api/v1/team/members?tenant_id=${tenantId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTeamMember(memberId: string, payload: UpdateTeamMemberPayload, tenantId = "default-tenant"): Promise<TeamMemberAPI> {
  return await fetchAPI<TeamMemberAPI>(`/api/v1/team/members/${memberId}?tenant_id=${tenantId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTeamMember(memberId: string, tenantId = "default-tenant"): Promise<{ success: boolean; message: string }> {
  return await fetchAPI<{ success: boolean; message: string }>(`/api/v1/team/members/${memberId}?tenant_id=${tenantId}`, {
    method: "DELETE",
  });
}

export async function verifyStaffPin(pinCode: string, staffId?: string, tenantId = "default-tenant"): Promise<{
  success: boolean;
  staff: TeamMemberAPI;
}> {
  return await fetchAPI<{ success: boolean; staff: TeamMemberAPI }>(`/api/v1/team/verify-pin?tenant_id=${tenantId}`, {
    method: "POST",
    body: JSON.stringify({ pin_code: pinCode, staff_id: staffId }),
  });
}

export async function fetchPlanStatus(tenantId = "default-tenant"): Promise<PlanStatusAPI> {
  return await fetchAPI<PlanStatusAPI>(`/api/v1/team/plan-status?tenant_id=${tenantId}`);
}

export async function requestPlanUpgrade(featureName: string, requestedPlan = "PRO_AI", tenantId = "default-tenant"): Promise<{
  success: boolean;
  message: string;
  whatsapp_url: string;
}> {
  return await fetchAPI(`/api/v1/team/upgrade-request?tenant_id=${tenantId}`, {
    method: "POST",
    body: JSON.stringify({ feature_name: featureName, requested_plan: requestedPlan }),
  });
}

// =============================================================================
// DOMAIN A: MARKET INTELLIGENCE & TREND SCRAPER (FASE 6 - THE BRAIN)
// =============================================================================

export interface SceneDetail {
  time_range: string;
  visual_direction: string;
  spoken_text: string;
}

export interface ContentOpportunityAPI {
  opportunity_code: string;
  tenant_id: string;
  product_name: string;
  niche_category: string;
  source_type: "OWN_INVENTORY" | "AFFILIATE_PARTNER";
  inventory_match: {
    sku?: string | null;
    item_name?: string;
    stock_available: number;
    current_hpp: number;
    selling_price: number;
    profit_margin_pct: number;
    note?: string;
  };
  metrics: {
    velocity_score: number;
    margin_pct: number;
    competition_saturation: number;
    overall_opportunity_score: number;
    demand_level: "VERY_HIGH" | "MODERATE" | "LOW";
  };
  creative_brief: {
    target_audience: string;
    primary_pain_point: string;
    hook_angles: string[];
    recommended_video_format: string;
    scenes: {
      scene_1_hook: SceneDetail;
      scene_2_problem: SceneDetail;
      scene_3_solution_demo: SceneDetail;
      scene_4_cta: SceneDetail;
    };
    call_to_action: string;
  };
  ads_strategy: {
    daily_budget_idr: number;
    target_roas: number;
    campaign_type: string;
    audience_interests: string[];
    bidding_strategy: string;
    kill_switch_rule: string;
    scaling_rule: string;
    breakeven_units_per_day: number;
  };
  sosmed_strategy: {
    prime_time_wib: string;
    sound_recommendation: string;
    tone_of_voice: string;
    scenes?: any;
    suggested_hashtags: string[];
    engagement_comment_prompt: string;
  };
  status: "DISCOVERED" | "READY_FOR_PRODUCTION" | "APPROVED_FOR_STUDIO" | "IN_STUDIO" | "REJECTED";
  created_at: string;
}

export interface ConnectedAccountAPI {
  id: string;
  platform: "tiktok_shop" | "shopee" | "instagram" | "youtube" | "meta_ads";
  account_label: string;
  account_id_or_username: string;
  status: "ACTIVE" | "NEEDS_REAUTH" | "DISCONNECTED";
  total_views_30d: number;
  total_orders_30d: number;
  total_gmv_30d: number;
  connected_at: string;
}

export async function fetchMarketTrends(
  niche = "ALL",
  minScore?: number,
  sourceType = "ALL"
): Promise<{ status: string; total_items: number; opportunities: ContentOpportunityAPI[] }> {
  let url = `/api/v1/intelligence/trends?niche=${encodeURIComponent(niche)}&source_type=${encodeURIComponent(sourceType)}`;
  if (minScore !== undefined) {
    url += `&min_score=${minScore}`;
  }
  return await fetchAPI(url);
}

export async function triggerMarketScan(
  activeSources?: string[],
  configs?: Record<string, any>
): Promise<{ status: string; message: string; data: any }> {
  return await fetchAPI("/api/v1/intelligence/trigger-scan", {
    method: "POST",
    body: JSON.stringify({ active_sources: activeSources, configs: configs }),
  });
}

export async function fetchOpportunityDetail(opportunityCode: string): Promise<ContentOpportunityAPI> {
  return await fetchAPI(`/api/v1/intelligence/opportunities/${encodeURIComponent(opportunityCode)}`);
}

export async function updateOpportunityStatusAPI(
  opportunityCode: string,
  newStatus: string
): Promise<{ status: string; opportunity_code: string; new_status: string; data: ContentOpportunityAPI }> {
  return await fetchAPI(`/api/v1/intelligence/opportunities/${encodeURIComponent(opportunityCode)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: newStatus }),
  });
}

export async function fetchConnectedAccounts(): Promise<{
  status: string;
  total_accounts: number;
  accounts: ConnectedAccountAPI[];
}> {
  return await fetchAPI("/api/v1/intelligence/connected-accounts");
}

export async function connectNewAccount(payload: {
  platform: string;
  account_label: string;
  account_id_or_username: string;
}): Promise<{ status: string; message: string; account: ConnectedAccountAPI }> {
  return await fetchAPI("/api/v1/intelligence/connected-accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCSuiteMarketBrief(): Promise<any> {
  return await fetchAPI("/api/v1/intelligence/csuite-brief");
}

// ==============================================================================
// DOMAIN B: AI CREATIVE & REMOTION VIDEO STUDIO
// ==============================================================================

export interface ScriptScene {
  scene_index: number;
  name: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  visual_cue: string;
  narration: string;
  on_screen_text: string;
  kinetic_highlight?: string;
  background_asset_url?: string;
  show_product_card?: boolean;
  show_cta_ribbon?: boolean;
}

export interface ScriptVariant {
  id: string;
  angle_type: "FOMO_AGITATION" | "EDUCATIONAL_REVIEW" | "BEFORE_AFTER_STORY" | string;
  angle_label: string;
  hook_text: string;
  target_pacing_wpm: number;
  scenes: ScriptScene[];
  estimated_duration_sec: number;
  compliance_check: {
    status: string;
    compliance_score: number;
    warnings: string[];
    rules_checked: string[];
  };
  is_selected: boolean;
}

export interface SubtitleCue {
  scene_index: number;
  word_index: number;
  word: string;
  start_ms: number;
  end_ms: number;
  is_emphasis: boolean;
}

export interface RemotionCompositionProps {
  composition_id: string;
  canvas: {
    width: number;
    height: number;
    fps: number;
    duration_in_frames: number;
    aspect_ratio: string;
  };
  brand: {
    title: string;
    product_name: string;
    formatted_price: string;
    original_price: string;
    discount_badge: string;
    stock_badge: string;
    rating: string;
    packshot_image_url: string;
  };
  audio: {
    voiceover_url: string;
    voice_label: string;
    bgm_track_id: string;
    bgm_volume: number;
    waveform_data: number[];
  };
  subtitles: SubtitleCue[];
  scenes: any[];
  theme: {
    primary_accent: string;
    warning_accent: string;
    danger_accent: string;
    bg_dark: string;
    font_family: string;
  };
}

export interface VideoProductionJob {
  id: string;
  tenant_id: string;
  opportunity_code: string;
  title: string;
  product_name: string;
  category: string;
  price_idr: number;
  stock_remaining: number;
  target_niche: string;
  format: string;
  status: "QUEUED" | "SCRIPTING" | "SYNTHESIZING_AUDIO" | "COMPOSING_SCENES" | "READY_FOR_REVIEW" | "APPROVED" | "FAILED" | string;
  selected_variant_id: string;
  script_variants: ScriptVariant[];
  active_script: ScriptVariant;
  voice_identity_id: string;
  bgm_track_id: string;
  bgm_volume: number;
  audio_bundle: {
    status: string;
    audio_track_url: string;
    voice_used: { id: string; name: string; tone: string };
    bgm_used: { id: string; title: string; default_volume: number };
    total_duration_sec: number;
    subtitles_payload: SubtitleCue[];
    waveform_data: number[];
  };
  composition_props: RemotionCompositionProps;
  rendered_video_url: string;
  thumbnail_url: string;
  render_metrics: {
    resolution: string;
    aspect_ratio: string;
    fps: number;
    total_frames: number;
    duration_sec: number;
    render_time_ms: number;
    file_size_mb: number;
    video_codec: string;
    cost_usd: number;
    cost_idr: number;
  };
  compliance_score: number;
  compliance_check: {
    status: string;
    compliance_score: number;
    warnings: string[];
    rules_checked: string[];
  };
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceIdentity {
  id: string;
  name: string;
  gender: string;
  tone: string;
  recommended_niche: string;
  preview_url: string;
  language: string;
}

export interface BGMTrack {
  id: string;
  title: string;
  tempo_bpm: number;
  mood: string;
  default_volume: number;
  preview_url: string;
}

export async function fetchStudioJobs(status?: string, niche?: string): Promise<{
  status: string;
  total_jobs: number;
  jobs: VideoProductionJob[];
}> {
  let url = "/api/v1/studio/jobs";
  const params = [];
  if (status && status !== "ALL") params.push(`status=${encodeURIComponent(status)}`);
  if (niche && niche !== "ALL") params.push(`niche=${encodeURIComponent(niche)}`);
  if (params.length > 0) url += `?${params.join("&")}`;
  return await fetchAPI(url);
}

export async function fetchStudioJobDetail(jobId: string): Promise<{
  status: string;
  job: VideoProductionJob;
}> {
  return await fetchAPI(`/api/v1/studio/jobs/${encodeURIComponent(jobId)}`);
}

export async function createVideoJob(payload: {
  opportunity_code: string;
  product_name: string;
  category?: string;
  price_idr?: number;
  stock_remaining?: number;
  pain_points?: string[];
  unique_selling_points?: string[];
  target_audience?: string;
}): Promise<{ status: string; message: string; job: VideoProductionJob }> {
  return await fetchAPI("/api/v1/studio/jobs/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function selectScriptVariantAPI(jobId: string, variantId: string): Promise<{
  status: string;
  message: string;
  job: VideoProductionJob;
}> {
  return await fetchAPI(`/api/v1/studio/jobs/${encodeURIComponent(jobId)}/select-variant`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId }),
  });
}

export async function configureStudioAudioAPI(
  jobId: string,
  payload: { voice_identity_id: string; bgm_track_id: string; bgm_volume: number }
): Promise<{ status: string; message: string; job: VideoProductionJob }> {
  return await fetchAPI(`/api/v1/studio/jobs/${encodeURIComponent(jobId)}/configure-audio`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function triggerRenderVideoAPI(jobId: string): Promise<{
  status: string;
  message: string;
  job: VideoProductionJob;
}> {
  return await fetchAPI(`/api/v1/studio/jobs/${encodeURIComponent(jobId)}/render`, {
    method: "POST",
  });
}

export async function approveStudioJobAPI(
  jobId: string,
  operatorName = "Admin Operator"
): Promise<{ status: string; message: string; job: VideoProductionJob }> {
  return await fetchAPI(`/api/v1/studio/jobs/${encodeURIComponent(jobId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ operator_name: operatorName }),
  });
}

export async function fetchVoiceIdentities(): Promise<{ status: string; voices: VoiceIdentity[] }> {
  return await fetchAPI("/api/v1/studio/voice-identities");
}

export async function fetchBGMTracks(): Promise<{ status: string; bgm_tracks: BGMTrack[] }> {
  return await fetchAPI("/api/v1/studio/bgm-tracks");
}

// ==============================================================================
// DOMAIN C: MULTI-CHANNEL PUBLISHING & CLOSED-LOOP ATTRIBUTION
// ==============================================================================

export interface PublicationChannel {
  id: string;
  tenant_id: string;
  platform: "YOUTUBE_SHORTS" | "TIKTOK" | "INSTAGRAM_REELS" | string;
  channel_name: string;
  channel_handle: string;
  is_active: boolean;
  daily_post_limit: number;
  posts_today: number;
  created_at: string;
}

export interface PublishedPost {
  id: string;
  tenant_id: string;
  video_job_id: string;
  opportunity_code: string;
  channel_id: string;
  platform: string;
  external_post_id: string;
  post_url: string;
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "DRAFT_READY" | "FAILED" | string;
  caption: string;
  hashtags: string[];
  scheduled_for?: string | null;
  published_at?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface AttributionLink {
  id: string;
  tenant_id: string;
  opportunity_code: string;
  short_code: string;
  short_url: string;
  destination_url: string;
  campaign_tag: string;
  total_clicks: number;
  unique_visitors: number;
  total_purchases: number;
  attributed_gmv_idr: number;
  attributed_commission_idr: number;
  conversion_rate_pct: number;
  created_at: string;
}

export interface PrimeTimeSlot {
  slot_name: string;
  time_wib: string;
  weight: string;
}

export interface CalibrationLog {
  id: string;
  tenant_id: string;
  opportunity_code: string;
  product_name: string;
  views_48h: number;
  clicks_48h: number;
  ctr_pct: number;
  orders_count: number;
  attributed_revenue_idr: number;
  attributed_commission_idr: number;
  old_weights: { w_demand: number; w_margin: number; w_competition: number };
  new_weights: { w_demand: number; w_margin: number; w_competition: number };
  winning_hook_angle: string;
  calibration_reason: string;
  calibrated_at: string;
}

export interface ClosedLoopStatus {
  tenant_id: string;
  active_scoring_weights: { w_demand: number; w_margin: number; w_competition: number };
  total_calibrations: number;
  recent_calibrations: CalibrationLog[];
}

export async function fetchPublicationChannels(): Promise<{
  status: string;
  total_channels: number;
  channels: PublicationChannel[];
}> {
  return await fetchAPI("/api/v1/publishing/channels");
}

export async function connectPublicationChannel(payload: {
  platform: string;
  channel_name: string;
  channel_handle: string;
  credentials_encrypted?: string;
}): Promise<{ status: string; message: string; channel: PublicationChannel }> {
  return await fetchAPI("/api/v1/publishing/channels/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPrimeTimeSlots(): Promise<{ status: string; slots: PrimeTimeSlot[] }> {
  return await fetchAPI("/api/v1/publishing/prime-time-slots");
}

export async function fetchPublishingQueue(status?: string, platform?: string): Promise<{
  status: string;
  total_posts: number;
  posts: PublishedPost[];
}> {
  let url = "/api/v1/publishing/queue";
  const params = [];
  if (status && status !== "ALL") params.push(`status=${encodeURIComponent(status)}`);
  if (platform && platform !== "ALL") params.push(`platform=${encodeURIComponent(platform)}`);
  if (params.length > 0) url += `?${params.join("&")}`;
  return await fetchAPI(url);
}

export async function publishVideoNow(payload: {
  video_job_id: string;
  opportunity_code?: string;
  platform: string;
  channel_id: string;
  caption: string;
  hashtags?: string[];
  metadata?: Record<string, any>;
}): Promise<{ status: string; message: string; post: PublishedPost }> {
  return await fetchAPI("/api/v1/publishing/publish-now", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function scheduleVideoPublication(payload: {
  video_job_id: string;
  opportunity_code?: string;
  platform: string;
  channel_id: string;
  scheduled_for: string;
  caption: string;
  hashtags?: string[];
  metadata?: Record<string, any>;
}): Promise<{ status: string; message: string; post: PublishedPost }> {
  return await fetchAPI("/api/v1/publishing/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAttributionLinks(opportunityCode?: string): Promise<{
  status: string;
  total_links: number;
  links: AttributionLink[];
}> {
  let url = "/api/v1/publishing/attribution/links";
  if (opportunityCode) url += `?opportunity_code=${encodeURIComponent(opportunityCode)}`;
  return await fetchAPI(url);
}

export async function createAttributionLinkAPI(payload: {
  opportunity_code: string;
  destination_url: string;
  short_code?: string;
  campaign_tag?: string;
  publication_id?: string;
}): Promise<{ status: string; message: string; link: AttributionLink }> {
  return await fetchAPI("/api/v1/publishing/attribution/create-link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function ingestClosedLoopFeedbackAPI(payload: {
  opportunity_code: string;
  product_name: string;
  views_48h: number;
  clicks_48h: number;
  orders_count: number;
  attributed_revenue_idr: number;
  winning_angle?: string;
}): Promise<{ status: string; message: string; data: any }> {
  return await fetchAPI("/api/v1/publishing/closed-loop/ingest-performance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchClosedLoopStatusAPI(): Promise<{
  status: string;
  data: ClosedLoopStatus;
}> {
  return await fetchAPI("/api/v1/publishing/closed-loop/status");
}














