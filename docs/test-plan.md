# Rencana & Laporan Pengujian (Test Plan & Report)
## Aplikasi Manajemen Properti — Griya Kenanga Residence

**Nomor Dokumen:** GKR-QA-TP-202610  
**Versi:** 1.0.0  
**Tanggal Pengujian:** 23 Oktober 2026  
**Status Pengujian Keseluruhan:** **100% LULUS (Passed)**  
**Referensi Utama:** [PRD_Properti.docx.md](../PRD_Properti.docx.md) · [Data_Contoh_Properti.xlsx](../Data_Contoh_Properti.xlsx)

---

## 1. Ringkasan Eksekutif & Tujuan

Dokumen ini mendokumentasikan rencana dan laporan eksekusi pengujian komprehensif untuk sistem aplikasi manajemen properti **Griya Kenanga Residence**. Pengujian ini memverifikasi implementasi menyeluruh dari seluruh aturan bisnis (**BR-01 s/d BR-12**), alur cerita pengguna (**US-01 s/d US-10**), pengujian skenario negatif (penanganan galat & batas validasi), serta pengujian pembatasan hak akses berbasis peran (*Role-Based Access Control* / RBAC).

### Lingkungan & Akun Pengujian
- **Platform:** Web Application (React + TypeScript + Tailwind CSS + Supabase Data Engine)
- **Lingkungan Uji:** Local Development Server (`http://localhost:5173`)
- **Tanggal Acuan Data Uji:** 15 Oktober 2026
- **Akun Uji Terlibat:**
  - **Pemilik:** `ratna@griyakenanga.test` (Ratna Kusumawardani)
  - **Pengelola:** `bayu@griyakenanga.test` (Bayu Prasetyo) & `sinta@griyakenanga.test` (Sinta Dewi)
  - **Penyewa:** `dimas@griyakenanga.test` (Dimas Pratama), `hana@griyakenanga.test` (Hana Pertiwi), `fajar@griyakenanga.test` (Fajar Nugroho), `rethaaldaa@griyakenangan.test` (Aretha Esmeralda)
  - **Kata Sandi Standar:** `Latihan#2026`

---

## 2. Matriks Keterlacakan (Traceability Matrix)

| Kode US | Kode BR | Modul / Fitur | ID Test Case | Kategori Pengujian | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **US-01, US-02** | BR-03, BR-10 | Identitas & Verifikasi KTP | `TC-POS-01` | Uji Positif | **Lulus** |
| **US-03** | BR-01, BR-02, BR-04 | Pembuatan Kontrak Baru | `TC-POS-02` | Uji Positif | **Lulus** |
| **US-03** | BR-03 | Aktivasi Kontrak Draf | `TC-POS-03` | Uji Positif | **Lulus** |
| **US-04** | BR-06 | Tagihan Bulanan Massal | `TC-POS-04` | Uji Positif | **Lulus** |
| **US-05, US-06** | BR-07, BR-08 | Pembayaran Tepat Waktu | `TC-POS-05` | Uji Positif | **Lulus** |
| **US-05** | BR-07, BR-08 | Denda Keterlambatan & Cicilan | `TC-POS-06` | Uji Positif | **Lulus** |
| **US-07, US-08** | BR-11, BR-12 | Laporan Kerusakan Normal | `TC-POS-07` | Uji Positif | **Lulus** |
| **US-08, US-09** | BR-12 | Persetujuan Biaya Besar Pemilik | `TC-POS-08` | Uji Positif | **Lulus** |
| **US-09** | BR-05 | Pengakhiran Kontrak Lebih Awal | `TC-POS-09` | Uji Positif | **Lulus** |
| **US-10** | BR-10 | Laporan Keuangan & Audit Log | `TC-POS-10` | Uji Positif | **Lulus** |
| **US-03** | BR-01 | Pencegahan Kontrak Beririsan | `TC-NEG-01` | Uji Negatif | **Lulus** |
| **US-03** | BR-02 | Validasi Tanggal Mulai Bukan Tgl 1 | `TC-NEG-02` | Uji Negatif | **Lulus** |
| **US-03** | BR-04 | Pembuatan Kontrak di Unit Terisi | `TC-NEG-03` | Uji Negatif | **Lulus** |
| **US-03** | BR-03 | Aktivasi Sebelum Identitas Diverifikasi | `TC-NEG-04` | Uji Negatif | **Lulus** |
| **US-04** | BR-06 | Pencegahan Tagihan Dobel | `TC-NEG-05` | Uji Negatif | **Lulus** |
| **US-05** | BR-07 | Batas Maksimal Denda (Cap Rp200.000) | `TC-NEG-06` | Uji Negatif | **Lulus** |
| **US-05** | BR-08 | Validasi Pembayaran Di Luar Batas | `TC-NEG-07` | Uji Negatif | **Lulus** |
| **US-07** | BR-11 | Pembatasan Maksimal 3 Laporan Terbuka | `TC-NEG-08` | Uji Negatif | **Lulus** |
| **US-08** | BR-12 | Pemrosesan Biaya Besar Tanpa Approval | `TC-NEG-09` | Uji Negatif | **Lulus** |
| **US-01, US-02** | BR-10 | Masking NIK Penyewa bagi Pemilik | `TC-SEC-01` | Uji Hak Akses | **Lulus** |
| **US-10** | BR-10 | Isolasi Akses Halaman Laporan Keuangan | `TC-SEC-02` | Uji Hak Akses | **Lulus** |
| **US-06** | BR-10 | Isolasi Data Antar-Penyewa | `TC-SEC-03` | Uji Hak Akses | **Lulus** |
| **US-09** | BR-09, BR-10 | Larangan Turunkan Peran Sendiri & Audit Log | `TC-SEC-04` | Uji Hak Akses | **Lulus** |

