**Bootcamp AI Web Programming · Capstone Project**

PRD Aplikasi Manajemen Properti

**Griya Kenanga Residence**

## **1\. Latar Belakang**

Griya Kenanga Residence adalah usaha kos dan studio sewa di Sleman, Yogyakarta, dengan 24 unit di tiga lantai: Blok A lantai 1 (kamar standar), Blok B lantai 2 (kamar ber-AC), dan Blok C lantai 3 (studio). Penyewanya mahasiswa dan karyawan muda dengan masa sewa 1 sampai 12 bulan.

Saat ini kontrak dicatat di Excel, tagihan dikirim satu per satu lewat WhatsApp, pembayaran dicatat di buku kas, dan laporan kerusakan disampaikan lewat chat pribadi ke pengelola. Akibatnya sering terjadi:

* satu unit dijanjikan ke dua calon penyewa untuk bulan yang sama;
* tagihan terlewat atau dikirim dua kali, dan nomornya tidak berurutan;
* denda keterlambatan dihitung berbeda oleh setiap pengelola;
* foto KTP penyewa tersimpan di galeri ponsel pengelola tanpa pengamanan;
* laporan kerusakan tidak terlacak dan biaya perbaikan besar dikerjakan tanpa sepengetahuan pemilik;
* pemilik tidak tahu pendapatan dan tunggakan per unit secara pasti.

Aplikasi ini menggantikan Excel, buku kas, dan chat dengan satu aplikasi web internal untuk pemilik, pengelola, dan penyewa.

## **2\. Tujuan**

1. Tidak ada lagi unit yang dikontrakkan ganda pada periode yang sama.
2. Tagihan bulanan dibuat sekali klik, bernomor urut, dan tidak pernah dobel.
3. Denda dan sisa tagihan dihitung otomatis dengan aturan yang sama untuk semua penyewa.
4. Data identitas penyewa tersimpan aman dan hanya dilihat pihak yang berhak.
5. Setiap laporan kerusakan terlacak dari dilaporkan sampai ditutup, dan biaya besar disetujui pemilik.
6. Pemilik melihat pendapatan, tunggakan, dan tingkat hunian per unit dan per bulan.

## **3\. Pengguna dan Peran**

| Peran     | Siapa                                             | Yang bisa dilakukan                                                                                                                                                                                                                                                          |
| :-------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Penyewa   | Penghuni kos atau studio. Mendaftar akun sendiri. | Mengisi data identitas, melihat kontrak dan tagihan miliknya, membayar tagihan secara *online* (opsional), membuat dan menutup laporan kerusakan miliknya                                                                                                                  |
| Pengelola | Staf operasional di lokasi (2 orang)              | Mengelola status unit, memverifikasi identitas, membuat dan mengaktifkan kontrak, membuat tagihan bulanan, mencatat pembayaran tunai dan transfer, memproses laporan kerusakan. Tidak bisa melihat laporan pendapatan.                                                       |
| Pemilik   | Pemilik usaha (1 orang)                           | Melihat semua data operasional, mengubah harga unit, mengakhiri kontrak lebih awal, membatalkan pembayaran atau tagihan, menyetujui biaya perbaikan besar, melihat laporan pendapatan dan *audit log*, mengatur peran akun. Tidak melihat NIK dan foto KTP secara lengkap. |

Akun baru yang mendaftar sendiri selalu berperan Penyewa. Peran Pengelola dan Pemilik hanya bisa diberikan oleh Pemilik.

## **4\. Aturan Bisnis**

