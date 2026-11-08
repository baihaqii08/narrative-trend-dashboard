from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.routes.graph import MBG_RAW_ENTITIES, TOPIC_LABEL_MAP, get_graph_data
from app.core.cache import ttl_cache
from app.core.database import get_db, get_neo4j


router = APIRouter()

DEFAULT_TOP_ENTITIES_LIMIT = 20
DEFAULT_TRENDING_ENTITIES_LIMIT = 10
CACHE_TTL_SECONDS = 120


@router.get("")
@router.get("/")
@router.get("/top")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_top_entities(
    limit: int = Query(DEFAULT_TOP_ENTITIES_LIMIT, description="Limit top entities"),
    entity_type: Optional[str] = Query(None, description="Filter by type: person, organization, location, norm"),
    type: Optional[str] = Query(None, description="Alias for entity_type"),
    platform: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    neo4j_session=Depends(get_neo4j),
) -> List[Dict[str, Any]]:
    resolved_entity_type = entity_type or type
    graph_payload = get_graph_data(
        topic=None,
        entity_type=resolved_entity_type,
        type=None,
        min_weight=1,
        limit=500,
        neo4j_session=neo4j_session,
        db=db,
    )
    graph_nodes = graph_payload.get("nodes", [])

    entity_nodes = _extract_entity_nodes(graph_nodes, resolved_entity_type)
    if entity_nodes:
        entity_nodes.sort(key=lambda item: item["count"], reverse=True)
        return entity_nodes[:limit]

    return _build_static_fallback_entities(resolved_entity_type, limit)


@router.get("/trending")
def get_trending_entities(
    limit: int = DEFAULT_TRENDING_ENTITIES_LIMIT,
    platform: Optional[str] = Query(None),
    days: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    neo4j_session=Depends(get_neo4j),
) -> List[Dict[str, Any]]:
    return get_top_entities(
        limit=limit,
        entity_type=None,
        type=None,
        platform=platform,
        days=days,
        timeframe=timeframe,
        db=db,
        neo4j_session=neo4j_session,
    )


def _extract_entity_nodes(
    graph_nodes: List[Dict[str, Any]],
    resolved_entity_type: Optional[str],
) -> List[Dict[str, Any]]:
    extracted_entities: List[Dict[str, Any]] = []
    for node_record in graph_nodes:
        node_type = (node_record.get("type") or "").lower()
        if node_type == "topic":
            continue
        if resolved_entity_type and resolved_entity_type.lower() not in ("all", "semua"):
            if node_type != resolved_entity_type.lower():
                continue

        mention_count = int(node_record.get("frequency") or node_record.get("weight") or 0)
        extracted_entities.append(
            _format_entity_summary(
                name=node_record.get("label") or node_record.get("id"),
                entity_type=node_type,
                mention_count=mention_count,
                topic_id=node_record.get("topicId", ""),
                topic_label=node_record.get("topicLabel", ""),
            )
        )
    return extracted_entities


def _build_static_fallback_entities(
    resolved_entity_type: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    fallback_entities: List[Dict[str, Any]] = []
    for raw_entity in MBG_RAW_ENTITIES:
        raw_category = raw_entity["type"].lower()
        if resolved_entity_type and resolved_entity_type.lower() not in ("all", "semua"):
            if raw_category != resolved_entity_type.lower():
                continue

        fallback_entities.append(
            _format_entity_summary(
                name=raw_entity["name"],
                entity_type=raw_category,
                mention_count=raw_entity["freq"],
                topic_id=raw_entity["topic"],
                topic_label=TOPIC_LABEL_MAP.get(raw_entity["topic"], raw_entity["topic"]),
            )
        )

    fallback_entities.sort(key=lambda item: item["count"], reverse=True)
    return fallback_entities[:limit]


def _format_entity_summary(
    name: str,
    entity_type: str,
    mention_count: int,
    topic_id: str,
    topic_label: str,
) -> Dict[str, Any]:
    return {
        "name": name,
        "entity": name,
        "type": entity_type,
        "category": entity_type,
        "count": mention_count,
        "mentions": mention_count,
        "frequency": mention_count,
        "topicId": topic_id,
        "topicLabel": topic_label,
    }
