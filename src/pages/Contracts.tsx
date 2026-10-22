import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Kontrak, Unit, Profile } from '../types/database';
import { formatRupiah, calculateContractEndDate } from '../utils/business-rules';
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const Contracts: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [contracts, setContracts] = useState<Kontrak[]>(() => dataStore.getContracts());
  const [units] = useState<Unit[]>(() => dataStore.getUnits());
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

  // Modal Akhiri Kontrak (Pemilik)
  const [terminatingContract, setTerminatingContract] = useState<Kontrak | null>(null);
  const [terminateReason, setTerminateReason] = useState('');

  const filteredContracts = contracts.filter(c =>
    filterStatus === 'all' ? true : c.status === filterStatus
  );

  const handleCreateContract = () => {
    if (!currentUser || !selectedUnitId || !selectedPenyewaId) {
      setMessage({ type: 'error', text: 'Mohon lengkapi semua kolom formulir kontrak.' });
      return;
    }

    try {
      const newContract = dataStore.createContract({
        unit_id: selectedUnitId,
        penyewa_id: selectedPenyewaId,
        tanggal_mulai: tanggalMulai,
        durasi_bulan: durasiBulan,
        actor: currentUser,
      });

      setContracts(dataStore.getContracts());
      setMessage({
        type: 'success',
        text: `Kontrak draf baru ${newContract.nomor} berhasil dibuat untuk unit ${newContract.unit_id}.`,
      });
      setShowCreateModal(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleActivateContract = (k: Kontrak) => {
    if (!currentUser) return;
    try {
      dataStore.activateContract(k.id, currentUser);
      setContracts(dataStore.getContracts());
      setMessage({
        type: 'success',
        text: `Kontrak ${k.nomor} berhasil diaktifkan. Unit sekarang resmi terisi!`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleTerminateContract = () => {
    if (!terminatingContract || !currentUser) return;
    try {
      dataStore.terminateContractEarly(terminatingContract.id, terminateReason, currentUser);
      setContracts(dataStore.getContracts());
      setMessage({
        type: 'success',
        text: `Kontrak ${terminatingContract.nomor} berhasil diakhiri lebih awal oleh Pemilik (efektif akhir bulan).`,
      });
      setTerminatingContract(null);
      setTerminateReason('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktif':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Aktif</span>;
      case 'draf':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Draf</span>;
      case 'selesai':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Selesai</span>;
      case 'diakhiri':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Diakhiri Pemilik</span>;
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
            <FileText className="w-6 h-6 text-emerald-600" /> Pengelolaan Kontrak Sewa
          </h1>
          <p className="text-sm text-slate-500">
            Penegakan aturan kontrak tunggal, tanggal mulai tanggal 1, dan pencegahan overlap (BR-01 s/d BR-05).
          </p>
        </div>

        {role === 'pengelola' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
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

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        {['all', 'aktif', 'draf', 'selesai', 'diakhiri'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
              filterStatus === st
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {st === 'all' ? 'Semua Kontrak' : st}
          </button>
        ))}
      </div>

      {/* Tabel Kontrak */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nomor & Unit</th>
                <th className="py-3.5 px-4">Penyewa</th>
                <th className="py-3.5 px-4">Periode & Durasi</th>
                <th className="py-3.5 px-4">Harga Sewa (Terkunci)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.map((k) => (
                <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{k.nomor}</div>
                    <div className="text-xs text-slate-500">
                      Kamar: <span className="font-semibold text-emerald-700">{k.unit?.kode}</span> ({k.unit?.tipe})
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-800">{k.penyewa?.nama_lengkap}</div>
                    <div className="text-xs text-slate-400">{k.penyewa?.email}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className="font-medium text-slate-700">
                      {k.tanggal_mulai} s/d {k.tanggal_selesai}
                    </div>
                    <div className="text-slate-400">Durasi: {k.durasi_bulan} Bulan</div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
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
                          className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition-colors"
                        >
                          Aktivasi
                        </button>
                      )}

                      {/* Pemilik: Akhiri Lebih Awal (BR-05) */}
                      {role === 'pemilik' && k.status === 'aktif' && (
                        <button
                          onClick={() => {
                            setTerminatingContract(k);
                            setTerminateReason('');
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Kontrak Baru (Pengelola) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" /> Buat Kontrak Sewa Baru
            </h3>
            <p className="text-xs text-slate-500">
              Sesuai aturan BR-01 s/d BR-04: Hanya unit tersedia, tanggal mulai selalu tanggal 1, dan tidak boleh ada periode beririsan.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Pilih Unit (Tersedia)</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Unit --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode} (Lantai {u.lantai} - {u.tipe.toUpperCase()}) - {formatRupiah(u.harga_sewa_bulanan)}/bln [{u.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Pilih Calon Penyewa</label>
                <select
                  value={selectedPenyewaId}
                  onChange={(e) => setSelectedPenyewaId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tanggal Mulai (Selalu tgl 1)
                  </label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Durasi Sewa</label>
                  <select
                    value={durasiBulan}
                    onChange={(e) => setDurasiBulan(Number(e.target.value) as any)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value={1}>1 Bulan</option>
                    <option value={3}>3 Bulan</option>
                    <option value={6}>6 Bulan</option>
                    <option value={12}>12 Bulan</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                Tanggal Selesai Otomatis (BR-02):{' '}
                <span className="font-bold text-slate-900">
                  {calculateContractEndDate(tanggalMulai, durasiBulan)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleCreateContract}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Simpan Kontrak Draf
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Akhiri Lebih Awal (Pemilik) */}
      {terminatingContract && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Akhiri Kontrak Lebih Awal
            </h3>
            <p className="text-xs text-slate-500">
              Sesuai aturan BR-05: Pengakhiran lebih awal hanya oleh Pemilik, wajib disertai alasan, dan berlaku sampai akhir bulan berjalan.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div>Nomor Kontrak: <span className="font-bold">{terminatingContract.nomor}</span></div>
              <div>Penyewa: <span className="font-bold">{terminatingContract.penyewa?.nama_lengkap}</span></div>
              <div>Unit: <span className="font-bold">{terminatingContract.unit?.kode}</span></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Alasan Pengakhiran Kontrak (Wajib)
              </label>
              <textarea
                rows={3}
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                placeholder="Contoh: Penyewa pindah tugas kerja lebih awal atas kesepakatan bersama."
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTerminatingContract(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleTerminateContract}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Konfirmasi Akhiri Kontrak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
