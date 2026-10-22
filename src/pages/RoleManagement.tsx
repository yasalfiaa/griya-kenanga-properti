import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { MOCK_PROFILES } from '../data/mock-data';
import { Profile, RoleType } from '../types/database';
import { UserCheck, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

export const RoleManagement: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>(() => JSON.parse(JSON.stringify(MOCK_PROFILES)));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (role !== 'pemilik') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900">Akses Dibatasi (BR-10)</h2>
        <p className="text-sm text-rose-700">Hanya Pemilik yang berhak mengatur peran akun staf dan penyewa.</p>
      </div>
    );
  }

  const handleChangeRole = (userId: string, newRole: RoleType) => {
    // BR-10: Pemilik tidak bisa mengubah peran akunnya sendiri
    if (userId === currentUser?.id) {
      setMessage({ type: 'error', text: 'Pemilik tidak dapat mengubah peran akunnya sendiri (BR-10).' });
      return;
    }

    const targetUser = profiles.find(p => p.id === userId);
    if (targetUser) {
      targetUser.peran = newRole;
      setProfiles([...profiles]);
      setMessage({
        type: 'success',
        text: `Peran akun ${targetUser.nama_lengkap} berhasil diubah menjadi '${newRole}'.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-purple-600" /> Pengaturan Hak Akses & Peran Akun
        </h1>
        <p className="text-sm text-slate-500">
          Akun baru yang mendaftar sendiri otomatis Penyewa. Peran Pengelola dan Pemilik hanya bisa diberikan oleh Pemilik (BR-10).
        </p>
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

      {/* Tabel Akun */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Email & Kontak</th>
                <th className="py-3.5 px-4">Peran Saat Ini</th>
                <th className="py-3.5 px-4 text-right">Ubah Peran (BR-10)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => {
                const isSelf = p.id === currentUser?.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.nama_lengkap} {isSelf && <span className="text-xs text-purple-600 font-normal">(Anda)</span>}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div>{p.email}</div>
                      <div className="text-slate-400">{p.no_hp}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                          p.peran === 'pemilik'
                            ? 'bg-purple-100 text-purple-800'
                            : p.peran === 'pengelola'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {p.peran}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-slate-400 italic">Tidak dapat diubah (BR-10)</span>
                      ) : (
                        <select
                          value={p.peran}
                          onChange={(e) => handleChangeRole(p.id, e.target.value as RoleType)}
                          className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="penyewa">Penyewa</option>
                          <option value="pengelola">Pengelola</option>
                          <option value="pemilik">Pemilik</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
