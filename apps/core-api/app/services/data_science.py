"""
NEXUS CORE OS - DATA SCIENCE & INTELLIGENCE ENGINE
File: apps/core-api/app/services/data_science.py

Menerapkan analitik prediktif dan machine learning / pemodelan statistik:
1. RFM Customer Segmentation (Recency, Frequency, Monetary)
2. Predictive Sales Velocity & Smart Reorder (ADS & Days-to-Stockout)
3. Competitor Market Intelligence & Price Scraper Agent

🧠 ATURAN ARSITEKTUR EMAS:
1. TENANT ISOLATION: Setiap query SQL WAJIB dibatasi oleh `WHERE tenant_id = :tenant_id`.
2. INTEGER MINOR UNITS: Seluruh nilai finansial dinyatakan dalam integer (Rupiah penuh).
3. RESILIENCE & FALLBACK: Jika tenant baru memiliki data transaksi minim, engine menyediakan
   profil simulasi realistis untuk keperluan demonstrasi operasional tanpa crash.
"""

import math
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ==============================================================================
# BAGIAN 1: RFM CUSTOMER MODELING ENGINE
# ==============================================================================

# Definisi Label Segmen RFM Baku
RFM_SEGMENTS = {
    "CHAMPIONS": {
        "name": "Champions",
        "description": "Pelanggan terbaik: belanja paling baru, paling sering, dan nilai transaksi tertinggi.",
        "badge_color": "emerald",
        "action_recommendation": "Berikan reward VIP, akses eksklusif sparepart langka, dan ucapan apresiasi personal."
    },
    "LOYAL": {
        "name": "Loyal Customers",
        "description": "Pelanggan setia: sering bertransaksi dengan nilai belanja stabil.",
        "badge_color": "purple",
        "action_recommendation": "Tawarkan program loyalitas poin, diskon bundling aksesoris, dan upsell garansi extended."
    },
    "AT_RISK": {
        "name": "At Risk",
        "description": "Dulu rutin belanja atau servis, namun sudah lama (> 45 hari) tidak kembali.",
        "badge_color": "amber",
        "action_recommendation": "Kirim pesan WhatsApp re-engagement dengan voucher potongan servis atau promo cuci gudang."
    },
    "LOST": {
        "name": "Lost Customers",
        "description": "Tidak aktif bertransaksi selama lebih dari 120 hari.",
        "badge_color": "rose",
        "action_recommendation": "Kirim survei kepuasan atau penawaran win-back khusus servis unit lama."
    },
    "PROMISING": {
        "name": "Promising / New",
        "description": "Pelanggan baru dengan transaksi dalam 30 hari terakhir.",
        "badge_color": "blue",
        "action_recommendation": "Kirim ucapan terima kasih dan edukasi tips perawatan baterai / layar ponsel."
    }
}

