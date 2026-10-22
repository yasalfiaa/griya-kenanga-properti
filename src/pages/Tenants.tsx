import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { maskNIK } from '../utils/business-rules';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react';

export const Tenants: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [tenants, setTenants] = useState(() => dataStore.getTenants());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Verifikasi (Pengelola)
  const [verifyingPenyewa, setVerifyingPenyewa] = useState<any | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  const handleVerify = (status: 'terverifikasi' | 'ditolak') => {
    if (!verifyingPenyewa || !currentUser) return;
    try {
      dataStore.verifyTenantIdentity(verifyingPenyewa.profile.id, status, verificationNotes, currentUser);
      setTenants(dataStore.getTenants());
      setMessage({
        type: 'success',
        text: `Identitas ${verifyingPenyewa.profile.nama_lengkap} berhasil ditandai sebagai '${status}'.`,
      });
      setVerifyingPenyewa(null);
      setVerificationNotes('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'terverifikasi':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terverifikasi
          </span>
        );
      case 'ditolak':
        return (
          <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Ditolak
          </span>
        );
      case 'belum':
      default:
        return (
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Belum Diverifikasi
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" /> Data & Verifikasi Identitas Penyewa
          </h1>
          <p className="text-sm text-slate-500">
            {role === 'pemilik'
              ? 'Proteksi Privasi (BR-10): Pemilik hanya melihat 4 angka terakhir NIK dan tidak melihat foto KTP.'
              : 'Verifikasi KTP Pengelola (BR-03): Kontrak draf hanya bisa diaktifkan bila identitas sudah diverifikasi.'}
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

      {/* Tabel Penyewa */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nama Lengkap & Kontak</th>
                <th className="py-3.5 px-4">NIK (KTP)</th>
                <th className="py-3.5 px-4">Alamat Asal</th>
                <th className="py-3.5 px-4">Kontak Darurat</th>
                <th className="py-3.5 px-4">Status Verifikasi</th>
                {role === 'pengelola' && <th className="py-3.5 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(({ profile, identitas }) => (
                <tr key={profile.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{profile.nama_lengkap}</div>
                    <div className="text-xs text-slate-500">{profile.email} · {profile.no_hp}</div>
                  </td>

                  {/* NIK Display: Full for Pengelola, Masked for Pemilik (BR-10) */}
                  <td className="py-3.5 px-4 font-mono text-xs">
                    {identitas?.nik ? (
                      role === 'pemilik' ? (
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {maskNIK(identitas.nik)}
                        </span>
                      ) : (
                        <span className="font-medium text-slate-800">{identitas.nik}</span>
                      )
                    ) : (
                      <span className="text-slate-400 italic">Belum mengisi</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-xs">
                    {identitas?.alamat_asal || <span className="text-slate-400 italic">-</span>}
                  </td>

                  <td className="py-3.5 px-4 text-xs">
                    {identitas?.kontak_darurat_nama ? (
                      <div>
                        <div className="font-medium text-slate-800">{identitas.kontak_darurat_nama}</div>
                        <div className="text-slate-500">{identitas.kontak_darurat_hp}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {getVerificationBadge(identitas?.status_verifikasi)}
                  </td>

                  {/* Aksi Verifikasi untuk Pengelola */}
                  {role === 'pengelola' && (
                    <td className="py-3.5 px-4 text-right">
                      {identitas ? (
                        <button
                          onClick={() => {
                            setVerifyingPenyewa({ profile, identitas });
                            setVerificationNotes(identitas.catatan_verifikasi || '');
                          }}
                          className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold transition-colors border border-emerald-200"
                        >
                          Periksa & Verifikasi
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Data Kosong</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Verifikasi KTP (Pengelola) */}
      {verifyingPenyewa && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Verifikasi Identitas Penyewa
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Lengkap:</span>
                <span className="font-bold text-slate-800">{verifyingPenyewa.profile.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIK (16 Digit):</span>
                <span className="font-mono font-bold text-slate-800">{verifyingPenyewa.identitas.nik}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Alamat Asal:</span>
                <span className="font-medium text-slate-700">{verifyingPenyewa.identitas.alamat_asal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kontak Darurat:</span>
                <span className="font-medium text-slate-700">
                  {verifyingPenyewa.identitas.kontak_darurat_nama} ({verifyingPenyewa.identitas.kontak_darurat_hp})
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Berkas KTP:</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {verifyingPenyewa.identitas.foto_ktp_path || 'ktp.jpg'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Catatan Verifikasi (Wajib jika menolak)
              </label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Misal: Foto KTP jelas, NIK sesuai data kependudukan."
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVerifyingPenyewa(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Tutup
              </button>
              <button
                onClick={() => handleVerify('ditolak')}
                className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Tolak Identitas
              </button>
              <button
                onClick={() => handleVerify('terverifikasi')}
                className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm"
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
