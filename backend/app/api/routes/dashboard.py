from datetime import timedelta
from typing import Any, Dict, Optional, Tuple
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from app.api.dependencies import apply_date_filter, apply_platform_filter, parse_filter_days
from app.api.routes.entities import get_top_entities
from app.api.routes.sentiment import get_sentiment_distribution
from app.api.routes.topics import get_topics
from app.core.cache import ttl_cache
from app.core.database import SocialPost, get_db, get_neo4j


router = APIRouter()

CACHE_TTL_SECONDS = 120
PERCENTAGE_MULTIPLIER = 100.0
HOURS_PER_DAY = 24.0
SECONDS_PER_HOUR = 3600.0
DEFAULT_OVERVIEW_DAYS_WINDOW = 30.0
EXCLUDED_TOPIC_NAMES = ("Outlier / Topik Lainnya", "Unknown", "")


@router.get("")
@router.get("/")
@router.get("/overview")
@router.get("/stats")
@router.get("/summary")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_dashboard_overview(
    platform: Optional[str] = Query(None, description="Filter by platform: instagram, x"),
    days: Optional[str] = Query(None, description="Filter by past N days"),
    timeframe: Optional[str] = Query(None, description="Alias for days"),
    db: Session = Depends(get_db),
    neo4j_session=Depends(get_neo4j),
) -> Dict[str, Any]:
    filter_days = parse_filter_days(days, timeframe)
    filtered_query = _build_filtered_post_query(db, platform, filter_days)

    aggregate_metrics = _query_post_aggregates(filtered_query)
    total_posts = int(aggregate_metrics.total_posts or 0)
    total_likes = int(aggregate_metrics.total_likes or 0)
    total_comments = int(aggregate_metrics.total_comments or 0)
    total_shares = int(aggregate_metrics.total_shares or 0)
    total_views = int(aggregate_metrics.total_views or 0)
    total_engagement = total_likes + total_comments + total_shares
    average_engagement_rate = round((total_engagement / total_posts), 2) if total_posts > 0 else 0.0

    sentiment_summary = get_sentiment_distribution(
        platform=platform,
        topic=None,
        days=days,
        timeframe=timeframe,
        db=db,
    )
    dominant_sentiment = _resolve_dominant_sentiment_label(sentiment_summary["counts"])

    top_positive_topic = _find_top_topic_for_sentiment(filtered_query, "positive", "Program Makan Bergizi Gratis (MBG)")
    top_negative_topic = _find_top_topic_for_sentiment(filtered_query, "negative", "Evaluasi & Pengawasan MBG")
    top_neutral_topic = _find_top_topic_for_sentiment(filtered_query, "neutral", "Program Makan Bergizi Gratis (MBG)")

    posts_growth_pct, engagement_growth_pct = _calculate_period_over_period_growth(
        db=db,
        platform=platform,
        filter_days=filter_days,
        current_posts=total_posts,
        current_engagement=total_engagement,
    )

    platform_distribution = _compute_platform_distribution(db, filter_days)
    top_topics = get_topics(platform=platform, days=days, timeframe=timeframe, limit=100, db=db)
    top_entities = get_top_entities(
        limit=200,
        entity_type=None,
        type=None,
        platform=platform,
        days=days,
        timeframe=timeframe,
        db=db,
        neo4j_session=neo4j_session,
    )

    active_days = _calculate_active_days(
        filter_days=filter_days,
        earliest_date=aggregate_metrics.min_date,
        latest_date=aggregate_metrics.max_date,
    )
    posts_per_hour = round(total_posts / (active_days * HOURS_PER_DAY), 1) if total_posts > 0 else 0.0

    return {
        "total_posts": total_posts,
        "totalPosts": total_posts,
        "total_Conversations": total_posts,
        "totalConversations": total_posts,
        "posts_growth": posts_growth_pct,
        "postsGrowth": posts_growth_pct,
        "total_engagement": total_engagement,
        "totalEngagement": total_engagement,
        "engagement_growth": engagement_growth_pct,
        "engagementGrowth": engagement_growth_pct,
        "avg_engagement": average_engagement_rate,
        "avgEngagementRate": f"{average_engagement_rate}%",
        "posts_per_hour": posts_per_hour,
        "postsPerHour": str(posts_per_hour),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "total_views": total_views,
        "active_topics": len(top_topics),
        "trending_topics_count": len(top_topics),
        "unique_entities": len(top_entities),
        "dominant_sentiment": dominant_sentiment.capitalize(),
        "dominantSentiment": dominant_sentiment.capitalize(),
        "sentiment": sentiment_summary,
        "sentiment_distribution": sentiment_summary["counts"],
        "sentiment_percentages": sentiment_summary["percentages"],
        "top_positive_topic": top_positive_topic,
        "top_negative_topic": top_negative_topic,
        "top_neutral_topic": top_neutral_topic,
        "platform_distribution": platform_distribution["counts"],
        "platform_percentages": platform_distribution["percentages"],
        "instagram_share": platform_distribution["percentages"]["instagram"],
        "x_share": platform_distribution["percentages"]["x"],
        "top_topics": top_topics[:6],
        "top_entities": top_entities[:8],
    }


