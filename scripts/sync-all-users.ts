import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function syncAll() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Gagal mengambil data profiles:', error);
    return;
  }

  console.log(`Menyinkronkan ${profiles.length} akun ke Supabase Auth (auth.users)...`);

  let successCount = 0;
  for (const p of profiles) {
    const { error: cErr } = await supabase.auth.admin.createUser({
      id: p.id,
      email: p.email,
      password: 'Latihan#2026',
      email_confirm: true,
      user_metadata: {
        nama_lengkap: p.nama_lengkap,
        no_hp: p.no_hp,
        peran: p.peran,
      },
    });

    if (cErr) {
      if (cErr.message.toLowerCase().includes('already') || cErr.message.toLowerCase().includes('exists')) {
        console.log(`- ${p.email}: Sudah ada di auth.users (dilewati)`);
        successCount++;
      } else {
        console.error(`- ${p.email} Gagal:`, cErr.message);
      }
    } else {
      console.log(`- ${p.email} [${p.peran}]: Berhasil didaftarkan di Supabase Auth`);
      successCount++;
    }
  }

  console.log(`\nSelesai! ${successCount}/${profiles.length} akun terdaftar di Supabase Auth.`);
}

syncAll();