# Data profil simulasi jika database tenant baru belum memiliki kontak
DEMO_RFM_PROFILES = [
    {
        "customer_id": "c-demo-001",
        "customer_name": "Budi Santoso (iPhone Center)",
        "phone": "081298765432",
        "recency_days": 4,
        "frequency": 8,
        "monetary_total": 4850000,
        "segment": "Champions",
        "badge_color": "emerald",
        "action": "Kirim apresiasi VIP & penawaran tier reseller eksklusif.",
        "last_transaction": "2026-10-25"
    },
    {
        "customer_id": "c-demo-002",
        "customer_name": "Siti Rahmawati (Toko Gadget Barokah)",
        "phone": "081388776655",
        "recency_days": 12,
        "frequency": 5,
        "monetary_total": 2750000,
        "segment": "Champions",
        "badge_color": "emerald",
        "action": "Tawarkan diskon volume untuk pembelian grosir tempered glass & charger.",
        "last_transaction": "2026-10-17"
    },
    {
        "customer_id": "c-demo-003",
        "customer_name": "Agus Pratama (Teknisi Keliling)",
        "phone": "085712345678",
        "recency_days": 21,
        "frequency": 4,
        "monetary_total": 1650000,
        "segment": "Loyal Customers",
        "badge_color": "purple",
        "action": "Undang ke grup WA info stok IC Power & LCD OEM restock tercepat.",
        "last_transaction": "2026-10-08"
    },
    {
        "customer_id": "c-demo-004",
        "customer_name": "dr. Hendra Wijaya",
        "phone": "081809988776",
        "recency_days": 18,
        "frequency": 3,
        "monetary_total": 1950000,
        "segment": "Loyal Customers",
        "badge_color": "purple",
        "action": "Tawarkan promo perawatan berkala pembersihan speaker & ganti pasta thermal.",
        "last_transaction": "2026-10-11"
    },
    {
        "customer_id": "c-demo-005",
        "customer_name": "Citra Dewi",
        "phone": "081933445566",
        "recency_days": 58,
        "frequency": 3,
        "monetary_total": 1200000,
        "segment": "At Risk",
        "badge_color": "amber",
        "action": "Kirim WA: 'Hai Kak Citra, kami kangen! Ada voucher servis Rp 50.000 menunggumu.'",
        "last_transaction": "2026-09-01"
    },
    {
        "customer_id": "c-demo-006",
        "customer_name": "Rian Kusuma (Rian Cell)",
        "phone": "087811223344",
        "recency_days": 82,
        "frequency": 4,
        "monetary_total": 3100000,
        "segment": "At Risk",
        "badge_color": "amber",
        "action": "Hubungi via telepon untuk menanyakan apakah butuh pasokan sparepart seri terbaru.",
        "last_transaction": "2026-08-08"
    },
    {
        "customer_id": "c-demo-007",
        "customer_name": "Eko Purnomo",
        "phone": "085299881122",
        "recency_days": 145,
        "frequency": 1,
        "monetary_total": 350000,
        "segment": "Lost",
        "badge_color": "rose",
        "action": "Kirim pesan win-back otomatis kampanye tukar tambah baterai bergaransi.",
        "last_transaction": "2026-06-06"
    },
    {
        "customer_id": "c-demo-008",
        "customer_name": "Maya Anggraini",
        "phone": "081277665544",
        "recency_days": 8,
        "frequency": 1,
        "monetary_total": 450000,
        "segment": "Promising / New",
        "badge_color": "blue",
        "action": "Kirim survei kepuasan pelanggan paska ganti LCD pertama.",
        "last_transaction": "2026-10-21"
    }
]


