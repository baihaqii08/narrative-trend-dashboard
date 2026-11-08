from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from app.api.dependencies import apply_date_filter, apply_platform_filter, parse_filter_days
from app.core.cache import ttl_cache
from app.core.database import SocialPost, get_db


router = APIRouter()

CACHE_TTL_SECONDS = 120
DEFAULT_TOPICS_LIMIT = 20
DEFAULT_TRENDING_TOPICS_LIMIT = 10
EXCLUDED_TOPIC_NAMES = ("Outlier / Topik Lainnya", "Unknown", "")


@router.get("")
@router.get("/")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_topics(
    platform: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    limit: int = DEFAULT_TOPICS_LIMIT,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    filter_days = parse_filter_days(days, timeframe)
    base_query = db.query(SocialPost)
    base_query = apply_platform_filter(base_query, platform)
    base_query = apply_date_filter(base_query, db, filter_days)

    topic_Stats = _query_topic_aggregates(base_query, limit)
    topic_names = [row.topic for row in topic_Stats if row.topic]
    sentiment_breakdown_by_topic = _query_topic_sentiment_breakdown(base_query, topic_names)

    return [
        _format_topic_record(row, sentiment_breakdown_by_topic.get(row.topic, {}))
        for row in topic_Stats
    ]


@router.get("/trending")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_trending_topics(
    platform: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    limit: int = DEFAULT_TRENDING_TOPICS_LIMIT,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    topics_list = get_topics(
        platform=platform,
        days=days,
        timeframe=timeframe,
        limit=limit,
        db=db,
    )
    for rank_index, topic_item in enumerate(topics_list):
        topic_item["rank"] = rank_index + 1
        topic_item["trend"] = "up"
    return topics_list


def _query_topic_aggregates(base_query, limit: int):
    total_engagement_expression = (
        func.coalesce(SocialPost.likes, 0)
        + func.coalesce(SocialPost.comments, 0)
        + func.coalesce(SocialPost.shares, 0)
    )
    return (
        base_query.with_entities(
            SocialPost.topic,
            func.count(SocialPost.id).label("post_count"),
            func.sum(total_engagement_expression).label("total_engagement"),
        )
        .filter(
            SocialPost.topic.isnot(None),
            ~SocialPost.topic.in_(EXCLUDED_TOPIC_NAMES),
        )
        .group_by(SocialPost.topic)
        .order_by(desc("post_count"))
        .limit(limit)
        .all()
    )


def _query_topic_sentiment_breakdown(
    base_query,
    topic_names: List[str],
) -> Dict[str, Dict[str, int]]:
    if not topic_names:
        return {}

    sentiment_rows = (
        base_query.with_entities(
            SocialPost.topic,
            func.lower(SocialPost.sentiment).label("sentiment"),
            func.count(SocialPost.id).label("sentiment_count"),
        )
        .filter(SocialPost.topic.in_(topic_names))
        .group_by(SocialPost.topic, func.lower(SocialPost.sentiment))
        .all()
    )

    breakdown_by_topic: Dict[str, Dict[str, int]] = {
        topic_name: {"positive": 0, "neutral": 0, "negative": 0}
        for topic_name in topic_names
    }
    for topic_name, sentiment_label, count_value in sentiment_rows:
        normalized_sentiment = (sentiment_label or "neutral").lower()
        if topic_name in breakdown_by_topic and normalized_sentiment in breakdown_by_topic[topic_name]:
            breakdown_by_topic[topic_name][normalized_sentiment] += int(count_value or 0)

    return breakdown_by_topic


def _format_topic_record(
    topic_row: Any,
    sentiment_counts: Dict[str, int],
) -> Dict[str, Any]:
    counts = sentiment_counts or {"positive": 0, "neutral": 0, "negative": 0}
    dominant_sentiment = max(counts, key=counts.get) if any(counts.values()) else "neutral"
    post_count = int(topic_row.post_count or 0)
    total_engagement = int(topic_row.total_engagement or 0)

    return {
        "topic": topic_row.topic,
        "name": topic_row.topic,
        "label": topic_row.topic,
        "count": post_count,
        "posts": post_count,
        "engagement": total_engagement,
        "dominant_sentiment": dominant_sentiment,
        "sentiment": counts,
    }
