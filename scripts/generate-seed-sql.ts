import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('Data_Contoh_Properti.xlsx');
const workbook = readFile(filePath);

function escapeSql(val: any): string {
  if (val === null || val === undefined || val === '') return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function escapeJson(val: any): string {
  if (!val) return 'NULL';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  const str = String(val).replace(/'/g, "''");
  return `'${str}'::jsonb`;
}

function escapeTextArray(val: any): string {
  if (!val) return "'{}'::text[]";
  const items = String(val).split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return "'{}'::text[]";
  const escaped = items.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',');
  return `'{${escaped}}'::text[]`;
}

let sql = `-- ====================================================================
-- SEED DATA GRIYA KENANGA RESIDENCE
-- Dihasilkan dari Data_Contoh_Properti.xlsx
-- Tanggal Acuan Sistem: 15 Oktober 2026
-- ====================================================================

-- 1. BERSIHKAN DATA LAMA JIKA ADA (CASCADE)
TRUNCATE TABLE public.audit_log, public.pembayaran, public.tagihan, public.laporan_kerusakan, public.kontrak, public.identitas_penyewa, public.profiles, public.unit, public.nomor_urut RESTART IDENTITY CASCADE;

`;

// 1. PROFILES
const profiles = utils.sheet_to_json(workbook.Sheets['profiles']) as any[];
sql += `-- PROFILES (${profiles.length} baris)\n`;
sql += `INSERT INTO public.profiles (id, nama_lengkap, email, no_hp, peran, aktif, dibuat_pada) VALUES\n`;
sql += profiles.map(p => `(${escapeSql(p.id)}, ${escapeSql(p.nama_lengkap)}, ${escapeSql(p.email)}, ${escapeSql(p.no_hp)}, ${escapeSql(p.peran)}, ${p.aktif === 'true' || p.aktif === true ? 'TRUE' : 'FALSE'}, ${escapeSql(p.dibuat_pada)})`).join(',\n') + ';\n\n';

// 2. IDENTITAS_PENYEWA
const identitas = utils.sheet_to_json(workbook.Sheets['identitas_penyewa']) as any[];
sql += `-- IDENTITAS_PENYEWA (${identitas.length} baris)\n`;
sql += `INSERT INTO public.identitas_penyewa (penyewa_id, nik, alamat_asal, foto_ktp_path, kontak_darurat_nama, kontak_darurat_hp, status_verifikasi, diverifikasi_oleh, diverifikasi_pada) VALUES\n`;
sql += identitas.map(i => `(${escapeSql(i.penyewa_id)}, ${escapeSql(i.nik)}, ${escapeSql(i.alamat_asal)}, ${escapeSql(i.foto_ktp_path)}, ${escapeSql(i.kontak_darurat_nama)}, ${escapeSql(i.kontak_darurat_hp)}, ${escapeSql(i.status_verifikasi)}, ${escapeSql(i.diverifikasi_oleh)}, ${escapeSql(i.diverifikasi_pada)})`).join(',\n') + ';\n\n';

// 3. UNIT
const units = utils.sheet_to_json(workbook.Sheets['unit']) as any[];
sql += `-- UNIT (${units.length} baris)\n`;
sql += `INSERT INTO public.unit (id, kode, lantai, tipe, luas_m2, harga_sewa_bulanan, status) VALUES\n`;
sql += units.map(u => `(${escapeSql(u.id)}, ${escapeSql(u.kode)}, ${u.lantai}, ${escapeSql(u.tipe)}, ${u.luas_m2}, ${u.harga_sewa_bulanan}, ${escapeSql(u.status)})`).join(',\n') + ';\n\n';

// 4. KONTRAK
const kontrak = utils.sheet_to_json(workbook.Sheets['kontrak']) as any[];
sql += `-- KONTRAK (${kontrak.length} baris)\n`;
sql += `INSERT INTO public.kontrak (id, nomor, unit_id, penyewa_id, tanggal_mulai, durasi_bulan, tanggal_selesai, harga_sewa_bulanan, status, dibuat_oleh, dibuat_pada) VALUES\n`;
sql += kontrak.map(k => `(${escapeSql(k.id)}, ${escapeSql(k.nomor)}, ${escapeSql(k.unit_id)}, ${escapeSql(k.penyewa_id)}, ${escapeSql(k.tanggal_mulai)}, ${k.durasi_bulan}, ${escapeSql(k.tanggal_selesai)}, ${k.harga_sewa_bulanan}, ${escapeSql(k.status)}, ${escapeSql(k.dibuat_oleh)}, ${escapeSql(k.dibuat_pada)})`).join(',\n') + ';\n\n';

// 5. TAGIHAN
const tagihan = utils.sheet_to_json(workbook.Sheets['tagihan']) as any[];
sql += `-- TAGIHAN (${tagihan.length} baris)\n`;
sql += `INSERT INTO public.tagihan (id, nomor, kontrak_id, periode, jatuh_tempo, nominal_sewa, denda, terbayar, status, dibuat_pada) VALUES\n`;
sql += tagihan.map(t => `(${escapeSql(t.id)}, ${escapeSql(t.nomor)}, ${escapeSql(t.kontrak_id)}, ${escapeSql(t.periode)}, ${escapeSql(t.jatuh_tempo)}, ${t.nominal_sewa}, ${t.denda || 0}, ${t.terbayar || 0}, ${escapeSql(t.status)}, ${escapeSql(t.dibuat_pada)})`).join(',\n') + ';\n\n';

// 6. PEMBAYARAN
const pembayaran = utils.sheet_to_json(workbook.Sheets['pembayaran']) as any[];
sql += `-- PEMBAYARAN (${pembayaran.length} baris)\n`;
sql += `INSERT INTO public.pembayaran (id, tagihan_id, jumlah, metode, tanggal_bayar, status, dicatat_oleh, dibuat_pada) VALUES\n`;
sql += pembayaran.map(p => `(${escapeSql(p.id)}, ${escapeSql(p.tagihan_id)}, ${p.jumlah}, ${escapeSql(p.metode)}, ${escapeSql(p.tanggal_bayar)}, ${escapeSql(p.status)}, ${escapeSql(p.dicatat_oleh)}, ${escapeSql(p.dibuat_pada)})`).join(',\n') + ';\n\n';

// 7. LAPORAN_KERUSAKAN
const kerusakan = utils.sheet_to_json(workbook.Sheets['laporan_kerusakan']) as any[];
sql += `-- LAPORAN_KERUSAKAN (${kerusakan.length} baris)\n`;
sql += `INSERT INTO public.laporan_kerusakan (id, nomor, kontrak_id, unit_id, pelapor_id, kategori, judul, deskripsi, foto_paths, status, estimasi_biaya, biaya_aktual, selesai_pada, dibuat_pada) VALUES\n`;
sql += kerusakan.map(lk => `(${escapeSql(lk.id)}, ${escapeSql(lk.nomor)}, ${escapeSql(lk.kontrak_id)}, ${escapeSql(lk.unit_id)}, ${escapeSql(lk.pelapor_id)}, ${escapeSql(lk.kategori)}, ${escapeSql(lk.judul)}, ${escapeSql(lk.deskripsi)}, ${escapeTextArray(lk.foto_paths)}, ${escapeSql(lk.status)}, ${lk.estimasi_biaya || 'NULL'}, ${lk.biaya_aktual || 'NULL'}, ${escapeSql(lk.selesai_pada)}, ${escapeSql(lk.dibuat_pada)})`).join(',\n') + ';\n\n';

// 8. NOMOR_URUT
const nomorUrut = utils.sheet_to_json(workbook.Sheets['nomor_urut']) as any[];
sql += `-- NOMOR_URUT (${nomorUrut.length} baris)\n`;
sql += `INSERT INTO public.nomor_urut (jenis, periode, terakhir) VALUES\n`;
sql += nomorUrut.map(nu => `(${escapeSql(nu.jenis)}, ${escapeSql(nu.periode)}, ${nu.terakhir})`).join(',\n') + ';\n\n';

// 9. AUDIT_LOG
const audit = utils.sheet_to_json(workbook.Sheets['audit_log']) as any[];
sql += `-- AUDIT_LOG (${audit.length} baris)\n`;
sql += `INSERT INTO public.audit_log (id, pelaku_id, peran, aksi, tabel, data_id, sebelum, sesudah, dibuat_pada) VALUES\n`;
sql += audit.map(a => `(${a.id}, ${escapeSql(a.pelaku_id)}, ${escapeSql(a.peran)}, ${escapeSql(a.aksi)}, ${escapeSql(a.tabel)}, ${escapeSql(a.data_id)}, ${escapeJson(a.sebelum)}, ${escapeJson(a.sesudah)}, ${escapeSql(a.dibuat_pada)})`).join(',\n') + ';\n\n';

fs.writeFileSync(path.resolve('supabase/seed.sql'), sql, 'utf8');
console.log('Seed SQL file successfully generated at supabase/seed.sql');
