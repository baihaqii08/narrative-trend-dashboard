import uuid
import json
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, MetaData, Float, Boolean, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import declarative_base
from datetime import datetime

metadata = MetaData()
Base = declarative_base(metadata=metadata)

class CompatibleArray(TypeDecorator):
    """Mendukung ARRAY di PostgreSQL dan JSON Text di SQLite"""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(Text))
        return dialect.type_descriptor(Text)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        if dialect.name == 'postgresql':
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return [v.strip() for v in value.split(',') if v.strip()]
        return value

class CompatibleUUID(TypeDecorator):
    """Mendukung UUID native di PostgreSQL dan String(36) di SQLite"""
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        try:
            return uuid.UUID(str(value))
        except Exception:
            return str(value)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Topic(Base):
    __tablename__ = 'topics'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    keywords = Column(CompatibleArray, nullable=True)
    post_count = Column(Integer, default=0)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)

class Entity(Base):
    __tablename__ = 'entities'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False) # e.g., 'person', 'organization', 'location', 'event'
    mention_count = Column(Integer, default=0)

class Post(Base):
    __tablename__ = 'posts'
    id = Column(CompatibleUUID, primary_key=True, default=uuid.uuid4)
    platform = Column(String(50), nullable=False, index=True) # 'twitter', 'tiktok', 'instagram'
    platform_post_id = Column(String(100), nullable=False, unique=True)
    author_username = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    views = Column(Integer, default=0)
    hashtags = Column(CompatibleArray, nullable=True)
    posted_at = Column(DateTime, nullable=True, index=True)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    sentiment = Column(String(20), nullable=True, index=True) # 'positive', 'negative', 'neutral'
    sentiment_score = Column(Float, nullable=True)
    topic_id = Column(Integer, ForeignKey('topics.id'), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