---

## 3. Rincian Test Cases

### Bagian A: Uji Positif (Happy Path)

#### `TC-POS-01`: Pengisian Data Identitas Penyewa Baru dan Verifikasi oleh Pengelola
- **Referensi:** US-01, US-02, BR-03, BR-10
- **Peran Penguji:** Penyewa (`fajar@griyakenanga.test`) dilanjutkan Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Akun Fajar Nugroho baru terdaftar dengan peran penyewa dan belum melengkapi berkas identitas.
- **Langkah Pengujian:**
  1. Masuk sebagai `fajar@griyakenanga.test`.
  2. Buka menu Identitas / Formulir Identitas di Beranda.
  3. Masukkan NIK (16 digit angka: `3404011205980003`), alamat asal, kontak darurat, dan unggah foto KTP berformat PNG/JPG.
  4. Simpan data identitas.
  5. Keluar dan masuk sebagai Pengelola `bayu@griyakenanga.test`.
  6. Buka menu **Verifikasi Penyewa**, periksa kelengkapan data Fajar Nugroho, lalu klik tombol **Verifikasi**.
- **Data Uji:** NIK: `3404011205980003`, Nama: Fajar Nugroho, Status Awal: `menunggu_verifikasi`.
- **Hasil yang Diharapkan:** Data tersimpan dengan aman di database. Pengelola dapat melihat NIK lengkap dan foto KTP. Status verifikasi berubah menjadi `terverifikasi`.
- **Hasil Aktual:** Data identitas berhasil disimpan dan diverifikasi oleh Pengelola. Status profil diperbarui menjadi `terverifikasi`.
- **Status:** **Lulus**

---

#### `TC-POS-02`: Pembuatan Kontrak Sewa Baru untuk Unit Berstatus Tersedia
- **Referensi:** US-03, BR-01, BR-02, BR-04
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Unit C-301 berstatus `tersedia`. Calon penyewa Aretha Esmeralda berstatus terverifikasi.
- **Langkah Pengujian:**
  1. Masuk sebagai Pengelola.
  2. Navigasi ke menu **Kontrak Sewa**, lalu klik **Buat Kontrak Baru**.
  3. Pilih unit `C-301 (Lantai 3 - STUDIO) [tersedia]`.
  4. Pilih calon penyewa `Aretha Esmeralda`.
  5. Masukkan tanggal mulai `2026-11-01` (selalu tanggal 1 awal bulan).
  6. Pilih durasi sewa `3 Bulan`.
  7. Periksa kolom kalkulasi tanggal selesai otomatis.
  8. Klik tombol **Simpan Kontrak Draf**.
- **Data Uji:** Unit: C-301, Tgl Mulai: `2026-11-01`, Durasi: 3 bulan, Harga Unit: Rp2.900.000.
- **Hasil yang Diharapkan:** Tanggal selesai otomatis terhitung `2027-01-31` (hari terakhir bulan ke-3). Harga sewa terkunci pada Rp2.900.000. Nomor kontrak otomatis dibuat (format: `KTR-2026-xxxx`). Status kontrak baru adalah `draf`.
- **Hasil Aktual:** Kontrak draf berhasil dibuat dengan nomor urut baru, tanggal selesai `2027-01-31`, dan harga terkunci aman.
- **Status:** **Lulus**

---

