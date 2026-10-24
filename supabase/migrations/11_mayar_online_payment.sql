-- ====================================================================
-- 11: PEMBAYARAN ONLINE MAYAR (US-06) — sesi bayar + rekonsiliasi webhook
-- ====================================================================
-- Jalankan di SQL Editor. Idempoten.
--
-- fn_create_mayar_payment_session : oleh PENYEWA pemilik tagihan (atau
--     Pengelola/Pemilik) untuk menyiapkan sesi bayar online. Kunci baris
--     tagihan FOR UPDATE, cek status/sisa, resuse link Mayar yang sudah ada
--     (tidak menumpuk invoice), kembali slot mayar_invoice_id untuk diisi
--     Edge Function.
--
-- fn_reconcile_mayar_payment : dipanggil WEBHOOK Mayar / simulator sandbox
--     (service role). Idempoten via pembayaran.referensi_mayar UNIQUE
--     (ON CONFLICT DO NOTHING) → webhook dobel tidak menciptakan pembayaran
--     dobel. Metode 'mayar', dicatat_oleh NULL (pembayaran otomatis) →
--     trigger fn_trg_update_tagihan_on_pembayaran memutakhirkan status
--     tagihan (BR-08/09) tanpa perubahan fungsi lama.
-- ====================================================================

-- -------------------------------------------------------------------
-- 1. FN_CREATE_MAYAR_PAYMENT_SESSION
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_create_mayar_payment_session(UUID);
CREATE FUNCTION public.fn_create_mayar_payment_session(p_tagihan_id UUID)
RETURNS TABLE (
    out_nomor TEXT,
    out_sisa INTEGER,
    out_link TEXT,
    out_mode TEXT,           -- 'existing' | 'new'
    out_mayar_invoice_id TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_role TEXT;
    v_penyewa_id UUID;
    v_status TEXT;
    v_sisa INTEGER;
    v_link TEXT;
    v_mayar_id TEXT;
BEGIN
    -- 0) Peran pemanggil
    SELECT peran INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthenticated: sesi login tidak ditemukan.'; END IF;

    -- 1) Kunci tagihan (race-safe) + validasi status
    SELECT t.status, t.mayar_link, t.mayar_invoice_id,
           k.penyewa_id AS v_penyewa
    INTO v_status, v_link, v_mayar_id, v_penyewa_id
    FROM public.tagihan t
    JOIN public.kontrak k ON k.id = t.kontrak_id
    WHERE t.id = p_tagihan_id
    FOR UPDATE OF t;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan.'; END IF;

    -- 2) Kepemilikan: penyewa wajib pemilik tagihan; Pengelola/Pemilik bebas (US-06)
    IF v_role = 'penyewa' AND v_penyewa_id <> auth.uid() THEN
        RAISE EXCEPTION 'Tagihan ini bukan milik akun Anda.';
    END IF;
    IF v_role NOT IN ('penyewa', 'pengelola', 'pemilik') THEN
        RAISE EXCEPTION 'Peran akun tidak diizinkan membayar secara online.';
    END IF;

    -- 3) Status tagihan harus masih bisa dibayar
    IF v_status IN ('lunas', 'dibatalkan') THEN
        RAISE EXCEPTION 'Tagihan berstatus "%" dan tidak dapat dibayar lagi.', v_status;
    END IF;

    -- Sisa = nominal + denda - terbayar (denda dimutakhirkan oleh sistem saat pencatatan)
    SELECT GREATEST(t.nominal_sewa + t.denda - t.terbayar, 0)
    INTO v_sisa FROM public.tagihan t WHERE t.id = p_tagihan_id;

    IF v_sisa <= 0 THEN
        RAISE EXCEPTION 'Sisa tagihan sudah 0, tidak ada yang perlu dibayar.';
    END IF;

    -- 4) Reuse invoice Mayar yang sudah pernah dibuat → tidak menumpuk invoice
    out_nomor := (SELECT t.nomor FROM public.tagihan t WHERE t.id = p_tagihan_id);
    IF v_mayar_id IS NOT NULL AND v_link IS NOT NULL THEN
        out_link := v_link;
        out_mode := 'existing';
        out_sisa := v_sisa;
        out_mayar_invoice_id := v_mayar_id;
        RETURN;
    END IF;

    -- 5) Siapkan slot invoice Mayar; link diisi oleh Edge Function setelah
    --    berhasil membuat invoice di Mayar (sandbox atau produksi).
    v_mayar_id := 'inst_' || replace(gen_random_uuid()::TEXT, '-', '');
    out_mayar_invoice_id := v_mayar_id;
    out_mode := 'new';
    out_sisa := v_sisa;
    -- link masih NULL → Edge Function mengisinya
    UPDATE public.tagihan
    SET mayar_invoice_id = v_mayar_id
    WHERE public.tagihan.id = p_tagihan_id;
    out_link := NULL;
