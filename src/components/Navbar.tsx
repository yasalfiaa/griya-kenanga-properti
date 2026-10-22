import React from 'react';
import { useAuth } from '../context/AuthContext';
import { MOCK_PROFILES } from '../data/mock-data';
import { Home, Users, RefreshCw, LogOut, ShieldCheck } from 'lucide-react';
import { dataStore } from '../api/data-service';

export const Navbar: React.FC = () => {
  const { currentUser, role, switchRoleUser, logout } = useAuth();

  const handleResetData = () => {
    if (confirm('Apakah Anda yakin ingin mengatur ulang data demo ke kondisi awal (15 Okt 2026)?')) {
      dataStore.resetToDefaults();
      window.location.reload();
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'pemilik':
        return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">👑 Pemilik</span>;
      case 'pengelola':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">🛠️ Pengelola</span>;
      case 'penyewa':
      default:
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">👤 Penyewa</span>;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight text-base leading-tight">
              Griya Kenanga <span className="text-emerald-600">Residence</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Sistem Manajemen Properti & Sewa</p>
          </div>
        </div>

        {/* Demo Fast Switcher & Profile Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Account Switcher for Evaluator/Tester */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-xs font-medium text-slate-500 pl-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Ganti Akun:
            </span>
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchRoleUser(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <optgroup label="Pemilik">
                {MOCK_PROFILES.filter((p: any) => p.peran === 'pemilik').map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} (Pemilik)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pengelola">
                {MOCK_PROFILES.filter((p: any) => p.peran === 'pengelola').map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} (Pengelola)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Penyewa (Kasus Uji)">
                {MOCK_PROFILES.filter((p: any) => p.peran === 'penyewa').slice(0, 5).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} ({p.email.split('@')[0]})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Reset Demo Button */}
          <button
            onClick={handleResetData}
            title="Reset Data Demo ke Tanggal Acuan 15 Okt 2026"
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Current User Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">
                {currentUser?.nama_lengkap || 'Tamu'}
              </div>
              <div className="text-xs text-slate-500">{currentUser?.email}</div>
            </div>
            {getRoleBadge(role)}
            <button
              onClick={logout}
              title="Keluar"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