def _build_filtered_post_query(
    db: Session,
    platform: Optional[str],
    filter_days: Optional[int],
):
    query = db.query(SocialPost)
    query = apply_platform_filter(query, platform)
    return apply_date_filter(query, db, filter_days)


def _query_post_aggregates(filtered_query):
    return filtered_query.with_entities(
        func.count(SocialPost.id).label("total_posts"),
        func.sum(func.coalesce(SocialPost.likes, 0)).label("total_likes"),
        func.sum(func.coalesce(SocialPost.comments, 0)).label("total_comments"),
        func.sum(func.coalesce(SocialPost.shares, 0)).label("total_shares"),
        func.sum(func.coalesce(SocialPost.views, 0)).label("total_views"),
        func.min(SocialPost.created_at).label("min_date"),
        func.max(SocialPost.created_at).label("max_date"),
    ).first()


def _resolve_dominant_sentiment_label(sentiment_counts: Dict[str, int]) -> str:
    if not any(sentiment_counts.values()):
        return "neutral"
    return max(sentiment_counts, key=sentiment_counts.get)


def _find_top_topic_for_sentiment(
    filtered_query,
    sentiment_label: str,
    fallback_topic: str,
) -> str:
    top_topic_row = (
        filtered_query.with_entities(
            SocialPost.topic,
            func.count(SocialPost.id).label("topic_count"),
        )
        .filter(
            func.lower(SocialPost.sentiment) == sentiment_label.lower(),
            SocialPost.topic.isnot(None),
            ~SocialPost.topic.in_(EXCLUDED_TOPIC_NAMES),
        )
        .group_by(SocialPost.topic)
        .order_by(desc("topic_count"))
        .first()
    )
    return top_topic_row.topic if top_topic_row and top_topic_row.topic else fallback_topic


def _calculate_period_over_period_growth(
    db: Session,
    platform: Optional[str],
    filter_days: Optional[int],
    current_posts: int,
    current_engagement: int,
) -> Tuple[float, float]:
    try:
        if filter_days and filter_days > 0:
            return _calculate_windowed_growth(
                db=db,
                platform=platform,
                filter_days=filter_days,
                current_posts=current_posts,
                current_engagement=current_engagement,
            )
        return _calculate_all_time_split_growth(db=db, platform=platform)
    except Exception:
        return 0.0, 0.0


def _calculate_windowed_growth(
    db: Session,
    platform: Optional[str],
    filter_days: int,
    current_posts: int,
    current_engagement: int,
) -> Tuple[float, float]:
    latest_date = db.query(func.max(SocialPost.created_at)).scalar()
    if not latest_date:
        return 0.0, 0.0

    current_period_start = latest_date - timedelta(days=filter_days)
    previous_period_start = current_period_start - timedelta(days=filter_days)

    previous_query = apply_platform_filter(db.query(SocialPost), platform).filter(
        SocialPost.created_at >= previous_period_start,
        SocialPost.created_at < current_period_start,
    )
    previous_posts, previous_engagement = _query_post_and_engagement_totals(previous_query)

    posts_growth = _compute_growth_percentage(current_posts, previous_posts)
    engagement_growth = _compute_growth_percentage(current_engagement, previous_engagement)
    return posts_growth, engagement_growth


