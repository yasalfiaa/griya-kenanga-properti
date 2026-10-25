import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleType } from '../types/database';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

/** Path login dengan parameter redirect agar setelah login pengguna kembali
 *  ke halaman yang semula ingin diakses (bukan selalu beranda). */
export const loginPathDenganRedirect = (pathname: string, search: string): string =>
  `/login?redirect=${encodeURIComponent(pathname + search)}`;

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: RoleType[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-muted-foreground font-medium">Memeriksa hak akses...</p>
        </div>
      </div>
    );
  }

  // Belum login -> Arahkan ke /login sambil membawa URL yang dicoba diakses
  if (!currentUser) {
    return <Navigate to={loginPathDenganRedirect(location.pathname, location.search)} replace />;
  }

  // Jika ada pembatasan peran dan peran saat ini tidak diizinkan -> Tampilkan layar 403 Akses Ditolak
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border border-rose-200 p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Akses Ditolak (403)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Peran Anda saat ini (<span className="font-semibold capitalize text-rose-600">{role}</span>) tidak memiliki izin untuk mengakses halaman ini.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 bg-muted hover:bg-border text-foreground font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
