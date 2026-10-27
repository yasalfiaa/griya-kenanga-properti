-- ====================================================================
-- 17: PERBAIKAN FN_GENERATE_MONTHLY_INVOICES (RETURN NEXT) (BR-06)
-- ====================================================================
-- Jalankan di SQL Editor Supabase (proyek zhkbjggeltzrosbrpyxn).
-- Aman diulang (idempoten).
--
-- Masalah yang diperbaiki:
--   fn_generate_monthly_invoices mendeklarasikan RETURNS TABLE (out_dibuat INTEGER, out_dilewati INTEGER)
--   namun tidak memanggil RETURN NEXT; di akhir body PL/pgSQL.
--   Akibatnya, PostgreSQL me-return himpunan kosong (0 baris / []) ke Supabase client,
--   sehingga pemanggil mengira fungsi gagal atau melempar pesan error
--   "Tagihan untuk periode ini sudah pernah dibuat" meskipun tagihan sebenarnya berhasil dibuat.
--
-- Solusi:
--   1) Inisialisasi out_dibuat := 0; out_dilewati := 0;
--   2) Tambahkan RETURN NEXT; sebelum END; agar selalu mengembalikan 1 baris hasil.
--   3) Berikan hak eksekusi kepada authenticated role.
-- ====================================================================

DROP FUNCTION IF EXISTS public.fn_generate_monthly_invoices(DATE);

CREATE OR REPLACE FUNCTION public.fn_generate_monthly_invoices(p_periode DATE)
RETURNS TABLE (out_dibuat INTEGER, out_dilewati INTEGER)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role TEXT;
    v_jatuh_tempo DATE;
    v_nomor TEXT;
    v_kontrak RECORD;
BEGIN
    -- Inisialisasi nilai kembalian
    out_dibuat := 0;
    out_dilewati := 0;

    -- 0) Peran: Pengelola atau Pemilik saja
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.';
    END IF;
    IF v_role NOT IN ('pengelola', 'pemilik') THEN
        RAISE EXCEPTION 'Hanya Pengelola atau Pemilik yang berhak membuat tagihan bulanan.';
    END IF;

    -- BR: periode tagihan selalu tanggal 1 di awal bulan
    IF EXTRACT(DAY FROM p_periode) <> 1 THEN
        RAISE EXCEPTION 'Periode tagihan harus selalu tanggal 1 di awal bulan.';
    END IF;

    -- Jatuh tempo selalu tanggal 10 (BR-06)
    v_jatuh_tempo := (DATE_TRUNC('month', p_periode) + INTERVAL '9 days')::DATE;

    -- 1) KUNCI semua kontrak aktif yang mencakup periode:
    --    ORDER BY id menjamin urutan lock konsisten -> tidak mungkin deadlock.
    FOR v_kontrak IN
        SELECT k.id, k.harga_sewa_bulanan, k.penyewa_id
        FROM public.kontrak k
        WHERE k.status = 'aktif'
          AND k.tanggal_mulai <= p_periode
          AND k.tanggal_selesai >= p_periode
        ORDER BY k.id
        FOR UPDATE
    LOOP
        -- 2) Cek ULANG setelah kunci didapat (baris bisa berubah saat menunggu)
        IF EXISTS (
            SELECT 1 FROM public.tagihan t
            WHERE t.kontrak_id = v_kontrak.id AND t.periode = p_periode
        ) THEN
            out_dilewati := out_dilewati + 1;
            CONTINUE;
        END IF;

        -- 3) Nomor thread-safe (BR-06) + harga sewa dikunci dari kontrak (BR-04)
        v_nomor := public.generate_nomor_urut('INV', TO_CHAR(p_periode, 'YYYYMM'));

        INSERT INTO public.tagihan
            (nomor, kontrak_id, periode, jatuh_tempo, nominal_sewa, denda, terbayar, status)
        VALUES
            (v_nomor, v_kontrak.id, p_periode, v_jatuh_tempo,
             v_kontrak.harga_sewa_bulanan, 0, 0, 'belum_bayar');

        out_dibuat := out_dibuat + 1;
    END LOOP;

    IF out_dibuat > 0 THEN
        INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
        VALUES (auth.uid(), v_role, 'buat:tagihan', 'tagihan', TO_CHAR(p_periode, 'YYYY-MM'),
                jsonb_build_object('dibuat', out_dibuat, 'lewati', out_dilewati));
    END IF;

    -- Selalu kembalikan baris hasil counter
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_generate_monthly_invoices(DATE) TO authenticated;
