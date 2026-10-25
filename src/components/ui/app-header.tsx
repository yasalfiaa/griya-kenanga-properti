/**
 * AppHeader — Top Navigation Bar (mengikuti referensi app-1):
 *   Kiri  : SidebarTrigger + salam "Selamat datang, [Nama]".
 *   Kanan : hanya avatar profil di dalam Dropdown Menu
 *           (nama + email, lalu tombol Keluar merah).
 * Tidak ada tombol search/notifikasi (ditiadakan sesuai spesifikasi).
 * Berlaku untuk menu semua peran karena dipasang di Layout utama aplikasi.
 */
import React from 'react';
import { LogOut } from 'lucide-react';

import { cn } from 'cn';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';

const initialsOf = (nama: string) =>
  nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'P';

export const AppHeader: React.FC = () => {
  const { currentUser, logout } = useAuth();

  const nama = currentUser?.nama_lengkap || 'Pengguna';
  const email = currentUser?.email || '';
  const initials = initialsOf(nama);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger aria-label="Buka/tutup menu navigasi" />
      <h1 className="truncate text-lg font-semibold">
        Selamat datang, {nama.split(' ')[0]}
      </h1>

      {/* Kanan: hanya avatar profil */}
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu profil"
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
            >
              <Avatar className="ml-1 size-8">
                {/* Profil tidak menyimpan foto saat ini → fallback inisial */}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="px-3">
              <div className="truncate font-semibold text-sm">{nama}</div>
              <div className="truncate text-xs text-muted-foreground font-normal">{email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className={cn(
                'cursor-pointer gap-2 text-destructive',
                'data-highlighted:text-destructive data-highlighted:bg-destructive/10'
              )}
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AppHeader;
