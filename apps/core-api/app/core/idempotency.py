from typing import Optional
from fastapi import Header, HTTPException, status

def require_idempotency_key(
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key", description="Kunci idempotensi untuk menjamin eksekusi unik")
) -> str:
    """
    Dependency untuk memvalidasi keberadaan header Idempotency-Key.
    
    🧠 CATATAN ARSITEKTUR:
    Aturan Besar #5: Semua request mutasi state WAJIB menyertakan Idempotency-Key.
    Hal ini mencegah transaksi ganda (double charge/double order) akibat jaringan putus,
    timeout, atau retry agresif dari mobile client / browser POS.
    """
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'Idempotency-Key' wajib disertakan untuk semua request mutasi state (Iron Rule #5)."
        )
    return idempotency_key.strip()
