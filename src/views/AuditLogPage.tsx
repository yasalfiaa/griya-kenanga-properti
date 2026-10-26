import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { AuditLog } from '../types/database';
import {
  AlertCircle,
  Search,
  Eye,
  X,
  Clock,
  FileText,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Database,
} from 'lucide-react';

/** Format string tanggal ISO / Supabase / Mock menjadi format Indonesia rapi:
 *  "25 Okt 2026, 13:59 WIB"
 */
function formatWaktuIndonesia(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    let str = dateStr.trim().replace(' ', 'T');
    // Normalisasi offset satu digit jam (+07 -> +07:00) agar diterima parser Date
    if (/[+-]\d{2}$/.test(str)) str += ':00';
    const d = new Date(str);
    if (isNaN(d.getTime())) return dateStr;

    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const year = parts.find((p) => p.type === 'year')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const capMonth = month ? month.charAt(0).toUpperCase() + month.slice(1).replace('.', '') : '';

    return `${day} ${capMonth} ${year}, ${hour}:${minute} WIB`;
  } catch {
    return dateStr;
  }
}

interface ActionConfig {
  label: string;
  badgeClass: string;
}

/** Petakan teks aksi mentah / snake_case ke label ramah pengguna dan skema warna */
function getActionConfig(aksi: string): ActionConfig {
  const a = (aksi || '').toLowerCase();

  // 1. Mayar & Pembayaran Online
  if (a.includes('set_link_mayar') || a.includes('set_link')) {
    return {
      label: 'Set Link Mayar',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    };
  }
  if (a.includes('bayar:mayar')) {
    return {
      label: 'Pembayaran Mayar',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  }
  if (a.includes('catat:pembayaran') || a === 'pembayaran') {
    return {
      label: 'Catat Pembayaran',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  }
  if (a.includes('batal:pembayaran')) {
    return {
      label: 'Batal Pembayaran',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
  }

  // 2. Tagihan
  if (a.includes('buat_massal:tagihan')) {
    return {
      label: 'Buat Tagihan Massal',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    };
  }
  if (a.includes('batal:tagihan')) {
    return {
      label: 'Batal Tagihan',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
  }

  // 3. Kontrak
  if (a.includes('status:kontrak:draf->aktif') || a.includes('aktivasi:kontrak')) {
    return {
      label: 'Aktivasi Kontrak',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  }
  if (a.includes('status:kontrak:aktif->selesai') || a.includes('selesai:kontrak')) {
    return {
      label: 'Kontrak Selesai',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }
  if (a.includes('akhiri:kontrak')) {
    return {
      label: 'Akhiri Kontrak',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
  }
  if (a.includes('buat:kontrak')) {
    return {
      label: 'Buat Kontrak Baru',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    };
  }

  // 4. Verifikasi Identitas KTP
  if (
    a.includes('verifikasi_identitas:terverifikasi') ||
    a.includes('identitas_penyewa:belum->terverifikasi')
  ) {
    return {
      label: 'KTP Terverifikasi',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  }
  if (a.includes('verifikasi_identitas:ditolak')) {
    return {
      label: 'KTP Ditolak',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
  }

  // 5. Unit & Peran
  if (a.includes('status:unit')) {
    return {
      label: 'Ubah Status Unit',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    };
  }
  if (a.includes('harga:unit')) {
    return {
      label: 'Ubah Harga Unit',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    };
  }
  if (a.includes('peran_akun') || a.includes('peran')) {
    return {
      label: 'Ubah Peran Akun',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
    };
  }

  // 6. Laporan Kerusakan
  if (a.includes('buat:laporan_kerusakan')) {
    return {
      label: 'Laporan Kerusakan',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    };
  }
  if (a.includes('proses:laporan_kerusakan') || a.includes('setujui:laporan_kerusakan')) {
    return {
      label: 'Proses Kerusakan',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    };
  }
  if (a.includes('tolak:laporan_kerusakan')) {
    return {
      label: 'Tolak Kerusakan',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    };
  }
  if (a.includes('selesai:laporan_kerusakan')) {
    return {
      label: 'Perbaikan Selesai',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  }
  if (a.includes('tutup:laporan_kerusakan')) {
    return {
      label: 'Laporan Ditutup',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  // Fallback warna dinamis berdasarkan kata kunci
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  if (a.includes('batal') || a.includes('tolak') || a.includes('hapus')) {
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200/80';
  } else if (
    a.includes('bayar') ||
    a.includes('selesai') ||
    a.includes('aktif') ||
    a.includes('sukses')
  ) {
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  } else if (a.includes('update') || a.includes('ubah') || a.includes('edit')) {
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200/80';
  } else if (a.includes('buat') || a.includes('link') || a.includes('tambah')) {
    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200/80';
  }

  const clean = aksi
    .replace(/[:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return { label: clean, badgeClass };
}

/** Format nama tabel target menjadi label kapital yang bersih */
function formatTargetName(tabel: string): string {
  const map: Record<string, string> = {
    tagihan: 'Tagihan',
    pembayaran: 'Pembayaran',
    kontrak: 'Kontrak',
    unit: 'Unit',
    identitas_penyewa: 'Identitas Penyewa',
    laporan_kerusakan: 'Laporan Kerusakan',
    profiles: 'Profil Akun',
    audit_log: 'Audit Log',
  };
  return map[tabel?.toLowerCase()] || (tabel || '-').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Format badge peran pelaku */
function getRoleBadge(role?: string) {
  const r = (role || '').toLowerCase();
  if (r === 'pemilik') {
    return {
      label: 'Pemilik',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    };
  }
  if (r === 'pengelola') {
    return {
      label: 'Pengelola',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (r === 'penyewa') {
    return {
      label: 'Penyewa',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (r === 'mayar' || r === 'sistem' || r === 'webhook') {
    return {
      label: 'Mayar (Sistem)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: role ? role.toUpperCase() : 'SISTEM',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

/** Parser payload aman untuk objek maupun string JSON mentah */
function parsePayload(payload: any): Record<string, any> | null {
  if (!payload) return null;
  if (typeof payload === 'object') return payload;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === 'object' && parsed !== null ? parsed : { nilai: parsed };
    } catch {
      return { teks: payload };
    }
  }
  return null;
}

export const AuditLogPage: React.FC = () => {
  const { role } = useAuth();
  const [auditLogs] = useState(() => dataStore.getAuditLogs());
  const [filterAction, setFilterAction] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (role !== 'pemilik') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900">Akses Dibatasi</h2>
        <p className="text-sm text-rose-700">Hanya Pemilik yang berhak melihat jejak audit log sistem.</p>
      </div>
    );
  }

  const filteredLogs = auditLogs.filter((log) => {
    const actionConfig = getActionConfig(log.aksi);
    const targetName = formatTargetName(log.tabel);
    const actorName = log.pelaku?.nama_lengkap || '';
    const kw = searchKeyword.toLowerCase();

    const matchesAction =
      filterAction === 'all'
        ? true
        : log.aksi.toLowerCase().includes(filterAction) ||
          log.tabel.toLowerCase().includes(filterAction) ||
          actionConfig.label.toLowerCase().includes(filterAction);

    const matchesSearch =
      searchKeyword === '' ||
      log.tabel.toLowerCase().includes(kw) ||
      log.aksi.toLowerCase().includes(kw) ||
      actionConfig.label.toLowerCase().includes(kw) ||
      targetName.toLowerCase().includes(kw) ||
      actorName.toLowerCase().includes(kw) ||
      (log.pelaku_id && log.pelaku_id.toLowerCase().includes(kw)) ||
      (log.data_id && log.data_id.toLowerCase().includes(kw));

    return matchesAction && matchesSearch;
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Jejak Rekam Sistem
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catatan aktivitas dan riwayat transaksi secara real-time keamanan properti.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari aksi, tabel, ID target, atau nama staf..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full text-xs border border-border bg-card rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-xs font-semibold bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
        >
          <option value="all">Semua Jenis Aksi</option>
          <option value="mayar">Pembayaran Online (Mayar)</option>
          <option value="pembayaran">Pencatatan & Batal Bayar</option>
          <option value="tagihan">Tagihan Sewa</option>
          <option value="kontrak">Kontrak Sewa</option>
          <option value="verifikasi">Verifikasi KTP</option>
          <option value="unit">Perubahan Unit & Harga</option>
          <option value="peran">Ubah Peran Akun</option>
          <option value="kerusakan">Laporan Kerusakan</option>
        </select>
      </div>

      {/* Statistik Ringkas */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Menampilkan <strong className="text-foreground">{filteredLogs.length}</strong> dari {auditLogs.length} jejak aktivitas
        </span>
        {searchKeyword && (
          <button
            onClick={() => setSearchKeyword('')}
            className="text-xs text-primary hover:underline font-medium"
          >
            Reset Pencarian
          </button>
        )}
      </div>

      {/* Tabel Audit Log */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Waktu</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Pelaku & Peran</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Aksi</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Tabel / Target</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Detail Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm">Tidak ada catatan audit log yang cocok.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Coba sesuaikan kata kunci pencarian atau ganti filter aksi.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionConfig = getActionConfig(log.aksi);
                  const roleBadge = getRoleBadge(log.peran);
                  const shortId = log.data_id
                    ? log.data_id.length > 8
                      ? `${log.data_id.slice(0, 8)}...`
                      : log.data_id
                    : null;

                  return (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      {/* 1. Format Waktu Indonesia */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{formatWaktuIndonesia(log.dibuat_pada)}</span>
                        </div>
                      </td>

                      {/* 2. Pelaku & Peran */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground text-xs leading-snug">
                          {log.pelaku?.nama_lengkap ||
                            (log.peran === 'mayar'
                              ? 'Sistem Mayar (Webhook)'
                              : log.pelaku_id
                              ? `ID: #${log.pelaku_id.slice(0, 8)}`
                              : 'Sistem')}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${roleBadge.badgeClass}`}
                          >
                            {roleBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* 3. Aksi Berwarna */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${actionConfig.badgeClass}`}
                        >
                          {actionConfig.label}
                        </span>
                      </td>

                      {/* 4. Target & Shortened ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="bg-muted text-foreground border border-border px-2 py-0.5 rounded-md font-medium text-[11px]">
                            {formatTargetName(log.tabel)}
                          </span>
                          {shortId && (
                            <span
                              className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/50"
                              title={`ID Penuh: ${log.data_id}`}
                            >
                              #{shortId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Tombol Lihat Detail (Payload JSON disembunyikan dari tabel) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Dialog Detail Perubahan Data */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-muted/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground text-base">Detail Perubahan Data</h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      getActionConfig(selectedLog.aksi).badgeClass
                    }`}
                  >
                    {getActionConfig(selectedLog.aksi).label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: <strong className="text-foreground">{formatTargetName(selectedLog.tabel)}</strong> • ID: #{selectedLog.data_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Meta Informasi Singkat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Waktu Tercatat:</span>
                  <span className="font-semibold text-foreground">
                    {formatWaktuIndonesia(selectedLog.dibuat_pada)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Pelaku Aksi:</span>
                  <span className="font-semibold text-foreground">
                    {selectedLog.pelaku?.nama_lengkap || selectedLog.pelaku_id || 'Sistem'}
                    <span className="ml-1.5 text-[10px] font-bold uppercase text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                      {selectedLog.peran}
                    </span>
                  </span>
                </div>
              </div>

              {/* Komparasi: Sebelum vs Sesudah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Kolom Sebelum */}
                <div className="border border-border rounded-xl p-3.5 bg-card shadow-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" /> Sebelum
                    </span>
                    {selectedLog.sebelum && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(JSON.stringify(parsePayload(selectedLog.sebelum), null, 2), 'sebelum')
                        }
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                        title="Salin JSON"
                      >
                        {copiedKey === 'sebelum' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === 'sebelum' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>

                  {(() => {
                    const parsed = parsePayload(selectedLog.sebelum);
                    if (!parsed || Object.keys(parsed).length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground italic py-3 text-center">
                          Tidak ada data awal (pencatatan data baru)
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2 text-xs">
                        {Object.entries(parsed).map(([k, v]) => (
                          <div key={k} className="bg-muted/40 p-2 rounded-lg border border-border/50">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              {k.replace(/_/g, ' ')}
                            </span>
                            <span className="text-foreground font-mono font-medium break-all">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Kolom Sesudah */}
                <div className="border border-emerald-200/80 bg-emerald-50/20 rounded-xl p-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/80">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sesudah
                    </span>
                    {selectedLog.sesudah && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(JSON.stringify(parsePayload(selectedLog.sesudah), null, 2), 'sesudah')
                        }
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                        title="Salin JSON"
                      >
                        {copiedKey === 'sesudah' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === 'sesudah' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>

                  {(() => {
                    const parsed = parsePayload(selectedLog.sesudah);
                    if (!parsed || Object.keys(parsed).length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground italic py-3 text-center">
                          Tidak ada data pembaruan
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2 text-xs">
                        {Object.entries(parsed).map(([k, v]) => {
                          const isUrl = typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'));
                          return (
                            <div key={k} className="bg-card p-2 rounded-lg border border-emerald-200/60">
                              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                                {k.replace(/_/g, ' ')}
                              </span>
                              {isUrl ? (
                                <a
                                  href={v}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-mono text-[11px] flex items-center gap-1 break-all mt-0.5"
                                >
                                  <span>{v}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span className="text-foreground font-mono font-medium break-all">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-end bg-muted/20">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
