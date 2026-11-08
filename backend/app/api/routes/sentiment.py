from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.dependencies import apply_date_filter, apply_platform_filter, parse_filter_days
from app.core.cache import ttl_cache
from app.core.database import SocialPost, get_db


router = APIRouter()

CACHE_TTL_SECONDS = 120
PERCENTAGE_MULTIPLIER = 100
EXCLUDED_TOPIC_NAMES = ("Outlier / Topik Lainnya", "Unknown", "")


@router.get("")
@router.get("/")
@router.get("/summary")
@router.get("/distribution")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_sentiment_distribution(
    platform: Optional[str] = Query(None, description="Filter by platform: instagram, x"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    days: Optional[str] = Query(None, description="Filter by past N days"),
    timeframe: Optional[str] = Query(None, description="Alias for days"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    filter_days = parse_filter_days(days, timeframe)
    query = _build_sentiment_filtered_query(db, platform, topic, filter_days)
    sentiment_counts = _aggregate_sentiment_counts(query)
    total_posts = sum(sentiment_counts.values())
    sentiment_percentages = _compute_sentiment_percentages(sentiment_counts, total_posts)

    return {
        "total": total_posts,
        "counts": sentiment_counts,
        "percentages": sentiment_percentages,
        "positive": sentiment_counts["positive"],
        "neutral": sentiment_counts["neutral"],
        "negative": sentiment_counts["negative"],
        "positive_pct": sentiment_percentages["positive"],
        "neutral_pct": sentiment_percentages["neutral"],
        "negative_pct": sentiment_percentages["negative"],
    }


@router.get("/timeline")
@router.get("/trend")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_sentiment_timeline(
    platform: Optional[str] = Query(None, description="Filter by platform"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    days: Optional[str] = Query(None, description="Number of past days"),
    timeframe: Optional[str] = Query(None, description="Alias for days"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    filter_days = parse_filter_days(days, timeframe)
    query = _build_sentiment_filtered_query(db, platform, topic, filter_days)
    date_column = func.date(SocialPost.created_at)

    daily_sentiment_rows = (
        query.with_entities(
            date_column.label("post_date"),
            func.lower(SocialPost.sentiment).label("sentiment"),
            func.count(SocialPost.id).label("post_count"),
        )
        .filter(SocialPost.created_at.isnot(None))
        .group_by(date_column, func.lower(SocialPost.sentiment))
        .order_by(date_column.asc())
        .all()
    )

    dominant_topic_by_date_and_sentiment = _query_daily_dominant_topics(query, date_column)
    return _assemble_timeline_points(daily_sentiment_rows, dominant_topic_by_date_and_sentiment)


def _build_sentiment_filtered_query(
    db: Session,
    platform: Optional[str],
    topic: Optional[str],
    filter_days: Optional[int],
):
    query = db.query(SocialPost)
    query = apply_platform_filter(query, platform)
    query = apply_date_filter(query, db, filter_days)
    if topic and topic.lower() not in ("all", "semua"):
        query = query.filter(SocialPost.topic.ilike(f"%{topic}%"))
    return query


def _aggregate_sentiment_counts(query) -> Dict[str, int]:
    grouped_rows = (
        query.with_entities(
            func.lower(SocialPost.sentiment).label("sentiment"),
            func.count(SocialPost.id).label("post_count"),
        )
        .group_by(func.lower(SocialPost.sentiment))
        .all()
    )

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for sentiment_label, post_count in grouped_rows:
        normalized_key = (sentiment_label or "neutral").lower()
        if normalized_key in sentiment_counts:
            sentiment_counts[normalized_key] += int(post_count or 0)
        else:
            sentiment_counts["neutral"] += int(post_count or 0)
    return sentiment_counts


def _compute_sentiment_percentages(
    sentiment_counts: Dict[str, int],
    total_posts: int,
) -> Dict[str, float]:
    divisor = total_posts if total_posts > 0 else 1
    return {
        sentiment_key: round((count_value / divisor) * PERCENTAGE_MULTIPLIER, 1)
        for sentiment_key, count_value in sentiment_counts.items()
    }


def _query_daily_dominant_topics(query, date_column) -> Dict[str, Dict[str, str]]:
    dominant_topics: Dict[str, Dict[str, str]] = {}
    try:
        topic_rows = (
            query.with_entities(
                date_column.label("post_date"),
                func.lower(SocialPost.sentiment).label("sentiment"),
                SocialPost.topic,
                func.count(SocialPost.id).label("topic_count"),
            )
            .filter(
                SocialPost.created_at.isnot(None),
                SocialPost.topic.isnot(None),
                ~SocialPost.topic.in_(EXCLUDED_TOPIC_NAMES),
            )
            .group_by(date_column, func.lower(SocialPost.sentiment), SocialPost.topic)
            .order_by(date_column.asc(), func.count(SocialPost.id).desc())
            .all()
        )
        for post_date, sentiment_label, topic_name, _ in topic_rows:
            date_key = str(post_date)
            sentiment_key = (sentiment_label or "neutral").lower()
            if date_key not in dominant_topics:
                dominant_topics[date_key] = {}
            if sentiment_key not in dominant_topics[date_key]:
                dominant_topics[date_key][sentiment_key] = topic_name
    except Exception:
        return {}
    return dominant_topics


def _assemble_timeline_points(
    daily_sentiment_rows: List[Any],
    dominant_topic_by_date_and_sentiment: Dict[str, Dict[str, str]],
) -> List[Dict[str, Any]]:
    timeline_by_date: Dict[str, Dict[str, Any]] = {}
    for post_date, sentiment_label, post_count in daily_sentiment_rows:
        date_string = str(post_date)
        if date_string not in timeline_by_date:
            daily_topics = dominant_topic_by_date_and_sentiment.get(date_string, {})
            timeline_by_date[date_string] = {
                "date": date_string,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "total": 0,
                "top_topic_positive": daily_topics.get("positive", "Program Makan Bergizi Gratis (MBG)"),
                "top_topic_neutral": daily_topics.get("neutral", "Program Makan Bergizi Gratis (MBG)"),
                "top_topic_negative": daily_topics.get("negative", "Evaluasi & Pengawasan MBG"),
            }

        sentiment_key = (sentiment_label or "neutral").lower()
        count_int = int(post_count or 0)
        if sentiment_key in ("positive", "neutral", "negative"):
            timeline_by_date[date_string][sentiment_key] += count_int
        else:
            timeline_by_date[date_string]["neutral"] += count_int
        timeline_by_date[date_string]["total"] += count_int

    return list(timeline_by_date.values())