| Kode  | Aturan                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :---- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | Satu unit tidak boleh memiliki dua kontrak berstatus draf atau aktif yang periodenya beririsan, walaupun dibuat oleh dua pengelola pada detik yang sama. Kontrak yang berakhir 31 Oktober dan kontrak baru yang mulai 1 November tidak dianggap beririsan.                                                                                                                                                                                                  |
| BR-02 | Kontrak selalu dimulai tanggal 1 dan berdurasi 1, 3, 6, atau 12 bulan. Tanggal selesai dihitung otomatis (hari terakhir bulan ke-n). Tanggal mulai paling cepat bulan berjalan dan paling jauh 3 bulan ke depan.                                                                                                                                                                                                                                            |
| BR-03 | Kontrak draf hanya bisa diaktifkan bila identitas penyewa (NIK 16 angka, foto KTP, kontak darurat) sudah diverifikasi Pengelola. Satu penyewa paling banyak memiliki satu kontrak aktif; perpanjangan dibuat sebagai kontrak draf baru dan baru bisa diaktifkan setelah kontrak lama selesai.                                                                                                                                                               |
| BR-04 | Kontrak baru hanya bisa dibuat untuk unit berstatus "tersedia" (bukan "perbaikan" atau "nonaktif"). Unit yang masih punya kontrak draf atau aktif tidak boleh dinonaktifkan. Harga sewa unit hanya bisa diubah Pemilik. Harga di kontrak dikunci saat kontrak dibuat dan tidak ikut berubah bila harga unit berubah.                                                                                                                                        |
| BR-05 | Perpindahan status kontrak mengikuti tabel Alur Status Kontrak (bagian 6). Kontrak hanya bisa diselesaikan setelah tanggal selesai terlewati dan semua tagihannya lunas. Pengakhiran lebih awal hanya oleh Pemilik, wajib dengan alasan, dan berlaku sampai akhir bulan berjalan.                                                                                                                                                                           |
| BR-06 | Pengelola membuat tagihan bulanan sekaligus untuk semua kontrak aktif pada satu periode. Satu kontrak hanya punya satu tagihan per periode. Tagihan hanya bisa dibuat untuk bulan berjalan atau bulan berikutnya. Jatuh tempo selalu tanggal 10\. Nomor tagihan berformat INV-TahunBulan-urutan (contoh INV-202610-0001), berurutan tanpa lompat dan tanpa kembar.                                                                                          |
| BR-07 | Pembayaran yang dicatat setelah jatuh tempo dikenai denda Rp20.000 per hari keterlambatan, paling banyak Rp200.000 per tagihan. Denda dihitung sampai tanggal pembayaran dicatat dan ditambahkan ke total tagihan. Pembayaran pada tanggal 10 belum dikenai denda.                                                                                                                                                                                          |
| BR-08 | Pembayaran tunai atau transfer dicatat oleh Pengelola; transfer wajib melampirkan foto bukti. Pembayaran boleh dicicil, minimal Rp100.000 per cicilan kecuali cicilan terakhir yang melunasi sisa. Jumlah tidak boleh melebihi sisa tagihan, termasuk saat dua pengelola mencatat pembayaran tagihan yang sama bersamaan. Status tagihan (belum bayar, sebagian, lunas) berubah otomatis dari total pembayaran. Penyewa tidak bisa mengubah status tagihan. |
| BR-09 | Pembayaran yang sudah dicatat tidak bisa diubah atau dihapus. Koreksi dilakukan Pemilik dengan membatalkan pembayaran disertai alasan; status tagihan dihitung ulang. Tagihan hanya bisa dibatalkan Pemilik bila belum ada pembayaran sama sekali. Semua aksi sensitif tercatat di *audit log* (daftar di bagian 10).                                                                                                                                     |
| BR-10 | NIK, alamat asal, foto KTP, dan kontak darurat hanya bisa dilihat penyewa ybs dan Pengelola. Pemilik hanya melihat 4 angka terakhir NIK. Laporan pendapatan, tunggakan, dan hunian per unit hanya bisa dibuka Pemilik. Penyewa hanya melihat kontrak, tagihan, pembayaran, dan laporan kerusakan miliknya. Peran akun hanya bisa diubah Pemilik, dan Pemilik tidak bisa mengubah peran akunnya sendiri.                                                     |
| BR-11 | Laporan kerusakan hanya bisa dibuat penyewa yang memiliki kontrak aktif, untuk unit di kontrak tersebut. Setiap laporan wajib berisi 1 sampai 3 foto (masing-masing maksimal 2 MB, format JPG atau PNG). Satu penyewa paling banyak memiliki 3 laporan terbuka (dilaporkan, diproses, atau menunggu persetujuan).                                                                                                                                           |
| BR-12 | Perpindahan status laporan kerusakan mengikuti tabel Alur Status Laporan (bagian 6). Pengelola wajib mengisi estimasi biaya sebelum memproses. Estimasi atau biaya aktual di atas Rp1.000.000 wajib disetujui Pemilik sebelum dikerjakan; estimasi tepat Rp1.000.000 tidak perlu persetujuan. Laporan selesai ditutup oleh penyewa pelapor; bila 3 hari setelah selesai belum ditutup, Pengelola boleh menutupnya.                                          |

