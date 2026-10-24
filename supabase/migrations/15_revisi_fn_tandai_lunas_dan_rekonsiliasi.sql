-- ============================================================
-- 15. REVISI FN_TANDAI_LUNAS_MAYAR + KONSISTENSI DENDA + REKONSILIASI
-- ============================================================
-- Tujuan: invariants "status tagihan = lunas ⟺ total sisa tagihan = 0"
--         berlaku konsisten untuk SEMUA tagihan (lama & baru).
-- Gejala yang diperbaiki:
--   A) fn_tandai_lunas_mayar hanya me-return himpunan kosong (bug RETURNS
--      TABLE tanpa RETURN NEXT) → pemanggil mengira pelunasan gagal.
--   B) Jumlah pembayaran mayar di-cap ke v_sisa yang denda-nya dihitung
--      beda basis → pembayaran "penuh" selalu tercatat kurang (kasus
--      INV-202610-0017: Mayar dibayar 850.000, tercatat 750.000).
--   C) Trigger status memakai denda berbasis TANGGAL BAYAR nyata, sedangkan
--      tautan Mayar memakai denda berbasis TANGGAL ACUAN aplikasi
--      (15 Okt 2026) → total due terus berubah, sisa tak pernah 0.
--   D) Rekonsiliasi data: tagihan INV-202610-0017 dari bukti Mayar
--      (58b0466e… dibayar 850.000) dan status semua tagihan diperbarui
--      mengikuti invarian.
-- Jalankan di SQL Editor (proyek zhkbjggeltzrosbrpyxn). Idempotent —
-- aman dijalankan ulang; menggantikan/melengkapi migration 14.
-- ============================================================

-- -------------------------------------------------------------------
-- 1) FN_TANDAI_LUNAS_MAYAR: hasil dikirim (RETURN NEXT); jumlah dicatat
--    SESUAI yang ditagih Mayar (mayar_jumlah), tidak di-cap ulang.
-- -------------------------------------------------------------------
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

    -- 1) Kunci baris tagihan (FOR UPDATE) → aman terhadap webhook/cek paralel
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

    -- 2) Dibatalkan ditolak; sudah lunas/sisa 0 → cukup catat waktu
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

    -- 3) Kunci perbandingan dilakukan di ROUTE (status paid + jumlah cocok);
    --    di sini catat SESUAI yang ditagih Mayar. Fallback mayar_jumlah
    --    kosong → pakai sisa saat ini (alur dev lama).
    v_jumlah := COALESCE(v_jumlah, v_sisa);
    IF v_jumlah <= 0 THEN
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'sudah_lunas';
        RETURN NEXT;
        RETURN;
    END IF;

    -- 4) Idempoten: referensi_mayar = mayar_invoice_id (UNIQUE)
    INSERT INTO public.pembayaran
        (tagihan_id, jumlah, metode, tanggal_bayar, referensi_mayar, status, dicatat_oleh)
    VALUES
        (v_id, v_jumlah, 'mayar', p_tanggal_bayar,
         btrim(p_mayar_invoice_id), 'sah', NULL)
    ON CONFLICT (referensi_mayar) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NULL THEN
        UPDATE public.tagihan SET dibayar_online_at = now()
        WHERE public.tagihan.id = v_id AND dibayar_online_at IS NULL;
        out_nomor  := v_nomor;
        out_jumlah := v_jumlah;
        out_status := 'duplikat';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Status tagihan & terbayar dimutakhirkan oleh trigger
    -- fn_trg_update_tagihan_on_pembayaran (lihat bagian 2 di atas file ini).
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

-- -------------------------------------------------------------------
-- 2) TRIGGER STATUS: denda konsisten memakai tanggal acuan aplikasi.
--    Billing Mayar memakai denda berbasis TANGGAL ACUAN (15 Okt 2026 —
--    "Tanggal Acuan Data" yang tampil di aplikasi), maka mutakhirkan
--    status dari tanggal_bayar yang LEWAT acuan tidak boleh menaikkan
--    denda di atas kutipan Mayar (penyebab sisa tak pernah 0).
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trg_update_tagihan_on_pembayaran()
RETURNS TRIGGER AS $$
DECLARE
    v_total_bayar INTEGER;
    v_tagihan RECORD;
    v_denda INTEGER;
    v_total_harus_bayar INTEGER;
    v_tanggal_acuan CONSTANT DATE := DATE '2026-10-15';
BEGIN
    SELECT * INTO v_tagihan FROM public.tagihan WHERE id = COALESCE(NEW.tagihan_id, OLD.tagihan_id);

    -- Total pembayaran sah
    SELECT COALESCE(SUM(jumlah), 0) INTO v_total_bayar
    FROM public.pembayaran
    WHERE tagihan_id = v_tagihan.id AND status = 'sah';

    -- Denda berbasis tanggal acuan = tanggal pembayaran, DIBATASI acuan data.
    -- (Semua pembayaran acuan 15 Okt 2026; pembayaran setelahnya tidak
    --  menaikkan denda di atas kutipan yang diberikan ke penyewa.)
    v_denda := v_tagihan.denda;
    IF TG_OP = 'INSERT' AND NEW.status = 'sah' THEN
        v_denda := public.calculate_denda(
            v_tagihan.jatuh_tempo,
            LEAST(NEW.tanggal_bayar, v_tanggal_acuan)
        );
    END IF;

    v_total_harus_bayar := v_tagihan.nominal_sewa + v_denda;

    UPDATE public.tagihan
    SET terbayar = v_total_bayar,
        denda = v_denda,
        status = CASE
            WHEN v_total_bayar = 0 THEN 'belum_bayar'
            WHEN v_total_bayar >= v_total_harus_bayar THEN 'lunas'
            ELSE 'sebagian'
        END
    WHERE id = v_tagihan.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------
-- 3) PERBAIKAN DATA 0017 — bukti Mayar: invoice 58b0466e… dibayar 850.000,
--    tercatat salah 750.000. Koreksi → trigger otomatis menata ulang
--    terbayar (jumlah semua pembayaran sah) dan status mengikuti invarian.
-- -------------------------------------------------------------------
UPDATE public.pembayaran
SET jumlah = 850000
WHERE referensi_mayar = '58b0466e-0ee0-4560-a0fd-133a323dc86c'
  AND status = 'sah'
  AND jumlah <> 850000;

-- -------------------------------------------------------------------
-- 4) REKONSILIASI SEMUA TAGIHAN (aman diulang):
--     terbayar = jumlah seluruh pembayaran sah; status = lunas ⟺ sisa 0
--     (terbayar >= nominal_sewa + denda); tagihan dibatalkan tidak disentuh.
-- -------------------------------------------------------------------
UPDATE public.tagihan t
SET terbayar   = s.jumlah_sah,
    status     = CASE
                   WHEN s.jumlah_sah = 0 THEN 'belum_bayar'
                   WHEN s.jumlah_sah >= t.nominal_sewa + t.denda THEN 'lunas'
                   ELSE 'sebagian'
                 END
FROM (
    SELECT pb.tagihan_id, COALESCE(SUM(pb.jumlah), 0) AS jumlah_sah
    FROM public.pembayaran pb
    WHERE pb.status = 'sah'
    GROUP BY pb.tagihan_id
) AS s
WHERE s.tagihan_id = t.id
  AND t.status <> 'dibatalkan'
  AND (t.terbayar <> s.jumlah_sah
       OR t.status <> (CASE
             WHEN s.jumlah_sah = 0 THEN 'belum_bayar'
             WHEN s.jumlah_sah >= t.nominal_sewa + t.denda THEN 'lunas'
             ELSE 'sebagian'
           END));
