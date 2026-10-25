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
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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

/** Opsi Tabs filter status — "semua" menampilkan seluruh data dummy apa adanya. */
const TAB_STATUS = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'menunggu_persetujuan', label: 'Menunggu Persetujuan' },
  { nilai: 'diproses', label: 'Diproses' },
  { nilai: 'selesai', label: 'Selesai' },
] as const;

type TabStatus = (typeof TAB_STATUS)[number]['nilai'];
/** Kategori filter memakai NILAI data dummy (air/listrik/ac/perabot/bangunan),
 *  dengan label ramah yang mencakup nama kategori yang diminta pengguna. */
type KategoriFilter = 'semua' | 'air' | 'listrik' | 'ac' | 'perabot' | 'bangunan' | 'lainnya';

export const DamageReports: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [reports, setReports] = useState<LaporanKerusakan[]>(() => dataStore.getDamageReports());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // === Filter berlapis (kombinasi): Tabs status + Select kategori ===
  const [tabAktif, setTabAktif] = useState<TabStatus>('semua');
  const [kategoriAktif, setKategoriAktif] = useState<KategoriFilter>('semua');

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
  // estimasiBiaya memakai string agar field kosong saat modal dibuka
  // (tidak ada angka 0 muncul di depan), dikonversi ke Number saat submit.
  const [processingReport, setProcessingReport] = useState<LaporanKerusakan | null>(null);
  const [estimasiBiaya, setEstimasiBiaya] = useState<string>('');
  const [processModalError, setProcessModalError] = useState<string | null>(null);

  // Modal Tolak Laporan (Pengelola) — alasan penolakan wajib (textarea)
  const [rejectingReport, setRejectingReport] = useState<LaporanKerusakan | null>(null);
  const [alasanTolak, setAlasanTolak] = useState('');
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  // Logika filter berlapis: data harus memenuhi SEMUA kondisi sekaligus —
  // hak akses peran (RLS-ekuivalen) DAN tab status DAN kategori.
  // Data dummy tidak diubah; hanya fungsi .filter() pada daftar laporan.
  const filteredReports = reports
    .filter((r) => (role === 'penyewa' ? r.pelapor_id === currentUser?.id : true))
    .filter((r) => (tabAktif === 'semua' ? true : r.status === tabAktif))
    .filter((r) => (kategoriAktif === 'semua' ? true : r.kategori === kategoriAktif));

  const adaFilterAktif = tabAktif !== 'semua' || kategoriAktif !== 'semua';

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

  const handleProcessReport = async () => {
    if (!processingReport || !currentUser) return;
    try {
      setProcessModalError(null);
      // Konversi string input → Number; bila kosong/invalid, tolak sebelum ke service
      const biaya = Number(estimasiBiaya);
      if (estimasiBiaya.trim() === '' || !Number.isFinite(biaya) || biaya <= 0) {
        setProcessModalError('Estimasi biaya wajib diisi dengan angka lebih dari 0.');
        return;
      }
      await dataStore.processDamageReport(processingReport.id, biaya, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Laporan ${processingReport.nomor} berhasil diproses dengan estimasi biaya ${formatRupiah(biaya)} (${biaya > 1000000 ? 'Status: Menunggu Persetujuan Pemilik' : 'Status: Diproses'}).`,
      });
      setProcessingReport(null);
      setEstimasiBiaya('');
      setProcessModalError(null);
    } catch (err: any) {
      setProcessModalError(parseErrorMessage(err));
    }
  };

  const handleRejectReport = async () => {
    if (!rejectingReport || !currentUser) return;
    try {
      setRejectModalError(null);
      await dataStore.rejectDamageReport(rejectingReport.id, alasanTolak, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'error',
        text: `Laporan ${rejectingReport.nomor} ditolak Pengelola. Alasan: ${alasanTolak.trim()}`,
      });
      setRejectingReport(null);
      setAlasanTolak('');
      setRejectModalError(null);
    } catch (err: any) {
      setRejectModalError(parseErrorMessage(err));
    }
  };

  /** Pengelola menandai laporan 'diproses' selesai dikerjakan → status 'selesai'. */
  const handleCompleteReport = async (report: LaporanKerusakan) => {
    if (!currentUser) return;
    try {
      await dataStore.completeDamageReport(report.id, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Laporan ${report.nomor} ditandai selesai dikerjakan. Laporan kini dapat ditutup resmi.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    }
  };

  const handleApproveReport = async (report: LaporanKerusakan) => {
    if (!currentUser) return;
    try {
      await dataStore.approveDamageReport(report.id, currentUser);
      setReports(dataStore.getDamageReports());
      setMessage({
        type: 'success',
        text: `Biaya perbaikan laporan ${report.nomor} berhasil disetujui Pemilik.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    }
  };

  const handleCloseReport = async (report: LaporanKerusakan) => {
    if (!currentUser) return;
    try {
      await dataStore.closeDamageReport(report.id, currentUser);
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
        return <Badge variant="amber">Dilaporkan</Badge>;
      case 'menunggu_persetujuan':
        return <Badge variant="purple">Menunggu Persetujuan Pemilik</Badge>;
      case 'diproses':
        return <Badge variant="blue">Diproses</Badge>;
      case 'selesai':
        return <Badge variant="emerald">Selesai (Siap Ditutup)</Badge>;
      case 'ditutup':
        return <Badge variant="muted">Ditutup</Badge>;
      case 'ditolak':
        return <Badge variant="rose">Ditolak</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Laporan Kerusakan & Perbaikan Unit
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau dan kelola pengajuan perbaikan fasilitas unit.
          </p>
        </div>

        {/* Action Button: Laporkan Kerusakan (Penyewa) */}
        {role === 'penyewa' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
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

      {/* ====== Header Card Filter: Tabs (kiri) + Select (kanan) ====== */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Tabs Filter Status — kiri (gaya /kontrak: aktif = hitam tanpa kolom abu) */}
          <div className="flex gap-2 border-b border-border pb-2 text-xs font-semibold overflow-x-auto">
            {TAB_STATUS.map((tab) => (
              <button
                key={tab.nilai}
                onClick={() => setTabAktif(tab.nilai)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  tabAktif === tab.nilai
                    ? 'bg-foreground text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1 text-[10px] ${
                    tabAktif === tab.nilai ? 'text-white/70' : 'text-muted-foreground'
                  }`}
                >
                  {reports
                    .filter((r) => (role === 'penyewa' ? r.pelapor_id === currentUser?.id : true))
                    .filter((r) => (tab.nilai === 'semua' ? true : r.status === tab.nilai)).length}
                </span>
              </button>
            ))}
          </div>

          {/* Select Kategori — kanan */}
          <Select value={kategoriAktif} onValueChange={(v) => setKategoriAktif(v as KategoriFilter)}>
            <SelectTrigger
              aria-label="Filter kategori laporan"
              className="h-9 w-[180px] rounded-xl text-xs bg-muted focus:ring-0"
            >
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kategori</SelectItem>
              <SelectItem value="air">Sanitasi / Pipa</SelectItem>
              <SelectItem value="listrik">Listrik</SelectItem>
              <SelectItem value="ac">Elektronik / AC</SelectItem>
              <SelectItem value="perabot">Perabot</SelectItem>
              <SelectItem value="bangunan">Bangunan</SelectItem>
              <SelectItem value="lainnya">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid Laporan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.length === 0 && (
          <EmptyState
            icon={Wrench}
            title="Belum Ada Laporan Kerusakan"
            description={
              adaFilterAktif
                ? 'Tidak ada laporan yang cocok dengan kombinasi filter aktif (tab status dan kategori).'
                : 'Tidak ada laporan pada daftar ini. Laporan baru muncul setelah penyewa melaporkan kerusakan unit.'
            }
            className="md:col-span-2 lg:col-span-3"
          />
        )}
        {filteredReports.map((r) => (
          <div
            key={r.id}
            className="bg-card rounded-2xl border border-border p-5 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs font-bold text-foreground">{r.nomor}</span>
                {getStatusBadge(r.status)}
              </div>

              <div>
                <h3 className="font-bold text-foreground text-sm">{r.judul}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unit: <span className="font-semibold text-foreground">{r.unit?.kode}</span> · Pelapor: {r.pelapor?.nama_lengkap}
                </p>
              </div>

              {r.deskripsi && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl border border-border">
                  {r.deskripsi}
                </p>
              )}

              {/* Alasan penolakan — ditampilkan agar penyewa memahami keputusan */}
              {r.status === 'ditolak' && r.alasan_penolakan && (
                <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <span className="font-semibold">Alasan penolakan:</span> {r.alasan_penolakan}
                </p>
              )}

              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <div className="flex justify-between">
                  <span>Kategori:</span>
                  <span className="font-medium text-foreground capitalize">{r.kategori}</span>
                </div>
                <div className="flex justify-between">
                  <span>Foto Terlampir:</span>
                  <span className="text-primary font-medium">{r.foto_paths?.length || 1} Foto (JPG/PNG)</span>
                </div>
                {isHttpUrl(r.foto_paths?.[0]) && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {r.foto_paths?.filter(isHttpUrl).slice(0, 3).map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" title="Lihat foto penuh">
                        <img
                          src={url}
                          alt={`Foto kerusakan ${i + 1}`}
                          className="w-full h-16 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
                {r.estimasi_biaya && (
                  <div className="flex justify-between">
                    <span>Estimasi Biaya:</span>
                    <span className="font-semibold text-foreground">{formatRupiah(r.estimasi_biaya)}</span>
                  </div>
                )}
                {r.biaya_aktual && (
                  <div className="flex justify-between">
                    <span>Biaya Aktual:</span>
                    <span className="font-bold text-primary">{formatRupiah(r.biaya_aktual)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              {/* Pengelola: Input Estimasi Biaya / Tolak */}
              {role === 'pengelola' && r.status === 'dilaporkan' && (
                <>
                  <button
                    onClick={() => {
                      setProcessingReport(r);
                      setEstimasiBiaya('');
                    }}
                    className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold shadow-sm"
                  >
                    Proses & Isi Biaya
                  </button>
                  <button
                    onClick={() => {
                      setRejectingReport(r);
                      setAlasanTolak('');
                      setRejectModalError(null);
                    }}
                    className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold transition-colors"
                  >
                    Tolak
                  </button>
                </>
              )}

              {/* Pemilik: Setujui Biaya > 1.000.000 (BR-12) */}
              {role === 'pemilik' && r.status === 'menunggu_persetujuan' && (
                <button
                  onClick={() => handleApproveReport(r)}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Setujui Biaya
                </button>
              )}

              {/* Pengelola: Tandai Selesai (diproses → selesai), di kiri Tutup Laporan */}
              {role === 'pengelola' && r.status === 'diproses' && (
                <button
                  onClick={() => handleCompleteReport(r)}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Selesai
                </button>
              )}

              {/* Penyewa & Pengelola: Tutup Laporan Selesai */}
              {['diproses', 'selesai'].includes(r.status) && (
                <button
                  onClick={() => handleCloseReport(r)}
                  className="px-3 py-1.5 text-xs bg-muted hover:bg-border text-foreground rounded-lg font-semibold"
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
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" /> Buat Laporan Kerusakan Kamar
            </h3>
            <p className="text-xs text-muted-foreground">
              Lampirkan 1 sampai 3 foto bukti kerusakan (format JPG/PNG). Maksimal 3 laporan kerusakan terbuka per penyewa.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={createModalError}
              onDismiss={() => setCreateModalError(null)}
            />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Kategori Kerusakan</label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {/* Nilai WAJIB sama dengan kategori di data contoh/database
                      (air/listrik/ac/perabot/bangunan/lainnya) agar filter
                      kategori bisa melacak laporan baru */}
                  <option value="air">Sanitasi / Pipa Air</option>
                  <option value="listrik">Listrik & Lampu</option>
                  <option value="ac">AC & Pendingin</option>
                  <option value="perabot">Perabot & Pintu</option>
                  <option value="bangunan">Tembok / Atap Bocor</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Judul Kerusakan</label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => {
                    setJudul(e.target.value);
                    if (createModalError) setCreateModalError(null);
                  }}
                  placeholder="Contoh: Keran wastafel patah dan bocor"
                  className="w-full text-xs border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Deskripsi Detail</label>
                <textarea
                  rows={2}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Jelaskan kondisi kerusakan agar staf dapat menyiapkan suku cadang yang tepat..."
                  className="w-full text-xs border border-border rounded-xl p-2.5 focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Foto Bukti Kerusakan (1 - 3 Foto, JPG/PNG/WEBP, Maks {MAX_IMAGE_SIZE_MB}MB per foto)
                </label>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_ATTR}
                  onChange={handleFilesSelect}
                  className="w-full text-xs text-muted-foreground border border-border rounded-xl px-3 py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-primary/90 cursor-pointer bg-card"
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
                          className="w-full h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(url);
                            setFotoFiles(prev => prev.filter((_, i) => i !== idx));
                            setFotoPreviews(prev => prev.filter((_, i) => i !== idx));
                          }}
                          title="Hapus foto ini"
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/70 text-white text-[10px] flex items-center justify-center hover:bg-rose-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
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
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleCreateReport}
                disabled={isSavingReport}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                {isSavingReport ? 'Mengunggah foto...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Proses Laporan (Pengelola) */}
      {processingReport && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Proses Laporan {processingReport.nomor}</h3>
            <p className="text-xs text-muted-foreground">
              Estimasi biaya di atas Rp1.000.000 wajib disetujui Pemilik sebelum dikerjakan. Estimasi hingga Rp1.000.000 dapat langsung diproses.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={processModalError}
              onDismiss={() => setProcessModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Estimasi Biaya Perbaikan (Rp)
              </label>
              <input
                type="number"
                step="50000"
                min="0"
                placeholder="Contoh: 500000"
                value={estimasiBiaya}
                onChange={(e) => {
                  // Number() menghapus 0 di depan (mis. "0500000" → "500000")
                  // dan menjaga fokus pada angka valid saja.
                  const raw = e.target.value;
                  setEstimasiBiaya(raw === '' ? '' : /^[0-9]+$/.test(raw) ? String(Number(raw)) : raw);
                  if (processModalError) setProcessModalError(null);
                }}
                className="w-full text-sm font-semibold border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setProcessingReport(null);
                  setProcessModalError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleProcessReport}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-sm"
              >
                Simpan & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Tolak Laporan (Pengelola) — alasan penolakan wajib */}
      {rejectingReport && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Tolak Laporan {rejectingReport.nomor}</h3>
            <p className="text-xs text-muted-foreground">
              Laporan akan berstatus Ditolak dan tidak dikerjakan. Sertakan alasan yang jelas agar penyewa memahami keputusan ini.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={rejectModalError}
              onDismiss={() => setRejectModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Alasan Penolakan <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={alasanTolak}
                onChange={(e) => {
                  setAlasanTolak(e.target.value);
                  if (rejectModalError) setRejectModalError(null);
                }}
                placeholder="Contoh: Kerusakan bukan tanggung jawab pengelola karena terjadi setelah perubahan yang dilakukan penyewa..."
                aria-label="Alasan penolakan laporan"
                className="w-full text-xs border border-border rounded-xl p-2.5 focus:ring-2 focus:ring-ring focus:outline-none resize-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Wajib diisi, minimal 10 karakter.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectingReport(null);
                  setAlasanTolak('');
                  setRejectModalError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleRejectReport}
                disabled={alasanTolak.trim().length < 10}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm"
              >
                Tolak Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
