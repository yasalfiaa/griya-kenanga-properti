import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { formatRupiah } from '../utils/business-rules';
import {
  Download,
  Calendar,
  Building2,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { role } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('all');

  const units = dataStore.getUnits();
  const contracts = dataStore.getContracts();
  const invoices = dataStore.getInvoices();

  if (role !== 'pemilik') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-900">Akses Dibatasi</h2>
        <p className="text-sm text-rose-700 max-w-md mx-auto">
          Laporan pendapatan, tunggakan, dan okupansi per unit hanya berhak dibuka oleh Pemilik usaha. Pengelola dan Penyewa dilarang mengakses halaman ini.
        </p>
      </div>
    );
  }

  // Filter tagihan
  const filteredInvoices = invoices.filter(i =>
    selectedMonth === 'all' ? true : i.periode.startsWith(selectedMonth)
  );

  const totalDitagihkan = filteredInvoices.reduce((acc, curr) => acc + curr.nominal_sewa + curr.denda, 0);
  const totalDiterima = filteredInvoices.reduce((acc, curr) => acc + curr.terbayar, 0);
  const totalTunggakan = Math.max(0, totalDitagihkan - totalDiterima);

  // Hunian per bulan (Unit terisi / unit tidak nonaktif)
  const unitAktif = units.filter(u => u.status !== 'nonaktif').length;
  const unitTerisi = contracts.filter(k => k.status === 'aktif').length;
  const occupancyRate = ((unitTerisi / unitAktif) * 100).toFixed(1);

  // Data pendapatan per unit (untuk tabel dan CSV export)
  const unitRevenueData = units.map(u => {
    const unitInvoices = filteredInvoices.filter(i => i.kontrak?.unit_id === u.id);
    const ditagihkan = unitInvoices.reduce((acc, curr) => acc + curr.nominal_sewa + curr.denda, 0);
    const diterima = unitInvoices.reduce((acc, curr) => acc + curr.terbayar, 0);
    const tunggakan = Math.max(0, ditagihkan - diterima);
    return {
      kode: u.kode,
      lantai: u.lantai,
      tipe: u.tipe,
      status: u.status,
      ditagihkan,
      diterima,
      tunggakan,
    };
  });

  // Export CSV Function (PRD Bagian 9 Butir 4)
  const handleExportCSV = () => {
    const headers = ['Kode Unit', 'Lantai', 'Tipe', 'Status', 'Ditagihkan (Rp)', 'Diterima (Rp)', 'Tunggakan (Rp)'];
    const rows = unitRevenueData.map(d => [
      d.kode,
      d.lantai,
      d.tipe,
      d.status,
      d.ditagihkan,
      d.diterima,
      d.tunggakan,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Pendapatan_Griya_Kenanga_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ringkasan per bulan untuk grafik batang (Agustus, September, Oktober 2026)
  const monthlySummary = ['2026-08', '2026-09', '2026-10'].map(m => {
    const mInvoices = invoices.filter(i => i.periode.startsWith(m));
    const tagih = mInvoices.reduce((acc, curr) => acc + curr.nominal_sewa + curr.denda, 0);
    const terima = mInvoices.reduce((acc, curr) => acc + curr.terbayar, 0);
    return {
      month: m,
      label: m === '2026-08' ? 'Agustus 2026' : m === '2026-09' ? 'September 2026' : 'Oktober 2026',
      tagih,
      terima,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Laporan Eksekutif Pendapatan & Hunian
          </h1>
          <p className="text-sm text-muted-foreground">
            Analisis arus kas sewa, tunggakan per unit, dan tingkat keterisian (Khusus Pemilik).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Bulan */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Semua Bulan (Agus - Okt 2026)</option>
            <option value="2026-10">Oktober 2026</option>
            <option value="2026-09">September 2026</option>
            <option value="2026-08">Agustus 2026</option>
          </select>

          {/* Unduh CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Unduh CSV
          </button>
        </div>
      </div>

      {/* 4 Kartu Ringkasan Finansial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Ditagihkan</span>
          <div className="text-2xl font-extrabold text-foreground">{formatRupiah(totalDitagihkan)}</div>
          <p className="text-xs text-muted-foreground">Termasuk denda berjalan</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Total Diterima (Kas Masuk)</span>
          <div className="text-2xl font-extrabold text-primary">{formatRupiah(totalDiterima)}</div>
          <p className="text-xs text-primary font-medium">Pembayaran sah terverifikasi</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">Total Tunggakan</span>
          <div className="text-2xl font-extrabold text-rose-600">{formatRupiah(totalTunggakan)}</div>
          <p className="text-xs text-rose-600 font-medium">Piutang sewa belum dibayar</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Tingkat Hunian</span>
          <div className="text-2xl font-extrabold text-purple-700">{occupancyRate}%</div>
          <p className="text-xs text-purple-600 font-medium">{unitTerisi} dari {unitAktif} unit layak huni</p>
        </div>
      </div>

      {/* Visualisasi Grafik Batang: Ditagihkan vs Diterima Bulanan */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Perbandingan Ditagihkan vs Diterima Per Bulan
        </h3>

        <div className="space-y-4 pt-2">
          {monthlySummary.map((m) => {
            const maxVal = Math.max(...monthlySummary.map(s => s.tagih));
            const tagihWidth = `${(m.tagih / maxVal) * 100}%`;
            const terimaWidth = `${(m.terima / maxVal) * 100}%`;

            return (
              <div key={m.month} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>{m.label}</span>
                  <span>
                    Ditagih: <strong className="text-foreground">{formatRupiah(m.tagih)}</strong> · Diterima:{' '}
                    <strong className="text-primary">{formatRupiah(m.terima)}</strong>
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Bar Ditagihkan */}
                  <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-muted-foreground h-full rounded-full transition-all duration-500"
                      style={{ width: tagihWidth }}
                    ></div>
                  </div>
                  {/* Bar Diterima */}
                  <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: terimaWidth }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-muted-foreground inline-block"></span> Ditagihkan
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary inline-block"></span> Diterima (Lunas)
          </div>
        </div>
      </div>

      {/* Tabel Pendapatan Per Unit */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" /> Rincian Pendapatan dan Tunggakan Per Unit
          </h3>
          <span className="text-xs text-muted-foreground">Total 24 Unit</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-3 px-4">Kode Unit</th>
                <th className="py-3 px-4">Lantai & Tipe</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ditagihkan</th>
                <th className="py-3 px-4 text-right">Diterima</th>
                <th className="py-3 px-4 text-right">Tunggakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unitRevenueData.map((d) => (
                <tr key={d.kode} className="hover:bg-muted/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground">{d.kode}</td>
                  <td className="py-3 px-4 text-xs">
                    Lantai {d.lantai} · <span className="capitalize font-medium">{d.tipe}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded text-foreground capitalize">
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-foreground">
                    {formatRupiah(d.ditagihkan)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">
                    {formatRupiah(d.diterima)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">
                    {formatRupiah(d.tunggakan)}
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
