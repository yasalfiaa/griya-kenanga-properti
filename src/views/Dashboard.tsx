import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { formatRupiah } from '../utils/business-rules';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [data] = useState(() => ({
    units: dataStore.getUnits(),
    contracts: dataStore.getContracts(),
    invoices: dataStore.getInvoices(),
    damageReports: dataStore.getDamageReports(),
    tenants: dataStore.getTenants(),
  }));

  // --- LOGIKA STAF (PENGELOLA & PEMILIK) ---
  const unitsLayakSewa = data.units.filter(u => u.status !== 'nonaktif').length;
  const unitsTerisi = data.contracts.filter(k => k.status === 'aktif').length;
  const invoicesOktober = data.invoices.filter(i => i.periode.startsWith('2026-10'));
  const invoicesLunas = invoicesOktober.filter(i => i.status === 'lunas').length;

  // Tagihan lewat jatuh tempo (Jatuh tempo 10 Okt 2026, tanggal acuan 15 Okt 2026)
  const invoicesOverdue = data.invoices.filter(
    i => i.status !== 'lunas' && i.status !== 'dibatalkan' && i.jatuh_tempo < '2026-10-15'
  );

  // Laporan kerusakan terbuka
  const openReports = data.damageReports.filter(r =>
    ['dilaporkan', 'diproses', 'menunggu_persetujuan'].includes(r.status)
  );

  // Kontrak yang berakhir dalam 30 hari (antara 15 Okt 2026 dan 15 Nov 2026)
  const expiringContracts = data.contracts.filter(
    k => k.status === 'aktif' && k.tanggal_selesai >= '2026-10-15' && k.tanggal_selesai <= '2026-11-15'
  );

  // --- LOGIKA PENYEWA ---
  const tenantActiveContract = data.contracts.find(
    k => k.penyewa_id === currentUser?.id && k.status === 'aktif'
  );
  const tenantInvoices = data.invoices.filter(
    i => i.kontrak?.penyewa_id === currentUser?.id && i.status !== 'dibatalkan'
  );
  const tenantPendingInvoice = tenantInvoices.find(i => i.status !== 'lunas');
  const tenantDamageReports = data.damageReports.filter(r => r.pelapor_id === currentUser?.id);
  const tenantIdentitas = data.tenants.find(t => t.profile.id === currentUser?.id)?.identitas;

  if (role === 'penyewa') {
    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Portal Penghuni</span>
            <h1 className="text-2xl font-bold mt-1">Selamat Datang, {currentUser?.nama_lengkap}</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Griya Kenanga Residence · Kamar {tenantActiveContract?.unit?.kode || 'Belum Ada Kontrak Aktif'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-xs space-y-1">
            <div className="text-emerald-200">Status Identitas:</div>
            <div className="font-semibold flex items-center gap-1.5 text-white">
              {tenantIdentitas?.status_verifikasi === 'terverifikasi' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  Terverifikasi KTP
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-300" />
                  {tenantIdentitas?.status_verifikasi === 'ditolak'
                    ? 'Ditolak (Perlu Diperbaiki)'
                    : 'Belum Diverifikasi'}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Identitas Alert jika belum terverifikasi */}
        {tenantIdentitas?.status_verifikasi !== 'terverifikasi' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Identitas KTP Belum Terverifikasi</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Kontrak baru hanya bisa diaktifkan jika NIK dan foto KTP Anda sudah diverifikasi oleh Pengelola.
                </p>
              </div>
            </div>
            <Link
              to="/identitas"
              className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Lengkapi KTP →
            </Link>
          </div>
        )}

        {/* Kontrak & Tagihan Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kontrak Aktif */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" /> Kontrak Sewa Aktif
              </h3>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                {tenantActiveContract?.status || 'Tidak Ada'}
              </span>
            </div>

            {tenantActiveContract ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nomor Kontrak</span>
                  <span className="font-semibold text-slate-800">{tenantActiveContract.nomor}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Unit / Kamar</span>
                  <span className="font-semibold text-slate-800">
                    {tenantActiveContract.unit?.kode} ({tenantActiveContract.unit?.tipe.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Periode Sewa</span>
                  <span className="font-medium text-slate-700">
                    {tenantActiveContract.tanggal_mulai} s/d {tenantActiveContract.tanggal_selesai}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Sewa Bulanan (Terkunci)</span>
                  <span className="font-bold text-emerald-600">
                    {formatRupiah(tenantActiveContract.harga_sewa_bulanan)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">
                Belum ada kontrak aktif. Hubungi pengelola untuk aktivasi kamar Anda.
              </p>
            )}
          </div>

          {/* Tagihan Bulan Berjalan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" /> Tagihan Bulan Ini
              </h3>
              {tenantPendingInvoice ? (
                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                  {tenantPendingInvoice.status === 'sebagian' ? 'Dibayar Sebagian' : 'Belum Lunas'}
                </span>
              ) : (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                  Semua Lunas
                </span>
              )}
            </div>

            {tenantPendingInvoice ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nomor Invoice</span>
                  <span className="font-semibold text-slate-800">{tenantPendingInvoice.nomor}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Jatuh Tempo</span>
                  <span className="font-semibold text-rose-600">
                    {tenantPendingInvoice.jatuh_tempo} (Lewat Jatuh Tempo)
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Denda Keterlambatan</span>
                  <span className="font-semibold text-rose-600">
                    {formatRupiah(tenantPendingInvoice.denda)}
                  </span>
                </div>
                <div className="flex justify-between py-2 bg-slate-50 p-2.5 rounded-xl">
                  <span className="font-semibold text-slate-700">Total Sisa Tagihan</span>
                  <span className="font-bold text-lg text-emerald-700">
                    {formatRupiah(tenantPendingInvoice.sisa_tagihan || 0)}
                  </span>
                </div>
                <Link
                  to="/tagihan"
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm shadow-sm"
                >
                  Lihat Cara Pembayaran <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada tagihan tertunggak</p>
                <p className="text-xs text-slate-500">Terima kasih telah membayar sewa tepat waktu!</p>
              </div>
            )}
          </div>
        </div>

        {/* Laporan Kerusakan Terakhir */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" /> Laporan Kerusakan Saya
            </h3>
            <Link
              to="/kerusakan"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              Buat Laporan Baru →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {tenantDamageReports.length > 0 ? (
              tenantDamageReports.slice(0, 3).map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">{r.judul}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.nomor} · Kategori: {r.kategori}
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700">
                    {r.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-3 text-center">Belum ada laporan kerusakan.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- BERANDA STAF (PENGELOLA & PEMILIK) ---
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ringkasan Operasional Properti</h1>
          <p className="text-sm text-slate-500">
            Griya Kenanga Residence · Acuan Data: <span className="font-semibold text-slate-700">15 Oktober 2026</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Akses Internal: {role === 'pemilik' ? 'Pemilik Usaha' : 'Pengelola Operasional'}
        </div>
      </div>

      {/* 4 Kartu Metrik Staf (Sesuai PRD Bagian 9 - Bebas dari Angka Pendapatan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unit Terisi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Tingkat Hunian Unit</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {unitsTerisi} <span className="text-lg text-slate-400 font-normal">/ {unitsLayakSewa}</span>
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            {((unitsTerisi / unitsLayakSewa) * 100).toFixed(1)}% Unit Terisi (Layak Sewa)
          </div>
        </div>

        {/* Tagihan Bulan Ini Lunas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Tagihan Okt Lunas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {invoicesLunas} <span className="text-lg text-slate-400 font-normal">/ {invoicesOktober.length}</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Periode Tagihan Oktober 2026
          </div>
        </div>

        {/* Tagihan Lewat Jatuh Tempo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Lewat Jatuh Tempo</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-extrabold text-rose-600">
            {invoicesOverdue.length} <span className="text-sm font-normal text-rose-500">Tagihan</span>
          </div>
          <div className="text-xs text-rose-600 font-medium">
            Jatuh Tempo tgl 10 (Dikenai Denda)
          </div>
        </div>

        {/* Laporan Kerusakan Terbuka */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Laporan Terbuka</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600">
            {openReports.length} <span className="text-sm font-normal text-amber-500">Laporan</span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Memerlukan Tindakan / Persetujuan
          </div>
        </div>
      </div>

      {/* Grid Rincian Tabel: Tagihan Jatuh Tempo & Kontrak Berakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tagihan Lewat Jatuh Tempo dengan Denda Hari Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Tagihan Lewat Jatuh Tempo (Per 15 Okt 2026)
            </h3>
            <Link to="/tagihan" className="text-xs font-semibold text-emerald-600 hover:underline">
              Kelola →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {invoicesOverdue.slice(0, 5).map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-800">
                    {inv.kontrak?.penyewa?.nama_lengkap} (Kamar {inv.kontrak?.unit?.kode})
                  </div>
                  <div className="text-slate-500">
                    {inv.nomor} · Jatuh Tempo: {inv.jatuh_tempo}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-600">Sisa: {formatRupiah(inv.sisa_tagihan || 0)}</div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    (Termasuk Denda: {formatRupiah(inv.denda)})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kontrak Berakhir dalam 30 Hari */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" /> Kontrak Berakhir Dalam 30 Hari
            </h3>
            <Link to="/kontrak" className="text-xs font-semibold text-emerald-600 hover:underline">
              Semua Kontrak →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {expiringContracts.length > 0 ? (
              expiringContracts.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {c.penyewa?.nama_lengkap} ({c.unit?.kode})
                    </div>
                    <div className="text-slate-500">{c.nomor}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Selesai: {c.tanggal_selesai}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">
                Tidak ada kontrak yang berakhir dalam 30 hari ke depan.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
