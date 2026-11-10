"""
NEXUS CORE OS - CSV & DATA IMPORT API (FASE ONBOARDING KLIEN)
File: apps/core-api/app/api/v1/data_import.py

Modul ini menangani migrasi/impor data massal (bulk import) untuk katalog produk
dan kontak dari sistem legacy seperti Accurate POS/Accounting, Salesforce CRM,
atau file spreadsheet Excel/CSV.

🧠 ATURAN ARSITEKTUR EMAS:
1. HARGA & UANG: Semua nominal harga dikonversi menjadi integer minor units (BIGINT).
   Contoh: "Rp 25.000" atau "25000" -> 25000 (tidak ada desimal/float).
2. TENANCY & RLS: Semua baris data yang diimpor wajib terikat pada `tenant_id`
   yang diekstrak dari header `X-Tenant-ID`. Sesi database diisolasi dengan RLS.
3. FAIL-TOLERANT: Baris yang valid tetap diimpor, baris yang gagal dikumpulkan
   dalam daftar detail error beserta nomor baris dan alasannya.
"""

import io
import re
import csv
import json
from uuid import UUID, uuid4
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, DBAPIError

from app.core.database import get_tenant_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/import", tags=["Data Import (Accurate / Salesforce)"])

# Batas maksimal ukuran file: 5 MB
MAX_FILE_SIZE = 5 * 1024 * 1024

# ==============================================================================
# PYDANTIC RESPONSE SCHEMAS
# ==============================================================================

class RowErrorDetail(BaseModel):
    row: int = Field(..., description="Nomor baris pada file CSV/Excel (1-indexed)")
    identifier: Optional[str] = Field(None, description="SKU atau Nama sebagai identifikasi baris")
    reason: str = Field(..., description="Penyebab kegagalan validasi")

class ImportResultResponse(BaseModel):
    success: bool
    message: str
    total_rows: int
    success_count: int
    error_count: int
    errors: List[RowErrorDetail] = []
    sample_imported: List[Dict[str, Any]] = []

# ==============================================================================
# UTILITY PARSING FUNCTIONS
# ==============================================================================

def clean_header(header: str) -> str:
    """Membersihkan dan menormalisasi string header (lowercase, tanpa spasi/simbol aneh)."""
    if not header:
        return ""
    # Hapus UTF-8 BOM jika ada
    header = header.replace("\ufeff", "").strip().lower()
    return re.sub(r"[\s\-_]+", " ", header)

def extract_field_value(row: Dict[str, str], synonyms: List[str]) -> str:
    """
    Mencocokkan nilai kolom dari baris CSV berdasarkan daftar sinonim header
    (kompatibilitas otomatis untuk export KetoKo, Accurate, mau pun CSV kustom).
    """
    # 1. Exact match prioritas tinggi
    for syn in synonyms:
        syn_clean = clean_header(syn)
        for k, v in row.items():
            if clean_header(k) == syn_clean and v.strip():
                return v.strip()
    # 2. Substring match jika exact tidak ditemukan
    for syn in synonyms:
        syn_clean = clean_header(syn)
        for k, v in row.items():
            k_clean = clean_header(k)
            if syn_clean in k_clean and v.strip():
                return v.strip()
    return ""

