import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataStore } from '../api/data-service';
import { formatRupiah } from '../utils/business-rules';
import { Unit, Kontrak, Tagihan } from '../types/database';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
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

  const [units, setUnits] = useState<Unit[]>(() => dataStore.getUnits());
  const [contracts, setContracts] = useState<Kontrak[]>(() => dataStore.getContracts());
  const [invoices, setInvoices] = useState<Tagihan[]>(() => dataStore.getInvoices());

  // Sinkronisasi data real-time dengan Supabase saat halaman laporan dimuat
  useEffect(() => {
    let isMounted = true;
    dataStore.loadFromSupabase().then(() => {
      if (isMounted) {
        setUnits(dataStore.getUnits());
        setContracts(dataStore.getContracts());
        setInvoices(dataStore.getInvoices());
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Arus kas terdata di sistem mulai bulan Agustus 2026 sesuai data acuan contoh (Agustus, September, Oktober)
  const systemInvoices = useMemo(() => {
    return invoices.filter(i => (i.periode || '').slice(0, 7) >= '2026-08');
  }, [invoices]);

  // Filter tagihan berdasarkan bulan (atau seluruh periode aktif mulai Agustus 2026 jika 'all')
  const filteredInvoices = useMemo(() => {
    return systemInvoices.filter(i =>
      selectedMonth === 'all' ? true : i.periode.startsWith(selectedMonth)
    );
  }, [systemInvoices, selectedMonth]);

  const validInvoices = filteredInvoices.filter(i => i.status !== 'dibatalkan');
  const totalDitagihkan = validInvoices.reduce((acc, curr) => acc + curr.nominal_sewa + curr.denda, 0);
  const totalDiterima = filteredInvoices.reduce((acc, curr) => acc + curr.terbayar, 0);
  const totalTunggakan = Math.max(0, totalDitagihkan - totalDiterima);

  // Hunian per bulan (Unit terisi / unit tidak nonaktif)
  const unitAktif = units.filter(u => u.status !== 'nonaktif').length;
  const unitTerisi = contracts.filter(k => {
    if (k.status !== 'aktif') return false;
    if (selectedMonth === 'all') return true;
    const targetDate = `${selectedMonth}-01`;
    const start = k.tanggal_mulai;
    const end = k.tanggal_selesai;
    return (!start || start <= targetDate) && (!end || end >= targetDate);
  }).length;
  const occupancyRate = unitAktif > 0 ? ((unitTerisi / unitAktif) * 100).toFixed(1) : '0';

  // Data pendapatan per unit (untuk tabel dan CSV export)
  const unitRevenueData = units.map(u => {
    const unitInvoices = validInvoices.filter(i => i.kontrak?.unit_id === u.id);
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

  // Kumpulkan seluruh periode aktif secara dinamis untuk perbandingan bulanan (mulai Agustus 2026)
  const availableChartMonths = useMemo(() => {
    const monthSet = new Set<string>();
    invoices.forEach(i => {
      const p = i.periode ? i.periode.slice(0, 7) : '';
      if (p >= '2026-08') {
        monthSet.add(p);
      }
    });
    // Pastikan periode acuan data contoh (Agustus, September, Oktober 2026) selalu ada
    ['2026-08', '2026-09', '2026-10'].forEach(m => monthSet.add(m));
    if (selectedMonth !== 'all' && selectedMonth >= '2026-08') {
      monthSet.add(selectedMonth);
    }
    return Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  }, [invoices, selectedMonth]);

  const monthlySummary = availableChartMonths.map(m => {
    const mInvoices = invoices.filter(i => i.periode.startsWith(m) && i.status !== 'dibatalkan');
    const tagih = mInvoices.reduce((acc, curr) => acc + curr.nominal_sewa + curr.denda, 0);
    const terima = mInvoices.reduce((acc, curr) => acc + curr.terbayar, 0);
    const tunggakan = Math.max(0, tagih - terima);
    const [year, month] = m.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    const label = !isNaN(d.getTime())
      ? d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      : m;
    const shortLabel = !isNaN(d.getTime())
      ? d.toLocaleDateString('id-ID', { month: 'short' }) + ' ' + year.slice(2)
      : m;
    return {
      month: m,
      label,
      shortLabel,
      tagih,
      terima,
      tunggakan,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Laporan Pendapatan & Hunian
          </h1>
          <p className="text-sm text-muted-foreground">
            Analisis arus kas sewa dan rincian pendapatan per unit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Tombol Semua Bulan di sebelah kiri komponen date picker */}
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border border-primary transition-all whitespace-nowrap shadow-sm ${
              selectedMonth === 'all'
                ? 'bg-primary text-white'
                : 'bg-card text-primary hover:bg-primary/10'
            }`}
          >
            Semua Bulan
          </button>

          {/* Date Picker dengan filter month */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="month"
              min="2026-08"
              value={selectedMonth === 'all' ? '' : selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                } else {
                  setSelectedMonth('all');
                }
              }}
              className="text-xs font-semibold bg-transparent border-0 text-foreground focus:outline-none cursor-pointer"
              aria-label="Pilih Bulan Laporan"
            />
          </div>

          {/* Unduh CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-colors"
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
          <p className="text-xs text-muted-foreground">
            {selectedMonth === 'all' ? 'Seluruh periode aktif (mulai Ags 2026)' : `Periode ${selectedMonth}`}
          </p>
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

      {/* Visualisasi Grafik Batang Berkelompok & Tabel Perbandingan Bulanan */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Perbandingan Ditagihkan vs Diterima Per Bulan
          </h3>
          <span className="text-xs text-muted-foreground">Arus kas tercatat mulai Agustus 2026</span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySummary} barGap={6} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis
                tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}jt`}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                formatter={(value) => formatRupiah(Number(value))}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '8px' }}
              />
              <Bar dataKey="tagih" name="Ditagihkan" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Bar dataKey="terima" name="Diterima" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabel Perbandingan Arus Kas Bulanan */}
        <div className="overflow-x-auto rounded-xl border border-border mt-4">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Periode</th>
                <th className="py-2.5 px-4 text-right">Ditagihkan</th>
                <th className="py-2.5 px-4 text-right">Diterima (Kas Masuk)</th>
                <th className="py-2.5 px-4 text-right">Tunggakan</th>
                <th className="py-2.5 px-4 text-right">Rasio Koleksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthlySummary.map((m) => {
                const ratio = m.tagih > 0 ? ((m.terima / m.tagih) * 100).toFixed(1) : '0';
                return (
                  <tr key={m.month} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{m.label}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">{formatRupiah(m.tagih)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-primary">{formatRupiah(m.terima)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-rose-600">{formatRupiah(m.tunggakan)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          Number(ratio) >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : Number(ratio) >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ratio}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
