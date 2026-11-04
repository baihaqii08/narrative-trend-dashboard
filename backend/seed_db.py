import sys
import os
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta

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
    except Exception:
        pass

def seed():
    print("=" * 60)
    print("🚀 Inisialisasi & Seeding Database Narrative Trend (MBG)")
    print("=" * 60)

    try:
        print("[1/4] Memeriksa & membuat struktur tabel di PostgreSQL (narrative_db)...")
        ensure_database_exists()
        Base.metadata.create_all(bind=engine)
        print("      ✅ Tabel ('users', 'posts', 'topics', 'entities') siap.")
    except Exception as e:
        print("      ❌ Gagal terhubung ke PostgreSQL.")
        print(f"      Detail Error: {e}")
        return

    db = SessionLocal()
    try:
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
                full_name="Administrator Dashboard",
                password_hash=hashed_pw,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"      ✅ Akun berhasil dibuat ({admin_email})!")
        else:
            print(f"      ℹ️  Akun sudah ada: {admin_user.email} (Username: {admin_user.username})")

        # 3. Seed Trending Topics (Khusus Makan Bergizi Gratis / MBG)
        print("\n[3/4] Memeriksa Data Trending Topics MBG...")
        topic_count = db.query(Topic).count()
        topics_created = []
        if topic_count == 0:
            sample_topics = [
                {
                    "name": "Program Makan Bergizi Gratis (MBG)",
                    "keywords": ["mbg", "makan bergizi gratis", "program mbg", "menu mbg", "gizi anak", "sekolah"],
                    "post_count": 5840
                },
                {
                    "name": "Tata Kelola SPPG & Badan Gizi Nasional (BGN)",
                    "keywords": ["bgn", "badan gizi nasional", "sppg", "dapur mbg", "umkm", "distribusi mbg"],
                    "post_count": 3420
                },
                {
                    "name": "Evaluasi Keamanan Pangan & Higienitas Menu",
                    "keywords": ["keamanan pangan", "keracunan mbg", "higienitas", "bpom", "menu sehat", "evaluasi mbg"],
                    "post_count": 2190
                },
                {
                    "name": "Efisiensi Anggaran APBN & Pencegahan Stunting",
                    "keywords": ["anggaran mbg", "stunting", "apbn", "susu gratis", "ibu hamil", "balita"],
                    "post_count": 1202
                },
            ]
            for t_data in sample_topics:
                t = Topic(
                    name=t_data["name"],
                    keywords=t_data["keywords"],
                    post_count=t_data["post_count"],
                    first_seen=datetime.utcnow() - timedelta(days=30),
                    last_seen=datetime.utcnow()
                )
                db.add(t)
                topics_created.append(t)
            db.commit()
            print(f"      ✅ Berhasil menambahkan {len(sample_topics)} topik tren MBG.")
        else:
            topics_created = db.query(Topic).all()
            print(f"      ℹ️  Topik tren sudah tersedia ({topic_count} topik).")

        # 4. Seed Sample Posts untuk KPI, Timeline & Sentiment Chart (Khusus MBG)
        print("\n[4/4] Memeriksa Data Postingan MBG...")
        post_count = db.query(Post).count()
        if post_count == 0:
            sample_contents = [
                ("twitter", "positive", "info_pendidikan", "Program Makan Bergizi Gratis (MBG) resmi berjalan di ribuan sekolah dan membantu pemenuhan gizi harian siswa sekaligus memberdayakan katering UMKM daerah.", 1540, 210, 340, 18500),
                ("twitter", "neutral", "ekonomi_publik", "Badan Gizi Nasional (BGN) memperkuat standar operasional seluruh Satuan Pelayanan Pemenuhan Gizi (SPPG) agar distribusi menu tepat waktu.", 820, 95, 130, 9400),
                ("twitter", "negative", "pantau_kebijakan", "Sejumlah orang tua siswa meminta evaluasi ketat terhadap higienitas dapur SPPG menyusul keluhan menu MBG yang kurang segar di beberapa daerah.", 1920, 410, 520, 24100),
                ("twitter", "positive", "umkm_bangkit", "Alhamdulillah dapur umum MBG di daerah kami melibatkan petani sayur, peternak telur, dan koperasi desa secara langsung.", 1280, 145, 290, 14200),
                ("twitter", "neutral", "kabar_nasional", "BPOM bersama Dinas Kesehatan meningkatkan pengawasan berkala terhadap kualitas bahan baku pada dapur penyedia Makan Bergizi Gratis.", 640, 72, 110, 8100),
                ("twitter", "positive", "gizi_indonesia", "Kombinasi protein hewani, sayur, dan buah pada menu Makan Bergizi Gratis dirancang oleh ahli gizi di setiap unit SPPG.", 950, 88, 175, 11300),
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
            print(f"      ✅ Berhasil menambahkan {len(sample_contents)} data postingan sampel MBG.")
        else:
            print(f"      ℹ️  Data postingan sudah tersedia ({post_count} posts).")

        print("\n" + "=" * 60)
        print("🎉 SELESAI! Backend siap digunakan oleh Front-End.")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    seed()
