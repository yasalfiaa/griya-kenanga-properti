import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Mail, Lock, User, Phone, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { MOCK_PROFILES } from '../data/mock-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { loginAs } = useAuth();
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [noHp, setNoHp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isSupabaseConfigured) {
        // 1. Mendaftar langsung ke Supabase Auth (auth.users)
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              nama_lengkap: nama,
              no_hp: noHp,
              peran: 'penyewa',
            },
          },
        });

        if (authErr) {
          let msg = authErr.message;
          if (msg.includes('already registered')) {
            msg = 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.';
          } else if (msg.includes('invalid') || msg.includes('valid email')) {
            msg = 'Format alamat email tidak valid atau domain tidak didukung oleh penyedia auth.';
          } else if (msg.includes('at least 6 characters')) {
            msg = 'Kata sandi minimal harus terdiri dari 6 karakter.';
          }
          throw new Error(msg);
        }

        // 2. Jika akun berhasil dibuat di Supabase
        if (authData.user) {
          // Coba tambahkan atau perbarui data di public.profiles
          try {
            await supabase.from('profiles').upsert({
              id: authData.user.id,
              nama_lengkap: nama,
              email: cleanEmail,
              no_hp: noHp,
              peran: 'penyewa',
              aktif: true,
            });
          } catch (pErr) {
            console.log('Catatan upsert profiles:', pErr);
          }

          // Jika session langsung aktif (Confirm email dinonaktifkan di Supabase)
          if (authData.session) {
            await loginAs(cleanEmail, password);
            navigate('/');
            return;
          } else {
            // Confirm email masih aktif
            setSuccessInfo(
              `Akun Anda berhasil didaftarkan di Supabase! Jika pengaturan 'Confirm email' aktif di Supabase, silakan cek email Anda untuk konfirmasi, atau Anda dapat langsung mencoba masuk di halaman login.`
            );
            setLoading(false);
            return;
          }
        }
      } else {
        // Fallback offline mock data jika Supabase tidak dikonfigurasi
        const newProfile = {
          id: crypto.randomUUID(),
          nama_lengkap: nama,
          email: cleanEmail,
          no_hp: noHp,
          peran: 'penyewa',
          aktif: true,
          dibuat_pada: new Date().toISOString(),
        };

        MOCK_PROFILES.push(newProfile as any);
        await loginAs(cleanEmail);
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mendaftarkan akun. Silakan periksa kembali data Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Background foto real properti hunian di siang hari dengan efek blur 75% */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-110 filter blur-[14px] brightness-95"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=2000&q=80')`,
        }}
        aria-hidden="true"
      />
      {/* Overlay siang hari agar kartu tetap kontras dan bersih */}
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" aria-hidden="true" />

      {/* Kartu Autentikasi Register */}
      <Card className="relative z-10 flex w-full max-w-[440px] shadow-2xl flex-col gap-6 p-6 md:p-8 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl">
        <CardHeader className="flex flex-col items-center gap-3 p-0 text-center">
          {/* Logo aplikasi tetap dipertahankan */}
          <div className="relative flex size-[68px] shrink-0 items-center justify-center rounded-full backdrop-blur-xl md:size-20 before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-primary/20 before:to-transparent before:opacity-30">
            <div className="relative z-10 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-white shadow-md shadow-primary/25 md:size-14">
              <Home className="size-6 md:size-7" />
            </div>
          </div>

          {/* Title & Subtitle sesuai instruksi */}
          <div className="flex flex-col space-y-1.5 text-center">
            <CardTitle className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
              Daftar Penyewa Baru
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground tracking-[-0.006em]">
              Lengkapi data diri untuk mengakses aplikasi
            </CardDescription>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-0">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successInfo ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
              <div className="flex items-start gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{successInfo}</span>
              </div>
              <Link
                to="/login"
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-3 rounded-lg shadow-sm text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Menuju Halaman Masuk <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              {/* Komponen text input: Nama Lengkap */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama sesuai KTP"
                    className="w-full text-xs border border-border rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none bg-background/80"
                    required
                  />
                </div>
              </div>

              {/* Komponen text input: Email */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full text-xs border border-border rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none bg-background/80"
                    required
                  />
                </div>
              </div>

              {/* Komponen text input: Nomor Whatsapp */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Nomor WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="tel"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="081234567890"
                    className="w-full text-xs border border-border rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none bg-background/80"
                    required
                  />
                </div>
              </div>

              {/* Komponen text input: Kata Sandi */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full text-xs border border-border rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none bg-background/80"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-lg shadow-sm transition-colors text-xs flex items-center justify-center gap-1.5 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Mendaftarkan ke Supabase...
                  </>
                ) : (
                  <>
                    Daftar Akun Penyewa <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-5 text-center text-xs text-muted-foreground">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Masuk Sekarang
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
