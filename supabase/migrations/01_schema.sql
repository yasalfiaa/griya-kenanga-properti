-- ====================================================================
-- MIGRASI 01: SKEMA UTAMA DATABASE GRIYA KENANGA RESIDENCE
-- Sesuai ERD_Properti.png dan PRD_Properti.docx.md (9 Tabel Inti)
-- ====================================================================

-- Bersihkan tabel lama jika ada agar skema terupdate bersih
DROP TABLE IF EXISTS public.audit_log, public.pembayaran, public.tagihan, public.laporan_kerusakan, public.kontrak, public.identitas_penyewa, public.profiles, public.unit, public.nomor_urut CASCADE;
DROP VIEW IF EXISTS public.identitas_penyewa_pemilik CASCADE;

-- 1. TABEL PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    nama_lengkap TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    no_hp TEXT,
    peran TEXT NOT NULL CHECK (peran IN ('pemilik', 'pengelola', 'penyewa')) DEFAULT 'penyewa',
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABEL IDENTITAS_PENYEWA (Data Rahasia NIK & KTP)
CREATE TABLE IF NOT EXISTS public.identitas_penyewa (
    penyewa_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    nik CHAR(16) UNIQUE NOT NULL,
    alamat_asal TEXT NOT NULL,
    foto_ktp_path TEXT,
    kontak_darurat_nama TEXT NOT NULL,
    kontak_darurat_hp TEXT NOT NULL,
    status_verifikasi TEXT NOT NULL CHECK (status_verifikasi IN ('belum', 'terverifikasi', 'ditolak')) DEFAULT 'belum',
    diverifikasi_oleh UUID REFERENCES public.profiles(id),
    diverifikasi_pada TIMESTAMPTZ,
    catatan_verifikasi TEXT
);

-- 3. TABEL UNIT (24 Unit: Lantai 1 Standar, Lantai 2 AC, Lantai 3 Studio)
CREATE TABLE IF NOT EXISTS public.unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT UNIQUE NOT NULL, -- Contoh: 'A-101', 'B-201', 'C-301'
    lantai SMALLINT NOT NULL CHECK (lantai IN (1, 2, 3)),
    tipe TEXT NOT NULL CHECK (tipe IN ('standar', 'ac', 'studio')),
    luas_m2 NUMERIC(5,2) NOT NULL,
    harga_sewa_bulanan INTEGER NOT NULL CHECK (harga_sewa_bulanan > 0),
    status TEXT NOT NULL CHECK (status IN ('tersedia', 'perbaikan', 'nonaktif')) DEFAULT 'tersedia',
    keterangan TEXT
);

-- 4. TABEL KONTRAK
CREATE TABLE IF NOT EXISTS public.kontrak (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor TEXT UNIQUE NOT NULL, -- Format: KTR-2026-0001
    unit_id UUID NOT NULL REFERENCES public.unit(id),
    penyewa_id UUID NOT NULL REFERENCES public.profiles(id),
    tanggal_mulai DATE NOT NULL, -- Selalu tanggal 1 (BR-02)
    durasi_bulan SMALLINT NOT NULL CHECK (durasi_bulan IN (1, 3, 6, 12)),
    tanggal_selesai DATE NOT NULL, -- Hari terakhir bulan ke-n
    harga_sewa_bulanan INTEGER NOT NULL, -- Dikunci saat kontrak dibuat (BR-04)
    status TEXT NOT NULL CHECK (status IN ('draf', 'aktif', 'selesai', 'diakhiri', 'dibatalkan')) DEFAULT 'draf',
    tanggal_berakhir_aktual DATE,
    alasan_berakhir TEXT,
    dibuat_oleh UUID REFERENCES public.profiles(id),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABEL TAGIHAN
CREATE TABLE IF NOT EXISTS public.tagihan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor TEXT UNIQUE NOT NULL, -- Format: INV-202610-0001 (BR-06)
    kontrak_id UUID NOT NULL REFERENCES public.kontrak(id) ON DELETE CASCADE,
    periode DATE NOT NULL, -- Contoh: 2026-10-01
    jatuh_tempo DATE NOT NULL, -- Selalu tanggal 10 (BR-06)
    nominal_sewa INTEGER NOT NULL,
    denda INTEGER NOT NULL DEFAULT 0 CHECK (denda >= 0 AND denda <= 200000), -- BR-07
    terbayar INTEGER NOT NULL DEFAULT 0 CHECK (terbayar >= 0),
    status TEXT NOT NULL CHECK (status IN ('belum_bayar', 'sebagian', 'lunas', 'dibatalkan')) DEFAULT 'belum_bayar',
    mayar_invoice_id TEXT,
    mayar_link TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unik_kontrak_periode UNIQUE (kontrak_id, periode) -- BR-06: 1 tagihan per kontrak per periode
);