## **5\. User Story**

| Kode  | User story                                                                                                                                                   | Aturan terkait      |
| :---- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
| US-01 | Sebagai penyewa, saya ingin mengisi data identitas dan mengunggah foto KTP agar kontrak saya bisa diaktifkan.                                                | BR-03, BR-10        |
| US-02 | Sebagai pengelola, saya ingin memverifikasi atau menolak identitas penyewa beserta alasannya.                                                                | BR-03, BR-10        |
| US-03 | Sebagai pengelola, saya ingin membuat kontrak untuk unit yang kosong dan mengaktifkannya agar unit tidak terpesan ganda.                                     | BR-01 sampai BR-05  |
| US-04 | Sebagai pengelola, saya ingin membuat semua tagihan bulan ini dengan satu klik tanpa risiko tagihan dobel.                                                   | BR-06               |
| US-05 | Sebagai pengelola, saya ingin mencatat pembayaran tunai atau transfer dan langsung melihat sisa serta denda.                                                 | BR-07, BR-08        |
| US-06 | Sebagai penyewa, saya ingin melihat tagihan saya beserta denda dan membayarnya secara *online*.                                                            | BR-07, BR-08, BR-10 |
| US-07 | Sebagai penyewa, saya ingin melaporkan kerusakan dengan foto dan memantau statusnya sampai selesai.                                                          | BR-11, BR-12        |
| US-08 | Sebagai pengelola, saya ingin memproses laporan kerusakan dan meminta persetujuan pemilik untuk biaya besar.                                                 | BR-12               |
| US-09 | Sebagai pemilik, saya ingin menyetujui biaya perbaikan, membatalkan pembayaran yang salah, dan mengakhiri kontrak lebih awal, dengan jejak di *audit log*. | BR-05, BR-09, BR-12 |
| US-10 | Sebagai pemilik, saya ingin melihat pendapatan, tunggakan, dan hunian per unit dan per bulan.                                                                | BR-10               |

## **6\. Alur Status**

**Alur Status Kontrak**

| Dari   | Ke         | Siapa     | Syarat                                                                  |
| :----- | :--------- | :-------- | :---------------------------------------------------------------------- |
| (baru) | draf       | Pengelola | Unit tersedia, tidak beririsan (BR-01, BR-02, BR-04)                    |
| draf   | aktif      | Pengelola | Identitas terverifikasi, penyewa tidak punya kontrak aktif lain (BR-03) |
| draf   | dibatalkan | Pengelola | Tidak ada                                                               |
| aktif  | selesai    | Pengelola | Tanggal selesai sudah lewat, semua tagihan lunas (BR-05)                |
| aktif  | diakhiri   | Pemilik   | Alasan wajib; berakhir pada akhir bulan berjalan (BR-05)                |

Status selesai, diakhiri, dan dibatalkan adalah status akhir. Penyewa tidak bisa mengubah status kontrak.

**Status Tagihan** (berubah otomatis, BR-08 dan BR-09): belum bayar → sebagian → lunas. 

