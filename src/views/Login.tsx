import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Home, EyeIcon, EyeOffIcon, ArrowRight, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginAs, currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('ratna@griyakenanga.test');
  const [password, setPassword] = useState('Latihan#2026');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState<boolean>(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  // Tujuan setelah login: parameter ?redirect= bila ada dan aman (path internal),
  // selain itu beranda seperti semula.
  const tujuanSetelahLogin = useMemo(() => {
    const redirect = searchParams.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    return '/';
  }, [searchParams]);

  // Bila pengguna sudah mempunyai sesi, arahkan ke halaman tujuan.
  useEffect(() => {
    if (currentUser) navigate(tujuanSetelahLogin, { replace: true });
  }, [currentUser, navigate, tujuanSetelahLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await loginAs(email, password);
      if (res.success) {
        navigate(tujuanSetelahLogin, { replace: true });
      } else {
        setError(res.message || 'Email atau kata sandi tidak ditemukan.');
      }
    } finally {
      setIsLoading(false);
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

      {/* Kartu Autentikasi */}
      <Card className="relative z-10 flex w-full max-w-[440px] shadow-2xl flex-col gap-6 p-6 md:p-8 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl">
        <CardHeader className="flex flex-col items-center gap-3 p-0 text-center">
          {/* Logo aplikasi tetap dipertahankan */}
          <div className="relative flex size-[68px] shrink-0 items-center justify-center rounded-full backdrop-blur-xl md:size-20 before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-primary/20 before:to-transparent before:opacity-30">
            <div className="relative z-10 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-white shadow-md shadow-primary/25 md:size-14">
              <Home className="size-6 md:size-7" />
            </div>
          </div>

          {/* Nama Aplikasi & Keterangan Sistem tetap dipertahankan */}
          <div className="flex flex-col space-y-1.5 text-center">
            <CardTitle className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
              Griya Kenanga <span className="text-primary">Residence</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground tracking-[-0.006em]">
              Sistem Internal Manajemen Properti & Sewa Unit
            </CardDescription>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-0">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Fitur Email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email Anda"
                className="rounded-lg h-10 px-3 text-xs bg-background/80"
                required
              />
            </div>

            {/* Fitur Password dengan toggle lihat/sembunyikan */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Kata Sandi
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  className="pe-9 rounded-lg h-10 px-3 text-xs bg-background/80"
                  placeholder="Masukkan kata sandi"
                  type={isVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={toggleVisibility}
                  aria-label={isVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={isVisible}
                  aria-controls="password"
                >
                  {isVisible ? (
                    <EyeOffIcon size={16} aria-hidden="true" />
                  ) : (
                    <EyeIcon size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Keep me logged in (Ingat saya) & Tautan Daftar Akun Baru */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="keep-me-logged-in"
                  checked={keepLoggedIn}
                  onCheckedChange={(checked) => setKeepLoggedIn(!!checked)}
                />
                <Label
                  htmlFor="keep-me-logged-in"
                  className="text-xs text-muted-foreground cursor-pointer select-none"
                >
                  Ingat saya
                </Label>
              </div>
              <Link
                to="/register"
                className="text-xs text-primary font-medium hover:underline transition-colors"
              >
                Belum Punya Akun? Daftar Akun Baru
              </Link>
            </div>

            {/* Tombol Continue dengan warna primary */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 rounded-lg shadow-sm transition-colors text-xs flex items-center justify-center gap-1.5 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Lanjutkan <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
