import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './views/Dashboard';
import { Units } from './views/Units';
import { Tenants } from './views/Tenants';
import { Contracts } from './views/Contracts';
import { Invoices } from './views/Invoices';
import { DamageReports } from './views/DamageReports';
import { Reports } from './views/Reports';
import { AuditLogPage } from './views/AuditLogPage';
import { RoleManagement } from './views/RoleManagement';
import { TenantIdentity } from './views/TenantIdentity';
import { Login } from './views/Login';
import { Register } from './views/Register';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl">
          {children}
        </main>
      </div>
    </div>
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
