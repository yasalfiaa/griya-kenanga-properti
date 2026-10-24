-- ============================================================
-- 13. PENYEWA BAYAR ONLINE (Mayar V2) — perluasan fn_simpan_link_mayar
-- ============================================================
-- Latar: Route /api/pembayaran/buat sekarang menerima PENYEWA untuk
--        membayar TAGIHAN MILIKNYA SENDIRI (tombol Bayar Online di /tagihan).
-- Perubahan: fn_simpan_link_mayar (SECURITY DEFINER) sebelumnya hanya
--        mengizinkan pengelola/pemilik. Sekarang:
--          • pengelola/pemilik      → semua tagihan (perilaku lama)
--          • penyewa                → HANYA tagihan dari kontrak miliknya
--                                     (cek ganda di server, bukan hanya RLS)
--        Pengaman tetap: status tagihan tidak boleh lunas/dibatalkan,
--        jumlah > 0, dan tulis audit_log sebagai pelaku.
-- Jalankan di SQL Editor (proyek zhkbjggeltzrosbrpyxn).
-- ============================================================

DROP FUNCTION IF EXISTS public.fn_simpan_link_mayar(UUID, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.fn_simpan_link_mayar(
    p_tagihan_id       UUID,
    p_mayar_invoice_id TEXT,
    p_link             TEXT,
    p_mayar_jumlah     INTEGER
)
RETURNS TEXT                                  -- nomor tagihan
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role      TEXT;
    v_nomor     TEXT;
    v_status    TEXT;
    v_penyewa_id UUID;
BEGIN
    -- Peran pemanggil lewat auth.uid() (JWT)
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.';
    END IF;

    IF p_mayar_invoice_id IS NULL OR btrim(p_mayar_invoice_id) = '' THEN
        RAISE EXCEPTION 'mayar_invoice_id wajib diisi.';
    END IF;
    IF p_link IS NULL OR btrim(p_link) = '' THEN
        RAISE EXCEPTION 'Link Mayar wajib diisi.';
    END IF;
    IF p_mayar_jumlah IS NULL OR p_mayar_jumlah <= 0 THEN
        RAISE EXCEPTION 'Jumlah tagihan Mayar harus lebih besar dari nol.';
    END IF;

    SELECT t.nomor, t.status, k.penyewa_id INTO v_nomor, v_status, v_penyewa_id
    FROM public.tagihan t
    JOIN public.kontrak k ON k.id = t.kontrak_id
    WHERE t.id = p_tagihan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tagihan tidak ditemukan.';
    END IF;

    -- PENYEWA HANYA untuk tagihan miliknya sendiri (bunuh-dua: server memeriksa
    -- ulang di luar RLS karena fungsi ini SECURITY DEFINER).
    IF v_role = 'penyewa' AND v_penyewa_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Penyewa hanya dapat memproses pembayaran tagihan miliknya sendiri.';
    END IF;
    IF v_role NOT IN ('pengelola', 'pemilik', 'penyewa') THEN
        RAISE EXCEPTION 'Peran "%" tidak berhak menyimpan link Mayar.', v_role;
    END IF;

    IF v_status IN ('lunas', 'dibatalkan') THEN
        RAISE EXCEPTION 'Tagihan berstatus "%" tidak dapat di-set link pembayaran.', v_status;
    END IF;

    UPDATE public.tagihan
    SET mayar_invoice_id = btrim(p_mayar_invoice_id),
        mayar_link       = btrim(p_link),
        mayar_jumlah     = p_mayar_jumlah
    WHERE public.tagihan.id = p_tagihan_id;

    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
    VALUES (auth.uid(), v_role, 'set_link_mayar', 'tagihan', p_tagihan_id::TEXT,
            jsonb_build_object(
                'mayar_invoice_id', btrim(p_mayar_invoice_id),
                'mayar_jumlah', p_mayar_jumlah,
                'mayar_link', btrim(p_link)));

    RETURN v_nomor;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_simpan_link_mayar(UUID, TEXT, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_simpan_link_mayar(UUID, TEXT, TEXT, INTEGER) TO authenticated;
