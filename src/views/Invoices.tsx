import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { supabase } from '../api/supabase';
import { Tagihan, Pembayaran } from '../types/database';
import { formatRupiah } from '../utils/business-rules';
import {
  ACCEPTED_IMAGE_ATTR,
  validateImageFile,
  uploadImage,
  STORAGE_BUCKETS,
} from '../api/storage';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { parseErrorMessage } from '../utils/error-handler';
import { createOnlinePayment } from '../api/mayar';
import {
  Receipt,
  PlusCircle,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  FileCheck2,
  Camera,
  Loader2,
} from 'lucide-react';

export const Invoices: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [invoices, setInvoices] = useState<Tagihan[]>(() => dataStore.getInvoices());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    dataStore.loadFromSupabase().then(() => {
      if (isMounted) {
        setInvoices(dataStore.getInvoices());
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Kumpulkan semua periode yang tersedia, perketat badge tagihan hanya 3 bulan terakhir sejak halaman diperbarui
  const availablePeriods = useMemo(() => {
    const periodSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.periode && inv.periode.length >= 7) {
        periodSet.add(inv.periode.slice(0, 7));
      }
    });
    // Pastikan periode acuan demo tetap ada dalam daftar perhitungan
    ['2026-10', '2026-09', '2026-08'].forEach(p => periodSet.add(p));

    // Urutkan secara menurun (terbaru ke terlama) dan batasi hanya 3 bulan terakhir
    const sorted = Array.from(periodSet).sort((a, b) => b.localeCompare(a));
    return sorted.slice(0, 3);
  }, [invoices]);

  // Modal Catat Pembayaran (Pengelola)
  const [payingInvoice, setPayingInvoice] = useState<Tagihan | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'tunai' | 'transfer'>('tunai');
  const [payDate, setPayDate] = useState<string>('2026-10-15'); // Tanggal acuan
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [buktiPreview, setBuktiPreview] = useState<string | null>(null);
  const [buktiError, setBuktiError] = useState<string | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [payModalError, setPayModalError] = useState<string | null>(null);

  // Modal Batalkan Pembayaran (Pemilik)
  const [cancelingPayment, setCancelingPayment] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  // Modal Batalkan Tagihan (Pemilik) — pola error standar
  const [cancelingInvoice, setCancelingInvoice] = useState<Tagihan | null>(null);
  const [invoiceCancelError, setInvoiceCancelError] = useState<string | null>(null);
  const [isCancellingInvoice, setIsCancellingInvoice] = useState(false);

  // Modal Bayar Online via Mayar (Penyewa, US-06) — pola error standar
  const [onlinePayInvoice, setOnlinePayInvoice] = useState<Tagihan | null>(null);
  const [onlinePayError, setOnlinePayError] = useState<string | null>(null);
  const [isStartingOnlinePay, setIsStartingOnlinePay] = useState(false);
  const [onlinePayResult, setOnlinePayResult] = useState<
    | { link: string; nomor: string; sisa: number; mode: string }
    | null
  >(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  // === Bayar Online via API Mayar V2 (semua role; tombol utama) ===
  const [isMembuatLink, setIsMembuatLink] = useState<string | null>(null); // id tagihan yang sedang dibuatkan link
  const [pollingTagihan, setPollingTagihan] = useState<string | null>(null); // id tagihan yang dipantau statusnya
  const [lunasOnline, setLunasOnline] = useState<{ id: string; waktu: string } | null>(null);

  const filteredInvoices = invoices.filter(inv => {
    const matchesPeriod = selectedPeriod === 'all' ? true : inv.periode.startsWith(selectedPeriod);
    if (role === 'penyewa') {
      return matchesPeriod && inv.kontrak?.penyewa_id === currentUser?.id;
    }
    return matchesPeriod;
  });

  // Modal Generate Tagihan Bulanan (Pengelola/Pemilik) — pola error standar
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState<string>('2026-11');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateInvoices = async () => {
    if (!currentUser) return;
    try {
      setIsGenerating(true);
      setGenerateError(null);
      const result = await dataStore.generateMonthlyInvoices(generatePeriod, currentUser);

      // Kembalikan komponen keterangan error ketika tagihan pada periode tertentu sudah dibuat
      if (result.dibuat === 0) {
        if (result.dilewati > 0) {
          throw new Error('Tagihan untuk periode ini sudah pernah dibuat. Tidak ada tagihan baru yang ditambahkan.');
        } else {
          throw new Error(`Tidak ada kontrak aktif yang mencakup periode ${generatePeriod}. Tidak ada tagihan yang dibuat.`);
        }
      }

      setInvoices(dataStore.getInvoices());
      setSelectedPeriod(generatePeriod);
      setMessage({
        type: 'success',
        text:
          `Berhasil membuat ${result.dibuat} tagihan baru untuk periode ${generatePeriod}` +
          (result.dilewati > 0 ? ` (${result.dilewati} sudah ada, dilewati — tidak ada dobel).` : '.'),
      });
      setShowGenerateModal(false);
      setGenerateError(null);
    } catch (err: any) {
      // Error tidak di-swallow: tampil di dalam modal sampai ditutup
      setGenerateError(parseErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOnlinePay = async () => {
    if (!onlinePayInvoice || !currentUser) return;
    try {
      setIsStartingOnlinePay(true);
      setOnlinePayError(null);
      const session = await createOnlinePayment(onlinePayInvoice.id);
      setOnlinePayResult(session);
    } catch (err: any) {
      // Error tidak di-swallow: tampil di dalam modal sampai ditutup
      setOnlinePayError(parseErrorMessage(err));
    } finally {
      setIsStartingOnlinePay(false);
    }
  };

  // === Tombol Bayar Online utama: panggil /api/pembayaran/buat (Mayar V2) ===
  // Hanya PENYEWA memakai tombol ini di baris tabel. Pengelola 403 tak mungkin
  // (tombol tak tampil); penyewa yang mendapat 403 → fallback modal US-06 lama.
  const handleBayarOnline = async (inv: Tagihan) => {
    if (!currentUser || isMembuatLink !== null) return;
    try {
      setIsMembuatLink(inv.id);
      setMessage(null);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/pembayaran/buat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ tagihan_id: inv.id }),
      });
      const body = (await res.json().catch(() => null)) as { link?: string; message?: string } | null;

      if (!res.ok || !body?.link) {
        // Penyewa tanpa akses API V2 → alur US-06 lama (modal Mayar fallback) tetap dipakai
        if (res.status === 403 && role === 'penyewa') {
          setOnlinePayInvoice(inv);
          setOnlinePayError(null);
          setOnlinePayResult(null);
          return;
        }
        const err = new Error(body?.message || 'Gagal membuat tautan pembayaran online.');
        err.message = body?.message || err.message;
        throw err;
      }

      // Buka tautan Mayar di tab baru; jika popup diblokir → fallback modal lama
      const jendela = window.open(body.link, '_blank', 'noopener');
      if (!jendela) {
        setOnlinePayInvoice(inv);
        setOnlinePayError(null);
        setOnlinePayResult(null);
      }
      // Mulai pantau status tagihan secara berkala (lihat useEffect polling)
      setPollingTagihan(inv.id);
      setMessage({ type: 'success', text: 'Tautan pembayaran dibuat. Tab Mayar terbuka — status tagihan dipantau otomatis.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    } finally {
      setIsMembuatLink(null);
    }
  };

  // === Polling status tagihan tiap 5 detik, maksimal 5 menit ===
  useEffect(() => {
    if (!pollingTagihan) return;
    const idTagihan = pollingTagihan;
    const mulai = Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    const periksa = async () => {
      if (Date.now() - mulai > 5 * 60 * 1000) {
        // Batas 5 menit tercapai → berhenti memantau
        if (interval) clearInterval(interval);
        setPollingTagihan(null);
        setMessage({ type: 'error', text: 'Pemantauan berhenti setelah 5 menit. Tagihan belum terdeteksi lunas — muat ulang manual jika sudah bayar.' });
        return;
      }
      try {
        // Pemeriksaan lewat SERVER (/api/pembayaran/cek): bertanya ulang
        // status ke Mayar dan menandai lunas bila "paid" + jumlah cocok —
        // melengkapi webhook yang tak terjangkau saat dev di localhost.
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/pembayaran/cek', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ tagihan_id: idTagihan }),
        });
        const body = (await res.json().catch(() => null)) as
          | { lunas?: boolean; tercatat?: boolean; pesan?: string; dibayar_online_at?: string | null }
          | null;
        if (!res.ok || !body) return; // gagal sekali → coba lagi pada tick berikutnya
        if (body.lunas || body.tercatat) {
          if (interval) clearInterval(interval);
          setPollingTagihan(null);
          await dataStore.loadFromSupabase();
          setInvoices(dataStore.getInvoices());
          const waktu = body.dibayar_online_at
            ? new Date(body.dibayar_online_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : '';
          setLunasOnline({ id: idTagihan, waktu });
          const sambungan = waktu ? ` dibayar ${waktu}` : '';
          setMessage({
            type: 'success',
            text: body.pesan
              ? `${body.pesan}${waktu && !body.pesan.includes(waktu) ? sambungan : ''}`
              : `Pembayaran online terkonfirmasi — tagihan berstatus Lunas${sambungan}.`,
          });
        }
      } catch {
        // diamkan: tick berikutnya akan mencoba ulang
      }
    };

    interval = setInterval(periksa, 5000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pollingTagihan]);

  const handleRefreshStatus = async () => {
    try {
      setIsRefreshingStatus(true);
      await dataStore.loadFromSupabase();
      setInvoices(dataStore.getInvoices());
      setMessage({ type: 'success', text: 'Status tagihan berhasil dimuat ulang dari server.' });
      setOnlinePayInvoice(null);
      setOnlinePayResult(null);
    } catch (err: any) {
      setOnlinePayError(parseErrorMessage(err));
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleBuktiSelect = (e: React.ChangeEvent<HTMLInputElement>) => {    const file = e.target.files?.[0] || null;
    setBuktiError(null);
    if (!file) {
      setBuktiFile(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      setBuktiFile(null);
      e.target.value = '';
      setBuktiError(err);
      return;
    }
    // Pratinjau foto bukti transfer sebelum diunggah
    if (buktiPreview) URL.revokeObjectURL(buktiPreview);
    setBuktiFile(file);
    setBuktiPreview(URL.createObjectURL(file));
  };

  const handleRecordPayment = async () => {
    if (!payingInvoice || !currentUser) return;
    try {
      setIsSavingPayment(true);
      setPayModalError(null);

      // Validasi bukti transfer (wajib untuk metode transfer)
      if (payMethod === 'transfer' && !buktiFile) {
        setPayModalError('Pembayaran transfer wajib melampirkan foto bukti transfer.');
        return;
      }

      // Unggah foto bukti ke Supabase Storage (bucket publik bukti-bayar)
      let buktiUrl: string | undefined;
      if (payMethod === 'transfer' && buktiFile) {
        const doc = await uploadImage({
          bucket: STORAGE_BUCKETS.buktiBayar,
          userId: currentUser.id,
          kind: 'bukti',
          file: buktiFile,
        });
        buktiUrl = doc.url; // URL publik permanen
      }

      await dataStore.recordPayment({
        tagihan_id: payingInvoice.id,
        jumlah: payAmount,
        metode: payMethod,
        tanggal_bayar: payDate,
        bukti_path: buktiUrl,
        actor: currentUser,
      });

      setInvoices(dataStore.getInvoices());

      // Bersihkan pratinjau
      if (buktiPreview) URL.revokeObjectURL(buktiPreview);
      setBuktiFile(null);
      setBuktiPreview(null);

      setMessage({
        type: 'success',
        text: `Pembayaran sebesar ${formatRupiah(payAmount)} berhasil dicatat untuk tagihan ${payingInvoice.nomor}.`,
      });
      setPayingInvoice(null);
      setPayModalError(null);
    } catch (err: any) {
      setPayModalError(parseErrorMessage(err));
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!currentUser || !cancelingInvoice) return;
    try {
      setIsCancellingInvoice(true);
      setInvoiceCancelError(null);
      dataStore.cancelInvoice(cancelingInvoice.id, currentUser);
      setInvoices(dataStore.getInvoices());
      setMessage({ type: 'success', text: `Tagihan ${cancelingInvoice.nomor} berhasil dibatalkan oleh Pemilik.` });
      setCancelingInvoice(null);
    } catch (err: any) {
      // Error tidak di-swallow: tampil di dalam modal sampai pengguna menutupnya
      setInvoiceCancelError(parseErrorMessage(err));
    } finally {
      setIsCancellingInvoice(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'lunas':
        return <Badge variant="emerald">Lunas</Badge>;
      case 'sebagian':
        return <Badge variant="amber">Sebagian</Badge>;
      case 'belum_bayar':
        return <Badge variant="rose">Belum Bayar</Badge>;
      case 'dibatalkan':
      default:
        return <Badge variant="muted">Dibatalkan</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {role === 'penyewa' ? 'Tagihan Sewa Saya' : 'Tagihan Bulanan & Kas Pembayaran'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ketentuan Pembayaran: Jatuh tempo setiap tanggal 10 dengan denda keterlambatan Rp20.000/hari.
          </p>
        </div>

        {/* Action Button: Batch Generate Invoice (Pengelola/Pemilik) */}
        {(role === 'pengelola' || role === 'pemilik') && (
          <button
            onClick={() => {
              setGenerateError(null);
              setShowGenerateModal(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Buat Tagihan Bulanan
          </button>
        )}
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-primary" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-xs font-bold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* Filter Periode */}
      <div className="flex flex-wrap items-center gap-2 bg-muted p-1.5 rounded-xl text-xs font-semibold w-fit max-w-full">
        <span className="text-muted-foreground px-2">Periode Tagihan:</span>
        {availablePeriods.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              selectedPeriod === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          key="all"
          onClick={() => setSelectedPeriod('all')}
          className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
            selectedPeriod === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Semua Periode
        </button>
      </div>

      {/* Tabel Tagihan */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nomor Invoice</th>
                <th className="py-3.5 px-4">Penyewa & Unit</th>
                <th className="py-3.5 px-4">Jatuh Tempo</th>
                <th className="py-3.5 px-4">Nominal Pokok</th>
                <th className="py-3.5 px-4">Denda Keterlambatan</th>
                <th className="py-3.5 px-4">Terbayar</th>
                <th className="py-3.5 px-4">Sisa Tagihan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-foreground text-xs">
                    {inv.nomor}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-foreground">
                      {inv.kontrak?.penyewa?.nama_lengkap || 'Penyewa'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Kamar: <span className="font-semibold text-primary">{inv.kontrak?.unit?.kode}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-foreground">
                    {inv.jatuh_tempo}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-foreground">
                    {formatRupiah(inv.nominal_sewa)}
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.denda > 0 ? (
                      <span className="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded">
                        +{formatRupiah(inv.denda)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Rp0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-primary">
                    {formatRupiah(inv.terbayar)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-foreground">
                    {formatRupiah(inv.sisa_tagihan || 0)}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(inv.status)}
                    {inv.status === 'lunas' && inv.dibayar_online_at && (
                      <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                        dibayar{' '}
                        {new Date(inv.dibayar_online_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    )}
                    {inv.status === 'lunas' && lunasOnline?.id === inv.id && lunasOnline.waktu && !inv.dibayar_online_at && (
                      <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">dibayar {lunasOnline.waktu}</div>
                    )}
                    {pollingTagihan === inv.id && inv.status !== 'lunas' && (
                      <div className="text-[10px] text-primary font-semibold mt-1 flex items-center gap-1 whitespace-nowrap">
                        <Loader2 className="w-3 h-3 animate-spin" /> Menunggu pembayaran...
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Penyewa: Bayar Online via API Mayar V2 (403 → modal US-06) */}
                      {role === 'penyewa' && inv.status !== 'lunas' && inv.status !== 'dibatalkan' && (
                        <button
                          onClick={() => handleBayarOnline(inv)}
                          disabled={isMembuatLink !== null}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isMembuatLink === inv.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Membuat tautan...
                            </>
                          ) : (
                            <>
                              Bayar Online
                            </>
                          )}
                        </button>
                      )}

                      {/* Pengelola: Catat Pembayaran — opsi tunai; setelah simpan,
                          status & terbayar tagihan otomatis diperbarui di sistem */}
                      {role === 'pengelola' && inv.status !== 'lunas' && inv.status !== 'dibatalkan' && (
                        <button
                          onClick={() => {
                            setPayingInvoice(inv);
                            setPayAmount(inv.sisa_tagihan || 0);
                            setPayMethod('tunai'); // default opsi tunai
                            if (buktiPreview) URL.revokeObjectURL(buktiPreview);
                            setBuktiFile(null);
                            setBuktiPreview(null);
                            setPayModalError(null);
                          }}
                          className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-1"
                        >
                          Catat Pembayaran
                        </button>
                      )}

                      {/* Pemilik: batalkan tagihan menggantikan Bayar Online —
                          status berubah menjadi "Dibatalkan" otomatis di sistem
                          (hanya tagihan yang belum dibayar sama sekali) */}
                      {role === 'pemilik' && inv.terbayar === 0 && inv.status !== 'dibatalkan' && (
                        <button
                          onClick={() => {
                            setCancelingInvoice(inv);
                            setInvoiceCancelError(null);
                          }}
                          title="Batalkan tagihan yang belum dibayar (status menjadi Dibatalkan)"
                          className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-1"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-2 px-4">
                    <EmptyState
                      icon={Receipt}
                      title="Belum Ada Tagihan"
                      description="Tidak ada tagihan untuk periode yang dipilih. Tagihan bulanan akan muncul setelah dibuat oleh pengelola."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Pembayaran (Pengelola) */}
      {payingInvoice && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Catat Pembayaran Sewa
            </h3>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={payModalError}
              onDismiss={() => setPayModalError(null)}
            />

            <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice:</span>
                <span className="font-bold text-foreground">{payingInvoice.nomor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penyewa:</span>
                <span className="font-bold text-foreground">{payingInvoice.kontrak?.penyewa?.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pokok Sewa:</span>
                <span className="font-medium text-foreground">{formatRupiah(payingInvoice.nominal_sewa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Denda Keterlambatan:</span>
                <span className="font-bold text-rose-600">{formatRupiah(payingInvoice.denda)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="font-semibold text-foreground">Sisa Tagihan Saat Ini:</span>
                <span className="font-extrabold text-primary">{formatRupiah(payingInvoice.sisa_tagihan || 0)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Jumlah Pembayaran (Rp)
                </label>
                <input
                  type="number"
                  step="50000"
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(Number(e.target.value));
                    if (payModalError) setPayModalError(null);
                  }}
                  className="w-full text-sm font-semibold border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Minimal Rp100.000 per cicilan (kecuali untuk melunasi sisa tagihan) dan tidak boleh melebihi sisa tagihan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Metode</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                  >
                    <option value="tunai">Tunai (Cash)</option>
                    <option value="transfer">Transfer Bank</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>
              </div>

              {payMethod === 'transfer' && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Lampiran Bukti Transfer (JPG/PNG/WEBP, Maks 2MB) — Wajib
                  </label>
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_ATTR}
                    onChange={handleBuktiSelect}
                    className="w-full text-xs text-muted-foreground border border-border rounded-xl px-3 py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-primary/90 cursor-pointer bg-card"
                    aria-label="Pilih foto bukti transfer"
                  />
                  {buktiError && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                      {buktiError}
                    </p>
                  )}
                  {buktiPreview && (
                    <div className="mt-2 flex items-center gap-3 border border-dashed border-border p-2.5 rounded-xl bg-muted/50">
                      <img
                        src={buktiPreview}
                        alt="Pratinjau bukti transfer"
                        className="w-20 h-14 object-cover rounded-lg border border-border"
                      />
                      <div className="text-xs min-w-0 flex-1">
                        <span className="font-semibold text-foreground block truncate">{buktiFile?.name}</span>
                        <span className="text-muted-foreground">
                          {buktiFile?.size ? `${(buktiFile.size / 1024).toFixed(0)} KB — siap diunggah` : ''}
                        </span>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
                        Terpilih
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setPayingInvoice(null);
                  setPayModalError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={isSavingPayment}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                {isSavingPayment ? 'Mengunggah...' : 'Simpan Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Batalkan Tagihan (Pemilik) */}
      {cancelingInvoice && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" /> Batalkan Tagihan {cancelingInvoice.nomor}
            </h3>
            <p className="text-xs text-muted-foreground">
              Tagihan hanya bisa dibatalkan Pemilik dan hanya bila belum memiliki catatan pembayaran sama sekali. Tindakan ini mengubah status tagihan menjadi "Dibatalkan".
            </p>

            {/* Error Alert Standar Modal: kegagalan tidak di-swallow */}
            <ModalErrorAlert
              error={invoiceCancelError}
              onDismiss={() => setInvoiceCancelError(null)}
            />

            <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice:</span>
                <span className="font-bold text-foreground">{cancelingInvoice.nomor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penyewa:</span>
                <span className="font-bold text-foreground">{cancelingInvoice.kontrak?.penyewa?.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nominal:</span>
                <span className="font-bold text-foreground">{formatRupiah(cancelingInvoice.nominal_sewa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terbayar:</span>
                <span className="font-bold text-primary">{formatRupiah(cancelingInvoice.terbayar)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCancelingInvoice(null);
                  setInvoiceCancelError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Kembali
              </button>
              <button
                onClick={handleCancelInvoice}
                disabled={isCancellingInvoice}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                {isCancellingInvoice ? 'Membatalkan...' : 'Ya, Batalkan Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Generate Tagihan Bulanan (Pengelola/Pemilik) */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary" /> Buat Tagihan Bulanan
            </h3>
            <p className="text-xs text-muted-foreground">
              Pilih periode yang ingin anda buat.
            </p>

            {/* Error Alert Standar Modal: kegagalan tidak di-swallow */}
            <ModalErrorAlert
              error={generateError}
              onDismiss={() => setGenerateError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Periode Tagihan
              </label>
              <input
                type="month"
                value={generatePeriod}
                onChange={(e) => {
                  setGeneratePeriod(e.target.value);
                  if (generateError) setGenerateError(null);
                }}
                className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setGenerateError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateInvoices}
                disabled={isGenerating || !/^\d{4}-\d{2}$/.test(generatePeriod)}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm flex items-center gap-2"
              >
                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                {isGenerating ? 'Memproses...' : 'Buat Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bayar Online via Mayar (Penyewa, US-06) */}
      {onlinePayInvoice && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" /> Bayar Online — {onlinePayInvoice.nomor}
            </h3>
            <p className="text-xs text-muted-foreground">
              Pembayaran diproses melalui payment gateway <strong>Mayar</strong> (US-06). Nominal mengikuti sisa
              tagihan termasuk denda yang berjalan. Setelah membayar, klik "Saya Sudah Bayar" untuk memuat ulang
              status tagihan.
            </p>

            {/* Error Alert Standar Modal: kegagalan tidak di-swallow */}
            <ModalErrorAlert
              error={onlinePayError}
              onDismiss={() => setOnlinePayError(null)}
            />

            {!onlinePayResult ? (
              <>
                <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice:</span>
                    <span className="font-bold text-foreground">{onlinePayInvoice.nomor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sisa Tagihan (bayar penuh):</span>
                    <span className="font-extrabold text-primary">
                      {formatRupiah(onlinePayInvoice.sisa_tagihan || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Metode:</span>
                    <span className="font-bold text-foreground">Online (Mayar)</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setOnlinePayInvoice(null);
                      setOnlinePayError(null);
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleStartOnlinePay}
                    disabled={isStartingOnlinePay}
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm flex items-center gap-2"
                  >
                    {isStartingOnlinePay && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isStartingOnlinePay ? 'Menyiapkan...' : 'Lanjutkan ke Pembayaran'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Link Pembayaran:</span>
                    <span className="font-bold text-indigo-700 truncate max-w-[220px]">
                      {onlinePayResult.link}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nominal:</span>
                    <span className="font-extrabold text-primary">{formatRupiah(onlinePayResult.sisa)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <span className="font-semibold text-foreground">
                      {onlinePayResult.mode === 'mayar' ? 'Mayar (asli)' : 'Sandbox Demo'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleRefreshStatus}
                    disabled={isRefreshingStatus}
                    className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm flex items-center gap-2"
                  >
                    {isRefreshingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isRefreshingStatus ? 'Memuat...' : 'Saya Sudah Bayar'}
                  </button>
                  <a
                    href={onlinePayResult.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm"
                  >
                    Buka Halaman Bayar
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
