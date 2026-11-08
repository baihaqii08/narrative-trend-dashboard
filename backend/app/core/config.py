from typing import Optional
from pydantic_settings import BaseSettings


DEFAULT_API_V1_PREFIX = "/api/v1"
DEFAULT_PROJECT_NAME = "NoLimit Narrative & Trend Analysis API"
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
DEFAULT_NEO4J_URI = "bolt://100.91.60.119:7687"
DEFAULT_NEO4J_USER = "neo4j"
DEFAULT_NEO4J_PASSWORD = "password123"
DEFAULT_POSTGRES_URL = "postgresql://postgres:password@localhost:5432/narrative_trend_db"
DEFAULT_SECRET_KEY = "SUPER_SECRET_KEY_FOR_DEV_ONLY_CHANGE_IN_PROD"


class Settings(BaseSettings):
    PROJECT_NAME: str = DEFAULT_PROJECT_NAME
    API_V1_STR: str = DEFAULT_API_V1_PREFIX
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES

    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_PORT: Optional[str] = "5432"
    POSTGRES_DB: Optional[str] = None
    DATABASE_URL: Optional[str] = None

    NEO4J_URI: str = DEFAULT_NEO4J_URI
    NEO4J_USER: str = DEFAULT_NEO4J_USER
    NEO4J_PASSWORD: str = DEFAULT_NEO4J_PASSWORD

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.POSTGRES_SERVER and self.POSTGRES_USER and self.POSTGRES_DB:
            return (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return DEFAULT_POSTGRES_URL

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
