// Supabase Edge Function: create-mayar-payment
// Dipanggil frontend via supabase.functions.invoke('create-mayar-payment', { body: { tagihan_id } })
// Alur:
//   1) Verifikasi JWT user → rpc fn_create_mayar_payment_session (validasi kepemilikan & status di DB)
//   2) Buat invoice di Mayar (Sandbox/Produksi via MAYAR_API_KEY + MAYAR_API_URL)
//      • Jika MAYAR_API_KEY tidak diset / API gagal → fallback LINK SANDBOX-DEMO
//   3) Simpan mayar_invoice_id + mayar_link ke tagihan (service role)
//   4) Kembalikan { link, nomor, sisa, mode } ke klien
//
// Secrets: MAYAR_API_KEY, MAYAR_WEBHOOK_SECRET (opsional), MAYAR_API_URL (opsional)
// Environments bawaan: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const deno: any = (globalThis as any);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { tagihan_id } = await req.json();
    if (!tagihan_id) {
      return json({ message: 'tagihan_id wajib disertakan.' }, 400);
    }

    // 1) Klien atas nama user (JWT) → auth.uid() valid di dalam RPC
    const authHeader = req.headers.get('Authorization') ?? '';
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const SUPABASE_URL = deno.env.get('SUPABASE_URL');
    const ANON = deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE = deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const userSupabase = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceSupabase = createClient(SUPABASE_URL, SERVICE);

    // Verifikasi session user
    const { data: userData, error: userErr } = await userSupabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ message: 'Sesi login berakhir. Silakan login ulang lalu coba lagi.' }, 401);
    }

    // 2) Siapkan sesi (validasi kepemilikan/status di server, race-safe)
    const { data: sessionRes, error: sessionErr } = await userSupabase.rpc(
      'fn_create_mayar_payment_session',
      { p_tagihan_id: tagihan_id }
    );
    if (sessionErr) {
      return json({ message: sessionErr.message }, 400);
    }
    const session = Array.isArray(sessionRes) ? sessionRes[0] : sessionRes;
    if (!session) {
      return json({ message: 'Respons database tidak sesuai saat menyiapkan sesi bayar.' }, 500);
    }

    // Link sudah pernah dibuat → langsung pakai ulang (tidak menumpuk invoice)
    if (session.out_mode === 'existing' && session.out_link) {
      return json({
        link: session.out_link,
        nomor: session.out_nomor,
        sisa: session.out_sisa,
        mode: 'existing',
      });
    }

    // 3) Buat invoice di Mayar
    const sisa = Number(session.out_sisa ?? 0);
    const nomor = String(session.out_nomor ?? '');
    const mayarId = String(session.out_mayar_invoice_id ?? '');

    const apiUrl = deno.env.get('MAYAR_API_URL') ?? 'https://api.myr.id/v1';
    const apiKey = deno.env.get('MAYAR_API_KEY');

    let link: string | null = null;
    let mayarInvoiceId: string = mayarId;
    let mode = 'sandbox-demo';

    if (apiKey) {
      try {
        const payload = {
          // Bentuk umum invoice Mayar; field opsional diabaikan oleh API bila tidak didukung
          customer_email: userData.user.email ?? '',
          customer_name: userData.user.email ?? 'Penyewa',
          description: `Sewa ${nomor}`,
          amount: sisa,
          invoice_number: nomor,
          back_url: deno.env.get('APP_URL') ?? 'http://localhost:5173',
          redirect_url: deno.env.get('APP_URL') ?? 'http://localhost:5173',
          external_id: mayarId,
        };
        const resp = await fetch(`${apiUrl}/invoice`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const text = await resp.text();
        if (resp.ok && text) {
          let parsed: any = {};
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = {};
          }
          const parsedLink =
            parsed.link ?? parsed.payment_url ?? parsed.url ?? parsed.data?.link ?? parsed.data?.payment_url;
          const parsedId = parsed.id ?? parsed._id ?? parsed.invoice_id ?? parsed.data?.id;
          if (parsedLink) {
            link = String(parsedLink);
            mode = 'mayar';
            if (parsedId) mayarInvoiceId = String(parsedId);
          }
        }
      } catch (_fnErr) {
        // biarkan fallback demo di bawah
      }
    }

    if (!link) {
      // Fallback sandbox-demo (pola seperti seed): masih bisa diuji penuh
      // lewat simulator webhook SQL fn_reconcile_mayar_payment(...)
      link = `https://griyakenanga.myr.id/invoices/${mayarId}`;
      mode = 'sandbox-demo';
    }

    // 4) Simpan link ke tagihan
    const { error: updateErr } = await serviceSupabase
      .from('tagihan')
      .update({ mayar_invoice_id: mayarInvoiceId, mayar_link: link })
      .eq('id', tagihan_id);
    if (updateErr) {
      return json({ message: updateErr.message }, 500);
    }

    return json({ link, nomor, sisa, mode });
  } catch (e: any) {
    return json({ message: e?.message ?? 'Terjadi kesalahan saat memproses pembayaran online.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
