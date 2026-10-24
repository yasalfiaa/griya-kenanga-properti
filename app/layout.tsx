import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../src/index.css';

// Font Inter dipindahkan dari <link> Google Fonts di index.html (Vite)
// ke next/font agar self-hosted dan tanpa layout shift.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

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
    <html lang="id">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
