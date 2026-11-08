import os
import glob
import json
import uuid
import time
import gzip
import shutil
import os
from datetime import datetime
import boto3
from botocore.client import Config
from validator import moderate_content

# Konfigurasi Koneksi MinIO (Data Lake)
S3_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'http://localhost:9000') 
ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', '')
SECRET_KEY = os.getenv('MINIO_SECRET_KEY', '')
BUCKET_NAME = 'narative-datalake'





def find_tweets(obj, results, trend_topic_context="Unknown"):
    """
    Fungsi cerdas (rekursif) untuk menembus lapisan JSON GraphQL sedalam apapun
    dan mengekstrak objek 'tweet' yang memiliki isi teks.
    """
    if isinstance(obj, dict):
        if 'legacy' in obj and 'full_text' in obj['legacy']:
            if trend_topic_context:
                obj['_trend_topic_context'] = trend_topic_context
            results.append(obj)

        current_trend = obj.get('trend', trend_topic_context)
        for k, v in obj.items():
            find_tweets(v, results, current_trend)
    elif isinstance(obj, list):
        for item in obj:
            find_tweets(item, results, trend_topic_context)

def get_all_batch_files():
    raw_dir = os.path.join(os.getcwd(), "raw_batches")
    # Cari file .json maupun .json.gz
    files = glob.glob(os.path.join(raw_dir, "twitter-batch-*.*"))
    return sorted([f for f in files if f.endswith('.json') or f.endswith('.gz')], key=os.path.getctime) if files else []


