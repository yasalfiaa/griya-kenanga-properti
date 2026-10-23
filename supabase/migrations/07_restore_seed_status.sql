-- ====================================================================
-- 07: KEMBALIKAN STATUS VERIFIKASI DATA SEED (DUMMY)
-- ====================================================================
-- Sesuai dokumen Data_Contoh_Properti (seed di FULL_SETUP.sql):
--   * Semua penyewa seed  : 'terverifikasi' oleh Bayu Prasetyo,
--                           2026-07-20 11:00:00+07
--   * Fajar Nugroho       : 'belum'      (tanpa verifikasi)
--   * Gilang Mahendra     : 'ditolak'    oleh Bayu, 2026-10-02 10:00:00+07
--
-- Hanya baris data seed (email @griyakenanga.test) yang disentuh --
-- akun pengguna nyata yang Anda daftarkan sendiri tidak terpengaruh.
-- Jalankan di Supabase SQL Editor. Aman diulang (idempoten).
-- ====================================================================

-- 1) Semua penyewa seed kembali 'terverifikasi' (kecuali 2 pengecualian)
UPDATE public.identitas_penyewa ip
SET status_verifikasi = 'terverifikasi',
    diverifikasi_oleh = '04e98049-133d-5664-9e2c-579ddd2d1d01', -- Bayu Prasetyo (Pengelola)
    diverifikasi_pada = '2026-07-20 11:00:00+07',
    catatan_verifikasi = NULL
FROM public.profiles p
WHERE p.id = ip.penyewa_id
  AND p.peran = 'penyewa'
  AND p.email LIKE '%griyakenanga.test'
  AND p.email NOT IN ('fajar@griyakenanga.test', 'gilang@griyakenanga.test');

-- 2) Fajar Nugroho: BELUM (sesuai dokumen)
UPDATE public.identitas_penyewa ip
SET status_verifikasi = 'belum',
    diverifikasi_oleh = NULL,
    diverifikasi_pada = NULL,
    catatan_verifikasi = NULL
FROM public.profiles p
WHERE p.id = ip.penyewa_id
  AND p.email = 'fajar@griyakenanga.test';

-- 3) Gilang Mahendra: DITOLAK (sesuai dokumen)
--    Catatan WAJIB diisi: constraint identitas_penyewa_tolak_wajib_catatan
--    menuntut catatan non-kosong untuk status 'ditolak'.
UPDATE public.identitas_penyewa ip
SET status_verifikasi = 'ditolak',
    diverifikasi_oleh = '04e98049-133d-5664-9e2c-579ddd2d1d01',
    diverifikasi_pada = '2026-10-02 10:00:00+07',
    catatan_verifikasi = 'Ditolak sesuai Data_Contoh_Properti; minta penyewa unggah ulang foto KTP yang jelas.'
FROM public.profiles p
WHERE p.id = ip.penyewa_id
  AND p.email = 'gilang@griyakenanga.test';

-- 4) CEK HASIL (opsional): harus 20 'terverifikasi', 1 'belum', 1 'ditolak'
SELECT p.nama_lengkap, p.email, ip.status_verifikasi,
       ip.diverifikasi_pada, ip.foto_ktp_path
FROM public.identitas_penyewa ip
JOIN public.profiles p ON p.id = ip.penyewa_id
WHERE p.peran = 'penyewa'
  AND p.email LIKE '%griyakenanga.test'
ORDER BY ip.status_verifikasi, p.nama_lengkap;
