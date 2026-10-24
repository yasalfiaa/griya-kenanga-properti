// Route Handler: POST /api/pembayaran/buat
// ============================================================
// Membuat sesi pembayaran online (invoice Mayar V2 sandbox) untuk
// satu tagihan. Spesifikasi:
//   1) Semua peran yang login boleh — Penyewa HANYA untuk tagihan
//      miliknya sendiri (kepemilikan dijamin RLS: penyewa hanya bisa
//      membaca tagihan kontraknya, plus cek ganda di server pada
//      fn_simpan_link_mayar). Pengelola/Pemilik/peran dibaca dari
//      tabel public.profiles, bukan dari browser.
//   2) Menerima id tagihan; sisa tagihan (nominal_sewa + denda -
//      terbayar), item, dan data pelanggan diambil dari DATABASE,
//      bukan dari browser. Menolak bila tagihan sudah lunas atau
//      email pelanggan kosong.
//   3) Reuse: bila tagihan sudah punya mayar_link dan mayar_jumlah
//      sama dengan sisa saat ini → kembalikan tautan itu.
//   4) Selain itu: buat invoice di Mayar (MAYAR_API_KEY +
//      MAYAR_BASE_URL dari env), lalu simpan id/tautan/jumlah
//      lewat RPC fn_simpan_link_mayar, dan kembalikan tautannya.
//   5) Batas tunggu 10 detik. Semua pesan error berbahasa Indonesia.
//      Kunci API TIDAK PERNAH ikut dipaparkan ke respons/log klien.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateDenda } from '../../../../src/utils/business-rules';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const MAYAR_API_KEY = process.env.MAYAR_API_KEY ?? '';
const MAYAR_BASE_URL = process.env.MAYAR_BASE_URL ?? 'https://api.mayar.io/hl/v2';
const BATAS_TUNGGU_MS = 10_000;
// Tanggal acuan denda — SAMAR dengan yang dipakai aplikasi
// (src/api/data-service.ts getInvoices) supaya jumlah di Mayar sama
// dengan sisa yang dilihat pengguna di UI.
const TANGGAL_ACUAN_DENDA = '2026-10-15';

function belajarResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

