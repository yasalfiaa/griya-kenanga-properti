import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { ShieldAlert, AlertCircle, Search } from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const { role } = useAuth();
  const [auditLogs] = useState(() => dataStore.getAuditLogs());
  const [filterAction, setFilterAction] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  if (role !== 'pemilik') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900">Akses Dibatasi</h2>
        <p className="text-sm text-rose-700">Hanya Pemilik yang berhak melihat jejak audit log sistem.</p>
      </div>
    );
  }

  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = filterAction === 'all' ? true : log.aksi.includes(filterAction);
    const matchesSearch =
      searchKeyword === '' ||
      log.tabel.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      log.aksi.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (log.pelaku?.nama_lengkap && log.pelaku.nama_lengkap.toLowerCase().includes(searchKeyword.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-purple-600" /> Jejak Rekam Sistem (Audit Log)
        </h1>
        <p className="text-sm text-slate-500">
          Mencatat semua aksi sensitif: aktivasi/pengakhiran kontrak, pencatatan/pembatalan bayar, ubah harga & status, verifikasi KTP (Tanpa NIK & KTP rahasia).
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari aksi, tabel, atau nama staf..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">Semua Jenis Aksi</option>
          <option value="kontrak">Kontrak</option>
          <option value="pembayaran">Pembayaran & Batal</option>
          <option value="tagihan">Tagihan</option>
          <option value="verifikasi">Verifikasi KTP</option>
          <option value="unit">Perubahan Unit</option>
        </select>
      </div>

      {/* Tabel Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pelaku & Peran</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Tabel / Target</th>
                <th className="py-3 px-4">Sebelum / Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{log.dibuat_pada}</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-900">
                    <div>{log.pelaku?.nama_lengkap || log.pelaku_id}</div>
                    <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                      {log.peran}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{log.aksi}</td>
                  <td className="py-3 px-4 text-slate-600">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{log.tabel}</span> ({log.data_id?.slice(0, 8)}...)
                  </td>
                  <td className="py-3 px-4 text-[11px] max-w-xs truncate text-slate-500 font-mono">
                    {log.sesudah ? JSON.stringify(log.sesudah) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