#### `TC-POS-03`: Aktivasi Kontrak Draf Menjadi Aktif dan Perubahan Status Unit
- **Referensi:** US-03, BR-03, BR-04
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Kontrak draf untuk unit C-301 atas nama Aretha Esmeralda sudah ada. Identitas Aretha berstatus `terverifikasi` dan belum memiliki kontrak aktif lain.
- **Langkah Pengujian:**
  1. Masuk sebagai Pengelola.
  2. Buka halaman **Kontrak Sewa**, cari baris kontrak draf unit C-301.
  3. Klik tombol **Aktivasi**.
  4. Konfirmasi dialog aktivasi.
  5. Periksa status kontrak dan navigasi ke halaman **Daftar Unit**.
- **Data Uji:** Kontrak ID draf unit C-301.
- **Hasil yang Diharapkan:** Status kontrak berubah dari `draf` menjadi `aktif`. Status unit C-301 otomatis berubah dari `tersedia` menjadi `terisi`. Tercatat pada audit log.
- **Hasil Aktual:** Kontrak berhasil berstatus `aktif`, unit C-301 langsung berubah menjadi `terisi`.
- **Status:** **Lulus**

---

#### `TC-POS-04`: Pembuatan Tagihan Bulanan Massal dengan Satu Klik Tanpa Duplikasi
- **Referensi:** US-04, BR-06
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Terdapat 22 kontrak aktif pada periode bulan berjalan (Oktober 2026).
- **Langkah Pengujian:**
  1. Masuk sebagai Pengelola.
  2. Buka menu **Tagihan & Kas**.
  3. Klik tombol **Buat Tagihan Bulanan** untuk periode `2026-10`.
  4. Periksa daftar tagihan yang dihasilkan.
- **Data Uji:** Periode: `2026-10`, Jatuh Tempo Standar: `2026-10-10`.
- **Hasil yang Diharapkan:** Setiap kontrak aktif hanya memiliki 1 tagihan untuk periode Oktober 2026. Nomor tagihan urut berformat `INV-202610-0001` dst tanpa lompat dan tanpa duplikasi. Tanggal jatuh tempo otomatis `2026-10-10`.
- **Hasil Aktual:** 22 tagihan terbit secara instan, nomor berurutan rapi, jatuh tempo 10 Oktober 2026.
- **Status:** **Lulus**

---

#### `TC-POS-05`: Pencatatan Pembayaran Tagihan Tepat Waktu (Bebas Denda)
- **Referensi:** US-05, US-06, BR-07, BR-08
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Tagihan periode 2026-10 atas nama Cahya Wibowo (Unit A-102, nominal Rp1.600.000, jatuh tempo 2026-10-10).
- **Langkah Pengujian:**
  1. Buka menu **Tagihan & Kas**.
  2. Pilih tagihan Cahya Wibowo.
  3. Catat pembayaran tunai sebesar Rp1.600.000 pada tanggal `2026-10-09` (sebelum jatuh tempo).
  4. Simpan pembayaran.
- **Data Uji:** Nominal Tagihan: Rp1.600.000, Tgl Pembayaran: `2026-10-09`, Metode: Tunai.
- **Hasil yang Diharapkan:** Denda keterlambatan bernilai Rp0. Total pembayaran sama dengan nominal sewa. Status tagihan otomatis berubah menjadi `lunas`.
- **Hasil Aktual:** Denda terhitung Rp0, total tagihan terbayar penuh, status tagihan otomatis menjadi `lunas`.
- **Status:** **Lulus**

---

#### `TC-POS-06`: Perhitungan Denda Keterlambatan Otomatis (Rp20.000/hari) & Pembayaran Cicilan
- **Referensi:** US-05, BR-07, BR-08
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Tagihan Oktober Dimas Pratama (jatuh tempo 10 Oktober 2026, harga sewa Rp2.000.000). Tanggal acuan pencatatan adalah 15 Oktober 2026 (terlambat 5 hari).
- **Langkah Pengujian:**
  1. Buka tagihan Oktober Dimas Pratama pada tanggal 15 Oktober 2026.
  2. Periksa kalkulasi denda otomatis pada antarmuka.
  3. Masukkan pembayaran cicilan pertama sebesar Rp1.000.000 via transfer bank (lampirkan bukti transfer).
  4. Simpan pembayaran.
- **Data Uji:** Jatuh tempo: `2026-10-10`, Tgl bayar: `2026-10-15` (selisih 5 hari), Cicilan: Rp1.000.000.
- **Hasil yang Diharapkan:** Denda dihitung 5 hari × Rp20.000 = Rp100.000. Total tagihan menjadi Rp2.100.000. Setelah dicicil Rp1.000.000, sisa tagihan menjadi Rp1.100.000 dan status tagihan otomatis `sebagian`.
- **Hasil Aktual:** Denda otomatis Rp100.000, pembayaran cicilan tercatat, sisa tagihan Rp1.100.000 dengan status `sebagian`.
- **Status:** **Lulus**

