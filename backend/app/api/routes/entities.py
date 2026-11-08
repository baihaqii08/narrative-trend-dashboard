from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.dependencies import get_db
from app.core.cache import in_memory_cache
from models import Entity


router = APIRouter(tags=["Entities"])

CACHE_TTL_SECONDS = 120
DEFAULT_ENTITIES_LIMIT = 10


@router.get("")
@router.get("/")
@in_memory_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_entities(
    platform: Optional[str] = None,
    days: Optional[int] = None,
    time_filter: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = DEFAULT_ENTITIES_LIMIT,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return top mentioned entities ordered by mention frequency."""
    entity_query = db.query(Entity)
    if type and isinstance(type, str) and type.lower() != "all":
        entity_query = entity_query.filter(Entity.type == type.upper())

    top_entities = entity_query.order_by(Entity.mention_count.desc()).limit(limit).all()
    return [_serialize_entity_record(entity_item) for entity_item in top_entities]


@router.get("/{entity_id}")
def get_entity_detail(
    entity_id: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    entity_item = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity_item:
        return {"id": entity_id, "name": "Not Found", "mention_count": 0}
    return {
        "id": entity_item.id,
        "name": entity_item.name,
        "type": entity_item.type,
        "mention_count": entity_item.mention_count,
    }


def _serialize_entity_record(entity_item: Entity) -> Dict[str, Any]:
    return {
        "id": entity_item.id,
        "name": entity_item.name,
        "label": entity_item.name,
        "type": entity_item.type,
        "category": entity_item.type,
        "mention_count": entity_item.mention_count,
        "count": entity_item.mention_count,
        "val": entity_item.mention_count,
        "value": entity_item.mention_count,
    }
