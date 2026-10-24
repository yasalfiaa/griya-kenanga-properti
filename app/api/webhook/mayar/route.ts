// Route Handler: POST /api/webhook/mayar
// ============================================================
// Menerima POST dari Mayar (event payment.received dsb.).
// Spesifikasi:
//   1) CATAT setiap pesan ke public.mayar_webhook_log (payload utuh).
//   2) JANGAN percaya isi pesan. Ambil kandidat id invoice dari
//      payload lalu TANYA ULANG detailnya ke Mayar memakai
//      MAYAR_API_KEY (GET /invoices/{id}) — id yang ada di detail
//      Mayar-lah yang dianggap benar.
//   3) HANYA bila status di Mayar sudah "paid" DAN tagihan ada di
//      database internal dengan jumlah yang SAMA dengan mayar_jumlah,
//      panggil RPC fn_tandai_lunas_mayar (service_role).
//   4) Klien Supabase dengan kunci SECRET dibuat HANYA di file ini
//      (tanpa NEXT_PUBLIC_) — variabel env SUPABASE_SECRET_KEY.
//   5) SELALU membalas 200 dengan cepat; hasil pemeriksaan
//      ('diterima' atau 'ditolak' + alasan) disimpan di log.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? '';
const MAYAR_API_KEY = process.env.MAYAR_API_KEY ?? '';
const MAYAR_BASE_URL = process.env.MAYAR_BASE_URL ?? 'https://api.mayar.io/hl/v2';
const BATAS_TUNGGU_MS = 10_000;

