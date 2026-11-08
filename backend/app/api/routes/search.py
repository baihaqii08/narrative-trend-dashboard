from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from models import Post


router = APIRouter(tags=["Search"])

DEFAULT_SEARCH_LIMIT = 50
MAX_SEARCH_LIMIT = 500


class PostResponse(BaseModel):
    platform: str
    author_username: str
    content: str
    posted_at: Optional[datetime]
    sentiment: Optional[str]
    likes: int

    class Config:
        from_attributes = True


@router.get("", response_model=List[PostResponse])
@router.get("/", response_model=List[PostResponse])
def global_search(
    q: Optional[str] = Query(None, description="Kata kunci untuk Full-Text Search"),
    platform: Optional[str] = Query(None, description="Filter berdasarkan platform (misal: x, tiktok)"),
    sentiment: Optional[str] = Query(None, description="Filter berdasarkan sentimen (positive, negative, neutral)"),
    start_date: Optional[datetime] = Query(None, description="Mulai tanggal"),
    end_date: Optional[datetime] = Query(None, description="Sampai tanggal"),
    limit: int = Query(DEFAULT_SEARCH_LIMIT, ge=1, le=MAX_SEARCH_LIMIT),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[Post]:
    search_query = _build_search_query(
        db=db,
        keyword=q,
        platform=platform,
        sentiment=sentiment,
        start_date=start_date,
        end_date=end_date,
    )
    return (
        search_query.order_by(Post.posted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def _build_search_query(
    db: Session,
    keyword: Optional[str],
    platform: Optional[str],
    sentiment: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
):
    query = db.query(Post)

    if keyword:
        wildcard_pattern = f"%{keyword}%"
        query = query.filter(
            or_(
                Post.content.ilike(wildcard_pattern),
                Post.author_username.ilike(wildcard_pattern),
            )
        )

    if platform:
        query = query.filter(Post.platform == platform)
    if sentiment:
        query = query.filter(Post.sentiment == sentiment)
    if start_date:
        query = query.filter(Post.posted_at >= start_date)
    if end_date:
        query = query.filter(Post.posted_at <= end_date)

    return query
