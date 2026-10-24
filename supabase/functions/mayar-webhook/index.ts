// Supabase Edge Function: mayar-webhook
// Endpoint publik yang diisi di Dashboard Mayar (URL Webhook).
// Alur:
//   1) (Opsional) Verifikasi signature `x-mayar-signature` vs MAYAR_WEBHOOK_SECRET
//   2) Parse payload fleksibel (event/referensi/invoice/amount/status)
//   3) Hanya proses status LUNAS (bayar berhasil)
//   4) Panggil fn_reconcile_mayar_payment (idempoten; metode 'mayar',
//      dicatat_oleh NULL) → trigger existing memutakhirkan status tagihan
//
// Secrets header ayat: MAYAR_WEBHOOK_SECRET (opsional di sandbox)
// Environments bawaan: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mayar-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Status sukses yang diterima dari berbagai bentuk payload Mayar/simulator
const PAID_STATUS = new Set(['paid', 'paid_off', 'success', 'completed', 'settlement', 'lunas']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return json({ message: 'Webhook hanya menerima POST.' }, 405);
  }

  try {
    const raw = await req.text();

    // 1) Verifikasi signature (kini akurat bila MAYAR_WEBHOOK_SECRET diset)
    const secret = Deno.env.get('MAYAR_WEBHOOK_SECRET');
    if (secret) {
      const given = req.headers.get('x-mayar-signature') ?? '';
      const encoder = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(raw));
      const expected = Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (given !== expected) {
        return json({ message: 'Signature webhook tidak valid.' }, 401);
      }
    }

    // 2) Parse payload fleksibel
    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ message: 'Payload webhook bukan JSON valid.' }, 400);
    }

    const statusVal = String(
      body.status ?? body.event ?? body.payment_status ?? body.data?.status ?? ''
    ).toLowerCase();
    if (!PAID_STATUS.has(statusVal)) {
      // Status selain "lunas" diabaikan, webhook tetap diterima OK
      return json({ received: true, action: 'ignored', status: statusVal });
    }

    const referensi = String(
      body.reference ?? body.referensi ?? body.transaction_id ?? body.data?.reference ?? ''
    ).trim();
    const mayarInvoiceId = String(
      body.invoice_id ?? body.mayar_invoice_id ?? body.data?.invoice_id ?? ''
    ).trim();
    const jumlah = Number(
      body.amount ?? body.jumlah ?? body.total ?? body.data?.amount ?? 0
    );

    if (!referensi || (!mayarInvoiceId && !body.tagihan_id)) {
      return json({ message: 'Referensi atau invoice id tidak ditemukan di payload.' }, 400);
    }

    // 3) Terjemahkan mayar_invoice_id → tagihan_id internal
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const serviceSupabase = createClient(SUPABASE_URL, SERVICE);

    let tagihanId = String(body.tagihan_id ?? '');
    let jumlahFinal = jumlah > 0 && Number.isFinite(jumlah) ? Math.round(jumlah) : 0;

    if (!tagihanId) {
      const { data, error } = await serviceSupabase
        .from('tagihan')
        .select('id, nominal_sewa, denda, terbayar')
        .eq('mayar_invoice_id', mayarInvoiceId)
        .maybeSingle();
      if (error || !data?.id) {
        return json({ message: 'Tagihan tidak ditemukan untuk invoice Mayar ini.' }, 404);
      }
      tagihanId = data.id;
    }

    // Webhook tanpa nominal (umum di berbagai provider) → bayar sisa penuh
    if (!jumlahFinal) {
      const { data: t, error: tErr } = await serviceSupabase
        .from('tagihan')
        .select('nominal_sewa, denda, terbayar')
        .eq('id', tagihanId)
        .maybeSingle();
      if (tErr || !t) {
        return json({ message: 'Tagihan tidak ditemukan.' }, 404);
      }
      jumlahFinal = Math.max(0, (t.nominal_sewa ?? 0) + (t.denda ?? 0) - (t.terbayar ?? 0));
      if (!jumlahFinal) {
        return json({ received: true, action: 'ignored', reason: 'Sisa tagihan sudah 0.' });
      }
    }

    // 4) Rekonsiliasi idempoten
    const { data: recRes, error: recErr } = await serviceSupabase.rpc(
      'fn_reconcile_mayar_payment',
      {
        p_referensi_mayar: referensi,
        p_tagihan_id: tagihanId,
        p_jumlah: jumlahFinal,
        p_tanggal_bayar: new Date().toISOString().slice(0, 10),
      }
    );
    if (recErr) {
      return json({ message: recErr.message }, 400);
    }
    const rec = Array.isArray(recRes) ? recRes[0] : recRes;

    return json({
      received: true,
      result: rec?.out_status ?? 'unknown',
    });
  } catch (e: any) {
    return json({ message: e?.message ?? 'Gagal memproses webhook.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
