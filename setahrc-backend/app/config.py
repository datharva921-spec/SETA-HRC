import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SETA-HRC Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database configuration - defaults to MySQL but falls back to SQLite if MySQL is unavailable
    # Set DATABASE_URL=mysql+pymysql://root:password@localhost:3306/seta_hrc in .env
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:root@localhost:3306/seta_hrc"
    )
    # When testing or running without local MySQL daemon, enable fallback
    SQLITE_FALLBACK: bool = True
    
    # JWT Auth
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "seta_hrc_super_secret_jwt_key_2026_safe_demo")
    JWT_SECRET_KEY: str = "seta_hrc_super_secret_jwt_key_2026_safe_demo"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Server configuration
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    RELOAD: bool = True

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "*"
    ]

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
