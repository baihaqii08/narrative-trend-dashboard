from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.api.dependencies import get_db
from models import Topic, Post, Entity
from app.core.database import neo4j_driver, get_neo4j_driver

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
    "Program Makan Bergizi Gratis",
    "Lainnya / Tidak terklasifikasi",
]

MBG_CO_OCCURS_FALLBACK = [
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
    Memetakan 8 tipe entitas resmi MBG (person, organization, geopolitical, location, product, event, norm, facility)
    serta 2 tipe relasi: BELONGS_TO_TOPIC dan CO_OCCURS_WITH.
    """
    driver = get_neo4j_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
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

            all_entities_map: Dict[str, Dict[str, Any]] = {}
            for e in entities_data:
                e_name = (e.get("name") or "").strip()
                if not e_name:
                    continue
                all_entities_map[e_name] = {
                    "name": e_name,
                    "type": (e.get("type") or "entity").lower(),
                    "mention_count": int(e.get("mention_count") or 1),
                    "topic": (e.get("topic") or "").strip() or None
                }

            nodes_dict: Dict[str, Dict[str, Any]] = {}
            active_topic_filter = topic.strip() if topic and topic.strip() and topic.lower() != "all" else None
            active_type_filter = entity_type.strip().lower() if entity_type and entity_type.strip() and entity_type.lower() != "all" else None
            threshold = int(min_freq or 0)

            # Insert Topics
            for t in topics_data:
                t_name = (t.get("name") or "").strip()
                if not t_name:
                    continue
                if active_topic_filter and t_name.lower() != active_topic_filter.lower():
                    continue
                node = format_node(t_name, "topic", 40, keywords=t.get("keywords"))
                nodes_dict[node["id"]] = node

            # Insert Entities matching filter
            matched_entity_names = set()
            for e_name, e_info in all_entities_map.items():
                e_type = e_info["type"]
                e_cnt = e_info["mention_count"]
                e_topic = e_info["topic"]

                if active_type_filter and active_type_filter != "topic" and e_type != active_type_filter:
                    continue
                if active_topic_filter and e_topic and e_topic.lower() != active_topic_filter.lower():
                    continue
                if threshold > 0 and e_cnt < threshold:
                    continue

                matched_entity_names.add(e_name)
                node = format_node(e_name, e_type, e_cnt, topic=e_topic)
                nodes_dict[node["id"]] = node

            # Ensure 1-hop co-occurring neighbor entities are also included when filtering by entity_type so CO_OCCURS_WITH edges remain visible
            if active_type_filter and active_type_filter != "topic":
                for co in co_edges:
                    s_name = (co.get("source") or "").strip()
                    t_name = (co.get("target") or "").strip()
                    if s_name in matched_entity_names and t_name in all_entities_map:
                        nb = all_entities_map[t_name]
                        if threshold <= 0 or nb["mention_count"] >= threshold:
                            nb_node = format_node(nb["name"], nb["type"], nb["mention_count"], topic=nb["topic"])
                            nodes_dict[nb_node["id"]] = nb_node
                    elif t_name in matched_entity_names and s_name in all_entities_map:
                        nb = all_entities_map[s_name]
                        if threshold <= 0 or nb["mention_count"] >= threshold:
                            nb_node = format_node(nb["name"], nb["type"], nb["mention_count"], topic=nb["topic"])
                            nodes_dict[nb_node["id"]] = nb_node

            # Build Edges (2 Tipe Edge: BELONGS_TO_TOPIC & CO_OCCURS_WITH)
            edges_list: List[Dict[str, Any]] = []
            for bt in bt_edges:
                s_name = (bt.get("source") or "").strip()
                t_name = (bt.get("target") or "").strip()
                src_id = f"entity_{s_name}"
                tgt_id = f"topic_{t_name}"
                if src_id in nodes_dict and tgt_id in nodes_dict:
                    edges_list.append({
                        "id": f"rel_bt_{s_name}_{t_name}",
                        "from": src_id,
                        "to": tgt_id,
                        "source": src_id,
                        "target": tgt_id,
                        "source_name": s_name,
                        "target_name": t_name,
                        "label": "BELONGS_TO_TOPIC",
                        "type": "BELONGS_TO_TOPIC",
                        "relationship": "BELONGS_TO_TOPIC",
                        "weight": 1,
                        "value": 1,
                        "style": "dashed"
                    })

            for co in co_edges:
                s_name = (co.get("source") or "").strip()
                t_name = (co.get("target") or "").strip()
                src_id = f"entity_{s_name}"
                tgt_id = f"entity_{t_name}"
                w = float(co.get("weight") or 0.5)
                cooccur = int(co.get("cooccur") or 3)
                pmi_val = float(co.get("pmi") or 0.0)
                if src_id in nodes_dict and tgt_id in nodes_dict:
                    edges_list.append({
                        "id": f"rel_co_{s_name}_{t_name}",
                        "from": src_id,
                        "to": tgt_id,
                        "source": src_id,
                        "target": tgt_id,
                        "source_name": s_name,
                        "target_name": t_name,
                        "label": f"CO_OCCURS_WITH (NPMI {w:.2f})",
                        "type": "CO_OCCURS_WITH",
                        "relationship": "CO_OCCURS_WITH",
                        "weight": round(w, 4),
                        "npmi": round(w, 4),
                        "value": cooccur,
                        "cooccur": cooccur,
                        "pmi": round(pmi_val, 4),
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
    Fallback data Knowledge Graph MBG (128 Entitas, 9 Topik, 128 BELONGS_TO_TOPIC, 109 CO_OCCURS_WITH)
    jika Neo4j port 7687 sedang offline.
    """
    nodes_dict: Dict[str, Dict[str, Any]] = {}
    threshold = int(min_freq or 0)
    active_type = entity_type.strip().lower() if entity_type and entity_type.strip() and entity_type.lower() != "all" else None
    active_topic = topic.strip().lower() if topic and topic.strip() and topic.lower() != "all" else None

    all_entities_map = {e["name"]: e for e in MBG_ENTITIES_FALLBACK}

    # 1. Topics (9 Topik)
    for t_name in MBG_TOPICS_FALLBACK:
        if active_topic and t_name.lower() != active_topic:
            continue
        node = format_node(t_name, "topic", 40)
        nodes_dict[node["id"]] = node

    # 2. Entities (128 Entitas)
    matched_entity_names = set()
    for ent in MBG_ENTITIES_FALLBACK:
        e_name = ent["name"]
        e_type = ent["type"].lower()
        e_cnt = ent["mention_count"]
        e_top = ent["topic"]

        if active_type and active_type != "topic" and e_type != active_type:
            continue
        if active_topic and e_top.lower() != active_topic:
            continue
        if threshold > 0 and e_cnt < threshold:
            continue

        matched_entity_names.add(e_name)
        node = format_node(e_name, e_type, e_cnt, topic=e_top)
        nodes_dict[node["id"]] = node

    # Keep 1-hop neighbor entities for CO_OCCURS_WITH when filtering by entity_type
    if active_type and active_type != "topic":
        for co in MBG_CO_OCCURS_FALLBACK:
            s_name = co["source"]
            t_name = co["target"]
            if s_name in matched_entity_names and t_name in all_entities_map:
                nb = all_entities_map[t_name]
                if threshold <= 0 or nb["mention_count"] >= threshold:
                    nb_node = format_node(nb["name"], nb["type"].lower(), nb["mention_count"], topic=nb["topic"])
                    nodes_dict[nb_node["id"]] = nb_node
            elif t_name in matched_entity_names and s_name in all_entities_map:
                nb = all_entities_map[s_name]
                if threshold <= 0 or nb["mention_count"] >= threshold:
                    nb_node = format_node(nb["name"], nb["type"].lower(), nb["mention_count"], topic=nb["topic"])
                    nodes_dict[nb_node["id"]] = nb_node

    edges_list: List[Dict[str, Any]] = []

    # 3. Edge Tipe 1: BELONGS_TO_TOPIC (128 relasi)
    for ent in MBG_ENTITIES_FALLBACK:
        e_name = ent["name"]
        e_top = ent["topic"]
        src_id = f"entity_{e_name}"
        tgt_id = f"topic_{e_top}"
        if src_id in nodes_dict and tgt_id in nodes_dict:
            edges_list.append({
                "id": f"rel_bt_{e_name}_{e_top}",
                "from": src_id,
                "to": tgt_id,
                "source": src_id,
                "target": tgt_id,
                "source_name": e_name,
                "target_name": e_top,
                "label": "BELONGS_TO_TOPIC",
                "type": "BELONGS_TO_TOPIC",
                "relationship": "BELONGS_TO_TOPIC",
                "weight": 1,
                "value": 1,
                "style": "dashed"
            })

    # 4. Edge Tipe 2: CO_OCCURS_WITH (109 relasi ko-okurensi antar-entitas)
    for co in MBG_CO_OCCURS_FALLBACK:
        s_name = co["source"]
        t_name = co["target"]
        src_id = f"entity_{s_name}"
        tgt_id = f"entity_{t_name}"
        w = float(co["weight"])
        cooccur = int(co["cooccur"])
        pmi_val = float(co["pmi"])
        if src_id in nodes_dict and tgt_id in nodes_dict:
            edges_list.append({
                "id": f"rel_co_{s_name}_{t_name}",
                "from": src_id,
                "to": tgt_id,
                "source": src_id,
                "target": tgt_id,
                "source_name": s_name,
                "target_name": t_name,
                "label": f"CO_OCCURS_WITH (NPMI {w:.2f})",
                "type": "CO_OCCURS_WITH",
                "relationship": "CO_OCCURS_WITH",
                "weight": round(w, 4),
                "npmi": round(w, 4),
                "value": cooccur,
                "cooccur": cooccur,
                "pmi": round(pmi_val, 4),
                "style": "solid"
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
