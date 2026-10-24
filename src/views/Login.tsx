import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Lock, Mail, Users, ArrowRight, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginAs } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ratna@griyakenanga.test');
  const [password, setPassword] = useState('Latihan#2026');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await loginAs(email, password);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.message || 'Email atau kata sandi tidak ditemukan.');
    }
  };

  const handleQuickLogin = async (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('Latihan#2026');
    setError('');
    const res = await loginAs(quickEmail, 'Latihan#2026');
    if (res.success) {
      navigate('/');
    } else {
      setError(res.message || 'Gagal masuk dengan akun uji.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 mx-auto flex items-center justify-center text-white shadow-md shadow-emerald-200">
            <Home className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Griya Kenanga <span className="text-emerald-600">Residence</span>
          </h1>
          <p className="text-xs text-slate-500">Sistem Internal Manajemen Properti & Sewa Unit</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-800">Masuk ke Akun Anda</h2>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              Masuk Sekarang <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Test Buttons */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Akses Cepat Akun Uji (Password: Latihan#2026):
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('ratna@griyakenanga.test')}
                className="p-2 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-xl font-medium text-left truncate transition-colors"
              >
                👑 Ratna (Pemilik)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('bayu@griyakenanga.test')}
                className="p-2 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl font-medium text-left truncate transition-colors"
              >
                🛠️ Bayu (Pengelola)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('dimas@griyakenanga.test')}
                className="p-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl font-medium text-left truncate transition-colors"
              >
                👤 Dimas (Penyewa)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('fajar@griyakenanga.test')}
                className="p-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-medium text-left truncate transition-colors"
              >
                👤 Fajar (Uji KTP)
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          Belum punya akun?{' '}
          <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
            Daftar Akun Baru
          </Link>
        </div>
      </div>
    </div>
  );
};
