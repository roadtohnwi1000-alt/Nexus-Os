"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Crown, 
  ArrowLeft, 
  Sparkles, 
  DollarSign, 
  Layers, 
  Smartphone,
  Check,
  X
} from "lucide-react";
import { 
  fetchTeamMembers, 
  createTeamMember, 
  updateTeamMember, 
  deleteTeamMember, 
  fetchPlanStatus, 
  TeamMemberAPI, 
  PlanStatusAPI 
} from "@/lib/api";
import { 
  StaffRole, 
  StaffMember,
  StaffPermissions, 
  ROLE_LABELS, 
  ROLE_BADGE_COLORS, 
  ROLE_DEFAULT_PERMISSIONS, 
  getActiveStaff, 
  setActiveStaff 
} from "@/lib/rbac";

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMemberAPI[]>([]);
  const [planStatus, setPlanStatus] = useState<PlanStatusAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStaffUser, setActiveStaffUser] = useState(() => getActiveStaff());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberAPI | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    role: "CASHIER" as StaffRole,
    pin_code: "",
    phone: "",
    permissions: { ...ROLE_DEFAULT_PERMISSIONS.CASHIER },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, planData] = await Promise.all([
        fetchTeamMembers(),
        fetchPlanStatus(),
      ]);
      setMembers(membersData);
      setPlanStatus(planData);
    } catch (err: any) {
      console.warn("Gagal memuat data tim:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingMember(null);
    setFormData({
      name: "",
      username: "",
      role: "CASHIER",
      pin_code: "",
      phone: "",
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.CASHIER },
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (member: TeamMemberAPI) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      username: member.username,
      role: member.role,
      pin_code: "", // Kosongkan, hanya diisi jika ingin ganti PIN
      phone: member.phone || "",
      permissions: { ...member.permissions },
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleRolePresetSelect = (role: StaffRole) => {
    setFormData((prev) => ({
      ...prev,
      role: role,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS[role] },
    }));
  };

  const handlePermissionToggle = (key: keyof StaffPermissions) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingMember) {
        // Update staf yang sudah ada
        const updatePayload: any = {
          name: formData.name,
          role: formData.role,
          phone: formData.phone,
          permissions: formData.permissions,
        };
        if (formData.pin_code && formData.pin_code.length >= 4) {
          updatePayload.pin_code = formData.pin_code;
        }

        const updated = await updateTeamMember(editingMember.id, updatePayload);
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setSuccessToast(`✓ Data staf "${updated.name}" berhasil diperbarui!`);
      } else {
        // Tambah staf baru
        if (!formData.pin_code || formData.pin_code.length < 4) {
          throw new Error("PIN Login kasir wajib diisi minimal 4 digit angka!");
        }

        const created = await createTeamMember({
          name: formData.name,
          username: formData.username,
          role: formData.role,
          pin_code: formData.pin_code,
          phone: formData.phone,
          permissions: formData.permissions,
        });

        setMembers((prev) => [...prev, created]);
        setSuccessToast(`✓ Staf baru "${created.name}" berhasil didaftarkan!`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan data staf!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (member: TeamMemberAPI) => {
    if (member.role === "OWNER") {
      alert("Akun Owner utama tidak dapat dihapus!");
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus staf "${member.name}"?`)) return;

    try {
      await deleteTeamMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setSuccessToast(`✓ Staf "${member.name}" berhasil dihapus.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus staf!");
    }
  };

  const handleSimulateLogin = (member: TeamMemberAPI) => {
    const staffObj = {
      id: member.id,
      name: member.name,
      username: member.username,
      role: member.role,
      is_active: member.is_active,
      permissions: member.permissions,
    };
    setActiveStaff(staffObj);
    setActiveStaffUser(staffObj);
    setSuccessToast(`👤 Sekarang Anda sedang aktif sebagai: ${member.name} (${ROLE_LABELS[member.role]})`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const isStarter = planStatus?.plan_tier === "STARTER";
  const staffLimit = planStatus?.max_staff_limit || 3;
  const currentCount = members.length;
  const isLimitReached = isStarter && currentCount >= staffLimit;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-sm font-medium shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link 
              href="/pos" 
              className="p-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] text-gray-400 hover:text-white transition-colors"
              title="Kembali ke Kasir POS"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-purple-400" />
              Pengaturan Tim & Hak Akses Kasir (RBAC)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 max-w-2xl">
            Daftarkan staf kasir, teknisi, dan admin gudang Anda. Lindungi data rahasia toko seperti 
            <strong className="text-gray-200"> harga modal supplier (HPP)</strong> dan <strong className="text-gray-200">laba bersih bos</strong> dari pandangan staf.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            disabled={isLimitReached}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg ${
              isLimitReached 
                ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20 hover:scale-105 active:scale-95"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Daftarkan Staf Baru</span>
          </button>
        </div>
      </div>

      {/* Active User Switcher Pill Banner */}
      <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300">
            {activeStaffUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="text-gray-400">Akun Aktif Saat Ini di Browser: </span>
            <strong className="text-white font-semibold">{activeStaffUser.name}</strong>{" "}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_BADGE_COLORS[activeStaffUser.role]}`}>
              {ROLE_LABELS[activeStaffUser.role]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeStaffUser.role !== "OWNER" && (
            <button
              onClick={() => {
                const foundOwner = members.find((m) => m.role === "OWNER");
                const owner: StaffMember = foundOwner
                  ? {
                      id: foundOwner.id,
                      name: foundOwner.name,
                      username: foundOwner.username,
                      role: foundOwner.role,
                      phone: foundOwner.phone,
                      is_active: foundOwner.is_active,
                      permissions: foundOwner.permissions,
                    }
                  : {
                      id: "owner-default",
                      name: "Owner Toko (Anda)",
                      username: "owner",
                      role: "OWNER",
                      is_active: true,
                      permissions: ROLE_DEFAULT_PERMISSIONS.OWNER,
                    };
                setActiveStaff(owner);
                setActiveStaffUser(owner);
                setSuccessToast("👑 Kembali login sebagai Owner penuh.");
                setTimeout(() => setSuccessToast(null), 2500);
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-all"
            >
              👑 Kembalikan ke Owner
            </button>
          )}
          <span className="text-gray-500 text-[11px]">
            (Gunakan tombol simulasi di tabel bawah untuk menguji sudut pandang kasir)
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Kuota Staf Card */}
        <div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Kuota Akun Staf</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
              {isStarter ? "Paket Starter" : "Paket Pro AI"}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{currentCount}</span>
            <span className="text-xs text-gray-400">/ {isStarter ? staffLimit : "Unlimited"} Staf</span>
          </div>
          {isLimitReached && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Batas kuota tercapai. Upgrade ke Pro AI untuk tambah kasir tanpa batas.
            </p>
          )}
        </div>

        {/* Perlindungan HPP Modal Card */}
        <div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Perlindungan Modal (HPP)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-300 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            Terkunci dari Kasir
          </div>
          <p className="text-[11px] text-gray-400 leading-tight">
            Staf kasir hanya melihat harga jual toko, modal supplier disembunyikan.
          </p>
        </div>

        {/* Perlindungan Laba Bersih Card */}
        <div className="p-4 rounded-xl bg-[#161616] border border-[#2a2a2a] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Perlindungan Laba Bersih</span>
            <Crown className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            Hanya Terbuka untuk Owner
          </div>
          <p className="text-[11px] text-gray-400 leading-tight">
            Laporan arus kas dan profit toko 100% aman di mata karyawan.
          </p>
        </div>
      </div>

      {/* Daftar Anggota Staf Table */}
      <div className="rounded-2xl border border-[#262626] bg-[#141414] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#262626] flex items-center justify-between bg-[#181818]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Daftar Anggota Staf & Karyawan Aktif</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#262626] text-gray-300 font-normal">
              {members.length} Orang
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
            Memuat daftar tim...
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {members.map((member) => {
              const isOwner = member.role === "OWNER";
              const isCurrentlyActive = activeStaffUser.id === member.id;

              return (
                <div
                  key={member.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isCurrentlyActive ? "bg-purple-950/15 border-l-4 border-purple-500" : "hover:bg-[#1a1a1a]"
                  }`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-900 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm sm:text-base">
                          {member.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_BADGE_COLORS[member.role]}`}>
                          {ROLE_LABELS[member.role]}
                        </span>
                        {isCurrentlyActive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/40">
                            Sedang Digunakan
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>Username: <strong className="text-gray-300">@{member.username}</strong></span>
                        {member.phone && (
                          <>
                            <span>•</span>
                            <span>WA: {member.phone}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 text-gray-400">
                          <KeyRound className="w-3 h-3 text-amber-400" />
                          PIN: <span className="font-mono text-gray-300">••••</span>
                        </span>
                      </div>

                      {/* Granular Permissions Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {member.permissions.can_access_pos && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#202020] text-gray-300 border border-[#2a2a2a]">
                            ✓ Kasir POS
                          </span>
                        )}
                        {!member.permissions.can_view_cost_price ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> HPP Disembunyikan
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" /> Bisa Lihat HPP
                          </span>
                        )}

                        {!member.permissions.can_view_profit_margin ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Laba Terkunci
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/40 flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" /> Buka Laba
                          </span>
                        )}

                        {!member.permissions.can_edit_selling_price ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-800/40">
                            🛑 Harga Jual Dikunci
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40">
                            Boleh Ubah Harga Jual
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* Simulasi Login Button */}
                    <button
                      onClick={() => handleSimulateLogin(member)}
                      title="Uji coba tampilan aplikasi dari sudut pandang staf ini"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isCurrentlyActive 
                          ? "bg-purple-600 text-white" 
                          : "bg-[#202020] hover:bg-[#2a2a2a] text-gray-300 hover:text-white border border-[#333]"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isCurrentlyActive ? "Aktif" : "Simulasikan"}</span>
                    </button>

                    {/* Edit Permissions Button */}
                    <button
                      onClick={() => openEditModal(member)}
                      title="Ubah hak akses atau reset PIN"
                      className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-gray-300 hover:text-white border border-[#333] transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Button (Not for owner) */}
                    {!isOwner && (
                      <button
                        onClick={() => handleDelete(member)}
                        title="Hapus staf"
                        className="p-1.5 rounded-lg bg-[#202020] hover:bg-red-950/50 text-gray-400 hover:text-red-400 border border-[#333] hover:border-red-800/50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT STAF */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-[#161616] border border-[#2e2e2e] p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                {editingMember ? `Ubah Hak Akses: ${editingMember.name}` : "Daftarkan Anggota Staf Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-[#222] text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Preset Role Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Pilih Template Posisi / Role Cepat:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["CASHIER", "TECHNICIAN", "WAREHOUSE", "CUSTOM"] as StaffRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRolePresetSelect(r)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                        formData.role === r
                          ? "bg-purple-600/25 border-purple-500 text-white shadow-sm"
                          : "bg-[#1f1f1f] border-[#2c2c2c] text-gray-400 hover:text-white"
                      }`}
                    >
                      {r === "CASHIER" && "Kasir Toko"}
                      {r === "TECHNICIAN" && "Teknisi"}
                      {r === "WAREHOUSE" && "Admin Gudang"}
                      {r === "CUSTOM" && "Kustom"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Identitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">Nama Lengkap Staf *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Misal: Budi Santoso"
                    className="w-full px-3 py-2 rounded-xl bg-[#202020] border border-[#333] text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">Username Login *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingMember)}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    placeholder="misal: budi_kasir"
                    className="w-full px-3 py-2 rounded-xl bg-[#202020] border border-[#333] text-white text-xs focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">
                    PIN Login Cepat (4-6 Digit) {editingMember ? "(Kosongkan jika tidak ubah)" : "*"}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required={!editingMember}
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="Misal: 1234"
                    className="w-full px-3 py-2 rounded-xl bg-[#202020] border border-[#333] text-white text-xs font-mono tracking-widest focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">No. WhatsApp Staf (Opsional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 rounded-xl bg-[#202020] border border-[#333] text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* GRANULAR PERMISSION CHECKLIST */}
              <div className="space-y-2 pt-2 border-t border-[#262626]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    Atur Hak Akses Granular Staf Ini:
                  </label>
                  <span className="text-[10px] text-gray-500">Centang apa yang diizinkan</span>
                </div>

                <div className="space-y-2 bg-[#1a1a1a] p-3.5 rounded-xl border border-[#2a2a2a] max-h-60 overflow-y-auto">
                  {/* Kasir POS */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_access_pos}
                      onChange={() => handlePermissionToggle("can_access_pos")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Boleh Akses Kasir POS</p>
                      <p className="text-[11px] text-gray-400">Bisa memproses penjualan nota & checkout barang.</p>
                    </div>
                  </label>

                  {/* Sembunyikan HPP */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_view_cost_price}
                      onChange={() => handlePermissionToggle("can_view_cost_price")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Boleh Lihat Harga Modal Supplier (HPP)</p>
                      <p className="text-[11px] text-amber-400/90">
                        {formData.permissions.can_view_cost_price 
                          ? "⚠️ PERINGATAN: Staf ini bisa melihat harga kulakan Anda dari supplier!"
                          : "✓ AMAN: Harga modal disembunyikan dari staf ini."}
                      </p>
                    </div>
                  </label>

                  {/* Sembunyikan Laba Bersih */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_view_profit_margin}
                      onChange={() => handlePermissionToggle("can_view_profit_margin")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Boleh Lihat Laba Bersih Toko</p>
                      <p className="text-[11px] text-gray-400">Akses dashboard keuangan dan margin keuntungan bos.</p>
                    </div>
                  </label>

                  {/* Kunci Harga Jual */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_edit_selling_price}
                      onChange={() => handlePermissionToggle("can_edit_selling_price")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Boleh Ubah Harga Jual Manual di Kasir</p>
                      <p className="text-[11px] text-gray-400">
                        {formData.permissions.can_edit_selling_price
                          ? "Staf dapat mengetik harga jual custom saat checkout."
                          : "✓ AMAN: Kasir dilarang mengubah harga jual patokan toko."}
                      </p>
                    </div>
                  </label>

                  {/* Beri Diskon */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_give_discount}
                      onChange={() => handlePermissionToggle("can_give_discount")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Boleh Beri Diskon Manual</p>
                      <p className="text-[11px] text-gray-400">Memberikan potongan harga di kasir.</p>
                    </div>
                  </label>

                  {/* Manajemen Stok */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_manage_inventory}
                      onChange={() => handlePermissionToggle("can_manage_inventory")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Kelola Stok & Inventaris Gudang</p>
                      <p className="text-[11px] text-gray-400">Akses tambah barang, stok opname, dan retur supplier.</p>
                    </div>
                  </label>

                  {/* CRM Pelanggan */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_access_crm}
                      onChange={() => handlePermissionToggle("can_access_crm")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Akses CRM & Kontak Pelanggan</p>
                      <p className="text-[11px] text-gray-400">Melihat daftar pembeli dan riwayat garansi/retur.</p>
                    </div>
                  </label>

                  {/* Servis */}
                  <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.can_access_repair}
                      onChange={() => handlePermissionToggle("can_access_repair")}
                      className="mt-0.5 rounded border-gray-600 text-purple-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-white">Akses Tiket Servis & Perbaikan</p>
                      <p className="text-[11px] text-gray-400">Modul intake servis bengkel / AC / HP.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2a2a2a] text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : editingMember ? "Simpan Perubahan" : "Daftarkan Staf"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