---

#### `TC-POS-07`: Pelaporan Kerusakan Normal dan Pemrosesan Biaya Operasional Kecil (<= Rp1.000.000)
- **Referensi:** US-07, US-08, BR-11, BR-12
- **Peran Penguji:** Penyewa (`hana@griyakenanga.test`) & Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Hana Pertiwi memiliki kontrak aktif di unit B-201. Belum memiliki 3 laporan terbuka.
- **Langkah Pengujian:**
  1. Masuk sebagai `hana@griyakenanga.test`.
  2. Buka menu **Lapor Kerusakan**, isi judul "Kran Wastafel Bocor", kategori pipa/sanitasi, unggah 1 foto bukti.
  3. Kirim laporan -> status `dilaporkan`.
  4. Masuk sebagai Pengelola `bayu@griyakenanga.test`.
  5. Buka laporan tersebut, masukkan estimasi biaya perbaikan Rp350.000 (<= Rp1.000.000), lalu klik **Mulai Proses**.
  6. Selesaikan pekerjaan dengan mengisi biaya aktual Rp350.000, ubah status ke `selesai`.
  7. Masuk kembali sebagai Hana dan klik tombol **Tutup Laporan**.
- **Data Uji:** Biaya Estimasi: Rp350.000, Biaya Aktual: Rp350.000.
- **Hasil yang Diharapkan:** Laporan dapat langsung diproses tanpa memerlukan persetujuan pemilik karena biaya <= Rp1.000.000. Status berpindah: `dilaporkan` -> `diproses` -> `selesai` -> `ditutup`.
- **Hasil Aktual:** Seluruh alur status berjalan mulus tanpa hambatan persetujuan pemilik dan laporan berhasil ditutup oleh pelapor.
- **Status:** **Lulus**

---

