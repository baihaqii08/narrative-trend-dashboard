import os
import json
import time
import random
import urllib.parse
import gzip
from datetime import datetime
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

TWITTER_AUTH_TOKEN = os.getenv("TWITTER_AUTH_TOKEN")
TWITTER_CT0 = os.getenv("TWITTER_CT0")

# Inisialisasi list untuk menampung JSON mentah dari GraphQL
intercepted_data = []

# Variabel global untuk pencatatan dan keamanan anti-ban
current_trend = "Unknown"
rate_limit_flag = False


def handle_response(response):
    """
    Fungsi penyadap (interceptor).
    Mendeteksi respons API Twitter dan status Rate Limit secara otomatis.
    """
    global rate_limit_flag
    try:
        url = response.url
        status = response.status

        # 1. PENDETEKSI RATE LIMIT (HTTP 429) - SANGAT KRUSIAL UNTUK KEAMANAN AKUN
        if status == 429:
            print(f"\n⚠️  [PERINGATAN RATE LIMIT] Twitter merespons HTTP 429 di: {url[:60]}...")
            print("    Sistem pengaman otomatis diaktifkan untuk mendinginkan akun (Cool-down)!\n")
            rate_limit_flag = True
            return

        # 2. INCAR JALUR BELAKANG GRAPHQL / TIMELINE
        if status == 200 and ("graphql" in url or "timeline.json" in url):
            # Abaikan request notifikasi / badge / user settings yang tidak berisi postingan
            if any(ignore in url for ignore in ["BadgeCount", "useQuickPromote", "Settings", "Account"]):
                return
                
            data = response.json()
            intercepted_data.append({
                "trend": current_trend,
                "url": url,
                "timestamp": datetime.now().isoformat(),
                "raw_json": data
            })
            print(f"[+] [INTERCEPT] Berhasil menyadap payload cuitan dari: {url.split('?')[0].split('/')[-1]} (Total: {len(intercepted_data)})")
    except Exception as e:
        # Debug error jika ada JSON yang gagal di-decode
        pass


