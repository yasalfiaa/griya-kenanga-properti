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
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Image as ImageIcon,
  Loader2,
  FileText,
} from 'lucide-react';

export const TenantIdentity: React.FC = () => {
  const { currentUser } = useAuth();
  const [identitas, setIdentitas] = useState(() =>
    dataStore.getTenants().find(t => t.profile.id === currentUser?.id)?.identitas
  );

  const [nik, setNik] = useState('');
  const [alamatAsal, setAlamatAsal] = useState('');
  const [kontakNama, setKontakNama] = useState('');
  const [kontakHp, setKontakHp] = useState('');
  const [fotoPath, setFotoPath] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [existingPreview, setExistingPreview] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sinkronkan state form dengan data identitas saat currentUser atau dataStore termuat
  useEffect(() => {
    const tenant = dataStore.getTenants().find(t => t.profile.id === currentUser?.id);
    const curr = tenant?.identitas;
    setIdentitas(curr);
    if (curr) {
      setNik(curr.nik || '');
      setAlamatAsal(curr.alamat_asal || '');
      setKontakNama(curr.kontak_darurat_nama || '');
      setKontakHp(curr.kontak_darurat_hp || '');
      setFotoPath(curr.foto_ktp_path || '');
    }
  }, [currentUser]);

  // Pratinjau foto yang sudah tersimpan (bucket KTP privat -> signed URL 5 menit)
  useEffect(() => {
    let cancelled = false;
    const path = fotoPath || identitas?.foto_ktp_path;
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
  }, [fotoPath, identitas?.foto_ktp_path]);

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
    setMessage(null);
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Sesi pengguna tidak ditemukan. Silakan login ulang.' });
      return;
    }
    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
      setMessage({ type: 'error', text: 'NIK wajib terdiri dari tepat 16 digit angka.' });
      return;
    }

    const wasRejected = identitas?.status_verifikasi === 'ditolak';

    setIsSaving(true);
    try {
      // 1) Unggah berkas foto KTP ke Supabase Storage jika pengguna memilih berkas baru
      let savedPath = fotoPath;
      if (fotoFile) {
        const doc = await uploadImage({
          bucket: STORAGE_BUCKETS.ktp,
          userId: currentUser.id,
          kind: 'ktp',
          file: fotoFile,
        });
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

      // Perbarui identitas setelah berhasil disimpan
      const updated = dataStore.getTenants().find(t => t.profile.id === currentUser.id)?.identitas;
      setIdentitas(updated);
      setFotoPath(savedPath);
      setFotoFile(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);

      setMessage({
        type: 'success',
        text: wasRejected
          ? 'Data identitas dan foto KTP baru berhasil disimpan. Pengajuan verifikasi ulang Anda telah dikirim ke Pengelola.'
          : 'Data identitas KTP (termasuk foto) berhasil disimpan dan diajukan untuk verifikasi.',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Terjadi kesalahan saat menyimpan data identitas.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> Data Identitas Penyewa
        </h1>
        <p className="text-sm text-muted-foreground">
          Lengkapi data untuk aktivasi kontrak kamar sewa.
        </p>
      </div>

      {/* Banner Kesalahan/Penolakan: Khusus Penyewa dengan Status Verifikasi Ditolak */}
      {identitas?.status_verifikasi === 'ditolak' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-sm text-rose-900">Verifikasi Identitas Ditolak</h4>
            <p className="text-rose-800 leading-relaxed">
              {identitas.catatan_verifikasi
                ? `Silakan periksa kembali data anda dengan ${identitas.catatan_verifikasi.replace(/\.$/, '')} dan ajukan verifikasi ulang.`
                : 'Silakan periksa kembali data anda dan ajukan verifikasi ulang.'}
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-3 text-sm ${
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
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Nomor Induk Kependudukan (NIK 16 Angka)
          </label>
          <input
            type="text"
            maxLength={16}
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            placeholder="Contoh: 3471012345670001"
            className="w-full text-sm font-mono border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Alamat Asal KTP</label>
          <textarea
            rows={2}
            value={alamatAsal}
            onChange={(e) => setAlamatAsal(e.target.value)}
            placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten"
            className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nama Kontak Darurat & Hubungan
            </label>
            <input
              type="text"
              value={kontakNama}
              onChange={(e) => setKontakNama(e.target.value)}
              placeholder="Contoh: Budi Santoso (Ayah)"
              className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nomor HP Kontak Darurat
            </label>
            <input
              type="tel"
              value={kontakHp}
              onChange={(e) => setKontakHp(e.target.value)}
              placeholder="08123456789"
              className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-ring focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Unggah Berkas Foto KTP (JPG / PNG / WEBP, Maks 2MB)
          </label>
          <input
            type="file"
            accept={ACCEPTED_IMAGE_ATTR}
            onChange={handleFileSelect}
            className="w-full text-xs text-muted-foreground border border-border rounded-xl px-3 py-1.5 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-primary/90 cursor-pointer bg-card"
            aria-label="Pilih berkas foto KTP"
          />

          {/* Pesan error validasi file */}
          {fotoError && (
            <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1.5" role="alert">
              <AlertCircle className="w-3.5 h-3.5" /> {fotoError}
            </p>
          )}

          {/* Pratinjau: foto baru terpilih -> urut teratas; lalu foto tersimpan (signed URL) */}
          <div className="mt-2.5 flex items-center gap-3 border border-dashed border-border rounded-xl p-2.5 bg-muted/50">
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Pratinjau foto KTP baru"
                className="w-16 h-12 object-cover rounded-lg border border-border shadow-sm flex-shrink-0"
              />
            ) : existingPreview ? (
              <img
                src={existingPreview}
                alt="Foto KTP tersimpan"
                className="w-16 h-12 object-cover rounded-lg border border-border shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-12 rounded-lg bg-border flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="text-xs min-w-0 flex-1">
              <span className="font-semibold text-foreground block truncate">
                {fotoFile
                  ? fotoFile.name
                  : (fotoPath || identitas?.foto_ktp_path)
                    ? 'Foto KTP terlampir'
                    : 'Belum ada foto KTP diunggah'}
              </span>
              {fotoFile && (
                <p className="text-muted-foreground mt-0.5">
                  {(fotoFile.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
            {fotoFile && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
                Terpilih
              </span>
            )}
          </div>
        </div>

        <div className="pt-1.5">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengunggah & Menyimpan...
              </>
            ) : identitas?.status_verifikasi === 'ditolak' ? (
              'Simpan & Ajukan Verifikasi Ulang'
            ) : (
              'Simpan Data Identitas'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
