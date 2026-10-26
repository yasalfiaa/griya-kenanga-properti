import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Kontrak, Unit, Profile } from '../types/database';
import { formatRupiah, calculateContractEndDate, isContractOverlapping } from '../utils/business-rules';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { parseErrorMessage } from '../utils/error-handler';
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

export const Contracts: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [contracts, setContracts] = useState<Kontrak[]>(() => dataStore.getContracts());
  const [units, setUnits] = useState<Unit[]>(() => dataStore.getUnits());
  const [tenants] = useState<Profile[]>(() =>
    dataStore.getTenants().map(t => t.profile)
  );

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Kontrak Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedPenyewaId, setSelectedPenyewaId] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState('2026-11-01'); // Mulai tanggal 1
  const [durasiBulan, setDurasiBulan] = useState<1 | 3 | 6 | 12>(6);

  // Validasi real-time untuk modal buat kontrak
  const [modalSubmitError, setModalSubmitError] = useState<string | null>(null);

  const modalValidationErrors = useMemo((): string[] => {
    const errors: string[] = [];

    // Validasi: Unit & calon penyewa wajib dipilih
    if (!selectedUnitId) {
      errors.push('Pilih unit yang masih berstatus "tersedia".');
    }
    if (!selectedPenyewaId) {
      errors.push('Pilih calon penyewa dari daftar.'); 
    }

    // Validasi: Hanya unit berstatus 'tersedia'
    if (selectedUnitId) {
      const unit = units.find(u => u.id === selectedUnitId);
      if (unit && unit.status !== 'tersedia') {
        errors.push(
          `Unit ${unit.kode} berstatus "${unit.status}". Kontrak sewa baru hanya dapat dibuat untuk unit yang berstatus "tersedia".`
        );
      }
    }

    // Validasi: Tanggal mulai sewa harus selalu tanggal 1 awal bulan
    if (tanggalMulai) {
      const parts = tanggalMulai.split('-');
      const tanggalHari = parseInt(parts[2], 10);
      if (tanggalHari !== 1) {
        errors.push(
          `Tanggal mulai sewa harus selalu tanggal 1 di awal bulan (contoh: ${parts[0]}-${parts[1]}-01).`
        );
      }
    }

    // Validasi: Tidak boleh ada periode kontrak tumpang tindih
    if (selectedUnitId && tanggalMulai) {
      const parts = tanggalMulai.split('-');
      const tanggalHari = parseInt(parts[2], 10);
      if (tanggalHari === 1) {
        const tanggalSelesai = calculateContractEndDate(tanggalMulai, durasiBulan);
        const kontrakUnit = contracts.filter(k => k.unit_id === selectedUnitId);
        if (isContractOverlapping(kontrakUnit, tanggalMulai, tanggalSelesai)) {
          const unit = units.find(u => u.id === selectedUnitId);
          errors.push(
            `Unit ${unit?.kode || selectedUnitId} sudah memiliki kontrak aktif atau draf pada periode ${tanggalMulai} s/d ${tanggalSelesai}. Periode sewa tidak boleh beririsan.`
          );
        }
      }
    }

    return errors;
  }, [selectedUnitId, tanggalMulai, durasiBulan, units, contracts]);

  const isFormIncomplete = !selectedUnitId || !selectedPenyewaId;
  const isSaveDisabled = isFormIncomplete || modalValidationErrors.length > 0;

  // Status aksi transaksional (tombol memakai spinner saat RPC berjalan)
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Modal Akhiri Kontrak (Pemilik)
  const [terminatingContract, setTerminatingContract] = useState<Kontrak | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateModalError, setTerminateModalError] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

  const filteredContracts = contracts.filter(c =>
    filterStatus === 'all' ? true : c.status === filterStatus
  );

  const handleCreateContract = async () => {
    if (!currentUser || isSaveDisabled) {
      return;
    }

    try {
      setIsSavingContract(true);
      setModalSubmitError(null);
      const newContract = await dataStore.createContract({
        unit_id: selectedUnitId,
        penyewa_id: selectedPenyewaId,
        tanggal_mulai: tanggalMulai,
        durasi_bulan: durasiBulan,
        actor: currentUser,
      });

      const unitKode = units.find(u => u.id === selectedUnitId)?.kode || selectedUnitId;
      setContracts(dataStore.getContracts());
      // Rapikan juga daftar unit (dropdown) bila statusnya berubah di DB
      setUnits(dataStore.getUnits());
      setMessage({
        type: 'success',
        text: `Kontrak draf baru ${newContract.nomor} berhasil dibuat untuk unit ${unitKode}.`,
      });
      setShowCreateModal(false);
      setSelectedUnitId('');
      setSelectedPenyewaId('');
      setModalSubmitError(null);
    } catch (err: any) {
      setModalSubmitError(parseErrorMessage(err));
    } finally {
      setIsSavingContract(false);
    }
  };

  const handleActivateContract = async (k: Kontrak) => {
    if (!currentUser) return;
    try {
      setActivatingId(k.id);
      await dataStore.activateContract(k.id, currentUser);
      setContracts(dataStore.getContracts());
      setUnits(dataStore.getUnits());
      setMessage({
        type: 'success',
        text: `Kontrak ${k.nomor} berhasil diaktifkan! Unit sekarang berstatus Dikontrak dan penyewa resmi Aktif.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: parseErrorMessage(err) });
    } finally {
      setActivatingId(null);
    }
  };

  const handleTerminateContract = async () => {
    if (!terminatingContract || !currentUser) return;
    try {
      setIsTerminating(true);
      setTerminateModalError(null);
      await dataStore.terminateContractEarly(terminatingContract.id, terminateReason, currentUser);
      setContracts(dataStore.getContracts());
      setUnits(dataStore.getUnits());
      setMessage({
        type: 'success',
        text: `Kontrak ${terminatingContract.nomor} berhasil diakhiri lebih awal oleh Pemilik (efektif akhir bulan).`,
      });
      setTerminatingContract(null);
      setTerminateReason('');
      setTerminateModalError(null);
    } catch (err: any) {
      setTerminateModalError(parseErrorMessage(err));
    } finally {
      setIsTerminating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktif':
        return <Badge variant="emerald">Aktif</Badge>;
      case 'draf':
        return <Badge variant="amber">Draf</Badge>;
      case 'selesai':
        return <Badge variant="blue">Selesai</Badge>;
      case 'diakhiri':
        return <Badge variant="rose">Diakhiri Pemilik</Badge>;
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
            Pengelolaan Kontrak Sewa
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola seluruh kesepakatan sewa dengan rapi.
          </p>
        </div>

        {role === 'pengelola' && (
          <button
            onClick={() => {
              setModalSubmitError(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Buat Kontrak Baru
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

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 text-xs font-semibold">
        {['all', 'aktif', 'draf', 'selesai', 'diakhiri'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
              filterStatus === st
                ? 'bg-foreground text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {st === 'all' ? 'Semua Kontrak' : st}
          </button>
        ))}
      </div>

      {/* Tabel Kontrak */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nomor & Unit</th>
                <th className="py-3.5 px-4">Penyewa</th>
                <th className="py-3.5 px-4">Periode & Durasi</th>
                <th className="py-3.5 px-4">Harga Sewa (Terkunci)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContracts.map((k) => (
                <tr key={k.id} className="hover:bg-muted/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-foreground">{k.nomor}</div>
                    <div className="text-xs text-muted-foreground">
                      Kamar: <span className="font-semibold text-primary">{k.unit?.kode}</span> ({k.unit?.tipe})
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-foreground">{k.penyewa?.nama_lengkap}</div>
                    <div className="text-xs text-muted-foreground">{k.penyewa?.email}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className="font-medium text-foreground">
                      {k.tanggal_mulai} s/d {k.tanggal_selesai}
                    </div>
                    <div className="text-muted-foreground">Durasi: {k.durasi_bulan} Bulan</div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    {formatRupiah(k.harga_sewa_bulanan)}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(k.status)}
                    {k.alasan_berakhir && (
                      <div className="text-[11px] text-rose-600 mt-1 italic">
                        Alasan: {k.alasan_berakhir}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Pengelola: Aktivasi Draf (BR-03) */}
                      {role === 'pengelola' && k.status === 'draf' && (
                        <button
                          onClick={() => handleActivateContract(k)}
                          disabled={activatingId === k.id}
                          className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-1"
                        >
                          {activatingId === k.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {activatingId === k.id ? 'Mengaktifkan...' : 'Aktivasi'}
                        </button>
                      )}

                      {/* Pemilik: Akhiri Lebih Awal (BR-05) */}
                      {role === 'pemilik' && k.status === 'aktif' && (
                        <button
                          onClick={() => {
                            setTerminatingContract(k);
                            setTerminateReason('');
                            setTerminateModalError(null);
                          }}
                          className="px-3 py-1.5 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-semibold border border-rose-200 transition-colors"
                        >
                          Akhiri Awal
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredContracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 px-4">
                    <EmptyState
                      icon={FileText}
                      title="Belum Ada Kontrak"
                      description="Belum ada kontrak sewa pada status yang dipilih. Buat kontrak baru dari unit yang tersedia untuk memulai."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Kontrak Baru (Pengelola) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Buat Kontrak Sewa Baru
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Hanya unit berstatus tersedia yang dapat dipilih, tanggal mulai sewa harus selalu tanggal 1 di awal bulan, dan periode sewa tidak boleh beririsan.
              </p>
            </div>

            {/* Gagal dari server/DB (BR sudah terpenuhi tapi ditolak sistem) -> alert standar */}
            <ModalErrorAlert
              error={modalSubmitError}
              onDismiss={() => setModalSubmitError(null)}
            />

            {/* Keterangan ramah pengguna berwarna merah saat aturan bisnis belum terpenuhi */}
            {modalValidationErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Syarat kontrak belum terpenuhi:</span>
                </div>
                <ul className="space-y-1.5 pl-5 list-disc list-outside text-xs text-rose-700 font-medium leading-relaxed">
                  {modalValidationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <div className="pl-5 pt-0.5 text-[11px] text-rose-600 italic">
                  Tombol "Simpan Kontrak Draf" tidak dapat diklik hingga syarat di atas terpenuhi.
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Pilih Unit (Tersedia)</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  <option value="">-- Pilih Unit --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.status !== 'tersedia'}>
                      {u.kode} (Lantai {u.lantai} - {u.tipe.toUpperCase()}) - {formatRupiah(u.harga_sewa_bulanan)}/bln [{u.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Pilih Calon Penyewa</label>
                <select
                  value={selectedPenyewaId}
                  onChange={(e) => setSelectedPenyewaId(e.target.value)}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  <option value="">-- Pilih Penyewa --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_lengkap} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Tanggal Mulai (Selalu tgl 1)
                  </label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Durasi Sewa</label>
                  <select
                    value={durasiBulan}
                    onChange={(e) => setDurasiBulan(Number(e.target.value) as any)}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
                  >
                    <option value={1}>1 Bulan</option>
                    <option value={3}>3 Bulan</option>
                    <option value={6}>6 Bulan</option>
                    <option value={12}>12 Bulan</option>
                  </select>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs text-muted-foreground">
                Tanggal Selesai Otomatis:{' '}
                <span className="font-bold text-foreground">
                  {calculateContractEndDate(tanggalMulai, durasiBulan)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setModalSubmitError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleCreateContract}
                disabled={isSaveDisabled || isSavingContract}
                title={
                  modalValidationErrors.length > 0
                    ? modalValidationErrors[0]
                    : isFormIncomplete
                    ? 'Pilih unit dan calon penyewa terlebih dahulu untuk menyimpan draf kontrak'
                    : 'Simpan kontrak baru sebagai draf'
                }
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-2"
              >
                {isSavingContract && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingContract ? 'Menyimpan...' : 'Simpan Kontrak Draf'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Akhiri Lebih Awal (Pemilik) */}
      {terminatingContract && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Akhiri Kontrak Lebih Awal
            </h3>
            <p className="text-xs text-muted-foreground">
              Pengakhiran lebih awal hanya dapat dilakukan oleh Pemilik, wajib disertai alasan yang jelas, dan berlaku efektif hingga akhir bulan berjalan.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={terminateModalError}
              onDismiss={() => setTerminateModalError(null)}
            />

            <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs space-y-1">
              <div>Nomor Kontrak: <span className="font-bold">{terminatingContract.nomor}</span></div>
              <div>Penyewa: <span className="font-bold">{terminatingContract.penyewa?.nama_lengkap}</span></div>
              <div>Unit: <span className="font-bold">{terminatingContract.unit?.kode}</span></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Alasan Pengakhiran Kontrak (Wajib)
              </label>
              <textarea
                rows={3}
                value={terminateReason}
                onChange={(e) => {
                  setTerminateReason(e.target.value);
                  if (terminateModalError) setTerminateModalError(null);
                }}
                placeholder="Contoh: Penyewa pindah tugas kerja lebih awal atas kesepakatan bersama."
                className="w-full text-xs border border-border rounded-xl p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setTerminatingContract(null);
                  setTerminateModalError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleTerminateContract}
                disabled={isTerminating}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm flex items-center gap-2"
              >
                {isTerminating && <Loader2 className="w-4 h-4 animate-spin" />}
                {isTerminating ? 'Mengakhiri...' : 'Konfirmasi Akhiri Kontrak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
