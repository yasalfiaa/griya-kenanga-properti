-- ====================================================================
-- 08: ALUR KONTRAK TRANSAKSIONAL (BR-01 s/d BR-05)
-- ====================================================================
-- Jalankan di Supabase SQL Editor. Aman diulang (idempoten).
--
-- Isi:
--   1) Unit.status kini legal memuat 'dikontrak'
--   2) fn_create_contract   : kunci baris unit FOR UPDATE + nomor thread-safe
--   3) fn_activate_contract : kontrak aktif + unit 'dikontrak' + penyewa aktif
--   4) fn_terminate_contract: pemilik mengakhiri; unit kembali tersedia
--   5) Policy RLS tambahan untuk profiles (aktivasi penyewa oleh Pengelola)
--
-- Semua fungsi SECURITY DEFINER + validasi peran internal, sehingga
-- aturan bisnis tidak bisa dilewati dari klien.
-- ====================================================================

-- -------------------------------------------------------------------
-- 1. LEGALKAN STATUS 'DIKONTRAK' PADA TABEL UNIT
-- -------------------------------------------------------------------
ALTER TABLE public.unit DROP CONSTRAINT IF EXISTS unit_status_check;
ALTER TABLE public.unit
    ADD CONSTRAINT unit_status_check
    CHECK (status IN ('tersedia', 'dikontrak', 'perbaikan', 'nonaktif'));

-- -------------------------------------------------------------------
-- 2. FN_CREATE_CONTRACT — satu transaksi, kunci baris unit (BR-01/02/04)
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_create_contract(UUID, UUID, DATE, SMALLINT);
CREATE FUNCTION public.fn_create_contract(
    p_unit_id UUID,
    p_penyewa_id UUID,
    p_tanggal_mulai DATE,
    p_durasi_bulan SMALLINT
)
RETURNS TABLE (out_id UUID, out_nomor TEXT)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role TEXT;
    v_penyewa_role TEXT;
    v_unit RECORD;
    v_selesai DATE;
    v_nomor TEXT;
    v_id UUID;
BEGIN
    -- 0) Wajib terotentikasi dan berperan Pengelola
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.';
    END IF;
    IF v_role <> 'pengelola' THEN
        RAISE EXCEPTION 'Hanya Pengelola yang berhak membuat kontrak baru.';
    END IF;

    -- BR-02: tanggal mulai selalu tanggal 1
    IF EXTRACT(DAY FROM p_tanggal_mulai) <> 1 THEN
        RAISE EXCEPTION 'Tanggal mulai sewa harus selalu tanggal 1 di awal bulan (BR-02).';
    END IF;
    IF p_durasi_bulan NOT IN (1, 3, 6, 12) THEN
        RAISE EXCEPTION 'Durasi sewa hanya boleh 1, 3, 6, atau 12 bulan.';
    END IF;

    -- Penyewa target harus valid
    SELECT peran INTO v_penyewa_role FROM public.profiles WHERE id = p_penyewa_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Penyewa tidak ditemukan.';
    END IF;
    IF v_penyewa_role <> 'penyewa' THEN
        RAISE EXCEPTION 'Akun calon penyewa bukan berperan sebagai penyewa.';
    END IF;

    -- 1) KUNCI BARIS UNIT — mencegah dua proses mengontrakkan unit sama
    SELECT * INTO v_unit FROM public.unit WHERE id = p_unit_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unit tidak ditemukan.';
    END IF;
    IF v_unit.status <> 'tersedia' THEN
        RAISE EXCEPTION 'Unit berstatus "%". Hanya unit berstatus tersedia yang dapat dikontrakkan (BR-04).', v_unit.status;
    END IF;

    -- 2) Hitung tanggal selesai (hari terakhir bulan ke-n) & cek overlap (BR-01)
    v_selesai := CAST(p_tanggal_mulai + (p_durasi_bulan || ' months')::interval AS DATE) - 1;

    IF EXISTS (
        SELECT 1 FROM public.kontrak k
        WHERE k.unit_id = p_unit_id
          AND k.status IN ('draf', 'aktif')
          AND k.tanggal_mulai <= v_selesai
          AND k.tanggal_selesai >= p_tanggal_mulai
    ) THEN
        RAISE EXCEPTION 'Unit sudah memiliki kontrak draf/aktif pada periode % s/d % (BR-01).', p_tanggal_mulai, v_selesai;
    END IF;

    -- 3) Nomor urut thread-safe (BR-06) + harga sewa dikunci (BR-04)
    v_nomor := public.generate_nomor_urut('KTR', EXTRACT(YEAR FROM p_tanggal_mulai)::TEXT);

    -- 4) Simpan kontrak draf
    INSERT INTO public.kontrak
        (nomor, unit_id, penyewa_id, tanggal_mulai, durasi_bulan,
         tanggal_selesai, harga_sewa_bulanan, status, dibuat_oleh)
    VALUES
        (v_nomor, p_unit_id, p_penyewa_id, p_tanggal_mulai, p_durasi_bulan,
         v_selesai, v_unit.harga_sewa_bulanan, 'draf', auth.uid())
    RETURNING kontrak.id INTO v_id;

    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
    VALUES (auth.uid(), v_role, 'buat:kontrak', 'kontrak', v_id::TEXT,
            jsonb_build_object('nomor', v_nomor, 'status', 'draf'));

    RETURN QUERY SELECT v_id, v_nomor;
END;
$$;

-- -------------------------------------------------------------------
-- 3. FN_ACTIVATE_CONTRACT — aktivasi atomik kontrak + unit + penyewa
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_activate_contract(UUID);
CREATE FUNCTION public.fn_activate_contract(p_kontrak_id UUID)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role TEXT;
    v_k RECORD;
    v_verifikasi TEXT;
