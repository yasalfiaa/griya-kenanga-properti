/**
 * cn() — gabungan clsx + tailwind-merge.
 * Fungsi util menata className: kondisional (clsx) dan merga konflik
 * kelas Tailwind sehingga className pemberian aplikasi menggantikan nilai
 * default komponen dengan rapi.
 *
 * Contoh:
 *   cn('px-2.5 py-0.5', className)  → className='py-1' menggantikan py-0.5.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