def parse_rupiah_to_int(val: Any) -> Optional[int]:
    """
    Mengonversi string harga format Indonesia / internasional ke integer minor units (BIGINT).
    Mendukung format export KetoKo / Accurate / POS:
    - "Rp 10.000" / "Rp. 10.000" -> 10000
    - "10.000,00" -> 10000
    - "10000" -> 10000
    - "10.000" -> 10000
    - "10,000.00" -> 10000
    - 10000 -> 10000
    """
    if val is None:
        return None
    
    if isinstance(val, (int, float)):
        int_val = int(round(val))
        return int_val if int_val >= 0 else None
    
    s = str(val).strip()
    if not s:
        return None
        
    # Cek nilai negatif
    if "-" in s:
        return None
    
    # Hapus simbol mata uang dan whitespace
    s = re.sub(r"(?i)^(rp\.?|idr|\$)\s*", "", s).strip()
    
    # Jika format Indonesia "25.000,00" -> buang desimal ",00"
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            # Format Indonesia: titik pemisah ribuan, koma desimal
            s = s[:s.rfind(",")]
            s = s.replace(".", "")
        else:
            # Format US: koma pemisah ribuan, titik desimal
            s = s[:s.rfind(".")]
            s = s.replace(",", "")
    elif "," in s:
        # Cek jika koma dipakai sebagai pemisah ribuan atau desimal
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) in (1, 2):
            # Desimal dua digit, contoh: "25000,00"
            s = parts[0].replace(".", "")
        else:
            s = s.replace(",", "")
    elif "." in s:
        # Cek jika titik adalah pemisah ribuan atau desimal
        parts = s.split(".")
        if len(parts) == 2 and len(parts[1]) in (1, 2):
            # Desimal US
            s = parts[0]
        else:
            # Titik ribuan Indonesia
            s = s.replace(".", "")

    # Ambil hanya digit angka
    digits_only = re.sub(r"\D", "", s)
    if not digits_only:
        return None
    
    try:
        res = int(digits_only)
        return res if res >= 0 else None
    except ValueError:
        return None

def parse_stock_to_int(val: Any) -> int:
    """Mengonversi nilai stok ke integer non-negatif (default 0)."""
    if val is None or str(val).strip() == "":
        return 0
    try:
        # Bersihkan format angka jika ada
        cleaned = re.sub(r"[^\d]", "", str(val))
        return int(cleaned) if cleaned else 0
    except Exception:
        return 0

def detect_delimiter(text_sample: str) -> str:
    """Mendeteksi apakah CSV menggunakan koma (,) atau titik-koma (;) khas Excel Indonesia."""
    semicolons = text_sample.count(";")
    commas = text_sample.count(",")
    tabs = text_sample.count("\t")
    
    if semicolons > commas and semicolons > tabs:
        return ";"
    if tabs > commas:
        return "\t"
    return ","

async def read_uploaded_file_rows(file: UploadFile) -> List[Dict[str, str]]:
    """
    Membaca dan mem-parsing baris file yang diunggah (.csv atau .xlsx).
    Mendukung encoding UTF-8, UTF-8-sig (Excel BOM), dan delimiter koma/titik-koma.
    """
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ukuran file melebihi batas maksimal {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )
    
    filename = (file.filename or "").lower()
    rows: List[Dict[str, str]] = []

    # 1. Parsing jika file Excel (.xlsx)
    if filename.endswith(".xlsx"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            iter_rows = list(sheet.iter_rows(values_only=True))
            if not iter_rows:
                return []
            
            headers = [clean_header(str(h or "")) for h in iter_rows[0]]
            for r in iter_rows[1:]:
                if not any(r):
                    continue
                row_dict = {}
                for idx, cell in enumerate(r):
                    if idx < len(headers) and headers[idx]:
                        row_dict[headers[idx]] = str(cell).strip() if cell is not None else ""
                rows.append(row_dict)
            return rows
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Library openpyxl belum terpasang untuk membaca .xlsx. Silakan gunakan format file .csv."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal memproses file Excel: {str(e)}"
            )

    # 2. Parsing jika file CSV (.csv atau text)
    # Coba decode dengan utf-8-sig (otomatis menangani BOM), fallback ke latin-1
    try:
        decoded_text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded_text = content.decode("latin-1")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gagal mendeteksi encoding file teks: {str(e)}"
            )

    sample = decoded_text[:2048]
    delimiter = detect_delimiter(sample)

    reader = csv.reader(io.StringIO(decoded_text), delimiter=delimiter)
    try:
        header_row = next(reader)
    except StopIteration:
        return []

    headers = [clean_header(h) for h in header_row]

    for r in reader:
        if not r or not any(field.strip() for field in r):
            continue
        row_dict = {}
        for idx, val in enumerate(r):
            if idx < len(headers) and headers[idx]:
                row_dict[headers[idx]] = val.strip()
        rows.append(row_dict)

    return rows

