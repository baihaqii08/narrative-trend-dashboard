from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.core.cache import in_memory_cache
from models import Entity, Post, Topic


router = APIRouter()

CACHE_TTL_SECONDS = 120
PERCENTAGE_MULTIPLIER = 100
DEFAULT_DOMINANT_TOPIC_NAME = "Program Makan Bergizi Gratis (MBG)"
ALL_TIME_FILTER_KEYWORDS = ("all", "null", "undefined", "none", "sepanjang_waktu", "all_time")


@router.get("/overview")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_dashboard_overview(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return aggregated KPI metrics, sentiment shares, growth rates, and platform distribution."""
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    post_query = _build_filtered_post_query(db, filter_days, platform_filter_list)
    aggregate_stats = _query_post_aggregates(post_query)

    total_posts = int((aggregate_stats.total_posts if aggregate_stats else 0) or 0)
    total_likes = int((aggregate_stats.total_likes if aggregate_stats else 0) or 0)
    total_comments = int((aggregate_stats.total_comments if aggregate_stats else 0) or 0)
    total_shares = int((aggregate_stats.total_shares if aggregate_stats else 0) or 0)
    total_views = int((aggregate_stats.total_views if aggregate_stats else 0) or 0)
    neutral_count = int((aggregate_stats.neutral_count if aggregate_stats else 0) or 0)
    positive_count = int((aggregate_stats.positive_count if aggregate_stats else 0) or 0)
    negative_count = int((aggregate_stats.negative_count if aggregate_stats else 0) or 0)
    total_engagement = total_likes + total_comments + total_shares

    total_topics = int(db.query(func.count(Topic.id)).scalar() or 0)
    unique_entities = int(db.query(func.count(Entity.id)).scalar() or 0)

    neutral_share = _compute_share_percentage(neutral_count, total_posts)
    positive_share = _compute_share_percentage(positive_count, total_posts)
    negative_share = _compute_share_percentage(negative_count, total_posts)

    dominant_topic_name = _query_dominant_topic_name(db)
    top_positive_topic = _query_top_topic_for_sentiment(db, "positive", dominant_topic_name)
    top_neutral_topic = _query_top_topic_for_sentiment(db, "neutral", dominant_topic_name)
    top_negative_topic = _query_top_topic_for_sentiment(db, "negative", dominant_topic_name)

    posts_growth, engagement_growth = _calculate_period_growth(
        db=db,
        filter_days=filter_days,
        platform_filter_list=platform_filter_list,
        current_posts=total_posts,
        current_engagement=total_engagement,
    )

    platform_distribution = _query_combined_platform_distribution(db)

    kpi_payload = {
        "total_posts": total_posts,
        "total_topics": total_topics,
        "trending_topics": total_topics,
        "total_engagement": total_engagement,
        "unique_entities": unique_entities,
        "total_entities": unique_entities,
        "positive_count": positive_count,
        "neutral_count": neutral_count,
        "negative_count": negative_count,
        "neutral_share": neutral_share,
        "positive_share": positive_share,
        "negative_share": negative_share,
        "dominant_sentiment": "neutral",
        "dominant_topic": dominant_topic_name,
        "top_positive_topic": top_positive_topic,
        "top_neutral_topic": top_neutral_topic,
        "top_negative_topic": top_negative_topic,
        "posts_growth": posts_growth,
        "engagement_growth": engagement_growth,
        "platform_distribution": platform_distribution,
    }

    return {
        "kpi": kpi_payload,
        **kpi_payload,
        "breakdown": {
            "likes": total_likes,
            "comments": total_comments,
            "shares": total_shares,
            "views": total_views,
        },
    }


@router.get("/timeline")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_dashboard_timeline(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return daily post counts for timeline chart rendering."""
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    post_date_column = func.date(Post.posted_at).label("date")
    timeline_query = db.query(
        post_date_column,
        func.count(Post.id).label("count"),
    ).filter(Post.posted_at.isnot(None))

    if filter_days:
        cutoff_date = datetime.utcnow() - timedelta(days=filter_days)
        timeline_query = timeline_query.filter(Post.posted_at >= cutoff_date)

    if platform_filter_list:
        timeline_query = timeline_query.filter(Post.platform.in_(platform_filter_list))

    daily_rows = timeline_query.group_by(post_date_column).order_by(post_date_column).all()
    timeline_points = [
        {"date": str(row.date), "count": row.count}
        for row in daily_rows
    ]

    return {
        "days_requested": filter_days or "all",
        "timeline": timeline_points,
        "total_posts": sum(row.count for row in daily_rows),
    }


@router.get("/sentiment")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_dashboard_sentiment(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, int]:
    filter_days = parse_filter_days(days, time_filter)
    platform_filter_list = normalize_platform_filter(platform)

    sentiment_query = db.query(
        Post.sentiment,
        func.count(Post.id).label("count"),
    )

    if filter_days:
        cutoff_date = datetime.utcnow() - timedelta(days=filter_days)
        sentiment_query = sentiment_query.filter(Post.posted_at >= cutoff_date)

    if platform_filter_list:
        sentiment_query = sentiment_query.filter(Post.platform.in_(platform_filter_list))

    grouped_rows = sentiment_query.group_by(Post.sentiment).all()
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for sentiment_label, count_value in grouped_rows:
        normalized_key = (sentiment_label or "").lower()
        if normalized_key in sentiment_counts:
            sentiment_counts[normalized_key] += count_value
    return sentiment_counts


def parse_filter_days(
    days: Optional[Any] = None,
    time_filter: Optional[str] = None,
) -> Optional[int]:
    """Parse days or time_filter query parameters into a positive integer day count, or None for all-time."""
    filter_days = _try_parse_explicit_days(days)
    if filter_days is not None:
        return filter_days

    if time_filter and isinstance(time_filter, str):
        normalized_time_filter = time_filter.strip().lower()
        if "7" in normalized_time_filter:
            return 7
        if "14" in normalized_time_filter:
            return 14
        if "30" in normalized_time_filter:
            return 30
        if any(keyword in normalized_time_filter for keyword in ("all", "sepanjang", "total", "ever")):
            return None

    return None


def normalize_platform_filter(platform: Optional[str]) -> Optional[List[str]]:
    """Expand platform query string to cover case and alias variations stored in PostgreSQL."""
    if not platform or not isinstance(platform, str):
        return None

    normalized_platform = platform.strip().lower()
    if normalized_platform in ("all", "null", "undefined", "none", "*", ""):
        return None
    if normalized_platform in ("x", "twitter"):
        return ["x", "twitter", "X", "Twitter"]
    if normalized_platform in ("instagram", "ig"):
        return ["instagram", "ig", "Instagram", "IG"]

    return [platform, platform.lower(), platform.upper(), platform.capitalize()]


def _try_parse_explicit_days(days: Optional[Any]) -> Optional[int]:
    if days is None:
        return None

    try:
        raw_days_str = str(days).strip().lower()
        if raw_days_str in ALL_TIME_FILTER_KEYWORDS:
            return None

        parsed_days = int(float(raw_days_str))
        return parsed_days if parsed_days > 0 else None
    except (ValueError, TypeError):
        return None


def _build_filtered_post_query(
    db: Session,
    filter_days: Optional[int],
    platform_filter_list: Optional[List[str]],
):
    query = db.query(Post)
    if filter_days:
        cutoff_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(Post.posted_at >= cutoff_date)
    if platform_filter_list:
        query = query.filter(Post.platform.in_(platform_filter_list))
    return query


def _query_post_aggregates(post_query):
    return post_query.with_entities(
        func.count(Post.id).label("total_posts"),
        func.sum(Post.likes).label("total_likes"),
        func.sum(Post.comments).label("total_comments"),
        func.sum(Post.shares).label("total_shares"),
        func.sum(Post.views).label("total_views"),
        func.count(Post.id).filter(Post.sentiment == "neutral").label("neutral_count"),
        func.count(Post.id).filter(Post.sentiment == "positive").label("positive_count"),
        func.count(Post.id).filter(Post.sentiment == "negative").label("negative_count"),
    ).first()


def _compute_share_percentage(part_count: int, total_count: int) -> float:
    if total_count <= 0:
        return 0.0
    return round((part_count / total_count) * PERCENTAGE_MULTIPLIER, 1)


def _query_dominant_topic_name(db: Session) -> str:
    top_topic = db.query(Topic).order_by(Topic.post_count.desc()).first()
    return top_topic.name if top_topic else DEFAULT_DOMINANT_TOPIC_NAME


def _query_top_topic_for_sentiment(
    db: Session,
    sentiment_type: str,
    fallback_topic_name: str,
) -> str:
    try:
        top_topic_row = (
            db.query(Topic.name)
            .join(Post, Post.topic_id == Topic.id)
            .filter(Post.sentiment == sentiment_type)
            .group_by(Topic.name)
            .order_by(func.count(Post.id).desc())
            .first()
        )
        return top_topic_row[0] if top_topic_row else fallback_topic_name
    except Exception:
        return fallback_topic_name


def _calculate_period_growth(
    db: Session,
    filter_days: Optional[int],
    platform_filter_list: Optional[List[str]],
    current_posts: int,
    current_engagement: int,
) -> Tuple[Optional[float], Optional[float]]:
    try:
        if filter_days:
            return _calculate_windowed_period_growth(
                db=db,
                filter_days=filter_days,
                platform_filter_list=platform_filter_list,
                current_posts=current_posts,
                current_engagement=current_engagement,
            )
        return _calculate_all_time_split_growth(
            db=db,
            platform_filter_list=platform_filter_list,
        )
    except Exception:
        return None, None


def _calculate_windowed_period_growth(
    db: Session,
    filter_days: int,
    platform_filter_list: Optional[List[str]],
    current_posts: int,
    current_engagement: int,
) -> Tuple[Optional[float], Optional[float]]:
    current_period_start = datetime.utcnow() - timedelta(days=filter_days)
    previous_period_start = current_period_start - timedelta(days=filter_days)

    previous_posts, previous_engagement = _query_period_totals(
        db=db,
        start_date=previous_period_start,
        end_date=current_period_start,
        platform_filter_list=platform_filter_list,
    )
    posts_growth = _compute_growth_rate(current_posts, previous_posts)
    engagement_growth = _compute_growth_rate(current_engagement, previous_engagement)
    return posts_growth, engagement_growth


def _calculate_all_time_split_growth(
    db: Session,
    platform_filter_list: Optional[List[str]],
) -> Tuple[Optional[float], Optional[float]]:
    earliest_date, latest_date = db.query(
        func.min(Post.posted_at),
        func.max(Post.posted_at),
    ).first()
    if not earliest_date or not latest_date or earliest_date >= latest_date:
        return None, None

    midpoint_date = earliest_date + (latest_date - earliest_date) / 2
    previous_posts, previous_engagement = _query_period_totals(
        db=db,
        start_date=None,
        end_date=midpoint_date,
        platform_filter_list=platform_filter_list,
    )
    current_posts, current_engagement = _query_period_totals(
        db=db,
        start_date=midpoint_date,
        end_date=None,
        platform_filter_list=platform_filter_list,
    )

    posts_growth = _compute_growth_rate(current_posts, previous_posts)
    engagement_growth = _compute_growth_rate(current_engagement, previous_engagement)
    return posts_growth, engagement_growth


def _query_period_totals(
    db: Session,
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    platform_filter_list: Optional[List[str]],
) -> Tuple[int, int]:
    period_query = db.query(
        func.count(Post.id).label("post_count"),
        func.sum(Post.likes + Post.comments + Post.shares).label("engagement_sum"),
    )
    if start_date is not None:
        period_query = period_query.filter(Post.posted_at >= start_date)
    if end_date is not None:
        period_query = period_query.filter(Post.posted_at < end_date)
    if platform_filter_list:
        period_query = period_query.filter(Post.platform.in_(platform_filter_list))

    period_row = period_query.first()
    post_count = int((period_row.post_count if period_row else 0) or 0)
    engagement_sum = int((period_row.engagement_sum if period_row else 0) or 0)
    return post_count, engagement_sum


def _compute_growth_rate(current_value: int, previous_value: int) -> Optional[float]:
    if previous_value <= 0:
        return None
    return round(((current_value - previous_value) / previous_value) * PERCENTAGE_MULTIPLIER, 1)


def _query_combined_platform_distribution(db: Session) -> Dict[str, Dict[str, int]]:
    platform_rows = db.query(Post.platform, func.count(Post.id)).group_by(Post.platform).all()
    instagram_posts = 0
    x_posts = 0

    for platform_name, post_count in platform_rows:
        normalized_platform = str(platform_name).lower() if platform_name else ""
        if "insta" in normalized_platform or normalized_platform == "ig":
            instagram_posts += post_count
        elif "twit" in normalized_platform or normalized_platform == "x":
            x_posts += post_count

    total_platform_posts = instagram_posts + x_posts
    instagram_percentage = (
        round((instagram_posts / total_platform_posts) * PERCENTAGE_MULTIPLIER)
        if total_platform_posts > 0
        else 50
    )
    x_percentage = PERCENTAGE_MULTIPLIER - instagram_percentage if total_platform_posts > 0 else 50

    return {
        "instagram": {"percentage": instagram_percentage, "posts": instagram_posts},
        "x": {"percentage": x_percentage, "posts": x_posts},
    }