def scrape_twitter_batch(max_trends_to_scrape=12, scrolls_per_trend=25):
    """
    Scraper MBG Anti-Ban / Anti-Suspend.
    Menggunakan profil browser persisten, simulasi navigasi manusia, deteksi 429, dan early-exit.
    """
    global current_trend, rate_limit_flag
    
    profile_dir = os.path.join(BASE_DIR, "twitter_profile")
    raw_dir = os.path.join(os.path.dirname(BASE_DIR), "pipeline", "raw_batches")
    
    if not os.path.exists(raw_dir):
        os.makedirs(raw_dir)

    with sync_playwright() as p:
        print(f"\n🛡️  MEMULAI SCRAPER DENGAN MODE ANTI-BAN AKTIF")
        print(f"📁 Menggunakan profil sesi di: '{profile_dir}'")
        
        # Buka browser dengan User-Agent manusiawi dan profil lokal
        browser = p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False, # Visual agar bisa memantau jika ada challenge / captcha
            channel="msedge", 
            viewport={"width": 1280, "height": 720},
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-infobars'
            ]
        )
        
        # INJEKSI COOKIES
        if TWITTER_AUTH_TOKEN:
            browser.add_cookies([
                {"name": "auth_token", "value": TWITTER_AUTH_TOKEN, "domain": ".twitter.com", "path": "/"},
                {"name": "ct0", "value": TWITTER_CT0, "domain": ".twitter.com", "path": "/"},
                {"name": "auth_token", "value": TWITTER_AUTH_TOKEN, "domain": ".x.com", "path": "/"},
                {"name": "ct0", "value": TWITTER_CT0, "domain": ".x.com", "path": "/"}
            ])
            print("✅ Cookies otentikasi akun berhasil diinjeksi.")
        
        page = browser.pages[0] if browser.pages else browser.new_page()
        # Samarkan navigator.webdriver agar tidak terdeteksi bot
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # AKTIFKAN INTERCEPTOR
        page.on("response", handle_response)
        
        # =========================================================================
        # TARGET DATA KHUSUS MAKAN BERGIZI GRATIS (MBG) - 5 KLUSTER SEMANTIK
        # =========================================================================
        mbg_targets = [
            # --- KLUSTER 1: REAL-TIME & LIVE (FOKUS 7 HARI & 14 HARI TERAKHIR) ---
            {"q": "MBG OR \"makan bergizi gratis\"", "mode": "live", "label": "MBG (Live Terbaru)"},
            {"q": "\"makan siang gratis\"", "mode": "live", "label": "Makan Siang Gratis (Live)"},
            {"q": "\"badan gizi nasional\" OR BGN", "mode": "live", "label": "BGN Badan Gizi (Live)"},
            {"q": "\"menu MBG\" OR \"lauk MBG\" OR \"uji coba MBG\"", "mode": "live", "label": "Menu & Lauk MBG (Live)"},
            {"q": "\"anggaran MBG\" OR \"APBN MBG\" OR \"dana MBG\"", "mode": "live", "label": "Anggaran & APBN (Live)"},
            {"q": "\"susu gratis\" OR \"susu ikan\"", "mode": "live", "label": "Susu Gratis & Ikan (Live)"},
            {"q": "SPPG OR \"dapur umum MBG\" OR \"satuan pelayanan gizi\"", "mode": "live", "label": "SPPG Dapur MBG (Live)"},
            {"q": "\"Rp 10.000\" OR \"10 ribu per porsi\" OR \"anggaran dipangkas\"", "mode": "live", "label": "Polemik 10 Ribu (Live)"},
            
            # --- KLUSTER 2: TARGET SPESIFIK 7 HARI TERAKHIR (DATE WINDOW) ---
            {"q": "MBG OR \"makan bergizi gratis\" since:2026-10-28 until:2026-11-04", "mode": "top", "label": "MBG (Minggu Ini 28 Okt-4 Nov)"},
            {"q": "\"makan siang gratis\" since:2026-10-28 until:2026-11-04", "mode": "top", "label": "Makan Siang (Minggu Ini 28 Okt-4 Nov)"},
            
            # --- KLUSTER 3: SENTIMEN KRITIS & KONTROVERSI (Mendongkrak Negatif agar tidak flat) ---
            {"q": "\"keracunan\" (MBG OR \"makan gratis\" OR \"uji coba\")", "mode": "top", "label": "Keracunan MBG (Top Kontroversi)"},
            {"q": "\"makanan basi\" OR \"sampah\" OR \"jorok\" (MBG OR \"makan siang\")", "mode": "top", "label": "Kualitas Makanan (Top Kritis)"},
            
            # --- KLUSTER 4: TARGET 14 - 30 HARI TERAKHIR (DATE WINDOW OKTOBER) ---
            {"q": "MBG OR \"makan bergizi gratis\" since:2026-10-05 until:2026-10-28", "mode": "top", "label": "MBG (Bulan Lalu 5-28 Okt)"},
            {"q": "\"badan gizi nasional\" OR BGN (gizi OR prabowo OR anggaran)", "mode": "top", "label": "BGN & Prabowo (Top Populer)"},
            {"q": "stunting (MBG OR \"makan bergizi\" OR \"makan siang\")", "mode": "top", "label": "Stunting & Gizi (Top Populer)"},
            {"q": "\"dapur satuan pelayanan\" OR \"simulasi MBG\" OR \"katering MBG\"", "mode": "top", "label": "Logistik Dapur (Top Populer)"}
        ]
        
        print(f"🎯 Total Target: {len(mbg_targets)} query MBG.")
        print(f"⚙️  Parameter Aman: Max {scrolls_per_trend} scroll/query dengan jeda acak manusiawi.\n")

        # Looping Setiap Target MBG
        for idx, target in enumerate(mbg_targets[:max_trends_to_scrape], 1):
            query = target["q"]
            mode = target["mode"]
            label = target["label"]
            current_trend = label
            
            print(f"\n=======================================================")
            print(f"[{idx}/{len(mbg_targets)}] Target: {label}")
            print(f"      Query : {query}")
            print(f"      Mode  : {'🔴 LATEST / LIVE (7-14 Hari)' if mode == 'live' else '⭐ TOP POPULER (30 Hari+)'}")
            print(f"=======================================================")
            
            if mode == "live":
                search_url = f"https://x.com/search?q={urllib.parse.quote(query)}&src=typed_query&f=live"
            else:
                search_url = f"https://x.com/search?q={urllib.parse.quote(query)}&src=typed_query"
                
            page.goto(search_url)
            time.sleep(random.uniform(5.0, 7.5)) # Loading awal wajar
            
            # Verifikasi apakah akun diminta verifikasi / checkpoint
            if "account/access" in page.url or "i/flow/login" in page.url:
                print("\n🚨 [PERHATIAN] Twitter meminta verifikasi akun / login ulang.")
                print("   Browser tetap dibuka. Silakan lakukan verifikasi secara manual jika diminta.")
                input("Tekan ENTER di terminal ini jika sudah selesai verifikasi di browser...")
            
            stale_scroll_count = 0
            
            for i in range(scrolls_per_trend):
                # PENGAMAN 1: Cek apakah terkena Rate Limit 429
                if rate_limit_flag:
                    print("🛑 [SAFETY PAUSE] Berhenti sejenak selama 60 detik untuk pemulihan...")
                    time.sleep(60)
                    rate_limit_flag = False
                    print("✅ Masa cool-down selesai. Melanjutkan ke target berikutnya...")
                    break
                
                payload_count_before = len(intercepted_data)
                
                # PENGAMAN 2: Simulasi Scroll Manusia (Jarak acak, bukan angka kaku)
                scroll_pixels = random.randint(750, 1350)
                page.evaluate(f"window.scrollBy(0, {scroll_pixels})")
                
                # Simulasi sesekali membaca (15% kemungkinan scroll balik ke atas sedikit)
                if random.random() < 0.15:
                    time.sleep(random.uniform(0.6, 1.2))
                    page.evaluate(f"window.scrollBy(0, -{random.randint(150, 300)})")
                
                # Jeda acak manusiawi (4.0 - 6.5 detik)
                time.sleep(random.uniform(4.0, 6.5))
                
                # PENGAMAN 3: Deteksi Ujung Halaman (Early Exit jika cuitan sudah habis)
                payload_count_after = len(intercepted_data)
                if payload_count_after == payload_count_before:
                    stale_scroll_count += 1
                    if stale_scroll_count >= 4:
                        print(f"  [i] Sudah mencapai ujung cuitan untuk query ini ({i+1} scroll). Melangkah ke target berikutnya...")
                        break
                else:
                    stale_scroll_count = 0
                    print(f"  Scroll {i+1}/{scrolls_per_trend} -> [{label}] | Total payload tersadap: {payload_count_after}")
            
            # PENGAMAN 4: Jeda Santai Antar-Target (12 - 20 detik seperti manusia mencari hal baru)
            sleep_between = random.uniform(12.0, 20.0)
            print(f"  [V] Selesai dengan '{label}'. Istirahat santai {sleep_between:.1f} detik...")
            time.sleep(sleep_between)
            
            # Auto-save berkala ke file terkompresi
            if intercepted_data:
                temp_filename = os.path.join(raw_dir, "twitter-batch-IN_PROGRESS.json.gz")
                with gzip.open(temp_filename, "wt", encoding="utf-8") as f:
                    json.dump(intercepted_data, f, indent=4, ensure_ascii=False)
            
        print(f"\n=======================================================")
        print(f"🎉 SELESAI DENGAN AMAN! Berhasil menyadap {len(intercepted_data)} payload GraphQL.")
        print(f"=======================================================")
        
        browser.close()
        
        # Simpan hasil sadapan akhir
        if intercepted_data:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = os.path.join(raw_dir, f"twitter-batch-{timestamp}.json.gz")
            with gzip.open(filename, "wt", encoding="utf-8") as f:
                json.dump(intercepted_data, f, indent=4, ensure_ascii=False)
            print(f"\n[SUKSES] File Batch MBG tersimpan di:\n👉 {filename}")
        else:
            print("[-] Tidak ada data tersadap. Periksa cookies di .env.")

if __name__ == "__main__":
    # max_trends_to_scrape: 16 target MBG lengkap
    # scrolls_per_trend: 25 scroll per query (aman, cepat, dan menyerap ratusan tweet)
    scrape_twitter_batch(max_trends_to_scrape=16, scrolls_per_trend=25)
