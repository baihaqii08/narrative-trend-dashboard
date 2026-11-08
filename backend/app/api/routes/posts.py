from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from app.api.dependencies import apply_date_filter, apply_platform_filter, parse_filter_days
from app.core.cache import ttl_cache
from app.core.database import SocialPost, get_db


router = APIRouter()

CACHE_TTL_SECONDS = 120
DEFAULT_POST_LIMIT = 50
MAX_POST_LIMIT = 200
DEFAULT_TOP_POST_LIMIT = 10


@router.get("")
@router.get("/")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_POST_LIMIT, ge=1, le=MAX_POST_LIMIT),
    platform: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    sort_by: str = Query("engagement", description="Sort by: recent, engagement, likes"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    filter_days = parse_filter_days(days, timeframe)
    query = _build_filtered_posts_query(
        db=db,
        platform=platform,
        sentiment=sentiment,
        topic=topic,
        entity=entity,
        filter_days=filter_days,
    )
    ordered_query = _apply_post_sorting(query, sort_by)
    posts = ordered_query.offset(skip).limit(limit).all()
    return [format_post(post) for post in posts]


@router.get("/top")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_top_posts(
    limit: int = Query(DEFAULT_TOP_POST_LIMIT, ge=1, le=100),
    platform: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    return get_posts(
        skip=0,
        limit=limit,
        platform=platform,
        sentiment=None,
        topic=topic,
        entity=None,
        days=days,
        timeframe=timeframe,
        sort_by="engagement",
        db=db,
    )


@router.get("/{post_id}")
def get_post_by_id(
    post_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return format_post(post)


def format_post(post: SocialPost) -> Dict[str, Any]:
    likes_count = post.likes or 0
    comments_count = post.comments or 0
    shares_count = post.shares or 0
    views_count = post.views or 0
    engagement_score = likes_count + comments_count + shares_count

    entity_list = _parse_comma_separated_entities(post.entities)
    normalized_platform = _normalize_platform_label(post.platform)
    timestamp_iso = post.created_at.isoformat() if post.created_at else None
    date_only = post.created_at.strftime("%Y-%m-%d") if post.created_at else None

    return {
        "id": post.id,
        "platform": normalized_platform,
        "author": post.author or "@user",
        "username": post.author or "@user",
        "text": post.text_content or post.cleaned_content or "",
        "content": post.text_content or post.cleaned_content or "",
        "cleaned_content": post.cleaned_content or "",
        "timestamp": timestamp_iso,
        "created_at": timestamp_iso,
        "date": date_only,
        "likes": likes_count,
        "comments": comments_count,
        "shares": shares_count,
        "views": views_count,
        "engagement": engagement_score,
        "sentiment": (post.sentiment or "neutral").lower(),
        "topic": post.topic or "General",
        "entities": entity_list,
        "url": post.url or "",
    }


def _build_filtered_posts_query(
    db: Session,
    platform: Optional[str],
    sentiment: Optional[str],
    topic: Optional[str],
    entity: Optional[str],
    filter_days: Optional[int],
):
    query = db.query(SocialPost)
    query = apply_platform_filter(query, platform)
    query = apply_date_filter(query, db, filter_days)

    if sentiment and sentiment.lower() not in ("all", "semua"):
        query = query.filter(func.lower(SocialPost.sentiment) == sentiment.lower())
    if topic and topic.lower() not in ("all", "semua"):
        query = query.filter(SocialPost.topic.ilike(f"%{topic}%"))
    if entity and entity.lower() not in ("all", "semua"):
        query = query.filter(SocialPost.entities.ilike(f"%{entity}%"))

    return query


def _apply_post_sorting(query, sort_by: str):
    if sort_by == "likes":
        return query.order_by(desc(func.coalesce(SocialPost.likes, 0)))
    if sort_by == "recent":
        return query.order_by(desc(SocialPost.created_at))

    engagement_expression = (
        func.coalesce(SocialPost.likes, 0)
        + func.coalesce(SocialPost.comments, 0)
        + func.coalesce(SocialPost.shares, 0)
    )
    return query.order_by(desc(engagement_expression))


def _parse_comma_separated_entities(raw_entities: Optional[str]) -> List[str]:
    if not raw_entities:
        return []
    return [entity.strip() for entity in raw_entities.split(",") if entity.strip()]


def _normalize_platform_label(raw_platform: Optional[str]) -> str:
    platform_value = (raw_platform or "x").lower()
    if platform_value in ("twitter", "tw"):
        return "x"
    return platform_value
