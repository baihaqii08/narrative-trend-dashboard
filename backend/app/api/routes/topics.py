from datetime import datetime, timedelta
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from models import Post, Topic


router = APIRouter(tags=["Topics"])

DEFAULT_TOPICS_LIMIT = 10
MAX_TOPICS_LIMIT = 100
DEFAULT_TIMELINE_DAYS = 7
RELATED_POSTS_LIMIT = 20


@router.get("")
@router.get("/")
def get_topics(
    limit: int = Query(DEFAULT_TOPICS_LIMIT, ge=1, le=MAX_TOPICS_LIMIT),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return top trending topics ordered by post count."""
    topics = db.query(Topic).order_by(Topic.post_count.desc()).limit(limit).all()
    return [_serialize_topic_summary(topic_item) for topic_item in topics]


@router.get("/timeline")
def get_topics_timeline(
    days: int = Query(DEFAULT_TIMELINE_DAYS),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return daily post counts per topic over the requested day window."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    post_date_expression = cast(Post.posted_at, Date)

    daily_topic_rows = (
        db.query(
            post_date_expression.label("date"),
            Post.topic_id,
            func.count(Post.id).label("count"),
        )
        .filter(Post.posted_at >= cutoff_date)
        .group_by(post_date_expression, Post.topic_id)
        .order_by(post_date_expression)
        .all()
    )

    return [
        {
            "date": str(row.date),
            "topic_id": row.topic_id,
            "count": row.count,
        }
        for row in daily_topic_rows
    ]


@router.get("/{topic_id}")
def get_topic_detail(
    topic_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return detailed topic metadata along with a sample of related posts."""
    topic_item = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic_item:
        raise HTTPException(status_code=404, detail="Topic not found")

    related_posts = (
        db.query(Post)
        .filter(Post.topic_id == topic_id)
        .limit(RELATED_POSTS_LIMIT)
        .all()
    )

    return {
        **_serialize_topic_summary(topic_item),
        "related_posts": [_serialize_related_post(post_item) for post_item in related_posts],
    }


def _serialize_topic_summary(topic_item: Topic) -> Dict[str, Any]:
    return {
        "id": topic_item.id,
        "name": topic_item.name,
        "keywords": topic_item.keywords,
        "post_count": topic_item.post_count,
        "first_seen": topic_item.first_seen.isoformat() if topic_item.first_seen else None,
        "last_seen": topic_item.last_seen.isoformat() if topic_item.last_seen else None,
    }


def _serialize_related_post(post_item: Post) -> Dict[str, Any]:
    return {
        "id": str(post_item.id),
        "author_username": post_item.author_username,
        "content": post_item.content,
        "sentiment": post_item.sentiment,
        "likes": post_item.likes,
        "posted_at": post_item.posted_at.isoformat() if post_item.posted_at else None,
    }
