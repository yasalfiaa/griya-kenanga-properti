-- ============================================================
-- 14. PERBAIKAN FN_TANDAI_LUNAS_MAYAR — hasil fungsi tidak pernah keluar
-- ============================================================
-- Gejala: pembayaran MAYAR tercatat (baris pembayaran + dibayar_online_at
-- benar), tetapi pemanggil (route cek/webhook) selalu melihat hasil KOSONG
-- ([]) sehingga mengira pelunasan gagal (HTTP 400) dan UI tidak diperbarui.
-- Penyebab: fungsi RETURNS TABLE (implisit SETOF) hanya mengisi variabel
-- out_* lalu `RETURN;` → plpgsql mengembalikan HIMPANAN KOSONG, bukan baris.
-- Perbaikan: setelah mengisi out_*, kirim barisnya dengan `RETURN NEXT;`.
-- Jalankan di SQL Editor (proyek zhkbjggeltzrosbrpyxn).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_tandai_lunas_mayar(
    p_mayar_invoice_id TEXT,
    p_tanggal_bayar    DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    out_nomor    TEXT,
    out_jumlah   INTEGER,
    out_status   TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_id       UUID;
    v_nomor    TEXT;
    v_status   TEXT;
    v_sisa     INTEGER;
    v_jumlah   INTEGER;
    v_inserted UUID;
BEGIN
    IF p_mayar_invoice_id IS NULL OR btrim(p_mayar_invoice_id) = '' THEN
        RAISE EXCEPTION 'mayar_invoice_id wajib diisi.';
    END IF;

    -- 1) Kunci baris tagihan (FOR UPDATE) → aman terhadap webhook dobel paralel
    SELECT t.id, t.nomor, t.status,
           GREATEST(t.nominal_sewa + t.denda - t.terbayar, 0),
           t.mayar_jumlah
    INTO v_id, v_nomor, v_status, v_sisa, v_jumlah
    FROM public.tagihan t
    WHERE t.mayar_invoice_id = btrim(p_mayar_invoice_id)
    FOR UPDATE OF t;
    IF NOT FOUND THEN
        out_nomor := NULL;
        out_jumlah := NULL;
        out_status := 'tidak_diketahui';
        RETURN NEXT;
        RETURN;
    END IF;

    -- 2) Sudah lunas / dibatalkan → tidak menambah pembayaran; catat waktu bila belum
    IF v_status = 'dibatalkan' THEN
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'dibatalkan';
        RETURN NEXT;
        RETURN;
    END IF;
    IF v_status = 'lunas' OR v_sisa <= 0 THEN
        UPDATE public.tagihan SET dibayar_online_at = now()
        WHERE public.tagihan.id = v_id AND dibayar_online_at IS NULL;
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'sudah_lunas';
        RETURN NEXT;
        RETURN;
    END IF;

    -- 3) Jumlah = mayar_jumlah (fallback bila kolom lama masih kosong → pakai sisa saat ini);
    --    tidak pernah melebihi sisa.
    v_jumlah := COALESCE(v_jumlah, v_sisa);
    IF v_jumlah <= 0 THEN
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'sudah_lunas';
        RETURN NEXT;
        RETURN;
    END IF;
    v_jumlah := LEAST(v_jumlah, v_sisa);

    -- 4) Idempoten: referensi_mayar = mayar_invoice_id (UNIQUE) → webhook ulang tak mencatat dobel
    INSERT INTO public.pembayaran
        (tagihan_id, jumlah, metode, tanggal_bayar, referensi_mayar, status, dicatat_oleh)
    VALUES
        (v_id, v_jumlah, 'mayar', p_tanggal_bayar,
         btrim(p_mayar_invoice_id), 'sah', NULL)
    ON CONFLICT (referensi_mayar) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NULL THEN
        -- Tagihan sudah pernah dikonfirmasi dari payload sama (webhook ulang)
        UPDATE public.tagihan SET dibayar_online_at = now()
        WHERE public.tagihan.id = v_id AND dibayar_online_at IS NULL;
        out_nomor  := v_nomor;
        out_jumlah := v_jumlah;
        out_status := 'duplikat';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Status tagihan & terbayar dimutakhirkan oleh trigger fn_trg_update_tagihan_on_pembayaran
    UPDATE public.tagihan SET dibayar_online_at = now()
    WHERE public.tagihan.id = v_id AND dibayar_online_at IS NULL;

    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
    VALUES (auth.uid(), 'mayar', 'bayar:mayar', 'pembayaran', v_inserted::TEXT,
            jsonb_build_object('mayar_invoice_id', btrim(p_mayar_invoice_id),
                               'referensi', btrim(p_mayar_invoice_id),
                               'jumlah', v_jumlah));

    out_nomor  := v_nomor;
    out_jumlah := v_jumlah;
    out_status := 'dicatat';
    RETURN NEXT;
    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_tandai_lunas_mayar(TEXT, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tandai_lunas_mayar(TEXT, DATE) TO service_role;
