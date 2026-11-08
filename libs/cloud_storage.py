import os
import json
import logging
import boto3
from botocore.client import Config
from io import BytesIO

# Memastikan logging sudah ada
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudDataLake:
    def __init__(self):
        # Membaca kredensial dari environment variable (.env)
        # Jika tidak ada, defaultnya disesuaikan untuk MinIO lokal saat ini
        self.endpoint_url = os.getenv('S3_ENDPOINT') or os.getenv('MINIO_ENDPOINT', 'http://localhost:9000')
        self.access_key = os.getenv('AWS_ACCESS_KEY_ID') or os.getenv('MINIO_ROOT_USER', 'admin')
        self.secret_key = os.getenv('AWS_SECRET_ACCESS_KEY') or os.getenv('MINIO_ROOT_PASSWORD', '')
        
        # Tambahkan http:// jika tidak ada (Boto3 butuh skema URL)
        if not self.endpoint_url.startswith('http'):
            self.endpoint_url = f"http://{self.endpoint_url}"

        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'narative-datalake')
        
        try:
            # Inisialisasi Boto3 S3 Client (bisa connect ke AWS asli atau MinIO/S3-compatible)
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version='s3v4'),
                region_name='us-east-1' # Default fallback
            )
            self._ensure_bucket_exists()
            logger.info(f"✅ Berhasil terhubung ke Data Lake (S3/MinIO) di {self.endpoint_url}")
        except Exception as e:
            logger.error(f"❌ Gagal inisialisasi Cloud Data Lake: {e}")
            self.s3_client = None

    def _ensure_bucket_exists(self):
        """Membuat bucket jika belum ada"""
        if not self.s3_client: return
        
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except:
            # Jika belum ada, buat baru
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"🪣 Bucket '{self.bucket_name}' berhasil dibuat di Data Lake.")
            except Exception as e:
                logger.error(f"Gagal membuat bucket {self.bucket_name}: {e}")

    def file_exists(self, folder_path, filename):
        """Mengecek apakah file sudah ada di Data Lake (untuk deduplikasi)"""
        if not self.s3_client: return False
        
        if folder_path and not folder_path.endswith('/'):
            folder_path += '/'
        object_key = f"{folder_path}{filename}"
        
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=object_key)
            return True # File sudah ada!
        except:
            return False # File belum ada

    def upload_json(self, data_dict, folder_path, filename):
        """
        Mengunggah dictionary python sebagai file JSON ke dalam Data Lake
        Contoh folder_path: 'instagram/parsed/2026-08/'
        """
        if not self.s3_client:
            logger.warning("S3 Client tidak aktif. Skip upload.")
            return False

        # Pastikan path diakhiri dengan / jika ada foldernya
        if folder_path and not folder_path.endswith('/'):
            folder_path += '/'
            
        object_key = f"{folder_path}{filename}"
        
        try:
            # Ubah dict ke byte JSON
            json_bytes = json.dumps(data_dict, indent=4).encode('utf-8')
            
            # Upload menggunakan put_object
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=json_bytes,
                ContentType='application/json'
            )
            logger.info(f"☁️ Berhasil upload {filename} ke Data Lake (s3://{self.bucket_name}/{object_key})")
            return f"s3://{self.bucket_name}/{object_key}"
            
        except Exception as e:
            logger.error(f"❌ Gagal upload ke Data Lake: {e}")
            return False

# Inisialisasi instance tunggal untuk digunakan di aplikasi
datalake = CloudDataLake()
