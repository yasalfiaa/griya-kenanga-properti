/**
 * Setelan (/setelan) — HALAMAN KHUSUS PEMILIK.
 * Bagian Payment Gateway (Mayar):
 *   1) Status terhubung — hasil cek env di SERVER via GET /api/pembayaran/status
 *      (nilai kunci TIDAK pernah dikirim/tampil, hanya boolean & mode).
 *   2) Mode sandbox (api.mayar.io) atau produksi (api.mayar.id).
 *   3) URL webhook /api/webhook/mayar yang bisa disalin untuk dashboard Mayar.
 *   4) 10 baris terakhir mayar_webhook_log (RLS: pemilik saja yang membaca).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabase';
import {
  CreditCard,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Globe,
  ListChecks,
  Loader2,
} from 'lucide-react';

interface StatusGateway {
  terhubung: boolean;
  secret_siap: boolean;
  mode: 'sandbox' | 'produksi';
  webhook_path: string;
}

interface BarisLog {
  id: string;
  dibuat_pada: string;
  event: string | null;
  mayar_invoice_id: string | null;
  status_terjawab: string | null;
  catatan: string | null;
}

export const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<StatusGateway | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [memuatStatus, setMemuatStatus] = useState(true);

  const [urlWebhook, setUrlWebhook] = useState('');
  const [tersalin, setTersalin] = useState(false);

  const [logs, setLogs] = useState<BarisLog[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [memuatLog, setMemuatLog] = useState(true);

  const muatStatus = useCallback(async () => {
    try {
      setMemuatStatus(true);
      setStatusError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/pembayaran/status', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      const body = (await res.json().catch(() => null)) as StatusGateway | { message?: string } | null;
      if (!res.ok) {
        setStatusError((body as { message?: string })?.message || 'Gagal memeriksa status gateway.');
        setStatus(null);
      } else {
        setStatus(body as StatusGateway);
      }
    } catch {
      setStatusError('Tidak dapat menghubungi server untuk status gateway.');
    } finally {
      setMemuatStatus(false);
    }
  }, []);

  const muatLog = useCallback(async () => {
    try {
      setMemuatLog(true);
      setLogError(null);
      const { data, error } = await supabase
        .from('mayar_webhook_log')
        .select('id, dibuat_pada, event, mayar_invoice_id, status_terjawab, catatan')
        .order('dibuat_pada', { ascending: false })
        .limit(10);
      if (error) {
        setLogError(error.message);
        setLogs([]);
      } else {
        setLogs((data ?? []) as unknown as BarisLog[]);
      }
    } catch {
      setLogError('Gagal memuat log webhook.');
    } finally {
      setMemuatLog(false);
    }
  }, []);

  useEffect(() => {
    muatStatus();
    muatLog();
    // URL webhook dibangun di browser: origin yang sedang dipakai pengguna
    setUrlWebhook(`${window.location.origin}/api/webhook/mayar`);
  }, [muatStatus, muatLog]);

  const salinWebhook = async () => {
    try {
      await navigator.clipboard.writeText(urlWebhook);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard bisa terblokir; biarkan teks terlihat sehingga tetap bisa disalin manual
      setTersalin(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Setelan Sistem
        </h1>
        <p className="text-sm text-muted-foreground">
          Informasi sistem pembayaran terintegrasi.
        </p>
      </div>

      {/* === Payment Gateway (Mayar) === */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-foreground text-base flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Payment Gateway — Mayar
          </h2>
          {status?.mode && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                status.mode === 'sandbox'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-border text-foreground'
              }`}
            >
              {status.mode === 'sandbox' ? 'Mode Sandbox (api.mayar.io)' : 'Mode Produksi (api.mayar.id)'}
            </span>
          )}
        </div>

        {/* Status terhubung */}
        <div>
          {memuatStatus ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Memeriksa status di server...
            </div>
          ) : statusError ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600">
              <AlertTriangle className="w-4 h-4" /> {statusError}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-xs">
                {status?.terhubung ? (
                  <ShieldCheck className="w-4 h-4 text-primary" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                )}
                <span className="text-muted-foreground">Kunci Mayar di server:</span>
                <span className={status?.terhubung ? 'font-bold text-primary' : 'font-bold text-rose-600'}>
                  {status?.terhubung ? 'Terhubung' : 'Belum di-set'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-xs">
                {status?.secret_siap ? (
                  <ShieldCheck className="w-4 h-4 text-primary" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                )}
                <span className="text-muted-foreground">Kunci secret webhook:</span>
                <span className={status?.secret_siap ? 'font-bold text-primary' : 'font-bold text-rose-600'}>
                  {status?.secret_siap ? 'Terhubung' : 'Belum di-set'}
                </span>
              </div>
              <button
                onClick={muatStatus}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Periksa ulang
              </button>
            </div>
          )}
        </div>

        {/* URL Webhook (bisa disalin) */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" /> URL Webhook (tempel di Mayar: Integration → Webhook)
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={urlWebhook}
              className="flex-1 text-xs font-mono bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={salinWebhook}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              {tersalin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {tersalin ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Endpoint menerima POST dari Mayar selalu membalas 200; keputusan akhir pembayaran diverifikasi ulang
            ke Mayar sebelum tagihan ditandai lunas.
          </p>
        </div>

        {/* 10 baris terakhir mayar_webhook_log */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" /> 10 Log Webhook Terakhir
            </h3>
            <button
              onClick={muatLog}
              disabled={memuatLog}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 disabled:opacity-50"
            >
              {memuatLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Muat ulang
            </button>
          </div>

          {logError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {logError}
            </div>
          )}

          {!logError && logs.length === 0 && !memuatLog && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl p-3">
              Belum ada pesan webhook. Log akan terisi saat Mayar mengirim event (payment.received, dsb.).
            </p>
          )}

          {logs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Invoice Mayar</th>
                    <th className="py-2 px-3">Hasil</th>
                    <th className="py-2 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {l.dibuat_pada ? new Date(l.dibuat_pada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-2 px-3 font-medium text-foreground">{l.event || '-'}</td>
                      <td className="py-2 px-3 font-mono max-w-[180px] truncate" title={l.mayar_invoice_id ?? ''}>
                        {l.mayar_invoice_id || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-full ${
                            l.status_terjawab === 'diterima'
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.status_terjawab === 'ditolak'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-border text-muted-foreground'
                          }`}
                        >
                          {l.status_terjawab || 'diproses'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[280px] truncate" title={l.catatan ?? ''}>
                        {l.catatan || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
