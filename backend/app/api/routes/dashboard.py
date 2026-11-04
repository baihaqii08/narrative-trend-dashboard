from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import Optional, Any

from app.api.dependencies import get_db
from models import Post, Topic, Entity
from app.core.cache import in_memory_cache

router = APIRouter()

def parse_filter_days(days: Optional[Any] = None, time_filter: Optional[str] = None) -> Optional[int]:
    """
    Sanitasi pintar untuk parameter hari:
    Mendukung integer, string angka, -1 (all time), 0 (all time), 'all', 'null', dll.
    """
    filter_days = None
    if days is not None:
        try:
            d_val = str(days).strip().lower()
            if d_val in ["all", "null", "undefined", "none", "sepanjang_waktu", "all_time"]:
                filter_days = None
            else:
                d_int = int(float(d_val))
                if d_int > 0:
                    filter_days = d_int
                else:
                    filter_days = None
        except (ValueError, TypeError):
            filter_days = None

    if not filter_days and time_filter and isinstance(time_filter, str):
        tf = time_filter.strip().lower()
        if "7" in tf:
            filter_days = 7
        elif "30" in tf:
            filter_days = 30
        elif any(w in tf for w in ["all", "sepanjang", "total", "ever"]):
            filter_days = None

    return filter_days

@router.get("/overview")
@in_memory_cache(ttl_seconds=120)
def get_dashboard_overview(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Mengambil data agregasi total untuk ringkasan dashboard (KPI).
    Dioptimasi ke 1 kueri agregasi tunggal + in-memory cache 120 detik.
    """
    query = db.query(Post)
    filter_days = parse_filter_days(days, time_filter)

    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)

    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    stats = query.with_entities(
        func.count(Post.id).label("total_posts"),
        func.sum(Post.likes).label("total_likes"),
        func.sum(Post.comments).label("total_comments"),
        func.sum(Post.shares).label("total_shares"),
        func.sum(Post.views).label("total_views"),
        func.count(Post.id).filter(Post.sentiment == 'neutral').label("neutral_count"),
        func.count(Post.id).filter(Post.sentiment == 'positive').label("positive_count"),
        func.count(Post.id).filter(Post.sentiment == 'negative').label("negative_count")
    ).first()
    
    total_posts = (stats.total_posts if stats else 0) or 0
    total_likes = (stats.total_likes if stats else 0) or 0
    total_comments = (stats.total_comments if stats else 0) or 0
    total_shares = (stats.total_shares if stats else 0) or 0
    total_views = (stats.total_views if stats else 0) or 0
    neutral_count = (stats.neutral_count if stats else 0) or 0
    positive_count = (stats.positive_count if stats else 0) or 0
    negative_count = (stats.negative_count if stats else 0) or 0
    
    total_topics = db.query(func.count(Topic.id)).scalar() or 0
    unique_entities = db.query(func.count(Entity.id)).scalar() or 0
    
    neutral_share = round((neutral_count / total_posts * 100), 1) if total_posts > 0 else 0.0
    positive_share = round((positive_count / total_posts * 100), 1) if total_posts > 0 else 0.0
    negative_share = round((negative_count / total_posts * 100), 1) if total_posts > 0 else 0.0
    total_engagement = total_likes + total_comments + total_shares
    
    # Ambil top topic riil dari DB
    top_t = db.query(Topic).order_by(Topic.post_count.desc()).first()
    dominant_topic_name = top_t.name if top_t else "Program Makan Bergizi Gratis (MBG)"

    kpi_dict = {
        "total_posts": total_posts,
        "total_topics": total_topics,
        "trending_topics": total_topics,
        "total_engagement": total_engagement,
        "unique_entities": unique_entities,
        "total_entities": unique_entities,
        "neutral_share": neutral_share,
        "positive_share": positive_share,
        "negative_share": negative_share,
        "dominant_sentiment": "neutral",
        "dominant_topic": dominant_topic_name,
        "top_positive_topic": dominant_topic_name,
        "top_neutral_topic": dominant_topic_name,
        "top_negative_topic": dominant_topic_name
    }
    
    return {
        "kpi": kpi_dict,
        "total_posts": total_posts,
        "total_topics": total_topics,
        "trending_topics": total_topics,
        "total_engagement": total_engagement,
        "unique_entities": unique_entities,
        "total_entities": unique_entities,
        "neutral_share": neutral_share,
        "positive_share": positive_share,
        "negative_share": negative_share,
        "dominant_sentiment": "neutral",
        "dominant_topic": dominant_topic_name,
        "top_positive_topic": dominant_topic_name,
        "top_neutral_topic": dominant_topic_name,
        "top_negative_topic": dominant_topic_name,
        "breakdown": {
            "likes": total_likes,
            "comments": total_comments,
            "shares": total_shares,
            "views": total_views
        }
    }

@router.get("/timeline")
@in_memory_cache(ttl_seconds=120)
def get_dashboard_timeline(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Mengambil data jumlah post harian untuk dirender di Line Chart.
    """
    filter_days = parse_filter_days(days, time_filter)

    date_col = func.date(Post.posted_at).label("date")
    query = db.query(
        date_col,
        func.count(Post.id).label("count")
    ).filter(Post.posted_at.isnot(None))

    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)

    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    daily_stats = query.group_by(date_col).order_by(date_col).all()
    timeline = [{"date": str(stat.date), "count": stat.count} for stat in daily_stats]
    
    return {
        "days_requested": filter_days or "all",
        "timeline": timeline,
        "total_posts": sum(stat.count for stat in daily_stats)
    }

@router.get("/sentiment")
@in_memory_cache(ttl_seconds=120)
def get_dashboard_sentiment(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db)
):
    filter_days = parse_filter_days(days, time_filter)

    query = db.query(
        Post.sentiment,
        func.count(Post.id).label("count")
    )

    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= start_date)

    if platform and isinstance(platform, str) and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    sentiment_counts = query.group_by(Post.sentiment).all()
    
    distribution = {
        "positive": 0,
        "neutral": 0,
        "negative": 0,
        "unlabeled": 0
    }
    
    for stat in sentiment_counts:
        key = stat.sentiment.lower() if stat.sentiment else "unlabeled"
        if key in distribution:
            distribution[key] += stat.count
        else:
            distribution["unlabeled"] += stat.count
            
    return distribution

@router.get("/topics")
@in_memory_cache(ttl_seconds=120)
def get_dashboard_topics(limit: int = 10, db: Session = Depends(get_db)):
    top_topics = db.query(Topic).order_by(Topic.post_count.desc()).limit(limit).all()
    
    topics_list = [
        {
            "id": t.id,
            "name": t.name,
            "post_count": t.post_count,
            "keywords": t.keywords
        }
        for t in top_topics
    ]
    
    return {
        "limit": limit,
        "trending_topics": topics_list
    }
