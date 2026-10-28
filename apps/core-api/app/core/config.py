import re
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Konfigurasi sentral aplikasi Nexus Core OS API.
    Membaca variabel lingkungan dari .env dengan fallback yang aman.
    """
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Nexus Core OS - API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # URL Database PostgreSQL
    # Default URL mengarah ke instance Supabase Cloud
    DATABASE_URL: str = "postgresql://postgres:Abogoboga_123@db.voehloiidblencegbews.supabase.co:5432/postgres"
    
    # Secret key untuk verifikasi token JWT
    JWT_SECRET_KEY: str = "nexus-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"

    # Groq Cloud AI API Key
    GROQ_API_KEY: str = ""

    @property
    def database_url(self) -> str:
        """Alias huruf kecil untuk kompatibilitas kode pengujian."""
        return self.DATABASE_URL

    @property
    def async_database_url(self) -> str:
        """
        Menjamin URL database menggunakan driver asyncpg untuk async SQLAlchemy.
        Juga menangani pembersihan kurung siku jika user menuliskannya secara harfiah.
        """
        url = self.DATABASE_URL
        # Bersihkan format [password] jika tertulis dengan kurung siku
        url = re.sub(r':\[(.*?)\]@', r':\1@', url)

        # Ubah scheme standar postgresql:// menjadi postgresql+asyncpg://
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

@lru_cache()
def get_settings() -> Settings:
    return Settings()
