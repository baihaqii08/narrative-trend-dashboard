# Batasan Masalah dan Panduan Tipografi Ilmiah

Dokumen ini memuat perbaikan redaksional, format huruf miring (*italics*), serta penyesuaian istilah baku sesuai kaidah **EYD Edisi V** dan standar penulisan karya ilmiah/laporan Kerja Praktik (KP).

---

## 📌 Batasan Masalah (Naskah Siap Pakai)

Agar pembahasan dalam pelaksanaan Kerja Praktik lebih terarah, batasan masalah yang digunakan adalah sebagai berikut:

1. Data masukan yang digunakan berasal dari media sosial X dan Instagram berupa teks *caption*, *tweet*, dan metadata yang berkaitan dengan tren Karhutla dan MBG.
2. Data mentah berformat JSON disimpan pada *data lake* MinIO setelah melalui pengaturan antrean pada Beanstalkd.
3. Penyimpanan data terstruktur menggunakan RDBMS PostgreSQL yang dirancang dengan *Entity Relationship Diagram* (ERD) meliputi tabel *topics*, *posts*, *entities*, *post_entities*, dan *users*.
4. Penyimpanan data entitas dan hubungan antarentitas pada *knowledge graph* menggunakan basis data graf Neo4j.
5. Analisis kebutuhan fungsional pada *data pipeline* meliputi pengambilan data, penyeragaman struktur JSON, pemeriksaan duplikasi data, dan pemisahan data ke dalam topik Karhutla dan MBG.
6. Analisis kebutuhan fungsional pada layanan *backend* menggunakan FastAPI dan antarmuka web meliputi autentikasi pengguna, penyediaan data ringkasan tren, penyaringan data unggahan, serta pemanggilan data jaringan entitas.
7. Proses identifikasi entitas menggunakan NER, pembobotan hubungan menggunakan NPMI, dan penentuan komunitas menggunakan algoritma Leiden merujuk pada hasil pengolahan dari tim *data science*.
8. Keluaran informasi dalam bentuk grafik menyajikan grafik garis tren sentimen, distribusi platform media sosial, serta visualisasi jaringan *knowledge graph*.
9. Keluaran informasi dalam bentuk tabel menyajikan tabel topik terpopuler, tabel entitas yang paling sering disebutkan berdasarkan kategori *person*, *organization*, *location*, dan *event*, serta tabel daftar unggahan media sosial.

---

## 🔍 Ringkasan Kaidah Penulisan Huruf Miring (*Italics*)

### 1. Kata yang Wajib Dicetak Miring

| Kata / Frasa | Alasan / Keterangan |
| :--- | :--- |
| `*caption*` | Istilah bahasa asing (bahasa Inggris); padanan KBBI adalah *takarir*. |
| `*tweet*` | Istilah bahasa asing; padanan dalam bahasa Indonesia adalah *twit* atau *kicauan*. |
| `*data lake*` | Istilah konsep teknis penyimpanan data mentah (padanan: danau data). |
| `*Entity Relationship Diagram*` | Frasa konsep metodologi perancangan basis data berbahasa asing. |
| `*topics*`, `*posts*`, `*entities*`, `*post_entities*`, `*users*` | Nama skema/tabel basis data berbahasa asing. |
| `*knowledge graph*` | Istilah struktur data graf semantik berbahasa Inggris. |
| `*data pipeline*` | Istilah teknis pemrosesan dan alur data berkelanjutan. |
| `*backend*` | Istilah teknologi komputasi sisi-belakang (*server-side*). |
| `*data science*` | Istilah bidang keilmuan berbahasa Inggris (padanan: sains data). |
| `*person*`, `*organization*`, `*location*`, `*event*` | Istilah kategori entitas/label klasifikasi berbahasa asing. |

---

### 2. Kata yang Tetap Tegak (Tidak Dimiringkan)

| Kategori | Contoh Kata | Penjelasan Sesuai EYD |
| :--- | :--- | :--- |
| **Nama Diri / Produk / Software (*Proper Noun*)** | `X`, `Instagram`, `MinIO`, `Beanstalkd`, `PostgreSQL`, `Neo4j`, `FastAPI` | Nama produk, merek dagang, dan nama perangkat lunak tidak dicetak miring. |
| **Nama Algoritma / Tokoh** | `algoritma Leiden` | Kata "algoritma" merupakan kata serapan baku, sedangkan "Leiden" adalah nama diri. |
| **Singkatan & Akronim Kapital** | `JSON`, `RDBMS`, `ERD`, `NER`, `NPMI`, `MBG`, `Karhutla` | Singkatan huruf kapital tetap ditulis tegak sekalipun kepanjangannya berasal dari bahasa asing. |
| **Kata Serapan Resmi KBBI** | `metadata`, `platform`, `web`, `antarmuka`, `sentimen`, `distribusi`, `visualisasi` | Kata-kata ini telah masuk ke dalam Kamus Besar Bahasa Indonesia (KBBI) sehingga diperlakukan sebagai kata baku. |

---

## 💡 Catatan Koreksi Redaksional Penguji

* **Kerja Praktek $\rightarrow$ Kerja Praktik**: Kata baku dalam KBBI adalah **praktik** (dengan huruf 'i').
* **antar-entitas $\rightarrow$ antarentitas**: Bentuk terikat (*antar-*, *pasca-*, *sub-*, *multi-*) ditulis serangkai tanpa tanda hubung (seperti *antarkota*, *antarbangsa*).
* **postingan $\rightarrow$ unggahan**: Mengubah kata tidak baku ragam lisan (*postingan*) menjadi ragam formal ilmiah (*unggahan*).
