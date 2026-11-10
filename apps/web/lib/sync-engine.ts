/**
 * NEXUS CORE OS - BACKGROUND IDEMPOTENT SYNC ENGINE
 * File: apps/web/lib/sync-engine.ts
 * 
 * Bertanggung jawab menyinkronkan transaksi lokal IndexedDB (Local Outbox)
 * ke server FastAPI secara aman, idempotent, dan tahan putus jaringan.
 */

import { db, markTransactionSynced, markTransactionFailed, PendingTransaction } from "@/lib/db";
import { API_BASE_URL, DEMO_TENANT_ID } from "@/lib/api";

export interface SyncResult {
  synced: number;
  failed: number;
  pendingRemaining: number;
  errors: string[];
}

let isSyncRunning = false;

/**
 * Menyinkronkan seluruh transaksi berstatus 'PENDING' ke backend FastAPI.
 * Menggunakan header 'Idempotency-Key' untuk mencegah duplikasi jika request
 * sebelumnya sempat terproses di server saat koneksi putus tiba-tiba.
 */
export async function syncPendingTransactions(): Promise<SyncResult> {
  if (isSyncRunning) {
    return { synced: 0, failed: 0, pendingRemaining: 0, errors: [] };
  }

  // Cek apakah browser sedang offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, pendingRemaining: 0, errors: ["Browser offline"] };
  }

  isSyncRunning = true;
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // 1. Ambil semua record PENDING dari Dexie IndexedDB
    const pendingList = await db.pending_transactions
      .where("status")
      .equals("PENDING")
      .toArray();

    if (pendingList.length === 0) {
      return { synced: 0, failed: 0, pendingRemaining: 0, errors: [] };
    }

    console.log(`[SyncEngine] Memulai sinkronisasi ${pendingList.length} transaksi tertunda...`);

    // 2. Loop dan kirim setiap transaksi secara serial dengan Idempotency-Key
    for (const tx of pendingList) {
      if (!tx.id) continue;

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": DEMO_TENANT_ID,
            "Idempotency-Key": tx.idempotency_key,
          },
          body: JSON.stringify(tx.payload_order),
        });

        if (response.ok || response.status === 200 || response.status === 201) {
          // Sukses terproses atau idempotent return dari server
          await markTransactionSynced(tx.id);
          synced++;
          console.log(`[SyncEngine] ✓ Transaksi #${tx.id} (Key: ${tx.idempotency_key}) berhasil disinkronkan.`);
        } else if (response.status === 409) {
          // 409 Conflict: Stok habis di server saat parallel run / offline
          const errorJson = await response.json().catch(() => ({}));
          const errMsg = errorJson.detail || "Stok tidak mencukupi di server (409 Conflict)";
          await markTransactionFailed(tx.id, errMsg);
          failed++;
          errors.push(`Transaksi #${tx.id}: ${errMsg}`);
          console.warn(`[SyncEngine] ✗ Transaksi #${tx.id} konflik: ${errMsg}`);
        } else if (response.status >= 400 && response.status < 500) {
          // Validasi client error lainnya
          const errorJson = await response.json().catch(() => ({}));
          const errMsg = errorJson.detail || `Validasi gagal (HTTP ${response.status})`;
          await markTransactionFailed(tx.id, errMsg);
          failed++;
          errors.push(`Transaksi #${tx.id}: ${errMsg}`);
        } else {
          // 5xx Server Error atau Gateway Timeout: Biarkan PENDING untuk dicoba lagi
          console.warn(`[SyncEngine] Server error HTTP ${response.status}, tetap simpan sebagai PENDING.`);
        }
      } catch (networkErr: any) {
        // Gagal jaringan (koneksi terputus saat request berjalan)
        console.warn(`[SyncEngine] Gagal menjangkau server untuk transaksi #${tx.id}:`, networkErr.message);
        // Biarkan status tetap PENDING
      }
    }

    const remainingCount = await db.pending_transactions
      .where("status")
      .equals("PENDING")
      .count();

    return { synced, failed, pendingRemaining: remainingCount, errors };
  } catch (err: any) {
    console.error("[SyncEngine] Error fatal pada siklus sync:", err);
    return { synced, failed, pendingRemaining: 0, errors: [err.message || "Unknown error"] };
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Mendaftarkan listener otomatisasi sinkronisasi:
 * 1. Event `window.online` (saat koneksi pulih)
 * 2. Interval periodik setiap 30 detik
 */
export function registerAutoSyncEngine(
  onSyncComplete?: (result: SyncResult) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = async () => {
    console.log("[SyncEngine] Koneksi internet pulih. Memicu sinkronisasi...");
    const res = await syncPendingTransactions();
    if (onSyncComplete && (res.synced > 0 || res.failed > 0)) {
      onSyncComplete(res);
    }
  };

  window.addEventListener("online", handleOnline);

  // Interval sync periodik setiap 30 detik
  const intervalId = setInterval(async () => {
    if (navigator.onLine) {
      const res = await syncPendingTransactions();
      if (onSyncComplete && (res.synced > 0 || res.failed > 0)) {
        onSyncComplete(res);
      }
    }
  }, 30000);

  // Return function pembersih listener
  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(intervalId);
  };
}
