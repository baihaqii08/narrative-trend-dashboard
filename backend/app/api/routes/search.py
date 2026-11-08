from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session
from app.api.dependencies import apply_date_filter, apply_platform_filter, parse_filter_days
from app.api.routes.posts import format_post
from app.core.database import SocialPost, get_db


router = APIRouter()

DEFAULT_SEARCH_LIMIT = 50
MAX_SEARCH_LIMIT = 200


@router.get("")
@router.get("/")
def search_posts(
    q: Optional[str] = Query(None, description="Search keyword for text, author, topic, or entity"),
    keyword: Optional[str] = Query(None, description="Alias for q"),
    platform: Optional[str] = Query(None, description="Filter by platform (instagram, x)"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive, negative, neutral)"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    days: Optional[str] = Query(None, description="Filter by past N days"),
    timeframe: Optional[str] = Query(None, description="Alias for days"),
    sort_by: str = Query("recent", description="Sort by: recent, engagement"),
    skip: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_SEARCH_LIMIT, ge=1, le=MAX_SEARCH_LIMIT),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    search_term = (q or keyword or "").strip()
    filter_days = parse_filter_days(days, timeframe)

    query = _build_search_query(
        db=db,
        search_term=search_term,
        platform=platform,
        sentiment=sentiment,
        topic=topic,
        filter_days=filter_days,
    )
    total_matches = query.count()
    ordered_query = _apply_search_sorting(query, sort_by)
    matching_posts = ordered_query.offset(skip).limit(limit).all()

    return {
        "total": total_matches,
        "skip": skip,
        "limit": limit,
        "query": search_term,
        "results": [format_post(post) for post in matching_posts],
        "data": [format_post(post) for post in matching_posts],
    }


def _build_search_query(
    db: Session,
    search_term: str,
    platform: Optional[str],
    sentiment: Optional[str],
    topic: Optional[str],
    filter_days: Optional[int],
):
    query = db.query(SocialPost)
    query = apply_platform_filter(query, platform)
    query = apply_date_filter(query, db, filter_days)

    if search_term:
        wildcard_term = f"%{search_term}%"
        query = query.filter(
            or_(
                SocialPost.text_content.ilike(wildcard_term),
                SocialPost.author.ilike(wildcard_term),
                SocialPost.topic.ilike(wildcard_term),
                SocialPost.entities.ilike(wildcard_term),
            )
        )

    if sentiment and sentiment.lower() not in ("all", "semua"):
        query = query.filter(func.lower(SocialPost.sentiment) == sentiment.lower())

    if topic and topic.lower() not in ("all", "semua"):
        query = query.filter(SocialPost.topic.ilike(f"%{topic}%"))

    return query


def _apply_search_sorting(query, sort_by: str):
    if sort_by == "engagement":
        engagement_expression = (
            func.coalesce(SocialPost.likes, 0)
            + func.coalesce(SocialPost.comments, 0)
            + func.coalesce(SocialPost.shares, 0)
        )
        return query.order_by(desc(engagement_expression))

    return query.order_by(desc(SocialPost.created_at))
