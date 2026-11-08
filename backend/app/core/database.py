import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Database Engine Initialization
db_url = settings.DATABASE_URL
connect_args = {}

if "sqlite" in db_url.lower():
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
else:
    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
    except Exception:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        sqlite_path = os.path.join(backend_dir, "narrative_db.sqlite")
        db_url = f"sqlite:///{sqlite_path}"
        connect_args = {"check_same_thread": False}
        engine = create_engine(db_url, connect_args=connect_args)
        print(f"[DATABASE] Menggunakan SQLite lokal: {sqlite_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Neo4J Driver Initialization for Port 7687
neo4j_driver = None
neo4j_uris = [
    settings.NEO4J_URI,
    "bolt://100.91.60.119:7687",
    "bolt://localhost:7687"
]

# Singkirkan duplikat URI
seen_uris = set()
candidate_uris = []
for u in neo4j_uris:
    if u and u not in seen_uris:
        seen_uris.add(u)
        candidate_uris.append(u)

def get_neo4j_driver():
    global neo4j_driver
    if neo4j_driver is not None:
        return neo4j_driver
    for uri in candidate_uris:
        try:
            from neo4j import GraphDatabase
            auth = (settings.NEO4J_USER, settings.NEO4J_PASSWORD) if settings.NEO4J_PASSWORD else None
            candidate_driver = GraphDatabase.driver(uri, auth=auth, connection_timeout=6)
            candidate_driver.verify_connectivity()
            neo4j_driver = candidate_driver
            print(f"[NEO4J] Berhasil terhubung ke Neo4j Knowledge Graph di: {uri}")
            return neo4j_driver
        except Exception:
            pass
    return None

get_neo4j_driver()
if not neo4j_driver:
    print("[NEO4J] Port 7687 belum aktif atau tidak dapat dijangkau. Knowledge Graph akan menggunakan data fallback.")
