from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from app.api.dependencies import get_db
from models import Post
from app.api.routes.sentiment import serialize_post

router = APIRouter(tags=["Posts"])

@router.get("")
@router.get("/")
def get_posts(
    platform: Optional[str] = Query(None, description="Filter platform"),
    sentiment: Optional[str] = Query(None, description="Filter sentiment"),
    topic_id: Optional[int] = Query(None, description="Filter topic ID"),
    days: Optional[int] = Query(None, description="Filter rentang hari"),
    time_filter: Optional[str] = Query(None, description="Filter waktu (last7, last30, all)"),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    12.6: Daftar post dengan paginasi dan filter.
    """
    query = db.query(Post)

    if platform and platform.lower() != "all":
        query = query.filter(Post.platform == platform.lower())

    if sentiment and sentiment.lower() != "all":
        query = query.filter(Post.sentiment == sentiment.lower())

    if topic_id:
        query = query.filter(Post.topic_id == topic_id)

    filter_days = days
    if not filter_days and time_filter:
        if "7" in time_filter:
            filter_days = 7
        elif "30" in time_filter:
            filter_days = 30

    if filter_days:
        start_date = datetime.utcnow() - timedelta(days=filter_days)
        query = query.filter(or_(Post.posted_at >= start_date, Post.created_at >= start_date))

    posts = query.order_by(Post.posted_at.desc().nullslast()).offset(skip).limit(limit).all()
    return [serialize_post(p) for p in posts]

