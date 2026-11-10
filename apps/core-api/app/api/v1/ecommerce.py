"""
NEXUS CORE OS - E-COMMERCE MIGRATION & INSTANT STOREFRONT ROUTER
File: apps/core-api/app/api/v1/ecommerce.py

Menangani:
1. E-Commerce Catalog Cloner & Cross-Listing (Shopee/Tokopedia -> TikTok Shop)
   - AI SEO Title Rewriting (aturan panjang & algoritma TikTok Shop)
   - Category & Attribute Mapping otomatis
   - Marketplace Fee & Price Markup Calculator
2. Instant Web Storefront Builder
   - Katalog Publik Online (/store/[slug]) untuk toko offline
   - Alur pemesanan langsung via WhatsApp (Direct WA Checkout)
   - Ekspor katalog massal ke template resmi marketplace
"""

import math
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_tenant_db, get_raw_db
from app.core.security import get_current_tenant_id

router = APIRouter(prefix="/ecommerce", tags=["E-Commerce Migration & Storefront"])

# ==============================================================================
# 1. DICTIONARY MAPPING KATEGORI RESMI MARKETPLACE (TIKTOK SHOP ID)
# ==============================================================================
TIKTOK_CATEGORY_MAP = [
    {
        "keywords": ["oli", "oli mesin", "kampas", "ban motor", "velg", "busi", "filter oli", "karburator", "motor", "bengkel", "otomotif"],
        "category_id": "702110",
        "category_name": "Suku Cadang Motor & Aksesoris Otomotif",
        "attributes": {"Brand": "OEM Quality", "Vehicle": "Universal Motorcycle"}
    },
    {
        "keywords": ["case", "casing", "softcase", "hardcase", "tempered glass", "anti gores", "hydrogel", "pelindung hp"],
        "category_id": "601244",
        "category_name": "Casing & Pelindung Layar Handphone",
        "attributes": {"Brand": "No Brand", "Type": "Back Cover", "Features": "Shockproof"}
    },
    {
        "keywords": ["charger", "kabel", "cable", "adaptor", "powerbank", "fast charging", "type c", "lightning"],
        "category_id": "601245",
        "category_name": "Pengisi Daya, Kabel & Powerbank",
        "attributes": {"Brand": "Universal", "Output": "Fast Charge", "Ports": "USB-C"}
    },
    {
        "keywords": ["headset", "earphone", "tws", "bluetooth", "speaker", "audio"],
        "category_id": "601246",
        "category_name": "Audio & Headphone Nirkabel",
        "attributes": {"Brand": "No Brand", "Connectivity": "Bluetooth 5.3", "Microphone": "Yes"}
    },
    {
        "keywords": ["ac", "freon", "pipa ac", "bracket", "hvac", "remote ac", "kapasitor", "compressor"],
        "category_id": "801450",
        "category_name": "Pendingin Ruangan & Komponen HVAC",
        "attributes": {"Brand": "Universal", "Type": "AC Parts & Supplies"}
    },
    {
        "keywords": ["kaos", "baju", "kemeja", "celana", "jaket", "hoodie", "dress", "gamis", "fashion"],
        "category_id": "501120",
        "category_name": "Pakaian & Busana Pria/Wanita",
        "attributes": {"Brand": "No Brand", "Material": "Cotton Combed 30s"}
    },
    {
        "keywords": ["lcd", "layar", "touchscreen", "display", "baterai", "battery", "ic", "flexible", "konektor", "sparepart"],
        "category_id": "601243",
        "category_name": "Suku Cadang & Sparepart Gadget",
        "attributes": {"Brand": "No Brand", "Material": "Original OEM", "Condition": "New"}
    }
]

DEFAULT_TIKTOK_CATEGORY = {
    "category_id": "600100",
    "category_name": "Produk Retail Konsumen Umum",
    "attributes": {"Brand": "No Brand", "Warranty": "Garansi Toko"}
}

