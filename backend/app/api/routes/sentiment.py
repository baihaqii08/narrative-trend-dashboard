from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, Date
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from app.api.dependencies import get_db
from models import Post
from app.core.cache import in_memory_cache
from app.api.routes.dashboard import parse_filter_days

router = APIRouter(tags=["Sentiment"])

def serialize_post(p: Post) -> Dict[str, Any]:
    return {
        "id": str(p.id),
        "platform": p.platform,
        "platform_post_id": p.platform_post_id,
        "author_username": p.author_username,
        "username": p.author_username,
        "author": p.author_username,
        "content": p.content,
        "text": p.content,
        "likes": p.likes or 0,
        "comments": p.comments or 0,
        "shares": p.shares or 0,
        "views": p.views or 0,
        "hashtags": p.hashtags or [],
        "sentiment": p.sentiment or "neutral",
        "sentiment_score": p.sentiment_score or 0.0,
        "posted_at": p.posted_at.isoformat() if p.posted_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "date": p.posted_at.strftime("%Y-%m-%d %H:%M:%S") if p.posted_at else None
    }

@router.get("/posts")
def get_sentiment_posts(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    sentiment: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db)
):
    """
    12.3: Daftar post dengan filter sentimen, waktu, dan platform.
    """
    query = db.query(Post)
    filter_days = parse_filter_days(days, time_filter)
            
    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)
        
    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    if sentiment and isinstance(sentiment, str) and sentiment.lower() != "all":
        query = query.filter(Post.sentiment == sentiment.lower())
        
    posts = query.order_by(Post.posted_at.desc()).offset(skip).limit(limit).all()
    serialized = [serialize_post(p) for p in posts]
    return serialized

@router.get("/distribution")
@router.get("")
@router.get("/")
@in_memory_cache(ttl_seconds=120)
def get_sentiment_distribution(
    platform: Optional[str] = None,
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    12.3: Distribusi sentimen (filterable by platform, date).
    """
    query = db.query(Post.sentiment, func.count(Post.id))
    filter_days = parse_filter_days(days, time_filter)
            
    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)

    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    counts = query.group_by(Post.sentiment).all()
    dist = {"positive": 0, "neutral": 0, "negative": 0, "unlabeled": 0}
    for s, c in counts:
        k = s.lower() if s else "unlabeled"
        if k in dist:
            dist[k] += c
        else:
            dist["unlabeled"] += c
    return dist

@router.get("/timeline")
@in_memory_cache(ttl_seconds=120)
def get_sentiment_timeline(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    12.3: Sentimen per hari untuk visualisasi line chart sentimen.
    Mendukung filter waktu (days, time_filter) dan platform.
    """
    filter_days = parse_filter_days(days, time_filter)

    query = db.query(
        cast(Post.posted_at, Date).label("date"),
        Post.sentiment,
        func.count(Post.id).label("count")
    ).filter(Post.posted_at.isnot(None))

    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)

    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    stats = query.group_by(cast(Post.posted_at, Date), Post.sentiment).order_by(cast(Post.posted_at, Date)).all()

    timeline_dict: Dict[str, Dict[str, Any]] = {}
    for date_val, sent, count in stats:
        d_str = str(date_val) if date_val else "unknown"
        if d_str not in timeline_dict:
            timeline_dict[d_str] = {"date": d_str, "positive": 0, "neutral": 0, "negative": 0, "total": 0}
        s_key = sent.lower() if sent else "unlabeled"
        if s_key in timeline_dict[d_str]:
            timeline_dict[d_str][s_key] += count
        timeline_dict[d_str]["total"] += count

    return list(timeline_dict.values())