#### `TC-POS-08`: Pengajuan Kerusakan Biaya Besar (> Rp1.000.000) dengan Persetujuan Pemilik
- **Referensi:** US-08, US-09, BR-12
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`) & Pemilik (`ratna@griyakenanga.test`)
- **Pra-kondisi:** Laporan kerusakan unit C-303 (Kompresor AC Rusak Berat) berstatus `dilaporkan`.
- **Langkah Pengujian:**
  1. Masuk sebagai Pengelola.
  2. Buka laporan kerusakan unit C-303, masukkan estimasi biaya perbaikan Rp1.750.000 (> Rp1.000.000).
  3. Klik tombol **Ajukan Persetujuan Pemilik**.
  4. Masuk sebagai Pemilik `ratna@griyakenanga.test`.
  5. Buka halaman Laporan Kerusakan, tinjau pengajuan biaya Rp1.750.000, lalu klik **Setujui Biaya**.
  6. Masuk kembali sebagai Pengelola, lanjutkan pengerjaan hingga selesai.
- **Data Uji:** Estimasi Biaya: Rp1.750.000 (melebihi ambang batas Rp1.000.000).
- **Hasil yang Diharapkan:** Laporan berpindah ke status `menunggu persetujuan`. Pengelola tidak dapat menandai selesai sebelum disetujui. Setelah Pemilik menyetujui, status berubah menjadi `diproses`.
- **Hasil Aktual:** Status berpindah ke `menunggu persetujuan`, tombol aksi terkunci untuk Pengelola, berhasil disetujui oleh Pemilik, dan perbaikan dapat diselesaikan.
- **Status:** **Lulus**

---

#### `TC-POS-09`: Pengakhiran Kontrak Sewa Lebih Awal oleh Pemilik dengan Alasan Wajib
- **Referensi:** US-09, BR-05
- **Peran Penguji:** Pemilik (`ratna@griyakenanga.test`)
- **Pra-kondisi:** Kontrak aktif unit B-204 atas nama Rian Kurniawan.
- **Langkah Pengujian:**
  1. Masuk sebagai Pemilik.
  2. Buka menu **Kontrak Sewa**, cari baris kontrak aktif unit B-204.
  3. Klik tombol **Akhiri Awal**.
  4. Masukkan alasan pengakhiran: "Penyewa dipindahtugaskan ke luar pulau atas kesepakatan bersama".
  5. Konfirmasi pengakhiran kontrak.
- **Data Uji:** Alasan: Wajib diisi (string non-empty).
- **Hasil yang Diharapkan:** Status kontrak berubah menjadi `diakhiri`, tanggal efektif adalah akhir bulan berjalan, dan alasan pengakhiran tersimpan di database serta audit log.
- **Hasil Aktual:** Kontrak berhasil diakhiri lebih awal dengan alasan tercatat rapi pada tabel kontrak dan audit log.
- **Status:** **Lulus**

---

#### `TC-POS-10`: Tampilan Dashboard Eksekutif dan Laporan Keuangan Pemilik
- **Referensi:** US-10, BR-10
- **Peran Penguji:** Pemilik (`ratna@griyakenanga.test`)
- **Pra-kondisi:** Database berisi transaksi tagihan, pembayaran, dan unit terisi periode Agustus s/d Oktober 2026.
- **Langkah Pengujian:**
  1. Masuk sebagai Pemilik.
  2. Buka menu **Laporan Keuangan**.
  3. Tinjau kartu ringkasan: Total Ditagihkan, Total Diterima, Total Tunggakan, dan Rasio Okupansi Hunian.
  4. Periksa grafik komparasi bulanan dan tabel rincian pendapatan per unit.
  5. Buka tab **Audit Log**, filter aksi berdasarkan tanggal.
- **Data Uji:** Periode filter: Agustus - Oktober 2026.
- **Hasil yang Diharapkan:** Seluruh metrik keuangan tampil akurat, grafik batang bulanan ter-render dengan rapi, tabel pendapatan per unit dapat ditinjau, dan audit log menampilkan jejak operasional sensitif.
- **Hasil Aktual:** Halaman Laporan menyajikan seluruh metrik bisnis secara lengkap, transparan, dan reaktif.
- **Status:** **Lulus**

---

### Bagian B: Uji Negatif & Batas Validasi (Negative Tests)

#### `TC-NEG-01`: Penolakan Pembuatan Kontrak Beririsan (Overlapping Period) pada Unit yang Sama
- **Referensi:** US-03, BR-01
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Unit C-301 memiliki kontrak aktif pada periode `2026-08-01` s/d `2026-10-31`.
- **Langkah Pengujian:**
  1. Buka modal **Buat Kontrak Sewa Baru**.
  2. Pilih unit C-301.
  3. Masukkan tanggal mulai `2026-10-01` (bertumpuk dengan kontrak berjalan) dengan durasi 3 bulan.
  4. Perhatikan antarmuka modal dan tombol simpan.
- **Data Uji:** Periode baru: `2026-10-01` s/d `2026-12-31` (overlap pada Oktober 2026).
- **Hasil yang Diharapkan:** Sistem memvalidasi overlap (BR-01). Muncul kotak peringatan merah di bawah heading modal: *"Aturan BR-01: Unit C-301 sudah memiliki kontrak aktif/draf pada periode tersebut. Periode sewa tidak boleh beririsan."* Tombol **Simpan Kontrak Draf** dalam kondisi *disabled* dan tidak dapat diklik.
- **Hasil Aktual:** Kotak merah aturan BR-01 muncul secara instan, tombol dinonaktifkan, dan sistem menolak penyimpanan kontrak overlap.
- **Status:** **Lulus**

---

#### `TC-NEG-02`: Penolakan Tanggal Mulai Kontrak Selain Tanggal 1 Awal Bulan
- **Referensi:** US-03, BR-02
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Form buat kontrak sewa baru terbuka.
- **Langkah Pengujian:**
  1. Pilih unit yang tersedia.
  2. Masukkan tanggal mulai sewa `2026-11-15` (tanggal di pertengahan bulan).
  3. Amati pesan validasi dan status tombol simpan.
- **Data Uji:** Tanggal Mulai: `2026-11-15` (hari ke-15).
- **Hasil yang Diharapkan:** Sistem menolak tanggal selain tanggal 1 (BR-02). Muncul pesan peringatan merah: *"Aturan BR-02: Tanggal mulai sewa harus selalu tanggal 1 di awal bulan (contoh: 2026-11-01)."* Tombol simpan dinonaktifkan.
- **Hasil Aktual:** Muncul peringatan merah BR-02 dan tombol simpan terkunci secara otomatis.
- **Status:** **Lulus**

---

#### `TC-NEG-03`: Penolakan Pembuatan Kontrak pada Unit yang Berstatus Tidak Tersedia
- **Referensi:** US-03, BR-04
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Unit A-101 berstatus `terisi` (atau unit lain berstatus `pemeliharaan`).
- **Langkah Pengujian:**
  1. Buka modal **Buat Kontrak Sewa Baru**.
  2. Pada pilihan unit, pilih unit `A-101 (Lantai 1 - STANDAR) [terisi]`.
  3. Amati pesan peringatan di bawah heading.
- **Data Uji:** Unit A-101 berstatus `terisi`.
- **Hasil yang Diharapkan:** Muncul peringatan merah: *"Aturan BR-04: Unit A-101 berstatus 'terisi'. Kontrak sewa baru hanya dapat dibuat untuk unit yang berstatus 'tersedia'."* Tombol simpan dinonaktifkan.
- **Hasil Aktual:** Peringatan merah BR-04 langsung tampil dan tombol simpan terkunci.
- **Status:** **Lulus**

---

#### `TC-NEG-04`: Penolakan Aktivasi Kontrak Draf Jika Identitas Penyewa Belum Terverifikasi
- **Referensi:** US-03, BR-03
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Kontrak draf dibuat untuk calon penyewa dengan profil berstatus `menunggu_verifikasi` atau `belum_unggah`.
- **Langkah Pengujian:**
  1. Pengelola mencoba menekan tombol aktivasi pada kontrak draf tersebut atau memicu `activateContract`.
- **Data Uji:** Status Identitas Penyewa: `menunggu_verifikasi`.
- **Hasil yang Diharapkan:** Sistem menolak aktivasi dengan galat jelas: *"Kontrak draf hanya bisa diaktifkan bila identitas penyewa sudah diverifikasi oleh Pengelola (BR-03)."* Status kontrak tetap `draf`.
- **Hasil Aktual:** Eksekusi diblokir, pesan galat BR-03 ditampilkan, kontrak tetap draf.
- **Status:** **Lulus**

---

#### `TC-NEG-05`: Pencegahan Pembuatan Tagihan Bulanan Ganda pada Periode yang Sama
- **Referensi:** US-04, BR-06
- **Peran Penguji:** Pengelola (`sinta@griyakenanga.test`)
- **Pra-kondisi:** Tagihan bulanan periode Oktober 2026 (`2026-10`) sudah terbit untuk semua unit aktif.
- **Langkah Pengujian:**
  1. Pengelola menekan kembali tombol **Buat Tagihan Bulanan** untuk periode `2026-10`.
- **Data Uji:** Periode tagihan: `2026-10` yang sudah ada.
- **Hasil yang Diharapkan:** Sistem mendeteksi bahwa tagihan periode tersebut sudah ada untuk kontrak bersangkutan. Tidak ada tagihan ganda yang dibuat, dan nomor urut invoice tidak lompat. Muncul notifikasi: *"Tagihan periode 2026-10 sudah dibuat sebelumnya."*
- **Hasil Aktual:** Sistem menolak duplikasi tagihan, jumlah invoice tetap 22 dan tidak ada data kembar.
- **Status:** **Lulus**

---

#### `TC-NEG-06`: Pembatasan Denda Keterlambatan Maksimal Terhenti di Rp200.000 (Kasus Hana)
- **Referensi:** US-05, BR-07
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Tagihan September Hana Pertiwi jatuh tempo 10 September 2026 (`2026-09-10`). Tanggal acuan pengujian 15 Oktober 2026 (terlambat 35 hari).
- **Langkah Pengujian:**
  1. Periksa kalkulasi denda pada tagihan September Hana Pertiwi.
  2. Hitung rumus denda: 35 hari × Rp20.000 = Rp700.000.
- **Data Uji:** Jatuh tempo: `2026-09-10`, Tanggal hitung: `2026-10-15`.
- **Hasil yang Diharapkan:** Denda tidak menjadi Rp700.000, melainkan dipotong (*capped*) tepat pada batas maksimal Rp200.000 sesuai aturan BR-07.
- **Hasil Aktual:** Sistem mengunci denda pada angka Rp200.000 (terverifikasi lewat unit test dan UI).
- **Status:** **Lulus**

---

#### `TC-NEG-07`: Penolakan Pembayaran Melebihi Sisa Tagihan atau Cicilan di Bawah Rp100.000
- **Referensi:** US-05, BR-08
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Sisa tagihan sebesar Rp1.500.000.
- **Langkah Pengujian:**
  1. Coba input pembayaran sebesar Rp50.000 (kurang dari syarat cicilan minimum).
  2. Amati respons validasi formulir.
  3. Coba input pembayaran sebesar Rp1.600.000 (melebihi sisa tagihan Rp1.500.000).
  4. Amati respons validasi formulir.
- **Data Uji:** Kasus 1: Rp50.000, Kasus 2: Rp1.600.000 pada sisa Rp1.500.000.
- **Hasil yang Diharapkan:** Kasus 1 ditolak dengan pesan: *"Cicilan minimal Rp100.000 kecuali untuk melunasi sisa tagihan."* Kasus 2 ditolak dengan pesan: *"Jumlah pembayaran melebihi sisa tagihan."*
- **Hasil Aktual:** Kedua transaksi tidak valid ditolak oleh fungsi validasi bisnis (`validatePaymentAmount`) dan formulir UI.
- **Status:** **Lulus**

---

#### `TC-NEG-08`: Penolakan Laporan Kerusakan ke-4 bagi Penyewa dengan 3 Laporan Terbuka (Kasus Dimas)
- **Referensi:** US-07, BR-11
- **Peran Penguji:** Penyewa (`dimas@griyakenanga.test`)
- **Pra-kondisi:** Dimas Pratama sudah memiliki 3 laporan kerusakan aktif/terbuka (status: `dilaporkan` atau `diproses`).
- **Langkah Pengujian:**
  1. Masuk sebagai `dimas@griyakenanga.test`.
  2. Buka menu **Lapor Kerusakan**, isi formulir laporan ke-4, lalu klik **Kirim Laporan**.
- **Data Uji:** Jumlah laporan terbuka saat ini: 3 laporan.
- **Hasil yang Diharapkan:** Sistem menolak pembuatan laporan baru sesuai aturan BR-11: *"Anda sudah memiliki 3 laporan kerusakan yang masih terbuka. Harap tunggu hingga laporan sebelumnya ditutup sebelum membuat laporan baru."*
- **Hasil Aktual:** Formulir memblokir pengiriman laporan ke-4 dan menampilkan pesan pembatasan kuota laporan terbuka.
- **Status:** **Lulus**

---

#### `TC-NEG-09`: Penolakan Pengerjaan Perbaikan Biaya Besar (> Rp1.000.000) Tanpa Persetujuan Pemilik
- **Referensi:** US-08, BR-12
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Laporan kerusakan dengan estimasi biaya Rp1.800.000 baru saja diajukan.
- **Langkah Pengujian:**
  1. Pengelola mencoba memotong alur dengan langsung mengubah status menjadi `selesai` tanpa melalui persetujuan pemilik.
- **Data Uji:** Estimasi biaya: Rp1.800.000, Status persetujuan pemilik: `null`/belum disetujui.
- **Hasil yang Diharapkan:** Sistem memblokir aksi Pengelola. Status wajib melalui `menunggu persetujuan` dan harus disetujui Pemilik sebelum dapat diselesaikan (BR-12).
- **Hasil Aktual:** Aksi ditolak oleh *state machine* status laporan kerusakan.
- **Status:** **Lulus**

---

### Bagian C: Uji Hak Akses & Keamanan (Role-Based Access Control / RBAC)

#### `TC-SEC-01`: Penyamaran NIK Penyewa bagi Pemilik (Masking NIK Data Privacy)
- **Referensi:** US-01, US-02, BR-10
- **Peran Penguji:** Pemilik (`ratna@griyakenanga.test`) vs Pengelola (`bayu@griyakenanga.test`)
- **Pra-kondisi:** Penyewa Dimas Pratama memiliki NIK `3404011508970001`.
- **Langkah Pengujian:**
  1. Masuk sebagai Pengelola `bayu@griyakenanga.test`. Buka halaman **Penyewa**, amati tampilan kolom NIK.
  2. Keluar, lalu masuk sebagai Pemilik `ratna@griyakenanga.test`. Buka halaman **Penyewa**, amati tampilan kolom NIK.
- **Data Uji:** NIK Asli: `3404011508970001`.
- **Hasil yang Diharapkan:** Pengelola melihat NIK lengkap 16 digit (`3404011508970001`) untuk kebutuhan verifikasi identitas resmi. Pemilik hanya melihat 4 angka terakhir yang tersamar: `************0001`.
- **Hasil Aktual:** NIK tersamar sempurna pada tampilan Pemilik dan terbuka penuh pada tampilan Pengelola.
- **Status:** **Lulus**

---

#### `TC-SEC-02`: Pembatasan Akses Halaman Laporan Keuangan bagi Pengelola dan Penyewa
- **Referensi:** US-10, BR-10
- **Peran Penguji:** Pengelola (`bayu@griyakenanga.test`) & Penyewa (`dimas@griyakenanga.test`)
- **Pra-kondisi:** Pengguna login sebagai Pengelola atau Penyewa.
- **Langkah Pengujian:**
  1. Periksa bilah navigasi utama (menu sidebar).
  2. Coba ketik URL langsung di bilah peramban: `http://localhost:5173/laporan`.
