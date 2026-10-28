"""
NEXUS CORE OS - CSV & DATA IMPORT TEST SUITE
File: apps/core-api/tests/test_data_import.py

Menguji fungsionalitas import data katalog produk (Accurate) dan kontak (Salesforce).
"""

from uuid import UUID
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

# Tenant Uji untuk Import
TEST_TENANT_ID = UUID("11111111-1111-1111-1111-111111111111")
TENANT_HEADER = {"X-Tenant-ID": str(TEST_TENANT_ID)}

@pytest.mark.asyncio
async def test_download_templates():
    """
    Menguji bahwa endpoint template CSV mengembalikan file CSV yang valid dengan header yang sesuai.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Template Produk
        res_items = await client.get("/api/v1/import/template/items")
        assert res_items.status_code == 200
        assert "text/csv" in res_items.headers.get("content-type", "")
        assert "SKU,Nama Barang,Harga Jual" in res_items.text

        # Template Kontak
        res_contacts = await client.get("/api/v1/import/template/contacts")
        assert res_contacts.status_code == 200
        assert "text/csv" in res_contacts.headers.get("content-type", "")
        assert "Nama,No HP,Email,Perusahaan" in res_contacts.text

@pytest.mark.asyncio
async def test_import_items_file_size_limit():
    """
    Menguji proteksi batas maksimal file upload (maks 5MB).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Buat dummy payload melebihi 5MB
        oversized_data = b"x" * (6 * 1024 * 1024)
        files = {"file": ("huge_catalog.csv", oversized_data, "text/csv")}
        
        res = await client.post("/api/v1/import/items", headers=TENANT_HEADER, files=files)
        assert res.status_code == 400
        assert "melebihi batas maksimal" in res.json().get("detail", "").lower()
