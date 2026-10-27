import type { Metadata, Viewport } from 'next';
import { Public_Sans } from 'next/font/google';
import '../src/index.css';
import { cn } from '@/lib/utils';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  // Sesuai Kebutuhan Non-Fungsional PRD: Aplikasi Internal, noindex & nofollow
  title: 'Griya Kenanga Residence - Sistem Manajemen Properti',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={cn('font-sans', publicSans.variable)}>
      {/* Pengarsipan warna via token preset (bg-muted/50 → bergaya token di halaman-halaman root) */}
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