- **Data Uji:** Rute: `/laporan`.
- **Hasil yang Diharapkan:** Menu Laporan Keuangan tidak muncul di navigasi Pengelola dan Penyewa. Percobaan akses langsung melalui URL dihadang oleh *Route Guard* (dialihkan kembali ke Dashboard dengan peringatan hak akses).
- **Hasil Aktual:** Menu tersembunyi dan *route guard* berhasil membelokkan akses ilegal ke halaman utama.
- **Status:** **Lulus**

---

#### `TC-SEC-03`: Isolasi Data Antar-Penyewa (Data Multi-Tenant Isolation)
- **Referensi:** US-06, BR-10
- **Peran Penguji:** Penyewa (`dimas@griyakenanga.test` dan `hana@griyakenanga.test`)
- **Pra-kondisi:** Dimas menghuni kamar A-101, Hana menghuni kamar B-201.
- **Langkah Pengujian:**
  1. Masuk sebagai Dimas.
  2. Buka daftar kontrak, tagihan, dan laporan kerusakan.
  3. Periksa apakah terdapat data unit B-201 atau data tagihan milik Hana.
- **Data Uji:** User ID Dimas vs User ID Hana.
- **Hasil yang Diharapkan:** Dimas hanya dapat melihat kontrak miliknya (A-101), tagihan miliknya, dan laporan kerusakan miliknya. Data penyewa lain terisolasi total.
- **Hasil Aktual:** Data terisolasi sempurna pada level state dan UI; penyewa tidak dapat mengakses rekaman data penyewa lain.
- **Status:** **Lulus**

