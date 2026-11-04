from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.api.dependencies import get_db
from models import Post

router = APIRouter(tags=["Search"])

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
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    # Base query
    query = db.query(Post)

    # 1. Full-Text Search menggunakan ILIKE (Atau native tsvector untuk PostgreSQL)
    if q:
        # Menggunakan ILIKE untuk support lintas-database secara sederhana, 
        # namun untuk PostgreSQL skala besar bisa diganti dengan:
        # query = query.filter(func.to_tsvector('indonesian', Post.content).op('@@')(func.plainto_tsquery('indonesian', q)))
        search_term = f"%{q}%"
        query = query.filter(or_(
            Post.content.ilike(search_term),
            Post.author_username.ilike(search_term)
        ))

    # 2. Filter Terstruktur (Memanfaatkan Indexing yang baru saja kita buat)
    if platform:
        query = query.filter(Post.platform == platform)
    
    if sentiment:
        query = query.filter(Post.sentiment == sentiment)
        
    if start_date:
        query = query.filter(Post.posted_at >= start_date)
        
    if end_date:
        query = query.filter(Post.posted_at <= end_date)

    # Sorting & Pagination
    # Urutkan berdasarkan waktu posting terbaru
    query = query.order_by(Post.posted_at.desc())
    
    results = query.offset(skip).limit(limit).all()
    
    return results