Gagal mengunggah ke Server Storage: new row violates row-level security policyPembatalan pembayaran oleh Pemilik dapat mengembalikan lunas ke sebagian atau belum bayar. Belum bayar → dibatalkan hanya oleh Pemilik.

**Alur Status Laporan Kerusakan**

| Dari                 | Ke                   | Siapa                                          | Syarat                                                                      |
| :------------------- | :------------------- | :--------------------------------------------- | :-------------------------------------------------------------------------- |
| (baru)               | dilaporkan           | Penyewa                                        | Kontrak aktif, foto 1 sampai 3, maksimal 3 laporan terbuka (BR-11)          |
| dilaporkan           | diproses             | Pengelola                                      | Estimasi biaya terisi dan paling banyak Rp1.000.000                         |
| dilaporkan           | menunggu persetujuan | Pengelola                                      | Estimasi biaya di atas Rp1.000.000                                          |
| dilaporkan           | ditolak              | Pengelola                                      | Alasan wajib                                                                |
| menunggu persetujuan | diproses             | Pemilik                                        | Menyetujui biaya                                                            |
| menunggu persetujuan | ditolak              | Pemilik                                        | Alasan wajib                                                                |
| diproses             | selesai              | Pengelola                                      | Biaya aktual terisi; bila di atas Rp1.000.000 harus sudah disetujui Pemilik |
| selesai              | ditutup              | Penyewa pelapor, atau Pengelola setelah 3 hari | BR-12                                                                       |

Perpindahan lain ditolak. Ditutup dan ditolak adalah status akhir.

## **7\. Halaman**

| Halaman          | Akses                    | Isi                                                                                                                                                                                      |
| :--------------- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Masuk dan Daftar | Publik                   | Masuk dengan email dan kata sandi; daftar akun baru (otomatis peran Penyewa)                                                                                                             |
| Beranda          | Semua peran, isi berbeda | Penyewa: kontrak aktif, tagihan dan tombol bayar, form data identitas. Pengelola dan Pemilik: jumlah unit terisi, tagihan lewat jatuh tempo, laporan terbuka, kontrak yang akan berakhir |
| Unit             | Pengelola, Pemilik       | Daftar 24 unit dengan status dan penyewa saat ini; ubah status (Pengelola); ubah harga (Pemilik)                                                                                         |
| Penyewa          | Pengelola, Pemilik       | Daftar penyewa dan status verifikasi. Pengelola melihat identitas lengkap dan tombol verifikasi. Pemilik melihat NIK tersamar                                                            |
| Kontrak          | Pengelola, Pemilik       | Daftar dan filter kontrak, form kontrak baru, detail kontrak dengan tombol status sesuai peran                                                                                           |
| Tagihan          | Pengelola, Pemilik       | Daftar tagihan per periode, tombol buat tagihan bulanan, detail tagihan, form catat pembayaran, riwayat pembayaran, tombol batal (Pemilik)                                               |
| Kerusakan        | Semua peran              | Penyewa: laporan miliknya dan form laporan baru. Staf: semua laporan, detail dengan foto, langkah status, tombol sesuai peran                                                            |
| Laporan          | Pemilik                  | Grafik ditagihkan dan diterima per bulan, hunian per bulan, tabel pendapatan dan tunggakan per unit, tab *audit log*, pengaturan peran akun                                            |

Referensi tampilan empat halaman utama ada di file Wireframe\_Properti.pdf.

## **8\. Data Utama**

Struktur lengkap ada di ERD\_Properti.pdf (9 tabel inti).

