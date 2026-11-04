import sys
import os
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta
import random

# Ensure current directory is on python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from urllib.parse import urlparse
import psycopg2
from app.core.config import settings
from app.core.database import SessionLocal, engine
from models import Base, User, Post, Topic
from app.core import security

def ensure_database_exists():
    """Membuat database target jika belum ada di server PostgreSQL"""
    try:
        parsed = urlparse(settings.DATABASE_URL)
        db_name = parsed.path.lstrip('/')
        user = parsed.username or "postgres"
        password = parsed.password or "postgres"
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432

        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}';")
        if not cur.fetchone():
            print(f"      ⚡ Database '{db_name}' belum ada, membuat database '{db_name}'...")
            cur.execute(f"CREATE DATABASE \"{db_name}\";")
            print(f"      ✅ Database '{db_name}' berhasil dibuat!")
        cur.close()
        conn.close()
    except Exception as e:
        # Jika gagal connect ke postgres default, biarkan engine mencoba langsung
        pass

def seed():
    print("=" * 60)
    print("🚀 Inisialisasi & Seeding Database NoLimit (narrative_db)")
    print("=" * 60)

    try:
        # 1. Pastikan database dan seluruh tabel terbuat
        print("[1/4] Memeriksa & membuat struktur tabel di PostgreSQL (narrative_db)...")
        ensure_database_exists()
        Base.metadata.create_all(bind=engine)
        print("      ✅ Tabel ('users', 'posts', 'topics', 'entities') siap.")
    except Exception as e:
        print("      ❌ Gagal terhubung ke PostgreSQL.")
        print(f"      Detail Error: {e}")
        print("\n💡 TIP: Pastikan Docker Desktop menyala, lalu jalankan:")
        print("   cd Backend")
        print("   docker-compose up -d postgres")
        return

    db = SessionLocal()
    try:
        # 2. Seed Default User untuk Login FE
        print("\n[2/4] Memeriksa Akun Pengguna (User Login)...")
        admin_email = "admin@example.com"
        admin_user = db.query(User).filter(
            (User.email == admin_email) | (User.username == "admin")
        ).first()

        if not admin_user:
            default_password = "admin123"
            hashed_pw = security.get_password_hash(default_password)
            admin_user = User(
                username="admin",
                email=admin_email,
                full_name="Administrator NoLimit",
                password_hash=hashed_pw,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"      ✅ Akun berhasil dibuat!")
            print(f"         - Email   : {admin_email}")
            print(f"         - Password: {default_password}")
            print(f"         - Username: admin")
        else:
            print(f"      ℹ️  Akun sudah ada: {admin_user.email} (Username: {admin_user.username})")

        # 3. Seed Trending Topics (Khusus Karhutla)
        print("\n[3/4] Memeriksa Data Trending Topics Karhutla...")
        topic_count = db.query(Topic).count()
        topics_created = []
        if topic_count == 0:
            sample_topics = [
                {
                    "name": "Bencana Karhutla & Titik Api Lahan Gambut",
                    "keywords": ["karhutla", "kebakaran hutan", "lahan gambut", "titik api", "kalimantan", "sumatera"],
                    "post_count": 5420
                },
                {
                    "name": "Dampak Kabut Asap & Kualitas Udara (ISPU)",
                    "keywords": ["kabut asap", "ispu", "polusi udara", "ispa", "sampit", "palembang"],
                    "post_count": 4180
                },
                {
                    "name": "Satgas Manggala Agni & Penegakan Hukum",
                    "keywords": ["manggala agni", "satgas karhutla", "patroli karhutla", "bnpb"],
                    "post_count": 2650
                },
                {
                    "name": "Operasi Water Bombing & Hujan Buatan (TMC)",
                    "keywords": ["water bombing", "hujan buatan", "helikopter water bombing", "pemadaman"],
                    "post_count": 1991
                },
            ]
            for t_data in sample_topics:
                t = Topic(
                    name=t_data["name"],
                    keywords=t_data["keywords"],
                    post_count=t_data["post_count"],
                    first_seen=datetime.utcnow() - timedelta(days=7),
                    last_seen=datetime.utcnow()
                )
                db.add(t)
                topics_created.append(t)
            db.commit()
            print(f"      ✅ Berhasil menambahkan {len(sample_topics)} topik tren Karhutla.")
        else:
            topics_created = db.query(Topic).all()
            print(f"      ℹ️  Topik tren sudah tersedia ({topic_count} topik).")

        # 4. Seed Sample Posts untuk KPI, Timeline & Sentiment Chart (Khusus Karhutla)
        print("\n[4/4] Memeriksa Data Postingan Karhutla...")
        post_count = db.query(Post).count()
        if post_count == 0:
            sample_contents = [
                ("twitter", "negative", "indepenSumatera", "Kebakaran hutan dan lahan (karhutla) kembali melanda kawasan Sampit. Kobaran api membakar lahan gambut membuat asap pekat mulai menyelimuti pemukiman warga.", 1240, 215, 140, 9800),
                ("twitter", "negative", "Metro_TV", "Kawasan konservasi Taman Nasional Bromo Tengger Semeru kembali dilanda bencana kebakaran hutan dan lahan. Petugas gabungan diterjunkan memadamkan api.", 980, 110, 85, 7400),
                ("twitter", "positive", "relawan_hijau", "Apresiasi setinggi-tingginya untuk tim Satgas Manggala Agni dan BNPB yang berjibaku melakukan water bombing di titik api Sumatera.", 620, 78, 55, 4300),
                ("twitter", "negative", "kabar_borneo", "Kondisi udara di Kalimantan pagi ini masuk kategori sangat tidak sehat akibat kabut asap karhutla pekat. Warga diimbau pakai masker.", 1850, 290, 180, 13100),
                ("twitter", "neutral", "bnpb_indonesia", "Update pemadaman karhutla: Tiga helikopter water bombing dikerahkan untuk memadamkan kebakaran gambut di Ogan Komering Ilir.", 450, 52, 60, 5100),
                ("twitter", "negative", "NaraSenyap", "Satwa liar ikut terdampak kebakaran hutan dan lahan gambut di Kalimantan. Upaya evakuasi terus dilakukan oleh relawan BKSDA.", 890, 145, 95, 7800),
                ("twitter", "positive", "hujan_berkah", "Alhamdulillah hujan buatan dari TMC berhasil membasahi wilayah Riau dan titik asap karhutla mulai berkurang drastis.", 1420, 180, 110, 10200),
                ("twitter", "neutral", "bmkg_wilayah", "Pantauan citra satelit mendeteksi penurunan hotspot karhutla di wilayah Sumatera Selatan setelah operasi rekayasa cuaca.", 380, 35, 28, 3600),
                ("twitter", "negative", "warga_palembang", "Pagi ini aroma asap karhutla sangat menyengat sampai ke pusat kota Palembang, anak-anak sekolah mulai banyak yang batuk dan sesak napas.", 1120, 160, 88, 8900),
                ("twitter", "positive", "patroli_hutan", "Kerja keras tim gabungan TNI, Polri, dan Manggala Agni berhasil melokalisir api di kawasan gambut sebelum merembet.", 740, 85, 45, 5900),
            ]

            now = datetime.utcnow()
            for idx, item in enumerate(sample_contents):
                days_ago = idx % 6
                post = Post(
                    platform=item[0],
                    platform_post_id=f"sample_{item[0]}_{idx + 1000}",
                    author_username=item[2],
                    content=item[3],
                    likes=item[4],
                    comments=item[5],
                    shares=item[6],
                    views=item[7],
                    posted_at=now - timedelta(days=days_ago, hours=idx * 2),
                    scraped_at=now,
                    sentiment=item[1],
                    sentiment_score=0.85 if item[1] == "positive" else (-0.75 if item[1] == "negative" else 0.0),
                    topic_id=topics_created[idx % len(topics_created)].id if topics_created else None
                )
                db.add(post)

            db.commit()
            print(f"      ✅ Berhasil menambahkan 10 data postingan sampel Karhutla untuk testing grafik FE.")
        else:
            print(f"      ℹ️  Data postingan sudah tersedia ({post_count} posts).")

        print("\n" + "=" * 60)
        print("🎉 SELESAI! Backend siap digunakan oleh Front-End.")
        print(f"   Kredensial Login Front-End (http://localhost:5173):")
        print(f"   👉 Email    : admin@example.com")
        print(f"   👉 Password : admin123")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    seed()
