"""
NEXUS CORE OS - REPAIR TICKETS API ROUTER
File: apps/core-api/app/api/v1/repair_tickets.py

Menangani alur penerimaan servis HP (Intake), pembaruan status pengerjaan,
alokasi pemakaian sparepart fisik pada tiket servis, dan Auto-Accounting Engine
untuk penerbitan jurnal akuntansi otomatis saat servis selesai.

🧠 ATURAN ARSITEKTUR EMAS:
1. TENANCY ISOLATION: Setiap query SQL WAJIB menyertakan `WHERE tenant_id = :tenant_id`.
2. INTEGER MINOR UNITS: Seluruh nominal finansial (`estimated_cost`, `final_cost`, `hpp_at_use`)
   menggunakan tipe data integer (minor units / rupiah penuh), DILARANG float/decimal.
3. ATURAN BISNIS STATUS: Status 'Repairing' dan 'Done' mewajibkan pengisian `final_cost`.
4. AUTO-ACCOUNTING: Saat status berubah menjadi 'Done' atau 'Taken', otomatis menerbitkan
   jurnal pendapatan kas dan HPP sparepart ke General Ledger secara atomik.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id
from app.services.journal_service import create_auto_journal, get_or_create_default_accounts
from app.schemas.repair import (
    RepairTicketCreate,
    RepairTicketUpdate,
    RepairTicketResponse,
    RepairPartAdd,
    RepairPartResponse,
    RepairStatus
)

router = APIRouter(prefix="/repair-tickets", tags=["Repair Tickets (HP Servis)"])

# ==============================================================================
# ENDPOINT 1: BUAT TIKET SERVIS BARU (INTAKE)
# ==============================================================================
@router.post("", response_model=RepairTicketResponse, status_code=status.HTTP_201_CREATED)
async def create_repair_ticket(
    payload: RepairTicketCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mendaftarkan unit servis HP baru di meja intake/kasir.
    Status awal otomatis disetel ke 'Intake'.
    """
    ticket_id = uuid4()

    try:
        # 1. Validasi keberadaan customer_id jika dilampirkan
        customer_name = None
        if payload.customer_id:
            customer_res = await db.execute(
                text("""
                    SELECT display_name 
                    FROM public.contacts 
                    WHERE id = :cid AND tenant_id = :tenant_id
                """),
                {"cid": str(payload.customer_id), "tenant_id": str(current_tenant_id)}
            )
            cust_row = customer_res.mappings().first()
            if not cust_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Kontak pelanggan dengan ID '{payload.customer_id}' tidak ditemukan."
                )
            customer_name = cust_row["display_name"]

        # 2. Simpan tiket servis ke database
        insert_query = text("""
            INSERT INTO public.repair_tickets (
                id, tenant_id, customer_id, device_imei, device_model,
                device_password_pattern, complaint, status,
                assigned_technician_id, estimated_cost, final_cost,
                created_at, updated_at
            ) VALUES (
                :id, :tenant_id, :customer_id, :device_imei, :device_model,
                :device_password_pattern, :complaint, 'Intake',
                :assigned_technician_id, :estimated_cost, NULL,
                timezone('utc'::text, now()), timezone('utc'::text, now())
            )
            RETURNING id, tenant_id, customer_id, device_imei, device_model,
                      device_password_pattern, complaint, status,
                      assigned_technician_id, estimated_cost, final_cost,
                      created_at, updated_at
        """)

        result = await db.execute(
            insert_query,
            {
                "id": str(ticket_id),
                "tenant_id": str(current_tenant_id),
                "customer_id": str(payload.customer_id) if payload.customer_id else None,
                "device_imei": payload.device_imei.strip() if payload.device_imei else None,
                "device_model": payload.device_model.strip(),
                "device_password_pattern": payload.device_password_pattern,
                "complaint": payload.complaint.strip(),
                "assigned_technician_id": str(payload.assigned_technician_id) if payload.assigned_technician_id else None,
                "estimated_cost": int(payload.estimated_cost or 0)
            }
        )
        row = result.mappings().one()
        await db.commit()

        return RepairTicketResponse(
            id=row["id"],
            tenant_id=row["tenant_id"],
            customer_id=row["customer_id"],
            customer_name=customer_name,
            device_imei=row["device_imei"],
            device_model=row["device_model"],
            device_password_pattern=row["device_password_pattern"],
            complaint=row["complaint"],
            status=row["status"],
            assigned_technician_id=row["assigned_technician_id"],
            estimated_cost=row["estimated_cost"],
            final_cost=row["final_cost"],
            parts=[],
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )

    except HTTPException:
        raise
    except (DBAPIError, IntegrityError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal membuat tiket servis: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 2: LIST TIKET SERVIS (DENGAN FILTER STATUS)
# ==============================================================================
@router.get("", response_model=List[RepairTicketResponse])
async def list_repair_tickets(
    status_filter: Optional[RepairStatus] = Query(None, alias="status", description="Filter status tiket"),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengambil seluruh daftar tiket servis milik tenant aktif.
    Mendukung penyaringan berdasarkan tahapan status (Intake, Diagnosis, Done, dll).
    """
    try:
        base_query = """
            SELECT 
                t.id, t.tenant_id, t.customer_id, c.display_name AS customer_name,
                t.device_imei, t.device_model, t.device_password_pattern,
                t.complaint, t.status, t.assigned_technician_id,
                t.estimated_cost, t.final_cost, t.created_at, t.updated_at
            FROM public.repair_tickets t
            LEFT JOIN public.contacts c ON c.id = t.customer_id AND c.tenant_id = :tenant_id
            WHERE t.tenant_id = :tenant_id
        """
        params = {"tenant_id": str(current_tenant_id)}

        if status_filter:
            base_query += " AND t.status = :status_val"
            params["status_val"] = status_filter.value

        base_query += " ORDER BY t.created_at DESC"

        result = await db.execute(text(base_query), params)
        rows = result.mappings().all()

        if not rows:
            return []

        # Ambil seluruh sparepart yang terkait tiket-tiket ini
        ticket_ids = [str(r["id"]) for r in rows]
        parts_query = text("""
            SELECT 
                p.id, p.repair_ticket_id, p.item_id, i.name AS item_name, i.sku AS item_sku,
                p.qty, p.hpp_at_use, p.created_at
            FROM public.repair_ticket_parts p
            JOIN public.items i ON i.id = p.item_id AND i.tenant_id = :tenant_id
            WHERE p.tenant_id = :tenant_id AND p.repair_ticket_id = ANY(:tids)
            ORDER BY p.created_at ASC
        """)
        parts_res = await db.execute(parts_query, {"tenant_id": str(current_tenant_id), "tids": ticket_ids})
        parts_rows = parts_res.mappings().all()

        parts_by_ticket: dict = {}
        for p in parts_rows:
            tid = p["repair_ticket_id"]
            if tid not in parts_by_ticket:
                parts_by_ticket[tid] = []
            parts_by_ticket[tid].append(
                RepairPartResponse(
                    id=p["id"],
                    repair_ticket_id=p["repair_ticket_id"],
                    item_id=p["item_id"],
                    item_name=p["item_name"],
                    item_sku=p["item_sku"],
                    qty=p["qty"],
                    hpp_at_use=p["hpp_at_use"],
                    created_at=p["created_at"]
                )
            )

        return [
            RepairTicketResponse(
                id=r["id"],
                tenant_id=r["tenant_id"],
                customer_id=r["customer_id"],
                customer_name=r["customer_name"],
                device_imei=r["device_imei"],
                device_model=r["device_model"],
                device_password_pattern=r["device_password_pattern"],
                complaint=r["complaint"],
                status=r["status"],
                assigned_technician_id=r["assigned_technician_id"],
                estimated_cost=r["estimated_cost"],
                final_cost=r["final_cost"],
                parts=parts_by_ticket.get(r["id"], []),
                created_at=r["created_at"],
                updated_at=r["updated_at"]
            )
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil daftar tiket servis: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 3: UPDATE STATUS TIKET SERVIS (DENGAN AUTO-ACCOUNTING)
# ==============================================================================
@router.patch("/{ticket_id}/status", response_model=RepairTicketResponse)
async def update_ticket_status(
    ticket_id: UUID,
    payload: RepairTicketUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Memperbarui status tahapan servis HP.
    
    🧠 ATURAN BISNIS:
    1. Jika status berubah menjadi 'Repairing' atau 'Done', nilai `final_cost` WAJIB terisi.
    2. Jika status berubah menjadi 'Done' atau 'Taken', sistem otomatis memicu
       Auto-Accounting Engine untuk menerbitkan Jurnal Umum Double-Entry ke General Ledger:
       - Debit: Kas Kasir (1000) sebesar final_cost
       - Kredit: Pendapatan Jasa Servis (4000) sebesar final_cost
       - Debit: HPP Servis (5000) sebesar total HPP sparepart
       - Kredit: Persediaan Sparepart (1200) sebesar total HPP sparepart
    """
    try:
        # 1. Cari tiket servis yang bersangkutan
        check_res = await db.execute(
            text("""
                SELECT t.id, t.status, t.final_cost, c.display_name AS customer_name
                FROM public.repair_tickets t
                LEFT JOIN public.contacts c ON c.id = t.customer_id AND c.tenant_id = :tenant_id
                WHERE t.id = :tid AND t.tenant_id = :tenant_id
            """),
            {"tid": str(ticket_id), "tenant_id": str(current_tenant_id)}
        )
        existing = check_res.mappings().first()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tiket servis dengan ID '{ticket_id}' tidak ditemukan."
            )

        # 2. Validasi Business Logic: 'Repairing' atau 'Done' mewajibkan final_cost
        target_final_cost = payload.final_cost if payload.final_cost is not None else existing["final_cost"]
        if payload.status in (RepairStatus.REPAIRING, RepairStatus.DONE):
            if target_final_cost is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Perubahan status menjadi '{payload.status.value}' mewajibkan pengisian "
                        f"'final_cost' (biaya akhir servis yang disepakati)."
                    )
                )

        # 3. Eksekusi pembaruan status dan final_cost pada tabel repair_tickets
        update_query = text("""
            UPDATE public.repair_tickets
            SET 
                status = :status,
                final_cost = COALESCE(:final_cost, final_cost),
                assigned_technician_id = COALESCE(:technician_id, assigned_technician_id),
                updated_at = timezone('utc'::text, now())
            WHERE id = :tid AND tenant_id = :tenant_id
            RETURNING id, tenant_id, customer_id, device_imei, device_model,
                      device_password_pattern, complaint, status,
                      assigned_technician_id, estimated_cost, final_cost,
                      created_at, updated_at
        """)

        res = await db.execute(
            update_query,
            {
                "tid": str(ticket_id),
                "tenant_id": str(current_tenant_id),
                "status": payload.status.value,
                "final_cost": payload.final_cost,
                "technician_id": str(payload.assigned_technician_id) if payload.assigned_technician_id else None
            }
        )
        updated_row = res.mappings().one()

        # 4. Ambil daftar sparepart tiket jika ada
        parts_res = await db.execute(
            text("""
                SELECT 
                    p.id, p.repair_ticket_id, p.item_id, i.name AS item_name, i.sku AS item_sku,
                    p.qty, p.hpp_at_use, p.created_at
                FROM public.repair_ticket_parts p
                JOIN public.items i ON i.id = p.item_id AND i.tenant_id = :tenant_id
                WHERE p.tenant_id = :tenant_id AND p.repair_ticket_id = :tid
                ORDER BY p.created_at ASC
            """),
            {"tenant_id": str(current_tenant_id), "tid": str(ticket_id)}
        )
        parts = [
            RepairPartResponse(
                id=p["id"],
                repair_ticket_id=p["repair_ticket_id"],
                item_id=p["item_id"],
                item_name=p["item_name"],
                item_sku=p["item_sku"],
                qty=p["qty"],
                hpp_at_use=p["hpp_at_use"],
                created_at=p["created_at"]
            )
            for p in parts_res.mappings().all()
        ]

        # 5. ===================================================================
        # AUTO-ACCOUNTING ENGINE (FASE 5)
        # ===================================================================
        # Jika status berubah menjadi 'Done' atau 'Taken' (servis selesai):
        if payload.status in (RepairStatus.DONE, RepairStatus.TAKEN):
            # Cek idempotensi: jangan buat jurnal ganda jika sudah ada
            existing_journal = await db.execute(
                text("""
                    SELECT id FROM public.journal_entries
                    WHERE tenant_id = :tenant_id 
                      AND reference_type = 'REPAIR' 
                      AND reference_id = :tid
                """),
                {"tenant_id": str(current_tenant_id), "tid": str(ticket_id)}
            )
            if not existing_journal.mappings().first():
                cost_to_journal = int(updated_row["final_cost"] or 0)
                if cost_to_journal > 0:
                    # Hitung total HPP dari seluruh sparepart yang dipasang
                    total_hpp = sum(p.hpp_at_use * p.qty for p in parts)

                    # Ambil atau auto-seed akun standar
                    coa_map = await get_or_create_default_accounts(current_tenant_id, db)
                    kas_acc = coa_map.get("1000")
                    pendapatan_acc = coa_map.get("4000")
                    hpp_acc = coa_map.get("5000")
                    persediaan_acc = coa_map.get("1200")

                    if kas_acc and pendapatan_acc:
                        auto_lines = [
                            # Baris 1: Debit Kas Kasir
                            {
                                "account_id": kas_acc["id"],
                                "debit": cost_to_journal,
                                "credit": 0
                            },
                            # Baris 2: Kredit Pendapatan Servis
                            {
                                "account_id": pendapatan_acc["id"],
                                "debit": 0,
                                "credit": cost_to_journal
                            }
                        ]

                        # Tambahkan jurnal pengakuan HPP sparepart jika ada pemakaian parts
                        if total_hpp > 0 and hpp_acc and persediaan_acc:
                            auto_lines.extend([
                                # Baris 3: Debit Beban Pokok Pendapatan (HPP) Servis
                                {
                                    "account_id": hpp_acc["id"],
                                    "debit": total_hpp,
                                    "credit": 0
                                },
                                # Baris 4: Kredit Persediaan Sparepart
                                {
                                    "account_id": persediaan_acc["id"],
                                    "debit": 0,
                                    "credit": total_hpp
                                }
                            ])

                        # Terbitkan ayat jurnal double-entry otomatis (append-only)
                        await create_auto_journal(
                            tenant_id=current_tenant_id,
                            transaction_date=date.today(),
                            description=f"Pendapatan Servis & HPP #{str(ticket_id)[:8]} ({updated_row['device_model']})",
                            reference_type="REPAIR",
                            reference_id=ticket_id,
                            lines=auto_lines,
                            db=db
                        )

        # Commit atomik seluruh transaksi
        await db.commit()

        return RepairTicketResponse(
            id=updated_row["id"],
            tenant_id=updated_row["tenant_id"],
            customer_id=updated_row["customer_id"],
            customer_name=existing["customer_name"],
            device_imei=updated_row["device_imei"],
            device_model=updated_row["device_model"],
            device_password_pattern=updated_row["device_password_pattern"],
            complaint=updated_row["complaint"],
            status=updated_row["status"],
            assigned_technician_id=updated_row["assigned_technician_id"],
            estimated_cost=updated_row["estimated_cost"],
            final_cost=updated_row["final_cost"],
            parts=parts,
            created_at=updated_row["created_at"],
            updated_at=updated_row["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui status tiket: {str(e)}"
        )


# ==============================================================================
# ENDPOINT 4: TAMBAH SPAREPART PADA TIKET SERVIS
# ==============================================================================
@router.post("/{ticket_id}/parts", response_model=RepairPartResponse, status_code=status.HTTP_201_CREATED)
async def add_part_to_ticket(
    ticket_id: UUID,
    payload: RepairPartAdd,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mencatat penggunaan sparepart fisik pada tiket servis tertentu.
    
    🧠 ATURAN ARSITEKTUR:
    1. Memverifikasi tiket dan item berada pada tenant yang sama.
    2. Men-snapshot nilai `hpp_at_use` (Harga Pokok Penjualan saat dipakai)
       untuk kalkulasi laba rugi kotor per tiket servis.
    """
    try:
        # 1. Pastikan tiket servis ada dan milik tenant aktif
        ticket_res = await db.execute(
            text("SELECT id FROM public.repair_tickets WHERE id = :tid AND tenant_id = :tenant_id"),
            {"tid": str(ticket_id), "tenant_id": str(current_tenant_id)}
        )
        if not ticket_res.mappings().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tiket servis dengan ID '{ticket_id}' tidak ditemukan."
            )

        # 2. Pastikan sparepart ada di katalog universal items tenant aktif
        item_res = await db.execute(
            text("SELECT id, name, sku, item_type FROM public.items WHERE id = :iid AND tenant_id = :tenant_id"),
            {"iid": str(payload.item_id), "tenant_id": str(current_tenant_id)}
        )
        item_row = item_res.mappings().first()
        if not item_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item sparepart dengan ID '{payload.item_id}' tidak ditemukan dalam katalog."
            )

        # 3. Masukkan ke tabel repair_ticket_parts
        part_id = uuid4()
        insert_part_query = text("""
            INSERT INTO public.repair_ticket_parts (
                id, tenant_id, repair_ticket_id, item_id, qty, hpp_at_use, created_at
            ) VALUES (
                :id, :tenant_id, :repair_ticket_id, :item_id, :qty, :hpp_at_use, timezone('utc'::text, now())
            )
            RETURNING id, repair_ticket_id, item_id, qty, hpp_at_use, created_at
        """)

        res = await db.execute(
            insert_part_query,
            {
                "id": str(part_id),
                "tenant_id": str(current_tenant_id),
                "repair_ticket_id": str(ticket_id),
                "item_id": str(payload.item_id),
                "qty": int(payload.qty),
                "hpp_at_use": int(payload.hpp_at_use)
            }
        )
        part_row = res.mappings().one()
        await db.commit()

        return RepairPartResponse(
            id=part_row["id"],
            repair_ticket_id=part_row["repair_ticket_id"],
            item_id=part_row["item_id"],
            item_name=item_row["name"],
            item_sku=item_row["sku"],
            qty=part_row["qty"],
            hpp_at_use=part_row["hpp_at_use"],
            created_at=part_row["created_at"]
        )

    except HTTPException:
        raise
    except (DBAPIError, IntegrityError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mencatat pemakaian sparepart: {str(e)}"
        )
