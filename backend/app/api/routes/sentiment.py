from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.api.routes.dashboard import normalize_platform_filter, parse_filter_days
from app.core.cache import in_memory_cache
from models import Post, Topic


router = APIRouter(tags=["Sentiment"])

CACHE_TTL_SECONDS = 120
DEFAULT_POSTS_LIMIT = 50
DEFAULT_DOMINANT_TOPIC_NAME = "Program Makan Bergizi Gratis (MBG)"


@router.get("/posts")
def get_sentiment_posts(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    sentiment: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = DEFAULT_POSTS_LIMIT,
    skip: int = 0,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return paginated social posts filtered by sentiment, timeframe, and platform."""
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    post_query = _apply_time_and_platform_filters(
        db.query(Post),
        filter_days,
        platform_filter_list,
    )
    if sentiment and isinstance(sentiment, str) and sentiment.lower() != "all":
        post_query = post_query.filter(Post.sentiment == sentiment.lower())

    posts = post_query.order_by(Post.posted_at.desc()).offset(skip).limit(limit).all()
    return [serialize_post(post_item) for post_item in posts]


@router.get("/distribution")
@router.get("")
@router.get("/")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_sentiment_distribution(
    platform: Optional[str] = None,
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, int]:
    """Return sentiment count distribution filtered by platform and timeframe."""
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    distribution_query = _apply_time_and_platform_filters(
        db.query(Post.sentiment, func.count(Post.id)),
        filter_days,
        platform_filter_list,
    )
    grouped_counts = distribution_query.group_by(Post.sentiment).all()

    distribution = {"positive": 0, "neutral": 0, "negative": 0, "unlabeled": 0}
    for sentiment_label, post_count in grouped_counts:
        sentiment_key = sentiment_label.lower() if sentiment_label else "unlabeled"
        if sentiment_key in distribution:
            distribution[sentiment_key] += post_count
        else:
            distribution["unlabeled"] += post_count

    return distribution


@router.get("/timeline")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_sentiment_timeline(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return daily sentiment counts and dominant topic per date for the sentiment line chart."""
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    post_date_column = func.date(Post.posted_at).label("date")
    base_timeline_query = db.query(
        post_date_column,
        Post.sentiment,
        func.count(Post.id).label("count"),
    ).filter(Post.posted_at.isnot(None))

    filtered_timeline_query = _apply_time_and_platform_filters(
        base_timeline_query,
        filter_days,
        platform_filter_list,
    )
    daily_sentiment_rows = (
        filtered_timeline_query.group_by(post_date_column, Post.sentiment)
        .order_by(post_date_column)
        .all()
    )

    daily_dominant_topics = _query_daily_dominant_topics(
        db=db,
        post_date_column=post_date_column,
        filter_days=filter_days,
        platform_filter_list=platform_filter_list,
    )
    return _assemble_timeline_response(daily_sentiment_rows, daily_dominant_topics)


def serialize_post(post_item: Post) -> Dict[str, Any]:
    normalized_platform = _normalize_post_platform(post_item.platform)
    related_topic = getattr(post_item, "topic", None)
    topic_label = (
        related_topic.name
        if related_topic
        else (f"Topik #{post_item.topic_id}" if post_item.topic_id else "")
    )

    return {
        "id": str(post_item.id),
        "platform": normalized_platform,
        "original_platform": post_item.platform,
        "platform_post_id": post_item.platform_post_id,
        "author_username": post_item.author_username,
        "username": post_item.author_username,
        "author": post_item.author_username,
        "content": post_item.content,
        "text": post_item.content,
        "likes": post_item.likes or 0,
        "comments": post_item.comments or 0,
        "shares": post_item.shares or 0,
        "views": post_item.views or 0,
        "hashtags": post_item.hashtags or [],
        "sentiment": post_item.sentiment or "neutral",
        "sentiment_score": post_item.sentiment_score or 0.0,
        "topic": topic_label,
        "topic_id": post_item.topic_id,
        "posted_at": post_item.posted_at.isoformat() if post_item.posted_at else None,
        "created_at": post_item.created_at.isoformat() if post_item.created_at else None,
        "date": post_item.posted_at.strftime("%Y-%m-%d %H:%M:%S") if post_item.posted_at else None,
    }


def _normalize_post_platform(raw_platform: Optional[str]) -> str:
    if not raw_platform:
        return "x"
    lower_platform = raw_platform.lower()
    if lower_platform in ("twitter", "x"):
        return "x"
    if lower_platform in ("instagram", "ig"):
        return "instagram"
    return raw_platform


def _apply_time_and_platform_filters(
    query,
    filter_days: Optional[int],
    platform_filter_list: Optional[List[str]],
):
    if filter_days:
        cutoff_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= cutoff_date)
    if platform_filter_list:
        query = query.filter(Post.platform.in_(platform_filter_list))
    return query


def _query_daily_dominant_topics(
    db: Session,
    post_date_column,
    filter_days: Optional[int],
    platform_filter_list: Optional[List[str]],
) -> Dict[str, str]:
    daily_topics: Dict[str, str] = {}
    try:
        topic_query = (
            db.query(post_date_column, Topic.name, func.count(Post.id))
            .join(Topic, Post.topic_id == Topic.id)
            .filter(Post.posted_at.isnot(None))
        )
        topic_query = _apply_time_and_platform_filters(
            topic_query,
            filter_days,
            platform_filter_list,
        )
        topic_rows = (
            topic_query.group_by(post_date_column, Topic.name)
            .order_by(post_date_column, func.count(Post.id).desc())
            .all()
        )
        for date_value, topic_name, _ in topic_rows:
            date_key = str(date_value) if date_value else "unknown"
            if date_key not in daily_topics:
                daily_topics[date_key] = topic_name
    except Exception:
        return {}
    return daily_topics


def _assemble_timeline_response(
    daily_sentiment_rows: List[Any],
    daily_dominant_topics: Dict[str, str],
) -> List[Dict[str, Any]]:
    timeline_by_date: Dict[str, Dict[str, Any]] = {}
    for date_value, sentiment_label, count_value in daily_sentiment_rows:
        date_key = str(date_value) if date_value else "unknown"
        dominant_topic = daily_dominant_topics.get(date_key, DEFAULT_DOMINANT_TOPIC_NAME)

        if date_key not in timeline_by_date:
            timeline_by_date[date_key] = {
                "date": date_key,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "total": 0,
                "dominant_topic": dominant_topic,
                "topPositiveTopic": dominant_topic,
                "topNeutralTopic": dominant_topic,
                "topNegativeTopic": dominant_topic,
                "top_positive_topic": dominant_topic,
                "top_neutral_topic": dominant_topic,
                "top_negative_topic": dominant_topic,
            }

        sentiment_key = sentiment_label.lower() if sentiment_label else "unlabeled"
        if sentiment_key in timeline_by_date[date_key]:
            timeline_by_date[date_key][sentiment_key] += count_value
        timeline_by_date[date_key]["total"] += count_value

    return list(timeline_by_date.values())
