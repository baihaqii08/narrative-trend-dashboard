# 📋 Kebutuhan Integrasi: Data Bersih Karhutla dari DS & PostgreSQL (DE 2 ➔ DE 1)
**Proyek:** NoLimit - Narrative Trend Dashboard  
**Pengirim:** Data Engineer 2 (Baihaqi)  
**Penerima:** Data Engineer 1 (Faiq)  
**Fokus Data:** 🔥 **Khusus Topik Karhutla (Kebakaran Hutan & Lahan)**  
**Status:** Menunggu data bersih Karhutla dari DS masuk ke PostgreSQL  

---

## 📌 Ringkasan Singkat
Backend API analitik (Overview KPI, Trend Timeline, Distribusi Sentimen, Top Trending Topics, dan Search) sudah **100% siap** dan sudah terhubung dengan Front-End (Vite di `http://localhost:5173`).

Sesuai arahan terkini, analisis tren saat ini **difokuskan khusus pada data Karhutla saja**. 

Agar dashboard di Front-End bisa menampilkan data riil (bukan data seeder *dummy* lagi), **DE 2 hanya memerlukan 2 hal dari DE 1:**

---

## 🎯 2 Kebutuhan Utama

### 1. Hasil Data Bersih Karhutla dari Tim Data Science (DS)
* Data postingan **Karhutla** (~14.241 data dari `karhutla_datalake_14241.xlsx`) yang sudah diproses dan diberi label sentimen (`positive`, `neutral`, `negative`) oleh tim DS.
* Format kolom yang dibutuhkan oleh API Backend:
  - `platform`: `'twitter'`
  - `platform_post_id`: ID unik postingan
  - `author_username`: Username pembuat postingan
  - `content`: Teks / caption cuitan karhutla
  - Metrik interaksi: `likes`, `comments`, `shares`, `views`
  - `posted_at`: Waktu posting asli (ISO timestamp / datetime)
  - `sentiment`: Label sentimen (`positive`, `neutral`, `negative`)

---

### 2. Data Dimasukkan ke Database PostgreSQL
* Data bersih Karhutla dari DS tersebut dimasukkan (*insert*) ke dalam tabel `posts` di PostgreSQL (sesuai skema di `Backend/models.py`).
* **Info Akses / Kredensial Database:**
  - **Host / IP:** `localhost` (atau IP server/Tailscale DE 1)
  - **Port:** `5432`
  - **Username:** `postgres`
  - **Password:** `postgres`
  - **Nama Database:** `narrative_db`
  
  *(Connection string yang sudah dikonfigurasi di `.env` Backend: `postgresql://postgres:postgres@localhost:5432/narrative_db`)*

---

## ⚡ Dampak Langsung
Begitu data Karhutla dari DS sudah masuk ke PostgreSQL dan koneksi DB di `.env` Backend diarahkan ke database tersebut:
1. Backend API langsung menyajikan **data analitik riil Karhutla** (Overview KPI, grafik tren harian, distribusi sentimen kabut asap/titik api, dan pencarian).
2. Front-End langsung menampilkan visualisasi grafik secara *live* tanpa perlu mengubah kode apa pun lagi.

---

### 💬 Template Chat Singkat ke Faiq:
> *"Halo Mas Faiq! Backend API dan Front-End sudah beres dan siap menampilkan grafik. Sekarang analisis kita difokuskan **khusus data Karhutla saja**.*
>
> *Kita tinggal butuh **hasil data bersih Karhutla dari DS (yang sudah ada label sentimennya) dimasukkan ke PostgreSQL**.*
>
> *Kalau datanya sudah di-insert ke tabel `posts` PostgreSQL, minta tolong share detail koneksi DB-nya ya (Host IP, Port, User, Password, DB Name) biar langsung kupasang di `.env` Backend dan kita tes bareng di Front-End. Thank you!"*
