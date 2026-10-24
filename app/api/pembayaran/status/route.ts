// Route Handler: GET /api/pembayaran/status
// ============================================================
// Info status Payment Gateway UNTUK HALAMAN /setelan (khusus Pemilik).
// TIDAK mengembalikan nilai kunci apa pun — hanya boolean/enum:
//   terhubung   : MAYAR_API_KEY tersedia di env server
//   secret_siap : SUPABASE_SECRET_KEY tersedia (untuk webhook)
//   mode        : 'sandbox' (MAYAR_BASE_URL memuat mayar.io) | 'produksi'
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ message: 'Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.' }, { status: 401 });
  }

  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await user.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ message: 'Sesi login berakhir. Silakan masuk kembali.' }, { status: 401 });
  }

  // Bagian ini khusus Pemilik — peran dibaca dari tabel profiles
  const { data: profil } = await user
    .from('profiles')
    .select('peran')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profil || profil.peran !== 'pemilik') {
    return NextResponse.json(
      { message: 'Halaman setelan pembayaran hanya untuk Pemilik.' },
      { status: 403 }
    );
  }

  const baseUrl = process.env.MAYAR_BASE_URL ?? '';
  return NextResponse.json({
    terhubung: Boolean(process.env.MAYAR_API_KEY),
    secret_siap: Boolean(process.env.SUPABASE_SECRET_KEY),
    // Sandbox memakai domain api.mayar.io; produksi api.mayar.id
    mode: baseUrl.includes('mayar.io') ? 'sandbox' : 'produksi',
    webhook_path: '/api/webhook/mayar',
  });
}