def resolve_tiktok_category(title: str, category_hint: Optional[str] = None) -> Dict[str, Any]:
    """Mencocokkan nama produk dan kategori sumber ke Category ID resmi TikTok Shop."""
    text_to_check = f"{title} {category_hint or ''}".lower()
    for cat in TIKTOK_CATEGORY_MAP:
        for kw in cat["keywords"]:
            if kw in text_to_check:
                return cat
    return DEFAULT_TIKTOK_CATEGORY

def rewrite_title_for_tiktok_seo(original_title: str, category_name: str) -> str:
    """
    Menulis ulang judul produk agar mematuhi aturan algoritma TikTok Shop:
    - Menghilangkan kata terlarang (TERMURAH, 100% ORIGINAL DI DUNIA, SPAM ALL-CAPS)
    - Rumus formula: [Brand/Grade] + [Nama Produk Utama] + [Tipe/Spesifikasi] + [USP/Benefit]
    - Batas karakter aman: maks 120 karakter (di bawah batas absolut TikTok 255)
    """
    cleaned = original_title.strip()
    
    # Bersihkan spam kata terlarang/clickbait
    banned_words = [
        "termurah", "terlaris", "nomor 1", "no 1", "terbaik di dunia", 
        "cuci gudang", "obral gila", "100% original", "ori pabrik copotan",
        "copotan", "bisa cod", "gratis ongkir", "promo terbatas", "diskon 99%", "diskon"
    ]
    for b in banned_words:
        cleaned = re.sub(re.escape(b), "", cleaned, flags=re.IGNORECASE)

    # Bersihkan simbol berlebihan
    cleaned = re.sub(r'[*!#~=+_]{2,}', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Normalisasi Title Case jika user memasukkan ALL CAPS
    if cleaned.isupper() or len([c for c in cleaned if c.isupper()]) / max(len(cleaned), 1) > 0.6:
        cleaned = cleaned.title()

    # Tambahkan benefit tag jika belum ada
    if not any(tag in cleaned.lower() for tag in ["garansi", "presisi", "premium", "oem", "high quality"]):
        cleaned = f"[High Quality] {cleaned} - Garansi Toko & Fast Response"

    # Truncate aman jika melebihi batas
    if len(cleaned) > 130:
        cleaned = cleaned[:127] + "..."

    return cleaned

def generate_tiktok_bullets(title: str, category_name: str, price: int) -> List[str]:
    """Menghasilkan poin-poin fitur keunggulan produk untuk deskripsi TikTok Shop."""
    return [
        f"Kualitas Teruji: Dibuat khusus untuk kategori {category_name} dengan material presisi.",
        "Siap Pakai: Telah melalui proses QC (Quality Control) ketat sebelum pengemasan.",
        f"Jaminan Pembelian: Dilengkapi garansi fungsi dan retur tukar baru jika ada kendala.",
        "Pengemasan Aman: Menggunakan ekstra bubble wrap tebal dan kardus pelindung bebas biaya."
    ]

def calculate_marketplace_markup(
    source_price: int,
    source_fee_pct: float = 8.0,
    target_fee_pct: float = 10.0,
    margin_buffer_pct: float = 5.0
) -> Dict[str, Any]:
    """
    Menghitung kenaikan harga saat migrasi antar-marketplace agar laba bersih tidak tergerus potongan admin.
    Formula:
    P_target = (P_source * (1 + margin_buffer/100)) / (1 - target_fee/100)
    Dibulatkan ke atas ke kelipatan 1.000 terdekat.
    """
    if source_price <= 0:
        return {"target_price": 0, "markup_nominal": 0, "markup_pct": 0}

    # Net proceeds yang diharapkan penjual dari harga asal
    base_net = source_price * (1 - (source_fee_pct / 100))
    # Target net dengan buffer tambahan
    target_net = base_net * (1 + (margin_buffer_pct / 100))
    # Harga jual di marketplace target agar setelah dipotong target_fee tetap menghasilkan target_net
    raw_target_price = target_net / (1 - (target_fee_pct / 100))
    # Pembulatan ke atas ke kelipatan Rp 1.000
    target_price = int(math.ceil(raw_target_price / 1000.0) * 1000)

    markup_nominal = target_price - source_price
    markup_pct = round((markup_nominal / source_price) * 100, 1)

    return {
        "target_price": target_price,
        "markup_nominal": markup_nominal,
        "markup_pct": markup_pct
    }

# ==============================================================================
# 2. PYDANTIC SCHEMAS
# ==============================================================================

class ClonedProductInput(BaseModel):
    name: str = Field(..., description="Nama produk asli di marketplace sumber")
    source_price: int = Field(..., gt=0, description="Harga jual asal dalam Rupiah")
    category: Optional[str] = Field(None, description="Nama kategori asal")
    sku: Optional[str] = Field(None, description="Kode SKU")
    stock: Optional[int] = Field(10, description="Jumlah stok fisik")
    description: Optional[str] = Field(None, description="Deskripsi produk asal")
    image_url: Optional[str] = Field(None, description="URL gambar produk")
    weight_grams: Optional[int] = Field(200, description="Estimasi berat barang dalam gram")

class ClonedProductOutput(BaseModel):
    original_name: str
    seo_title: str
    original_price: int
    target_price: int
    markup_nominal: int
    markup_pct: float
    category_name: str
    tiktok_category_id: str
    tiktok_category_name: str
    attributes: Dict[str, str]
    bullets: List[str]
    sku: str
    stock: int
    weight_grams: int
    status: str = "ready_to_upload"

class CloneAnalyzeRequest(BaseModel):
    source_platform: str = Field("shopee", description="Platform asal (shopee, tokopedia, excel)")
    target_platform: str = Field("tiktok_shop", description="Platform tujuan")
    source_fee_pct: float = Field(8.0, ge=0.0, le=50.0, description="Potongan admin marketplace asal %")
    target_fee_pct: float = Field(10.0, ge=0.0, le=50.0, description="Potongan admin marketplace target %")
    margin_buffer_pct: float = Field(5.0, ge=0.0, le=50.0, description="Ekstra margin keuntungan %")
    products: List[ClonedProductInput] = Field(..., min_length=1)

class CloneAnalyzeResponse(BaseModel):
    total_products: int
    source_platform: str
    target_platform: str
    avg_markup_pct: float
    total_original_value: int
    total_target_value: int
    products: List[ClonedProductOutput]

class StorefrontSettings(BaseModel):
    store_name: str
    slug: str
    whatsapp_number: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    banner_url: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True

class StorefrontItem(BaseModel):
    id: UUID
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    price: int
    base_price: Optional[int] = None
    stock_available: int
    image_url: Optional[str] = None
    description: Optional[str] = None

class PublicStorefrontResponse(BaseModel):
    store_name: str
    slug: str
    whatsapp_number: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    banner_url: Optional[str] = None
    total_items: int
    items: List[StorefrontItem]

# ==============================================================================
# ENDPOINT 1: ANALISA & TRANSFORMASI KLONING E-COMMERCE
# ==============================================================================
@router.post("/clone/analyze", response_model=CloneAnalyzeResponse)
def analyze_and_clone_products(payload: CloneAnalyzeRequest):
    """
    Mentransformasi seluruh katalog produk dari marketplace asal ke format marketplace target:
    1. AI SEO Title Rewrite (Menyesuaikan batas karakter & algoritma pencarian TikTok)
    2. Auto Category ID & Attribute Resolver
    3. Kalkulasi Markup Harga Otomatis (Mengompensasi biaya admin platform)
    4. Auto-generate Bullet Points fitur keunggulan
    """
    transformed: List[ClonedProductOutput] = []
    total_orig_val = 0
    total_targ_val = 0
    total_markup_pct = 0.0

    for idx, p in enumerate(payload.products, start=1):
        # 1. Resolve Category
        cat_info = resolve_tiktok_category(p.name, p.category)
        
        # 2. Rewrite Title
        seo_title = rewrite_title_for_tiktok_seo(p.name, cat_info["category_name"])
        
        # 3. Markup Price
        pricing = calculate_marketplace_markup(
            source_price=p.source_price,
            source_fee_pct=payload.source_fee_pct,
            target_fee_pct=payload.target_fee_pct,
            margin_buffer_pct=payload.margin_buffer_pct
        )

        # 4. Bullets
        bullets = generate_tiktok_bullets(seo_title, cat_info["category_name"], pricing["target_price"])

        sku_val = p.sku or f"SKU-{cat_info['category_id'][:3]}-{idx:04d}"

        item_out = ClonedProductOutput(
            original_name=p.name,
            seo_title=seo_title,
            original_price=p.source_price,
            target_price=pricing["target_price"],
            markup_nominal=pricing["markup_nominal"],
            markup_pct=pricing["markup_pct"],
            category_name=p.category or cat_info["category_name"],
            tiktok_category_id=cat_info["category_id"],
            tiktok_category_name=cat_info["category_name"],
            attributes=cat_info["attributes"],
            bullets=bullets,
            sku=sku_val,
            stock=p.stock or 10,
            weight_grams=p.weight_grams or 200,
            status="ready_to_upload"
        )
        transformed.append(item_out)

        total_orig_val += p.source_price
        total_targ_val += pricing["target_price"]
        total_markup_pct += pricing["markup_pct"]

    avg_markup = round(total_markup_pct / len(payload.products), 1) if payload.products else 0.0

    return CloneAnalyzeResponse(
        total_products=len(transformed),
        source_platform=payload.source_platform,
        target_platform=payload.target_platform,
        avg_markup_pct=avg_markup,
        total_original_value=total_orig_val,
        total_target_value=total_targ_val,
        products=transformed
    )

# ==============================================================================
# ENDPOINT 2: EKSPOR BATCH UPLOAD TEMPLATE TIKTOK SHOP (CSV/TXT)
# ==============================================================================
@router.post("/clone/export-tiktok")
def export_tiktok_batch_file(payload: List[ClonedProductOutput]):
    """
    Menghasilkan file CSV/TSV multi-kolom yang kompatibel dengan menu
    'Batch Product Upload' resmi TikTok Shop Seller Center.
    """
    output_lines = [
        "Product Name,Category ID,Category Name,SKU,Retail Price (IDR),Stock,Weight (g),Package Length (cm),Package Width (cm),Package Height (cm),Key Features,Warranty"
    ]

    for p in payload:
        name_esc = f'"{p.seo_title.replace("\"", "\"\"")}"'
        cat_name_esc = f'"{p.tiktok_category_name.replace("\"", "\"\"")}"'
        features_esc = f'"{"; ".join(p.bullets).replace("\"", "\"\"")}"'
        line = f"{name_esc},{p.tiktok_category_id},{cat_name_esc},{p.sku},{p.target_price},{p.stock},{p.weight_grams},15,10,5,{features_esc},Garansi Toko"
        output_lines.append(line)

    csv_content = "\n".join(output_lines)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=tiktok_shop_batch_upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )

