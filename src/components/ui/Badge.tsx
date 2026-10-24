/**
 * Badge — pill status standar aplikasi.
 * Mengganti pattern <span class="bg-{warna}-100 text-{warna}-800 text-xs
 * font-semibold px-2.5 py-0.5 rounded-full"> yang sebelumnya disalin per view.
 * Tampilan default mengikuti persis pola lama; varian hanya memilih warna.
 */
import React from 'react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  slate: 'bg-slate-100 text-slate-800',
  muted: 'bg-slate-200 text-slate-700',
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'slate', className, children, ...props }) => {
  return (
    <span
      className={cn(
        'text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap',
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
