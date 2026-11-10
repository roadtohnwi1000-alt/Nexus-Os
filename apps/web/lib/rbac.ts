/**
 * NEXUS CORE OS - ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION SYSTEM
 * File: apps/web/lib/rbac.ts
 *
 * Mengatur hak akses granular staf:
 * - Kasir: Boleh transaksi, DILARANG lihat HPP/Modal Supplier, DILARANG lihat Laba Bersih, DILARANG ubah harga jual sesuka hati.
 * - Teknisi: Boleh servis & POS, DILARANG lihat Laba Bersih & Pengaturan.
 * - Gudang: Boleh kelola stok & HPP, DILARANG ubah harga jual atau akses CRM/Keuangan.
 * - Owner: Akses 100% tanpa batasan.
 */

export type StaffRole = "OWNER" | "CASHIER" | "TECHNICIAN" | "WAREHOUSE" | "CUSTOM";

export interface StaffPermissions {
  can_access_pos: boolean;          // Boleh akses kasir POS
  can_view_cost_price: boolean;     // Boleh lihat harga modal supplier (HPP)
  can_view_profit_margin: boolean;  // Boleh lihat laba bersih & margin total
  can_edit_selling_price: boolean;  // Boleh ubah harga jual manual di kasir
  can_give_discount: boolean;       // Boleh beri potongan diskon manual
  can_manage_inventory: boolean;    // Boleh tambah stok, GRN supplier, retur
  can_access_crm: boolean;          // Boleh akses kontak pelanggan & riwayat garansi
  can_access_repair: boolean;       // Boleh akses tiket servis / perbaikan
  can_access_settings: boolean;     // Boleh akses pengaturan toko & daftarkan staf
}

export interface StaffMember {
  id: string;
  tenant_id?: string;
  name: string;
  username: string;
  role: StaffRole;
  phone?: string | null;
  is_active: boolean;
  permissions: StaffPermissions;
  created_at?: string;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner / Pemilik Toko",
  CASHIER: "Kasir Toko",
  TECHNICIAN: "Teknisi / Mekanik",
  WAREHOUSE: "Admin Gudang",
  CUSTOM: "Kustom Spesifik",
};

export const ROLE_BADGE_COLORS: Record<StaffRole, string> = {
  OWNER: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  CASHIER: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  TECHNICIAN: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  WAREHOUSE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  CUSTOM: "bg-gray-500/20 text-gray-300 border-gray-500/40",
};

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  OWNER: {
    can_access_pos: true,
    can_view_cost_price: true,
    can_view_profit_margin: true,
    can_edit_selling_price: true,
    can_give_discount: true,
    can_manage_inventory: true,
    can_access_crm: true,
    can_access_repair: true,
    can_access_settings: true,
  },
  CASHIER: {
    can_access_pos: true,
    can_view_cost_price: false, // Aman: Kasir tidak tahu modal kulakan bos
    can_view_profit_margin: false, // Aman: Kasir tidak tahu laba bersih bos
    can_edit_selling_price: false, // Aman: Kasir dilarang mainkan harga jual
    can_give_discount: true,
    can_manage_inventory: false,
    can_access_crm: true,
    can_access_repair: false,
    can_access_settings: false,
  },
  TECHNICIAN: {
    can_access_pos: true,
    can_view_cost_price: false,
    can_view_profit_margin: false,
    can_edit_selling_price: false,
    can_give_discount: false,
    can_manage_inventory: false,
    can_access_crm: true,
    can_access_repair: true,
    can_access_settings: false,
  },
  WAREHOUSE: {
    can_access_pos: false,
    can_view_cost_price: true,
    can_view_profit_margin: false,
    can_edit_selling_price: false,
    can_give_discount: false,
    can_manage_inventory: true,
    can_access_crm: false,
    can_access_repair: false,
    can_access_settings: false,
  },
  CUSTOM: {
    can_access_pos: true,
    can_view_cost_price: false,
    can_view_profit_margin: false,
    can_edit_selling_price: false,
    can_give_discount: false,
    can_manage_inventory: false,
    can_access_crm: false,
    can_access_repair: false,
    can_access_settings: false,
  },
};

export const DEFAULT_OWNER_STAFF: StaffMember = {
  id: "owner-default",
  name: "Owner Toko (Anda)",
  username: "owner",
  role: "OWNER",
  is_active: true,
  permissions: ROLE_DEFAULT_PERMISSIONS.OWNER,
};

/**
 * Mengambil staf yang sedang aktif di browser session / localStorage.
 */
export function getActiveStaff(): StaffMember {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("nexus_active_staff");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Gagal membaca staf aktif dari localStorage", e);
    }
  }
  return DEFAULT_OWNER_STAFF;
}

/**
 * Menyimpan staf yang sedang aktif login di kasir dan memancarkan event sinkronisasi.
 */
export function setActiveStaff(staff: StaffMember): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("nexus_active_staff", JSON.stringify(staff));
      window.dispatchEvent(new CustomEvent("nexus_staff_changed", { detail: staff }));
    } catch (e) {
      console.warn("Gagal menyimpan staf aktif ke localStorage", e);
    }
  }
}

/**
 * Memeriksa apakah staf aktif memiliki izin tertentu.
 */
export function hasPermission(permissionKey: keyof StaffPermissions): boolean {
  const current = getActiveStaff();
  return Boolean(current.permissions?.[permissionKey]);
}
