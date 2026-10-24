// Route Handler: POST /api/pembayaran/cek
// ============================================================
// Pemeriksaan status pembayaran untuk DUKUNGAN DEV LOKAL:
// Modul ini "menarik" status dari Mayar saat UI memantau tagihan.
// (Webhook dari Mayar tidak bisa menjangkau localhost, sehingga
// keputusan akhir diambil dengan pola kepercayaan yang SAMA seperti
// webhook: TIDAK percaya klaim klien — tanyakan ulang detail invoice
// ke Mayar dengan MAYAR_API_KEY, lalu tandai lunas lewat
// fn_tandai_lunas_mayar hanya bila status "paid" dan jumlah cocok.)
//
// Sama seperti /api/pembayaran/buat:
//   • Penyewa hanya untuk tagihan miliknya (RLS menfilter bacanya;
//     staf menjangkau semua).
//   • Klien service (SUPABASE_SECRET_KEY) TIDAK PERNAH keluar dari
//     server; tidak pernah ikut bundle browser.
//   • Selalu informatif & berbahasa Indonesia tanpa memaparkan kunci.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? '';
const MAYAR_API_KEY = process.env.MAYAR_API_KEY ?? '';
const MAYAR_BASE_URL = process.env.MAYAR_BASE_URL ?? 'https://api.mayar.io/hl/v2';
const BATAS_TUNGGU_MS = 10_000;

function klienUser(req: NextRequest): SupabaseClient | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

