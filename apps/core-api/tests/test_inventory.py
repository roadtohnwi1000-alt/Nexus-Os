"""
NEXUS CORE OS - INVENTORY & MULTI-LOCATION TEST SUITE
File: apps/core-api/tests/test_inventory.py

Menguji skema Pydantic untuk multi-lokasi gudang dan transfer mutasi stok.
"""

from uuid import uuid4
import pytest
from pydantic import ValidationError

from app.schemas.inventory import (
    LocationResponse,
    StockItemResponse,
    StockTransferRequest,
    StockTransferResponse
)

def test_location_response_schema():
    """Menguji schema representasi lokasi gudang / toko."""
    loc = LocationResponse(
        id=uuid4(),
        tenant_id=uuid4(),
        name="Gudang Pusat",
        type="warehouse",
        is_active=True
    )
    assert loc.name == "Gudang Pusat"
    assert loc.type == "warehouse"

def test_stock_transfer_request_validation():
    """Menguji validasi request mutasi transfer stok antar cabang."""
    item_id = uuid4()
    from_loc = uuid4()
    to_loc = uuid4()

    valid_req = StockTransferRequest(
        item_id=item_id,
        from_location_id=from_loc,
        to_location_id=to_loc,
        qty=5,
        reason="Kirim stok ke cabang mall"
    )
    assert valid_req.qty == 5
    assert valid_req.from_location_id == from_loc

    # Kuantitas harus > 0
    with pytest.raises(ValidationError):
        StockTransferRequest(
            item_id=item_id,
            from_location_id=from_loc,
            to_location_id=to_loc,
            qty=0
        )
