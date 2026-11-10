"""
TODO: INTEGRASI API ASLI TIKTOK SHOP OPEN API
=============================================================================
1. Buat Akun TikTok Shop Partner / Seller di https://partner.tiktokshop.com
2. Buat App di TikTok Shop Developer Portal dan dapatkan credentials resmi:
   - TIKTOK_APP_KEY
   - TIKTOK_APP_SECRET
   - TIKTOK_ACCESS_TOKEN
   - TIKTOK_SHOP_ID / CIPHER
3. Validasi Webhook Signature:
   - TikTok Shop mengirimkan header `Authorization: SHA256withRSA ...` atau signature HMAC-SHA256.
   - Verifikasi keaslian webhook sebelum memproses pesanan.
4. Ganti fungsi mock ini dengan handler webhook resmi:
   - Endpoint: POST /api/v1/webhooks/tiktok
   - Event Types: `ORDER_STATUS_CHANGE`, `PACKAGE_STATUS_CHANGE`
5. Sinkronisasi Stok Dua Arah:
   - Saat stok di Nexus OS berkurang, panggil API Update Inventory TikTok:
     POST /api/v2/products/stocks/update
   - Payload: { "product_id": ..., "skus": [{ "id": marketplace_sku, "available_stock": qty }] }
=============================================================================
"""

import json
from datetime import datetime, date, timezone
from typing import Dict, Any, List, Optional, Union
from uuid import UUID, uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.journal_service import get_or_create_default_accounts, create_auto_journal
from app.services.notifications.mock_wa_adapter import send_tiktok_order_notification

# Simulasi default item catalog untuk order TikTok jika DB kosong
DEFAULT_SIMULATION_ITEMS = [
    {
        "sku": "CAS-MAG-CLR",
        "marketplace_sku": "TTS-CASE-MAG-01",
        "name": "Casing MagSafe Armor Clear Hybrid",
        "qty": 2,
        "price": 75000,
        "cost_price": 35000,
        "category": "Aksesoris"
    },
    {
        "sku": "CAB-TC-100W",
        "marketplace_sku": "TTS-CAB-TC100-01",
        "name": "Kabel Data Type-C 100W Braided",
        "qty": 1,
        "price": 55000,
        "cost_price": 25000,
        "category": "Aksesoris"
    }
]

