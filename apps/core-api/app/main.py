import sys
import os
from importlib.abc import MetaPathFinder
from importlib.util import spec_from_file_location

class PurePythonSQLAlchemyFinder(MetaPathFinder):
    """
    Bypasses Windows Application Control / Smart App Control policy
    which blocks unsigned .pyd binaries in SQLAlchemy by transparently falling
    back to SQLAlchemy's built-in pure Python implementations.
    """
    def find_spec(self, fullname, path, target=None):
        if fullname.startswith("sqlalchemy.") and fullname.endswith("_cy"):
            if path:
                mod_name = fullname.split(".")[-1]
                for p in path:
                    py_file = os.path.join(p, mod_name + ".py")
                    if os.path.isfile(py_file):
                        return spec_from_file_location(fullname, py_file)
        return None

if not any(isinstance(f, PurePythonSQLAlchemyFinder) for f in sys.meta_path):
    sys.meta_path.insert(0, PurePythonSQLAlchemyFinder())

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
from app.api.v1.data_import import router as import_router
from app.api.v1.repair_tickets import router as repair_tickets_router
from app.api.v1.accounting import router as accounting_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.crm import router as crm_router
from app.api.v1.marketing import router as marketing_router
from app.api.v1.csuite_telegram import router as csuite_telegram_router
from app.api.v1.simulator import router as simulator_router
from app.api.v1.whatsapp_bot import router as whatsapp_bot_router
from app.api.v1.control_plane_api import router as control_plane_router
from app.api.v1.shifts import router as shifts_router
from app.api.v1.marketplace_webhook import router as marketplace_webhook_router
from app.api.v1.auth import router as auth_router
from app.api.v1.team import router as team_router
from app.api.v1.ecommerce import router as ecommerce_router
from app.api.v1.video_studio import router as video_studio_router
from app.api.v1.publishing import router as publishing_router
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
app.include_router(import_router, prefix="/api/v1")
app.include_router(repair_tickets_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(intelligence_router, prefix="/api/v1")
app.include_router(crm_router, prefix="/api/v1")
app.include_router(marketing_router, prefix="/api/v1")
app.include_router(csuite_telegram_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/v1")
app.include_router(whatsapp_bot_router, prefix="/api/v1")
app.include_router(control_plane_router, prefix="/api/v1")
app.include_router(shifts_router, prefix="/api/v1")
app.include_router(marketplace_webhook_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(ecommerce_router, prefix="/api/v1")
app.include_router(video_studio_router, prefix="/api/v1")
app.include_router(publishing_router, prefix="/api/v1")
app.include_router(internal_ai_tools_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
