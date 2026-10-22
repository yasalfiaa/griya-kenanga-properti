-- ====================================================================
-- MIGRASI 02: STORED PROCEDURES, FUNCTIONS & TRIGGERS
-- Menjamin Penegakan Aturan Bisnis (BR-01, BR-06, BR-07, BR-08, BR-09)
-- ====================================================================

-- 1. FUNGSI GENERATOR NOMOR URUT THREAD-SAFE (BR-06)
-- Format: JENIS-PERIODE-0001 (contoh: KTR-2026-0001, INV-202610-0001, LK-2026-0001)
CREATE OR REPLACE FUNCTION public.generate_nomor_urut(p_jenis TEXT, p_periode TEXT)
RETURNS TEXT AS $$
DECLARE
    v_terakhir INTEGER;
    v_hasil TEXT;
BEGIN
    INSERT INTO public.nomor_urut (jenis, periode, terakhir)
    VALUES (p_jenis, p_periode, 1)
    ON CONFLICT (jenis, periode)
    DO UPDATE SET terakhir = public.nomor_urut.terakhir + 1
    RETURNING terakhir INTO v_terakhir;

    v_hasil := p_jenis || '-' || p_periode || '-' || LPAD(v_terakhir::TEXT, 4, '0');
    RETURN v_hasil;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- 2. VALIDASI KONTRAK BERIRISAN (BR-01)
CREATE OR REPLACE FUNCTION public.check_contract_overlap(
    p_unit_id UUID,
    p_mulai DATE,
    p_selesai DATE,
    p_exclude_kontrak_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_overlap_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.kontrak
    WHERE unit_id = p_unit_id
      AND status IN ('draf', 'aktif')
      AND (p_exclude_kontrak_id IS NULL OR id <> p_exclude_kontrak_id)
      AND (tanggal_mulai <= p_selesai AND tanggal_selesai >= p_mulai);

    RETURN (v_overlap_count > 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger sebelum insert/update kontrak untuk memastikan BR-01
CREATE OR REPLACE FUNCTION public.fn_trg_check_contract_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('draf', 'aktif') THEN
        IF public.check_contract_overlap(NEW.unit_id, NEW.tanggal_mulai, NEW.tanggal_selesai, NEW.id) THEN
            RAISE EXCEPTION 'Unit sudah memiliki kontrak berstatus draf atau aktif pada periode tersebut (BR-01)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_contract_overlap ON public.kontrak;
CREATE TRIGGER trg_check_contract_overlap
    BEFORE INSERT OR UPDATE OF unit_id, tanggal_mulai, tanggal_selesai, status
    ON public.kontrak
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_check_contract_overlap();

-- 3. PERHITUNGAN DENDA KETERLAMBATAN (BR-07)
-- Pembayaran setelah tgl 10 dikenai Rp20.000/hari, maks Rp200.000. Tgl 10 belum kena denda.
CREATE OR REPLACE FUNCTION public.calculate_denda(p_jatuh_tempo DATE, p_tanggal_bayar DATE)
RETURNS INTEGER AS $$
DECLARE
    v_hari_telat INTEGER;
    v_denda INTEGER;
BEGIN
    v_hari_telat := p_tanggal_bayar - p_jatuh_tempo;
    IF v_hari_telat <= 0 THEN
        RETURN 0;
    END IF;

    v_denda := v_hari_telat * 20000;
    IF v_denda > 200000 THEN
        v_denda := 200000;
    END IF;

    RETURN v_denda;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. PEMBUATAN MASSAL TAGIHAN BULANAN (BR-06)
-- Membuat tagihan untuk semua kontrak aktif pada periode tertentu
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices(p_periode DATE, p_creator_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER := 0;
    v_kontrak RECORD;
    v_periode_str TEXT;
    v_nomor_inv TEXT;
    v_jatuh_tempo DATE;
BEGIN
    -- Format periode: YYYYMM (contoh: 202610)
    v_periode_str := TO_CHAR(p_periode, 'YYYYMM');
    -- Jatuh tempo selalu tanggal 10 pada bulan periode tersebut
    v_jatuh_tempo := (DATE_TRUNC('month', p_periode) + INTERVAL '9 days')::DATE;

    FOR v_kontrak IN
        SELECT k.id, k.harga_sewa_bulanan
        FROM public.kontrak k
        WHERE k.status = 'aktif'
          AND k.tanggal_mulai <= p_periode
          AND k.tanggal_selesai >= p_periode
          -- Pastikan belum ada tagihan untuk kontrak dan periode ini
          AND NOT EXISTS (
              SELECT 1 FROM public.tagihan t
              WHERE t.kontrak_id = k.id AND t.periode = p_periode
          )
    LOOP
        v_nomor_inv := public.generate_nomor_urut('INV', v_periode_str);

        INSERT INTO public.tagihan (
            nomor,
            kontrak_id,
            periode,
            jatuh_tempo,
            nominal_sewa,
            denda,
            terbayar,
            status
        ) VALUES (
            v_nomor_inv,
            v_kontrak.id,
            p_periode,
            v_jatuh_tempo,
            v_kontrak.harga_sewa_bulanan,
            0,
            0,
            'belum_bayar'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'created_count', v_count);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- 5. TRIGGER PERUBAHAN STATUS TAGIHAN DARI PEMBAYARAN (BR-08, BR-09)
CREATE OR REPLACE FUNCTION public.fn_trg_update_tagihan_on_pembayaran()
RETURNS TRIGGER AS $$
DECLARE
    v_total_bayar INTEGER;
    v_tagihan RECORD;
    v_denda INTEGER;
    v_total_harus_bayar INTEGER;
BEGIN
    -- Ambil data tagihan
    SELECT * INTO v_tagihan FROM public.tagihan WHERE id = COALESCE(NEW.tagihan_id, OLD.tagihan_id);

    -- Hitung total pembayaran sah
    SELECT COALESCE(SUM(jumlah), 0) INTO v_total_bayar
    FROM public.pembayaran
    WHERE tagihan_id = v_tagihan.id AND status = 'sah';

    -- Hitung denda berdasarkan pembayaran terakhir atau hari ini jika belum bayar
    v_denda := v_tagihan.denda;
    IF TG_OP = 'INSERT' AND NEW.status = 'sah' THEN
        v_denda := public.calculate_denda(v_tagihan.jatuh_tempo, NEW.tanggal_bayar);
    END IF;

    v_total_harus_bayar := v_tagihan.nominal_sewa + v_denda;

    -- Tentukan status tagihan baru
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

DROP TRIGGER IF EXISTS trg_update_tagihan_on_pembayaran ON public.pembayaran;
CREATE TRIGGER trg_update_tagihan_on_pembayaran
    AFTER INSERT OR UPDATE OF status, jumlah
    ON public.pembayaran
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_update_tagihan_on_pembayaran();
