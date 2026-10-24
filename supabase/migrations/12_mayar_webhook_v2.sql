-- ====================================================================
-- 12: MAYAR V2 — LOG WEBHOOK & PELUNASAN TERKENDALI (US-06)
-- ====================================================================
-- Jalankan di SQL Editor / `supabase db execute`.
-- Aman diulang (idempoten).
--
-- Isi:
--   1) Kolom tagihan baru  : mayar_jumlah, dibayar_online_at (+ index)
--   2) Tabel mayar_webhook_log
--      • RLS menyala; SELECT hanya untuk peran 'pemilik'
--      • Tulis diblokir untuk anon & authenticated (khusus service role
--        yang melewati RLS) — webhook Edge Function yang menulis
--   3) fn_simpan_link_mayar : untuk PENGGELOLA & PEMILIK (JWT) menyimpan
--      invoice id / link / jumlah Mayar ke tagihan
--   4) fn_tandai_lunas_mayar : HANYA service_role (secret key) —
--      kunci baris tagihan FOR UPDATE, mencatat pembayaran sebesar
--      mayar_jumlah bila belum lunas (idempoten), mengisi dibayar_online_at
-- ====================================================================

-- -------------------------------------------------------------------
-- 1. KOLOM BARU PADA TAGIHAN
-- -------------------------------------------------------------------
ALTER TABLE public.tagihan ADD COLUMN IF NOT EXISTS mayar_jumlah INTEGER
    CHECK (mayar_jumlah IS NULL OR mayar_jumlah >= 0);

ALTER TABLE public.tagihan ADD COLUMN IF NOT EXISTS dibayar_online_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tagihan_mayar_invoice_id
    ON public.tagihan (mayar_invoice_id);

-- -------------------------------------------------------------------
-- 2. TABEL MAYAR_WEBHOOK_LOG
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mayar_webhook_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event            TEXT,
    mayar_invoice_id TEXT,     -- invoice id hasil deteksi dari payload
    tagihan_id       UUID,     -- hasil translasi ke tagihan internal (bisa NULL
                               -- bila payload tidak memuat id yang dikenali)
    status_terjawab  TEXT,     -- 'dicatat' | 'duplikat' | 'sudah_lunas' | 'tidak_dikenali' | NULL
    payload          JSONB NOT NULL,
    catatan          TEXT,
    dibuat_pada      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mayar_webhook_log ENABLE ROW LEVEL SECURITY;

-- Hanya Pemilik yang boleh membaca log webhook
CREATE POLICY mayar_webhook_log_select_pemilik
    ON public.mayar_webhook_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND peran = 'pemilik'
        )
    );

-- Tanpa policy INSERT/UPDATE → anon & authenticated tidak bisa menulis.
-- service_role tetap menulis karena bypass RLS.
REVOKE ALL ON public.mayar_webhook_log FROM anon, authenticated;

-- -------------------------------------------------------------------
-- 3. FN_SIMPAN_LINK_MAYAR (Pengelola & Pemilik, via JWT)
-- -------------------------------------------------------------------
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
    v_role   TEXT;
    v_nomor  TEXT;
    v_status TEXT;
BEGIN
    -- Peran pemanggil lewat auth.uid() (JWT)
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.';
    END IF;
    IF v_role NOT IN ('pengelola', 'pemilik') THEN
        RAISE EXCEPTION 'Hanya Pengelola atau Pemilik yang boleh menyimpan link Mayar.';
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

    SELECT t.nomor, t.status INTO v_nomor, v_status
    FROM public.tagihan t WHERE t.id = p_tagihan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan.'; END IF;

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

-- -------------------------------------------------------------------
-- 4. FN_TANDAI_LUNAS_MAYAR (HANYA service_role / secret key)
--    Dipanggil mayar-webhook / simulator sandbox pada event
--    payment.received. Kunci baris FOR UPDATE → thread-safe.
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_tandai_lunas_mayar(TEXT, DATE);
CREATE FUNCTION public.fn_tandai_lunas_mayar(
    p_mayar_invoice_id TEXT,
    p_tanggal_bayar    DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    out_nomor    TEXT,          -- nomor tagihan internal
    out_jumlah   INTEGER,       -- jumlah yang dicatat/harus dicatat
    out_status   TEXT           -- 'dicatat' | 'duplikat' | 'sudah_lunas' | 'dibatalkan' | 'tidak_diketahui'
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
        out_status := 'tidak_diketahui';   -- payload tidak cocok dengan tagihan mana pun
        RETURN;
    END IF;

    -- 2) Sudah lunas / dibatalkan → tidak menambah pembayaran; catat waktu kalau belum
    IF v_status = 'dibatalkan' THEN
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'dibatalkan';       -- id dikenali, tetapi pembayaran ditolak
        RETURN;
    END IF;
    IF v_status = 'lunas' OR v_sisa <= 0 THEN
        UPDATE public.tagihan SET dibayar_online_at = now()
        WHERE public.tagihan.id = v_id AND dibayar_online_at IS NULL;
        out_nomor := v_nomor;
        out_jumlah := NULL;
        out_status := 'sudah_lunas';
        RETURN;
    END IF;

    -- 3) Jumlah = mayar_jumlah (fallback bila kolom lama masih kosong → pakai sisa saat ini);
    --    tidak pernah melebihi sisa.
    v_jumlah := COALESCE(v_jumlah, v_sisa);
    IF v_jumlah <= 0 THEN
        -- Kolom baru masih NULL & sisa 0 → sudah tertangani lewat cek di atas
        out_status := 'sudah_lunas';
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
END;
$$;

-- Hanya secret key (service_role) yang boleh menjalankan pelunasan
REVOKE EXECUTE ON FUNCTION public.fn_tandai_lunas_mayar(TEXT, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_tandai_lunas_mayar(TEXT, DATE) TO service_role;

-- -------------------------------------------------------------------
-- 5. SEGARKAN CACHE SKEMA POSTGREST
-- -------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- VERIFIKASI (opsional)
-- ====================================================================
-- SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%mayar%';
-- Uji simulator (SQL Editor berjalan sebagai postgres, sehingga di atas GRANT service_role):
--   SELECT fn_tandai_lunas_mayar('<mayar_invoice_id>', CURRENT_DATE);
--   → panggil pertama: ('<nomor>', <jumlah>, 'dicatat');
--     panggil ulang:   ('<nomor>', <jumlah>, 'duplikat').
-- RLS mayar_webhook_log: login Pemilik → SELECT terlihat; Pengelola/Penyewa → 0 baris.
-- ====================================================================
