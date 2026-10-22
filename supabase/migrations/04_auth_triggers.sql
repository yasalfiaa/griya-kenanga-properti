-- ====================================================================
-- MIGRASI 04: AUTH TRIGGER & AUTO-INSERT KE PROFILES
-- Menghubungkan Supabase Auth (auth.users) ke public.profiles
-- Jalankan file ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zhkbjggeltzrosbrpyxn/sql/new
-- ====================================================================

-- 1. FUNGSI AUTO-CREATE PROFIL SAAT USER MENDAFTAR DI SUPABASE AUTH
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, peran, aktif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'no_hp',
    COALESCE(NEW.raw_user_meta_data->>'peran', 'penyewa'),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    nama_lengkap = EXCLUDED.nama_lengkap,
    no_hp = EXCLUDED.no_hp;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER PADA TABEL AUTH.USERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. KEBIJAKAN RLS TAMBAHAN AGAR APLIKASI WEB DAPAT MENYIMPAN/MEMPERBARUI PROFIL
DROP POLICY IF EXISTS "Pengguna dapat mendaftarkan profilnya" ON public.profiles;
CREATE POLICY "Pengguna dapat mendaftarkan profilnya"
    ON public.profiles FOR INSERT
    WITH CHECK (true);
