import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { Profile, RoleType } from '../types/database';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../api/supabase';

export const RoleManagement: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfiles = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.from('profiles').select('*').order('nama_lengkap', { ascending: true });
        if (data && data.length > 0) {
          setProfiles(data as Profile[]);
          // Sinkronkan juga ke dataStore
          (dataStore as any).profiles = data;
          return;
        }
      }
      // Fallback ke dataStore (urut abjad A-Z berdasarkan nama lengkap)
      const fallback = dataStore.getProfiles().sort((a, b) =>
        a.nama_lengkap.localeCompare(b.nama_lengkap, 'id', { sensitivity: 'base' })
      );
      setProfiles(fallback);
    } catch (e) {
      console.warn('Gagal memuat profil dari Supabase:', e);
      const fallback = dataStore.getProfiles().sort((a, b) =>
        a.nama_lengkap.localeCompare(b.nama_lengkap, 'id', { sensitivity: 'base' })
      );
      setProfiles(fallback);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  if (role !== 'pemilik') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900">Akses Dibatasi</h2>
        <p className="text-sm text-rose-700">Hanya Pemilik yang berhak mengatur peran akun staf dan penyewa.</p>
      </div>
    );
  }

  const handleChangeRole = async (userId: string, newRole: RoleType) => {
    // BR-10: Pemilik tidak bisa mengubah peran akunnya sendiri
    if (userId === currentUser?.id) {
      setMessage({ type: 'error', text: 'Pemilik tidak dapat mengubah peran akunnya sendiri.' });
      return;
    }

    const targetUser = profiles.find(p => p.id === userId);
    if (!targetUser) return;

    setLoading(true);
    try {
      await dataStore.updateUserRole(userId, newRole, currentUser!);
      await loadProfiles();
      setMessage({
        type: 'success',
        text: `Peran akun ${targetUser.nama_lengkap} berhasil diubah menjadi '${newRole}'.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Gagal mengubah peran akun.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Pengaturan Hak Akses Akun
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola akses pengguna yang terdaftar pada aplikasi ini.
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

      {/* Tabel Akun */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-2 px-4">Nama Lengkap</th>
                <th className="py-2 px-4">Email & Kontak</th>
                <th className="py-2 px-4">Peran Saat Ini</th>
                <th className="py-2 px-4 text-right">Ubah Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...profiles]
                .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id', { sensitivity: 'base' }))
                .map((p) => {
                const isSelf = p.id === currentUser?.id;
                return (
                  <tr key={p.id} className="hover:bg-muted/60 transition-colors">
                    <td className="py-2 px-4 font-semibold text-foreground">
                      {p.nama_lengkap} {isSelf && <span className="text-xs text-purple-600 font-normal">(Anda)</span>}
                    </td>
                    <td className="py-2 px-4 text-xs">
                      <div>{p.email}</div>
                      <div className="text-muted-foreground">{p.no_hp}</div>
                    </td>
                    <td className="py-2 px-4">
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
                    <td className="py-2 px-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground italic">Tidak dapat diubah</span>
                      ) : (
                        <select
                          value={p.peran}
                          disabled={loading}
                          onChange={(e) => handleChangeRole(p.id, e.target.value as RoleType)}
                          className="text-xs font-semibold bg-card border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
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
