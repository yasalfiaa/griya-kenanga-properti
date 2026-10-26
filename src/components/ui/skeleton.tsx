import * as React from "react"
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/**
 * SkeletonLoadingPage — skeleton layar penuh saat sesi/otentikasi dicek
 * (dipakai oleh src/App.tsx), langkah Fase 1 pembenahan UI yang dipertahankan.
 */
export const SkeletonLoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Siluet sidebar */}
      <div className="hidden md:block w-60 border-r border-border bg-sidebar p-5 space-y-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-3 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
      {/* Siluet konten */}
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

export { Skeleton }
