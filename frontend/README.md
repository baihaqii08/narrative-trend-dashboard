# Frontend - Narrative Trend Dashboard (React + Vite)

Folder ini dialokasikan untuk kode sumber Frontend Dashboard (React + Vite / Tailwind / Lucide).

## 🚀 Panduan untuk Front-End Engineer (FE)

### 1. Masukkan Kode Frontend ke Folder Ini
Salin file-file aplikasi React/Vite kamu (`src/`, `public/`, `package.json`, `vite.config.js`, dll) langsung ke dalam folder `frontend/` ini.

### 2. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi API Backend:
```env
# Arahkan ke Backend lokal jika dijalankan di laptop yang sama:
VITE_API_BASE_URL=http://localhost:8000

# Atau arahkan ke IP Tailscale jika backend berjalan di laptop DE 2:
# VITE_API_BASE_URL=http://<IP-BACKEND>:8000
```

### 3. Instalasi & Menjalankan Frontend
```bash
npm install
npm run dev -- --host 0.0.0.0
```
Buka di browser: **http://localhost:5173**

---

## 🌿 Panduan Branching Git untuk FE:
1. Buat branch baru dari `main`:
   ```bash
   git checkout -b feature/frontend-dashboard
   ```
2. Commit dan push pekerjaanmu:
   ```bash
   git add frontend/
   git commit -m "feat(fe): integrasi dashboard narrative trend dengan backend api"
   git push origin feature/frontend-dashboard
   ```
3. Buka GitHub dan buat **Pull Request (PR)** ke branch `main`.
