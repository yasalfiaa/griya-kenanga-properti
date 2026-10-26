import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Unit, UnitStatus } from '../types/database';
import { formatRupiah } from '../utils/business-rules';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { parseErrorMessage } from '../utils/error-handler';
import {
  Building2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Shield,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

/** Metadata katalog tipe unit (foto representatif dari Unsplash, stok publik). */
const TIPE_KATALOG: Array<{
  tipe: Unit['tipe'];
  prefix: string; // Blok pada kode kamar (A/B/C)
  judul: string;
  ringkasan: string;
  foto: string;
}> = [
  {
    tipe: 'standar',
    prefix: 'A',
    judul: 'Unit A · Kamar Standar',
    ringkasan: 'Tipe standar, lantai 1 (Blok A) — pilihan ekonomis bagi penyewa baru.',
    foto:
      'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=900&q=60',
  },
  {
    tipe: 'ac',
    prefix: 'B',
    judul: 'Unit B · Kamar AC',
    ringkasan: 'Tipe ber-AC, lantai 2 (Blok B) — nyaman untuk tengah hari yang panas.',
    foto:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=60',
  },
  {
    tipe: 'studio',
    prefix: 'C',
    judul: 'Unit C · Studio',
    ringkasan: 'Unit studio luas, lantai 3 (Blok C) — ruang paling lega di properti ini.',
    foto:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=60',
  },
];

/** Nilai luas minimum–maksimum suatu tipe (contoh: "12–14 m²"). */
const rentangLuas = (kamars: Unit[]) => {
  const min = Math.min(...kamars.map((u) => u.luas_m2));
  const max = Math.max(...kamars.map((u) => u.luas_m2));
  return min === max ? `${min} m²` : `${min}–${max} m²`;
};

const hargaMulai = (kamars: Unit[]) => {
  const min = Math.min(...kamars.map((u) => u.harga_sewa_bulanan));
  return `Mulai ${formatRupiah(min)}`;
};

export const Units: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [units, setUnits] = useState<Unit[]>(() => dataStore.getUnits());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // View state halaman: null = katalog tipe; selain itu = detail kamar tipe tsb.
  const [selectedType, setSelectedType] = useState<Unit['tipe'] | null>(null);

  // Keterangan sukses/notifikasi otomatis hilang setelah 5 detik
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message]);

  // Modal Ubah Harga (Pemilik)
  const [editingPriceUnit, setEditingPriceUnit] = useState<Unit | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [priceModalError, setPriceModalError] = useState<string | null>(null);

  // Modal Ubah Status (Pengelola)
  const [editingStatusUnit, setEditingStatusUnit] = useState<Unit | null>(null);
  const [newStatus, setNewStatus] = useState<UnitStatus>('tersedia');
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  const handleUpdatePrice = async () => {
    if (!editingPriceUnit || !currentUser) return;
    try {
      setIsUpdating(true);
      setPriceModalError(null);
      await dataStore.updateUnitPrice(editingPriceUnit.id, newPrice, currentUser);
      setUnits(dataStore.getUnits());
      setMessage({ type: 'success', text: `Harga sewa unit ${editingPriceUnit.kode} berhasil diubah ke ${formatRupiah(newPrice)}.` });
      setEditingPriceUnit(null);
      setPriceModalError(null);
    } catch (err: any) {
      setPriceModalError(parseErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingStatusUnit || !currentUser) return;
    try {
      setIsUpdating(true);
      setStatusModalError(null);
      await dataStore.updateUnitStatus(editingStatusUnit.id, newStatus, currentUser);
      setUnits(dataStore.getUnits());
      setMessage({ type: 'success', text: `Status unit ${editingStatusUnit.kode} berhasil diubah ke '${newStatus}'.` });
      setEditingStatusUnit(null);
      setStatusModalError(null);
    } catch (err: any) {
      setStatusModalError(parseErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'tersedia':
        return <Badge variant="emerald" className="py-1">Tersedia</Badge>;
      case 'dikontrak':
        return <Badge variant="indigo" className="py-1">Dikontrak</Badge>;
      case 'perbaikan':
        return <Badge variant="amber" className="py-1">Perbaikan</Badge>;
      case 'nonaktif':
      default:
        return <Badge variant="muted" className="py-1">Nonaktif</Badge>;
    }
  };

  const tipeAktif = TIPE_KATALOG.find((t) => t.tipe === selectedType) ?? null;
  // Filter daftar kamar otomatis mengikuti tipe yang dipilih di katalog
  // (Unit A → A-101 s/d A-108, dan seterusnya). Sumber data tetap satu,
  // sehingga hak baca per peran yang sudah dijaga RLS tidak berubah.
  const kamarsByTipe = selectedType ? units.filter((u) => u.tipe === selectedType) : [];

  return (
    <div className="space-y-6">
      {/* ============ TAMPILAN UTAMA: KATALOG TIPE UNIT ============ */}
      {!tipeAktif && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Daftar Unit (24 Kamar)
            </h1>
            <p className="text-sm text-muted-foreground">
              Pilih tipe unit untuk melihat daftar kamar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TIPE_KATALOG.map((tipeInfo) => {
              const kamars = units.filter((u) => u.tipe === tipeInfo.tipe);
              const tersedia = kamars.filter((u) => u.status === 'tersedia').length;

              return (
                <div
                  key={tipeInfo.tipe}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md hover:border-ring/40 transition-all flex flex-col"
                >
                  {/* Foto representatif tipe kamar */}
                  <div className="relative h-44 w-full bg-muted overflow-hidden">
                    <img
                      src={tipeInfo.foto}
                      alt={`Foto tipe ${tipeInfo.judul}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute top-3 left-3 bg-card/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-foreground shadow-sm">
                      {tipeInfo.prefix === 'A' ? 'Lantai 1' : tipeInfo.prefix === 'B' ? 'Lantai 2' : 'Lantai 3'}
                    </span>
                    <span className="absolute bottom-3 right-3 bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm">
                      {kamars.length} Kamar
                    </span>
                  </div>

                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div>
                      <h2 className="font-bold text-foreground">{tipeInfo.judul}</h2>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {tipeInfo.ringkasan}
                      </p>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Luas: <span className="font-semibold text-foreground">{rentangLuas(kamars)}</span>
                      </div>
                      <div>
                        Sewa Bulanan: <span className="font-semibold text-primary">{hargaMulai(kamars)}</span>
                      </div>
                      <div>
                        Status: <span className="font-semibold text-emerald-700">{tersedia} tersedia</span> dari {kamars.length} kamar
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedType(tipeInfo.tipe)}
                      className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-sm transition-colors"
                    >
                      Lihat Daftar Kamar <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============ TAMPILAN DETAIL: DAFTAR KAMAR PER TIPE ============ */}
      {tipeAktif && (
        <>
          {/* Tombol kembali ke katalog */}
          <button
            onClick={() => setSelectedType(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Pilih Tipe
          </button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {tipeAktif.judul}
              </h1>
              <p className="text-sm text-muted-foreground">
                Blok {tipeAktif.prefix} · Luas {rentangLuas(kamarsByTipe)} · {kamarsByTipe.length} kamar · sewa {hargaMulai(kamarsByTipe)}.
              </p>
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

          {/* Grid Daftar Kamar (sama seperti sebelumnya, kini terfilter per tipe) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {kamarsByTipe.length === 0 && (
              <EmptyState
                icon={Building2}
                title="Belum Ada Kamar"
                description={`Tidak ada kamar bertipe ${tipeAktif.tipe} pada data saat ini.`}
                className="sm:col-span-2 md:col-span-3 lg:col-span-4"
              />
            )}
            {kamarsByTipe.map((u) => (
              <div
                key={u.id}
                className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:border-border transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xl font-bold text-foreground">{u.kode}</span>
                    {getStatusBadge(u.status)}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Lantai {u.lantai} · Tipe: <span className="font-semibold text-foreground capitalize">{u.tipe}</span>
                    </div>
                    <div>Luas: {u.luas_m2} m²</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block font-medium">Sewa Bulanan</span>
                    <span className="font-bold text-primary text-sm">{formatRupiah(u.harga_sewa_bulanan)}</span>
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
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-emerald-50 rounded-lg text-xs font-medium border border-border flex items-center gap-1"
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
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-emerald-50 rounded-lg text-xs font-medium border border-border flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Harga
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Ubah Harga (Pemilik) */}
      {editingPriceUnit && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Ubah Harga Sewa Kamar {editingPriceUnit.kode}
            </h3>
            <p className="text-xs text-muted-foreground">
              Harga yang diubah Pemilik berlaku untuk kontrak baru berikutnya. Harga pada kontrak yang sedang aktif tetap terkunci.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={priceModalError}
              onDismiss={() => setPriceModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Harga Sewa Bulanan (Rp)</label>
              <input
                type="number"
                step="50000"
                value={newPrice}
                onChange={(e) => {
                  setNewPrice(Number(e.target.value));
                  if (priceModalError) setPriceModalError(null);
                }}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingPriceUnit(null);
                  setPriceModalError(null);
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                disabled={isUpdating}
                onClick={handleUpdatePrice}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold shadow-sm disabled:opacity-50"
              >
                {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubah Status (Pengelola) */}
      {editingStatusUnit && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Ubah Status Kamar {editingStatusUnit.kode}</h3>
            <p className="text-xs text-muted-foreground">
              Unit yang masih memiliki kontrak draf atau aktif dilarang dinonaktifkan.
            </p>

            {/* Error Alert Standar Modal */}
            <ModalErrorAlert
              error={statusModalError}
              onDismiss={() => setStatusModalError(null)}
            />

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Pilih Status Baru</label>
              <select
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value as any);
                  if (statusModalError) setStatusModalError(null);
                }}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-ring focus:outline-none"
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
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Batal
              </button>
              <button
                disabled={isUpdating}
                onClick={handleUpdateStatus}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
              >
                {isUpdating ? 'Menyimpan...' : 'Simpan Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