def parse_and_publish():
    batch_files = get_all_batch_files()
    if not batch_files:
        print("[-] Tidak ada file batch Twitter yang ditemukan di folder 'raw_batches'.")
        return

    print(f"\nMenghubungkan ke MinIO Datalake di {S3_ENDPOINT}...")
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
    except Exception as e:
        print(f"[-] Gagal terhubung ke MinIO S3: {e}")
        return

    # --- TAMBAHAN: DEDUPLIKASI PERSISTENT ---
    processed_ids_file = os.path.join(os.getcwd(), "processed_tweet_ids.json")
    if os.path.exists(processed_ids_file):
        with open(processed_ids_file, "r") as f:
            processed_ids = set(json.load(f))
    else:
        processed_ids = set()
    
    global_new_ids = set()
    total_success = 0

    # --- TAMBAHAN: AUDIT LOG UNTUK DE 2 ---
    audit_log_path = os.path.join(os.getcwd(), f"audit_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
    audit_file = open(audit_log_path, 'w', encoding='utf-8')
    audit_file.write("=== LOG AUDIT PARSER DE 2 ===\n")
    audit_file.write(f"Waktu Eksekusi Parser: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    audit_file.write("Sumber Data (Hasil Scraping Jam):\n")
    for b in batch_files:
        audit_file.write(f"- {os.path.basename(b)}\n")
    audit_file.write("\n")

    # Inisialisasi list untuk menampung log berdasarkan kategori
    log_blocked = []
    log_flagged = []
    log_allowed = []

    for batch_file in batch_files:
        print(f"\nMemproses file Batch: {batch_file}")
        try:
            if batch_file.endswith('.gz'):
                with gzip.open(batch_file, 'rt', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                with open(batch_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
        except Exception as e:
            print(f"[-] Gagal membaca file {batch_file}: {e}")
            continue

        print("Mengekstrak data...")
        
        if isinstance(data, dict):
            # Ini adalah format GraphQL mentah versi LAMA tunggal
            print("  Mendeteksi format GraphQL jadul, mengekstrak secara rekursif...")
            raw_tweets = []
            find_tweets(data, raw_tweets)
            unique_tweets = {t.get('rest_id'): t for t in raw_tweets if isinstance(t, dict) and t.get('rest_id')}
        elif isinstance(data, list):
            # Ini adalah format versi TERBARU (List of Raw GraphQL Payloads) atau Flat List
            print("  Mendeteksi format List of GraphQL Payloads (GZIP)...")
            raw_tweets = []
            for item in data:
                if 'raw_json' in item:
                    find_tweets(item['raw_json'], raw_tweets, item.get('trend', 'Unknown'))
                elif 'rest_id' in item:
                    raw_tweets.append(item)
            unique_tweets = {t.get('rest_id'): t for t in raw_tweets if isinstance(t, dict) and t.get('rest_id')}
        else:
            print("  [-] Format JSON tidak dikenali, lewati file ini.")
            continue
            
        print(f"Berhasil memuat {len(unique_tweets)} tweet dari batch.")

        success_count = 0
        for tweet_id, tweet in unique_tweets.items():
            if tweet_id in processed_ids:
                print(f"  [SKIP] Tweet {tweet_id} sudah pernah diproses sebelumnya.")
                continue

            legacy = tweet.get('legacy', {})
            text = legacy.get('full_text', '')

            if not text:
                continue

            # [DATA VALIDATOR] Cek Spesifikasi Konten menggunakan Smart Validator 3-Tingkat
            mod = moderate_content(text)
            
            # --- LOGGING KE FILE AUDIT DE 2 ---
            clean_text = text.replace('\n', ' ')
            log_line = f"[{mod.status.upper()}] ID: {tweet_id} | Score: {mod.score} | Reason: {mod.reasons} | Text: {clean_text}\n"
            
            if mod.status == "blocked":
                log_blocked.append(log_line)
            elif mod.status == "flagged":
                log_flagged.append(log_line)
            else:
                log_allowed.append(log_line)

            if mod.status == "blocked":
                print(f"  [-] Tweet diblokir (Score: {mod.score}, Reasons: {mod.reasons})")
                continue

            # Mengekstrak metadata
            likes = legacy.get('favorite_count', 0)
            comments = legacy.get('reply_count', 0)
            shares = legacy.get('retweet_count', 0)
            views_dict = tweet.get('views', {})
            views = int(views_dict.get('count', 0)) if isinstance(views_dict, dict) and views_dict.get('count') else 0

            # Mengekstrak author (agak dalam di struktur GraphQL)
            author = "unknown"
            try:
                user_result = tweet.get('core', {}).get('user_results', {}).get('result', {})
                if 'core' in user_result and 'screen_name' in user_result['core']:
                    author = user_result['core']['screen_name']
                elif 'legacy' in user_result and 'screen_name' in user_result['legacy']:
                    author = user_result['legacy']['screen_name']
            except Exception:
                pass

            hashtags = [word for word in text.split() if word.startswith('#')]

            # Konversi waktu ke Unix Timestamp (integer)
            try:
                posted_at_dt = datetime.strptime(legacy.get('created_at', ''), "%a %b %d %H:%M:%S %z %Y")
                timestamp = int(posted_at_dt.timestamp())
            except:
                timestamp = int(time.time())

            parsed_at = int(time.time())
            url = f"https://x.com/{author}/status/{tweet_id}"

            # Format Akhir yang sangat rapi untuk Database
            post_data = {
                "platform": "x",
                "post_id": tweet_id,
                "author_username": author,
                "caption": text,
                "metrics": {
                    "likes": likes,
                    "comments": comments,
                    "views": views,
                    "shares": shares
                },
                "timestamp": timestamp,
                "url": url,
                "parsed_at": parsed_at,
                "trend_topic": tweet.get('_trend_topic_context', 'GraphQL Batch'),
                "hashtags": hashtags,
                "moderation": {
                    "status": mod.status,
                    "score": mod.score,
                    "reasons": mod.reasons
                }
            }

            # MENGUNGGAH LANGSUNG KE MINIO DATALAKE
            if mod.status == "flagged":
                folder_path = f"x/quarantine/{datetime.now().strftime('%Y-%m')}/"
            else:
                folder_path = f"x/parsed/{datetime.now().strftime('%Y-%m')}/"
                
            filename = f"x_{tweet_id}.json"
            object_key = f"{folder_path}{filename}"
            
            try:
                json_bytes = json.dumps(post_data, indent=4).encode('utf-8')
                s3_client.put_object(
                    Bucket=BUCKET_NAME,
                    Key=object_key,
                    Body=json_bytes,
                    ContentType='application/json'
                )
                success_count += 1
                
                # --- TANDAI SEBAGAI DIPROSES ---
                processed_ids.add(tweet_id)
                global_new_ids.add(tweet_id)
                print(f"  [+] Sukses Upload -> {object_key} | Author: @{author} | Moderation: {mod.status}")
            except Exception as e:
                print(f"  [-] Gagal Upload tweet {tweet_id}: {e}")

        total_success += success_count

    # --- SIMPAN ID TWEET BARU KE PERSISTENT FILE ---
    if global_new_ids:
        with open(processed_ids_file, "w") as f:
            json.dump(list(processed_ids), f)
        print(f"\n[+] Berhasil menyimpan {len(global_new_ids)} ID unik baru ke sistem deduplikasi (total memori {len(processed_ids)} ID).")

    # --- TULIS SEMUA LOG KE FILE SECARA TERSTRUKTUR (GROUPED) ---
    audit_file.write(f"--- DAFTAR KONTEN DIBLOKIR (NSFW/Judi/Spam) [{len(log_blocked)} Data] ---\n")
    for line in log_blocked:
        audit_file.write(line)
        
    audit_file.write(f"\n--- DAFTAR KONTEN DITANDAI (Mencurigakan) [{len(log_flagged)} Data] ---\n")
    for line in log_flagged:
        audit_file.write(line)
        
    audit_file.write(f"\n--- DAFTAR KONTEN BERSIH (Lolos MinIO) [{len(log_allowed)} Data] ---\n")
    for line in log_allowed:
        audit_file.write(line)

    audit_file.close()
    print(f"[+] File Laporan Audit (Audit Log) DE 2 berhasil dibuat: {audit_log_path}")

    print(f"\n=======================================================")
    print(f"SELESAI! {total_success} Tweet bersih total berhasil diunggah langsung ke MinIO Datalake.")
    print(f"=======================================================\n")
    print(f"=======================================================\n")


if __name__ == "__main__":
    parse_and_publish()
