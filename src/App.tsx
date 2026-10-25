import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, loginPathDenganRedirect } from './components/ProtectedRoute';
import { SkeletonLoadingPage } from './components/ui/skeleton';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import { AppSidebar } from './components/ui/app-sidebar';
import { AppHeader } from './components/ui/app-header';
import { Dashboard } from './views/Dashboard';
import { Units } from './views/Units';
import { Tenants } from './views/Tenants';
import { Contracts } from './views/Contracts';
import { Invoices } from './views/Invoices';
import { DamageReports } from './views/DamageReports';
import { Reports } from './views/Reports';
import { AuditLogPage } from './views/AuditLogPage';
import { RoleManagement } from './views/RoleManagement';
import { Settings } from './views/Settings';
import { TenantIdentity } from './views/TenantIdentity';
import { Login } from './views/Login';
import { Register } from './views/Register';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <SkeletonLoadingPage />;
  }

  if (!currentUser) {
    // Bawa URL yang dicoba diakses agar setelah login pengguna kembali ke sini
    return <Navigate to={loginPathDenganRedirect(location.pathname, location.search)} replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0: inset adalah flex item — tanpa ini lebar konten bisa menolak
          menyusut di tablet dan memakan padding kanan (catatan referensi app-1). */}
      <SidebarInset className="min-w-0">
        <AppHeader />
        {/* Header yang sama dipakai beranda semua peran (toggle + salam + avatar) */}
        <main className="flex-1 w-full p-4 sm:p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rute Publik */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Beranda: Terbuka untuk semua peran terotentikasi */}
          <Route
            path="/"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola', 'penyewa']}>
                  <Dashboard />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Unit: Khusus Staf (Pengelola & Pemilik) */}
          <Route
            path="/unit"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola']}>
                  <Units />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Penyewa: Khusus Staf (Pengelola verifikasi KTP, Pemilik NIK tersamar) */}
          <Route
            path="/penyewa"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola']}>
                  <Tenants />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Kontrak: Khusus Staf (Pengelola buat & aktifkan, Pemilik akhiri awal) */}
          <Route
            path="/kontrak"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola']}>
                  <Contracts />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Tagihan: Semua Peran (Penyewa lihat miliknya, Staf kelola kas) */}
          <Route
            path="/tagihan"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola', 'penyewa']}>
                  <Invoices />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Kerusakan: Semua Peran (Penyewa buat/pantau, Staf proses & setujui) */}
          <Route
            path="/kerusakan"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik', 'pengelola', 'penyewa']}>
                  <DamageReports />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Identitas KTP: Khusus Penyewa */}
          <Route
            path="/identitas"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['penyewa']}>
                  <TenantIdentity />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Laporan Finansial: Khusus Pemilik (BR-10) */}
          <Route
            path="/laporan"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik']}>
                  <Reports />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Audit Log: Khusus Pemilik (BR-10) */}
          <Route
            path="/audit-log"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik']}>
                  <AuditLogPage />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Manajemen Peran: Khusus Pemilik (BR-10) */}
          <Route
            path="/manajemen-peran"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik']}>
                  <RoleManagement />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Setelan Sistem (Payment Gateway dsb.): Khusus Pemilik */}
          <Route
            path="/setelan"
            element={
              <Layout>
                <ProtectedRoute allowedRoles={['pemilik']}>
                  <Settings />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
