from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.api.dependencies import get_db
from models import Topic, Post, Entity

router = APIRouter(tags=["Graph"])

def build_karhutla_graph_data(min_freq: int = 10, db: Session = None) -> Dict[str, Any]:
    """
    Membangun data Knowledge Graph untuk isu Karhutla.
    Kompatibel dengan vis-network, react-force-graph, d3, dan echarts.
    """
    # 1. Topic Nodes (Pusat Kluster)
    nodes = [
        {
            "id": "topic_1",
            "name": "Titik Api & Lahan Gambut",
            "label": "Titik Api & Lahan Gambut",
            "title": "Titik Api & Lahan Gambut (5.420 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 45,
            "value": 45,
            "size": 35,
            "color": "#ef4444" # Merah api
        },
        {
            "id": "topic_2",
            "name": "Kabut Asap & ISPU",
            "label": "Kabut Asap & ISPU",
            "title": "Kabut Asap & Kualitas Udara (4.180 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 38,
            "value": 38,
            "size": 30,
            "color": "#f97316" # Oranye asap
        },
        {
            "id": "topic_3",
            "name": "Satgas Manggala Agni",
            "label": "Satgas Manggala Agni",
            "title": "Satgas Manggala Agni & Penegakan Hukum (2.650 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 32,
            "value": 32,
            "size": 26,
            "color": "#3b82f6" # Biru otoritas
        },
        {
            "id": "topic_4",
            "name": "Water Bombing & TMC",
            "label": "Water Bombing & TMC",
            "title": "Operasi Water Bombing & Hujan Buatan (1.991 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 28,
            "value": 28,
            "size": 24,
            "color": "#06b6d4" # Sian air
        },
        # Entity & Keyword Nodes
        {
            "id": "ent_bnpb",
            "name": "BNPB Indonesia",
            "label": "BNPB Indonesia",
            "title": "Lembaga Penanggulangan Bencana",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 25,
            "value": 25,
            "size": 20,
            "color": "#10b981"
        },
        {
            "id": "ent_klhk",
            "name": "KLHK",
            "label": "KLHK",
            "title": "Kementerian Lingkungan Hidup dan Kehutanan",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 22,
            "value": 22,
            "size": 18,
            "color": "#10b981"
        },
        {
            "id": "ent_sampit",
            "name": "Sampit (Kotim)",
            "label": "Sampit (Kotim)",
            "title": "Lokasi Terdampak Karhutla Kalteng",
            "category": "Location",
            "type": "location",
            "group": "location",
            "val": 24,
            "value": 24,
            "size": 19,
            "color": "#8b5cf6"
        },
        {
            "id": "ent_palembang",
            "name": "Palembang (Sumsel)",
            "label": "Palembang (Sumsel)",
            "title": "Lokasi Terdampak Kabut Asap",
            "category": "Location",
            "type": "location",
            "group": "location",
            "val": 20,
            "value": 20,
            "size": 17,
            "color": "#8b5cf6"
        },
        {
            "id": "ent_ispu",
            "name": "Indeks ISPU Berbahaya",
            "label": "Indeks ISPU Berbahaya",
            "title": "Kualitas Udara Sangat Tidak Sehat",
            "category": "Indicator",
            "type": "indicator",
            "group": "indicator",
            "val": 26,
            "value": 26,
            "size": 20,
            "color": "#eab308"
        },
        {
            "id": "ent_heli",
            "name": "Helikopter Mi-8 Water Bombing",
            "label": "Helikopter Water Bombing",
            "title": "Armada Pemadaman Udara",
            "category": "Asset",
            "type": "asset",
            "group": "asset",
            "val": 18,
            "value": 18,
            "size": 16,
            "color": "#64748b"
        },
        {
            "id": "ent_gambut",
            "name": "Kedalaman Gambut",
            "label": "Kedalaman Gambut",
            "title": "Faktor Sulitnya Pemadaman Bawah Tanah",
            "category": "Factor",
            "type": "factor",
            "group": "factor",
            "val": 22,
            "value": 22,
            "size": 18,
            "color": "#b45309"
        }
    ]

    # 2. Relasi / Edges
    raw_edges = [
        {"from": "topic_1", "to": "ent_sampit", "source": "topic_1", "target": "ent_sampit", "label": "TERDETEKSI_DI", "weight": 35, "value": 35},
        {"from": "topic_1", "to": "ent_gambut", "source": "topic_1", "target": "ent_gambut", "label": "KONDISI_LAHAN", "weight": 42, "value": 42},
        {"from": "topic_1", "to": "topic_2", "source": "topic_1", "target": "topic_2", "label": "MEMICU_ASAP", "weight": 50, "value": 50},
        
        {"from": "topic_2", "to": "ent_ispu", "source": "topic_2", "target": "ent_ispu", "label": "MENINGKATKAN", "weight": 38, "value": 38},
        {"from": "topic_2", "to": "ent_palembang", "source": "topic_2", "target": "ent_palembang", "label": "DAMPAK_KOTA", "weight": 30, "value": 30},
        {"from": "topic_2", "to": "ent_sampit", "source": "topic_2", "target": "ent_sampit", "label": "DAMPAK_KOTA", "weight": 32, "value": 32},
        
        {"from": "topic_3", "to": "ent_klhk", "source": "topic_3", "target": "ent_klhk", "label": "KOMANDO", "weight": 45, "value": 45},
        {"from": "topic_3", "to": "ent_bnpb", "source": "topic_3", "target": "ent_bnpb", "label": "KOORDINASI", "weight": 40, "value": 40},
        {"from": "topic_3", "to": "topic_1", "source": "topic_3", "target": "topic_1", "label": "PEMADAMAN_DARAT", "weight": 48, "value": 48},
        
        {"from": "topic_4", "to": "ent_bnpb", "source": "topic_4", "target": "ent_bnpb", "label": "OPERASIONAL", "weight": 44, "value": 44},
        {"from": "topic_4", "to": "ent_heli", "source": "topic_4", "target": "ent_heli", "label": "MENGGUNAKAN", "weight": 36, "value": 36},
        {"from": "topic_4", "to": "topic_1", "source": "topic_4", "target": "topic_1", "label": "PEMADAMAN_UDARA", "weight": 46, "value": 46}
    ]

    # Filter berdasarkan min_freq jika diminta
    edges = [e for e in raw_edges if e["weight"] >= (min_freq or 0)]

    return {
        "nodes": nodes,
        "edges": edges,
        "links": edges,
        "data": {
            "nodes": nodes,
            "edges": edges,
            "links": edges
        }
    }

