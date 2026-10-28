"""
Bridge module untuk mendukung referensi `app.api.v1.import`.
Meneruskan router dari `app.api.v1.data_import`.
"""
from app.api.v1.data_import import router, ImportResultResponse, RowErrorDetail

__all__ = ["router", "ImportResultResponse", "RowErrorDetail"]