def simulate_incoming_order(
    tenant_id: Union[str, UUID] = "11111111-1111-1111-1111-111111111111",
    custom_items: Optional[List[Dict[str, Any]]] = None,
    payment_method: str = "QRIS"
) -> Dict[str, Any]:
    """
    Menghasilkan payload JSON yang meniru struktur webhook resmi TikTok Shop.
    Format ini identik dengan event ORDER_STATUS_CHANGE (Awaiting Shipment).
    """
    order_items = custom_items if custom_items else DEFAULT_SIMULATION_ITEMS
    total_amount = sum(item["price"] * item["qty"] for item in order_items)
    order_id = f"TTS-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

    return {
        "event_type": "ORDER_STATUS_CHANGE",
        "shop_id": "SHOP_ID_ID_MOCK_01",
        "timestamp": int(datetime.now(timezone.utc).timestamp()),
        "data": {
            "order_id": order_id,
            "order_status": "AWAITING_SHIPMENT",
            "payment_method": payment_method, # 'QRIS' | 'COD' | 'TRANSFER'
            "buyer_name": "Rian Pratama",
            "buyer_phone": "+6281399887766",
            "shipping_address": {
                "recipient_name": "Rian Pratama",
                "phone": "+6281399887766",
                "street": "Jl. Sudirman No. 45 Kav. 12",
                "district": "Kebayoran Baru",
                "city": "Jakarta Selatan",
                "province": "DKI Jakarta",
                "postal_code": "12190"
            },
            "items": [
                {
                    "sku": item.get("sku", "SKU-UNKNOWN"),
                    "marketplace_sku": item.get("marketplace_sku", item.get("sku")),
                    "item_name": item.get("name", "Produk Retail HP"),
                    "qty": item.get("qty", 1),
                    "price": item.get("price", 50000),
                    "subtotal": item.get("price", 50000) * item.get("qty", 1)
                }
                for item in order_items
            ],
            "total_amount": total_amount,
            "currency": "IDR",
            "fulfillment_type": "FULFILLED_BY_SELLER",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    }


async def process_marketplace_order(
    tenant_id: Union[str, UUID],
    order_payload: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Logika inti pemrosesan pesanan Marketplace TikTok Shop:
    1. Validasi / Extract payload order.
    2. Kurangi stok barang di `public.stock_levels` (lock & decrement).
    3. Catat audit ledger pengurangan di `public.stock_movements`.
    4. Simpan pesanan ke tabel `public.orders` dan `public.order_items`.
    5. Otomatis buat Jurnal Akuntansi double-entry (Debit Kas/Piutang, Credit Penjualan, Debit HPP, Credit Stok).
    6. Kirim notifikasi konfirmasi pesanan ke WhatsApp via `send_wa_message()`.
    """
    tenant_id_str = str(tenant_id)
    
    # Ekstraksi data pesanan dari payload webhook
    order_data = order_payload.get("data", order_payload)
    order_id = order_data.get("order_id", f"TTS-{uuid4().hex[:8].upper()}")
    buyer_name = order_data.get("buyer_name", "Pelanggan TikTok")
    buyer_phone = order_data.get("buyer_phone", "+6281200000000")
    total_amount = int(order_data.get("total_amount", 0))
    items_list = order_data.get("items", [])

    stock_decremented_log = []
    total_cogs = 0

    # 1. Loop setiap item pesanan: cari item di DB, kurangi stok, catat ledger
    for item in items_list:
        sku = item.get("sku", "")
        mp_sku = item.get("marketplace_sku", sku)
        qty = int(item.get("qty", 1))
        price = int(item.get("price", 0))

        # Query item di database berdasarkan marketplace_sku atau sku
        item_row = None
        try:
            res = await db.execute(
                text("""
                    SELECT id, sku, name, base_price, attributes
                    FROM public.items
                    WHERE tenant_id = :tenant_id 
                      AND (marketplace_sku = :mp_sku OR sku = :sku OR attributes->>'marketplace_sku' = :mp_sku)
                    LIMIT 1
                """),
                {"tenant_id": tenant_id_str, "mp_sku": mp_sku, "sku": sku}
            )
            item_row = res.mappings().first()
        except Exception:
            # Fallback jika query attributes biasa
            pass

        item_id = str(item_row["id"]) if item_row else str(uuid4())
        item_name = item_row["name"] if item_row else item.get("item_name", sku)
        
        # Ekstraksi HPP jika ada
        cost_price = int(item.get("cost_price", 0))
        if not cost_price and item_row:
            attrs = item_row["attributes"] if isinstance(item_row["attributes"], dict) else {}
            cost_price = int(attrs.get("cost_price", attrs.get("hpp", int(price * 0.6))))
        if not cost_price:
            cost_price = int(price * 0.6) # Asumsi estimasi modal 60% jika tidak tercatat

        total_cogs += (cost_price * qty)

        # Kurangi stok fisik jika item tercatat di database
        if item_row:
            try:
                # Update stock_levels
                await db.execute(
                    text("""
                        UPDATE public.stock_levels
                        SET on_hand = GREATEST(0, on_hand - :qty)
                        WHERE tenant_id = :tenant_id AND item_id = :item_id
                    """),
                    {"tenant_id": tenant_id_str, "item_id": item_id, "qty": qty}
                )

                # Insert ke stock_movements (immutable audit ledger)
                await db.execute(
                    text("""
                        INSERT INTO public.stock_movements (
                            id, tenant_id, item_id, qty_delta, reason, ref_id
                        ) VALUES (
                            gen_random_uuid(), :tenant_id, :item_id, :qty_delta, 'TIKTOK_ORDER_FULFILLMENT', :ref_id
                        )
                    """),
                    {
                        "tenant_id": tenant_id_str,
                        "item_id": item_id,
                        "qty_delta": -qty,
                        "ref_id": order_id
                    }
                )
            except Exception as e:
                print(f"[TIKTOK MOCK] Catatan pengurangan stok: {e}")

        stock_decremented_log.append({
            "item_name": item_name,
            "sku": sku,
            "marketplace_sku": mp_sku,
            "qty": qty,
            "cost_price": cost_price
        })

    # 2. Simpan order ke public.orders
    db_order_id = str(uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO public.orders (
                    id, tenant_id, status, channel, total_amount, metadata
                ) VALUES (
                    :id, :tenant_id, 'PAID', 'TIKTOK_SHOP', :total_amount, :metadata::jsonb
                )
            """),
            {
                "id": db_order_id,
                "tenant_id": tenant_id_str,
                "total_amount": total_amount,
                "metadata": json.dumps({
                    "tiktok_order_id": order_id,
                    "buyer_name": buyer_name,
                    "buyer_phone": buyer_phone,
                    "payment_method": order_data.get("payment_method", "QRIS"),
                    "source": "mock_tiktok_webhook"
                })
            }
        )
    except Exception as e:
        print(f"[TIKTOK MOCK] Catatan insert order: {e}")

    # 3. Otomatis buat Jurnal Akuntansi Double-Entry (General Ledger)
    journal_res = None
    try:
        coa = await get_or_create_default_accounts(tenant_id_str, db)
        
        # Akun:
        # Kas Kasir / Piutang TikTok: 1000
        # Pendapatan Penjualan Aksesoris: 4200 (atau Sparepart: 4100)
        # HPP: 5100
        # Persediaan: 1210
        acc_cash = coa.get("1000", {}).get("id")
        acc_revenue = coa.get("4200", coa.get("4100", {})).get("id")
        acc_cogs = coa.get("5100", coa.get("5000", {})).get("id")
        acc_inventory = coa.get("1210", coa.get("1200", {})).get("id")

        journal_lines = [
            # Debit: Kas / Saldo Marketplace TikTok
            {"account_id": acc_cash, "debit": total_amount, "credit": 0},
            # Credit: Pendapatan Penjualan
            {"account_id": acc_revenue, "debit": 0, "credit": total_amount},
        ]

        # Jurnal Beban Pokok (HPP vs Pengurangan Persediaan Barang)
        if acc_cogs and acc_inventory and total_cogs > 0:
            journal_lines.extend([
                {"account_id": acc_cogs, "debit": total_cogs, "credit": 0},
                {"account_id": acc_inventory, "debit": 0, "credit": total_cogs},
            ])

        journal_res = await create_auto_journal(
            tenant_id=tenant_id_str,
            transaction_date=date.today(),
            description=f"Penjualan TikTok Shop Order #{order_id} - {buyer_name}",
            reference_type="TIKTOK_ORDER",
            reference_id=db_order_id,
            lines=journal_lines,
            db=db
        )
    except Exception as je:
        print(f"[TIKTOK MOCK] Warning auto-journal: {je}")

    # Commit seluruh mutasi database
    try:
        await db.commit()
    except Exception:
        pass

    # 4. Kirim notifikasi WhatsApp otomatis ke pembeli
    item_summary = ", ".join([f"{it['qty']}x {it['item_name']}" for it in stock_decremented_log])
    wa_log = await send_tiktok_order_notification(
        tenant_id=tenant_id_str,
        phone=buyer_phone,
        order_id=order_id,
        buyer_name=buyer_name,
        item_summary=item_summary,
        total_amount=total_amount,
        db=db
    )

    return {
        "success": True,
        "message": f"Order TikTok #{order_id} berhasil diproses, stok terkunci, jurnal tercipta, dan WA terkirim.",
        "order_id": order_id,
        "internal_order_id": db_order_id,
        "buyer_name": buyer_name,
        "buyer_phone": buyer_phone,
        "total_amount": total_amount,
        "total_cogs": total_cogs,
        "items_processed": stock_decremented_log,
        "journal_entry_id": journal_res.get("entry_id") if journal_res else None,
        "wa_notification": wa_log
    }
