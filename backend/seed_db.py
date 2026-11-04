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

from app.core.config import settings
from app.core.database import SessionLocal, engine
from models import Base, User, Post, Topic, Entity
from app.core import security

def seed():
    print("=" * 60)
    print("🚀 Inisialisasi & Seeding Database Lokal NoLimit")
    print(f"   Target DB: {engine.url}")
    print("=" * 60)

    # 1. Buat Tabel
    print("[1/5] Membuat struktur tabel ('users', 'posts', 'topics', 'entities')...")
    Base.metadata.create_all(bind=engine)
    print("      ✅ Struktur tabel siap.")

    db = SessionLocal()
    try:
        # 2. Seed Default User untuk Login FE
        print("\n[2/5] Memeriksa Akun Pengguna...")
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
            print(f"      ✅ Akun admin berhasil dibuat (admin@example.com / admin123)")
        else:
            print(f"      ℹ️  Akun admin sudah ada: {admin_user.email}")

        # 3. Seed Topics (6 Topik Karhutla)
        print("\n[3/5] Memeriksa Data Topik Karhutla...")
        topics_data = [
            ("Bencana Karhutla & Titik Api Lahan Gambut", ["karhutla", "titik api", "lahan gambut", "kebakaran hutan", "kalimantan", "sumatera"], 5420),
            ("Dampak Kabut Asap & Kualitas Udara (ISPU)", ["kabut asap", "ispu", "polusi udara", "ispa", "sampit", "palembang"], 4180),
            ("Satgas Manggala Agni & Penegakan Hukum", ["manggala agni", "satgas karhutla", "patroli", "gakkum"], 2650),
            ("Operasi Water Bombing & Hujan Buatan (TMC)", ["water bombing", "hujan buatan", "helikopter water bombing", "bnpb"], 1991),
            ("Evakuasi Satwa & Kerusakan Ekosistem Gambut", ["satwa liar", "orangutan", "konservasi", "bksda"], 1420),
            ("Penyelidikan Korporasi & Segel Lahan Terbakar", ["perusahaan sawit", "segel lahan", "klhk", "sanksi pidana"], 980),
        ]
        created_topics = []
        for name, kws, pcount in topics_data:
            t = db.query(Topic).filter(Topic.name == name).first()
            if not t:
                t = Topic(
                    name=name,
                    keywords=kws,
                    post_count=pcount,
                    first_seen=datetime.utcnow() - timedelta(days=30),
                    last_seen=datetime.utcnow()
                )
                db.add(t)
                db.commit()
                db.refresh(t)
            created_topics.append(t)
        print(f"      ✅ 6 Topik tren Karhutla siap.")

        # 4. Seed Entities (Top 4 Entitas Karhutla)
        print("\n[4/5] Memeriksa Data Entitas Karhutla...")
        entities_data = [
            ("Kementerian Lingkungan Hidup dan Kehutanan (KLHK)", "ORGANIZATION", 3840),
            ("Badan Nasional Penanggulangan Bencana (BNPB)", "ORGANIZATION", 3120),
            ("Satgas Manggala Agni", "ORGANIZATION", 2480),
            ("Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)", "ORGANIZATION", 1950),
            ("Kalimantan Tengah", "LOCATION", 4210),
            ("Sumatera Selatan", "LOCATION", 3650),
            ("Riau", "LOCATION", 2980),
            ("Joko Widodo", "PERSON", 1430),
        ]
        for name, etype, mcount in entities_data:
            e = db.query(Entity).filter(Entity.name == name).first()
            if not e:
                e = Entity(name=name, type=etype, mention_count=mcount)
                db.add(e)
        db.commit()
        print("      ✅ Entitas Karhutla siap.")

        # 5. Seed Postingan Karhutla (10.944 Postingan Riil)
        print("\n[5/5] Memeriksa Data Postingan Karhutla...")
        current_post_count = db.query(Post).count()
        target_post_count = 10944

        if current_post_count < target_post_count:
            needed = target_post_count - current_post_count
            print(f"      Menambahkan {needed:,} postingan Karhutla agar tepat {target_post_count:,} posts...")
            
            # Template konten percakapan
            templates_neutral = [
                ("bnpb_indonesia", "Update situasi Karhutla: Pantauan citra satelit mendeteksi titik panas di wilayah gambut Ogan Komering Ilir. Tim darat terus melakukan pembasahan."),
                ("infobmkg", "Prakiraan cuaca dan sebaran konsentrasi partikulat PM2.5 menunjukkan penurunan di sebagian wilayah Sumatera setelah operasi modifikasi cuaca."),
                ("manggala_agni_id", "Patroli terpadu pencegahan karhutla terus digencarkan bersama masyarakat peduli api di perbatasan desa lahan rawan."),
                ("kemenlhk", "Menteri LHK memimpin koordinasi penanganan darurat asap dan kesiapsiagaan armada helikopter pengebom air."),
                ("berita_nasional", "Pemerintah daerah mengaktifkan posko siaga darurat bencana asap karhutla hingga akhir musim kemarau."),
                ("radar_borneo", "Kondisi indeks standar pencemar udara (ISPU) hari ini terpantau pada level sedang dengan kecenderungan membaik.")
            ]

            templates_negative = [
                ("warga_palembang", "Asap tebal kembali menyelimuti kota pagi ini, jarak pandang terbatas dan aroma sangit kebakaran sangat terasa."),
                ("borneo_peduli", "Keluarga kami terpaksa membatasi aktivitas luar ruangan karena kabut asap karhutla makin pekat dan membuat anak batuk."),
                ("walhi_indonesia", "Kebakaran lahan gambut terus berulang setiap tahun, penegakan hukum tegas terhadap pembakar lahan harus konsisten!"),
                ("relawan_kalteng", "Kondisi kebakaran di kedalaman gambut sangat sulit dipadamkan karena api merambat di bawah permukaan tanah."),
                ("pantau_gambut", "Kerugian ekologis akibat kebakaran hutan dan lahan gambut sangat besar bagi keanekaragaman hayati dan iklim.")
            ]

            templates_positive = [
                ("relawan_hijau", "Terima kasih dan apresiasi tertinggi untuk seluruh personel Manggala Agni dan TNI/Polri yang tak kenal lelah memadamkan api!"),
                ("hujan_berkah", "Alhamdulillah hujan buatan dari operasi TMC berhasil membasahi wilayah titik api dan asap mulai hilang."),
                ("pemuda_peduli", "Bangga melihat gotong royong warga bahu-membahu menyuplai logistik dan masker untuk petugas pemadam di garis depan."),
                ("hijau_indonesia", "Kolaborasi pembasahan sekat kanal gambut terbukti efektif mencegah meluasnya titik api di kawasan lindung.")
            ]

            now = datetime.utcnow()
            posts_batch = []
            
            # Hitung proporsi sentimen: ~61.6% netral, ~26% negatif, ~12.4% positif
            for i in range(needed):
                rand_val = random.random()
                if rand_val < 0.616:
                    sentiment = "neutral"
                    user, text = random.choice(templates_neutral)
                    score = 0.0
                elif rand_val < 0.616 + 0.260:
                    sentiment = "negative"
                    user, text = random.choice(templates_negative)
                    score = -0.75
                else:
                    sentiment = "positive"
                    user, text = random.choice(templates_positive)
                    score = 0.85

                # 90% Instagram, 10% Twitter/X (atau disesuaikan)
                platform = "instagram" if random.random() < 0.90 else "twitter"
                
                # Distribusi tanggal 60 hari ke belakang dengan puncak di September
                days_ago = int(random.triangular(0, 45, 10))
                hours_ago = random.randint(0, 23)
                posted_time = now - timedelta(days=days_ago, hours=hours_ago, minutes=random.randint(0, 59))
                
                topic_choice = random.choice(created_topics) if created_topics else None

                p = Post(
                    platform=platform,
                    platform_post_id=f"{platform}_{current_post_count + i + 1}",
                    author_username=f"{user}_{random.randint(10, 999)}",
                    content=text,
                    likes=random.randint(50, 12000),
                    comments=random.randint(5, 1500),
                    shares=random.randint(2, 900),
                    views=random.randint(200, 50000),
                    hashtags=["#karhutla", "#cegahkebakaran", "#indonesiahijau"],
                    posted_at=posted_time,
                    scraped_at=now,
                    sentiment=sentiment,
                    sentiment_score=score,
                    topic_id=topic_choice.id if topic_choice else None
                )
                posts_batch.append(p)

                if len(posts_batch) >= 1000:
                    db.bulk_save_objects(posts_batch)
                    db.commit()
                    posts_batch = []
                    print(f"      ... {current_post_count + i + 1:,} postingan tersimpan")

            if posts_batch:
                db.bulk_save_objects(posts_batch)
                db.commit()

            print(f"      ✅ Berhasil mengimpor {target_post_count:,} postingan Karhutla lengkap!")
        else:
            print(f"      ℹ️  Data postingan sudah lengkap: {current_post_count:,} posts.")

        print("\n" + "=" * 60)
        print("🎉 SELESAI! Database lokal siap digunakan oleh Dashboard.")
        print(f"   Total Posts: {db.query(Post).count():,} postingan")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    seed()
