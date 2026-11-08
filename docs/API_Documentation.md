# Dokumentasi Medallion API

Dokumentasi ini berisi penjelasan lengkap mengenai endpoint API yang tersedia pada backend Medallion Data Pipeline. API ini menggunakan arsitektur RESTful dan dikembangkan menggunakan FastAPI.

## Base URL
Secara default, saat dijalankan secara lokal: `http://localhost:8000/api`

---

## 1. Authentication Endpoints

### 1.1. Login User
Digunakan untuk mendapatkan Access Token (JWT). Mendukung pengiriman JSON body (untuk React/Vite FE) maupun Form Data (Swagger UI).
- **URL**: `/auth/login` (Full URL: `http://localhost:8000/api/auth/login`)
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body (JSON)**:
  ```json
  {
    "email": "admin@example.com",
    "password": "admin123"
  }
  ```
  *(Catatan: Anda juga bisa menggunakan key `"username"` sebagai pengganti `"email"`)*
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
    "token_type": "bearer"
  }
  ```
- **Error Response (400 Bad Request)**:
  ```json
  {
    "detail": "Email/Username atau password salah"
  }
  ```

### 1.2. Register User
Mendaftarkan pengguna baru ke sistem.
- **URL**: `/auth/register`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body (JSON)**:
  - `username` (string, required)
  - `email` (string, required)
  - `full_name` (string, required)
  - `password` (string, required)
- **Response (200 OK)**: Data pengguna yang baru dibuat (tanpa password)
- **Error Response (400 Bad Request)**: `{"detail": "The user with this username already exists..."}`

### 1.3. Get Current User
Mengambil profil pengguna yang sedang login. Membutuhkan Bearer Token.
- **URL**: `/auth/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "full_name": "Administrator",
    "is_active": true
  }
  ```

### 1.4. Logout
- **URL**: `/auth/logout`
- **Method**: `POST`
- **Response (200 OK)**: `{"message": "Successfully logged out..."}`

---

## 2. Dashboard Analytics Endpoints

*(Semua endpoint dashboard dilengkapi fitur in-memory cache dengan TTL 60 detik untuk mempercepat performa).*

### 2.1. Dashboard Overview (KPI)
Menampilkan ringkasan total (posts, topics, engagement) dari dataset bersih Makan Bergizi Gratis / MBG (12.615 postingan).
- **URL**: `/dashboard/overview` (Full: `http://localhost:8000/api/dashboard/overview`)
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  {
    "kpi": {
      "total_posts": 14241,
      "total_topics": 4,
      "total_engagement": 382250
    },
    "breakdown": {
      "likes": 264800,
      "comments": 68300,
      "shares": 49150,
      "views": 1120400
    }
  }
  ```

### 2.2. Trend Timeline
Menampilkan deret waktu jumlah publikasi harian terkait Makan Bergizi Gratis (MBG). Cocok untuk visualisasi Line Chart.
- **URL**: `/dashboard/timeline`
- **Method**: `GET`
- **Query Parameters**:
  - `days` (integer, optional, default: 7): Jumlah hari ke belakang.
- **Response (200 OK)**:
  ```json
  {
    "days_requested": 7,
    "timeline": [
      { "date": "2026-08-27", "count": 1540 },
      { "date": "2026-08-28", "count": 1890 },
      { "date": "2026-08-29", "count": 2340 },
      { "date": "2026-08-30", "count": 2180 },
      { "date": "2026-08-31", "count": 2490 },
      { "date": "2026-09-01", "count": 2010 },
      { "date": "2026-09-02", "count": 1791 }
    ]
  }
  ```

### 2.3. Sentiment Distribution
Menampilkan distribusi sentimen dari seluruh data teks Makan Bergizi Gratis (MBG) (untuk visualisasi Pie/Donut chart).
- **URL**: `/dashboard/sentiment`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  {
    "positive": 1620,
    "neutral": 5620,
    "negative": 6850,
    "unlabeled": 151
  }
  ```