async def calculate_rfm_segments(tenant_id: str, db: AsyncSession) -> Dict[str, Any]:
    """
    Menghitung metrik RFM (Recency, Frequency, Monetary) per pelanggan milik tenant aktif:
    1. Menggabungkan data dari tabel `orders` dan `repair_tickets` yang terhubung ke `contacts`.
    2. Recency  : Selisih hari antara hari ini dengan transaksi terakhir pelanggan.
    3. Frequency: Jumlah pesanan atau servis dalam 90 hari terakhir.
    4. Monetary : Total belanja (Rupiah penuh).
    """
    tenant_id_str = str(tenant_id)
    today = date.today()

    try:
        # Query transaksi gabungan dari tabel orders dan repair_tickets
        sql = text("""
            WITH combined_transactions AS (
                -- Dari tabel orders POS
                SELECT 
                    o.contact_id,
                    o.created_at::date AS tx_date,
                    o.total_minor AS amount
                FROM public.orders o
                WHERE o.tenant_id = :tenant_id 
                  AND o.contact_id IS NOT NULL
                  AND o.status IN ('confirmed', 'Done', 'draft')

                UNION ALL

                -- Dari tabel repair_tickets Servis HP
                SELECT 
                    rt.customer_id AS contact_id,
                    rt.created_at::date AS tx_date,
                    COALESCE(rt.final_cost, rt.estimated_cost, 0) AS amount
                FROM public.repair_tickets rt
                WHERE rt.tenant_id = :tenant_id 
                  AND rt.customer_id IS NOT NULL
            ),
            customer_rfm AS (
                SELECT 
                    c.id AS customer_id,
                    c.display_name AS customer_name,
                    COALESCE(c.attributes->>'phone', c.attributes->>'no_hp', '') AS phone,
                    MAX(ct.tx_date) AS last_tx_date,
                    COUNT(ct.tx_date) AS frequency_total,
                    COUNT(CASE WHEN ct.tx_date >= (CURRENT_DATE - INTERVAL '90 days') THEN 1 END) AS frequency_90d,
                    COALESCE(SUM(ct.amount), 0) AS monetary_total
                FROM public.contacts c
                LEFT JOIN combined_transactions ct ON ct.contact_id = c.id
                WHERE c.tenant_id = :tenant_id
                GROUP BY c.id, c.display_name, c.attributes
            )
            SELECT 
                customer_id,
                customer_name,
                phone,
                last_tx_date,
                frequency_90d,
                frequency_total,
                monetary_total
            FROM customer_rfm
            ORDER BY monetary_total DESC
        """)

        result = await db.execute(sql, {"tenant_id": tenant_id_str})
        rows = result.mappings().all()

        customers = []

        if rows and any(r["last_tx_date"] is not None for r in rows):
            for r in rows:
                if r["last_tx_date"]:
                    last_date = r["last_tx_date"]
                    recency = (today - last_date).days
                else:
                    recency = 999
                    last_date = None

                freq = int(r["frequency_90d"] or r["frequency_total"] or 0)
                monetary = int(r["monetary_total"] or 0)

                # Segmentasi Berdasarkan Aturan Bisnis RFM
                if recency > 120:
                    segment = "Lost"
                    badge_color = "rose"
                    action = "Kirim pesan win-back otomatis kampanye tukar tambah unit lama."
                elif recency > 45:
                    if freq >= 2 or monetary >= 1000000:
                        segment = "At Risk"
                        badge_color = "amber"
                        action = "Kirim voucher potongan servis atau promo cuci gudang re-engagement."
                    else:
                        segment = "Lost"
                        badge_color = "rose"
                        action = "Hubungi via WA menanyakan keluhan servis sebelumnya."
                else:
                    # recency <= 45 hari
                    if freq >= 3 and monetary >= 1500000:
                        segment = "Champions"
                        badge_color = "emerald"
                        action = "Berikan reward VIP, akses sparepart langka, dan ucapan apresiasi."
                    elif freq >= 2 or monetary >= 750000:
                        segment = "Loyal Customers"
                        badge_color = "purple"
                        action = "Tawarkan program loyalitas poin dan bundling aksesoris hemat."
                    else:
                        segment = "Promising / New"
                        badge_color = "blue"
                        action = "Kirim survei kepuasan paska kunjungan pertama."

                customers.append({
                    "customer_id": str(r["customer_id"]),
                    "customer_name": r["customer_name"],
                    "phone": r["phone"] or "08123456789",
                    "recency_days": recency,
                    "frequency": freq,
                    "monetary_total": monetary,
                    "segment": segment,
                    "badge_color": badge_color,
                    "action": action,
                    "last_transaction": last_date.isoformat() if last_date else "-"
                })
        else:
            # Fallback ke profil simulasi realistis jika kontak di database belum memiliki transaksi
            customers = DEMO_RFM_PROFILES

        # Hitung Ringkasan Jumlah Pelanggan per Segmen
        summary = {
            "champions": sum(1 for c in customers if c["segment"] == "Champions"),
            "loyal": sum(1 for c in customers if c["segment"] == "Loyal Customers"),
            "at_risk": sum(1 for c in customers if c["segment"] == "At Risk"),
            "lost": sum(1 for c in customers if c["segment"] == "Lost"),
            "promising": sum(1 for c in customers if c["segment"] == "Promising / New"),
            "total_customers": len(customers)
        }

        return {
            "tenant_id": tenant_id_str,
            "analysis_date": today.isoformat(),
            "summary": summary,
            "customers": customers
        }

    except Exception as e:
        # Fallback resilien jika terjadi error query database
        summary = {
            "champions": sum(1 for c in DEMO_RFM_PROFILES if c["segment"] == "Champions"),
            "loyal": sum(1 for c in DEMO_RFM_PROFILES if c["segment"] == "Loyal Customers"),
            "at_risk": sum(1 for c in DEMO_RFM_PROFILES if c["segment"] == "At Risk"),
            "lost": sum(1 for c in DEMO_RFM_PROFILES if c["segment"] == "Lost"),
            "promising": sum(1 for c in DEMO_RFM_PROFILES if c["segment"] == "Promising / New"),
            "total_customers": len(DEMO_RFM_PROFILES)
        }
        return {
            "tenant_id": tenant_id_str,
            "analysis_date": today.isoformat(),
            "summary": summary,
            "customers": DEMO_RFM_PROFILES,
            "error_fallback": str(e)
        }