END;
$$;

-- -------------------------------------------------------------------
-- 2. FN_RECONCILE_MAYAR_PAYMENT (idempoten)
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_reconcile_mayar_payment(TEXT, UUID, INTEGER, DATE);
CREATE FUNCTION public.fn_reconcile_mayar_payment(
    p_referensi_mayar TEXT,
    p_tagihan_id UUID,
    p_jumlah INTEGER,
    p_tanggal_bayar DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (out_status TEXT)   -- 'inserted' | 'duplicate'
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_status TEXT;
    v_sisa INTEGER;
    v_inserted UUID;
BEGIN
    IF p_referensi_mayar IS NULL OR btrim(p_referensi_mayar) = '' THEN
        RAISE EXCEPTION 'Referensi pembayaran Mayar wajib ada.';
    END IF;
    IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
        RAISE EXCEPTION 'Jumlah pembayaran tidak valid.';
    END IF;

    -- 1) Kunci tagihan + validasi
    SELECT status, GREATEST(nominal_sewa + denda - terbayar, 0)
    INTO v_status, v_sisa
    FROM public.tagihan WHERE id = p_tagihan_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan.'; END IF;
    IF v_status = 'dibatalkan' THEN
        RAISE EXCEPTION 'Tagihan sudah dibatalkan, pembayaran ditolak.';
    END IF;
    IF p_jumlah > v_sisa THEN
        RAISE EXCEPTION 'Jumlah pembayaran (Rp%) melebihi sisa tagihan (Rp%).', p_jumlah, v_sisa;
    END IF;

    -- 2) Idempoten: referensi sama tidak pernah dobel
    INSERT INTO public.pembayaran
        (tagihan_id, jumlah, metode, tanggal_bayar, referensi_mayar, status, dicatat_oleh)
    VALUES
        (p_tagihan_id, p_jumlah, 'mayar', p_tanggal_bayar, btrim(p_referensi_mayar),
         'sah', NULL)
    ON CONFLICT (referensi_mayar) DO NOTHING
    RETURNING id INTO v_inserted;

    IF v_inserted IS NULL THEN
        out_status := 'duplicate';   -- webhook ulang → diabaikan, bukan error
        RETURN;
    END IF;

    -- 3) Trigger fn_trg_update_tagihan_on_pembayaran otomatis memutakhirkan status tagihan
    INSERT INTO public.audit_log (pelaku_id, peran, aksi, tabel, data_id, sesudah)
    VALUES (auth.uid(), 'pengelola', 'bayar:mayar', 'pembayaran', v_inserted::TEXT,
            jsonb_build_object('referensi', btrim(p_referensi_mayar), 'jumlah', p_jumlah));

    out_status := 'inserted';
END;
$$;

-- -------------------------------------------------------------------
-- 3. HAK AKSES
-- -------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fn_create_mayar_payment_session(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_reconcile_mayar_payment(TEXT, UUID, INTEGER, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_mayar_payment(TEXT, UUID, INTEGER, DATE) TO service_role;

-- Segarkan cache skema API agar RPC dikenali
NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- VERIFIKASI (opsional)
-- ====================================================================
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_name LIKE '%mayar%';
-- Uji simulator sandbox (ganti UUID tagihan & jumlah = sisa):
--   SELECT fn_reconcile_mayar_payment('MYR-SBX-0001', '<tagihan_id>', <sisa>, CURRENT_DATE);
--   → out_status 'inserted'; panggil ulang → 'duplicate' (idempoten).
-- ====================================================================
