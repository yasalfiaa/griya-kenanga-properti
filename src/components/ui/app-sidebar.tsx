/**
 * AppSidebar — navigasi samping berbasis shadcn Sidebar.
 * Item menu memakai navigasi lama (src/components/Sidebar.tsx) dengan filter
 * peran yang sama; kontrol demo yang sebelumnya ada di Navbar (ganti akun demo,
 * reset data demo, badge peran) dipindahkan ke footer sidebar supaya header
 * tetap bersih sesuai spesifikasi: toggle + salam + avatar.
 * Menu aktif memakai warna primary (sama dengan versi lama).
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  House,
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Receipt,
  Wrench,
  UserSquare2,
  BarChart3,
  ShieldAlert,
  UserCheck,
  Settings,
  RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { dataStore } from '@/api/data-service';
import { MOCK_PROFILES } from '@/data/mock-data';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Diperlihatkan untuk peran apa pun kecuali yang tercantum */
  sembunyiUntuk?: string[];
  /** Hanya untuk peran berikut */
  hanyaUntuk?: string[];
  end?: boolean;
}

const MENU_UTAMA: NavItem[] = [
  { to: '/', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/unit', label: 'Daftar Unit (24)', icon: Building2, sembunyiUntuk: ['penyewa'] },
  { to: '/penyewa', label: 'Data Penyewa', icon: Users, sembunyiUntuk: ['penyewa'] },
  { to: '/kontrak', label: 'Kontrak Sewa', icon: FileText, sembunyiUntuk: ['penyewa'] },
  { to: '/tagihan', label: 'Tagihan & Kas', icon: Receipt },
  { to: '/kerusakan', label: 'Laporan Kerusakan', icon: Wrench },
  { to: '/identitas', label: 'Identitas KTP Saya', icon: UserSquare2, hanyaUntuk: ['penyewa'] },
];

const MENU_PEMILIK: NavItem[] = [
  { to: '/laporan', label: 'Laporan Pendapatan', icon: BarChart3 },
  { to: '/audit-log', label: 'Audit Log', icon: ShieldAlert },
  { to: '/manajemen-peran', label: 'Pengaturan Peran', icon: UserCheck },
  { to: '/setelan', label: 'Setelan', icon: Settings },
];

export const AppSidebar: React.FC = () => {
  const { role, currentUser, switchRoleUser } = useAuth();
  const location = useLocation();

  const handleResetData = () => {
    if (confirm('Apakah Anda yakin ingin mengatur ulang data demo ke kondisi awal (15 Okt 2026)?')) {
      dataStore.resetToDefaults();
      window.location.reload();
    }
  };

  const isActive = (item: NavItem) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const tampil = (item: NavItem) => {
    if (item.hanyaUntuk && !item.hanyaUntuk.includes(role)) return false;
    if (item.sembunyiUntuk?.includes(role)) return false;
    return true;
  };

  const labelItem = (item: NavItem) => {
    if (item.to === '/penyewa') return role === 'pengelola' ? 'Verifikasi Penyewa' : 'Data Penyewa';
    if (item.to === '/tagihan') return role === 'penyewa' ? 'Tagihan Saya' : 'Tagihan & Kas';
    return item.label;
  };

  const renderGroup = (items: NavItem[]) => (
    <SidebarMenu>
      {items.filter(tampil).map((item) => {
        const aktif = isActive(item);
        return (
          <SidebarMenuItem key={item.to}>
            {/*
              PENTING: warna ditempel pada SidebarMenuButton, bukan pada NavLink.
              NavLink memakai className berupa fungsi yang DITIMPA oleh Slot
              (asChild) sehingga class di dalamnya tidak pernah sampai ke DOM —
              inilah penyebab menu terlihat pudar/putih sebelum di-hover.
            */}
            <SidebarMenuButton
              asChild
              isActive={aktif}
              className={cn(
                'text-sm font-medium text-foreground hover:text-foreground',
                aktif && 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/90'
              )}
            >
              <NavLink to={item.to} end={item.end}>
                <item.icon />
                <span>{labelItem(item)}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    /* collapsible="none": sidebar selalu terlihat di desktop maupun mobile —
       item Menu Utama & Eksekutif Pemilik selalu tampil di layar tanpa
       perlu menghilang (offcanvas) atau hover. */
    <Sidebar collapsible="none" className="border-r">
      {/* Brand (dipindah dari Navbar lama) */}
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center text-white shadow-sm shadow-primary/20">
            <House className="w-4 h-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="font-bold text-foreground tracking-tight text-sm leading-tight truncate">
              Griya Kenanga <span className="text-primary">Residence</span>
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium truncate">
              Sistem Manajemen Properti & Sewa
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground/80 font-semibold">Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>{renderGroup(MENU_UTAMA)}</SidebarGroupContent>
        </SidebarGroup>

        {role === 'pemilik' && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-foreground/80 font-semibold">Menu Pemilik</SidebarGroupLabel>
            <SidebarGroupContent>{renderGroup(MENU_PEMILIK)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Info properti (kartu di sidebar lama) */}
        <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Griya Kenanga Sleman
          </div>
          <p className="leading-relaxed">
            Tanggal Acuan Data: <span className="font-medium text-foreground">15 Okt 2026</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total 24 Unit Kos & Studio</p>
        </div>

        {/* Kontrol demo (dipindah dari Navbar lama; fitur tidak hilang) */}
        <div className="space-y-2 px-1 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="flex justify-end">
            <button
              onClick={handleResetData}
              title="Reset Data Demo ke Tanggal Acuan 15 Okt 2026"
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
              aria-label="Reset data demo"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <label className="block">
            <span className="sr-only">Ganti akun demo</span>
            <select
              value={currentUser?.id || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => switchRoleUser(e.target.value)}
              className="w-full text-xs bg-sidebar border border-border rounded-lg px-2 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <optgroup label="Pemilik">
                {MOCK_PROFILES.filter((p: { peran: string }) => p.peran === 'pemilik').map((p: { id: string; nama_lengkap: string }) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} (Pemilik)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pengelola">
                {MOCK_PROFILES.filter((p: { peran: string }) => p.peran === 'pengelola').map((p: { id: string; nama_lengkap: string }) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} (Pengelola)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Penyewa (Kasus Uji)">
                {MOCK_PROFILES.filter((p: { peran: string }) => p.peran === 'penyewa').slice(0, 5).map((p: { id: string; nama_lengkap: string; email: string }) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_lengkap} ({p.email.split('@')[0]})
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
