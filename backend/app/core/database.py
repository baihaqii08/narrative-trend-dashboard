from datetime import datetime
from typing import Generator, Optional
from neo4j import Driver, GraphDatabase
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import settings


NEO4J_CONNECTION_TIMEOUT_SECONDS = 6
NEO4J_ACQUISITION_TIMEOUT_SECONDS = 6


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)


class SocialPost(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, index=True)
    platform = Column(String, index=True)
    author = Column(String, index=True)
    text_content = Column("content", Text)
    cleaned_content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    views = Column(Integer, default=0)
    url = Column(String, nullable=True)
    sentiment = Column(String, index=True)
    topic = Column(String, index=True)
    entities = Column(Text, nullable=True)


engine = create_engine(settings.sync_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    database_session = SessionLocal()
    try:
        yield database_session
    finally:
        database_session.close()


class Neo4jConnection:
    def __init__(self) -> None:
        self.driver: Optional[Driver] = _initialize_neo4j_driver()

    def close(self) -> None:
        if self.driver is not None:
            self.driver.close()

    def get_session(self):
        if self.driver is not None:
            return self.driver.session()
        return None


def _initialize_neo4j_driver() -> Optional[Driver]:
    try:
        return GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            connection_timeout=NEO4J_CONNECTION_TIMEOUT_SECONDS,
            connection_acquisition_timeout=NEO4J_ACQUISITION_TIMEOUT_SECONDS,
            max_transaction_retry_time=2,
        )
    except Exception as connection_error:
        print(f"Failed to create Neo4j driver: {connection_error}")
        return None


neo4j_conn = Neo4jConnection()


def get_neo4j():
    neo4j_session = neo4j_conn.get_session()
    try:
        yield neo4j_session
    finally:
        if neo4j_session is not None:
            neo4j_session.close()
