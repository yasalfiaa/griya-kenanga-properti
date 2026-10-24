import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env
const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log('--- VERIFIKASI BASIS DATA SUPABASE LANGSUNG ---');
console.log('Project URL:', url);

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyAll() {
  const tables = [
    'profiles',
    'identitas_penyewa',
    'unit',
    'kontrak',
    'tagihan',
    'pembayaran',
    'laporan_kerusakan',
    'nomor_urut',
    'audit_log',
  ];

  console.log('\n1. Memeriksa 9 Tabel Inti di Supabase:');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Tabel ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`✅ Tabel ${table}: ${count} baris data ditemukan.`);
    }
  }

  console.log('\n2. Memeriksa Sampel Data Unit:');
  const { data: units } = await supabase.from('unit').select('kode, lantai, tipe, harga_sewa_bulanan, status').order('kode').limit(5);
  console.log(units);

  console.log('\n3. Memeriksa Sampel Akun Pemilik & Pengelola:');
  const { data: staff } = await supabase.from('profiles').select('nama_lengkap, email, peran').in('peran', ['pemilik', 'pengelola']);
  console.log(staff);

  console.log('\n4. Memeriksa Bucket Storage:');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log('Storage buckets check note:', bErr.message);
  } else {
    console.log('Buckets ditemukan:', buckets.map(b => `${b.name} (public: ${b.public})`));
  }
}

verifyAll().catch(e => console.error('Verification error:', e));
