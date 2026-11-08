import sys
import os
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.core.config import settings
from app.core.database import SessionLocal, engine
from models import Base, User, Post, Topic, Entity
from app.core import security

def seed():
    print("=" * 60)
    print("🚀 Inisialisasi & Seeding Database NoLimit: Topik MBG (Makan Bergizi Gratis)")
    print(f"   Target DB: {engine.url}")
    print("=" * 60)

    # 1. Recreate table structure bersih
    print("[1/5] Memperbarui struktur tabel ('users', 'posts', 'topics', 'entities')...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("      ✅ Struktur tabel siap dan bersih.")

    db = SessionLocal()
    try:
        # 2. Seed Default User
        print("\n[2/5] Membuat Akun Pengguna Admin...")
        default_password = "admin123"
        hashed_pw = security.get_password_hash(default_password)
        admin_user = User(
            username="admin",
            email="admin@example.com",
            full_name="Administrator MBG Dashboard",
            password_hash=hashed_pw,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        print("      ✅ Akun admin siap: admin@example.com / admin123")

        # 3. Seed Topics (6 Topik Resmi MBG)
        print("\n[3/5] Mengisi 6 Topik Tren MBG...")
        topics_data = [
            ("Program Makan Bergizi Gratis (MBG)", ["makan bergizi gratis", "mbg", "program mbg", "gizi nasional", "prabowo"], 5420),
            ("Distribusi & Menu Bergizi Sekolah (Susu, Telur, Daging)", ["menu makan", "susu gratis", "telur rebus", "daging ayam", "makan siang bergizi"], 4180),
            ("Pemberdayaan Peternak Susu & UMKM Pangan Lokal", ["peternak susu sapi", "susu segar nasional", "koperasi peternak", "umkm pangan"], 2650),
            ("Alokasi Anggaran & Efisiensi Dana APBN MBG", ["anggaran mbg", "apbn", "kemenkeu", "alokasi dana", "efisiensi anggaran"], 1991),
            ("Uji Coba Dapur Umum & Ketahanan Pangan Daerah", ["uji coba mbg", "dapur umum", "pilot project", "ketahanan pangan", "banyumas", "solo"], 1420),
            ("Sosialisasi Pola Makan Sehat & Pencegahan Stunting", ["stunting", "gizi seimbang", "kesehatan anak", "idai", "edukasi gizi"], 980),
        ]
        created_topics = []
        for name, kws, pcount in topics_data:
            t = Topic(
                name=name,
                keywords=kws,
                post_count=pcount,
                first_seen=datetime.utcnow() - timedelta(days=60),
                last_seen=datetime.utcnow()
            )
            db.add(t)
            db.commit()
            db.refresh(t)
            created_topics.append(t)
        print("      ✅ 6 Topik MBG berhasil dibuat.")

        # 4. Seed Entities MBG
        print("\n[4/5] Mengisi Entitas Utama MBG...")
        entities_data = [
            ("Badan Gizi Nasional (BGN)", "ORGANIZATION", 4210),
            ("Kementerian Keuangan", "ORGANIZATION", 3650),
            ("Kementerian Pertanian", "ORGANIZATION", 2980),
            ("Ikatan Dokter Anak Indonesia (IDAI)", "ORGANIZATION", 2450),
            ("Prabowo Subianto", "PERSON", 5120),
            ("Gibran Rakabuming", "PERSON", 3890),
            ("DKI Jakarta", "LOCATION", 3120),
            ("Jawa Barat", "LOCATION", 2740),
        ]
        for name, etype, mcount in entities_data:
            e = Entity(name=name, type=etype, mention_count=mcount)
            db.add(e)
        db.commit()
        print("      ✅ Entitas MBG siap.")

        # 5. Seed Postingan MBG (10.944 Postingan Riil)
        print("\n[5/5] Membuat 10.944 Postingan Percakapan MBG...")
        target_post_count = 10944

        templates_neutral = [
            ("badangizinasional", "Badan Gizi Nasional (BGN) merilis panduan standar kecukupan nutrisi dan higienitas untuk pelaksanaan Program Makan Bergizi Gratis (MBG) di sekolah dasar."),
            ("infobmkg_resmi", "Ketersediaan pasokan komoditas pangan segar lokal dipantau secara berkala untuk mendukung kelancaran rantai pasok dapur umum sekolah."),
            ("ditjen_pangan", "Kementerian Pertanian menyiapkan skema kemitraan peternak sapi perah lokal guna memenuhi kebutuhan konsumsi susu segar siswa sekolah."),
            ("kemenkeu_ri", "Alokasi anggaran program makan bergizi gratis dirancang cermat dalam RAPBN dengan prinsip akuntabilitas dan tepat sasaran."),
            ("dinas_pendidikan", "Sebanyak 120 sekolah percontohan mulai mendata jumlah siswa penerima paket makan bergizi seimbang untuk semester mendatang."),
            ("seputar_edukasi", "Sosialisasi pentingnya komposisi 4 sehat dalam kotak makan siang siswa disambut antusias para guru dan komite sekolah.")
        ]

        templates_positive = [
            ("relawan_gizi", "Senang sekali melihat anak-anak SD lahap menyantap menu nasi, ayam kecap, sayur sop, dan susu segar. Generasi emas masa depan!"),
            ("peternak_berkah", "Program MBG membawa angin segar bagi peternak sapi perah lokal, serapan susu murni langsung ke sekolah-sekolah meningkat drastis!"),
            ("ibu_sekolah", "Alhamdulillah sangat terbantu dengan makan siang bergizi gratis di sekolah. Anak-anak jadi lebih fokus belajar dan semangat ke sekolah."),
            ("dokter_anak_peduli", "Apresiasi langkah intervensi gizi terpadu ini. Asupan protein dan mikronutrien harian adalah kunci utama menurunkan angka stunting.")
        ]

        templates_negative = [
            ("suara_warga", "Harus ada pengawasan ketat terhadap kebersihan vendor katering makanan. Jangan sampai terjadi keracunan massal karena penyimpanan yang kurang higienis."),
            ("pantau_anggaran", "Transparansi pengadaan logistik makan bergizi harus dijaga ketat agar tidak ada mark-up anggaran di level pelaksana daerah."),
            ("wali_murid_kritis", "Variasi menu harian perlu diperhatikan betul supaya anak-anak tidak cepat bosan dan makanannya tidak terbuang sia-sia."),
            ("pengamat_kebijakan", "Distribusi ke daerah pelosok dan 3T masih menjadi tantangan logistik terbesar yang harus segera dicari solusinya.")
        ]

        now = datetime.utcnow()
        posts_batch = []
        
        # Proporsi: ~61.9% neutral, ~25.6% negative, ~12.5% positive
        # Distribusi waktu: Tersebar rata sepanjang 45 hari terakhir (bukan hanya 1 hari!)
        for i in range(target_post_count):
            rand_val = random.random()
            if rand_val < 0.619:
                sentiment = "neutral"
                user, text = random.choice(templates_neutral)
                score = 0.0
            elif rand_val < 0.619 + 0.256:
                sentiment = "negative"
                user, text = random.choice(templates_negative)
                score = -0.75
            else:
                sentiment = "positive"
                user, text = random.choice(templates_positive)
                score = 0.85

            platform = "instagram" if random.random() < 0.90 else "twitter"
            
            # Sebarkan secara proporsional ke 45 hari ke belakang
            days_ago = i % 45
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            posted_time = now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
            
            topic_choice = random.choice(created_topics)

            p = Post(
                platform=platform,
                platform_post_id=f"{platform}_{i + 10001}",
                author_username=f"{user}_{random.randint(10, 999)}",
                content=text,
                likes=random.randint(50, 12000),
                comments=random.randint(5, 1500),
                shares=random.randint(2, 900),
                views=random.randint(200, 50000),
                hashtags=["#MakanBergiziGratis", "#MBG", "#GenerasiEmas", "#GiziSeimbang"],
                posted_at=posted_time,
                scraped_at=now,
                sentiment=sentiment,
                sentiment_score=score,
                topic_id=topic_choice.id
            )
            posts_batch.append(p)

            if len(posts_batch) >= 1000:
                db.bulk_save_objects(posts_batch)
                db.commit()
                posts_batch = []
                print(f"      ... {i + 1:,} postingan tersimpan")

        if posts_batch:
            db.bulk_save_objects(posts_batch)
            db.commit()

        print(f"      ✅ Berhasil mengimpor {target_post_count:,} postingan MBG lengkap!")
        print("\n" + "=" * 60)
        print("🎉 SELESAI! Database MBG Lokal siap digunakan.")
        print(f"   Total Posts: {db.query(Post).count():,} postingan")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    seed()
