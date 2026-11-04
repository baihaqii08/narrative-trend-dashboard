# Narrative Trend Dashboard

Platform analitik intelijen media sosial (*Social Media Intelligence & Narrative Analytics*) berbasis arsitektur **Medallion Data Lakehouse**, **FastAPI**, dan **React TypeScript** untuk memantau tren topik, dinamika sentimen publik, serta jejaring entitas (*Knowledge Graph*) secara *real-time*.

---

## Fitur Utama

* **Multi-Platform Data Ingestion & Processing (`scrapers/` & `pipeline/`)**
  * Ekstraksi aliran data media sosial menggunakan *Playwright Network Interceptor* dengan mekanisme *rate-limit protection*.
  * Validasi konten otomatis 3-lapis (*Smart Content Validator*) untuk menyaring spam dan konten tidak relevan.
  * Deduplikasi berbasis *hash-set* `O(1)` sebelum penyimpanan ke *Data Lake* (MinIO S3).
* **High-Performance REST API (`backend/`)**
  * Dibangun dengan **FastAPI**, **SQLAlchemy**, dan **Alembic** untuk pengelolaan skema *database* **PostgreSQL**.
  * Integrasi **Neo4j Graph Database** untuk pemetaan relasi aktor, organisasi, dan isu (*Knowledge Graph*).
  * *In-Memory TTL Caching* untuk akselerasi respons agregasi analitik lintas rentang waktu (7 Hari, 14 Hari, 30 Hari, dan Sepanjang Waktu).
  * Autentikasi pengguna menggunakan standar **OAuth2 & JWT (Bcrypt)**.
* **Interactive Analytics Dashboard (`frontend/`)**
  * Antarmuka modern berbasis **React 18**, **TypeScript**, **Vite**, dan **Tailwind CSS**.
  * Visualisasi tren percakapan, distribusi sentimen per platform, daftar *top influencers/topics*, dan eksplorasi *Knowledge Graph* interaktif.

---

## Struktur Repositori

```text
├── backend/                  # Layanan REST API (FastAPI, SQLAlchemy, Alembic)
│   ├── alembic/              # Migrasi skema database PostgreSQL
│   ├── app/
│   │   ├── api/routes/       # Endpoint API (auth, dashboard, sentiment, topics, entities, graph, posts, search)
│   │   ├── core/             # Konfigurasi environment, koneksi DB, autentikasi JWT, & TTL cache
│   │   └── schemas/          # Skema validasi Pydantic
│   ├── models.py             # Model ORM SQLAlchemy
│   └── requirements.txt      # Dependensi Python Backend
├── frontend/                 # Aplikasi Web Dashboard (React, TypeScript, Vite, Tailwind CSS)
│   ├── src/
│   │   ├── content/          # Halaman analitik (Overview, SummaryCards, KnowledgeGraph, Auth, Profile)
│   │   ├── layouts/          # Tata letak aplikasi & navigasi utama
│   │   └── services/         # Klien HTTP API & manajemen token autentikasi
│   └── package.json          # Dependensi Node.js Frontend
├── pipeline/                 # Worker pemrosesan data, parser, validator, & sinkronisasi MinIO S3
├── scrapers/                 # Modul akuisisi data media sosial berbasis Playwright
├── chrome_extension/         # Ekstensi browser pendukung pengumpulan tautan konten
├── infrastructure/           # Konfigurasi Docker Compose untuk layanan pendukung
├── docs/                     # Dokumentasi spesifikasi API & kamus database (Database Dictionary)
├── run-backend.bat           # Skrip otomatis menjalankan server Backend (Windows)
└── run-frontend.bat          # Skrip otomatis menjalankan server Frontend (Windows)
```

---

## Panduan Menjalankan Aplikasi

### Prasyarat
* **Python** 3.10+
* **Node.js** 18+ & **npm**
* **PostgreSQL** 15+ (Lokal / Server Terpusat)

### Opsi A: Menjalankan Cepat (Windows One-Click Runner)
1. **Konfigurasi Environment Backend:**
   Salin `backend/.env.example` menjadi `backend/.env` dan sesuaikan `DATABASE_URL` dengan kredensial PostgreSQL Anda.
2. **Jalankan Backend:**
   Klik dua kali atau jalankan lewat terminal:
   ```cmd
   .\run-backend.bat
   ```
3. **Jalankan Frontend:**
   Buka terminal baru dan jalankan:
   ```cmd
   .\run-frontend.bat
   ```

### Opsi B: Menjalankan Secara Manual

#### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Salin dan sesuaikan konfigurasi environment
copy .env.example .env

# Jalankan server pada port 8000
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
* **API Base URL:** `http://localhost:8000`
* **Swagger UI (Dokumentasi Interaktif):** `http://localhost:8000/docs`

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install

# Salin konfigurasi environment
copy .env.example .env

# Jalankan development server pada port 5173
npm run dev
```
* **Web Dashboard:** `http://localhost:5173`

---

## Ringkasan Endpoint API Utama

| Kategori | Method & Endpoint | Deskripsi |
| :--- | :--- | :--- |
| **Authentication** | `POST /api/v1/auth/login` | Autentikasi pengguna dan pembuatan token JWT |
| **Authentication** | `POST /api/v1/auth/register` | Registrasi akun pengguna baru |
| **Dashboard** | `GET /api/v1/dashboard/overview` | Ringkasan metrik utama, tren percakapan, & distribusi platform |
| **Sentiment** | `GET /api/v1/sentiment/summary` | Persentase sentimen positif, netral, dan negatif |
| **Topics & Entities** | `GET /api/v1/topics/top` | Daftar topik dan isu dengan volume percakapan tertinggi |
| **Knowledge Graph** | `GET /api/v1/graph/network` | Data *nodes* dan *edges* untuk visualisasi jejaring relasi |
| **Search & Posts** | `GET /api/v1/search` | Pencarian unggahan berdasarkan kata kunci, platform, dan sentimen |

Dokumentasi teknis lebih lanjut tersedia di folder [`docs/`](./docs/):
* [API Documentation](./docs/API_Documentation.md)
* [Database Dictionary](./docs/Database_Dictionary.md)