// Klien service-role single virtual di file ini saja:
// melewati RLS untuk INSERT/update mayar_webhook_log dan memanggil
// fn_tandai_lunas_mayar (yang memang hanya untuk service_role).
function klienService(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Kandidat id invoice dari payload webhook — PESAN TIDAK DIPERCAYA,
// semua kandidat akan diverifikasi ulang ke Mayar sebelum aksi apa pun.
function kandidatIdInvoice(payload: Record<string, unknown>): string[] {
  const d = (payload?.data ?? payload) as Record<string, unknown> | undefined;
  const nilai: Array<unknown> = [
    d?.paymentLinkId,
    d?.invoice_id,
    d?.invoiceId,
    d?.transactionId,
    d?.id,
    (payload as Record<string, unknown> | undefined)?.id,
  ];
  const hasil: string[] = [];
  for (const n of nilai) {
    const s = n == null ? '' : String(n);
    if (s.trim() && !hasil.includes(s.trim())) hasil.push(s.trim());
  }
  return hasil.slice(0, 4); // batasi 4 kandidat agar eksekusi tetap cepat
}

async function tanyaDetailMayar(id: string): Promise<
  { ok: true; data: { id?: string; status?: string; amount?: number } } | { ok: false; kode: number | 'timeout' | 'db' }
> {
  try {
    const resp = await fetch(`${MAYAR_BASE_URL}/invoices/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${MAYAR_API_KEY}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
    });
    const hasil = (await resp.json().catch(() => null)) as
      | { statusCode?: number; messages?: string; data?: { id?: string; status?: string; amount?: number } }
      | null;
    if (resp.ok && hasil?.statusCode === 200 && hasil.data) return { ok: true, data: hasil.data };
    return { ok: false, kode: resp.status };
  } catch (err: unknown) {
    const nama = err instanceof Error ? err.name : '';
    const kodeAbort = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
    if (nama === 'TimeoutError' || kodeAbort === 'ABORT_ERR' || nama === 'AbortError') return { ok: false, kode: 'timeout' };
    console.error('Gagal menghubungi Mayar (detail invoice).');
    return { ok: false, kode: 'db' };
  }
}

export async function POST(req: NextRequest) {
  let logId: string | null = null;
  // Cukup satu pasangan (baca payload → klien service → verifikasi → update log),
  // dibungkus try/catch agar SELALU membalas 200.
  try {
    const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const event = String((payload as { event?: { received?: string } } | null)?.event?.received ?? '').trim();
    const kandidat = payload ? kandidatIdInvoice(payload) : [];

    // Klien service dibuat di file ini
    const service = klienService();
    if (!service) {
      // Tidak bisa menulis log tanpa kunci → cukup balas 200 agar Mayar tidak retry tanpa akhir.
      console.error('SUPABASE_SECRET_KEY belum di-set; webhook dilewati tanpa log.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 1) Catat setiap pesan ke mayar_webhook_log (payload utuh)
    const { data: logRow, error: logErr } = await service
      .from('mayar_webhook_log')
      .insert({
        event: event || null,
        mayar_invoice_id: kandidat[0] ?? null,
        status_terjawab: null,         // diisi ulang setelah pemeriksaan
        payload: payload ?? {},
        catatan: null,
      })
      .select('id')
      .single();
    if (!logErr && logRow) logId = (logRow as { id: string }).id;

    const finalisasiLog = async (
      status: string,
      catatan: string,
      mayarInvoiceId?: string | null,
      tagihanId?: string | null
    ) => {
      if (!logId) return;
      await service
        .from('mayar_webhook_log')
        .update({
          status_terjawab: status,
          catatan,
          ...(mayarInvoiceId !== undefined ? { mayar_invoice_id: mayarInvoiceId } : {}),
          ...(tagihanId !== undefined ? { tagihan_id: tagihanId } : {}),
        })
        .eq('id', logId);
    };

    // Filter aksi: hanya event pembayaran yang diproses
    if (event && event !== 'payment.received') {
      await finalisasiLog('dilewati', `Event "${event}" tidak diproses.`);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (kandidat.length === 0) {
      await finalisasiLog('ditolak', 'Payload tidak memuat kandidat id invoice.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (!MAYAR_API_KEY) {
      await finalisasiLog('ditolak', 'Kunci Mayar belum dikonfigurasi di server.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 2) Jangan percaya isi pesan → tanya ulang detail ke Mayar
    let detail: { id?: string; status?: string; amount?: number } | null = null;
    let alasanVerifikasi = '';
    for (const id of kandidat) {
      const cek = await tanyaDetailMayar(id);
      if (cek.ok) {
        detail = cek.data;
        break;
      }
      if (cek.kode === 'timeout') {
        alasanVerifikasi = 'Mayar tidak merespons dalam 10 detik.';
        break;
      }
      if (cek.kode === 404) continue; // coba kandidat berikutnya
      alasanVerifikasi = `Mayar memberi kode ${cek.kode} saat verifikasi detail.`;
      break;
    }

    if (!detail) {
      await finalisasiLog(
        'ditolak',
        alasanVerifikasi || 'ID tidak dapat diverifikasi di Mayar (404 pada semua kandidat).',
        kandidat[0] ?? null
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const idDitegaskan = String(detail.id ?? '').trim();
    if (!idDitegaskan) {
      await finalisasiLog('ditolak', 'Detail Mayar tidak memuat id invoice.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 3) Wajib status di sumber kebenaran (detail Mayar) = paid
    if (detail.status !== 'paid') {
      await finalisasiLog(
        'ditolak',
        `Status di Mayar adalah "${detail.status ?? 'tidak diketahui'}", bukan "paid".`,
        idDitegaskan
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Tagihan harus ada di database internal DAN jumlah cocok dengan mayar_jumlah
    const { data: tagihan } = await service
      .from('tagihan')
      .select('id, nomor, status, mayar_jumlah')
      .eq('mayar_invoice_id', idDitegaskan)
      .maybeSingle();

    if (!tagihan) {
      await finalisasiLog('ditolak', 'Invoice paid di Mayar tapi tidak dikenali di tagihan internal.', idDitegaskan);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const jumlahMayar = Number(detail.amount ?? NaN);
    const jumlahInternal = tagihan.mayar_jumlah == null ? NaN : Number(tagihan.mayar_jumlah);
    if (!Number.isFinite(jumlahMayar) || !Number.isFinite(jumlahInternal) || jumlahMayar !== jumlahInternal) {
      await finalisasiLog(
        'ditolak',
        `Jumlah tidak cocok: Mayar ${Number.isFinite(jumlahMayar) ? jumlahMayar : 'tidak diketahui'} vs mayar_jumlah ${
          Number.isFinite(jumlahInternal) ? jumlahInternal : 'kosong'
        }.`,
        idDitegaskan,
        tagihan.id
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 3b) Semua seleksi lolos → pelunasan hanya lewat fn_tandai_lunas_mayar (service_role)
    const { data: hasilRPC, error: rpcErr } = await service.rpc('fn_tandai_lunas_mayar', {
      p_mayar_invoice_id: idDitegaskan,
    });
    if (rpcErr) {
      await finalisasiLog('ditolak', `Panggilan fn_tandai_lunas_mayar gagal: ${rpcErr.message}`, idDitegaskan, tagihan.id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const baris = Array.isArray(hasilRPC) ? hasilRPC[0] : hasilRPC;
    const statusFungsi = String((baris as { out_status?: string } | null)?.out_status ?? '');
    const nomor = String((baris as { out_nomor?: string } | null)?.out_nomor ?? '');
    const jumlah = (baris as { out_jumlah?: number | null } | null)?.out_jumlah ?? null;

    if (statusFungsi === 'dicatat' || statusFungsi === 'duplikat') {
      // diterima: tercatat baru, atau sudah tercatat sebelumnya (webhook ulang)
      await finalisasiLog(
        'diterima',
        statusFungsi === 'dicatat'
          ? `Pembayaran dicatat: ${nomor} sebesar Rp${jumlah ?? jumlahInternal}.`
          : `Sudah pernah tercatat (webhook ulang): ${nomor}.`,
        idDitegaskan,
        tagihan.id
      );
    } else if (statusFungsi === 'sudah_lunas') {
      await finalisasiLog('diterima', `Tagihan ${nomor} sudah lunas sebelumnya; dibayar_online_at dipastikan.`, idDitegaskan, tagihan.id);
    } else {
      await finalisasiLog('ditolak', `fn_tandai_lunas_mayar mengembalikan "${statusFungsi}".`, idDitegaskan, tagihan.id);
    }
  } catch (err: unknown) {
    // Jangan bocorkan kunci/detail teknis ke log payload; cukup penanda penyebab
    const nama = err instanceof Error ? err.name : 'unknown';
    console.error('Kesalahan memproses webhook Mayar:', nama);
    if (logId) {
      try {
        const service = klienService();
        if (service) {
          await service.from('mayar_webhook_log').update({ status_terjawab: 'ditolak', catatan: `Kesalahan server (${nama}).` }).eq('id', logId);
        }
      } catch {
        /* biarkan respons tetap 200 */
      }
    }
  }

  // 5) SELALU balas 200 dengan cepat — Mayar tidak perlu retry pembacaan id
  return NextResponse.json({ ok: true }, { status: 200 });
}