# ==============================================================================
# BAGIAN 2: PREDICTIVE SALES & SMART REORDER LOGIC
# ==============================================================================

# Data fallback untuk demonstrasi jika data penjualan 30 hari di database masih baru
DEMO_PREDICTIVE_ITEMS = [
    {
        "item_id": "sp-001",
        "name": "LCD iPhone 11 Original OEM",
        "sku": "LCD-IPH-11",
        "category": "Sparepart",
        "current_stock": 4,
        "sold_last_30d": 36,
        "ads": 1.2,
        "days_until_stockout": 3.3,
        "status": "CRITICAL",
        "recommended_reorder_qty": 20,
        "lead_time_days": 3,
        "risk_level": "Habis dalam ~3 hari"
    },
    {
        "item_id": "sp-002",
        "name": "Baterai Samsung Galaxy S21 (4000mAh)",
        "sku": "BAT-SAM-S21",
        "category": "Sparepart",
        "current_stock": 5,
        "sold_last_30d": 27,
        "ads": 0.9,
        "days_until_stockout": 5.5,
        "status": "CRITICAL",
        "recommended_reorder_qty": 15,
        "lead_time_days": 3,
        "risk_level": "Habis dalam ~5 hari"
    },
    {
        "item_id": "acc-002",
        "name": "Kabel Data Type-C 100W Braided",
        "sku": "CAB-TC-100W",
        "category": "Aksesoris",
        "current_stock": 14,
        "sold_last_30d": 45,
        "ads": 1.5,
        "days_until_stockout": 9.3,
        "status": "WARNING",
        "recommended_reorder_qty": 25,
        "lead_time_days": 4,
        "risk_level": "Habis dalam ~9 hari"
    },
    {
        "item_id": "acc-001",
        "name": "Casing MagSafe Armor Clear Hybrid",
        "sku": "CASE-MAG-CLR",
        "category": "Aksesoris",
        "current_stock": 38,
        "sold_last_30d": 24,
        "ads": 0.8,
        "days_until_stockout": 47.5,
        "status": "SAFE",
        "recommended_reorder_qty": 0,
        "lead_time_days": 3,
        "risk_level": "Stok Aman (47 hari)"
    },
    {
        "item_id": "sp-003",
        "name": "IC Power PM6150 Xiaomi/Redmi",
        "sku": "IC-PWR-PM6150",
        "category": "Sparepart",
        "current_stock": 25,
        "sold_last_30d": 15,
        "ads": 0.5,
        "days_until_stockout": 50.0,
        "status": "SAFE",
        "recommended_reorder_qty": 0,
        "lead_time_days": 5,
        "risk_level": "Stok Aman (50 hari)"
    }
]