# ==============================================================================
# ENDPOINT 3: KATALOG PUBLIK ETALASE WEB TENANT (PUBLIC STOREFRONT)
# ==============================================================================
@router.get("/storefront/public/{slug}", response_model=PublicStorefrontResponse)
async def get_public_storefront(slug: str, db: AsyncSession = Depends(get_raw_db)):
    """
    Endpoint publik untuk pembeli umum mengakses katalog online toko tenant.
    Mengambil data etalase dan seluruh inventaris produk aktif milik toko.
    """
    # 1. Cari pengaturan toko berdasarkan slug
    clean_slug = slug.strip().lower()
    store_query = text("""
        SELECT 
            t.id AS tenant_id,
            COALESCE(s.store_name, t.name) AS store_name,
            COALESCE(s.slug, t.slug) AS slug,
            COALESCE(s.whatsapp_number, '6281234567890') AS whatsapp_number,
            COALESCE(s.tagline, 'Toko Resmi & Terpercaya') AS tagline,
            COALESCE(s.description, 'Melayani penjualan langsung dan pemesanan online via WhatsApp.') AS description,
            COALESCE(s.address, 'Indonesia') AS address,
            s.banner_url,
            s.logo_url
        FROM public.tenants t
        LEFT JOIN public.tenant_storefront_settings s ON s.tenant_id = t.id
        WHERE (t.slug = :slug OR s.slug = :slug) AND t.is_active = true
        LIMIT 1
    """)
    res = await db.execute(store_query, {"slug": clean_slug})
    store_row = res.mappings().one_or_none()

    if not store_row:
        # Fallback toko demo jika slug belum terdaftar di database
        return PublicStorefrontResponse(
            store_name=f"Toko {slug.replace('-', ' ').title()}",
            slug=clean_slug,
            whatsapp_number="6281234567890",
            tagline="Etalase Toko Instan Powered by Nexus OS",
            description="Toko resmi bergaransi. Pemesanan mudah dan cepat langsung terhubung ke kasir WhatsApp.",
            address="Pusat Niaga Gadget & Retail, Jakarta",
            banner_url=None,
            total_items=4,
            items=[
                StorefrontItem(
                    id=uuid4(),
                    name="LCD iPhone 11 Pro Max OEM",
                    sku="SP-LCD-11PM",
                    category="Sparepart",
                    price=450000,
                    base_price=300000,
                    stock_available=12,
                    image_url=None,
                    description="Layar jernih kontras tinggi, touchscreen presisi responsif."
                ),
                StorefrontItem(
                    id=uuid4(),
                    name="Tempered Glass Anti-Spy Privacy 9D",
                    sku="ACC-TG-PRIV",
                    category="Aksesoris",
                    price=35000,
                    base_price=12000,
                    stock_available=45,
                    image_url=None,
                    description="Privasi aman dari intipan samping, kaca tebal 9H anti-gores."
                ),
                StorefrontItem(
                    id=uuid4(),
                    name="Fast Charger 20W USB-C Power Adapter",
                    sku="ACC-CHG-20W",
                    category="Aksesoris",
                    price=120000,
                    base_price=65000,
                    stock_available=20,
                    image_url=None,
                    description="Pengisian daya cepat anti-panas dengan smart chip perlindungan sirkuit."
                ),
                StorefrontItem(
                    id=uuid4(),
                    name="Jasa Servis & Ganti Baterai Health 100%",
                    sku="SRV-BAT-GEN",
                    category="Jasa Servis",
                    price=250000,
                    base_price=140000,
                    stock_available=99,
                    image_url=None,
                    description="Pemasangan profesional 30 menit selesai di tempat."
                )
            ]
        )

    tenant_id_str = str(store_row["tenant_id"])

    # 2. Ambil katalog produk aktif untuk tenant ini
    items_query = text("""
        SELECT 
            i.id,
            i.name,
            i.sku,
            COALESCE(i.category, 'Umum') AS category,
            COALESCE(i.base_price, 50000) AS base_price,
            COALESCE(i.retail_price, i.base_price, 50000) AS price,
            COALESCE(sl.available_stock, 10) AS stock_available,
            i.description
        FROM public.items i
        LEFT JOIN (
            SELECT item_id, SUM(available_stock) AS available_stock
            FROM public.stock_levels
            WHERE tenant_id = :tenant_id
            GROUP BY item_id
        ) sl ON sl.item_id = i.id
        WHERE i.tenant_id = :tenant_id AND i.is_active = true
        ORDER BY i.name ASC
        LIMIT 100
    """)
    items_res = await db.execute(items_query, {"tenant_id": tenant_id_str})
    item_rows = items_res.mappings().all()

    items = [
        StorefrontItem(
            id=r["id"],
            name=r["name"],
            sku=r["sku"],
            category=r["category"],
            price=int(r["price"]),
            base_price=int(r["base_price"]) if r["base_price"] else None,
            stock_available=int(r["stock_available"]),
            image_url=None,
            description=r["description"]
        )
        for r in item_rows
    ]

    return PublicStorefrontResponse(
        store_name=store_row["store_name"],
        slug=store_row["slug"],
        whatsapp_number=store_row["whatsapp_number"],
        tagline=store_row["tagline"],
        description=store_row["description"],
        address=store_row["address"],
        banner_url=store_row["banner_url"],
        total_items=len(items),
        items=items
    )