---

#### `TC-SEC-04`: Larangan Pemilik Menurunkan Peran Akunnya Sendiri & Pencatatan Audit Log
- **Referensi:** US-09, BR-09, BR-10
- **Peran Penguji:** Pemilik (`ratna@griyakenanga.test`)
- **Pra-kondisi:** Pemilik membuka tab manajemen peran akun di halaman Laporan.
- **Langkah Pengujian:**
  1. Cari akun Ratna Kusumawardani di tabel daftar akun.
  2. Coba ubah peran akun Ratna menjadi Pengelola atau Penyewa.
  3. Lakukan aksi operasional (misal: akhiri kontrak atau ubah harga unit) lalu periksa tab **Audit Log**.
- **Data Uji:** Akun: `ratna@griyakenanga.test`.
- **Hasil yang Diharapkan:** Sistem menonaktifkan pengubahan peran untuk akun Pemilik itu sendiri (mencegah *system lockout*). Seluruh perubahan data penting terekam di Audit Log tanpa menyimpan data pribadi sensitif (NIK/foto KTP).
- **Hasil Aktual:** Pilihan ubah peran untuk akun sendiri terkunci, dan catatan Audit Log bertambah secara konsisten dan *immutable*.
- **Status:** **Lulus**

---

## 4. Ringkasan Hasil Pengujian (Summary & Metrics)

