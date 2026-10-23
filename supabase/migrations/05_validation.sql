-- Migration 05: Validasi penolakan identitas penyewa wajib disertai alasan
-- Aturan: Jika status_verifikasi = 'ditolak', maka catatan_verifikasi harus diisi
-- (tidak boleh NULL atau hanya whitespace). Berlaku meskipun data ditulis
-- langsung ke tabel melalui API, bukan hanya melalui aplikasi.
--
-- CATATAN: Constraint dibuat dengan NOT VALID karena database yang sudah
-- berjalan bisa memiliki baris lama "ditolak" tanpa catatan. NOT VALID berarti:
--   - Constraint tetap DIENFORCE untuk semua INSERT/UPDATE selanjutnya,
--   - Baris lama yang melanggar tidak menyebabkan migration gagal.
-- Setelah baris lama diperbaiki (opsional, lihat blok komentar di bawah),
-- jalankan VALIDATE CONSTRAINT agar seluruh data lama juga diverifikasi.
-- Migration ini idempoten: aman dijalankan pada database yang sudah memiliki
-- constraint dari 01_schema.sql.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'identitas_penyewa_tolak_wajib_catatan'
          AND conrelid = 'public.identitas_penyewa'::regclass
    ) THEN
        ALTER TABLE public.identitas_penyewa
            ADD CONSTRAINT identitas_penyewa_tolak_wajib_catatan CHECK (
                status_verifikasi <> 'ditolak'
                OR (catatan_verifikasi IS NOT NULL AND btrim(catatan_verifikasi) <> '')
            ) NOT VALID;
    END IF;
END $$;

-- ============================================================================
-- OPSIONAL (jalankan setelah migration berhasil):
--
-- 1. Temukan baris lama yang melanggar aturan:
--
--    SELECT penyewa_id, status_verifikasi, catatan_verifikasi
--    FROM public.identitas_penyewa
--    WHERE status_verifikasi = 'ditolak'
--      AND (catatan_verifikasi IS NULL OR btrim(catatan_verifikasi) = '');
--
-- 2. Perbaiki baris tersebut dengan alasan yang sebenarnya (disarankan), atau
--    dengan placeholder jika alasannya benar-benar tidak ada:
--
--    UPDATE public.identitas_penyewa
--    SET catatan_verifikasi = 'Alasan penolakan tidak tercatat pada data lama'
--    WHERE status_verifikasi = 'ditolak'
--      AND (catatan_verifikasi IS NULL OR btrim(catatan_verifikasi) = '');
--
-- 3. Pastikan seluruh data lama juga patuh (full validation):
--
--    ALTER TABLE public.identitas_penyewa
--        VALIDATE CONSTRAINT identitas_penyewa_tolak_wajib_catatan;
-- ============================================================================
