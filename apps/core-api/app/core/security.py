from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from fastapi import Request, HTTPException, status
from jose import jwt, JWTError
from app.core.config import get_settings

settings = get_settings()

async def get_current_tenant_id(request: Request) -> UUID:
    """
    Mock Tenant Resolver untuk Fase 1-4 (sebelum Supabase Auth JWT diterapkan).
    
    Membaca identitas tenant dari request header 'X-Tenant-ID'.
    Header ini merepresentasikan tenant yang sedang aktif mengakses platform.
    
    Validasi:
    1. Jika header tidak ada -> 401 Unauthorized (Fail-Closed).
    2. Jika format bukan UUID valid -> 400 Bad Request.
    """
    raw_tenant_id = request.headers.get("X-Tenant-ID") or request.headers.get("x-tenant-id")
    
    if not raw_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header 'X-Tenant-ID' wajib disertakan untuk autentikasi tenant."
        )
    
    try:
        return UUID(raw_tenant_id.strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format 'X-Tenant-ID' tidak valid. Wajib berupa format UUID."
        )

def create_service_token(
    tenant_id: UUID,
    role: str = "ai_worker",
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Membuat Service Token (JWT) yang ditandatangani secara kriptografis oleh server.
    
    🧠 CATATAN ARSITEKTUR KEAMANAN:
    AI Worker (Zona B) TIDAK BOLEH mengirim `tenant_id` lewat URL query parameter.
    Semua komunikasi RPC/Typed Tools mewajibkan Service Token bertanda tangan digital.
    Hal ini mencegah spoofing identitas tenant atau kebocoran data antar-tenant.
    """
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    payload = {
        "sub": str(tenant_id),
        "tenant_id": str(tenant_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

async def get_ai_service_tenant_id(request: Request) -> UUID:
    """
    Dependency FastAPI untuk Typed Tools API (Zona B -> Zona A).
    
    Mengekstrak dan memverifikasi identitas tenant dari Header Authorization Bearer JWT.
    
    Validasi Keamanan:
    1. Header Authorization wajib ada dan berformat 'Bearer <token>' -> 401 Unauthorized
    2. Signature JWT diverifikasi menggunakan JWT_SECRET_KEY dan HS256 -> 401 Unauthorized
    3. Payload wajib memuat klaim 'tenant_id' berformat UUID valid -> 403 Forbidden
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header 'Authorization: Bearer <token>' wajib disertakan untuk Service Tools."
        )
    
    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Service Token tidak valid, kedaluwarsa, atau tanda tangan tidak cocok."
        )
    
    raw_tenant_id = payload.get("tenant_id") or payload.get("sub")
    if not raw_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Klaim 'tenant_id' tidak ditemukan dalam payload Service Token."
        )
    
    try:
        return UUID(str(raw_tenant_id).strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Format 'tenant_id' di dalam Service Token tidak valid."
        )

def verify_membership(tenant_id: UUID, user_id: UUID) -> bool:
    """
    Mock verifikasi keanggotaan user di dalam tenant.
    """
    if not tenant_id or not user_id:
        return False
    return True
