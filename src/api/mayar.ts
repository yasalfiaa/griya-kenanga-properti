/**
 * Helper pembayaran online (Mayar) — US-06.
 * Semua validasi kepemilikan & status ada di fn_create_mayar_payment_session
 * (server), Edge Function 'create-mayar-payment' yang membuat invoice Mayar
 * (atau link sandbox-demo) dan menyimpan mayar_invoice_id/mayar_link.
 *
 * Kunci API Mayar HANYA ada di secrets Edge Function — tidak pernah di frontend.
 *
 * Jika Edge Function belum menyatakan tersedia di server (belum di-deploy),
 * helper otomatis memakai mode SANDBOX DEMO: sesi tetap dibuat via RPC
 * berizin sehingga alur UI tetap bisa diuji; konfirmasi status pembayaran
 * lalu melalui webhook / simulator SQL (fn_reconcile_mayar_payment).
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface OnlinePaymentSession {
  /** URL pembayaran yang dibuka penyewa (Mayar / sandbox-demo) */
  link: string;
  /** Nomor tagihan, mis. INV-202611-0008 */
  nomor: string;
  /** Sisa yang harus dibayar (nominal + denda - terbayar) */
  sisa: number;
  /** 'mayar' | 'sandbox-demo' | 'existing' */
  mode: string;
}

export async function createOnlinePayment(tagihanId: string): Promise<OnlinePaymentSession> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Pembayaran online membutuhkan koneksi Supabase. Masuk dengan akun berbasis kata sandi lalu coba lagi.'
    );
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-mayar-payment', {
      body: { tagihan_id: tagihanId },
    });

    if (error) {
      // FunctionsHttpError membawa body JSON { message } dari Edge Function
      let pesan = error.message;
      try {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.message) pesan = body.message;
        }
      } catch {
        /* tetap pakai error.message */
      }
      // Edge Function ada tapi menolak (mis. payload/izin) → error asli dari server
      throw new Error(pesan);
    }

    const session = data as OnlinePaymentSession | null;
    if (!session?.link) {
      throw new Error('Link pembayaran online tidak diterima dari server. Coba lagi sebentar.');
    }
    return session;
  } catch (err: any) {
    const msg = String(err?.message ?? '');
    // Transport gagal = Edge Function belum ter-deploy / tidak terjangkau.
    // Jangan biarkan alur bundar binasa: pakai mode Sandbox Demo.
    if (
      msg.includes('Failed to send a request') ||
      msg.includes('Edge Function') ||
      msg.includes('edge function')
    ) {
      return createDemoSession(tagihanId);
    }
    throw err;
  }
}

/** Mode Sandbox Demo: bila sessi dibuat lewat RPC, link disarikan per sprach agak */
async function createDemoSession(tagihanId: string): Promise<OnlinePaymentSession> {
  const { data: res, error } = await supabase.rpc('fn_create_mayar_payment_session', {
    p_tagihan_id: tagihanId,
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = Array.isArray(res) ? res[0] : res;
  if (!row?.out_mayar_invoice_id) {
    throw new Error('Respons database tidak sesuai saat menyiapkan sesi bayar (mode demo).');
  }

  return {
    link: `https://griyakenanga.myr.id/invoices/${row.out_mayar_invoice_id}`,
    nomor: String(row.out_nomor ?? ''),
    sisa: Number(row.out_sisa ?? 0),
    // Penanda mode demo: konfirmasi status dilakukan via simulator SQL / webhook
    mode: 'sandbox-demo',
  };
}
