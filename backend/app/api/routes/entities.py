from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List, Dict, Any

from app.api.dependencies import get_db
from models import Entity
from app.core.cache import in_memory_cache

router = APIRouter(tags=["Entities"])

@router.get("")
@router.get("/")
@in_memory_cache(ttl_seconds=120)
def get_entities(
    platform: Optional[str] = None,
    days: Optional[int] = None,
    time_filter: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Mengambil daftar entitas teratas (Person, Organization, Location, dll)
    beserta jumlah mention/frekuensinya.
    """
    query = db.query(Entity)
    if type and isinstance(type, str) and type.lower() != "all":
        query = query.filter(Entity.type == type.upper())
        
    top_entities = query.order_by(Entity.mention_count.desc()).limit(limit).all()
    
    results = [
        {
            "id": e.id,
            "name": e.name,
            "label": e.name,
            "type": e.type,
            "category": e.type,
            "mention_count": e.mention_count,
            "count": e.mention_count,
            "val": e.mention_count,
            "value": e.mention_count
        }
        for e in top_entities
    ]
    return results

@router.get("/{entity_id}")
def get_entity_detail(entity_id: int, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        return {"id": entity_id, "name": "Not Found", "mention_count": 0}
    return {
        "id": entity.id,
        "name": entity.name,
        "type": entity.type,
        "mention_count": entity.mention_count
    }

