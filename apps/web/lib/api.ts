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
  item_type: "stocked" | "service" | "digital";
  base_price: number;
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

// =============================================================================
// DOMAIN: ORDERS & POS
// =============================================================================

export interface OrderItemInput {
  item_id: string;
  qty: number;
}

export interface CreateOrderPayload {
  contact_id?: string;
  idempotency_key: string;
  items: OrderItemInput[];
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
