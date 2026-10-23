import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Tagihan, Pembayaran } from '../types/database';
import { formatRupiah } from '../utils/business-rules';
import {
  ACCEPTED_IMAGE_ATTR,
  validateImageFile,
  uploadImage,
  STORAGE_BUCKETS,
} from '../api/storage';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { parseErrorMessage } from '../utils/error-handler';
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
} from 'lucide-react';

export const Invoices: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [invoices, setInvoices] = useState<Tagihan[]>(() => dataStore.getInvoices());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const filteredInvoices = invoices.filter(inv => {
    const matchesPeriod = selectedPeriod === 'all' ? true : inv.periode.startsWith(selectedPeriod);
    if (role === 'penyewa') {
      return matchesPeriod && inv.kontrak?.penyewa_id === currentUser?.id;
    }
    return matchesPeriod;
  });

  const handleGenerateInvoices = () => {
    if (!currentUser) return;
    try {
      const createdCount = dataStore.generateMonthlyInvoices(`${selectedPeriod}-01`, currentUser);
      setInvoices(dataStore.getInvoices());
      if (createdCount > 0) {
        setMessage({
          type: 'success',
          text: `Berhasil membuat ${createdCount} tagihan baru untuk periode ${selectedPeriod} (Bebas duplikasi).`,
        });
      } else {
        setMessage({
          type: 'success',
          text: `Semua kontrak aktif untuk periode ${selectedPeriod} sudah memiliki tagihan. Tidak ada tagihan ganda yang dibuat.`,
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    }
  };

  const handleBuktiSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
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
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Lunas</span>;
      case 'sebagian':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Sebagian</span>;
      case 'belum_bayar':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Belum Bayar</span>;
      case 'dibatalkan':
      default:
        return <span className="bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Dibatalkan</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            {role === 'penyewa' ? 'Tagihan Sewa Saya' : 'Tagihan Bulanan & Kas Pembayaran'}
          </h1>
          <p className="text-sm text-slate-500">
            Jatuh tempo tanggal 10. Denda Rp20.000/hari (maks Rp200.000 per tagihan).
          </p>
        </div>

        {/* Action Button: Batch Generate Invoice (Pengelola) */}
        {role === 'pengelola' && (
          <button
            onClick={handleGenerateInvoices}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Buat Tagihan Bulanan (Sekali Klik)
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
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
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
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl text-xs font-semibold w-fit">
        <span className="text-slate-500 px-2">Periode Tagihan:</span>
        {['2026-10', '2026-09', '2026-08', 'all'].map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedPeriod === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {p === 'all' ? 'Semua Periode' : p}
          </button>
        ))}
      </div>

      {/* Tabel Tagihan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 text-xs">
                    {inv.nomor}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">
                      {inv.kontrak?.penyewa?.nama_lengkap || 'Penyewa'}
                    </div>
                    <div className="text-xs text-slate-500">
                      Kamar: <span className="font-semibold text-emerald-700">{inv.kontrak?.unit?.kode}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                    {inv.jatuh_tempo}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {formatRupiah(inv.nominal_sewa)}
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.denda > 0 ? (
                      <span className="text-rose-600 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded">
                        +{formatRupiah(inv.denda)}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Rp0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-700">
                    {formatRupiah(inv.terbayar)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {formatRupiah(inv.sisa_tagihan || 0)}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(inv.status)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Pengelola: Catat Pembayaran */}
                      {role === 'pengelola' && inv.status !== 'lunas' && inv.status !== 'dibatalkan' && (
                        <button
                          onClick={() => {
                            setPayingInvoice(inv);
                            setPayAmount(inv.sisa_tagihan || 0);
                            setPayModalError(null);
                          }}
                          className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition-colors"
                        >
                          Catat Bayar
                        </button>
                      )}

                      {/* Pemilik: Batalkan Tagihan (hanya jika belum bayar sama sekali) */}
                      {role === 'pemilik' && inv.terbayar === 0 && inv.status !== 'dibatalkan' && (
                        <button
                          onClick={() => {
                            setCancelingInvoice(inv);
                            setInvoiceCancelError(null);
                          }}
                          title="Batalkan tagihan yang belum dibayar"
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium border border-rose-200"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Pembayaran (Pengelola) */}
      {payingInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Catat Pembayaran Sewa
            </h3>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={payModalError}
              onDismiss={() => setPayModalError(null)}
            />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-bold text-slate-800">{payingInvoice.nomor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Penyewa:</span>
                <span className="font-bold text-slate-800">{payingInvoice.kontrak?.penyewa?.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pokok Sewa:</span>
                <span className="font-medium text-slate-800">{formatRupiah(payingInvoice.nominal_sewa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Denda Keterlambatan:</span>
                <span className="font-bold text-rose-600">{formatRupiah(payingInvoice.denda)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Sisa Tagihan Saat Ini:</span>
                <span className="font-extrabold text-emerald-700">{formatRupiah(payingInvoice.sisa_tagihan || 0)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
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
                  className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Minimal Rp100.000 per cicilan (kecuali untuk melunasi sisa tagihan) dan tidak boleh melebihi sisa tagihan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Metode</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="tunai">Tunai (Cash)</option>
                    <option value="transfer">Transfer Bank</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {payMethod === 'transfer' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Lampiran Bukti Transfer (JPG/PNG/WEBP, Maks 2MB) — Wajib
                  </label>
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_ATTR}
                    onChange={handleBuktiSelect}
                    className="w-full text-xs text-slate-600 border border-slate-300 rounded-xl px-3 py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-emerald-700 cursor-pointer bg-white"
                    aria-label="Pilih foto bukti transfer"
                  />
                  {buktiError && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                      {buktiError}
                    </p>
                  )}
                  {buktiPreview && (
                    <div className="mt-2 flex items-center gap-3 border border-dashed border-slate-300 p-2.5 rounded-xl bg-slate-50">
                      <img
                        src={buktiPreview}
                        alt="Pratinjau bukti transfer"
                        className="w-20 h-14 object-cover rounded-lg border border-slate-200"
                      />
                      <div className="text-xs min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 block truncate">{buktiFile?.name}</span>
                        <span className="text-slate-400">
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
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={isSavingPayment}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                {isSavingPayment ? 'Mengunggah...' : 'Simpan Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Batalkan Tagihan (Pemilik) */}
      {cancelingInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" /> Batalkan Tagihan {cancelingInvoice.nomor}
            </h3>
            <p className="text-xs text-slate-500">
              Tagihan hanya bisa dibatalkan Pemilik dan hanya bila belum memiliki catatan pembayaran sama sekali. Tindakan ini mengubah status tagihan menjadi "Dibatalkan".
            </p>

            {/* Error Alert Standar Modal: kegagalan tidak di-swallow */}
            <ModalErrorAlert
              error={invoiceCancelError}
              onDismiss={() => setInvoiceCancelError(null)}
            />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-bold text-slate-800">{cancelingInvoice.nomor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Penyewa:</span>
                <span className="font-bold text-slate-800">{cancelingInvoice.kontrak?.penyewa?.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nominal:</span>
                <span className="font-bold text-slate-800">{formatRupiah(cancelingInvoice.nominal_sewa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terbayar:</span>
                <span className="font-bold text-emerald-700">{formatRupiah(cancelingInvoice.terbayar)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setCancelingInvoice(null);
                  setInvoiceCancelError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
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
    </div>
  );
};
