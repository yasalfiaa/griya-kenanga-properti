-- ============================================================
-- 16. PERBAIKAN AKSES LOG WEBHOOK HALAMAN SETELAN (PEMILIK)
-- ============================================================
-- Gejala: di /setelan (pemilik), membaca mayar_webhook_log selalu
-- gagal ("permission denied"). Penyebab: migration 12 menjalankan
-- REVOKE ALL ... FROM authenticated sehingga hak SELECT pemilik
-- ikut tercabut — policy RLS tak pernah sampai dievaluasi.
-- Perbaikan: beri kembali GRANT SELECT untuk authenticated.
-- Pembatasan "hanya pemilik" tetap dijaja oleh policy RLS
-- mayar_webhook_log_select_pemilik (peran = 'pemilik').
-- Jalankan di SQL Editor (proyek zhkbjggeltzrosbrpyxn). Idempotent.
-- ============================================================

GRANT SELECT ON public.mayar_webhook_log TO authenticated;

-- Hak tulis TETAP tidak diberikan: webhook hanya ditulis lewat
-- service key (route server), bukan langsung oleh pengguna.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mayar_webhook_log FROM anon, authenticated;