| Data              | Isi penting                                                                                   |
| :---------------- | :-------------------------------------------------------------------------------------------- |
| Profil akun       | nama, email, nomor HP, peran, status aktif                                                    |
| Identitas penyewa | NIK, alamat asal, foto KTP, kontak darurat, status verifikasi                                 |
| Unit              | kode, lantai, tipe, luas, harga sewa bulanan, status                                          |
| Kontrak           | nomor, unit, penyewa, tanggal mulai, durasi, tanggal selesai, harga sewa yang dikunci, status |
| Tagihan           | nomor, kontrak, periode, jatuh tempo, nominal sewa, denda, terbayar, status                   |
| Pembayaran        | tagihan, jumlah, metode, tanggal, bukti, status sah atau dibatalkan                           |
| Laporan kerusakan | nomor, unit, pelapor, kategori, foto, status, estimasi biaya, biaya aktual, persetujuan       |
| Nomor urut        | penghitung nomor kontrak, tagihan, dan laporan                                                |
| *Audit log*     | pelaku, peran, aksi, data sebelum dan sesudah, waktu                                          |

File foto KTP, foto kerusakan, dan bukti transfer disimpan di Supabase Storage dengan *bucket* privat.

## **9\. Dashboard dan Laporan**

**Beranda staf** (Pengelola dan Pemilik): kartu jumlah unit terisi dibanding unit layak sewa, tagihan bulan ini yang lunas, tagihan lewat jatuh tempo, dan laporan kerusakan terbuka. Di bawahnya daftar tagihan lewat jatuh tempo (dengan sisa dan denda per hari ini), laporan terbuka, dan kontrak yang berakhir dalam 30 hari. Beranda tidak menampilkan angka pendapatan.

**Laporan Pemilik** dengan filter rentang bulan:

1. Kartu total ditagihkan, total diterima, tunggakan, dan persentase hunian.
2. Grafik batang ditagihkan dibanding diterima per bulan.
3. Persentase hunian per bulan (unit terisi dibagi unit yang tidak nonaktif).
4. Tabel pendapatan per unit: ditagihkan, diterima, tunggakan, bisa diurutkan dan diunduh CSV.
5. Tab *audit log* dengan filter jenis aksi dan tanggal.

## **10\. Kebutuhan Non-Fungsional**

1. Halaman Beranda dan Tagihan tampil dalam 2 detik untuk 60 tagihan per bulan di koneksi 4G.
2. Aplikasi bersifat internal: semua halaman diberi *noindex* dan tidak masuk *sitemap*.
3. Hak akses dijaga di database, bukan hanya dengan menyembunyikan tombol. Penyewa yang memanggil API langsung tetap tidak bisa melihat data penyewa lain atau mengubah status.
4. Foto KTP hanya bisa dibuka lewat tautan sementara (*signed URL*) dan tidak pernah publik.
5. *Audit log* mencatat: verifikasi identitas, aktivasi, penyelesaian, dan pengakhiran kontrak, pencatatan dan pembatalan pembayaran, pembatalan tagihan, perubahan harga dan status unit, perubahan peran akun, dan setiap perubahan status laporan kerusakan. *Audit log* tidak boleh menyimpan NIK atau foto KTP.
6. Pesan galat ditampilkan dalam bahasa Indonesia yang jelas, misalnya "Unit sudah punya kontrak pada periode itu".
7. Database dicadangkan otomatis setiap hari; data contoh bisa dimuat ulang untuk demo.

## **11\. Fitur Nilai Tambah (opsional)**

