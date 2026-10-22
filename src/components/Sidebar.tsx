import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Receipt,
  Wrench,
  BarChart3,
  ShieldAlert,
  UserCheck,
  CreditCard,
  UserSquare2,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
      isActive
        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-4 min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <div className="space-y-6">
        {/* Menu Utama */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Menu Utama
          </div>
          <nav className="space-y-1">
            <NavLink to="/" end className={navClass}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Beranda</span>
            </NavLink>

            {/* Khusus Pengelola & Pemilik */}
            {role !== 'penyewa' && (
              <>
                <NavLink to="/unit" className={navClass}>
                  <Building2 className="w-4 h-4" />
                  <span>Daftar Unit (24)</span>
                </NavLink>

                <NavLink to="/penyewa" className={navClass}>
                  <Users className="w-4 h-4" />
                  <span>
                    {role === 'pengelola' ? 'Verifikasi Penyewa' : 'Data Penyewa'}
                  </span>
                </NavLink>

                <NavLink to="/kontrak" className={navClass}>
                  <FileText className="w-4 h-4" />
                  <span>Kontrak Sewa</span>
                </NavLink>
              </>
            )}

            {/* Tagihan & Pembayaran */}
            <NavLink to="/tagihan" className={navClass}>
              <Receipt className="w-4 h-4" />
              <span>{role === 'penyewa' ? 'Tagihan Saya' : 'Tagihan & Kas'}</span>
            </NavLink>

            {/* Laporan Kerusakan */}
            <NavLink to="/kerusakan" className={navClass}>
              <Wrench className="w-4 h-4" />
              <span>Laporan Kerusakan</span>
            </NavLink>

            {/* Penyewa: Identitas Saya */}
            {role === 'penyewa' && (
              <NavLink to="/identitas" className={navClass}>
                <UserSquare2 className="w-4 h-4" />
                <span>Identitas KTP Saya</span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* Khusus Pemilik: Laporan & Manajemen */}
        {role === 'pemilik' && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
              Eksekutif Pemilik
            </div>
            <nav className="space-y-1">
              <NavLink to="/laporan" className={navClass}>
                <BarChart3 className="w-4 h-4" />
                <span>Laporan Pendapatan</span>
              </NavLink>

              <NavLink to="/audit-log" className={navClass}>
                <ShieldAlert className="w-4 h-4" />
                <span>Audit Log</span>
              </NavLink>

              <NavLink to="/manajemen-peran" className={navClass}>
                <UserCheck className="w-4 h-4" />
                <span>Pengaturan Peran</span>
              </NavLink>
            </nav>
          </div>
        )}
      </div>

      {/* Info Properti Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-500">
        <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Griya Kenanga Sleman
        </div>
        <p className="leading-relaxed">
          Tanggal Acuan Data: <span className="font-medium text-slate-800">15 Okt 2026</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-400">Total 24 Unit Kos & Studio</p>
      </div>
    </aside>
  );
};
