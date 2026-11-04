from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from app.api.dependencies import get_db
from models import Topic, Post

router = APIRouter(tags=["Topics"])

@router.get("")
@router.get("/")
def get_topics(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    12.4: Daftar topik trending.
    """
    topics = db.query(Topic).order_by(Topic.post_count.desc()).limit(limit).all()
    results = [
        {
            "id": t.id,
            "name": t.name,
            "keywords": t.keywords,
            "post_count": t.post_count,
            "first_seen": t.first_seen.isoformat() if t.first_seen else None,
            "last_seen": t.last_seen.isoformat() if t.last_seen else None
        }
        for t in topics
    ]
    return results

@router.get("/timeline")
def get_topics_timeline(
    days: int = Query(7),
    db: Session = Depends(get_db)
):
    """
    12.4: Timeline kemunculan topik.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    stats = db.query(
        cast(Post.posted_at, Date).label("date"),
        Post.topic_id,
        func.count(Post.id).label("count")
    ).filter(Post.posted_at >= start_date) \
     .group_by(cast(Post.posted_at, Date), Post.topic_id) \
     .order_by(cast(Post.posted_at, Date)).all()

    timeline = [
        {
            "date": str(s.date),
            "topic_id": s.topic_id,
            "count": s.count
        }
        for s in stats
    ]
    return timeline

@router.get("/{topic_id}")
def get_topic_detail(
    topic_id: int,
    db: Session = Depends(get_db)
):
    """
    12.4: Detail topik beserta post terkait.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    posts = db.query(Post).filter(Post.topic_id == topic_id).limit(20).all()
    return {
        "id": topic.id,
        "name": topic.name,
        "keywords": topic.keywords,
        "post_count": topic.post_count,
        "first_seen": topic.first_seen.isoformat() if topic.first_seen else None,
        "last_seen": topic.last_seen.isoformat() if topic.last_seen else None,
        "related_posts": [
            {
                "id": str(p.id),
                "author_username": p.author_username,
                "content": p.content,
                "sentiment": p.sentiment,
                "likes": p.likes,
                "posted_at": p.posted_at.isoformat() if p.posted_at else None
            }
            for p in posts
        ]
    }

