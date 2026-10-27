import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { maskNIK } from '../utils/business-rules';
import { getSignedImageUrl, STORAGE_BUCKETS, isHttpUrl } from '../api/storage';
import { ModalErrorAlert } from '../components/ModalErrorAlert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { parseErrorMessage } from '../utils/error-handler';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  Eye,
  MessageCircle,
} from 'lucide-react';

/** Konversi nomor HP lokal ke format wa.me internasional.
 *  0812... -> 62812..., 62812... dipertahankan, +62 & spasi dibersihkan. */
const nomorWhatsApp = (noHp?: string | null): string | null => {
  if (!noHp) return null;
  const digits = noHp.replace(/\D/g, '');
  let normalized: string | null = null;
  if (digits.startsWith('0')) {
    normalized = `62${digits.slice(1)}`;
  } else if (digits.startsWith('62')) {
    normalized = digits;
  } else if (digits.startsWith('8')) {
    // Nomor disimpan tanpa '0' awal (mis. 812...) — anggap kode negara hilang
    normalized = `62${digits}`;
  }
  return normalized && normalized.length >= 10 ? `https://wa.me/${normalized}` : null;
};

export const Tenants: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [tenants, setTenants] = useState(() => dataStore.getTenants());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setTenants(dataStore.getTenants());
  }, []);

  const sortedTenants = [...tenants].sort((a, b) =>
    a.profile.nama_lengkap.localeCompare(b.profile.nama_lengkap, 'id', { sensitivity: 'base' })
  );

  // Modal Verifikasi (Pengelola)
  const [verifyingPenyewa, setVerifyingPenyewa] = useState<any | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [ktpImageUrl, setKtpImageUrl] = useState<string | null>(null);
  const [ktpImageLoading, setKtpImageLoading] = useState(false);
  // Error DB/BR di dalam modal verifikasi (bukan hanya validasi catatan)
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Saat modal verifikasi dibuka, ambil foto KTP:
  //  - berkas baru (path storage privat) -> signed URL kedaluwarsa 5 menit
  //  - berkas URL publik (mock lama)     -> langsung pakai URL-nya
  useEffect(() => {
    let cancelled = false;
    setKtpImageUrl(null);
    const path = verifyingPenyewa?.identitas?.foto_ktp_path;
    if (!path) return;
    setKtpImageLoading(true);
    if (isHttpUrl(path)) {
      setKtpImageUrl(path);
      setKtpImageLoading(false);
    } else {
      getSignedImageUrl(path, STORAGE_BUCKETS.ktp).then(url => {
        if (!cancelled) {
          setKtpImageUrl(url);
          setKtpImageLoading(false);
        }
      });
    }
    return () => { cancelled = true; };
  }, [verifyingPenyewa]);

  const handleVerify = async (status: 'terverifikasi' | 'ditolak') => {
    if (!verifyingPenyewa || !currentUser) return;

    // Validasi Front-End: penolakan identitas wajib menyertakan alasan
    if (status === 'ditolak' && verificationNotes.trim().length === 0) {
      setNotesError('Alasan penolakan wajib diisi.');
      return;
    }

    try {
      setIsVerifying(true);
      setVerifyError(null);
      await dataStore.verifyTenantIdentity(verifyingPenyewa.profile.id, status, verificationNotes, currentUser);
      setTenants(dataStore.getTenants());
      setMessage({
        type: 'success',
        text: `Identitas ${verifyingPenyewa.profile.nama_lengkap} berhasil ditandai sebagai '${status}'.`,
      });
      setVerifyingPenyewa(null);
      setVerificationNotes('');
      setNotesError(null);
    } catch (err: any) {
      const parsed = parseErrorMessage(err);
      if (parsed.includes('Alasan penolakan')) {
        // Tampilkan hanya di dalam modal agar pesan bersih & kontekstual
        setNotesError(parsed);
      } else {
        // Error DB/BR lain juga tampil DI DALAM modal (tidak di-swallow ke banner)
        setVerifyError(parsed);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'terverifikasi':
        return (
          <Badge variant="emerald" className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Terverifikasi
          </Badge>
        );
      case 'ditolak':
        return (
          <Badge variant="rose" className="inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Ditolak
          </Badge>
        );
      case 'belum':
      default:
        return (
          <Badge variant="amber" className="inline-flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Belum Diverifikasi
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Data & Verifikasi Identitas Penyewa
          </h1>
          <p className="text-sm text-muted-foreground">
            Daftar informasi penyewa, status verifikasi identitas, dan kontak darurat.
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

      {/* Tabel Penyewa */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Nama Lengkap & Kontak</th>
                <th className="py-2.5 px-4">NIK (KTP)</th>
                <th className="py-2.5 px-4">Alamat Asal</th>
                <th className="py-2.5 px-4">Kontak Darurat</th>
                <th className="py-2.5 px-4">Status Verifikasi</th>
                {role === 'pengelola' && <th className="py-2.5 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTenants.map(({ profile, identitas }) => (
                <tr key={profile.id} className="hover:bg-muted/60 transition-colors">
                  <td className="py-2 px-4">
                    <div className="font-semibold text-foreground">{profile.nama_lengkap}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="truncate">{profile.email}</span>
                      {nomorWhatsApp(profile.no_hp) && (
                        <a
                          href={nomorWhatsApp(profile.no_hp)!}
                          target="_blank"
                          rel="noreferrer"
                          title={`Hubungi via WhatsApp (${profile.no_hp})`}
                          aria-label={`Chat WhatsApp ${profile.nama_lengkap}`}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>

                  {/* NIK Display: Full for Pengelola, Masked for Pemilik (BR-10) */}
                  <td className="py-2 px-4 font-mono text-xs">
                    {identitas?.nik ? (
                      role === 'pemilik' ? (
                        <span className="bg-muted text-foreground px-2 py-1 rounded">
                          {maskNIK(identitas.nik)}
                        </span>
                      ) : (
                        <span className="font-medium text-foreground">{identitas.nik}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground italic">Belum mengisi</span>
                    )}
                  </td>

                  <td className="py-2 px-4 text-xs">
                    {identitas?.alamat_asal || <span className="text-muted-foreground italic">-</span>}
                  </td>

                  <td className="py-2 px-4 text-xs">
                    {identitas?.kontak_darurat_nama ? (
                      <div>
                        <div className="font-medium text-foreground">{identitas.kontak_darurat_nama}</div>
                        <div className="text-muted-foreground">{identitas.kontak_darurat_hp}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">-</span>
                    )}
                  </td>

                  <td className="py-2 px-4">
                    {getVerificationBadge(identitas?.status_verifikasi)}
                  </td>

                  {/* Aksi Verifikasi untuk Pengelola */}
                  {role === 'pengelola' && (
                    <td className="py-2 px-4 text-right">
                      {identitas ? (
                        <button
                          onClick={() => {
                            setVerifyingPenyewa({ profile, identitas });
                            setVerifyError(null);
                            setNotesError(null);
                            setVerificationNotes(identitas.catatan_verifikasi || '');
                            setNotesError(null);
                          }}
                          className="px-3 py-1.5 text-xs bg-emerald-50 text-primary hover:bg-emerald-100 rounded-lg font-semibold transition-colors border border-emerald-200"
                        >
                          Verifikasi
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Data Kosong</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={role === 'pengelola' ? 6 : 5} className="py-2 px-4">
                    <EmptyState
                      icon={Users}
                      title="Belum Ada Penyewa"
                      description="Data penyewa muncul di sini setelah ada akun penyewa terdaftar pada sistem."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Verifikasi KTP (Pengelola) */}
      {verifyingPenyewa && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Verifikasi Identitas Penyewa
            </h3>

            {/* Error DB/BR standar: tampil di dalam modal sampai ditutup */}
            <ModalErrorAlert
              error={verifyError}
              onDismiss={() => setVerifyError(null)}
            />

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama Lengkap:</span>
                <span className="font-bold text-foreground">{verifyingPenyewa.profile.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">NIK (16 Digit):</span>
                <span className="font-mono font-bold text-foreground">{verifyingPenyewa.identitas.nik}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alamat Asal:</span>
                <span className="font-medium text-foreground">{verifyingPenyewa.identitas.alamat_asal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kontak Darurat:</span>
                <span className="font-medium text-foreground">
                  {verifyingPenyewa.identitas.kontak_darurat_nama} ({verifyingPenyewa.identitas.kontak_darurat_hp})
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border">
                <span className="text-muted-foreground">Berkas KTP:</span>
                <span className="text-primary bg-emerald-50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {verifyingPenyewa.identitas.foto_ktp_path || 'ktp.jpg'}
                </span>
              </div>
            </div>

            {/* Pratinjau Foto KTP (asli dari Supabase Storage) */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Pratinjau Foto KTP:</p>
              {ktpImageLoading ? (
                <div className="w-full h-32 bg-muted rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                  Memuat pratinjau...
                </div>
              ) : ktpImageUrl ? (
                <a href={ktpImageUrl} target="_blank" rel="noreferrer" title="Buka foto ukuran penuh">
                  <img
                    src={ktpImageUrl}
                    alt={`Foto KTP ${verifyingPenyewa.profile.nama_lengkap}`}
                    className="w-full max-h-48 object-contain rounded-xl border border-border bg-muted/50 hover:opacity-90 transition-opacity"
                  />
                </a>
              ) : (
                <div className="w-full h-32 bg-muted rounded-xl flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-6 h-6" />
                  <span className="text-center">Pratinjau tidak tersedia.<br />Nama berkas tetap tampil di atas.</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Catatan Verifikasi (Wajib jika menolak)
              </label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => {
                  setVerificationNotes(e.target.value);
                  if (notesError) setNotesError(null);
                }}
                placeholder="Misal: Foto KTP jelas, NIK sesuai data kependudukan."
                aria-invalid={!!notesError}
                className={`w-full text-xs border rounded-xl p-2.5 focus:ring-2 focus:outline-none ${
                  notesError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-border focus:ring-ring'
                }`}
              />
              {notesError && (
                <p className="mt-1 text-xs font-semibold text-rose-600" role="alert">
                  {notesError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setVerifyingPenyewa(null);
                  setVerifyError(null);
                }}
                className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted rounded-xl font-medium"
              >
                Tutup
              </button>
              <button
                onClick={() => handleVerify('ditolak')}
                disabled={isVerifying}
                className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm"
              >
                Tolak Identitas
              </button>
              <button
                onClick={() => handleVerify('terverifikasi')}
                disabled={isVerifying}
                className="px-4 py-2 text-xs bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-semibold shadow-sm flex items-center gap-1"
              >
                Verifikasi & Setujui
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