# ==============================================================================
# ENDPOINT 1: IMPORT ITEMS (PRODUK & JASA DARI ACCURATE / ERP)
# ==============================================================================

@router.post(
    "/items",
    response_model=ImportResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Import data produk & jasa dari file CSV/Excel Accurate"
)
async def import_items(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengimpor data katalog massal ke tabel `public.items` dan `public.stock_levels`.
    
    Mapping Kolom Otomatis:
    - SKU: 'sku', 'kode', 'kode barang', 'item code'
    - Nama: 'nama barang', 'nama produk', 'nama', 'name', 'deskripsi'
    - Harga Jual: 'harga jual', 'harga', 'base_price', 'price', 'unit price'
    - Stok Awal: 'stok', 'stock', 'qty', 'jumlah', 'quantity'
    - Tipe Item: 'tipe', 'type', 'item_type', 'jenis' ('stocked'/'service')
    - Kategori/Brand: otomatis disimpan di JSONB `attributes`
    """
    raw_rows = await read_uploaded_file_rows(file)
    if not raw_rows:
        return ImportResultResponse(
            success=False,
            message="File tidak memiliki data atau baris kosong.",
            total_rows=0,
            success_count=0,
            error_count=0,
            errors=[]
        )

    # Ambil SKU yang sudah terdaftar di tenant aktif untuk mencegah duplikasi
    existing_skus_res = await db.execute(
        text("SELECT sku FROM public.items WHERE tenant_id = :tenant_id"),
        {"tenant_id": str(current_tenant_id)}
    )
    existing_db_skus = {row[0].strip().upper() for row in existing_skus_res.fetchall()}

    valid_items_to_insert: List[Dict[str, Any]] = []
    errors: List[RowErrorDetail] = []
    seen_file_skus: set = set()

    # Sinonim kolom umum untuk export KetoKo / Accurate / ERP
    SKU_SYNONYMS = ["kode barang", "kode item", "kode produk", "sku", "kode", "item code", "kode_barang", "kode_item"]
    MP_SKU_SYNONYMS = ["marketplace sku", "sku marketplace", "sku tiktok", "tiktok sku", "tiktok_sku", "sku_tiktok", "sku shopee", "shopee sku", "sku olshop"]
    BARCODE_SYNONYMS = ["barcode", "kode barcode", "no barcode", "bar code", "kode_barcode"]
    NAME_SYNONYMS = ["nama barang", "nama item", "nama produk", "nama", "name", "deskripsi", "item name", "keterangan barang", "nama_barang"]
    PRICE_SYNONYMS = ["harga jual", "harga jual 1", "harga 1", "harga retail", "harga eceran", "base price", "price", "unit price", "harga_jual", "harga"]
    PRICE_RESELLER_SYNONYMS = ["harga reseller", "harga jual 2", "harga 2", "reseller", "harga grosir", "grosir", "harga_reseller"]
    PRICE_TECH_SYNONYMS = ["harga teknisi", "harga jual 3", "harga 3", "teknisi", "harga bengkel", "harga_teknisi"]
    COST_SYNONYMS = ["harga beli", "harga pokok", "hpp", "modal", "harga modal", "cost price", "harga_beli"]
    STOCK_SYNONYMS = ["stok", "stok akhir", "stock", "qty", "jumlah", "quantity", "saldo akhir", "total stok", "stok sekarang", "stok_akhir"]
    CAT_SYNONYMS = ["kategori", "category", "kelompok", "grup", "jenis barang", "kelompok barang", "group", "kategori barang"]
    BRAND_SYNONYMS = ["merek", "brand", "merk"]
    UNIT_SYNONYMS = ["satuan", "satuan dasar", "unit", "uom"]
    TYPE_SYNONYMS = ["tipe", "type", "jenis", "jenis item", "tipe item", "item type"]
    RACK_SYNONYMS = ["rak", "lokasi", "gudang", "shelf", "warehouse"]

    for row_idx, row in enumerate(raw_rows, start=2): # Baris 1 adalah header
        # 1. Ekstraksi SKU & Barcode & Marketplace SKU
        sku_val = extract_field_value(row, SKU_SYNONYMS)
        marketplace_sku_val = extract_field_value(row, MP_SKU_SYNONYMS) or None
        barcode_val = extract_field_value(row, BARCODE_SYNONYMS) or None

        # 2. Ekstraksi Nama
        name_val = extract_field_value(row, NAME_SYNONYMS)

        if not name_val:
            errors.append(RowErrorDetail(
                row=row_idx,
                identifier=sku_val or f"Baris {row_idx}",
                reason="Nama barang/produk wajib diisi."
            ))
            continue

        # Jika SKU kosong, generate SKU otomatis atau gunakan barcode
        if not sku_val:
            sku_val = barcode_val or f"ITEM-{uuid4().hex[:8].upper()}"

        sku_upper = sku_val.upper()

        # Cek duplikat dalam file yang sama
        if sku_upper in seen_file_skus:
            errors.append(RowErrorDetail(
                row=row_idx,
                identifier=sku_val,
                reason=f"SKU '{sku_val}' duplikat di dalam file ini."
            ))
            continue
        
        # Cek duplikat dengan database
        if sku_upper in existing_db_skus:
            errors.append(RowErrorDetail(
                row=row_idx,
                identifier=sku_val,
                reason=f"SKU '{sku_val}' sudah terdaftar di sistem."
            ))
            continue

        seen_file_skus.add(sku_upper)

        # 3. Ekstraksi Harga Jual Dasar & Multi-Tier (Wajib Integer Minor Units)
        raw_price = extract_field_value(row, PRICE_SYNONYMS)
        base_price = parse_rupiah_to_int(raw_price)
        if base_price is None:
            errors.append(RowErrorDetail(
                row=row_idx,
                identifier=sku_val,
                reason=f"Harga jual tidak valid atau bernilai negatif ('{raw_price}')."
            ))
            continue

        # Harga Reseller & Teknisi (opsional, fallback ke tier kalkulasi)
        raw_reseller = extract_field_value(row, PRICE_RESELLER_SYNONYMS)
        price_reseller = parse_rupiah_to_int(raw_reseller) if raw_reseller else int(base_price * 0.90)

        raw_tech = extract_field_value(row, PRICE_TECH_SYNONYMS)
        price_technician = parse_rupiah_to_int(raw_tech) if raw_tech else int(base_price * 0.85)

        # Harga Beli / HPP Modal
        raw_cost = extract_field_value(row, COST_SYNONYMS)
        cost_price = parse_rupiah_to_int(raw_cost) if raw_cost else None

        # 4. Ekstraksi Stok
        raw_stock = extract_field_value(row, STOCK_SYNONYMS)
        stock_qty = parse_stock_to_int(raw_stock)

        # 5. Ekstraksi Tipe Item
        raw_type = extract_field_value(row, TYPE_SYNONYMS).lower()
        if any(keyword in raw_type for keyword in ["jasa", "service", "layanan"]):
            item_type = "service"
        elif "digital" in raw_type:
            item_type = "digital"
        else:
            item_type = "stocked"

        # 6. Kumpulkan atribut tambahan ke JSONB
        category_val = extract_field_value(row, CAT_SYNONYMS) or ("Jasa Service" if item_type == "service" else "Sparepart")
        brand_val = extract_field_value(row, BRAND_SYNONYMS)
        unit_val = extract_field_value(row, UNIT_SYNONYMS) or "PCS"
        rack_val = extract_field_value(row, RACK_SYNONYMS)
        warranty_val = row.get("garansi") or row.get("warranty") or ""
        
        attributes = {
            "source": "ketoko_csv_import",
            "category": category_val,
            "stock": stock_qty
        }
        if marketplace_sku_val:
            attributes["marketplace_sku"] = marketplace_sku_val
            attributes["tiktok_sku"] = marketplace_sku_val
        if barcode_val:
            attributes["barcode"] = barcode_val
        if brand_val:
            attributes["brand"] = brand_val
        if unit_val:
            attributes["unit"] = unit_val
        if cost_price is not None:
            attributes["cost_price"] = cost_price
            attributes["hpp"] = cost_price
        if rack_val:
            attributes["rack"] = rack_val
        if warranty_val:
            attributes["warranty"] = warranty_val

        # Simpan kolom ekstra lainnya yang tidak termasuk standar
        for k, v in row.items():
            k_clean = clean_header(k)
            if k_clean not in ["sku", "kode barang", "nama barang", "harga jual", "stok", "kategori", "merek", "brand", "harga beli"]:
                if v and k not in attributes:
                    attributes[k] = v

        valid_items_to_insert.append({
            "id": str(uuid4()),
            "tenant_id": str(current_tenant_id),
            "sku": sku_val,
            "marketplace_sku": marketplace_sku_val,
            "name": name_val,
            "item_type": item_type,
            "base_price": base_price,
            "price_retail": base_price,
            "price_reseller": price_reseller,
            "price_technician": price_technician,
            "attributes": json.dumps(attributes),
            "stock_qty": stock_qty
        })

    # Bulk Insert ke tabel items & stock_levels
    sample_imported: List[Dict[str, Any]] = []
    
    if valid_items_to_insert:
        try:
            # Ambil lokasi aktif pertama untuk penempatan stok (multi-location support)
            default_location_id = None
            try:
                loc_res = await db.execute(
                    text("SELECT id FROM public.locations WHERE tenant_id = :tenant_id AND is_active = true ORDER BY created_at ASC LIMIT 1"),
                    {"tenant_id": str(current_tenant_id)}
                )
                first_loc = loc_res.fetchone()
                if first_loc:
                    default_location_id = first_loc[0]
            except Exception:
                pass

            for item in valid_items_to_insert:
                # 1. Insert item ke public.items
                try:
                    await db.execute(
                        text("""
                            INSERT INTO public.items (
                                id, tenant_id, sku, marketplace_sku, name, item_type,
                                base_price, price_retail, price_reseller, price_technician,
                                attributes, active
                            ) VALUES (
                                :id, :tenant_id, :sku, :marketplace_sku, :name, :item_type,
                                :base_price, :price_retail, :price_reseller, :price_technician,
                                :attributes::jsonb, true
                            )
                        """),
                        {
                            "id": item["id"],
                            "tenant_id": item["tenant_id"],
                            "sku": item["sku"],
                            "marketplace_sku": item["marketplace_sku"],
                            "name": item["name"],
                            "item_type": item["item_type"],
                            "base_price": item["base_price"],
                            "price_retail": item["price_retail"],
                            "price_reseller": item["price_reseller"],
                            "price_technician": item["price_technician"],
                            "attributes": item["attributes"]
                        }
                    )
                except Exception:
                    # Fallback jika kolom marketplace_sku / tiers belum ada di remote DB
                    await db.execute(
                        text("""
                            INSERT INTO public.items (
                                id, tenant_id, sku, name, item_type, base_price, attributes, active
                            ) VALUES (
                                :id, :tenant_id, :sku, :name, :item_type, :base_price, :attributes::jsonb, true
                            )
                        """),
                        {
                            "id": item["id"],
                            "tenant_id": item["tenant_id"],
                            "sku": item["sku"],
                            "name": item["name"],
                            "item_type": item["item_type"],
                            "base_price": item["base_price"],
                            "attributes": item["attributes"]
                        }
                    )

                # 2. Jika item fisik dan memiliki stok awal > 0, inisialisasi di stock_levels
                if item["item_type"] == "stocked" and item["stock_qty"] > 0:
                    try:
                        if default_location_id:
                            await db.execute(
                                text("""
                                    INSERT INTO public.stock_levels (
                                        id, tenant_id, item_id, location_id, on_hand, reserved
                                    ) VALUES (
                                        gen_random_uuid(), :tenant_id, :item_id, :location_id, :on_hand, 0
                                    )
                                    ON CONFLICT (tenant_id, item_id, location_id) 
                                    DO UPDATE SET on_hand = public.stock_levels.on_hand + EXCLUDED.on_hand
                                """),
                                {
                                    "tenant_id": item["tenant_id"],
                                    "item_id": item["id"],
                                    "location_id": default_location_id,
                                    "on_hand": item["stock_qty"]
                                }
                            )
                        else:
                            await db.execute(
                                text("""
                                    INSERT INTO public.stock_levels (
                                        id, tenant_id, item_id, on_hand, reserved
                                    ) VALUES (
                                        gen_random_uuid(), :tenant_id, :item_id, :on_hand, 0
                                    )
                                    ON CONFLICT (tenant_id, item_id) 
                                    DO UPDATE SET on_hand = public.stock_levels.on_hand + EXCLUDED.on_hand
                                """),
                                {
                                    "tenant_id": item["tenant_id"],
                                    "item_id": item["id"],
                                    "on_hand": item["stock_qty"]
                                }
                            )
                    except Exception:
                        await db.execute(
                            text("""
                                INSERT INTO public.stock_levels (
                                    id, tenant_id, item_id, on_hand, reserved
                                ) VALUES (
                                    gen_random_uuid(), :tenant_id, :item_id, :on_hand, 0
                                )
                            """),
                            {
                                "tenant_id": item["tenant_id"],
                                "item_id": item["id"],
                                "on_hand": item["stock_qty"]
                            }
                        )
                    
                    # 3. Catat riwayat di stock_movements (audit ledger untuk parallel run comparison)
                    try:
                        await db.execute(
                            text("""
                                INSERT INTO public.stock_movements (
                                    id, tenant_id, item_id, location_id, qty_delta, reason, ref_id
                                ) VALUES (
                                    gen_random_uuid(), :tenant_id, :item_id, :location_id, :qty_delta, 'KETOKO_PARALLEL_MIGRATION', 'KETOKO-CSV'
                                )
                            """),
                            {
                                "tenant_id": item["tenant_id"],
                                "item_id": item["id"],
                                "location_id": default_location_id,
                                "qty_delta": item["stock_qty"]
                            }
                        )
                    except Exception:
                        await db.execute(
                            text("""
                                INSERT INTO public.stock_movements (
                                    id, tenant_id, item_id, qty_delta, reason, ref_id
                                ) VALUES (
                                    gen_random_uuid(), :tenant_id, :item_id, :qty_delta, 'KETOKO_PARALLEL_MIGRATION', 'KETOKO-CSV'
                                )
                            """),
                            {
                                "tenant_id": item["tenant_id"],
                                "item_id": item["id"],
                                "qty_delta": item["stock_qty"]
                            }
                        )

            await db.commit()

            sample_imported = [
                {
                    "sku": it["sku"],
                    "marketplace_sku": it["marketplace_sku"],
                    "name": it["name"],
                    "base_price": it["base_price"],
                    "price_retail": it["price_retail"],
                    "price_reseller": it["price_reseller"],
                    "price_technician": it["price_technician"],
                    "item_type": it["item_type"],
                    "stock": it["stock_qty"]
                }
                for it in valid_items_to_insert[:5]
            ]
        except (IntegrityError, DBAPIError) as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Terjadi kesalahan saat menyimpan data massal: {str(e)}"
            )

    return ImportResultResponse(
        success=len(valid_items_to_insert) > 0,
        message=f"Berhasil mengimpor {len(valid_items_to_insert)} produk. {len(errors)} baris dilewati/gagal.",
        total_rows=len(raw_rows),
        success_count=len(valid_items_to_insert),
        error_count=len(errors),
        errors=errors,
        sample_imported=sample_imported
    )

# ==============================================================================
# ENDPOINT 2: IMPORT CONTACTS (KONTAK & CRM DARI SALESFORCE / ACCURATE)
# ==============================================================================

@router.post(
    "/contacts",
    response_model=ImportResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Import data kontak CRM dari file CSV/Excel Salesforce"
)
async def import_contacts(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Mengimpor data kontak CRM ke tabel `public.contacts`.
    
    Mapping Kolom Otomatis:
    - Nama: 'nama', 'name', 'display_name', 'nama kontak', 'customer'
    - No HP: 'no hp', 'no. hp', 'phone', 'telepon', 'whatsapp', 'nomor hp'
    - Email: 'email', 'e-mail', 'surel'
    - Perusahaan: 'perusahaan', 'company', 'company_name', 'instansi'
    - Tipe/Jenis: 'tipe', 'kind' ('person'/'org', default 'person')
    """
    raw_rows = await read_uploaded_file_rows(file)
    if not raw_rows:
        return ImportResultResponse(
            success=False,
            message="File tidak memiliki data atau baris kosong.",
            total_rows=0,
            success_count=0,
            error_count=0,
            errors=[]
        )

    valid_contacts: List[Dict[str, Any]] = []
    errors: List[RowErrorDetail] = []

    for row_idx, row in enumerate(raw_rows, start=2):
        name_val = (
            row.get("nama") or 
            row.get("name") or 
            row.get("display name") or 
            row.get("nama kontak") or 
            row.get("customer") or 
            row.get("pelanggan") or 
            ""
        ).strip()

        if not name_val:
            errors.append(RowErrorDetail(
                row=row_idx,
                identifier=f"Baris {row_idx}",
                reason="Nama kontak/pelanggan tidak boleh kosong."
            ))
            continue

        phone_val = (
            row.get("no hp") or 
            row.get("no. hp") or 
            row.get("phone") or 
            row.get("telepon") or 
            row.get("whatsapp") or 
            row.get("nomor hp") or 
            ""
        ).strip()

        email_val = (
            row.get("email") or 
            row.get("e mail") or 
            row.get("surel") or 
            ""
        ).strip()

        company_val = (
            row.get("perusahaan") or 
            row.get("company") or 
            row.get("company name") or 
            row.get("instansi") or 
            ""
        ).strip()

        raw_kind = (
            row.get("tipe") or 
            row.get("kind") or 
            row.get("jenis") or 
            ""
        ).strip().lower()

        kind = "org" if ("perusahaan" in raw_kind or "org" in raw_kind or "pt" in raw_kind or company_val and not phone_val) else "person"

        attributes = {
            "source": "salesforce_csv_import"
        }
        if phone_val:
            attributes["phone"] = phone_val
        if email_val:
            attributes["email"] = email_val
        if company_val:
            attributes["company_name"] = company_val

        # Ekstraksi atribut lainnya
        for k, v in row.items():
            if k not in ["nama", "name", "no hp", "phone", "email", "perusahaan", "company", "tipe", "kind"]:
                if v:
                    attributes[k] = v

        valid_contacts.append({
            "id": str(uuid4()),
            "tenant_id": str(current_tenant_id),
            "display_name": name_val,
            "kind": kind,
            "attributes": json.dumps(attributes)
        })

    sample_imported: List[Dict[str, Any]] = []

    if valid_contacts:
        try:
            for c in valid_contacts:
                await db.execute(
                    text("""
                        INSERT INTO public.contacts (
                            id, tenant_id, display_name, kind, attributes
                        ) VALUES (
                            :id, :tenant_id, :display_name, :kind, :attributes::jsonb
                        )
                    """),
                    {
                        "id": c["id"],
                        "tenant_id": c["tenant_id"],
                        "display_name": c["display_name"],
                        "kind": c["kind"],
                        "attributes": c["attributes"]
                    }
                )
            await db.commit()

            sample_imported = [
                {
                    "display_name": c["display_name"],
                    "kind": c["kind"],
                    "attributes": json.loads(c["attributes"])
                }
                for c in valid_contacts[:5]
            ]
        except (IntegrityError, DBAPIError) as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Terjadi kesalahan saat menyimpan data kontak: {str(e)}"
            )

    return ImportResultResponse(
        success=len(valid_contacts) > 0,
        message=f"Berhasil mengimpor {len(valid_contacts)} kontak. {len(errors)} baris dilewati/gagal.",
        total_rows=len(raw_rows),
        success_count=len(valid_contacts),
        error_count=len(errors),
        errors=errors,
        sample_imported=sample_imported
    )

