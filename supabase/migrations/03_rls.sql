-- ====================================================================
-- MIGRASI 03: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL (BR-10)
-- Menjamin Hak Akses Terisolasi di Level Basis Data
-- ====================================================================

-- 1. FUNGSI PEMBANTU GET USER ROLE
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
    SELECT peran FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- AKTIFKAN RLS PADA SEMUA TABEL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identitas_penyewa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kontrak ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laporan_kerusakan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- POLICIES: PROFILES
-- --------------------------------------------------------------------
CREATE POLICY "Semua pengguna terotentikasi dapat melihat profil"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Pengguna dapat mengubah profil sendiri"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Pemilik dapat mengubah peran pengguna lain"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pemilik' AND id <> auth.uid());

-- --------------------------------------------------------------------
-- POLICIES: IDENTITAS_PENYEWA (BR-10)
-- --------------------------------------------------------------------
-- Penyewa membaca & mengedit identitas miliknya
CREATE POLICY "Penyewa membaca identitas miliknya"
    ON public.identitas_penyewa FOR SELECT
    TO authenticated
    USING (penyewa_id = auth.uid());

CREATE POLICY "Penyewa memperbarui identitas miliknya"
    ON public.identitas_penyewa FOR UPDATE
    TO authenticated
    USING (penyewa_id = auth.uid());

CREATE POLICY "Penyewa membuat identitas miliknya"
    ON public.identitas_penyewa FOR INSERT
    TO authenticated
    WITH CHECK (penyewa_id = auth.uid());

-- Pengelola membaca dan memverifikasi identitas penyewa
CREATE POLICY "Pengelola membaca semua identitas"
    ON public.identitas_penyewa FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

CREATE POLICY "Pengelola memverifikasi identitas penyewa"
    ON public.identitas_penyewa FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

-- VIEW UNTUK PEMILIK: NIK tersamar 4 digit terakhir, tanpa foto KTP asli (BR-10)
CREATE OR REPLACE VIEW public.identitas_penyewa_pemilik AS
SELECT
    ip.penyewa_id,
    '************' || RIGHT(ip.nik, 4) AS nik_masked,
    ip.alamat_asal,
    ip.kontak_darurat_nama,
    ip.kontak_darurat_hp,
    ip.status_verifikasi,
    ip.diverifikasi_oleh,
    ip.diverifikasi_pada,
    ip.catatan_verifikasi
FROM public.identitas_penyewa ip;

-- --------------------------------------------------------------------
-- POLICIES: UNIT
-- --------------------------------------------------------------------
CREATE POLICY "Semua pengguna dapat melihat unit"
    ON public.unit FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Pengelola dapat mengubah status unit"
    ON public.unit FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

CREATE POLICY "Pemilik dapat mengubah harga sewa unit"
    ON public.unit FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pemilik');

-- --------------------------------------------------------------------
-- POLICIES: KONTRAK
-- --------------------------------------------------------------------
CREATE POLICY "Staf dapat melihat semua kontrak"
    ON public.kontrak FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('pengelola', 'pemilik'));

CREATE POLICY "Penyewa hanya melihat kontrak miliknya"
    ON public.kontrak FOR SELECT
    TO authenticated
    USING (penyewa_id = auth.uid());

CREATE POLICY "Pengelola dapat membuat dan mengupdate kontrak"
    ON public.kontrak FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

CREATE POLICY "Pemilik dapat mengakhiri kontrak lebih awal"
    ON public.kontrak FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pemilik');

-- --------------------------------------------------------------------
-- POLICIES: TAGIHAN
-- --------------------------------------------------------------------
CREATE POLICY "Staf dapat melihat semua tagihan"
    ON public.tagihan FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('pengelola', 'pemilik'));

CREATE POLICY "Penyewa hanya melihat tagihan kontrak miliknya"
    ON public.tagihan FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.kontrak k
        WHERE k.id = public.tagihan.kontrak_id AND k.penyewa_id = auth.uid()
    ));

CREATE POLICY "Pengelola dapat membuat dan mengelola tagihan"
    ON public.tagihan FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

CREATE POLICY "Pemilik dapat membatalkan tagihan belum bayar"
    ON public.tagihan FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pemilik');

-- --------------------------------------------------------------------
-- POLICIES: PEMBAYARAN
-- --------------------------------------------------------------------
CREATE POLICY "Staf dapat melihat semua pembayaran"
    ON public.pembayaran FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('pengelola', 'pemilik'));

CREATE POLICY "Penyewa melihat pembayaran tagihannya"
    ON public.pembayaran FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.tagihan t
        JOIN public.kontrak k ON k.id = t.kontrak_id
        WHERE t.id = public.pembayaran.tagihan_id AND k.penyewa_id = auth.uid()
    ));

CREATE POLICY "Pengelola dapat mencatat pembayaran"
    ON public.pembayaran FOR INSERT
    TO authenticated
    WITH CHECK (public.get_auth_role() = 'pengelola');

CREATE POLICY "Pemilik dapat membatalkan pembayaran"
    ON public.pembayaran FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pemilik');

-- --------------------------------------------------------------------
-- POLICIES: LAPORAN KERUSAKAN
-- --------------------------------------------------------------------
CREATE POLICY "Staf dapat melihat semua laporan kerusakan"
    ON public.laporan_kerusakan FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('pengelola', 'pemilik'));

CREATE POLICY "Penyewa melihat laporan miliknya"
    ON public.laporan_kerusakan FOR SELECT
    TO authenticated
    USING (pelapor_id = auth.uid());

CREATE POLICY "Penyewa membuat laporan kerusakan"
    ON public.laporan_kerusakan FOR INSERT
    TO authenticated
    WITH CHECK (pelapor_id = auth.uid());

CREATE POLICY "Penyewa dan Pengelola menutup laporan"
    ON public.laporan_kerusakan FOR UPDATE
    TO authenticated
    USING (pelapor_id = auth.uid() OR public.get_auth_role() IN ('pengelola', 'pemilik'));

-- --------------------------------------------------------------------
-- POLICIES: AUDIT_LOG (BR-10: Hanya Pemilik yang Boleh Akses)
-- --------------------------------------------------------------------
CREATE POLICY "Hanya Pemilik yang dapat melihat audit log"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (public.get_auth_role() = 'pemilik');

CREATE POLICY "Sistem/Pengguna terotentikasi dapat menambah audit log"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);
