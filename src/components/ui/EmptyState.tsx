/**
 * EmptyState — keadaan kosong visual untuk tabel & grid daftar.
 * Menyulitkan pesan "Data Kosong" italic menjadi ikon + judul + petunjuk,
 * tanpa menambah tombol/aksi apa pun (fitur tidak berubah).
 */
import React from 'react';
import { cn } from '../../utils/cn';

export interface EmptyStateProps {
  /** Ikon lucide-react, mis. Receipt dari `import { Receipt } from 'lucide-react'` */
  icon?: React.ComponentType<{ className?: string }>;
  /** Judul singkat, mis. "Belum Ada Tagihan" */
  title: string;
  /** Petunjuk santun untuk pengguna, opsional */
  description?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-10 px-6', className)}>
      {Icon && <Icon className="w-10 h-10 text-slate-200 mb-3" />}
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{description}</p>}
    </div>
  );
};
