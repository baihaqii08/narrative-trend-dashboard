# 🚀 Implementation Plan - Data Engineer 2 (Baihaqi)
**Periode:** Sprint 0 hingga Sprint 3 (Medallion Data Pipeline)

Dokumen ini merangkum seluruh perencanaan teknis (Implementation Plan) yang telah dieksekusi oleh DE 2 untuk mendukung infrastruktur pengumpulan data, backend, dan analitik.

---

## 🏗️ Sprint 0: Setup & Planning

### 1. Database Schema Design (PostgreSQL)
**Pendekatan:** Menggunakan SQLAlchemy (ORM) dan Alembic untuk melacak migrasi skema.
**Tabel yang diusulkan:**
- `users`: Untuk fitur autentikasi admin (JWT).
- `posts`: Tabel utama *Data Warehouse* untuk menampung data hasil kerukan (X, TikTok, IG). Menggunakan UUID, kolom JSONB/ARRAY untuk metrik, dan `sentiment`.
- `topics` & `entities`: Untuk menampung entitas *Trending Topics* dan hasil NLP.
**Koneksi:** Mengonfigurasi `docker-compose.yml` agar *Backend* bisa berkomunikasi dengan instance PostgreSQL lokal.

### 2. Neo4J & Elasticsearch Setup
**Pendekatan:** Menambahkan *image* Neo4J dan Elasticsearch ke dalam `docker-compose.yml` khusus untuk Laptop 2 (DE 2). Membuka *port* standar (7474, 9200) dan memastikan ketersediaan memori (JVM limits) agar sistem tidak *crash*.

---

## 🕸️ Sprint 1: Data Foundation (X/Twitter Pipeline)

### 1. X (Twitter) Scraper (Playwright)
**Pendekatan:** Menghindari blokir API Twitter dengan menggunakan Playwright (Automation Browser).
**Strategi Bypass:**
- Menggunakan pendekatan **Intersepsi API (Network Intercept)** pada *endpoint* GraphQL bawaan web X (seperti `timeline.json` dan `useStoryTopicQuery`).
- Menjalankan browser dalam **Mode Headless (`headless=True`)** untuk menghemat RAM dan mencegah *Black Screen* pada laptop.
- Menerapkan mekanisme penjadwalan (*loop* abadi 24 jam) yang menarik data berdasarkan interval waktu tertentu.

### 2. Parser & Uploader (MinIO Integration)
**Pendekatan:** Menghindari dependensi *Beanstalkd* lokal dengan langsung menembakkan data bersih ke *Datalake* DE 1 (DE 1).
**Alur Data:**
1. Membaca *batch* file `.json` mentah hasil intersepsi.
2. Mengeksekusi modul `validator.py` (Smart 3-Tier Filter) untuk mendeteksi *Hard Block* (Pornografi/Judi) dan *Quarantine* (Promo/Suspicious).
3. Mengeksekusi Filter Deduplikasi dengan mencatat `tweet_id` ke dalam `processed_tweet_ids.json`.
4. Mengunggah sisa data yang lolos bersih menggunakan `boto3` ke `x/parsed/` (MinIO) melalui *tunnel* Ngrok.

---

## ⚙️ Sprint 2: Pipeline Processing & API Backend

### 1. FastAPI Foundation
**Pendekatan:** Membangun fondasi arsitektur MVC sederhana pada Python menggunakan FastAPI.
**Struktur:**
- `/app/api`: Router untuk endpoint (termodularisasi).
- `/app/core`: Konfigurasi *environment*, JWT, dan konektor Database.
- `/models.py`: Pemetaan skema SQLAlchemy.

### 2. Auth Endpoints
**Pendekatan:** Implementasi standar OAuth2PasswordBearer.
- `/api/v1/auth/login`: Menerima *username* dan *password*, mencocokkan *hash* di DB, dan mereturn *JWT Access Token*.

---

## 📊 Sprint 3: Analytical Endpoints

### 1. Dashboard & Sentiment API
**Pendekatan:** Karena *Frontend* memerlukan data untuk merender grafik namun *Inserter* DE 1 belum menginisialisasi DB, kita akan langsung membuat *real query* SQLAlchemy. Saat data kosong, API mereturn nol, namun akan langsung otomatis berfungsi saat data masuk.
**Endpoints yang dirancang:**
- `/overview`: `func.sum()` dan `func.count()` untuk KPI.
- `/timeline`: `group_by(cast(Date))` untuk data *Line Chart* per hari.
- `/sentiment`: *Group by sentiment string* untuk data *Pie Chart*.
- `/topics`: Mengurutkan tabel topik berdasarkan jumlah post terbanyak (Top 10).


## Sprint 4 & 5: Search API, Indexing & Caching
- **Global Search API:** Membangun search.py yang menggunakan ILIKE dan FTS PostgreSQL untuk pencarian lintas platform.
- **PostgreSQL Indexing:** Menambahkan index=True di Alembic/SQLAlchemy untuk kolom filter utama.
- **In-Memory Caching:** Membuat @in_memory_cache (60 detik) untuk endpoint agregasi (Dashboard Overview, Timeline, Sentiment, Topics) demi mengurangi beban I/O database.
