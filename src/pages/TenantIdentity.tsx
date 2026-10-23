import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import {
  ACCEPTED_IMAGE_ATTR,
  validateImageFile,
  uploadImage,
  isHttpUrl,
  getSignedImageUrl,
  STORAGE_BUCKETS,
} from '../api/storage';
import { UserSquare2, ShieldCheck, CheckCircle2, AlertCircle, Camera, Image as ImageIcon } from 'lucide-react';

export const TenantIdentity: React.FC = () => {
  const { currentUser } = useAuth();
  const currentIdentity = dataStore.getTenants().find(t => t.profile.id === currentUser?.id)?.identitas;

  const [nik, setNik] = useState(currentIdentity?.nik || '');
  const [alamatAsal, setAlamatAsal] = useState(currentIdentity?.alamat_asal || '');
  const [kontakNama, setKontakNama] = useState(currentIdentity?.kontak_darurat_nama || '');
  const [kontakHp, setKontakHp] = useState(currentIdentity?.kontak_darurat_hp || '');
  const [fotoPath, setFotoPath] = useState(currentIdentity?.foto_ktp_path || '');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingPreview, setExistingPreview] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pratinjau foto yang sudah tersimpan (bucket KTP privat -> signed URL 5 menit)
  useEffect(() => {
    let cancelled = false;
    const path = currentIdentity?.foto_ktp_path || fotoPath;
    if (path && isHttpUrl(path)) {
      setExistingPreview(path);
    } else if (path) {
      getSignedImageUrl(path).then(url => {
        if (!cancelled) setExistingPreview(url);
      });
    } else {
      setExistingPreview(null);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdentity?.foto_ktp_path, fotoPath]);

  // Bersihkan object URL pratinjau lokal saat berganti / unmount
  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFotoError(null);
    if (!file) {
      setFotoFile(null);
      return;
    }
    const err = validateImageFile(file);
    if (err) {
      // Reset agar tidak ada file basi terbawa saat submit
      setFotoFile(null);
      e.target.value = '';
      setFotoError(err);
      return;
    }
    // Buat pratinjau lokal sebelum diunggah
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Sesi pengguna tidak ditemukan. Silakan login ulang.' });
      return;
    }
    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
      setMessage({ type: 'error', text: 'NIK wajib terdiri dari tepat 16 digit angka.' });
      return;
    }

    setIsSaving(true);
    try {
      // 1) Unggah foto KTP ke Supabase Storage jika pengguna memilih berkas baru
      let savedPath = fotoPath;
      if (fotoFile) {
        const doc = await uploadImage({
          bucket: STORAGE_BUCKETS.ktp,
          userId: currentUser.id,
          kind: 'ktp',
          file: fotoFile,
        });
        // Bucket privat: simpan PATH relatif ke database (URL signed bersifat sementara)
        savedPath = doc.path;
      }

      // 2) Simpan ke database (dataStore menulis lokal + sinkron ke identitas_penyewa)
      await dataStore.saveTenantIdentity({
        penyewa_id: currentUser.id,
        nik,
        alamat_asal: alamatAsal,
        kontak_darurat_nama: kontakNama,
        kontak_darurat_hp: kontakHp,
        foto_ktp_path: savedPath,
      });

      setFotoPath(savedPath);
      setFotoFile(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setMessage({
        type: 'success',
        text: 'Data identitas KTP (termasuk foto) berhasil disimpan ke database.',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan saat menyimpan data identitas.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <UserSquare2 className="w-6 h-6 text-emerald-600" /> Data Identitas & Foto KTP Penghuni
        </h1>
        <p className="text-sm text-slate-500">
          Wajib dilengkapi untuk aktivasi kontrak kamar sewa. Data disimpan aman di storage privat.
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
            Unggah Berkas Foto KTP (JPG / PNG / WEBP, Maks 2MB)
          </label>
          <input
            type="file"
            accept={ACCEPTED_IMAGE_ATTR}
            onChange={handleFileSelect}
            className="w-full text-xs text-slate-600 border border-slate-300 rounded-xl px-3 py-2.5 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-emerald-700 cursor-pointer bg-white"
            aria-label="Pilih berkas foto KTP"
          />

          {/* Pesan error validasi file */}
          {fotoError && (
            <p className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5" role="alert">
              <AlertCircle className="w-3.5 h-3.5" /> {fotoError}
            </p>
          )}

          {/* Pratinjau: foto baru terpilih -> urut teratas; lalu foto tersimpan (signed URL) */}
          <div className="mt-3 flex items-center gap-4 border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50">
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Pratinjau foto KTP baru"
                className="w-20 h-14 object-cover rounded-lg border border-slate-200 shadow-sm"
              />
            ) : existingPreview ? (
              <img
                src={existingPreview}
                alt="Foto KTP tersimpan"
                className="w-20 h-14 object-cover rounded-lg border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-20 h-14 rounded-lg bg-slate-200 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div className="text-xs min-w-0 flex-1">
              <span className="font-semibold text-slate-800 block truncate">
                {fotoFile ? fotoFile.name : currentIdentity?.foto_ktp_path || 'Belum ada foto KTP diunggah'}
              </span>
              <p className="text-slate-400">
                {fotoFile
                  ? `${(fotoFile.size / 1024).toFixed(0)} KB — menunggu disimpan`
                  : 'Foto tersimpan aman di bucket privat Supabase (akses via link sementara)'}
              </p>
            </div>
            {fotoFile && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
                Terpilih
              </span>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isSaving ? 'Mengunggah & Menyimpan...' : 'Simpan Data Identitas'}
          </button>
        </div>
      </form>
    </div>
  );
};
