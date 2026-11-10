/**
 * NEXUS CORE OS - OFFLINE-FIRST CLIENT DATABASE (DEXIE.JS)
 * File: apps/web/lib/db.ts
 * 
 * Mengelola penyimpanan lokal IndexedDB di browser kasir:
 * 1. local_cart: Keranjang belanja kasir lokal agar tidak hilang saat refresh/offline.
 * 2. pending_transactions: Local Outbox untuk transaksi offline yang menunggu sinkronisasi idempotent.
 */

import Dexie, { type EntityTable } from "dexie";
import { Item } from "@/lib/api";
import type { ReceiptData } from "@/components/ReceiptModal";

export type PricingTier = "retail" | "reseller" | "technician";

export interface LocalCartItem {
  item: Item & { category?: string; stock?: number };
  qty: number;
}

export interface LocalCartRecord {
  id: string; // "active_cart"
  items: LocalCartItem[];
  pricing_tier: PricingTier;
  customer_phone?: string;
  service_mode?: boolean;
  service_form?: {
    customerName: string;
    customerPhone: string;
    deviceModel: string;
    issueDescription: string;
    estimatedCost: number;
  };
  updated_at: string;
}

export interface PendingTransaction {
  id?: number; // Primary key auto-increment di IndexedDB
  idempotency_key: string;
  payload_order: {
    items: Array<{ item_id: string; qty: number }>;
    payments?: Array<{ payment_method: string; amount: number }>;
    pricing_tier?: string;
    contact_id?: string;
    service_details?: any;
    metadata?: Record<string, any>;
  };
  receipt_snapshot?: ReceiptData | any;
  status: "PENDING" | "SYNCED" | "FAILED";
  error_message?: string;
  created_at: string;
  synced_at?: string;
}

/**
 * NexusPOSDatabase - Definisi Schema IndexedDB Dexie
 */
export class NexusPOSDatabase extends Dexie {
  local_cart!: EntityTable<LocalCartRecord, "id">;
  pending_transactions!: EntityTable<PendingTransaction, "id">;

  constructor() {
    super("NexusPOSDB");
    this.version(1).stores({
      local_cart: "id, pricing_tier, updated_at",
      pending_transactions: "++id, idempotency_key, status, created_at",
    });
  }
}

// Singleton instance Dexie database
export const db = new NexusPOSDatabase();

// =============================================================================
// HELPER METHODS UNTUK LOCAL CART
// =============================================================================

export async function saveLocalCart(cartRecord: Omit<LocalCartRecord, "updated_at">): Promise<void> {
  try {
    await db.local_cart.put({
      ...cartRecord,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Dexie] Gagal menyimpan local_cart:", err);
  }
}

export async function clearLocalCart(): Promise<void> {
  try {
    await db.local_cart.delete("active_cart");
  } catch (err) {
    console.warn("[Dexie] Gagal membersihkan local_cart:", err);
  }
}

// =============================================================================
// HELPER METHODS UNTUK PENDING TRANSACTIONS (LOCAL OUTBOX)
// =============================================================================

export async function enqueuePendingTransaction(
  tx: Omit<PendingTransaction, "id" | "status" | "created_at">
): Promise<number> {
  try {
    const id = await db.pending_transactions.add({
      ...tx,
      status: "PENDING",
      created_at: new Date().toISOString(),
    });
    return id as number;
  } catch (err) {
    console.error("[Dexie] Gagal mencatat pending_transactions:", err);
    throw err;
  }
}

export async function markTransactionSynced(id: number): Promise<void> {
  try {
    await db.pending_transactions.update(id, {
      status: "SYNCED",
      synced_at: new Date().toISOString(),
      error_message: undefined,
    });
  } catch (err) {
    console.warn("[Dexie] Gagal update status SYNCED:", err);
  }
}

export async function markTransactionFailed(id: number, errorMessage: string): Promise<void> {
  try {
    await db.pending_transactions.update(id, {
      status: "FAILED",
      error_message: errorMessage,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Dexie] Gagal update status FAILED:", err);
  }
}
