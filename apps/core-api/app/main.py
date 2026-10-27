from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from app.core.config import get_settings
from app.api.v1.products import router as products_router
from app.api.v1.items import router as items_router
from app.api.v1.orders import router as orders_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.ai_drafts import router as ai_drafts_router
from app.api.v1.ai_training import router as ai_training_router
from app.api.internal.ai_tools import router as internal_ai_tools_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Unified AI-Powered Commerce Platform Core API (Modular Monolith)",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# CORS Middleware untuk mengizinkan request dari Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Di produksi, batasi hanya domain frontend yang sah
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(IntegrityError)
@app.exception_handler(DBAPIError)
@app.exception_handler(SQLAlchemyError)
async def db_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler untuk menangkap pelanggaran Row-Level Security (RLS) PostgreSQL.
    Mencegah crash server / pemutusan koneksi saat terjadi upaya penulisan silang (cross-tenant write).
    """
    error_msg = str(exc).lower()
    if (
        "row-level security" in error_msg
        or "row level security" in error_msg
        or "violates" in error_msg
        or "insufficientprivilege" in error_msg
        or "permission denied" in error_msg
    ):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Cross-tenant write operation blocked by RLS policy"}
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Database error occurred: {str(exc)}"}
    )

@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    """
    Endpoint pemantauan kesehatan servis API untuk load balancer dan monitoring k8s.
    """
    return {
        "status": "healthy",
        "service": "nexus-core-api",
        "environment": settings.ENVIRONMENT
    }

# Daftarkan Router Domain Bisnis (v1)
app.include_router(products_router, prefix="/api/v1")
app.include_router(items_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(ai_drafts_router, prefix="/api/v1")
app.include_router(ai_training_router, prefix="/api/v1")
app.include_router(internal_ai_tools_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
