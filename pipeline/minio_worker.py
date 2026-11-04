import os
import json
import time
import boto3
from botocore.client import Config
import greenstalk
from datetime import datetime

# ==========================================
# KONFIGURASI BEANSTALKD & S3 (MINIO)
# ==========================================
BEANSTALKD_HOST = '127.0.0.1'
BEANSTALKD_PORT = 11300
TUBES = ['raw-data', 'quarantine-data']

from dotenv import load_dotenv
load_dotenv()

# Kredensial MinIO (diambil dari .env)
S3_ENDPOINT = os.getenv('S3_ENDPOINT', 'http://localhost:9000')
ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'admin')
SECRET_KEY = os.getenv('MINIO_SECRET_KEY', '')
BUCKET_NAME = os.getenv('MINIO_BUCKET_NAME', 'narative-datalake')

def get_s3_client():
    try:
        return boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
    except Exception as e:
        print(f"[-] Gagal inisialisasi S3 client: {e}")
        return None

def upload_to_minio(s3_client, data_dict):
    """Mengunggah payload JSON tunggal ke MinIO"""
    tweet_id = data_dict.get("post_id", "unknown_id")
    mod_status = data_dict.get("moderation", {}).get("status", "unknown")
    
    month_folder = datetime.now().strftime("%Y-%m")
    
    # Pisahkan folder berdasarkan status moderasi
    base_folder = "twitter/quarantine" if mod_status in ["flagged", "blocked"] else "twitter/parsed"
    folder_path = f"{base_folder}/{month_folder}/"
    
    filename = f"twitter_{tweet_id}.json"
    object_key = f"{folder_path}{filename}"
    
    try:
        json_bytes = json.dumps(data_dict, indent=4).encode('utf-8')
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=object_key,
            Body=json_bytes,
            ContentType='application/json'
        )
        return True, object_key
    except Exception as e:
        print(f"[-] Gagal upload {filename}: {e}")
        return False, str(e)

def start_worker():
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [RUN] Memulai MinIO Worker (Data Lake Courier)")
    print(f"Tujuan: {S3_ENDPOINT}/{BUCKET_NAME}")
    
    s3_client = get_s3_client()
    if not s3_client:
        print("Membatalkan eksekusi karena S3 Client gagal terhubung.")
        return

    # Hubungkan ke Beanstalkd
    try:
        client = greenstalk.Client((BEANSTALKD_HOST, BEANSTALKD_PORT), watch=TUBES)
        print(f"[+] Berhasil terhubung ke Beanstalkd. Memantau tubes: {TUBES}")
    except Exception as e:
        print(f"[-] Gagal terhubung ke Beanstalkd: {e}")
        print("Pastikan Docker container berjalan. Worker berhenti.")
        return

    print("Mendengarkan antrean secara terus-menerus... (Tekan Ctrl+C untuk berhenti)\n")
    
    while True:
        try:
            # Meminta job (blocking wait max 10 detik agar bisa exit dengan aman)
            job = client.reserve(timeout=10)
            
            # Jika ada job masuk
            payload = json.loads(job.body)
            tweet_id = payload.get("post_id", "N/A")
            print(f"> Menerima Job [{job.id}] (Tweet: {tweet_id})")
            
            # Proses Upload
            success, message = upload_to_minio(s3_client, payload)
            
            if success:
                print(f"  [+] Sukses upload ke Data Lake: {message}")
                client.delete(job) # Hapus dari antrean jika sukses
                print(f"  [+] Job [{job.id}] dihapus dari antrean.")
            else:
                print(f"  [-] Upload gagal, melepaskan job [{job.id}] kembali ke antrean (Delay 60 detik).")
                client.release(job, delay=60) # Kembalikan dengan delay agar tidak infinite spam
                
        except greenstalk.TimedOutError:
            # Tidak ada job dalam 10 detik, lanjut muter
            pass
        except json.JSONDecodeError:
            print("  [-] Error: Body antrean bukan JSON valid. Menghapus job rusak.")
            if 'job' in locals():
                client.delete(job)
        except KeyboardInterrupt:
            print("\nMenghentikan Worker secara aman...")
            break
        except Exception as e:
            print(f"[-] Terjadi error tidak terduga pada Worker: {e}")
            time.sleep(5) # Jeda sejenak untuk menghindari spam error loop

    client.close()

if __name__ == "__main__":
    start_worker()