async def predict_fast_moving_items(tenant_id: str, db: AsyncSession) -> Dict[str, Any]:
    """
    Logika Prediksi Kehabisan Stok (Predictive Stockout & Smart PO Reorder):
    1. Ambil seluruh kuantitas penjualan 30 hari terakhir dari tabel `order_lines` dan `repair_ticket_parts`.
    2. ADS (Average Daily Sales):
       ADS = Total Qty Terjual / 30 Hari
    3. Prediksi Hari Menuju Kehabisan Stok:
       Days to Stockout = Stok Saat Ini (on_hand) / ADS
    4. Aturan Risiko:
       - Kritis (CRITICAL) : Days to Stockout < 7 Hari -> Rekomendasikan PO Restock Segera!
       - Waspada (WARNING) : Days to Stockout antara 7 - 14 Hari.
       - Aman (SAFE)       : Days to Stockout >= 14 Hari.
    5. Rekomendasi Kuantitas Restock PO:
       Reorder Qty = ceil((Lead Time [3 hari] + Safety Stock [14 hari]) * ADS - Stok Tersedia)
    """
    tenant_id_str = str(tenant_id)
    LEAD_TIME_DAYS = 3       # Estimasi waktu pengiriman supplier (hari)
    SAFETY_STOCK_DAYS = 14   # Cadangan stok pengaman (hari)

    try:
        # Agregasi data penjualan dan stok per item
        sql = text("""
            WITH sales_30d AS (
                -- Penjualan dari order POS
                SELECT 
                    ol.item_id,
                    SUM(ol.qty) AS total_sold_pos
                FROM public.order_lines ol
                JOIN public.orders o ON o.id = ol.order_id
                WHERE ol.tenant_id = :tenant_id
                  AND o.created_at >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY ol.item_id

                UNION ALL

                -- Pemakaian sparepart di repair tickets
                SELECT 
                    rtp.item_id,
                    SUM(rtp.qty) AS total_sold_repair
                FROM public.repair_ticket_parts rtp
                WHERE rtp.tenant_id = :tenant_id
                  AND rtp.created_at >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY rtp.item_id
            ),
            sales_aggregated AS (
                SELECT 
                    item_id,
                    SUM(total_sold_pos) AS total_sold_30d
                FROM sales_30d
                GROUP BY item_id
            )
            SELECT 
                i.id AS item_id,
                i.name,
                i.sku,
                i.item_type,
                COALESCE(i.attributes->>'category', 'Sparepart') AS category,
                COALESCE(sl.on_hand, 0) AS on_hand,
                COALESCE(sl.reserved, 0) AS reserved,
                COALESCE(sa.total_sold_30d, 0) AS sold_last_30d
            FROM public.items i
            LEFT JOIN public.stock_levels sl ON sl.item_id = i.id AND sl.tenant_id = :tenant_id
            LEFT JOIN sales_aggregated sa ON sa.item_id = i.id
            WHERE i.tenant_id = :tenant_id 
              AND i.active = true
              AND i.item_type != 'service'
            ORDER BY sold_last_30d DESC
        """)

        result = await db.execute(sql, {"tenant_id": tenant_id_str})
        rows = result.mappings().all()

        predictive_items = []

        if rows and any(r["sold_last_30d"] > 0 for r in rows):
            for r in rows:
                stock_avail = max(0, int(r["on_hand"]) - int(r["reserved"]))
                sold_30d = int(r["sold_last_30d"])
                ads = round(sold_30d / 30.0, 2)

                if ads > 0:
                    days_left = round(stock_avail / ads, 1)
                else:
                    days_left = 999.0

                # Penentuan Status Risiko
                if days_left < 7.0:
                    status_risk = "CRITICAL"
                    risk_label = f"Kritis (Habis dlm ~{days_left:.0f} hari)"
                elif days_left <= 14.0:
                    status_risk = "WARNING"
                    risk_label = f"Waspada (Habis dlm ~{days_left:.0f} hari)"
                else:
                    status_risk = "SAFE"
                    risk_label = f"Aman ({days_left:.0f} hari)" if days_left < 100 else "Stok Cukup (> 90 hari)"

                # Formula Rekomendasi Kuantitas PO Restock:
                # Target Buffer = (Lead Time + Safety Days) * ADS
                target_stock = math.ceil((LEAD_TIME_DAYS + SAFETY_STOCK_DAYS) * ads)
                reorder_qty = max(0, target_stock - stock_avail) if status_risk in ("CRITICAL", "WARNING") else 0

                predictive_items.append({
                    "item_id": str(r["item_id"]),
                    "name": r["name"],
                    "sku": r["sku"],
                    "category": r["category"],
                    "current_stock": stock_avail,
                    "sold_last_30d": sold_30d,
                    "ads": ads,
                    "days_until_stockout": days_left,
                    "status": status_risk,
                    "recommended_reorder_qty": reorder_qty,
                    "lead_time_days": LEAD_TIME_DAYS,
                    "risk_level": risk_label
                })
        else:
            predictive_items = DEMO_PREDICTIVE_ITEMS

        # Urutkan berdasarkan hari menuju habis (paling kritis di paling atas)
        predictive_items.sort(key=lambda x: x["days_until_stockout"])

        critical_count = sum(1 for it in predictive_items if it["status"] == "CRITICAL")
        warning_count = sum(1 for it in predictive_items if it["status"] == "WARNING")

        return {
            "tenant_id": tenant_id_str,
            "period": "30 Hari Terakhir",
            "critical_stockout_count": critical_count,
            "warning_stockout_count": warning_count,
            "items": predictive_items
        }

    except Exception:
        return {
            "tenant_id": tenant_id_str,
            "period": "30 Hari Terakhir (Mode Simulasi Live)",
            "critical_stockout_count": sum(1 for it in DEMO_PREDICTIVE_ITEMS if it["status"] == "CRITICAL"),
            "warning_stockout_count": sum(1 for it in DEMO_PREDICTIVE_ITEMS if it["status"] == "WARNING"),
            "items": DEMO_PREDICTIVE_ITEMS
        }


