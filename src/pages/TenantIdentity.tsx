import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { UserSquare2, ShieldCheck, CheckCircle2, AlertCircle, Camera } from 'lucide-react';

export const TenantIdentity: React.FC = () => {
  const { currentUser } = useAuth();
  const currentIdentity = dataStore.getTenants().find(t => t.profile.id === currentUser?.id)?.identitas;

  const [nik, setNik] = useState(currentIdentity?.nik || '');
  const [alamatAsal, setAlamatAsal] = useState(currentIdentity?.alamat_asal || '');
  const [kontakNama, setKontakNama] = useState(currentIdentity?.kontak_darurat_nama || '');
  const [kontakHp, setKontakHp] = useState(currentIdentity?.kontak_darurat_hp || '');
  const [fotoPath, setFotoPath] = useState(currentIdentity?.foto_ktp_path || 'ktp/my_ktp.jpg');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
      setMessage({ type: 'error', text: 'NIK wajib terdiri dari tepat 16 digit angka (BR-03).' });
      return;
    }

    // Simpan ke dataStore lokal
    if (currentIdentity) {
      currentIdentity.nik = nik;
      currentIdentity.alamat_asal = alamatAsal;
      currentIdentity.kontak_darurat_nama = kontakNama;
      currentIdentity.kontak_darurat_hp = kontakHp;
      currentIdentity.foto_ktp_path = fotoPath;
      currentIdentity.status_verifikasi = 'belum'; // Menunggu verifikasi ulang jika diubah
    }

    setMessage({
      type: 'success',
      text: 'Data identitas KTP Anda berhasil disimpan dan menunggu verifikasi oleh Pengelola.',
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <UserSquare2 className="w-6 h-6 text-emerald-600" /> Data Identitas & Foto KTP Penghuni
        </h1>
        <p className="text-sm text-slate-500">
          Wajib dilengkapi untuk aktivasi kontrak kamar sewa (BR-03). Data disimpan aman di storage privat.
        </p>
      </div>

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
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Nomor Induk Kependudukan (NIK 16 Angka)
          </label>
          <input
            type="text"
            maxLength={16}
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            placeholder="Contoh: 3471012345670001"
            className="w-full text-sm font-mono border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Alamat Asal KTP</label>
          <textarea
            rows={2}
            value={alamatAsal}
            onChange={(e) => setAlamatAsal(e.target.value)}
            placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten"
            className="w-full text-sm border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Kontak Darurat & Hubungan
            </label>
            <input
              type="text"
              value={kontakNama}
              onChange={(e) => setKontakNama(e.target.value)}
              placeholder="Contoh: Budi Santoso (Ayah)"
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nomor HP Kontak Darurat
            </label>
            <input
              type="tel"
              value={kontakHp}
              onChange={(e) => setKontakHp(e.target.value)}
              placeholder="08123456789"
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Unggah Berkas Foto KTP (JPG / PNG, Maks 2MB)
          </label>
          <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-emerald-600" />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">{fotoPath}</span>
                <p className="text-slate-400">File tersimpan aman di bucket privat</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg">
              Terpilih
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-colors text-sm"
          >
            Simpan Data Identitas
          </button>
        </div>
      </form>
    </div>
  );
};