// Klien service-role untuk RPC fn_tandai_lunas_mayar (service_role only).
function klienService(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const user = klienUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.' }, { status: 401 });
  }

  type Body = { tagihan_id?: string; id?: string; tagihanId?: string };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: 'Format permintaan tidak valid.' }, { status: 400 });
  }
  const tagihanId = body.tagihan_id ?? body.id ?? body.tagihanId;
  if (!tagihanId) {
    return NextResponse.json({ message: 'ID tagihan wajib disertakan.' }, { status: 400 });
  }

  const { data: userData, error: userErr } = await user.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ message: 'Sesi login berakhir. Silakan masuk kembali.' }, { status: 401 });
  }

  // Tagihan dibaca dengan JWT pemanggil (RLS: penyewa hanya miliknya)
  const { data: tagihan, error: tagihanErr } = await user
    .from('tagihan')
    .select('id, nomor, status, mayar_invoice_id, mayar_jumlah, dibayar_online_at')
    .eq('id', tagihanId)
    .maybeSingle();
  if (tagihanErr || !tagihan) {
    return NextResponse.json({ message: 'Tagihan tidak ditemukan.' }, { status: 404 });
  }

  // Sudah lunas → langsung kabari tanpa menyentuh Mayar
  if (tagihan.status === 'lunas') {
    return NextResponse.json(
      {
        lunas: true,
        status: 'lunas',
        nomor: tagihan.nomor,
        dibayar_online_at: tagihan.dibayar_online_at ?? null,
      },
      { status: 200 }
    );
  }

  // Tanpa invoice Mayar → belum ada tautan yang dibayar; bukan kegagalan
  if (!tagihan.mayar_invoice_id || tagihan.mayar_jumlah == null) {
    return NextResponse.json({ lunas: false, nomor: tagihan.nomor }, { status: 200 });
  }

  if (!MAYAR_API_KEY) {
    return NextResponse.json(
      { message: 'Pembayaran online belum dikonfigurasi di server (kunci Mayar belum di-set).' },
      { status: 503 }
    );
  }

  // Sumber kebenaran: tanyakan ulang detail invoice ke Mayar
  let detail: { status?: string; amount?: number; transactionId?: string } | null = null;
  let alasan = '';
  try {
    const resp = await fetch(
      `${MAYAR_BASE_URL}/invoices/${encodeURIComponent(String(tagihan.mayar_invoice_id))}`,
      {
        headers: { Authorization: `Bearer ${MAYAR_API_KEY}`, accept: 'application/json' },
        signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
      }
    );
    const hasil = (await resp.json().catch(() => null)) as
      | { statusCode?: number; messages?: string; data?: { status?: string; amount?: number; transactionId?: string } }
      | null;
    if (resp.ok && hasil?.statusCode === 200 && hasil.data) {
      detail = hasil.data;
    } else {
      alasan = `Mayar memberi kode ${resp.status}${hasil?.messages ? `: ${hasil.messages}` : ''}`;
    }
  } catch (err: unknown) {
    const nama = err instanceof Error ? err.name : '';
    const kodeAbort = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
    alasan =
      nama === 'TimeoutError' || kodeAbort === 'ABORT_ERR' || nama === 'AbortError'
        ? 'Mayar tidak merespons dalam 10 detik.'
        : 'Tidak dapat menghubungi Mayar.';
  }

  if (!detail) {
    return NextResponse.json({ lunas: false, nomor: tagihan.nomor, catatan: alasan }, { status: 200 });
  }

  // Wajib "paid" di sumber kebenaran DAN jumlah sama dengan mayar_jumlah
  const jumlahMayar = Number(detail.amount ?? NaN);
  const jumlahInternal = Number(tagihan.mayar_jumlah);
  const jumlahCocok = Number.isFinite(jumlahMayar) && jumlahMayar === jumlahInternal;

  let sudahPaid = detail.status === 'paid' && jumlahCocok;

  // Sumber kedua: bila invoice masih "unpad"/antri, periksa transaksi
  // utamanya. Kasus nyata di sandbox: transaksi selesai (paid) tapi
  // status invoice terasa lambat berubah — keduanya tetap data resmi
  // dari API Mayar (server-to-server), jangan dari klaim browser.
  let statusSumber = detail.status === 'paid' ? 'invoice' : 'transaksi';
  if (!sudahPaid && detail.transactionId) {
    try {
      const respTx = await fetch(
        `${MAYAR_BASE_URL}/transactions/${encodeURIComponent(String(detail.transactionId))}`,
        {
          headers: { Authorization: `Bearer ${MAYAR_API_KEY}`, accept: 'application/json' },
          signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
        }
      );
      const hasilTx = (await respTx.json().catch(() => null)) as
        | { statusCode?: number; data?: { status?: string; amount?: number } }
        | null;
      if (respTx.ok && hasilTx?.statusCode === 200 && hasilTx.data) {
        const jumlahTx = Number(hasilTx.data.amount ?? NaN);
        if (hasilTx.data.status === 'paid' && Number.isFinite(jumlahTx) && jumlahTx === jumlahInternal) {
          sudahPaid = true;
          statusSumber = 'transaksi';
        }
      }
    } catch {
      // kegagalan sumber kedua tidak fatal — coba lagi pada tick berikutnya
    }
  }

  if (!sudahPaid) {
    return NextResponse.json(
      {
        lunas: false,
        nomor: tagihan.nomor,
        status_mayar: detail.status ?? null,
        catatan:
          detail.status !== 'paid'
            ? `Status di Mayar: "${detail.status ?? 'tidak diketahui'}" (transaksi: ${statusSumber}).`
            : `Jumlah tidak cocok: Mayar Rp${jumlahMayar} vs mayar_jumlah Rp${jumlahInternal}.`,
      },
      { status: 200 }
    );
  }

  // Paid + cocok → tandai lunas hanya lewat fn_tandai_lunas_mayar (service_role)
  const service = klienService();
  if (!service) {
    return NextResponse.json(
      { message: 'Kunci secret server belum dikonfigurasi; pelunasan tidak dapat dicatat.' },
      { status: 503 }
    );
  }

  const { error: rpcErr } = await service.rpc('fn_tandai_lunas_mayar', {
    p_mayar_invoice_id: String(tagihan.mayar_invoice_id),
  });
  if (rpcErr) {
    return NextResponse.json(
      { message: `Pelunasan gagal dicatat: ${rpcErr.message}` },
      { status: 500 }
    );
  }

  // Keputusan dari DAMPAK nyata di database (bukan dari bentuk hasil RPC —
  // PostgREST bisa mengembalikan bentuk tak terduga walau SQL-nya sukses).
  const { data: setelah } = await user
    .from('tagihan')
    .select('status, dibayar_online_at')
    .eq('id', tagihan.id)
    .maybeSingle();
  if (!setelah) {
    return NextResponse.json(
      { lunas: false, nomor: tagihan.nomor, catatan: 'Tagihan tak terbaca setelah penandaan pelunasan; coba lagi nanti.' },
      { status: 200 }
    );
  }

  const waktu = setelah.dibayar_online_at ?? null;
  if (!waktu && setelah.status !== 'lunas') {
    return NextResponse.json(
      { lunas: false, nomor: tagihan.nomor, status_mayar: 'paid', catatan: `Pelunasan tidak dapat dipastikan: tagihan berstatus "${setelah.status}".` },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      lunas: setelah.status === 'lunas',
      // Pelunasan TERCATAT walau tagihan belum 'lunas' (mis. pembayaran parsial
      // → status "sebagian", sisa masih ada).
      tercatat: true,
      status: setelah.status,
      nomor: tagihan.nomor,
      dibayar_online_at: waktu,
      pesan:
        setelah.status === 'lunas'
          ? `Pembayaran online terkonfirmasi — tagihan ${tagihan.nomor} berstatus Lunas.`
          : `Pembayaran online tercatat — tagihan ${tagihan.nomor} berstatus "${setelah.status}" (masih ada sisa).`,
    },
    { status: 200 }
  );
}
