import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Mail, Lock, User, Phone, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { MOCK_PROFILES } from '../data/mock-data';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 mx-auto flex items-center justify-center text-white shadow-md shadow-emerald-200">
            <Home className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Daftar Penghuni Baru
          </h1>
          <p className="text-xs text-slate-500">
            Pendaftaran otomatis sebagai peran <span className="font-semibold text-emerald-700">Penyewa</span> (PRD Bagian 3)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successInfo ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
              <div className="flex items-start gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{successInfo}</span>
              </div>
              <Link
                to="/login"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg shadow-sm text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                Menuju Halaman Masuk <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama sesuai KTP"
                    className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Alamat Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nomor WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="081234567890"
                    className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-xs flex items-center justify-center gap-1.5"
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
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-slate-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
            Masuk Sekarang
          </Link>
        </div>
      </div>
    </div>
  );
};