def _calculate_all_time_split_growth(
    db: Session,
    platform: Optional[str],
) -> Tuple[float, float]:
    date_bounds = db.query(
        func.min(SocialPost.created_at),
        func.max(SocialPost.created_at),
    ).first()
    if not date_bounds or not date_bounds[0] or not date_bounds[1]:
        return 0.0, 0.0

    earliest_date, latest_date = date_bounds[0], date_bounds[1]
    midpoint_date = earliest_date + (latest_date - earliest_date) / 2

    previous_half_query = apply_platform_filter(db.query(SocialPost), platform).filter(
        SocialPost.created_at < midpoint_date
    )
    current_half_query = apply_platform_filter(db.query(SocialPost), platform).filter(
        SocialPost.created_at >= midpoint_date
    )

    previous_posts, previous_engagement = _query_post_and_engagement_totals(previous_half_query)
    current_posts, current_engagement = _query_post_and_engagement_totals(current_half_query)

    posts_growth = _compute_growth_percentage(current_posts, previous_posts)
    engagement_growth = _compute_growth_percentage(current_engagement, previous_engagement)
    return posts_growth, engagement_growth


def _query_post_and_engagement_totals(query) -> Tuple[int, int]:
    engagement_expression = (
        func.coalesce(SocialPost.likes, 0)
        + func.coalesce(SocialPost.comments, 0)
        + func.coalesce(SocialPost.shares, 0)
    )
    totals = query.with_entities(
        func.count(SocialPost.id).label("post_count"),
        func.sum(engagement_expression).label("engagement_sum"),
    ).first()
    post_count = int(totals.post_count or 0) if totals else 0
    engagement_sum = int(totals.engagement_sum or 0) if totals else 0
    return post_count, engagement_sum


def _compute_growth_percentage(current_value: int, previous_value: int) -> float:
    if previous_value <= 0:
        return 0.0
    return round(((current_value - previous_value) / previous_value) * PERCENTAGE_MULTIPLIER, 1)


def _compute_platform_distribution(
    db: Session,
    filter_days: Optional[int],
) -> Dict[str, Dict[str, Any]]:
    platform_query = apply_date_filter(db.query(SocialPost), db, filter_days)
    platform_rows = (
        platform_query.with_entities(
            func.lower(SocialPost.platform).label("platform"),
            func.count(SocialPost.id).label("post_count"),
        )
        .group_by(func.lower(SocialPost.platform))
        .all()
    )

    platform_counts = {"instagram": 0, "x": 0}
    for platform_name, post_count in platform_rows:
        normalized_platform = (platform_name or "").lower()
        count_int = int(post_count or 0)
        if "insta" in normalized_platform or normalized_platform == "ig":
            platform_counts["instagram"] += count_int
        elif normalized_platform in ("x", "twitter", "tw"):
            platform_counts["x"] += count_int

    total_platform_posts = platform_counts["instagram"] + platform_counts["x"]
    divisor = total_platform_posts if total_platform_posts > 0 else 1
    instagram_percentage = round((platform_counts["instagram"] / divisor) * PERCENTAGE_MULTIPLIER)
    x_percentage = round((platform_counts["x"] / divisor) * PERCENTAGE_MULTIPLIER)

    return {
        "counts": platform_counts,
        "percentages": {
            "instagram": instagram_percentage,
            "x": x_percentage,
        },
    }


def _calculate_active_days(
    filter_days: Optional[int],
    earliest_date: Any,
    latest_date: Any,
) -> float:
    if filter_days and filter_days > 0:
        return float(filter_days)
    if earliest_date and latest_date:
        elapsed_days = (latest_date - earliest_date).total_seconds() / (HOURS_PER_DAY * SECONDS_PER_HOUR)
        return max(1.0, elapsed_days)
    return DEFAULT_OVERVIEW_DAYS_WINDOW