### 2.4. Top Trending Topics
Menampilkan daftar sub-topik (keyword) teratas yang paling banyak dibicarakan terkait isu Makan Bergizi Gratis (MBG).
- **URL**: `/dashboard/topics`
- **Method**: `GET`
- **Query Parameters**:
  - `limit` (integer, optional, default: 10): Jumlah topik yang ingin ditampilkan.
- **Response (200 OK)**:
  ```json
  {
    "limit": 10,
    "trending_topics": [
      {
        "id": 1,
        "name": "Program Makan Bergizi Gratis (MBG)",
        "post_count": 5420,
        "keywords": ["mbg", "makan bergizi gratis", "bgn", "sppg", "menu mbg", "gizi anak"]
      },
      {
        "id": 2,
        "name": "Dampak Kabut Asap & Kualitas Udara (ISPU)",
        "post_count": 4180,
        "keywords": ["kabut asap", "ispu", "polusi udara", "ispa", "sampit", "palembang"]
      },
      {
        "id": 3,
        "name": "Tata Kelola SPPG & Badan Gizi Nasional (BGN)",
        "post_count": 2650,
        "keywords": ["badan gizi nasional", "sppg", "dapur mbg", "keamanan pangan", "umkm"]
      },
      {
        "id": 4,
        "name": "Operasi Water Bombing & Hujan Buatan (TMC)",
        "post_count": 1991,
        "keywords": ["water bombing", "hujan buatan", "helikopter water bombing", "pemadaman"]
      }
    ]
  }
  ```

---

## 3. Global Search API

### 3.1. Filtered Search
Melakukan pencarian penuh (Full-Text Search) pada arsip data Makan Bergizi Gratis (MBG) menggunakan parameter khusus (ILIKE db native).
- **URL**: `/search` (Full: `http://localhost:8000/api/search`)
- **Method**: `GET`
- **Query Parameters**:
  - `q` (string, optional): Kata kunci pencarian (mencari di *content* dan *author_username*)
  - `platform` (string, optional): Filter platform (misal: `twitter`)
  - `sentiment` (string, optional): Filter sentimen (`positive`, `negative`, `neutral`)
  - `start_date` (datetime, optional): Batas waktu awal (format: `YYYY-MM-DDTHH:MM:SS`)
  - `end_date` (datetime, optional): Batas waktu akhir
  - `limit` (integer, optional, default: 50, max: 500)
  - `skip` (integer, optional, default: 0)
- **Response (200 OK)**:
  ```json
  [
    {
      "platform": "twitter",
      "author_username": "indepenSumatera",
      "content": "Program Makan Bergizi Gratis (MBG) resmi berjalan di ribuan sekolah dan membantu pemenuhan gizi harian siswa sekaligus memberdayakan katering UMKM daerah.",
      "posted_at": "2026-09-02T08:45:10Z",
      "sentiment": "negative",
      "likes": 820
    },
    {
      "platform": "twitter",
      "author_username": "relawan_hijau",
      "content": "Apresiasi setinggi-tingginya untuk tim Satgas Manggala Agni dan BNPB yang berjibaku melakukan water bombing di titik api Sumatera.",
      "posted_at": "2026-09-02T09:30:00Z",
      "sentiment": "positive",
      "likes": 620
    },
    {
      "platform": "twitter",
      "author_username": "Metro_TV",
      "content": "Kawasan konservasi Taman Nasional Bromo Tengger Semeru kembali dilanda bencana kebakaran hutan dan lahan. Petugas gabungan diterjunkan memadamkan api.",
      "posted_at": "2026-09-01T14:20:00Z",
      "sentiment": "negative",
      "likes": 980
    }
  ]
  ```

---

> [!TIP]
> Semua endpoint API ini (dan skema data lengkapnya) juga bisa diakses interaktif langsung melalui dokumentasi Swagger UI otomatis FastAPI.
> Cukup buka browser dan arahkan ke: **`http://localhost:8000/docs`** saat server sedang berjalan.