BEGIN
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.'; END IF;
    IF v_role <> 'pengelola' THEN RAISE EXCEPTION 'Hanya Pengelola yang berhak mengaktifkan kontrak.'; END IF;

    SELECT * INTO v_k FROM public.kontrak WHERE id = p_kontrak_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kontrak tidak ditemukan.'; END IF;
    IF v_k.status NOT IN ('draf') THEN
        RAISE EXCEPTION 'Kontrak berstatus "%", hanya kontrak draf yang bisa diaktifkan.', v_k.status;
    END IF;

    -- BR-03: identitas penyewa harus sudah diverifikasi
    SELECT status_verifikasi INTO v_verifikasi
    FROM public.identitas_penyewa WHERE penyewa_id = v_k.penyewa_id;
    IF NOT FOUND OR v_verifikasi <> 'terverifikasi' THEN
        RAISE EXCEPTION 'Kontrak draf hanya bisa diaktifkan bila identitas penyewa sudah diverifikasi.';
    END IF;

    -- Satu penyewa maksimal satu kontrak aktif
    IF EXISTS (
        SELECT 1 FROM public.kontrak
        WHERE penyewa_id = v_k.penyewa_id AND status = 'aktif' AND id <> p_kontrak_id
    ) THEN
        RAISE EXCEPTION 'Penyewa sudah memiliki kontrak aktif lain. Satu penyewa hanya boleh 1 kontrak aktif.';
    END IF;

    UPDATE public.kontrak SET status = 'aktif' WHERE id = p_kontrak_id;
    UPDATE public.unit SET status = 'dikontrak' WHERE id = v_k.unit_id;
    UPDATE public.profiles SET aktif = TRUE WHERE id = v_k.penyewa_id;

    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sebelum, sesudah)
    VALUES (auth.uid(), v_role, 'aktivasi:kontrak', 'kontrak', p_kontrak_id::TEXT,
            jsonb_build_object('status', 'draf'),
            jsonb_build_object('status', 'aktif', 'unit_status', 'dikontrak', 'penyewa_aktif', TRUE));
END;
$$;

-- -------------------------------------------------------------------
-- 4. FN_TERMINATE_CONTRACT — pengakhiran awal oleh Pemilik (BR-05)
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_terminate_contract(UUID, TEXT);
CREATE FUNCTION public.fn_terminate_contract(p_kontrak_id UUID, p_alasan TEXT)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role TEXT;
    v_k RECORD;
    v_akhir DATE;
BEGIN
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.'; END IF;
    IF v_role <> 'pemilik' THEN RAISE EXCEPTION 'Pengakhiran kontrak lebih awal hanya dapat dilakukan oleh Pemilik.'; END IF;

    IF p_alasan IS NULL OR btrim(p_alasan) = '' THEN
        RAISE EXCEPTION 'Alasan pengakhiran kontrak wajib diisi.';
    END IF;

    SELECT * INTO v_k FROM public.kontrak WHERE id = p_kontrak_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kontrak tidak ditemukan.'; END IF;
    IF v_k.status <> 'aktif' THEN
        RAISE EXCEPTION 'Hanya kontrak berstatus aktif yang dapat diakhiri lebih awal.';
    END IF;

    -- Efektif akhir bulan berjalan
    v_akhir := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::DATE;

    UPDATE public.kontrak
    SET status = 'diakhiri', alasan_berakhir = btrim(p_alasan),
        tanggal_berakhir_aktual = v_akhir
    WHERE id = p_kontrak_id;

    -- Unit kembali tersedia bila tidak ada kontrak aktif lain di unit itu
    IF NOT EXISTS (
        SELECT 1 FROM public.kontrak
        WHERE unit_id = v_k.unit_id AND status = 'aktif' AND id <> p_kontrak_id
    ) THEN
        UPDATE public.unit SET status = 'tersedia' WHERE id = v_k.unit_id AND status = 'dikontrak';
    END IF;

    -- Penyewa non-aktif bila tidak punya kontrak aktif lain
    IF NOT EXISTS (
        SELECT 1 FROM public.kontrak
        WHERE penyewa_id = v_k.penyewa_id AND status = 'aktif' AND id <> p_kontrak_id
    ) THEN
        UPDATE public.profiles SET aktif = FALSE WHERE id = v_k.penyewa_id;
    END IF;

    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sebelum, sesudah)
    VALUES (auth.uid(), v_role, 'akhiri:kontrak', 'kontrak', p_kontrak_id::TEXT,
            jsonb_build_object('status', 'aktif'),
            jsonb_build_object('status', 'diakhiri', 'alasan', btrim(p_alasan), 'efektif', v_akhir));
END;
$$;

-- -------------------------------------------------------------------
-- 5. RLS TAMBAHAN — Pengelola mengubah profil (aktif/non-aktif penyewa)
--    Policy yang sudah ada: kontrak FOR ALL (pengelola) ✔, unit UPDATE ✔
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Pengelola dapat mengelola profil penyewa" ON public.profiles;
CREATE POLICY "Pengelola dapat mengelola profil penyewa"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.get_auth_role() = 'pengelola');

-- -------------------------------------------------------------------
-- 6. VERIFIKASI (jalankan manual, opsional)
-- -------------------------------------------------------------------
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_name LIKE 'fn_%contract%';
-- SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
-- SELECT counstraint: SELECT conname FROM pg_constraint WHERE conrelid = 'public.unit'::regclass;
--   -> harus terlihat unit_status_check dengan bacakan: pg_get_constraintdef(oid)
