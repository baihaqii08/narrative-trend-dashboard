import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_ENV_FILE_PATH = os.path.join(BACKEND_ROOT_DIR, ".env")

MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24
TOKEN_EXPIRE_DAYS = 8
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = MINUTES_PER_HOUR * HOURS_PER_DAY * TOKEN_EXPIRE_DAYS


class Settings(BaseSettings):
    PROJECT_NAME: str = "Medallion Data Pipeline API"
    API_V1_STR: str = "/api"

    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/narrative_db",
    )
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "")

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=(BACKEND_ENV_FILE_PATH, ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )


settings = Settings()
