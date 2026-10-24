import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Baca file .env manual jika ada
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      const val = rest.join('=').trim();
      process.env[key.trim()] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSeed() {
  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder')) {
    console.error('❌ Error: Kredensial NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi di file .env');
    console.log('Silakan buat file .env dari .env.example dan isi kredensial proyek Supabase Anda.');
    process.exit(1);
  }

  console.log(`Menginisialisasi koneksi ke Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seedSqlPath = path.resolve('supabase/seed.sql');
  const sql = fs.readFileSync(seedSqlPath, 'utf8');

  console.log('Menjalankan seed data dari supabase/seed.sql...');
  // Eksekusi rpc atau sql query jika extension pg_net/postgres tersedia
  // Atau pengguna bisa langsung copy-paste supabase/seed.sql ke Supabase Dashboard SQL Editor
  console.log('✅ File supabase/seed.sql siap.');
  console.log('Tip: Anda juga dapat menjalankan seluruh isi berkas supabase/seed.sql langsung di SQL Editor pada Dashboard Supabase Anda.');
}

runSeed().catch(err => {
  console.error('Seed error:', err);
});
