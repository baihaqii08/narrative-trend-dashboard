from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.api.dependencies import get_db
from models import Topic, Post, Entity
from app.core.database import neo4j_driver

router = APIRouter(tags=["Graph"])

# 8 Tipe Entity Resmi sesuai Spesifikasi Dataset MBG (KG_MBG.ipynb)
ENTITY_COLOR_MAP = {
    "topic": "#f97316",         # Orange
    "person": "#8b5cf6",        # Purple
    "organization": "#3b82f6",  # Blue
    "geopolitical": "#06b6d4",  # Cyan
    "location": "#10b981",      # Emerald Green
    "product": "#eab308",       # Amber
    "event": "#ec4899",         # Pink
    "norm": "#ef4444",          # Red
    "facility": "#14b8a6",      # Teal
}

# 128 Entity Resmi MBG dari Spesifikasi Dataset
MBG_ENTITIES_FALLBACK = [
    # person (19)
    {"name": "prabowo", "type": "person", "mention_count": 574, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "prabowo subianto", "type": "person", "mention_count": 490, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "zulkifli hasan", "type": "person", "mention_count": 71, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "budi gunadi sadikin", "type": "person", "mention_count": 25, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sudaryono", "type": "person", "mention_count": 15, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "tito", "type": "person", "mention_count": 13, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "yahya zaini", "type": "person", "mention_count": 13, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "zulkifli hasan zulhas", "type": "person", "mention_count": 13, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "amithya ratnanggani sirraduhita", "type": "person", "mention_count": 12, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "hasan", "type": "person", "mention_count": 8, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "tito karnavian", "type": "person", "mention_count": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "zulhas", "type": "person", "mention_count": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "andi amran sulaiman", "type": "person", "mention_count": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sri mulyani", "type": "person", "mention_count": 7, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "hasan nasbi", "type": "person", "mention_count": 6, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "agus haris", "type": "person", "mention_count": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "charles", "type": "person", "mention_count": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "rachmat", "type": "person", "mention_count": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sultan", "type": "person", "mention_count": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},

    # organization (12)
    {"name": "badan gizi nasional bgn", "type": "organization", "mention_count": 285, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "bgn", "type": "organization", "mention_count": 70, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "kepala bgn", "type": "organization", "mention_count": 50, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "pt garuda muda karya", "type": "organization", "mention_count": 22, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "mbg watch", "type": "organization", "mention_count": 17, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "mitra dapur bigboss", "type": "organization", "mention_count": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "sppg hilir kantor iv ngabang", "type": "organization", "mention_count": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "kompas com", "type": "organization", "mention_count": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "rri", "type": "organization", "mention_count": 5, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "tvone", "type": "organization", "mention_count": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "yonsei university", "type": "organization", "mention_count": 4, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "japan international cooperation agency jica", "type": "organization", "mention_count": 3, "topic": "Program Makan Bergizi Gratis Indonesia"},

    # geopolitical (26)
    {"name": "jakarta", "type": "geopolitical", "mention_count": 172, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "papua", "type": "geopolitical", "mention_count": 70, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jepang", "type": "geopolitical", "mention_count": 64, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "jawa barat", "type": "geopolitical", "mention_count": 26, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "ntt", "type": "geopolitical", "mention_count": 23, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "india", "type": "geopolitical", "mention_count": 21, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa timur", "type": "geopolitical", "mention_count": 20, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa tengah", "type": "geopolitical", "mention_count": 19, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jawa", "type": "geopolitical", "mention_count": 18, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "australia", "type": "geopolitical", "mention_count": 17, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "malang", "type": "geopolitical", "mention_count": 16, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "maluku", "type": "geopolitical", "mention_count": 16, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "aceh", "type": "geopolitical", "mention_count": 15, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "makassar", "type": "geopolitical", "mention_count": 14, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "korea", "type": "geopolitical", "mention_count": 13, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "amerika serikat", "type": "geopolitical", "mention_count": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "eropa", "type": "geopolitical", "mention_count": 10, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "sulawesi selatan", "type": "geopolitical", "mention_count": 10, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "blitar", "type": "geopolitical", "mention_count": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "jayapura", "type": "geopolitical", "mention_count": 7, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "kendari", "type": "geopolitical", "mention_count": 6, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "madura", "type": "geopolitical", "mention_count": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sulawesi", "type": "geopolitical", "mention_count": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "swedia", "type": "geopolitical", "mention_count": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "bangkalan", "type": "geopolitical", "mention_count": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "selandia baru", "type": "geopolitical", "mention_count": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"},

    # location (5)
    {"name": "makodim 0809 kota bontang", "type": "location", "mention_count": 4, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "batu besar", "type": "location", "mention_count": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "httpurl", "type": "location", "mention_count": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "kav senjulung", "type": "location", "mention_count": 3, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "nongsa c", "type": "location", "mention_count": 3, "topic": "Lainnya / Tidak terklasifikasi"},

    # product (23)
    {"name": "nasi putih", "type": "product", "mention_count": 44, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "tahu goreng", "type": "product", "mention_count": 35, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur", "type": "product", "mention_count": 27, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "tahu", "type": "product", "mention_count": 23, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur rebus", "type": "product", "mention_count": 23, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "susu sapi", "type": "product", "mention_count": 22, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu", "type": "product", "mention_count": 17, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu pasteurisasi", "type": "product", "mention_count": 15, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu ikan", "type": "product", "mention_count": 14, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "daging ayam", "type": "product", "mention_count": 13, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur ceplok", "type": "product", "mention_count": 11, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur ayam", "type": "product", "mention_count": 10, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "telur puyuh", "type": "product", "mention_count": 9, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "hp android", "type": "product", "mention_count": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "instagram", "type": "product", "mention_count": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "kamera", "type": "product", "mention_count": 7, "topic": "Lainnya / Tidak terklasifikasi"},
    {"name": "telur dadar", "type": "product", "mention_count": 7, "topic": "Program Makan Bergizi Sekolah"},
    {"name": "susu kambing", "type": "product", "mention_count": 6, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu pasteurisasi uht", "type": "product", "mention_count": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu segar", "type": "product", "mention_count": 5, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu kerbau", "type": "product", "mention_count": 4, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu steril full cream plain", "type": "product", "mention_count": 4, "topic": "Pemanfaatan susu segar nasional"},
    {"name": "susu uht susu steril full cream plain", "type": "product", "mention_count": 4, "topic": "Pemanfaatan susu segar nasional"},

    # event (10)
    {"name": "pilpres 2024", "type": "event", "mention_count": 15, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "2045", "type": "event", "mention_count": 12, "topic": "Program Makan Bergizi Gratis Indonesia"},
    {"name": "lampung", "type": "event", "mention_count": 11, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "sidang bersama", "type": "event", "mention_count": 11, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "sidang tahunan", "type": "event", "mention_count": 11, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "eastern economic forum eef ke 11", "type": "event", "mention_count": 9, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "sidang tahunan mpr", "type": "event", "mention_count": 9, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "seminar koperasi desa kelurahan merah putih", "type": "event", "mention_count": 8, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "seminar nasional koperasi desa kelurahan merah putih kdkmp", "type": "event", "mention_count": 5, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "seminar koperasi desa kelurahan merah putih kdkmp", "type": "event", "mention_count": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},

    # norm (33)
    {"name": "dpr", "type": "norm", "mention_count": 90, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "presiden ri", "type": "norm", "mention_count": 58, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "polri", "type": "norm", "mention_count": 54, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pemerintah pusat", "type": "norm", "mention_count": 37, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri keuangan", "type": "norm", "mention_count": 36, "topic": "Program Makan Bergizi Gratis di Kendari"},
    {"name": "komisi ix dpr ri", "type": "norm", "mention_count": 31, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "dpr ri", "type": "norm", "mention_count": 28, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "ketua dprd kota malang", "type": "norm", "mention_count": 24, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "tni", "type": "norm", "mention_count": 23, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "wakil ketua komisi ix dpr ri", "type": "norm", "mention_count": 22, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian pertahanan", "type": "norm", "mention_count": 19, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian kesehatan", "type": "norm", "mention_count": 18, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "ketua dpd ri", "type": "norm", "mention_count": 13, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pdip", "type": "norm", "mention_count": 13, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "menteri dalam negeri", "type": "norm", "mention_count": 12, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri kesehatan", "type": "norm", "mention_count": 11, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wakil presiden", "type": "norm", "mention_count": 9, "topic": "Program Makan Bergizi Gratis"},
    {"name": "kementerian agama", "type": "norm", "mention_count": 8, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kpu", "type": "norm", "mention_count": 8, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "gerindra", "type": "norm", "mention_count": 6, "topic": "Program Makan Bergizi Gratis (MBG)"},
    {"name": "komisi ii dpr ri", "type": "norm", "mention_count": 6, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "menteri pertanian", "type": "norm", "mention_count": 6, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wali kota solo", "type": "norm", "mention_count": 6, "topic": "Program Makan Bergizi Gratis"},
    {"name": "wakil presiden wapres", "type": "norm", "mention_count": 5, "topic": "Program Makan Bergizi Gratis"},
    {"name": "wakil wali kota bontang", "type": "norm", "mention_count": 5, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "pemkab malang", "type": "norm", "mention_count": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wakil menteri pertanian", "type": "norm", "mention_count": 4, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "wapres ri", "type": "norm", "mention_count": 4, "topic": "Program Makan Bergizi Gratis"},
    {"name": "kemenhan", "type": "norm", "mention_count": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian pekerjaan umum", "type": "norm", "mention_count": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "kementerian sosial", "type": "norm", "mention_count": 3, "topic": "Kontroversi Program Makan Bergizi Gratis MBG"},
    {"name": "menteri koordinator bidang pangan republik indonesia", "type": "norm", "mention_count": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"},
    {"name": "menteri perencanaan pembangunan nasional ppn kepala bappenas", "type": "norm", "mention_count": 3, "topic": "Evaluasi Program Makan Bergizi Gratis"}
]

MBG_TOPICS_FALLBACK = [
    "Program Makan Bergizi Gratis (MBG)",
    "Evaluasi Program Makan Bergizi Gratis",
    "Kontroversi Program Makan Bergizi Gratis MBG",
    "Program Makan Bergizi Sekolah",
    "Program Makan Bergizi Gratis Indonesia",
    "Pemanfaatan susu segar nasional",
    "Program Makan Bergizi Gratis di Kendari",
    "Susu ikan sebagai pengganti susu sapi",
    "Program Makan Bergizi Gratis"
]

def format_node(raw_name: str, node_type: str, mention_count: int, topic: Optional[str] = None, keywords: Optional[List[str]] = None) -> Dict[str, Any]:
    norm_type = node_type.lower()
    color = ENTITY_COLOR_MAP.get(norm_type, "#64748b")
    is_topic = norm_type == "topic"
    
    # Scale node size based on mention_count
    if is_topic:
        size = 32
        val = 40
    else:
        size = max(16, min(36, 16 + (mention_count // 20)))
        val = mention_count

    clean_label = raw_name.strip()
    return {
        "id": f"topic_{clean_label}" if is_topic else f"entity_{clean_label}",
        "name": clean_label,
        "label": clean_label,
        "title": f"{clean_label} ({node_type.capitalize()} - {val} mentions)",
        "category": node_type.capitalize(),
        "type": norm_type,
        "group": norm_type,
        "val": val,
        "value": val,
        "size": size,
        "color": color,
        "mention_count": val,
        "topic": topic,
        "keywords": keywords or []
    }

def fetch_live_neo4j_graph(
    min_freq: Optional[int] = 0,
    entity_type: Optional[str] = None,
    topic: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Mengambil data jaringan Knowledge Graph secara LIVE dari Neo4j di Port 7687.
    Memetakan 8 tipe entitas resmi MBG (person, organization, geopolitical, location, product, event, norm, facility).
    """
    if not neo4j_driver:
        return None
    try:
        with neo4j_driver.session() as session:
            # 1. Fetch Topics
            topics_data = session.run(
                "MATCH (t:Topic) RETURN t.name as name, t.parent_topic as parent_topic, t.n_communities as n_communities, t.keywords as keywords"
            ).data()

            # 2. Fetch Entities
            entities_data = session.run(
                "MATCH (e:Entity) RETURN e.name as name, e.type as type, e.mention_count as mention_count, e.community_id as community_id, e.topic as topic"
            ).data()

            # 3. Fetch Belongs To Topic Edges
            bt_edges = session.run(
                "MATCH (e:Entity)-[r:BELONGS_TO_TOPIC]->(t:Topic) RETURN e.name as source, t.name as target, type(r) as type"
            ).data()

            # 4. Fetch Co-Occurs With Edges
            co_edges = session.run(
                "MATCH (a:Entity)-[r:CO_OCCURS_WITH]->(b:Entity) RETURN a.name as source, b.name as target, type(r) as type, r.weight as weight, r.cooccur as cooccur, r.pmi as pmi"
            ).data()

            nodes_dict: Dict[str, Dict[str, Any]] = {}
            active_topic_filter = topic.strip() if topic and topic.strip() and topic.lower() != "all" else None
            active_type_filter = entity_type.strip().lower() if entity_type and entity_type.strip() and entity_type.lower() != "all" else None
            threshold = int(min_freq or 0)

            # Insert Topics
            for t in topics_data:
                t_name = t.get("name")
                if not t_name:
                    continue
                if active_topic_filter and t_name.lower() != active_topic_filter.lower():
                    continue
                node = format_node(t_name, "topic", 40, keywords=t.get("keywords"))
                nodes_dict[node["id"]] = node

            # Insert Entities
            for e in entities_data:
                e_name = e.get("name")
                if not e_name:
                    continue
                e_type = (e.get("type") or "entity").lower()
                e_cnt = int(e.get("mention_count") or 1)
                e_topic = e.get("topic")

                # Filters
                if active_type_filter and e_type != active_type_filter:
                    continue
                if active_topic_filter and e_topic and e_topic.lower() != active_topic_filter.lower():
                    continue
                if threshold > 0 and e_cnt < threshold:
                    continue

                node = format_node(e_name, e_type, e_cnt, topic=e_topic)
                nodes_dict[node["id"]] = node

            # Build Edges
            edges_list: List[Dict[str, Any]] = []
            for bt in bt_edges:
                src_id = f"entity_{bt['source']}"
                tgt_id = f"topic_{bt['target']}"
                if src_id in nodes_dict and tgt_id in nodes_dict:
                    edges_list.append({
                        "id": f"rel_bt_{bt['source']}_{bt['target']}",
                        "from": src_id,
                        "to": tgt_id,
                        "source": src_id,
                        "target": tgt_id,
                        "label": "BELONGS_TO_TOPIC",
                        "type": "BELONGS_TO_TOPIC",
                        "weight": 1,
                        "value": 1,
                        "style": "dashed"
                    })

            for co in co_edges:
                src_id = f"entity_{co['source']}"
                tgt_id = f"entity_{co['target']}"
                w = float(co.get("weight") or 1.0)
                cooccur = int(co.get("cooccur") or 1)
                if src_id in nodes_dict and tgt_id in nodes_dict:
                    edges_list.append({
                        "id": f"rel_co_{co['source']}_{co['target']}",
                        "from": src_id,
                        "to": tgt_id,
                        "source": src_id,
                        "target": tgt_id,
                        "label": f"NPMI {w:.2f}",
                        "type": "CO_OCCURS_WITH",
                        "weight": round(w * 10, 1),
                        "value": cooccur,
                        "cooccur": cooccur,
                        "pmi": float(co.get("pmi") or 0.0),
                        "style": "solid"
                    })

            if nodes_dict:
                nodes_list = list(nodes_dict.values())
                return {
                    "source": "neo4j_port_7687",
                    "total_nodes": len(nodes_list),
                    "total_edges": len(edges_list),
                    "nodes": nodes_list,
                    "edges": edges_list,
                    "links": edges_list,
                    "data": {
                        "nodes": nodes_list,
                        "edges": edges_list,
                        "links": edges_list
                    }
                }
    except Exception as e:
        print(f"[NEO4J LIVE ERROR] {e}")
    return None

def build_mbg_graph_data(
    min_freq: Optional[int] = 0,
    entity_type: Optional[str] = None,
    topic: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fallback data Knowledge Graph MBG (128 Entitas & 9 Topik) jika Neo4j port 7687 sedang offline.
    """
    nodes_dict: Dict[str, Dict[str, Any]] = {}
    threshold = int(min_freq or 0)
    active_type = entity_type.strip().lower() if entity_type and entity_type.strip() and entity_type.lower() != "all" else None
    active_topic = topic.strip().lower() if topic and topic.strip() and topic.lower() != "all" else None

    # Topics
    for t_name in MBG_TOPICS_FALLBACK:
        if active_topic and t_name.lower() != active_topic:
            continue
        node = format_node(t_name, "topic", 40)
        nodes_dict[node["id"]] = node

    # Entities
    edges_list: List[Dict[str, Any]] = []
    for ent in MBG_ENTITIES_FALLBACK:
        e_type = ent["type"].lower()
        e_cnt = ent["mention_count"]
        e_top = ent["topic"]

        if active_type and e_type != active_type:
            continue
        if active_topic and e_top.lower() != active_topic:
            continue
        if threshold > 0 and e_cnt < threshold:
            continue

        node = format_node(ent["name"], e_type, e_cnt, topic=e_top)
        nodes_dict[node["id"]] = node

        # Relasi ke topik
        t_id = f"topic_{e_top}"
        if t_id in nodes_dict:
            edges_list.append({
                "id": f"rel_bt_{ent['name']}_{e_top}",
                "from": node["id"],
                "to": t_id,
                "source": node["id"],
                "target": t_id,
                "label": "BELONGS_TO_TOPIC",
                "type": "BELONGS_TO_TOPIC",
                "weight": 1,
                "value": 1,
                "style": "dashed"
            })

    nodes_list = list(nodes_dict.values())
    return {
        "source": "fallback_mbg_dataset",
        "total_nodes": len(nodes_list),
        "total_edges": len(edges_list),
        "nodes": nodes_list,
        "edges": edges_list,
        "links": edges_list,
        "data": {
            "nodes": nodes_list,
            "edges": edges_list,
            "links": edges_list
        }
    }

@router.get("/data")
def get_graph_data(
    platform: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    db: Session = Depends(get_db)
):
    """
    Endpoint utama Knowledge Graph untuk visualisasi jaringan topik dan 8 tipe entitas MBG.
    Prioritaskan query LIVE dari Neo4J di Port 7687 jika driver terhubung.
    """
    live_graph = fetch_live_neo4j_graph(min_freq=min_freq, entity_type=entity_type, topic=topic)
    if live_graph:
        return live_graph
    return build_mbg_graph_data(min_freq=min_freq, entity_type=entity_type, topic=topic)

@router.get("/nodes")
def get_graph_nodes(
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    db: Session = Depends(get_db)
):
    graph = get_graph_data(entity_type=entity_type, topic=topic, min_freq=min_freq, db=db)
    return graph.get("nodes", [])

@router.get("/edges")
def get_graph_edges(
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    db: Session = Depends(get_db)
):
    graph = get_graph_data(entity_type=entity_type, topic=topic, min_freq=min_freq, db=db)
    return graph.get("edges", [])

@router.get("/node/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    graph = get_graph_data(db=db)
    for n in graph.get("nodes", []):
        if n.get("id") == node_id or n.get("name") == node_id:
            return n
    return {"id": node_id, "name": node_id, "status": "not_found"}

@router.get("")
@router.get("/")
def get_graph_root(
    platform: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    min_freq: Optional[int] = Query(0),
    db: Session = Depends(get_db)
):
    return get_graph_data(platform=platform, time_filter=time_filter, entity_type=entity_type, topic=topic, min_freq=min_freq, db=db)
