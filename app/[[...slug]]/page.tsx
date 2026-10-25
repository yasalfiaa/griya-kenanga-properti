'use client';

import dynamic from 'next/dynamic';

// Aplikasi ini di-migrate dari Vite (SPA dengan React Router).
// Entry point lama: src/main.tsx + index.html.
// Seluruh routing tetap ditangani react-router-dom di dalam <App />,
// dan catch-all route [[...slug]] memastikan setiap URL di-render
// oleh shell ini tanpa perlu file page.tsx per halaman.
//
// ssr: false diperlukan karena BrowserRouter membutuhkan window
// (browser-only), sehingga komponen App hanya di-render di sisi client.
const App = dynamic(() => import('../../src/App').then((m) => m.App), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <p className="text-muted-foreground">Memuat aplikasi...</p>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