| Metrik Pengujian | Target PRD | Hasil Aktual | Keterangan |
| :--- | :--- | :--- | :--- |
| **Total Test Cases** | Minimal 10 kasus | **23 kasus uji** | Melampaui target (230%) |
| **Kasus Uji Positif** | Ada | 10 kasus | 100% Lulus |
| **Kasus Uji Negatif** | Ada | 9 kasus | 100% Lulus |
| **Kasus Uji Hak Akses (RBAC)** | Ada | 4 kasus | 100% Lulus |
| **Cakupan Aturan Bisnis (BR)** | BR-01 s/d BR-12 | **100% (12 dari 12)** | Terverifikasi otomatis & manual |
| **Cakupan Cerita Pengguna (US)** | US-01 s/d US-10 | **100% (10 dari 10)** | Sesuai kriteria penerimaan |
| **Tingkat Kelulusan (Pass Rate)** | 100% | **100% (23/23 Lulus)** | Siap rilis produksi |

---

## 5. Kesimpulan & Rekomendasi Rilis

Seluruh 23 kasus uji (*test cases*) yang mencakup alur positif, skenario uji negatif, dan pembatasan hak akses berbasis peran telah dieksekusi dengan status **LULUS (Passed)**. Sistem telah terbukti andal dalam:
1. Mencegah pemesanan ganda (*overlap*) secara tegas (**BR-01, BR-04**).
2. Menegakkan tanggal mulai sewa selalu tanggal 1 awal bulan (**BR-02**).
3. Mengotomatisasi penomoran tagihan tanpa dobel dan menghitung denda keterlambatan dengan tepat (**BR-06, BR-07**).
4. Melindungi privasi penyewa lewat penyamaran NIK dan pengamanan hak akses data keuangan (**BR-10**).
5. Mengatur alur persetujuan perbaikan bernilai besar oleh pemilik (**BR-12**).

Aplikasi **Griya Kenanga Residence** dinyatakan **layak dan siap (Ready for Production)** untuk digunakan dalam kegiatan operasional kos dan studio sewa.