# ==============================================================================
# ENDPOINT 3: DOWNLOAD TEMPLATE CSV
# ==============================================================================

@router.get("/template/items", summary="Download contoh template CSV produk Accurate")
async def download_items_template():
    """Mengunduh file template CSV siap pakai untuk import produk."""
    csv_content = (
        "SKU,Nama Barang,Harga Jual,Stok,Tipe,Kategori,Brand\n"
        "LCD-IPH-11,LCD iPhone 11 Original OEM,650000,15,stocked,Sparepart,Apple\n"
        "BAT-SAM-S21,Baterai Samsung Galaxy S21,320000,10,stocked,Sparepart,Samsung\n"
        "CAS-MAG-CLR,Casing MagSafe Clear Armor,75000,50,stocked,Aksesoris,Universal\n"
        "SRV-PASANG-LCD,Jasa Pasang LCD & Kalibrasi,100000,0,service,Jasa Service,Internal\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="template_produk_accurate.csv"'
        }
    )

@router.get("/template/ketoko", summary="Download contoh template CSV kompatibel KetoKo (po.ketoko.co.id)")
async def download_ketoko_template():
    """
    Mengunduh format template CSV ideal yang 100% kompatibel dengan export KetoKo
    dan langsung siap sinkronisasi dengan TikTok Shop.
    """
    csv_content = (
        "Kode Barang,Nama Barang,Harga Jual,Stok,Kategori,Merek,Harga Beli,Marketplace SKU,Barcode\n"
        "LCD-IPH-11,LCD iPhone 11 Original OEM,650000,15,Sparepart,Apple,480000,TTS-IP11-SCREEN-01,899123456701\n"
        "BAT-SAM-S21,Baterai Samsung Galaxy S21,320000,10,Sparepart,Samsung,210000,TTS-S21-BATT-01,899123456702\n"
        "CAS-MAG-CLR,Casing MagSafe Clear Armor,75000,50,Aksesoris,Universal,35000,TTS-CASE-MAG-01,899123456703\n"
        "CAB-TC-100W,Kabel Data Type-C 100W Braided,55000,40,Aksesoris,Universal,25000,TTS-CAB-TC100-01,899123456704\n"
        "SRV-PASANG-LCD,Jasa Pasang LCD & Kalibrasi,100000,0,Jasa Service,Internal,0,,\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="template_export_ketoko.csv"'
        }
    )

@router.get("/template/contacts", summary="Download contoh template CSV kontak Salesforce")
async def download_contacts_template():
    """Mengunduh file template CSV siap pakai untuk import kontak."""
    csv_content = (
        "Nama,No HP,Email,Perusahaan,Tipe\n"
        "Budi Santoso,081234567890,budi.santoso@gmail.com,PT Maju Bersama,person\n"
        "Siti Rahma,085678901234,siti.rahma@techindo.co.id,TechIndo Solusi,person\n"
        "CV Surya Sparepart,082198765432,sales@suryasparepart.com,CV Surya Sparepart,org\n"
        "dr. Andi Wijaya,081122334455,andi.wijaya@medikaclinic.id,Medika Clinic,person\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="template_kontak_salesforce.csv"'
        }
    )