-- 6. TABEL PEMBAYARAN
CREATE TABLE IF NOT EXISTS public.pembayaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tagihan_id UUID NOT NULL REFERENCES public.tagihan(id) ON DELETE CASCADE,
    jumlah INTEGER NOT NULL CHECK (jumlah > 0),
    metode TEXT NOT NULL CHECK (metode IN ('tunai', 'transfer', 'mayar')),
    tanggal_bayar DATE NOT NULL,
    bukti_path TEXT, -- Wajib untuk transfer
    referensi_mayar TEXT UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('sah', 'dibatalkan')) DEFAULT 'sah',
    alasan_batal TEXT,
    dicatat_oleh UUID REFERENCES public.profiles(id), -- Boleh NULL untuk pembayaran otomatis Mayar
    dibatalkan_oleh UUID REFERENCES public.profiles(id),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABEL LAPORAN_KERUSAKAN
CREATE TABLE IF NOT EXISTS public.laporan_kerusakan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor TEXT UNIQUE NOT NULL, -- Format: LK-2026-0001
    kontrak_id UUID NOT NULL REFERENCES public.kontrak(id),
    unit_id UUID NOT NULL REFERENCES public.unit(id),
    pelapor_id UUID NOT NULL REFERENCES public.profiles(id),
    kategori TEXT NOT NULL,
    judul TEXT NOT NULL,
    deskripsi TEXT,
    foto_paths TEXT[] NOT NULL DEFAULT '{}', -- 1 s/d 3 foto (BR-11)
    status TEXT NOT NULL CHECK (status IN ('dilaporkan', 'menunggu_persetujuan', 'diproses', 'selesai', 'ditutup', 'ditolak')) DEFAULT 'dilaporkan',
    estimasi_biaya INTEGER,
    biaya_aktual INTEGER,
    disetujui_oleh UUID REFERENCES public.profiles(id),
    selesai_pada TIMESTAMPTZ,
    alasan_penolakan TEXT,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABEL NOMOR_URUT (Thread-safe sequence generator untuk nomor invoice/kontrak/laporan)
CREATE TABLE IF NOT EXISTS public.nomor_urut (
    jenis TEXT NOT NULL, -- 'KTR', 'INV', 'LK'
    periode TEXT NOT NULL, -- Contoh '2026' atau '202610'
    terakhir INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (jenis, periode)
);

-- 9. TABEL AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    pelaku_id UUID REFERENCES public.profiles(id),
    peran TEXT, -- Boleh NULL untuk aksi otomatis sistem / webhook
    aksi TEXT NOT NULL,
    tabel TEXT NOT NULL,
    data_id TEXT NOT NULL,
    sebelum JSONB,
    sesudah JSONB,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index performa query
CREATE INDEX IF NOT EXISTS idx_kontrak_unit_id ON public.kontrak(unit_id);
CREATE INDEX IF NOT EXISTS idx_kontrak_penyewa_id ON public.kontrak(penyewa_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_kontrak_id ON public.tagihan(kontrak_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_periode ON public.tagihan(periode);
CREATE INDEX IF NOT EXISTS idx_pembayaran_tagihan_id ON public.pembayaran(tagihan_id);
CREATE INDEX IF NOT EXISTS idx_kerusakan_unit_id ON public.laporan_kerusakan(unit_id);
CREATE INDEX IF NOT EXISTS idx_kerusakan_pelapor_id ON public.laporan_kerusakan(pelapor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_dibuat_pada ON public.audit_log(dibuat_pada DESC);
