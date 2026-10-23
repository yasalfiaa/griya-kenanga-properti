import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Unit } from '../types/database';
import { formatRupiah } from '../utils/business-rules';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { parseErrorMessage } from '../utils/error-handler';
import { Building2, Edit2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export const Units: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [units, setUnits] = useState<Unit[]>(() => dataStore.getUnits());
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Ubah Harga (Pemilik)
  const [editingPriceUnit, setEditingPriceUnit] = useState<Unit | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [priceModalError, setPriceModalError] = useState<string | null>(null);

  // Modal Ubah Status (Pengelola)
  const [editingStatusUnit, setEditingStatusUnit] = useState<Unit | null>(null);
  const [newStatus, setNewStatus] = useState<'tersedia' | 'perbaikan' | 'nonaktif'>('tersedia');
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  const filteredUnits = units.filter(u =>
    selectedFloor === 'all' ? true : u.lantai === selectedFloor
  );

  const handleUpdatePrice = () => {
    if (!editingPriceUnit || !currentUser) return;
    try {
      setPriceModalError(null);
      dataStore.updateUnitPrice(editingPriceUnit.id, newPrice, currentUser);
      setUnits(dataStore.getUnits());
      setMessage({ type: 'success', text: `Harga sewa unit ${editingPriceUnit.kode} berhasil diubah ke ${formatRupiah(newPrice)} (Harga di kontrak aktif tetap terkunci).` });
      setEditingPriceUnit(null);
      setPriceModalError(null);
    } catch (err: any) {
      setPriceModalError(parseErrorMessage(err));
    }
  };

  const handleUpdateStatus = () => {
    if (!editingStatusUnit || !currentUser) return;
    try {
      setStatusModalError(null);
      dataStore.updateUnitStatus(editingStatusUnit.id, newStatus, currentUser);
      setUnits(dataStore.getUnits());
      setMessage({ type: 'success', text: `Status unit ${editingStatusUnit.kode} berhasil diubah ke '${newStatus}'.` });
      setEditingStatusUnit(null);
      setStatusModalError(null);
    } catch (err: any) {
      setStatusModalError(parseErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'tersedia':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">Tersedia</span>;
      case 'perbaikan':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">Perbaikan</span>;
      case 'nonaktif':
      default:
        return <span className="bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">Nonaktif</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-600" /> Pengelolaan 24 Unit Kamar
          </h1>
          <p className="text-sm text-slate-500">
            Lantai 1 (Blok A - Standar), Lantai 2 (Blok B - AC), Lantai 3 (Blok C - Studio)
          </p>
        </div>

        {/* Filter Lantai */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setSelectedFloor('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedFloor === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua (24)
          </button>
          <button
            onClick={() => setSelectedFloor(1)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedFloor === 1 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lantai 1 (Standar)
          </button>
          <button
            onClick={() => setSelectedFloor(2)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedFloor === 2 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lantai 2 (AC)
          </button>
          <button
            onClick={() => setSelectedFloor(3)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedFloor === 3 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lantai 3 (Studio)
          </button>
        </div>
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

      {/* Grid Unit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredUnits.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xl font-bold text-slate-900">{u.kode}</span>
                {getStatusBadge(u.status)}
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div>
                  Lantai {u.lantai} · Tipe: <span className="font-semibold text-slate-700 capitalize">{u.tipe}</span>
                </div>
                <div>Luas: {u.luas_m2} m²</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Sewa Bulanan</span>
                <span className="font-bold text-emerald-700 text-sm">{formatRupiah(u.harga_sewa_bulanan)}</span>
              </div>

              {/* Action Buttons based on Role */}
              <div className="flex items-center gap-1">
                {role === 'pengelola' && (
                  <button
                    onClick={() => {
                      setEditingStatusUnit(u);
                      setNewStatus(u.status);
                    }}
                    title="Ubah Status Unit"
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-medium border border-slate-200 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Status
                  </button>
                )}

                {role === 'pemilik' && (
                  <button
                    onClick={() => {
                      setEditingPriceUnit(u);
                      setNewPrice(u.harga_sewa_bulanan);
                    }}
                    title="Ubah Harga Sewa (Khusus Pemilik)"
                    className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-medium border border-purple-200 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Harga
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Ubah Harga (Pemilik) */}
      {editingPriceUnit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Ubah Harga Sewa Kamar {editingPriceUnit.kode}
            </h3>
            <p className="text-xs text-slate-500">
              Harga yang diubah Pemilik berlaku untuk kontrak baru berikutnya. Harga pada kontrak yang sedang aktif tetap terkunci.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={priceModalError}
              onDismiss={() => setPriceModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Sewa Bulanan (Rp)</label>
              <input
                type="number"
                step="50000"
                value={newPrice}
                onChange={(e) => {
                  setNewPrice(Number(e.target.value));
                  if (priceModalError) setPriceModalError(null);
                }}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingPriceUnit(null);
                  setPriceModalError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleUpdatePrice}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubah Status (Pengelola) */}
      {editingStatusUnit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg">Ubah Status Kamar {editingStatusUnit.kode}</h3>
            <p className="text-xs text-slate-500">
              Unit yang masih memiliki kontrak draf atau aktif dilarang dinonaktifkan.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={statusModalError}
              onDismiss={() => setStatusModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Pilih Status Baru</label>
              <select
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value as any);
                  if (statusModalError) setStatusModalError(null);
                }}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="tersedia">Tersedia</option>
                <option value="perbaikan">Perbaikan (Maintenance)</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingStatusUnit(null);
                  setStatusModalError(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Simpan Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
