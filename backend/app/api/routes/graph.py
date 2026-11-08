from typing import Any, Dict, List, Optional, Set
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.cache import ttl_cache
from app.core.database import get_db, get_neo4j, neo4j_conn


router = APIRouter()

CACHE_TTL_SECONDS = 120
TOPIC_NODE_DEFAULT_WEIGHT = 40
TOPIC_NODE_DEFAULT_SIZE = 32
ENTITY_NODE_MIN_SIZE = 16
ENTITY_NODE_MAX_SIZE = 36
ENTITY_SIZE_DIVISOR = 20
DEFAULT_GRAPH_NODE_LIMIT = 300

ENTITY_COLOR_MAP: Dict[str, str] = {
    "topic": "#f97316",
    "person": "#8b5cf6",
    "organization": "#3b82f6",
    "geopolitical": "#06b6d4",
    "location": "#10b981",
    "product": "#eab308",
    "event": "#ec4899",
    "norm": "#ef4444",
    "facility": "#14b8a6",
}

TOPIC_LABEL_MAP: Dict[str, str] = {
    "Program Makan Bergizi Gratis (MBG)": "Program Makan Bergizi Gratis (MBG)",
    "Evaluasi Program Makan Bergizi Gratis": "Evaluasi Program Makan Bergizi Gratis",
    "Kontroversi Program Makan Bergizi Gratis MBG": "Kontroversi Program Makan Bergizi Gratis MBG",
    "Program Makan Bergizi Sekolah": "Program Makan Bergizi Sekolah",
    "Program Makan Bergizi Gratis Indonesia": "Program Makan Bergizi Gratis Indonesia",
    "Pemanfaatan susu segar nasional": "Pemanfaatan susu segar nasional",
    "Program Makan Bergizi Gratis di Kendari": "Program Makan Bergizi Gratis di Kendari",
    "Program Makan Bergizi Gratis": "Program Makan Bergizi Gratis",
    "Lainnya / Tidak terklasifikasi": "Lainnya / Tidak terklasifikasi",
}