// Klien atas nama PENGIRIM (JWT dari header Authorization) — untuk
// auth, membaca profiles/tagihan/kontrak, dan RPC ber-JWT.
function klienUser(req: NextRequest): SupabaseClient | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return belajarResponse({ message: 'Metode tidak didukung.' }, 405);
  }

  // 0) Klien wajib membawa JWT
  const user = klienUser(req);
  if (!user) {
    return belajarResponse({ message: 'Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.' }, 401);
  }

  // 0b) Validasi id tagihan dari body
  type Body = { tagihan_id?: string; id?: string; tagihanId?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return belajarResponse({ message: 'Format permintaan tidak valid.' }, 400);
  }
  const tagihanId = body.tagihan_id ?? body.id ?? body.tagihanId;
  if (!tagihanId) {
    return belajarResponse({ message: 'ID tagihan wajib disertakan.' }, 400);
  }

  // 1) Verifikasi sesi akun
  const { data: userData, error: userErr } = await user.auth.getUser();
  if (userErr || !userData?.user) {
    return belajarResponse({ message: 'Sesi login berakhir. Silakan masuk kembali.' }, 401);
  }

  // 1b) Peran dibaca dari tabel profiles (bukan JWT/klaim/browser).
  //     Penyewa BOLEH memproses pembayaran, tetapi hanya tagihan miliknya:
  //     RLS menfilter baca tagihan/kontrak miliknya, dan fungsi SQL
  //     fn_simpan_link_mayar memeriksa ulang kepemilikan (server-side).
  const { data: profil, error: profilErr } = await user
    .from('profiles')
    .select('peran')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profilErr) {
    return belajarResponse({ message: 'Gagal memeriksa peran akun. Silakan coba lagi.' }, 500);
  }
  if (!profil || !['penyewa', 'pengelola', 'pemilik'].includes(profil.peran)) {
    return belajarResponse(
      { message: 'Peran akun tidak dikenali. Hubungi Pemilik untuk memperbaiki data profil.' },
      403
    );
  }

  // 2) Ambil tagihan dari DATABASE; denda mengikuti aturan aplikasi
  //    (calculateDenda dengan tanggal acuan — sama seperti UI) supaya
  //    jumlah di Mayar konsisten dengan yang dilihat pengguna.
  const { data: tagihan, error: tagihanErr } = await user
    .from('tagihan')
    .select(
      'id, nomor, kontrak_id, periode, jatuh_tempo, nominal_sewa, denda, terbayar, status, mayar_link, mayar_jumlah, mayar_invoice_id'
    )
    .eq('id', tagihanId)
    .maybeSingle();
  if (tagihanErr || !tagihan) {
    return belajarResponse({ message: 'Tagihan tidak ditemukan.' }, 404);
  }

  const dendaEfektif =
    tagihan.status === 'lunas' ? Number(tagihan.denda) || 0 : calculateDenda(tagihan.jatuh_tempo, TANGGAL_ACUAN_DENDA);
  const sisa = Math.max(
    (Number(tagihan.nominal_sewa) || 0) + dendaEfektif - (Number(tagihan.terbayar) || 0),
    0
  );
  if (tagihan.status === 'lunas' || tagihan.status === 'dibatalkan' || sisa <= 0) {
    return belajarResponse(
      { message: `Tagihan berstatus "${tagihan.status}" dengan sisa Rp${sisa}. Tidak ada yang perlu dibayar online.` },
      400
    );
  }

  // 2b) Data pelanggan dari DATABASE: tagihan → kontrak → penyewa (profiles)
  const { data: kontrak } = await user
    .from('kontrak')
    .select('penyewa_id')
    .eq('id', tagihan.kontrak_id)
    .maybeSingle();
  if (!kontrak?.penyewa_id) {
    return belajarResponse({ message: 'Data penyewa pada kontrak tagihan tidak ditemukan.' }, 500);
  }

  const { data: pelanggan } = await user
    .from('profiles')
    .select('nama_lengkap, email, no_hp')
    .eq('id', kontrak.penyewa_id)
    .maybeSingle();
  if (!pelanggan) {
    return belajarResponse({ message: 'Profil penyewa tidak ditemukan.' }, 500);
  }
  const emailPelanggan = (pelanggan.email ?? '').trim();
  if (!emailPelanggan) {
    return belajarResponse({ message: 'Email pelanggan kosong. Lengkapi email penyewa dulu sebelum bayar online.' }, 400);
  }

  // 3) Reuse: tautan sudah ada dan jumlahnya masih cocok dengan sisa terkini
  const linkTersimpan = (tagihan.mayar_link ?? '').trim();
  const jumlahTersimpan = tagihan.mayar_jumlah == null ? null : Number(tagihan.mayar_jumlah);
  if (linkTersimpan && jumlahTersimpan !== null && jumlahTersimpan === sisa) {
    return belajarResponse(
      {
        link: linkTersimpan,
        nomor: tagihan.nomor,
        sisa,
        mayar_invoice_id: tagihan.mayar_invoice_id ?? null,
        mode: 'existing',
      },
      200
    );
  }

  // 4) Buat invoice baru di Mayar (V2 sandbox/produksi sesuai MAYAR_BASE_URL)
  if (!MAYAR_API_KEY) {
    return belajarResponse(
      { message: 'Pembayaran online belum dikonfigurasi di server (kunci Mayar belum di-set).' },
      503
    );
  }

  const payload = {
    name: (pelanggan.nama_lengkap || 'Penyewa').trim(),
    email: emailPelanggan,
    mobile: (pelanggan.no_hp || '-').trim(),
    description: `Sewa ${tagihan.nomor} periode ${tagihan.periode}`,
    items: [
      {
        quantity: 1,
        rate: (Number(tagihan.nominal_sewa) || 0) - (Number(tagihan.terbayar) || 0),
        description: `Sewa ${tagihan.nomor}`,
      },
      ...(dendaEfektif > 0
        ? [
            {
              quantity: 1,
              rate: dendaEfektif,
              description: 'Denda keterlambatan pembayaran',
            },
          ]
        : []),
    ],
    extraData: {
      tagihan_id: tagihan.id,
      nomor: tagihan.nomor,
    },
  };

  let dataMayar: { id?: string; link?: string; transactionId?: string } | null = null;
  let pesanMayar = '';
  try {
    const resp = await fetch(`${MAYAR_BASE_URL}/invoices/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAYAR_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
    });

    const hasil = (await resp.json().catch(() => null)) as
      | { statusCode?: number; messages?: string; data?: { id?: string; link?: string; transactionId?: string } }
      | null;

    if (!resp.ok || !hasil?.data?.link) {
      pesanMayar = String(hasil?.messages ?? resp.status);
      console.error('Mayar menolak pembuatan invoice:', { status: resp.status, messages: hasil?.messages ?? null });
      return belajarResponse(
        { message: `Gagal membuat invoice di Mayar (kode ${resp.status}). Silakan coba lagi sebentar.` },
        502
      );
    }
    dataMayar = hasil.data;
  } catch (err: unknown) {
    const nama = err instanceof Error ? err.name : '';
    const kodeAbort = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
    if (nama === 'TimeoutError' || kodeAbort === 'ABORT_ERR' || nama === 'AbortError') {
      // Jangan bocorkan detail teknis/kunci; hanya pesan Indonesia.
      console.error('Batas tunggu Mayar 10 detik terlampaui.');
      return belajarResponse(
        { message: 'Mayar tidak merespons dalam 10 detik. Silakan coba lagi sebentar.' },
        504
      );
    }
    console.error('Kesalahan jaringan saat menghubungi Mayar.');
    return belajarResponse(
      { message: 'Tidak dapat menghubungi Mayar. Periksa koneksi server lalu coba lagi.' },
      502
    );
  }

  const mayarInvoiceId = String(dataMayar?.id ?? '');
  const mayarLink = String(dataMayar?.link ?? '');
  if (!mayarInvoiceId || !mayarLink) {
    // PesanMayar fungsional (tidak menyertakan kunci)
    return belajarResponse(
      { message: `Respons Mayar tidak lengkap.${pesanMayar ? ` (${pesanMayar})` : ''}` },
      502
    );
  }

  // 4b) Simpan id/tautan/jumlah via RPC fn_simpan_link_mayar
  //     (di dalam SQL: pengelola/pemilik → semua tagihan; penyewa → hanya
  //     tagihan kontrak miliknya; status lunas/dibatalkan ditolak)
  const { error: simpanErr } = await user.rpc('fn_simpan_link_mayar', {
    p_tagihan_id: tagihan.id,
    p_mayar_invoice_id: mayarInvoiceId,
    p_link: mayarLink,
    p_mayar_jumlah: sisa,
  });
  if (simpanErr) {
    return belajarResponse({ message: simpanErr.message }, 400);
  }

  return belajarResponse(
    {
      link: mayarLink,
      nomor: tagihan.nomor,
      sisa,
      mayar_invoice_id: mayarInvoiceId,
      mode: 'mayar',
    },
    200
  );
}
