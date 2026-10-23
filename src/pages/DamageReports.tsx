import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { LaporanKerusakan } from '../types/database';
import { formatRupiah } from '../utils/business-rules';
import {
  ACCEPTED_IMAGE_ATTR,
  MAX_IMAGE_SIZE_MB,
  validateImageFile,
  uploadImage,
  isHttpUrl,
  STORAGE_BUCKETS,
} from '../api/storage';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { parseErrorMessage } from '../utils/error-handler';
import {
  Wrench,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Camera,
  Check,
  X,
} from 'lucide-react';

export const DamageReports: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [reports, setReports] = useState<LaporanKerusakan[]>(() => dataStore.getDamageReports());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Buat Laporan Baru (Penyewa)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('air');
  const [deskripsi, setDeskripsi] = useState('');
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Modal Proses Laporan (Pengelola)
  const [processingReport, setProcessingReport] = useState<LaporanKerusakan | null>(null);
  const [estimasiBiaya, setEstimasiBiaya] = useState<number>(100000);
  const [processModalError, setProcessModalError] = useState<string | null>(null);

  const filteredReports = reports.filter(r => {
    if (role === 'penyewa') {
      return r.pelapor_id === currentUser?.id;
    }
    return true;
  });

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    setFotoError(null);
    if (picked.length === 0) return;

    // Batas 3 foto (BR PRD: 1 s/d 3 foto per laporan)
    const room = 3 - fotoFiles.length;
    if (room <= 0) {
      setFotoError('Maksimal 3 foto per laporan kerusakan.');
      e.target.value = '';
      return;
    }

    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    const errors: string[] = [];
    for (const file of picked.slice(0, room)) {
      const err = validateImageFile(file);
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    if (picked.length > room) {
      errors.push(`Maksimal 3 foto per laporan kerusakan (hanya ${room} foto pertama ditambahkan).`);
    }
    if (errors.length > 0) setFotoError(errors.join(' '));
    e.target.value = '';
    if (newFiles.length > 0) {
      setFotoFiles(prev => [...prev, ...newFiles]);
      setFotoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const resetFotoInputs = () => {
    fotoPreviews.forEach(p => URL.revokeObjectURL(p));
    setFotoFiles([]);
    setFotoPreviews([]);
    setFotoError(null);
  };

  const handleCreateReport = async () => {
    if (!currentUser) return;
    try {
      setIsSavingReport(true);
      setCreateModalError(null);
      // Dapatkan unit id dari kontrak aktif penyewa
      const activeContract = dataStore.getContracts().find(
        k => k.penyewa_id === currentUser.id && k.status === 'aktif'
      );
      if (!activeContract) {
        throw new Error('Anda tidak memiliki kontrak sewa aktif saat ini.');
      }
      if (!judul.trim()) {
        throw new Error('Judul kerusakan wajib diisi.');
      }
      if (fotoFiles.length < 1) {
        throw new Error('Laporan kerusakan wajib melampirkan minimal 1 foto.');
      }

      // Unggah 1-3 foto ke bucket publik laporan_kerusakan
      const uploaded: string[] = [];
      for (let i = 0; i < fotoFiles.length; i++) {
        const doc = await uploadImage({
          bucket: STORAGE_BUCKETS.laporanKerusakan,
          userId: currentUser.id,
          kind: 'kerusakan',
          file: fotoFiles[i],
          index: i + 1,
        });
        uploaded.push(doc.url); // URL publik permanen
      }

      const newReport = await dataStore.createDamageReport({
        unit_id: activeContract.unit_id,
        kategori,
        judul,
        deskripsi,
        foto_paths: uploaded,
        actor: currentUser,
      });

      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Laporan kerusakan ${newReport.nomor} berhasil dilaporkan. Pengelola akan segera memeriksa.`,
      });
      setShowCreateModal(false);
      setJudul('');
      setDeskripsi('');
      resetFotoInputs();
      setCreateModalError(null);
    } catch (err: any) {
      setCreateModalError(parseErrorMessage(err));
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleProcessReport = () => {
    if (!processingReport || !currentUser) return;
    try {
      setProcessModalError(null);
      dataStore.processDamageReport(processingReport.id, estimasiBiaya, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Laporan ${processingReport.nomor} berhasil diproses dengan estimasi biaya ${formatRupiah(estimasiBiaya)} (${estimasiBiaya > 1000000 ? 'Status: Menunggu Persetujuan Pemilik' : 'Status: Diproses'}).`,
      });
      setProcessingReport(null);
      setProcessModalError(null);
    } catch (err: any) {
      setProcessModalError(parseErrorMessage(err));
    }
  };

  const handleApproveReport = (report: LaporanKerusakan) => {
    if (!currentUser) return;
    try {
      dataStore.approveDamageReport(report.id, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Biaya perbaikan laporan ${report.nomor} berhasil disetujui Pemilik.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    }
  };

  const handleCloseReport = (report: LaporanKerusakan) => {
    if (!currentUser) return;
    try {
      dataStore.closeDamageReport(report.id, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Laporan kerusakan ${report.nomor} telah resmi ditutup (selesai).`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dilaporkan':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Dilaporkan</span>;
      case 'menunggu_persetujuan':
        return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Menunggu Persetujuan Pemilik</span>;
      case 'diproses':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Diproses</span>;
      case 'selesai':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Selesai (Siap Ditutup)</span>;
      case 'ditutup':
        return <span className="bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Ditutup</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-600" /> Laporan Kerusakan & Perbaikan Unit
          </h1>
          <p className="text-sm text-slate-500">
            Biaya di atas Rp1.000.000 wajib persetujuan Pemilik. Maksimal 3 laporan terbuka per penyewa.
          </p>
        </div>

        {/* Action Button: Laporkan Kerusakan (Penyewa) */}
        {role === 'penyewa' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Buat Laporan Kerusakan
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

      {/* Grid Laporan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs font-bold text-slate-700">{r.nomor}</span>
                {getStatusBadge(r.status)}
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm">{r.judul}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unit: <span className="font-semibold text-slate-700">{r.unit?.kode}</span> · Pelapor: {r.pelapor?.nama_lengkap}
                </p>
              </div>

              {r.deskripsi && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {r.deskripsi}
                </p>
              )}

              <div className="text-xs text-slate-500 space-y-1 pt-2">
                <div className="flex justify-between">
                  <span>Kategori:</span>
                  <span className="font-medium text-slate-700 capitalize">{r.kategori}</span>
                </div>
                <div className="flex justify-between">
                  <span>Foto Terlampir:</span>
                  <span className="text-emerald-700 font-medium">{r.foto_paths?.length || 1} Foto (JPG/PNG)</span>
                </div>
                {isHttpUrl(r.foto_paths?.[0]) && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {r.foto_paths?.filter(isHttpUrl).slice(0, 3).map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" title="Lihat foto penuh">
                        <img
                          src={url}
                          alt={`Foto kerusakan ${i + 1}`}
                          className="w-full h-16 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {r.estimasi_biaya && (
                  <div className="flex justify-between">
                    <span>Estimasi Biaya:</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(r.estimasi_biaya)}</span>
                  </div>
                )}
                {r.biaya_aktual && (
                  <div className="flex justify-between">
                    <span>Biaya Aktual:</span>
                    <span className="font-bold text-emerald-700">{formatRupiah(r.biaya_aktual)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              {/* Pengelola: Input Estimasi Biaya */}
              {role === 'pengelola' && r.status === 'dilaporkan' && (
                <button
                  onClick={() => {
                    setProcessingReport(r);
                    setEstimasiBiaya(100000);
                  }}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Proses & Isi Biaya
                </button>
              )}

              {/* Pemilik: Setujui Biaya > 1.000.000 (BR-12) */}
              {role === 'pemilik' && r.status === 'menunggu_persetujuan' && (
                <button
                  onClick={() => handleApproveReport(r)}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Setujui Biaya ({formatRupiah(r.estimasi_biaya || 0)})
                </button>
              )}

              {/* Penyewa & Pengelola: Tutup Laporan Selesai */}
              {['diproses', 'selesai'].includes(r.status) && (
                <button
                  onClick={() => handleCloseReport(r)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Tutup Laporan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Buat Laporan Kerusakan (Penyewa) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600" /> Buat Laporan Kerusakan Kamar
            </h3>
            <p className="text-xs text-slate-500">
              Lampirkan 1 sampai 3 foto bukti kerusakan (format JPG/PNG). Maksimal 3 laporan kerusakan terbuka per penyewa.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={createModalError}
              onDismiss={() => setCreateModalError(null)}
            />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kategori Kerusakan</label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="air">Sanitasi / Pipa Air</option>
                  <option value="listrik">Listrik & Lampu</option>
                  <option value="ac">AC & Pendingin</option>
                  <option value="furniture">Perabot & Pintu</option>
                  <option value="struktur">Tembok / Atap Bocor</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Judul Kerusakan</label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => {
                    setJudul(e.target.value);
                    if (createModalError) setCreateModalError(null);
                  }}
                  placeholder="Contoh: Keran wastafel patah dan bocor"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Deskripsi Detail</label>
                <textarea
                  rows={2}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Jelaskan kondisi kerusakan agar staf dapat menyiapkan suku cadang yang tepat..."
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Foto Bukti Kerusakan (1 - 3 Foto, JPG/PNG/WEBP, Maks {MAX_IMAGE_SIZE_MB}MB per foto)
                </label>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_ATTR}
                  onChange={handleFilesSelect}
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-xl px-3 py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-emerald-700 cursor-pointer bg-white"
                  aria-label="Pilih foto bukti kerusakan"
                />
                {fotoError && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                    {fotoError}
                  </p>
                )}
                {fotoPreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {fotoPreviews.map((url, idx) => (
                      <div key={url} className="relative group">
                        <img
                          src={url}
                          alt={`Pratinjau foto ${idx + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(url);
                            setFotoFiles(prev => prev.filter((_, i) => i !== idx));
                            setFotoPreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          title="Hapus foto ini"
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white text-[10px] flex items-center justify-center hover:bg-rose-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  {fotoFiles.length} dari 3 foto dipilih
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetFotoInputs();
                  setCreateModalError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleCreateReport}
                disabled={isSavingReport}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                {isSavingReport ? 'Mengunggah foto...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Proses Laporan (Pengelola) */}
      {processingReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Proses Laporan {processingReport.nomor}</h3>
            <p className="text-xs text-slate-500">
              Estimasi biaya di atas Rp1.000.000 wajib disetujui Pemilik sebelum dikerjakan. Estimasi hingga Rp1.000.000 dapat langsung diproses.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={processModalError}
              onDismiss={() => setProcessModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Estimasi Biaya Perbaikan (Rp)
              </label>
              <input
                type="number"
                step="50000"
                value={estimasiBiaya}
                onChange={(e) => {
                  setEstimasiBiaya(Number(e.target.value));
                  if (processModalError) setProcessModalError(null);
                }}
                className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setProcessingReport(null);
                  setProcessModalError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleProcessReport}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Simpan & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
