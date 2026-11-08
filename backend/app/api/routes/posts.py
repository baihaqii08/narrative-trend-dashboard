from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.api.routes.dashboard import normalize_platform_filter, parse_filter_days
from app.api.routes.sentiment import serialize_post
from models import Post


router = APIRouter(tags=["Posts"])

DEFAULT_POSTS_LIMIT = 50
MAX_POSTS_LIMIT = 500


@router.get("")
@router.get("/")
def get_posts(
    platform: Optional[str] = Query(None, description="Filter platform"),
    sentiment: Optional[str] = Query(None, description="Filter sentiment"),
    topic_id: Optional[int] = Query(None, description="Filter topic ID"),
    days: Optional[int] = Query(None, description="Filter rentang hari"),
    time_filter: Optional[str] = Query(None, description="Filter waktu (last7, last30, all)"),
    limit: int = Query(DEFAULT_POSTS_LIMIT, ge=1, le=MAX_POSTS_LIMIT),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return paginated social posts filtered by platform, sentiment, topic, and timeframe."""
    post_query = db.query(Post)

    platform_filter_list = normalize_platform_filter(platform)
    if platform_filter_list:
        post_query = post_query.filter(Post.platform.in_(platform_filter_list))

    if sentiment and isinstance(sentiment, str) and sentiment.lower() != "all":
        post_query = post_query.filter(Post.sentiment == sentiment.lower())

    if isinstance(topic_id, int) and topic_id:
        post_query = post_query.filter(Post.topic_id == topic_id)

    resolved_skip = skip if isinstance(skip, int) else 0
    resolved_limit = limit if isinstance(limit, int) else DEFAULT_POSTS_LIMIT

    filter_days = parse_filter_days(days, time_filter if isinstance(time_filter, str) else None)
    if filter_days:
        cutoff_date = datetime.utcnow() - timedelta(days=filter_days)
        post_query = post_query.filter(
            or_(Post.posted_at >= cutoff_date, Post.created_at >= cutoff_date)
        )

    posts = (
        post_query.order_by(Post.posted_at.desc().nullslast())
        .offset(resolved_skip)
        .limit(resolved_limit)
        .all()
    )
    return [serialize_post(post_item) for post_item in posts]