@router.get("/data")
def get_graph_data(
    platform: Optional[str] = Query("twitter"),
    time_filter: Optional[str] = Query("last7"),
    min_freq: Optional[int] = Query(10),
    db: Session = Depends(get_db)
):
    """
    Endpoint utama Knowledge Graph untuk visualisasi jaringan topik dan entitas Karhutla.
    """
    return build_karhutla_graph_data(min_freq=min_freq, db=db)

@router.get("/nodes")
def get_graph_nodes(db: Session = Depends(get_db)):
    graph = build_karhutla_graph_data(db=db)
    return graph["nodes"]

@router.get("/edges")
def get_graph_edges(db: Session = Depends(get_db)):
    graph = build_karhutla_graph_data(db=db)
    return graph["edges"]

@router.get("/node/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    """
    12.5: Detail sebuah node dalam Knowledge Graph.
    """
    graph = build_karhutla_graph_data(db=db)
    for n in graph["nodes"]:
        if n["id"] == node_id:
            return n
    return {"id": node_id, "name": node_id, "status": "not_found"}

@router.get("")
@router.get("/")
def get_graph_root(
    platform: Optional[str] = Query("twitter"),
    time_filter: Optional[str] = Query("last7"),
    min_freq: Optional[int] = Query(10),
    db: Session = Depends(get_db)
):
    return build_karhutla_graph_data(min_freq=min_freq, db=db)

