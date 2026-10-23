-- ====================================================================
-- 06: STORAGE BUCKET + KEBIJAKAN RLS (VERSI SEDERHANA & TAHAN ERROR)
-- ====================================================================
-- Jalankan di Supabase SQL Editor. Aman diulang (idempoten).
-- TANPA dependensi fungsi custom (tidak lagi memakai get_auth_role).
--
-- Keputusan keamanan:
--   ktp               = PRIVAT (akses via signed URL, hanya authenticated)
--   bukti-bayar       = PUBLIK (URL permanen, anon boleh baca)
--   laporan_kerusakan = PUBLIK (URL permanen, anon boleh baca)
-- Semua bucket: maks 2MB, hanya image/jpeg, image/png, image/webp.
-- ====================================================================

-- -------------------------------------------------------------------
-- 1. PASTIKAN KONFIGURASI BUCKET
-- -------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ktp', 'ktp', false, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bukti-bayar', 'bukti-bayar', true, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('laporan_kerusakan', 'laporan_kerusakan', true, 2097152,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- -------------------------------------------------------------------
-- 2. BERSIHKAN SEMUA KEBIJAKAN LAMA (versi lama & misal sisa uji)
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "ktp_upload_pemilik_folder"      ON storage.objects;
DROP POLICY IF EXISTS "ktp_read_pemilik_dan_staf"     ON storage.objects;
DROP POLICY IF EXISTS "ktp_manage_pemilik_folder"     ON storage.objects;
DROP POLICY IF EXISTS "ktp_public_read"               ON storage.objects;
DROP POLICY IF EXISTS "ktp_insert_all"                ON storage.objects;
DROP POLICY IF EXISTS "ktp_select_all"                ON storage.objects;
DROP POLICY IF EXISTS "ktp_update_all"                ON storage.objects;
DROP POLICY IF EXISTS "ktp_delete_all"                ON storage.objects;

DROP POLICY IF EXISTS "bukti_bayar_upload_auth"       ON storage.objects;
DROP POLICY IF EXISTS "bukti_bayar_public_read"       ON storage.objects;
DROP POLICY IF EXISTS "bukti_bayar_manage_uploader"   ON storage.objects;
DROP POLICY IF EXISTS "bukti_insert_all"              ON storage.objects;
DROP POLICY IF EXISTS "bukti_select_public"           ON storage.objects;
DROP POLICY IF EXISTS "bukti_update_all"              ON storage.objects;
DROP POLICY IF EXISTS "bukti_delete_all"              ON storage.objects;

DROP POLICY IF EXISTS "laporan_upload_pemilik_folder" ON storage.objects;
DROP POLICY IF EXISTS "laporan_public_read"           ON storage.objects;
DROP POLICY IF EXISTS "laporan_manage_pemilik_folder" ON storage.objects;
DROP POLICY IF EXISTS "laporan_insert_all"            ON storage.objects;
DROP POLICY IF EXISTS "laporan_select_public"         ON storage.objects;
DROP POLICY IF EXISTS "laporan_update_all"            ON storage.objects;
DROP POLICY IF EXISTS "laporan_delete_all"            ON storage.objects;

-- -------------------------------------------------------------------
-- 3. BUCKET KTP (PRIVAT) — semua pengguna terotentikasi
-- -------------------------------------------------------------------
CREATE POLICY "ktp_insert_all"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ktp');

CREATE POLICY "ktp_select_all"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ktp');

CREATE POLICY "ktp_update_all"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'ktp')
    WITH CHECK (bucket_id = 'ktp');

CREATE POLICY "ktp_delete_all"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'ktp');

-- -------------------------------------------------------------------
-- 4. BUCKET BUKTI-BAYAR (PUBLIK)
-- -------------------------------------------------------------------
CREATE POLICY "bukti_insert_all"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'bukti-bayar');

-- Tanpa TO = berlaku untuk semua role (anon + authenticated)
CREATE POLICY "bukti_select_public"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'bukti-bayar');

CREATE POLICY "bukti_update_all"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'bukti-bayar')
    WITH CHECK (bucket_id = 'bukti-bayar');

CREATE POLICY "bukti_delete_all"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'bukti-bayar');

-- -------------------------------------------------------------------
-- 5. BUCKET LAPORAN_KERUSAKAN (PUBLIK)
-- -------------------------------------------------------------------
CREATE POLICY "laporan_insert_all"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'laporan_kerusakan');

CREATE POLICY "laporan_select_public"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'laporan_kerusakan');

CREATE POLICY "laporan_update_all"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'laporan_kerusakan')
    WITH CHECK (bucket_id = 'laporan_kerusakan');

CREATE POLICY "laporan_delete_all"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'laporan_kerusakan');

-- -------------------------------------------------------------------
-- 6. VERIFIKASI (jalankan manual, opsional)
-- -------------------------------------------------------------------
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND (policyname LIKE 'ktp%' OR policyname LIKE 'bukti%' OR policyname LIKE 'laporan%')
ORDER BY policyname;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('ktp', 'bukti-bayar', 'laporan_kerusakan');
