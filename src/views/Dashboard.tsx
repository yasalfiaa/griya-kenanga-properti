import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { formatRupiah } from '../utils/business-rules';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Wrench,
  Clock,
  ArrowRight,
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
    i =>
      i.kontrak?.penyewa_id === currentUser?.id &&
      i.status !== 'dibatalkan' &&
      (i.periode || '') >= '2026-10'
  );
  // Urutkan tagihan belum lunas dari periode terlama (FIFO) mulai Oktober 2026 agar tunggakan terlama diselesaikan terlebih dahulu
  const unpaidTenantInvoices = tenantInvoices
    .filter(i => i.status !== 'lunas')
    .sort((a, b) => (a.periode || '').localeCompare(b.periode || ''));
  const tenantPendingInvoice = unpaidTenantInvoices[0];
  const isTenantInvoiceOverdue = Boolean(
    tenantPendingInvoice &&
      tenantPendingInvoice.status !== 'lunas' &&
      (tenantPendingInvoice.denda > 0 ||
        (tenantPendingInvoice.jatuh_tempo &&
          (tenantPendingInvoice.jatuh_tempo < '2026-10-15' ||
            tenantPendingInvoice.jatuh_tempo < new Date().toISOString().slice(0, 10))))
  );
  const tenantDamageReports = data.damageReports.filter(r => r.pelapor_id === currentUser?.id);
  const tenantIdentitas = data.tenants.find(t => t.profile.id === currentUser?.id)?.identitas;

  if (role === 'penyewa') {
    return (
      <div className="space-y-6">
        {/* Header Beranda Penyewa (gaya sama dengan beranda staf, tanpa banner gradient) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Selamat datang, {currentUser?.nama_lengkap}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Griya Kenanga Residence · Kamar {tenantActiveContract?.unit?.kode || 'Belum Ada Kontrak Aktif'}
            </p>
          </div>
          {/* Badge Status Identitas — latar netral; hover tooltip hanya untuk
              status terverifikasi/belum, tanpa hover & tooltip untuk ditolak */}
          <div
            role="status"
            title={
              tenantIdentitas?.status_verifikasi === 'ditolak'
                ? undefined
                : `Status Verifikasi KTP: ${
                    tenantIdentitas?.status_verifikasi === 'terverifikasi'
                      ? 'Terverifikasi — identitas Anda sudah lolos pemeriksaan Pengelola.'
                      : 'Belum Diverifikasi — identitas Anda menunggu pemeriksaan Pengelola.'
                  }`
            }
            aria-label={`Status verifikasi KTP: ${
              tenantIdentitas?.status_verifikasi === 'terverifikasi'
                ? 'Terverifikasi'
                : tenantIdentitas?.status_verifikasi === 'ditolak'
                  ? 'Ditolak'
                  : 'Belum Diverifikasi'
            }`}
            className={`flex items-center gap-2 text-xs bg-muted/50 text-foreground border border-border px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              tenantIdentitas?.status_verifikasi === 'ditolak'
                ? ''
                : 'cursor-help hover:bg-muted/80'
            }`}
          >
            {tenantIdentitas?.status_verifikasi === 'terverifikasi' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : tenantIdentitas?.status_verifikasi === 'ditolak' ? (
              <XCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            {tenantIdentitas?.status_verifikasi === 'terverifikasi'
              ? 'Terverifikasi KTP'
              : tenantIdentitas?.status_verifikasi === 'ditolak'
                ? 'Ditolak'
                : 'Belum Diverifikasi'}
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
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Kontrak Sewa Aktif
              </h3>
              <span className="text-xs font-semibold bg-emerald-100 text-primary px-2.5 py-0.5 rounded-full">
                {tenantActiveContract?.status || 'Tidak Ada'}
              </span>
            </div>

            {tenantActiveContract ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Nomor Kontrak</span>
                  <span className="font-semibold text-foreground">{tenantActiveContract.nomor}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Unit / Kamar</span>
                  <span className="font-semibold text-foreground">
                    {tenantActiveContract.unit?.kode} ({tenantActiveContract.unit?.tipe.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Periode Sewa</span>
                  <span className="font-medium text-foreground">
                    {tenantActiveContract.tanggal_mulai} s/d {tenantActiveContract.tanggal_selesai}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Sewa Bulanan (Terkunci)</span>
                  <span className="font-bold text-primary">
                    {formatRupiah(tenantActiveContract.harga_sewa_bulanan)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada kontrak aktif. Hubungi pengelola untuk aktivasi kamar Anda.
              </p>
            )}
          </div>

          {/* Tagihan Bulan Berjalan — belum ada tagihan untuk penyewa tanpa kontrak aktif */}
          {!tenantActiveContract ? (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" /> Tagihan Bulan Ini
                </h3>
                <span className="text-xs font-semibold bg-emerald-100 text-primary px-2.5 py-0.5 rounded-full">
                  Tidak Ada
                </span>
              </div>
              <p className="text-sm text-muted-foreground py-4 text-center">
                Informasi tagihan akan diterbitkan setelah kontrak sewa diaktifkan Pengelola.
              </p>
            </div>
          ) : (
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" /> Tagihan Bulan Ini
              </h3>
              {tenantPendingInvoice ? (
                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                  {tenantPendingInvoice.status === 'sebagian' ? 'Dibayar Sebagian' : 'Belum Lunas'}
                </span>
              ) : (
                <span className="text-xs font-semibold bg-emerald-100 text-primary px-2.5 py-0.5 rounded-full">
                  Semua Lunas
                </span>
              )}
            </div>

            {tenantPendingInvoice ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Periode Tagihan</span>
                  <span className="font-semibold text-foreground">
                    {tenantPendingInvoice.periode ? tenantPendingInvoice.periode.slice(0, 7) : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Nomor Invoice</span>
                  <span className="font-semibold text-foreground">{tenantPendingInvoice.nomor}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Jatuh Tempo</span>
                  <span
                    className={`font-semibold ${
                      isTenantInvoiceOverdue ? 'text-rose-600' : 'text-foreground'
                    }`}
                  >
                    {tenantPendingInvoice.jatuh_tempo}
                    {isTenantInvoiceOverdue && ' (Lewat Jatuh Tempo)'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Denda Keterlambatan</span>
                  <span
                    className={`font-semibold ${
                      isTenantInvoiceOverdue && tenantPendingInvoice.denda > 0
                        ? 'text-rose-600'
                        : 'text-foreground'
                    }`}
                  >
                    {formatRupiah(tenantPendingInvoice.denda)}
                  </span>
                </div>
                <div className="flex justify-between py-2 bg-muted/50 p-2.5 rounded-xl">
                  <span className="font-semibold text-foreground">Total Sisa Tagihan</span>
                  <span className="font-bold text-lg text-primary">
                    {formatRupiah(tenantPendingInvoice.sisa_tagihan || 0)}
                  </span>
                </div>
                <Link
                  to="/tagihan"
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm shadow-sm"
                >
                  Lihat Cara Pembayaran <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-foreground">Tidak ada tagihan tertunggak</p>
                <p className="text-xs text-muted-foreground">Terima kasih telah membayar sewa tepat waktu!</p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Laporan Kerusakan Terakhir */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" /> Laporan Kerusakan Saya
            </h3>
            <Link
              to="/kerusakan"
              className="text-xs font-semibold text-primary hover:text-primary flex items-center gap-1"
            >
              Buat Laporan Baru →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {tenantDamageReports.length > 0 ? (
              tenantDamageReports.slice(0, 3).map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{r.judul}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.nomor} · Kategori: {r.kategori}
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-foreground">
                    {r.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-3 text-center">Belum ada laporan kerusakan.</p>
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Ringkasan Operasional Properti</h1>
          <p className="text-sm text-muted-foreground">
            Griya Kenanga Residence
          </p>
        </div>
      </div>

      {/* 4 Kartu Metrik Staf (Sesuai PRD Bagian 9 - Bebas dari Angka Pendapatan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unit Terisi */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Tingkat Hunian Unit</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-foreground">
            {unitsTerisi} <span className="text-lg text-muted-foreground font-normal">/ {unitsLayakSewa}</span>
          </div>
          <div className="text-xs text-primary font-medium">
            {((unitsTerisi / unitsLayakSewa) * 100).toFixed(1)}% Unit Terisi (Layak Sewa)
          </div>
        </div>

        {/* Tagihan Bulan Ini Lunas */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Tagihan Okt Lunas</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-foreground">
            {invoicesLunas} <span className="text-lg text-muted-foreground font-normal">/ {invoicesOktober.length}</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Periode Tagihan Oktober 2026
          </div>
        </div>

        {/* Tagihan Lewat Jatuh Tempo */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
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
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Laporan Terbuka</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600">
            {openReports.length} <span className="text-sm font-normal text-amber-500">Laporan</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Memerlukan Tindakan / Persetujuan
          </div>
        </div>
      </div>

      {/* Grid Rincian Tabel: Tagihan Jatuh Tempo & Kontrak Berakhir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tagihan Lewat Jatuh Tempo dengan Denda Hari Ini */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Tagihan Lewat Jatuh Tempo (Per 15 Okt 2026)
            </h3>
            <Link to="/tagihan" className="text-xs font-semibold text-primary hover:underline">
              Kelola →
            </Link>
          </div>

          <div className="divide-y divide-border overflow-x-auto">
            {invoicesOverdue.slice(0, 5).map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-foreground">
                    {inv.kontrak?.penyewa?.nama_lengkap} (Kamar {inv.kontrak?.unit?.kode})
                  </div>
                  <div className="text-muted-foreground">
                    {inv.nomor} · Jatuh Tempo: {inv.jatuh_tempo}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-600">Sisa: {formatRupiah(inv.sisa_tagihan || 0)}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    (Termasuk Denda: {formatRupiah(inv.denda)})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kontrak Berakhir dalam 30 Hari */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" /> Kontrak Berakhir Dalam 30 Hari
            </h3>
            <Link to="/kontrak" className="text-xs font-semibold text-primary hover:underline">
              Semua Kontrak →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {expiringContracts.length > 0 ? (
              expiringContracts.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-foreground">
                      {c.penyewa?.nama_lengkap} ({c.unit?.kode})
                    </div>
                    <div className="text-muted-foreground">{c.nomor}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Selesai: {c.tanggal_selesai}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Tidak ada kontrak yang berakhir dalam 30 hari ke depan.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
