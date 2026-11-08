import os
from typing import List, Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


NEO4J_CONNECTION_TIMEOUT_SECONDS = 6
FALLBACK_SQLITE_FILENAME = "narrative_db.sqlite"
DEFAULT_NEO4J_CANDIDATE_URIS = (
    settings.NEO4J_URI,
    "bolt://100.91.60.119:7687",
    "bolt://localhost:7687",
)


def _initialize_database_engine() -> Engine:
    database_url = settings.DATABASE_URL
    if "sqlite" in database_url.lower():
        return create_engine(database_url, connect_args={"check_same_thread": False})

    try:
        postgres_engine = create_engine(database_url, pool_pre_ping=True)
        with postgres_engine.connect():
            pass
        return postgres_engine
    except Exception:
        return _create_local_sqlite_fallback_engine()


def _create_local_sqlite_fallback_engine() -> Engine:
    backend_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sqlite_file_path = os.path.join(backend_root_dir, FALLBACK_SQLITE_FILENAME)
    sqlite_url = f"sqlite:///{sqlite_file_path}"
    print(f"[DATABASE] Menggunakan SQLite lokal: {sqlite_file_path}")
    return create_engine(sqlite_url, connect_args={"check_same_thread": False})


def _build_unique_neo4j_uris() -> List[str]:
    seen_uris = set()
    unique_uris: List[str] = []
    for candidate_uri in DEFAULT_NEO4J_CANDIDATE_URIS:
        if candidate_uri and candidate_uri not in seen_uris:
            seen_uris.add(candidate_uri)
            unique_uris.append(candidate_uri)
    return unique_uris


engine = _initialize_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

neo4j_driver = None
candidate_uris = _build_unique_neo4j_uris()


def get_neo4j_driver():
    global neo4j_driver
    if neo4j_driver is not None:
        return neo4j_driver

    for candidate_uri in candidate_uris:
        connected_driver = _try_connect_neo4j_uri(candidate_uri)
        if connected_driver is not None:
            neo4j_driver = connected_driver
            print(f"[NEO4J] Berhasil terhubung ke Neo4j Knowledge Graph di: {candidate_uri}")
            return neo4j_driver

    return None


def _try_connect_neo4j_uri(candidate_uri: str) -> Optional[object]:
    try:
        from neo4j import GraphDatabase

        auth_credentials = (
            (settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            if settings.NEO4J_PASSWORD
            else None
        )
        candidate_driver = GraphDatabase.driver(
            candidate_uri,
            auth=auth_credentials,
            connection_timeout=NEO4J_CONNECTION_TIMEOUT_SECONDS,
        )
        candidate_driver.verify_connectivity()
        return candidate_driver
    except Exception:
        return None


get_neo4j_driver()
if not neo4j_driver:
    print(
        "[NEO4J] Port 7687 belum aktif atau tidak dapat dijangkau. "
        "Knowledge Graph akan menggunakan data fallback."
    )