@router.get("")
@router.get("/")
@router.get("/data")
@router.get("/network")
@ttl_cache(ttl_seconds=CACHE_TTL_SECONDS)
def get_graph_data(
    topic: Optional[str] = Query(None, description="Filter by topic name"),
    entity_type: Optional[str] = Query(None, description="Filter by entity category"),
    type: Optional[str] = Query(None, description="Alias for entity_type"),
    min_weight: int = Query(1, ge=0, description="Minimum mention frequency"),
    min_freq: Optional[int] = Query(None, ge=0, description="Alias for min_weight"),
    limit: int = Query(DEFAULT_GRAPH_NODE_LIMIT, ge=10, le=1000),
    platform: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None),
    neo4j_session=Depends(get_neo4j),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return Knowledge Graph nodes and edges from Neo4j (port 7687), or the verified MBG dataset fallback."""
    resolved_entity_type = entity_type or type
    resolved_min_frequency = min_freq if min_freq is not None else min_weight

    live_graph = fetch_live_neo4j_graph(
        neo4j_session=neo4j_session,
        min_frequency=resolved_min_frequency,
        entity_type=resolved_entity_type,
        topic=topic,
    )
    if live_graph is not None:
        return live_graph

    return build_mbg_graph_data(
        min_frequency=resolved_min_frequency,
        entity_type=resolved_entity_type,
        topic=topic,
    )


@router.get("/nodes")
def get_graph_nodes(
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    neo4j_session=Depends(get_neo4j),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    graph_data = get_graph_data(
        topic=topic,
        entity_type=entity_type,
        min_freq=min_freq,
        neo4j_session=neo4j_session,
        db=db,
    )
    return graph_data.get("nodes", [])


@router.get("/edges")
def get_graph_edges(
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    neo4j_session=Depends(get_neo4j),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    graph_data = get_graph_data(
        topic=topic,
        entity_type=entity_type,
        min_freq=min_freq,
        neo4j_session=neo4j_session,
        db=db,
    )
    return graph_data.get("edges", [])


@router.get("/node/{node_id}")
def get_node_detail(
    node_id: str,
    neo4j_session=Depends(get_neo4j),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    graph_data = get_graph_data(neo4j_session=neo4j_session, db=db)
    for node_record in graph_data.get("nodes", []):
        if node_record.get("id") == node_id or node_record.get("name") == node_id:
            return node_record
    return {"id": node_id, "name": node_id, "status": "not_found"}


def fetch_live_neo4j_graph(
    neo4j_session: Any = None,
    min_frequency: Optional[int] = 0,
    entity_type: Optional[str] = None,
    topic: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    session = neo4j_session if not isinstance(neo4j_session, Depends.__class__) and neo4j_session is not None else None
    created_local_session = False

    if session is None:
        session = neo4j_conn.get_session()
        created_local_session = True

    if session is None:
        return None

    try:
        topics_records, entities_records, belongs_to_records, co_occurs_records = _query_neo4j_records(session)
        if not entities_records:
            return None

        return _assemble_graph_payload(
            source_label="neo4j_port_7687",
            topic_names=_extract_topic_names_from_neo4j(topics_records),
            topic_keywords_by_name=_extract_topic_keywords_from_neo4j(topics_records),
            entities_by_name=_normalize_neo4j_entities(entities_records),
            belongs_to_pairs=_normalize_belongs_to_records(belongs_to_records),
            co_occurrence_records=co_occurs_records,
            min_frequency=int(min_frequency or 0),
            entity_type=entity_type,
            topic=topic,
        )
    except Exception as neo4j_error:
        print(f"Neo4j live query fallback triggered: {neo4j_error}")
        return None
    finally:
        if created_local_session and session is not None:
            session.close()


def build_mbg_graph_data(
    min_frequency: Optional[int] = 0,
    entity_type: Optional[str] = None,
    topic: Optional[str] = None,
) -> Dict[str, Any]:
    entities_by_name = {
        entity["name"]: {
            "name": entity["name"],
            "type": entity["type"].lower(),
            "mention_count": int(entity["mention_count"]),
            "topic": entity["topic"],
        }
        for entity in MBG_ENTITIES_FALLBACK
    }
    belongs_to_pairs = [
        {"source": entity["name"], "target": entity["topic"]}
        for entity in MBG_ENTITIES_FALLBACK
    ]

    return _assemble_graph_payload(
        source_label="fallback_mbg_dataset",
        topic_names=MBG_TOPICS_FALLBACK,
        topic_keywords_by_name={},
        entities_by_name=entities_by_name,
        belongs_to_pairs=belongs_to_pairs,
        co_occurrence_records=MBG_CO_OCCURS_FALLBACK,
        min_frequency=int(min_frequency or 0),
        entity_type=entity_type,
        topic=topic,
    )


def format_node(
    raw_name: str,
    node_type: str,
    mention_count: int,
    topic: Optional[str] = None,
    keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    normalized_type = node_type.lower()
    node_color = ENTITY_COLOR_MAP.get(normalized_type, "#64748b")
    is_topic_node = normalized_type == "topic"

    if is_topic_node:
        node_size = TOPIC_NODE_DEFAULT_SIZE
        weight_value = TOPIC_NODE_DEFAULT_WEIGHT
    else:
        node_size = max(
            ENTITY_NODE_MIN_SIZE,
            min(ENTITY_NODE_MAX_SIZE, ENTITY_NODE_MIN_SIZE + (mention_count // ENTITY_SIZE_DIVISOR)),
        )
        weight_value = mention_count

    clean_label = raw_name.strip()
    node_id = f"topic_{clean_label}" if is_topic_node else f"entity_{clean_label}"
    resolved_topic_label = TOPIC_LABEL_MAP.get(topic or "", topic or clean_label)

    return {
        "id": node_id,
        "name": clean_label,
        "label": clean_label,
        "title": f"{clean_label} ({node_type.capitalize()} - {weight_value} mentions)",
        "category": node_type.capitalize(),
        "type": normalized_type,
        "group": normalized_type,
        "val": weight_value,
        "value": weight_value,
        "weight": weight_value,
        "frequency": weight_value,
        "mention_count": weight_value,
        "size": node_size,
        "color": node_color,
        "topic": topic,
        "topicId": f"topic_{topic}" if topic else (node_id if is_topic_node else ""),
        "topicLabel": resolved_topic_label,
        "keywords": keywords or [],
    }


def _query_neo4j_records(session: Any):
    topics_records = session.run(
        "MATCH (t:Topic) RETURN t.name as name, t.parent_topic as parent_topic, "
        "t.n_communities as n_communities, t.keywords as keywords"
    ).data()
    entities_records = session.run(
        "MATCH (e:Entity) RETURN e.name as name, e.type as type, "
        "e.mention_count as mention_count, e.community_id as community_id, e.topic as topic"
    ).data()
    belongs_to_records = session.run(
        "MATCH (e:Entity)-[r:BELONGS_TO_TOPIC]->(t:Topic) "
        "RETURN e.name as source, t.name as target, type(r) as type"
    ).data()
    co_occurs_records = session.run(
        "MATCH (a:Entity)-[r:CO_OCCURS_WITH]->(b:Entity) "
        "RETURN a.name as source, b.name as target, type(r) as type, "
        "r.weight as weight, r.cooccur as cooccur, r.pmi as pmi"
    ).data()
    return topics_records, entities_records, belongs_to_records, co_occurs_records


def _extract_topic_names_from_neo4j(topics_records: List[Dict[str, Any]]) -> List[str]:
    return [
        (record.get("name") or "").strip()
        for record in topics_records
        if (record.get("name") or "").strip()
    ]


def _extract_topic_keywords_from_neo4j(topics_records: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    return {
        (record.get("name") or "").strip(): (record.get("keywords") or [])
        for record in topics_records
        if (record.get("name") or "").strip()
    }


def _normalize_neo4j_entities(entities_records: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    normalized_entities: Dict[str, Dict[str, Any]] = {}
    for record in entities_records:
        entity_name = (record.get("name") or "").strip()
        if not entity_name:
            continue
        normalized_entities[entity_name] = {
            "name": entity_name,
            "type": (record.get("type") or "entity").lower(),
            "mention_count": int(record.get("mention_count") or 1),
            "topic": (record.get("topic") or "").strip() or None,
        }
    return normalized_entities


def _normalize_belongs_to_records(belongs_to_records: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    return [
        {
            "source": (record.get("source") or "").strip(),
            "target": (record.get("target") or "").strip(),
        }
        for record in belongs_to_records
        if (record.get("source") or "").strip() and (record.get("target") or "").strip()
    ]


def _assemble_graph_payload(
    source_label: str,
    topic_names: List[str],
    topic_keywords_by_name: Dict[str, List[str]],
    entities_by_name: Dict[str, Dict[str, Any]],
    belongs_to_pairs: List[Dict[str, str]],
    co_occurrence_records: List[Dict[str, Any]],
    min_frequency: int,
    entity_type: Optional[str],
    topic: Optional[str],
) -> Dict[str, Any]:
    active_type_filter = _normalize_optional_filter(entity_type)
    active_topic_filter = _normalize_optional_filter(topic)

    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    _add_topic_nodes(
        nodes_by_id=nodes_by_id,
        topic_names=topic_names,
        topic_keywords_by_name=topic_keywords_by_name,
        active_topic_filter=active_topic_filter,
    )

    matched_entity_names = _add_matching_entity_nodes(
        nodes_by_id=nodes_by_id,
        entities_by_name=entities_by_name,
        active_type_filter=active_type_filter,
        active_topic_filter=active_topic_filter,
        min_frequency=min_frequency,
    )

    if active_type_filter and active_type_filter != "topic":
        _add_co_occurring_neighbor_nodes(
            nodes_by_id=nodes_by_id,
            matched_entity_names=matched_entity_names,
            entities_by_name=entities_by_name,
            co_occurrence_records=co_occurrence_records,
            min_frequency=min_frequency,
        )

    edges_list = _build_graph_edges(
        nodes_by_id=nodes_by_id,
        belongs_to_pairs=belongs_to_pairs,
        co_occurrence_records=co_occurrence_records,
    )
    nodes_list = list(nodes_by_id.values())

    return {
        "source": source_label,
        "total_nodes": len(nodes_list),
        "total_edges": len(edges_list),
        "nodes": nodes_list,
        "edges": edges_list,
        "links": edges_list,
        "data": {
            "nodes": nodes_list,
            "edges": edges_list,
            "links": edges_list,
        },
    }


def _normalize_optional_filter(raw_filter: Optional[str]) -> Optional[str]:
    if not raw_filter:
        return None
    cleaned = raw_filter.strip().lower()
    if not cleaned or cleaned in ("all", "semua"):
        return None
    return cleaned


def _add_topic_nodes(
    nodes_by_id: Dict[str, Dict[str, Any]],
    topic_names: List[str],
    topic_keywords_by_name: Dict[str, List[str]],
    active_topic_filter: Optional[str],
) -> None:
    for topic_name in topic_names:
        if active_topic_filter and topic_name.lower() != active_topic_filter:
            continue
        topic_node = format_node(
            raw_name=topic_name,
            node_type="topic",
            mention_count=TOPIC_NODE_DEFAULT_WEIGHT,
            keywords=topic_keywords_by_name.get(topic_name),
        )
        nodes_by_id[topic_node["id"]] = topic_node


def _add_matching_entity_nodes(
    nodes_by_id: Dict[str, Dict[str, Any]],
    entities_by_name: Dict[str, Dict[str, Any]],
    active_type_filter: Optional[str],
    active_topic_filter: Optional[str],
    min_frequency: int,
) -> Set[str]:
    matched_entity_names: Set[str] = set()
    for entity_name, entity_info in entities_by_name.items():
        entity_category = entity_info["type"]
        mention_count = entity_info["mention_count"]
        entity_topic = entity_info["topic"]

        if active_type_filter and active_type_filter != "topic" and entity_category != active_type_filter:
            continue
        if active_topic_filter and entity_topic and entity_topic.lower() != active_topic_filter:
            continue
        if min_frequency > 0 and mention_count < min_frequency:
            continue

        matched_entity_names.add(entity_name)
        entity_node = format_node(
            raw_name=entity_name,
            node_type=entity_category,
            mention_count=mention_count,
            topic=entity_topic,
        )
        nodes_by_id[entity_node["id"]] = entity_node

    return matched_entity_names


def _add_co_occurring_neighbor_nodes(
    nodes_by_id: Dict[str, Dict[str, Any]],
    matched_entity_names: Set[str],
    entities_by_name: Dict[str, Dict[str, Any]],
    co_occurrence_records: List[Dict[str, Any]],
    min_frequency: int,
) -> None:
    for co_occurrence in co_occurrence_records:
        source_name = (co_occurrence.get("source") or "").strip()
        target_name = (co_occurrence.get("target") or "").strip()

        neighbor_name: Optional[str] = None
        if source_name in matched_entity_names and target_name in entities_by_name:
            neighbor_name = target_name
        elif target_name in matched_entity_names and source_name in entities_by_name:
            neighbor_name = source_name

        if not neighbor_name:
            continue

        neighbor_info = entities_by_name[neighbor_name]
        if min_frequency > 0 and neighbor_info["mention_count"] < min_frequency:
            continue

        neighbor_node = format_node(
            raw_name=neighbor_info["name"],
            node_type=neighbor_info["type"],
            mention_count=neighbor_info["mention_count"],
            topic=neighbor_info["topic"],
        )
        nodes_by_id[neighbor_node["id"]] = neighbor_node


def _build_graph_edges(
    nodes_by_id: Dict[str, Dict[str, Any]],
    belongs_to_pairs: List[Dict[str, str]],
    co_occurrence_records: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    edges_list: List[Dict[str, Any]] = []

    for pair in belongs_to_pairs:
        source_name = pair["source"]
        target_topic = pair["target"]
        source_id = f"entity_{source_name}"
        target_id = f"topic_{target_topic}"
        if source_id in nodes_by_id and target_id in nodes_by_id:
            edges_list.append(_create_belongs_to_topic_edge(source_name, target_topic, source_id, target_id))

    for co_occurrence in co_occurrence_records:
        source_name = (co_occurrence.get("source") or "").strip()
        target_name = (co_occurrence.get("target") or "").strip()
        source_id = f"entity_{source_name}"
        target_id = f"entity_{target_name}"
        if source_id in nodes_by_id and target_id in nodes_by_id:
            edges_list.append(_create_co_occurs_with_edge(co_occurrence, source_name, target_name, source_id, target_id))

    return edges_list


def _create_belongs_to_topic_edge(
    source_name: str,
    target_topic: str,
    source_id: str,
    target_id: str,
) -> Dict[str, Any]:
    return {
        "id": f"rel_bt_{source_name}_{target_topic}",
        "from": source_id,
        "to": target_id,
        "source": source_id,
        "target": target_id,
        "source_name": source_name,
        "target_name": target_topic,
        "label": "BELONGS_TO_TOPIC",
        "type": "BELONGS_TO_TOPIC",
        "relationship": "BELONGS_TO_TOPIC",
        "weight": 1,
        "value": 1,
        "style": "dashed",
    }


def _create_co_occurs_with_edge(
    co_occurrence: Dict[str, Any],
    source_name: str,
    target_name: str,
    source_id: str,
    target_id: str,
) -> Dict[str, Any]:
    npmi_weight = float(co_occurrence.get("weight") or 0.5)
    cooccur_count = int(co_occurrence.get("cooccur") or 3)
    pmi_score = float(co_occurrence.get("pmi") or 0.0)

    return {
        "id": f"rel_co_{source_name}_{target_name}",
        "from": source_id,
        "to": target_id,
        "source": source_id,
        "target": target_id,
        "source_name": source_name,
        "target_name": target_name,
        "label": f"CO_OCCURS_WITH (NPMI {npmi_weight:.2f})",
        "type": "CO_OCCURS_WITH",
        "relationship": "CO_OCCURS_WITH",
        "weight": round(npmi_weight, 4),
        "npmi": round(npmi_weight, 4),
        "value": cooccur_count,
        "cooccur": cooccur_count,
        "pmi": round(pmi_score, 4),
        "style": "solid",
    }


MBG_ENTITIES_FALLBACK: List[Dict[str, Any]] = [
    {"name": "prabowo", "type": "person", "mention_count": 574, "freq": 574, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "prabowo subianto", "type": "person", "mention_count": 490, "freq": 490, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "zulkifli hasan", "type": "person", "mention_count": 71, "freq": 71, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "budi gunadi sadikin", "type": "person", "mention_count": 25, "freq": 25, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sudaryono", "type": "person", "mention_count": 15, "freq": 15, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "tito", "type": "person", "mention_count": 13, "freq": 13, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "yahya zaini", "type": "person", "mention_count": 13, "freq": 13, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "zulkifli hasan zulhas", "type": "person", "mention_count": 13, "freq": 13, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "amithya ratnanggani sirraduhita", "type": "person", "mention_count": 12, "freq": 12, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "hasan", "type": "person", "mention_count": 8, "freq": 8, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "tito karnavian", "type": "person", "mention_count": 8, "freq": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "zulhas", "type": "person", "mention_count": 8, "freq": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "andi amran sulaiman", "type": "person", "mention_count": 7, "freq": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sri mulyani", "type": "person", "mention_count": 7, "freq": 7, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "hasan nasbi", "type": "person", "mention_count": 6, "freq": 6, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "agus haris", "type": "person", "mention_count": 5, "freq": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "charles", "type": "person", "mention_count": 5, "freq": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "rachmat", "type": "person", "mention_count": 5, "freq": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sultan", "type": "person", "mention_count": 3, "freq": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "badan gizi nasional bgn", "type": "organization", "mention_count": 285, "freq": 285, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "bgn", "type": "organization", "mention_count": 70, "freq": 70, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "kepala bgn", "type": "organization", "mention_count": 50, "freq": 50, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "pt garuda muda karya", "type": "organization", "mention_count": 22, "freq": 22, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "mbg watch", "type": "organization", "mention_count": 17, "freq": 17, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "mitra dapur bigboss", "type": "organization", "mention_count": 13, "freq": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "sppg hilir kantor iv ngabang", "type": "organization", "mention_count": 13, "freq": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "kompas com", "type": "organization", "mention_count": 12, "freq": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "rri", "type": "organization", "mention_count": 5, "freq": 5, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "tvone", "type": "organization", "mention_count": 5, "freq": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "yonsei university", "type": "organization", "mention_count": 4, "freq": 4, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "japan international cooperation agency jica", "type": "organization", "mention_count": 3, "freq": 3, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "jakarta", "type": "geopolitical", "mention_count": 172, "freq": 172, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "papua", "type": "geopolitical", "mention_count": 70, "freq": 70, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jepang", "type": "geopolitical", "mention_count": 64, "freq": 64, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "jawa barat", "type": "geopolitical", "mention_count": 26, "freq": 26, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "ntt", "type": "geopolitical", "mention_count": 23, "freq": 23, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "india", "type": "geopolitical", "mention_count": 21, "freq": 21, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa timur", "type": "geopolitical", "mention_count": 20, "freq": 20, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa tengah", "type": "geopolitical", "mention_count": 19, "freq": 19, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa", "type": "geopolitical", "mention_count": 18, "freq": 18, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "australia", "type": "geopolitical", "mention_count": 17, "freq": 17, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "malang", "type": "geopolitical", "mention_count": 16, "freq": 16, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "maluku", "type": "geopolitical", "mention_count": 16, "freq": 16, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "aceh", "type": "geopolitical", "mention_count": 15, "freq": 15, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "makassar", "type": "geopolitical", "mention_count": 14, "freq": 14, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "korea", "type": "geopolitical", "mention_count": 13, "freq": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "amerika serikat", "type": "geopolitical", "mention_count": 12, "freq": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "eropa", "type": "geopolitical", "mention_count": 10, "freq": 10, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "sulawesi selatan", "type": "geopolitical", "mention_count": 10, "freq": 10, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "blitar", "type": "geopolitical", "mention_count": 7, "freq": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jayapura", "type": "geopolitical", "mention_count": 7, "freq": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "kendari", "type": "geopolitical", "mention_count": 6, "freq": 6, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "madura", "type": "geopolitical", "mention_count": 5, "freq": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sulawesi", "type": "geopolitical", "mention_count": 5, "freq": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "swedia", "type": "geopolitical", "mention_count": 5, "freq": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "bangkalan", "type": "geopolitical", "mention_count": 4, "freq": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "selandia baru", "type": "geopolitical", "mention_count": 3, "freq": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "makodim 0809 kota bontang", "type": "location", "mention_count": 4, "freq": 4, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "batu besar", "type": "location", "mention_count": 3, "freq": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "httpurl", "type": "location", "mention_count": 3, "freq": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "kav senjulung", "type": "location", "mention_count": 3, "freq": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "nongsa c", "type": "location", "mention_count": 3, "freq": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "nasi putih", "type": "product", "mention_count": 44, "freq": 44, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "tahu goreng", "type": "product", "mention_count": 35, "freq": 35, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur", "type": "product", "mention_count": 27, "freq": 27, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "tahu", "type": "product", "mention_count": 23, "freq": 23, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur rebus", "type": "product", "mention_count": 23, "freq": 23, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "susu sapi", "type": "product", "mention_count": 22, "freq": 22, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu", "type": "product", "mention_count": 17, "freq": 17, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu pasteurisasi", "type": "product", "mention_count": 15, "freq": 15, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu ikan", "type": "product", "mention_count": 14, "freq": 14, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "daging ayam", "type": "product", "mention_count": 13, "freq": 13, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur ceplok", "type": "product", "mention_count": 11, "freq": 11, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur ayam", "type": "product", "mention_count": 10, "freq": 10, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur puyuh", "type": "product", "mention_count": 9, "freq": 9, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "hp android", "type": "product", "mention_count": 7, "freq": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "instagram", "type": "product", "mention_count": 7, "freq": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "kamera", "type": "product", "mention_count": 7, "freq": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "telur dadar", "type": "product", "mention_count": 7, "freq": 7, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "susu kambing", "type": "product", "mention_count": 6, "freq": 6, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu pasteurisasi uht", "type": "product", "mention_count": 5, "freq": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu segar", "type": "product", "mention_count": 5, "freq": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu kerbau", "type": "product", "mention_count": 4, "freq": 4, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu steril full cream plain", "type": "product", "mention_count": 4, "freq": 4, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu uht susu steril full cream plain", "type": "product", "mention_count": 4, "freq": 4, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "pilpres 2024", "type": "event", "mention_count": 15, "freq": 15, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "2045", "type": "event", "mention_count": 12, "freq": 12, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "lampung", "type": "event", "mention_count": 11, "freq": 11, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sidang bersama", "type": "event", "mention_count": 11, "freq": 11, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "sidang tahunan", "type": "event", "mention_count": 11, "freq": 11, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "eastern economic forum eef ke 11", "type": "event", "mention_count": 9, "freq": 9, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "sidang tahunan mpr", "type": "event", "mention_count": 9, "freq": 9, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "seminar koperasi desa kelurahan merah putih", "type": "event", "mention_count": 8, "freq": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "seminar nasional koperasi desa kelurahan merah putih kdkmp", "type": "event", "mention_count": 5, "freq": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "seminar koperasi desa kelurahan merah putih kdkmp", "type": "event", "mention_count": 4, "freq": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "dpr", "type": "norm", "mention_count": 90, "freq": 90, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "presiden ri", "type": "norm", "mention_count": 58, "freq": 58, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "polri", "type": "norm", "mention_count": 54, "freq": 54, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pemerintah pusat", "type": "norm", "mention_count": 37, "freq": 37, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri keuangan", "type": "norm", "mention_count": 36, "freq": 36, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "komisi ix dpr ri", "type": "norm", "mention_count": 31, "freq": 31, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "dpr ri", "type": "norm", "mention_count": 28, "freq": 28, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "ketua dprd kota malang", "type": "norm", "mention_count": 24, "freq": 24, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "tni", "type": "norm", "mention_count": 23, "freq": 23, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "wakil ketua komisi ix dpr ri", "type": "norm", "mention_count": 22, "freq": 22, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian pertahanan", "type": "norm", "mention_count": 19, "freq": 19, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian kesehatan", "type": "norm", "mention_count": 18, "freq": 18, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "ketua dpd ri", "type": "norm", "mention_count": 13, "freq": 13, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pdip", "type": "norm", "mention_count": 13, "freq": 13, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "menteri dalam negeri", "type": "norm", "mention_count": 12, "freq": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri kesehatan", "type": "norm", "mention_count": 11, "freq": 11, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wakil presiden", "type": "norm", "mention_count": 9, "freq": 9, "topic": "Program Makan Bergizi Gratis"},
    {"name": "kementerian agama", "type": "norm", "mention_count": 8, "freq": 8, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kpu", "type": "norm", "mention_count": 8, "freq": 8, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "gerindra", "type": "norm", "mention_count": 6, "freq": 6, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "komisi ii dpr ri", "type": "norm", "mention_count": 6, "freq": 6, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "menteri pertanian", "type": "norm", "mention_count": 6, "freq": 6, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wali kota solo", "type": "norm", "mention_count": 6, "freq": 6, "topic": "Program Makan Bergizi Gratis"},
    {"name": "wakil presiden wapres", "type": "norm", "mention_count": 5, "freq": 5, "topic": "Program Makan Bergizi Gratis"},
    {"name": "wakil wali kota bontang", "type": "norm", "mention_count": 5, "freq": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pemkab malang", "type": "norm", "mention_count": 4, "freq": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wakil menteri pertanian", "type": "norm", "mention_count": 4, "freq": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wapres ri", "type": "norm", "mention_count": 4, "freq": 4, "topic": "Program Makan Bergizi Gratis"},
    {"name": "kemenhan", "type": "norm", "mention_count": 3, "freq": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian pekerjaan umum", "type": "norm", "mention_count": 3, "freq": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian sosial", "type": "norm", "mention_count": 3, "freq": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "menteri koordinator bidang pangan republik indonesia", "type": "norm", "mention_count": 3, "freq": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri perencanaan pembangunan nasional ppn kepala bappenas", "type": "norm", "mention_count": 3, "freq": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"},
]

MBG_RAW_ENTITIES = MBG_ENTITIES_FALLBACK

MBG_TOPICS_FALLBACK: List[str] = [
    "Program Makan Bergizi Gratis (MBG)",
    "Evaluasi Program Makan Bergizi Gratis",
    "Kontroversi Program Makan Bergizi Gratis MBG",
    "Program Makan Bergizi Sekolah",
    "Program Makan Bergizi Gratis Indonesia",
    "Pemanfaatan susu segar nasional",
    "Program Makan Bergizi Gratis di Kendari",
    "Program Makan Bergizi Gratis",
    "Lainnya / Tidak terklasifikasi",
]

MBG_CO_OCCURS_FALLBACK: List[Dict[str, Any]] = [
    {"source": "papua", "target": "sulawesi", "weight": 0.5909, "cooccur": 4, "pmi": 4.4558},
    {"source": "papua", "target": "ntt", "weight": 0.4998, "cooccur": 7, "pmi": 3.4894},
    {"source": "papua", "target": "maluku", "weight": 0.5518, "cooccur": 7, "pmi": 3.8523},
    {"source": "papua", "target": "aceh", "weight": 0.4893, "cooccur": 5, "pmi": 3.5803},
    {"source": "jawa barat", "target": "jawa timur", "weight": 0.5853, "cooccur": 5, "pmi": 4.2831},
    {"source": "jawa barat", "target": "jawa tengah", "weight": 0.5923, "cooccur": 5, "pmi": 4.3343},
    {"source": "jawa barat", "target": "kompas com", "weight": 0.5471, "cooccur": 3, "pmi": 4.2831},
    {"source": "amerika serikat", "target": "india", "weight": 0.5744, "cooccur": 3, "pmi": 4.4966},
    {"source": "india", "target": "swedia", "weight": 0.6862, "cooccur": 3, "pmi": 5.3721},
    {"source": "jakarta", "target": "bangkalan", "weight": 0.4461, "cooccur": 3, "pmi": 3.4923},
    {"source": "prabowo", "target": "prabowo subianto", "weight": 0.4149, "cooccur": 177, "pmi": 1.5566},
    {"source": "prabowo subianto", "target": "presiden ri", "weight": 0.7032, "cooccur": 69, "pmi": 3.2997},
    {"source": "australia", "target": "blitar", "weight": 0.6702, "cooccur": 3, "pmi": 5.2469},
    {"source": "australia", "target": "malang", "weight": 0.5646, "cooccur": 3, "pmi": 4.4203},
    {"source": "australia", "target": "selandia baru", "weight": 0.7784, "cooccur": 3, "pmi": 6.0942},
    {"source": "pilpres 2024", "target": "kpu", "weight": 0.6691, "cooccur": 3, "pmi": 5.2386},
    {"source": "menteri keuangan", "target": "sri mulyani", "weight": 0.6843, "cooccur": 5, "pmi": 5.0075},
    {"source": "budi gunadi sadikin", "target": "zulkifli hasan", "weight": 0.5413, "cooccur": 9, "pmi": 3.6431},
    {"source": "budi gunadi sadikin", "target": "menteri kesehatan", "weight": 0.8184, "cooccur": 9, "pmi": 5.5079},
    {"source": "menteri kesehatan", "target": "zulkifli hasan", "weight": 0.5297, "cooccur": 5, "pmi": 3.8763},
    {"source": "blitar", "target": "malang", "weight": 0.678, "cooccur": 3, "pmi": 5.3076},
    {"source": "jawa timur", "target": "jawa tengah", "weight": 0.58, "cooccur": 4, "pmi": 4.3736},
    {"source": "susu kambing", "target": "susu kerbau", "weight": 0.9462, "cooccur": 4, "pmi": 7.1357},
    {"source": "susu kambing", "target": "tvone", "weight": 0.8462, "cooccur": 3, "pmi": 6.6249},
    {"source": "susu kambing", "target": "susu sapi", "weight": 0.7202, "cooccur": 4, "pmi": 5.4309},
    {"source": "susu kerbau", "target": "tvone", "weight": 0.898, "cooccur": 3, "pmi": 7.0303},
    {"source": "susu kerbau", "target": "susu sapi", "weight": 0.7739, "cooccur": 4, "pmi": 5.8364},
    {"source": "susu sapi", "target": "susu ikan", "weight": 0.882, "cooccur": 24, "pmi": 5.6823},
    {"source": "susu sapi", "target": "tvone", "weight": 0.6803, "cooccur": 3, "pmi": 5.3256},
    {"source": "korea", "target": "yonsei university", "weight": 0.776, "cooccur": 3, "pmi": 6.0748},
    {"source": "andi amran sulaiman", "target": "menteri pertanian", "weight": 0.872, "cooccur": 4, "pmi": 6.5761},
    {"source": "jawa tengah", "target": "jayapura", "weight": 0.656, "cooccur": 3, "pmi": 5.1357},
    {"source": "hasan", "target": "rri", "weight": 0.8095, "cooccur": 3, "pmi": 6.3372},
    {"source": "pemerintah pusat", "target": "pemkab malang", "weight": 0.6423, "cooccur": 3, "pmi": 5.0288},
    {"source": "tni", "target": "polri", "weight": 0.5944, "cooccur": 12, "pmi": 4.0002},
    {"source": "hasan nasbi", "target": "kendari", "weight": 0.8925, "cooccur": 4, "pmi": 6.7302},
    {"source": "makassar", "target": "sulawesi selatan", "weight": 0.7124, "cooccur": 4, "pmi": 5.3721},
    {"source": "jepang", "target": "japan international cooperation agency jica", "weight": 0.6091, "cooccur": 3, "pmi": 4.7686},
    {"source": "jepang", "target": "eropa", "weight": 0.6319, "cooccur": 7, "pmi": 4.4119},
    {"source": "presiden ri", "target": "eastern economic forum eef ke 11", "weight": 0.4813, "cooccur": 3, "pmi": 3.7684},
    {"source": "badan gizi nasional bgn", "target": "kepala bgn", "weight": 0.4092, "cooccur": 21, "pmi": 2.4075},
    {"source": "kepala bgn", "target": "bgn", "weight": 0.4404, "cooccur": 9, "pmi": 2.9642},
    {"source": "menteri perencanaan pembangunan nasional ppn kepala bappenas", "target": "rachmat", "weight": 0.9348, "cooccur": 3, "pmi": 7.318},
    {"source": "kementerian pertahanan", "target": "kementerian pekerjaan umum", "weight": 0.7642, "cooccur": 3, "pmi": 5.983},
    {"source": "kementerian pertahanan", "target": "kementerian kesehatan", "weight": 0.5354, "cooccur": 3, "pmi": 4.1912},
    {"source": "kementerian pertahanan", "target": "polri", "weight": 0.4924, "cooccur": 5, "pmi": 3.6035},
    {"source": "kementerian pertahanan", "target": "kementerian sosial", "weight": 0.7642, "cooccur": 3, "pmi": 5.983},
    {"source": "kementerian pertahanan", "target": "kementerian agama", "weight": 0.6389, "cooccur": 3, "pmi": 5.0022},
    {"source": "polri", "target": "kemenhan", "weight": 0.6308, "cooccur": 3, "pmi": 4.9385},
    {"source": "dpr ri", "target": "ketua dprd kota malang", "weight": 0.5044, "cooccur": 4, "pmi": 3.8035},
    {"source": "dpr ri", "target": "dpr", "weight": 0.4636, "cooccur": 8, "pmi": 3.1749},
    {"source": "dpr ri", "target": "amithya ratnanggani sirraduhita", "weight": 0.5376, "cooccur": 3, "pmi": 4.2089},
    {"source": "tahu", "target": "telur", "weight": 0.4592, "cooccur": 3, "pmi": 3.5947},
    {"source": "telur", "target": "daging ayam", "weight": 0.532, "cooccur": 3, "pmi": 4.1653},
    {"source": "telur ayam", "target": "telur puyuh", "weight": 0.7059, "cooccur": 3, "pmi": 5.5262},
    {"source": "zulkifli hasan", "target": "seminar nasional koperasi desa kelurahan merah putih kdkmp", "weight": 0.6374, "cooccur": 5, "pmi": 4.6648},
    {"source": "zulkifli hasan", "target": "zulhas", "weight": 0.6134, "cooccur": 6, "pmi": 4.3771},
    {"source": "zulkifli hasan", "target": "menteri koordinator bidang pangan republik indonesia", "weight": 0.5958, "cooccur": 3, "pmi": 4.6648},
    {"source": "zulkifli hasan", "target": "seminar koperasi desa kelurahan merah putih", "weight": 0.5732, "cooccur": 5, "pmi": 4.1948},
    {"source": "ketua dpd ri", "target": "sultan", "weight": 0.8127, "cooccur": 3, "pmi": 6.3625},
    {"source": "pdip", "target": "gerindra", "weight": 0.7242, "cooccur": 3, "pmi": 5.6694},
    {"source": "dpr", "target": "komisi ii dpr ri", "weight": 0.5334, "cooccur": 4, "pmi": 4.0222},
    {"source": "yahya zaini", "target": "wakil ketua komisi ix dpr ri", "weight": 0.8935, "cooccur": 12, "pmi": 5.7564},
    {"source": "telur dadar", "target": "telur ceplok", "weight": 0.7258, "cooccur": 3, "pmi": 5.6823},
    {"source": "telur dadar", "target": "telur rebus", "weight": 0.6316, "cooccur": 3, "pmi": 4.9447},
    {"source": "telur rebus", "target": "telur ceplok", "weight": 0.5739, "cooccur": 3, "pmi": 4.4927},
    {"source": "amithya ratnanggani sirraduhita", "target": "ketua dprd kota malang", "weight": 0.8115, "cooccur": 9, "pmi": 5.4617},
    {"source": "wakil presiden wapres", "target": "wali kota solo", "weight": 0.8462, "cooccur": 3, "pmi": 6.6249},
    {"source": "komisi ix dpr ri", "target": "mbg watch", "weight": 0.4801, "cooccur": 3, "pmi": 3.7589},
    {"source": "zulkifli hasan zulhas", "target": "seminar koperasi desa kelurahan merah putih", "weight": 0.6874, "cooccur": 3, "pmi": 5.3817},
    {"source": "sudaryono", "target": "wakil menteri pertanian", "weight": 0.7577, "cooccur": 3, "pmi": 5.9317},
    {"source": "jawa", "target": "madura", "weight": 0.7059, "cooccur": 3, "pmi": 5.5262},
    {"source": "jawa", "target": "pt garuda muda karya", "weight": 0.5745, "cooccur": 4, "pmi": 4.3323},
    {"source": "wakil presiden", "target": "wapres ri", "weight": 0.8229, "cooccur": 3, "pmi": 6.4425},
    {"source": "charles", "target": "wakil ketua komisi ix dpr ri", "weight": 0.7444, "cooccur": 4, "pmi": 5.6133},
    {"source": "hp android", "target": "instagram", "weight": 1.0, "cooccur": 7, "pmi": 6.9815},
    {"source": "hp android", "target": "kamera", "weight": 1.0, "cooccur": 7, "pmi": 6.9815},
    {"source": "instagram", "target": "kamera", "weight": 1.0, "cooccur": 7, "pmi": 6.9815},
    {"source": "nasi putih", "target": "tahu goreng", "weight": 0.5062, "cooccur": 7, "pmi": 3.5338},
    {"source": "sidang bersama", "target": "sidang tahunan mpr", "weight": 0.7583, "cooccur": 4, "pmi": 5.7186},
    {"source": "sidang bersama", "target": "sidang tahunan", "weight": 0.7317, "cooccur": 4, "pmi": 5.518},
    {"source": "menteri dalam negeri", "target": "tito", "weight": 0.6356, "cooccur": 3, "pmi": 4.9762},
    {"source": "menteri dalam negeri", "target": "tito karnavian", "weight": 0.6976, "cooccur": 3, "pmi": 5.4617},
    {"source": "tito", "target": "tito karnavian", "weight": 0.7518, "cooccur": 4, "pmi": 5.6694},
    {"source": "kementerian agama", "target": "kementerian sosial", "weight": 0.8747, "cooccur": 3, "pmi": 6.848},
    {"source": "kementerian agama", "target": "kementerian pekerjaan umum", "weight": 0.8747, "cooccur": 3, "pmi": 6.848},
    {"source": "kementerian agama", "target": "kementerian kesehatan", "weight": 0.6458, "cooccur": 3, "pmi": 5.0562},
    {"source": "kementerian kesehatan", "target": "kementerian pekerjaan umum", "weight": 0.7711, "cooccur": 3, "pmi": 6.0371},
    {"source": "kementerian kesehatan", "target": "kementerian sosial", "weight": 0.7711, "cooccur": 3, "pmi": 6.0371},
    {"source": "kementerian pekerjaan umum", "target": "kementerian sosial", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "batu besar", "target": "nongsa c", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "batu besar", "target": "kav senjulung", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "batu besar", "target": "httpurl", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "httpurl", "target": "nongsa c", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "httpurl", "target": "kav senjulung", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "kav senjulung", "target": "nongsa c", "weight": 1.0, "cooccur": 3, "pmi": 7.8288},
    {"source": "2045", "target": "mitra dapur bigboss", "weight": 0.9876, "cooccur": 12, "pmi": 6.3625},
    {"source": "2045", "target": "sppg hilir kantor iv ngabang", "weight": 0.9876, "cooccur": 12, "pmi": 6.3625},
    {"source": "mitra dapur bigboss", "target": "sppg hilir kantor iv ngabang", "weight": 1.0, "cooccur": 13, "pmi": 6.3625},
    {"source": "seminar koperasi desa kelurahan merah putih", "target": "lampung", "weight": 0.7088, "cooccur": 3, "pmi": 5.5487},
    {"source": "susu", "target": "susu pasteurisasi uht", "weight": 0.7785, "cooccur": 4, "pmi": 5.8711},
    {"source": "susu pasteurisasi uht", "target": "susu steril full cream plain", "weight": 0.898, "cooccur": 3, "pmi": 7.0303},
    {"source": "susu pasteurisasi", "target": "susu segar", "weight": 0.7951, "cooccur": 4, "pmi": 5.9963},
    {"source": "susu pasteurisasi", "target": "susu uht susu steril full cream plain", "weight": 0.8247, "cooccur": 4, "pmi": 6.2194},
    {"source": "susu segar", "target": "susu uht susu steril full cream plain", "weight": 0.9704, "cooccur": 4, "pmi": 7.318},
    {"source": "zulhas", "target": "seminar koperasi desa kelurahan merah putih kdkmp", "weight": 0.838, "cooccur": 3, "pmi": 6.5603},
    {"source": "agus haris", "target": "makodim 0809 kota bontang", "weight": 0.9704, "cooccur": 4, "pmi": 7.318},
    {"source": "agus haris", "target": "wakil wali kota bontang", "weight": 1.0, "cooccur": 5, "pmi": 7.318},
    {"source": "makodim 0809 kota bontang", "target": "wakil wali kota bontang", "weight": 0.9704, "cooccur": 4, "pmi": 7.318},
]

MBG_CO_OCCURS_EDGES = MBG_CO_OCCURS_FALLBACK
