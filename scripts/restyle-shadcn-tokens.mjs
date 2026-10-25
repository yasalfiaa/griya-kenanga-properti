/**
 * restyle-shadcn-tokens.mjs — pemetaan sekali-jalan class Tailwind hard-coded
 * ke token theme shadcn preset (baseColor "mist", primary biru).
 *
 * Hanya menyentuh string class di file .tsx; tidak menyentuh logika apa pun.
 * Warna STATUS semantik sengaja dipertahankan: amber, rose, blue, purple,
 * indigo (bayar online), serta emerald-50/100/200/800 (status sukses:
 * lunas/aktif/terverifikasi/tersedia) — itu bukan warna tema.
 * File Badge.tsx dikecualikan (badge status pakai palet semantik).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Pola dipisah agar import dinamis tanpa pakek dep: pakai manual walk.
function walk(dir, acc = []) {
  for (const entry of globSync('**/*.tsx', { cwd: dir })) {
    acc.push(path.join(dir, entry));
  }
  return acc;
}

const files = [
  ...walk(path.join(root, 'src')),
  ...walk(path.join(root, 'app')),
].filter((f) => !f.endsWith('src\\components\\ui\\Badge.tsx'));

// Urutan penting: pattern bertumpuk (dengan opasitas / gradasi) lebih dulu,
// lalu pola netral slate dari gelap → terang.
const COMMON_MAP = [
  // --- Pola khusus bertumpuk ---
  ['bg-slate-50/70', 'bg-muted/60'],
  ['from-emerald-600 to-teal-500', 'from-primary to-primary/70'],
  ['from-emerald-700 to-teal-800', 'from-primary to-primary/70'],
  ['shadow-emerald-200', 'shadow-primary/20'],

  // --- Brand emerald (interaktif/aksen) → token primary ---
  ['bg-emerald-600', 'bg-primary'],
  ['hover:bg-emerald-700', 'hover:bg-primary/90'],
  ['bg-emerald-700', 'bg-primary/90'],
  ['text-emerald-600', 'text-primary'],
  ['text-emerald-700', 'text-primary'],

  // --- Fokus input → token ring ---
  ['focus:ring-emerald-500', 'focus:ring-ring'],

  // --- Netral slate → token theme (gelap → terang) ---
  ['bg-slate-900', 'bg-foreground'],
  ['bg-slate-200', 'bg-border'],
  ['bg-slate-100', 'bg-muted'],
  ['bg-slate-50', 'bg-muted/50'],
  ['text-slate-900', 'text-foreground'],
  ['text-slate-800', 'text-foreground'],
  ['text-slate-700', 'text-foreground'],
  ['text-slate-600', 'text-muted-foreground'],
  ['text-slate-500', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
  ['text-slate-300', 'text-muted-foreground'],
  ['text-slate-200', 'text-border'],
  ['divide-slate-100', 'divide-border'],
  ['divide-slate-200', 'divide-border'],
  ['border-slate-300', 'border-border'],
  ['border-slate-200', 'border-border'],
  ['border-slate-100', 'border-border'],
];

let totalReplacements = 0;
const report = [];

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const before = src;
  const rel = path.relative(root, file).replaceAll('\\', '/');
  let count = 0;

  for (const [from, to] of COMMON_MAP) {
    const parts = src.split(from);
    if (parts.length > 1) {
      count += parts.length - 1;
      src = parts.join(to);
    }
  }

  // Permukaan putih: Navbar & Sidebar pakai token sidebar; kartu lain bg-card.
  const isNavFile = /\/(Navbar|Sidebar)\.tsx$/.test(rel);
  const whiteTo = isNavFile ? 'bg-sidebar' : 'bg-card';
  const whiteParts = src.split('bg-white');
  if (whiteParts.length > 1) {
    count += whiteParts.length - 1;
    src = whiteParts.join(whiteTo);
  }

  if (src !== before) {
    writeFileSync(file, src);
    totalReplacements += count;
    report.push(`${rel}: ${count} penggantian`);
  }
}

console.log(`Total penggantian: ${totalReplacements} di ${report.length} file`);
for (const line of report) console.log(' -', line);