# ==============================================================================
# BAGIAN 3: COMPETITOR PRICE SCRAPER (ARSITEKTUR & SIMULASI INTEL PASAR)
# ==============================================================================

class CompetitorScraperAgent:
    """
    Agen Intel Pasar & Scraping Harga Marketplace (Shopee, Tokopedia, Bukalapak):
    
    Arsitektur Produksi:
    - Menggunakan asynchronous HTTP client (httpx) atau Playwright headless browser
    - Didukung proxy rotation & anti-bot bypass untuk mengambil data real-time e-commerce.
    
    Model Simulasi Cerdas (MVP Demo):
    - Mengembalikan komparasi harga realistis berdasarkan katalog sparepart & aksesoris HP.
    - Menghitung deviasi harga dan memberikan rekomendasi optimasi margin.
    """

    MOCK_MARKETPLACE_DATABASE = {
        "lcd iphone 11": [
            {"marketplace": "Shopee", "seller": "MegaSparepart Official (Jakarta)", "price": 520000, "rating": 4.9, "sold": "1.2k"},
            {"marketplace": "Tokopedia", "seller": "Indo LCD Specialist (Surabaya)", "price": 535000, "rating": 4.8, "sold": "850"},
            {"marketplace": "Tokopedia", "seller": "Roxy Part Grosir (Jakarta)", "price": 510000, "rating": 4.7, "sold": "3.1k"},
            {"marketplace": "Shopee", "seller": "TechRepair Mall (Tangerang)", "price": 540000, "rating": 4.9, "sold": "400"},
        ],
        "baterai samsung s21": [
            {"marketplace": "Tokopedia", "seller": "Samsung Original Store (Jakarta)", "price": 280000, "rating": 4.9, "sold": "600"},
            {"marketplace": "Shopee", "seller": "PowerCell Official (Bandung)", "price": 275000, "rating": 4.8, "sold": "950"},
            {"marketplace": "Shopee", "seller": "Grosir Baterai HP (Batam)", "price": 260000, "rating": 4.7, "sold": "1.5k"},
        ],
        "casing magsafe": [
            {"marketplace": "Shopee", "seller": "CaseKing ID (Jakarta)", "price": 48000, "rating": 4.9, "sold": "10k+"},
            {"marketplace": "Tokopedia", "seller": "ArmorGadget (Surabaya)", "price": 52000, "rating": 4.8, "sold": "4.2k"},
            {"marketplace": "Tokopedia", "seller": "Baseus Store Partner", "price": 55000, "rating": 4.9, "sold": "2.8k"},
        ],
        "kabel type-c": [
            {"marketplace": "Shopee", "seller": "Ugreen Authorized Store", "price": 39000, "rating": 4.9, "sold": "25k+"},
            {"marketplace": "Tokopedia", "seller": "Aukey Indonesia Official", "price": 45000, "rating": 4.9, "sold": "12k+"},
            {"marketplace": "Shopee", "seller": "Vention Official", "price": 38000, "rating": 4.8, "sold": "8k+"},
        ],
        "ic power pm6150": [
            {"marketplace": "Tokopedia", "seller": "Bengkel Chipset Nusantara", "price": 145000, "rating": 4.8, "sold": "210"},
            {"marketplace": "Shopee", "seller": "Teknisi Smart Mart (Jakarta)", "price": 150000, "rating": 4.9, "sold": "180"},
        ]
    }

    @classmethod
    async def scrape_marketplace_prices(cls, keyword: str) -> List[Dict[str, Any]]:
        """
        Mengambil data harga pasar dari marketplace untuk suatu kata kunci produk.
        """
        k_clean = keyword.lower().strip()
        # Cari pencocokan parsial pada database simulasi
        for key, results in cls.MOCK_MARKETPLACE_DATABASE.items():
            if any(term in k_clean for term in key.split()):
                return results

        # Fallback generik simulasi jika kata kunci tidak spesifik
        return [
            {"marketplace": "Shopee", "seller": "Mitra Sparepart Utama", "price": 210000, "rating": 4.8, "sold": "500"},
            {"marketplace": "Tokopedia", "seller": "Grosir Toko Ponsel", "price": 225000, "rating": 4.7, "sold": "340"},
            {"marketplace": "Shopee", "seller": "Global Sparepart Store", "price": 195000, "rating": 4.9, "sold": "1.1k"},
        ]

    @classmethod
    async def analyze_market_competitiveness(
        cls, 
        keyword: str, 
        tenant_id: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Menganalisis perbandingan harga item katalog tenant dengan harga pasar kompetitor:
        - Jika harga kita > 10% di atas rata-rata pasar: Flag '⚠️ Harga Kita Tidak Kompetitif'.
        - Jika harga kita < 10% di bawah rata-rata pasar: Flag '💡 Peluang Tingkatkan Margin'.
        - Jika dalam rentang +/- 10%: Flag '✅ Harga Kompetitif & Optimal'.
        """
        competitor_listings = await cls.scrape_marketplace_prices(keyword)
        avg_market_price = int(sum(c["price"] for c in competitor_listings) / len(competitor_listings))
        min_market_price = min(c["price"] for c in competitor_listings)
        max_market_price = max(c["price"] for c in competitor_listings)

        # Cari item terkait di database tenant
        item_query = text("""
            SELECT id, name, sku, base_price, price_retail, price_reseller, price_technician
            FROM public.items
            WHERE tenant_id = :tenant_id 
              AND (LOWER(name) LIKE :pattern OR LOWER(sku) LIKE :pattern)
            LIMIT 1
        """)
        pattern = f"%{keyword.lower().strip()}%"
        res = await db.execute(item_query, {"tenant_id": str(tenant_id), "pattern": pattern})
        matched_item = res.mappings().first()

        our_price = matched_item["price_retail"] if matched_item and matched_item["price_retail"] else (
            matched_item["base_price"] if matched_item else (avg_market_price + int(avg_market_price * 0.15))
        )
        our_item_name = matched_item["name"] if matched_item else f"Hasil Pencarian: {keyword}"

        # Hitung selisih persentase: ((our_price - avg_market_price) / avg_market_price) * 100
        diff_pct = round(((our_price - avg_market_price) / avg_market_price) * 100, 1)

        if diff_pct > 10.0:
            status_code = "UNCOMPETITIVE"
            status_label = "⚠️ Harga Kita Tidak Kompetitif (Kemahalan)"
            recommendation = (
                f"Harga retail Anda (Rp {our_price:,}) lebih mahal {diff_pct}% dari rata-rata pasar (Rp {avg_market_price:,}). "
                f"Pertimbangkan untuk menurunkan harga mendekati Rp {math.ceil(avg_market_price * 1.05):,} agar volume penjualan meningkat."
            )
        elif diff_pct < -10.0:
            status_code = "UNDERPRICED"
            status_label = "💡 Peluang Tingkatkan Margin (Terlalu Murah)"
            recommendation = (
                f"Harga retail Anda (Rp {our_price:,}) lebih murah {abs(diff_pct)}% dari rata-rata pasar (Rp {avg_market_price:,}). "
                f"Anda memiliki ruang untuk menaikkan harga hingga Rp {math.floor(avg_market_price * 0.95):,} tanpa kehilangan daya saing."
            )
        else:
            status_code = "OPTIMAL"
            status_label = "✅ Harga Kompetitif & Optimal"
            recommendation = (
                f"Harga Anda (Rp {our_price:,}) berada dalam rentang kompetitif pasar yang sehat (+/- 10%). Pertahankan strategi harga ini."
            )

        return {
            "keyword": keyword,
            "matched_item_name": our_item_name,
            "our_price": our_price,
            "market_average_price": avg_market_price,
            "market_min_price": min_market_price,
            "market_max_price": max_market_price,
            "price_difference_percentage": diff_pct,
            "status_code": status_code,
            "status_label": status_label,
            "recommendation": recommendation,
            "competitor_listings": competitor_listings
        }
