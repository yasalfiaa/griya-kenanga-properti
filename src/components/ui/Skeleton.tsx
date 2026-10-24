/**
 * Skeleton — indikator pemuatan berbentuk blok berdenyut (shimmer pulse),
 * pengganti spinner polos bila halaman sedang menunggu data.
 */
import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200', className)} />;
};

/**
 * SkeletonLoadingPage — skeleton layar penuh saat sesi/otentikasi dicek
 * (menggantikan lingkaran spinner di belakang aplikasi).
 */
export const SkeletonLoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidang sidebar */}
      <div className="hidden md:block w-60 border-r border-slate-200 bg-white p-5 space-y-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-3 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
      {/* Sidang konten */}
      <div className="flex-1 p-6 md:p-8 space-y-5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
};