**Pembayaran tagihan lewat Mayar.** Penyewa menekan tombol "Bayar Online" di tagihannya. Aplikasi membuat invoice Mayar (API V2 *sandbox* https\://api.mayar.io/hl/v2, POST /invoices/create) sebesar sisa tagihan ditambah denda per hari itu, lalu menyimpan ID dan tautan invoice. Saat Mayar mengirim *webhook* payment.received, aplikasi memeriksa ulang status invoice lewat GET /invoices/{id} sebelum mencatat pembayaran. Ketentuan:

* pembayaran *online* harus melunasi sisa tagihan, tidak bisa dicicil;
* invoice berlaku sampai akhir hari dibuat, karena denda bertambah setiap hari;
* *webhook* yang sama dikirim dua kali hanya dicatat satu kali;
* pembayaran dari Mayar tercatat dengan metode "mayar" dan tidak bisa dicatat manual oleh Pengelola.

Fitur ini tidak wajib. Tanpa Mayar, semua pembayaran tetap bisa dicatat Pengelola.

## **12\. Akun Uji dan Data Contoh**

Semua akun uji dan data contoh ada di Data\_Contoh\_Properti.xlsx (sheet "Akun Uji" dan satu sheet per tabel). Ringkasan akun:

| Peran     | Email                                                          | Catatan                                              |
| :-------- | :------------------------------------------------------------- | :--------------------------------------------------- |
| Pemilik   | ratna@griyakenanga.test                                        | Ratna Kusumawardani                                  |
| Pengelola | bayu@griyakenanga.test, sinta@griyakenanga.test                | Dua pengelola untuk uji aksi bersamaan               |
| Penyewa   | 22 akun, contoh dimas@, hana@, fajar@, cahya@griyakenanga.test | Masing-masing punya kasus uji (lihat sheet Petunjuk) |

Semua akun memakai kata sandi latihan Latihan\#2026. Tanggal acuan data adalah 15 Oktober 2026\. Data berisi 24 unit, 23 kontrak, 57 tagihan (Agustus sampai Oktober 2026), 55 pembayaran, dan 13 laporan kerusakan, termasuk kasus batas seperti denda yang mencapai batas Rp200.000 dan penyewa yang sudah punya 3 laporan terbuka.

## **13\. Kriteria Selesai**

* ☐ Aplikasi tayang di Netlify, bisa masuk dengan ketiga peran memakai akun uji.
* ☐ Data contoh dari file xlsx sudah dimuat dan Beranda menampilkan angka yang sama dengan data.
* ☐ Membuat kontrak beririsan di unit yang sama ditolak, termasuk saat dua pengelola mencoba bersamaan (BR-01).
* ☐ Aktivasi kontrak Fajar ditolak sebelum identitasnya diverifikasi, dan berhasil setelah diverifikasi (BR-03).
* ☐ Tombol buat tagihan bulanan yang ditekan dua kali tidak menghasilkan tagihan dobel; nomor tetap berurutan (BR-06).
* ☐ Pembayaran tagihan Oktober Dimas pada 15 Oktober memunculkan denda Rp100.000; tagihan September Hana dendanya berhenti di Rp200.000 (BR-07).
* ☐ Pembayaran melebihi sisa atau cicilan di bawah Rp100.000 ditolak dengan pesan jelas (BR-08).
* ☐ Penyewa yang mencoba mengubah status tagihan atau membaca data penyewa lain lewat API ditolak (BR-10).
* ☐ Pemilik tidak bisa melihat NIK lengkap; Pengelola tidak bisa membuka laporan pendapatan (BR-10).
* ☐ Laporan kerusakan keempat milik Dimas ditolak (BR-11).
* ☐ Biaya perbaikan di atas Rp1.000.000 tidak bisa diproses tanpa persetujuan Pemilik (BR-12).
* ☐ Setiap aksi di bagian 10 butir 5 muncul di *audit log* dan bisa dibaca Pemilik saja.
* ☐ Halaman Laporan menampilkan grafik per bulan dan tabel per unit.
* ☐ Minimal 10 *test case* dari aturan bisnis ditulis dan dijalankan, dengan hasilnya dicatat.
* ☐ Semua halaman memiliki *noindex*.

## **14\. Di Luar Lingkup**

Aplikasi ponsel *native*, pengelolaan beberapa properti atau cabang, deposit dan pengembalian deposit, tagihan listrik, air, atau layanan tambahan per unit, pemesanan unit oleh calon penyewa dari situs publik, tanda tangan kontrak digital, pengingat otomatis lewat WhatsApp atau email, akuntansi dan pajak, serta penggajian staf.
