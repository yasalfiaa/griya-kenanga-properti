-- ====================================================================
-- 09: GENERATE TAGIHAN BULANAN — AMAN RACE CONDITION (BR-06)
-- ====================================================================
-- Jalankan di Supabase SQL Editor. Aman diulang (idempoten).
--
-- Masalah yang ditutup:
--   Dua pengguna menyimpan tagihan periode yang sama bersamaan →
--   fungsi lama (generate_monthly_invoices) tidak mengunci baris sehingga
--   dua sesi bisa sama-sama lolos cek NOT EXISTS → tagihan dobel.
--
-- Solusi:
--   1) Kunci semua kontrak aktif dengan FOR UPDATE (urutan ORDER BY id
--      konsisten → tidak mungkin deadlock antar dua sesi).
--   2) Cek dobel diulang SETELAH kunci didapat (bisa ada tagihan baru
--      yang dibuat sesi lain saat sesi ini menunggu kunci).
--   3) Validasi peran (Pengelola/Pemilik) + BR periode tanggal 1 di server.
--   4) Nomor INV tetap thread-safe lewat generate_nomor_urut (BR-06).
--   5) Audit log tiap pembuatan.
--
-- Sesi kedua tidak gagal/menghasilkan dobel — hanya "menunggu" lalu
-- melaporkan tagihan yang dilewati (out_dilewati).
-- ====================================================================

-- Fungsi lama tidak aman & tidak dipakai UI — dihapus agar tidak tertukar
DROP FUNCTION IF EXISTS public.generate_monthly_invoices(DATE, UUID);

DROP FUNCTION IF EXISTS public.fn_generate_monthly_invoices(DATE);
CREATE FUNCTION public.fn_generate_monthly_invoices(p_periode DATE)
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
    --    ORDER BY id menjamin urutan lock konsisten → tidak mungkin deadlock.
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
            out_dilewati := COALESCE(out_dilewati, 0) + 1;
            CONTINUE;
        END IF;

        -- 3) Nomor thread-safe (BR-06) + harga sewa dikunci dari kontrak (BR-04)
        v_nomor := public.generate_nomor_urut('INV', TO_CHAR(p_periode, 'YYYYMM'));

        INSERT INTO public.tagihan
            (nomor, kontrak_id, periode, jatuh_tempo, nominal_sewa, denda, terbayar, status)
        VALUES
            (v_nomor, v_kontrak.id, p_periode, v_jatuh_tempo,
             v_kontrak.harga_sewa_bulanan, 0, 0, 'belum_bayar');

        out_dibuat := COALESCE(out_dibuat, 0) + 1;
    END LOOP;

    out_dibuat := COALESCE(out_dibuat, 0);
    out_dilewati := COALESCE(out_dilewati, 0);

    IF out_dibuat > 0 THEN
        INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
        VALUES (auth.uid(), v_role, 'buat:tagihan', 'tagihan', TO_CHAR(p_periode, 'YYYY-MM'),
                jsonb_build_object('dibuat', out_dibuat, 'lewati', out_dilewati));
    END IF;

    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_generate_monthly_invoices(DATE) TO authenticated;

-- ====================================================================
-- VERIFIKASI (jalankan manual, opsional)
-- ====================================================================
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_name = 'fn_generate_monthly_invoices';
-- SELECT * FROM fn_generate_monthly_invoices('2026-11-01');
-- SELECT kontrak_id, periode, COUNT(*) FROM tagihan
--  WHERE periode = '2026-12-01' GROUP BY 1, 2 HAVING COUNT(*) > 1;  -- harus 0 baris
