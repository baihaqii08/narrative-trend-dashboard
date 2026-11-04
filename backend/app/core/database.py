import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine Initialization with graceful fallback
db_url = settings.DATABASE_URL
connect_args = {}

if "sqlite" in db_url.lower():
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
else:
    try:
        # Coba koneksi ke PostgreSQL
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
    except Exception:
        # Jika PostgreSQL lokal tidak aktif, gunakan SQLite portable lokal
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        sqlite_path = os.path.join(backend_dir, "narrative_db.sqlite")
        db_url = f"sqlite:///{sqlite_path}"
        connect_args = {"check_same_thread": False}
        engine = create_engine(db_url, connect_args=connect_args)
        print(f"[DATABASE] Menggunakan SQLite lokal: {sqlite_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Neo4J Driver (Safe Initialization)
neo4j_driver = None
if settings.NEO4J_URI and settings.NEO4J_PASSWORD:
    try:
        from neo4j import GraphDatabase
        neo4j_auth = (settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        neo4j_driver = GraphDatabase.driver(settings.NEO4J_URI, auth=neo4j_auth)
    except Exception:
        neo4j_driver = None
