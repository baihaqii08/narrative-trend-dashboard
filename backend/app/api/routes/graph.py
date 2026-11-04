from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.api.dependencies import get_db
from models import Topic, Post, Entity

router = APIRouter(tags=["Graph"])

def build_mbg_graph_data(min_freq: int = 10, db: Session = None) -> Dict[str, Any]:
    """
    Membangun data Knowledge Graph untuk isu Makan Bergizi Gratis (MBG).
    Kompatibel dengan vis-network, react-force-graph, d3, dan echarts.
    """
    # 1. Topic Nodes (Pusat Kluster Narasi MBG)
    nodes = [
        {
            "id": "topic_1",
            "name": "Program Makan Bergizi Gratis (MBG)",
            "label": "Program Makan Bergizi Gratis (MBG)",
            "title": "Program Makan Bergizi Gratis (5.840 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 48,
            "value": 48,
            "size": 36,
            "color": "#3b82f6"
        },
        {
            "id": "topic_2",
            "name": "Tata Kelola SPPG & Dapur Umum",
            "label": "Tata Kelola SPPG & Dapur Umum",
            "title": "Operasional SPPG & Distribusi Menu Sekolah (3.420 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 38,
            "value": 38,
            "size": 30,
            "color": "#10b981"
        },
        {
            "id": "topic_3",
            "name": "Keamanan Pangan & Higienitas Menu",
            "label": "Keamanan Pangan & Higienitas Menu",
            "title": "Pengawasan Mutu Makanan & Evaluasi Higienitas (2.190 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 34,
            "value": 34,
            "size": 28,
            "color": "#ef4444"
        },
        {
            "id": "topic_4",
            "name": "Anggaran APBN & Pencegahan Stunting",
            "label": "Anggaran APBN & Pencegahan Stunting",
            "title": "Alokasi Anggaran Rp71 Triliun & Target Gizi Nasional (1.202 mentions)",
            "category": "Topic",
            "type": "topic",
            "group": "topic",
            "val": 30,
            "value": 30,
            "size": 25,
            "color": "#f59e0b"
        },
        # Entity & Stakeholder Nodes
        {
            "id": "ent_bgn",
            "name": "Badan Gizi Nasional (BGN)",
            "label": "Badan Gizi Nasional (BGN)",
            "title": "Lembaga Pelaksana Utama Program MBG",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 28,
            "value": 28,
            "size": 22,
            "color": "#06b6d4"
        },
        {
            "id": "ent_sppg",
            "name": "Satuan Pelayanan Pemenuhan Gizi (SPPG)",
            "label": "Unit Dapur SPPG",
            "title": "Unit Pelaksana Dapur & Distribusi Makanan Bergizi",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 25,
            "value": 25,
            "size": 20,
            "color": "#06b6d4"
        },
        {
            "id": "ent_prabowo",
            "name": "Presiden Prabowo Subianto",
            "label": "Presiden Prabowo Subianto",
            "title": "Inisiator Program Prioritas Makan Bergizi Gratis",
            "category": "Person",
            "type": "person",
            "group": "person",
            "val": 26,
            "value": 26,
            "size": 21,
            "color": "#8b5cf6"
        },
        {
            "id": "ent_bpom",
            "name": "BPOM & Dinas Kesehatan",
            "label": "BPOM & Dinkes",
            "title": "Pengawas Keamanan Pangan & Standar Gizi",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 22,
            "value": 22,
            "size": 18,
            "color": "#10b981"
        },
        {
            "id": "ent_sekolah",
            "name": "Siswa Sekolah & Ibu Hamil",
            "label": "Siswa Sekolah & Ibu Hamil",
            "title": "Kelompok Penerima Manfaat Utama MBG",
            "category": "Beneficiary",
            "type": "beneficiary",
            "group": "beneficiary",
            "val": 24,
            "value": 24,
            "size": 19,
            "color": "#ec4899"
        },
        {
            "id": "ent_umkm",
            "name": "Mitra UMKM, Koperasi & Petani Lokal",
            "label": "UMKM & Petani Lokal",
            "title": "Rantai Pasok Pangan Daerah",
            "category": "Economic",
            "type": "economic",
            "group": "economic",
            "val": 20,
            "value": 20,
            "size": 17,
            "color": "#eab308"
        },
        {
            "id": "ent_kemenkeu",
            "name": "Kementerian Keuangan (APBN)",
            "label": "Kemenkeu (APBN)",
            "title": "Pengelola Alokasi Anggaran Program MBG",
            "category": "Organization",
            "type": "organization",
            "group": "organization",
            "val": 21,
            "value": 21,
            "size": 18,
            "color": "#64748b"
        }
    ]

    # 2. Relasi / Edges
    raw_edges = [
        {"from": "ent_prabowo", "to": "topic_1", "source": "ent_prabowo", "target": "topic_1", "label": "PROGRAM_PRIORITAS", "weight": 50, "value": 50},
        {"from": "ent_bgn", "to": "topic_1", "source": "ent_bgn", "target": "topic_1", "label": "PELAKSANA_UTAMA", "weight": 48, "value": 48},
        {"from": "topic_1", "to": "ent_sekolah", "source": "topic_1", "target": "ent_sekolah", "label": "PENERIMA_MANFAAT", "weight": 46, "value": 46},

        {"from": "ent_bgn", "to": "topic_2", "source": "ent_bgn", "target": "topic_2", "label": "KOORDINASI_DAPUR", "weight": 44, "value": 44},
        {"from": "topic_2", "to": "ent_sppg", "source": "topic_2", "target": "ent_sppg", "label": "OPERASIONAL", "weight": 42, "value": 42},
        {"from": "topic_2", "to": "ent_umkm", "source": "topic_2", "target": "ent_umkm", "label": "RANTAI_PASOK", "weight": 36, "value": 36},

        {"from": "topic_3", "to": "ent_bpom", "source": "topic_3", "target": "ent_bpom", "label": "PENGAWASAN_MUTU", "weight": 40, "value": 40},
        {"from": "topic_3", "to": "ent_sppg", "source": "topic_3", "target": "ent_sppg", "label": "EVALUASI_HIGIENITAS", "weight": 38, "value": 38},
        {"from": "topic_3", "to": "topic_1", "source": "topic_3", "target": "topic_1", "label": "SOROTAN_PUBLIK", "weight": 45, "value": 45},

        {"from": "topic_4", "to": "ent_kemenkeu", "source": "topic_4", "target": "ent_kemenkeu", "label": "ALOKASI_DANA", "weight": 39, "value": 39},
        {"from": "topic_4", "to": "ent_bgn", "source": "topic_4", "target": "ent_bgn", "label": "EFISIENSI_ANGGARAN", "weight": 35, "value": 35},
        {"from": "topic_4", "to": "topic_1", "source": "topic_4", "target": "topic_1", "label": "DUKUNGAN_FISKAL", "weight": 43, "value": 43}
    ]

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
    Endpoint utama Knowledge Graph untuk visualisasi jaringan topik dan entitas Makan Bergizi Gratis (MBG).
    """
    return build_mbg_graph_data(min_freq=min_freq, db=db)

@router.get("/nodes")
def get_graph_nodes(db: Session = Depends(get_db)):
    graph = build_mbg_graph_data(db=db)
    return graph["nodes"]

@router.get("/edges")
def get_graph_edges(db: Session = Depends(get_db)):
    graph = build_mbg_graph_data(db=db)
    return graph["edges"]

@router.get("/node/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    """
    Detail sebuah node dalam Knowledge Graph MBG.
    """
    graph = build_mbg_graph_data(db=db)
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
    return build_mbg_graph_data(min_freq=min_freq, db=db)