# ==============================================================================
# ENDPOINT 4: PENGATURAN ETALASE TOKO (TENANT AUTHENTICATED)
# ==============================================================================
@router.get("/storefront/settings", response_model=StorefrontSettings)
async def get_storefront_settings(
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Mengambil pengaturan etalase toko online milik tenant aktif."""
    tenant_id_str = str(current_tenant_id)
    query = text("""
        SELECT 
            COALESCE(s.store_name, t.name) AS store_name,
            COALESCE(s.slug, t.slug) AS slug,
            COALESCE(s.whatsapp_number, '6281234567890') AS whatsapp_number,
            s.tagline,
            s.description,
            s.address,
            s.banner_url,
            s.logo_url,
            COALESCE(s.is_active, true) AS is_active
        FROM public.tenants t
        LEFT JOIN public.tenant_storefront_settings s ON s.tenant_id = t.id
        WHERE t.id = :tenant_id
    """)
    res = await db.execute(query, {"tenant_id": tenant_id_str})
    row = res.mappings().one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Tenant tidak ditemukan.")

    return StorefrontSettings(
        store_name=row["store_name"],
        slug=row["slug"],
        whatsapp_number=row["whatsapp_number"],
        tagline=row["tagline"] or "Toko Resmi Terpercaya",
        description=row["description"] or "Katalog Resmi Pemesanan Online",
        address=row["address"] or "Indonesia",
        banner_url=row["banner_url"],
        logo_url=row["logo_url"],
        is_active=row["is_active"]
    )

@router.put("/storefront/settings", response_model=StorefrontSettings)
async def update_storefront_settings(
    payload: StorefrontSettings,
    db: AsyncSession = Depends(get_tenant_db),
    current_tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Menyimpan atau memperbarui konfigurasi etalase toko online tenant."""
    tenant_id_str = str(current_tenant_id)
    clean_slug = re.sub(r'[^a-z0-9\-]', '', payload.slug.lower().strip().replace(' ', '-'))

    upsert_query = text("""
        INSERT INTO public.tenant_storefront_settings (
            tenant_id, store_name, slug, whatsapp_number, tagline, description, address, banner_url, logo_url, is_active, updated_at
        ) VALUES (
            :tenant_id, :store_name, :slug, :wa_number, :tagline, :desc, :address, :banner, :logo, :is_active, timezone('utc'::text, now())
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
            store_name = EXCLUDED.store_name,
            slug = EXCLUDED.slug,
            whatsapp_number = EXCLUDED.whatsapp_number,
            tagline = EXCLUDED.tagline,
            description = EXCLUDED.description,
            address = EXCLUDED.address,
            banner_url = EXCLUDED.banner_url,
            logo_url = EXCLUDED.logo_url,
            is_active = EXCLUDED.is_active,
            updated_at = timezone('utc'::text, now())
        RETURNING store_name, slug, whatsapp_number, tagline, description, address, banner_url, logo_url, is_active
    """)

    res = await db.execute(
        upsert_query,
        {
            "tenant_id": tenant_id_str,
            "store_name": payload.store_name.strip(),
            "slug": clean_slug,
            "wa_number": payload.whatsapp_number.strip(),
            "tagline": payload.tagline.strip() if payload.tagline else None,
            "desc": payload.description.strip() if payload.description else None,
            "address": payload.address.strip() if payload.address else None,
            "banner": payload.banner_url,
            "logo": payload.logo_url,
            "is_active": payload.is_active
        }
    )
    await db.commit()
    row = res.mappings().one()

    return StorefrontSettings(
        store_name=row["store_name"],
        slug=row["slug"],
        whatsapp_number=row["whatsapp_number"],
        tagline=row["tagline"],
        description=row["description"],
        address=row["address"],
        banner_url=row["banner_url"],
        logo_url=row["logo_url"],
        is_active=row["is_active"]
    )
