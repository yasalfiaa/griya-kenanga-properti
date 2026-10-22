/**
 * Aturan Bisnis Griya Kenanga Residence (BR-01 s/d BR-12)
 * Implementasi fungsi murni untuk validasi dan kalkulasi.
 */

/**
 * BR-07: Perhitungan Denda Keterlambatan
 * - Pembayaran setelah jatuh tempo (tgl 10) dikenai Rp20.000 per hari keterlambatan.
 * - Pembayaran pada tgl 10 atau sebelumnya TIDAK dikenai denda (0).
 * - Maksimal denda adalah Rp200.000 per tagihan.
 * 
 * @param jatuhTempo Tanggal jatuh tempo (format YYYY-MM-DD atau Date)
 * @param tanggalBayar Tanggal pembayaran dicatat / tanggal acuan (format YYYY-MM-DD atau Date)
 * @returns Nominal denda (0 s/d 200.000)
 */
export function calculateDenda(jatuhTempo: string | Date, tanggalBayar: string | Date): number {
  const dJatuhTempo = typeof jatuhTempo === 'string' ? new Date(jatuhTempo + 'T00:00:00') : new Date(jatuhTempo);
  const dBayar = typeof tanggalBayar === 'string' ? new Date(tanggalBayar + 'T00:00:00') : new Date(tanggalBayar);

  // Normalisasi waktu ke jam 00:00:00
  dJatuhTempo.setHours(0, 0, 0, 0);
  dBayar.setHours(0, 0, 0, 0);

  const diffTime = dBayar.getTime() - dJatuhTempo.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 0; // Tgl 10 atau sebelumnya bebas denda
  }

  const dendaPerHari = 20000;
  const maxDenda = 200000;
  const totalDenda = diffDays * dendaPerHari;

  return Math.min(totalDenda, maxDenda);
}

/**
 * BR-10: Masking NIK untuk Peran Pemilik
 * - Pemilik hanya melihat 4 angka terakhir NIK (contoh: ************1234).
 */
export function maskNIK(nik: string): string {
  if (!nik || nik.length < 4) return '****************';
  const cleanNik = nik.trim();
  const last4 = cleanNik.slice(-4);
  return '*'.repeat(Math.max(0, cleanNik.length - 4)) + last4;
}

/**
 * BR-02: Perhitungan Tanggal Selesai Kontrak
 * - Kontrak selalu dimulai tanggal 1.
 * - Tanggal selesai dihitung otomatis ke hari terakhir bulan ke-n.
 * 
 * @param tanggalMulai Format YYYY-MM-01
 * @param durasiBulan 1 | 3 | 6 | 12
 */
export function calculateContractEndDate(tanggalMulai: string, durasiBulan: 1 | 3 | 6 | 12): string {
  const [yearStr, monthStr] = tanggalMulai.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Bulan setelah ditambah durasi: new Date(year, monthIndex + durasi, 0) menghasilkan hari terakhir bulan sebelumnya
  const targetDate = new Date(year, (month - 1) + durasiBulan, 0);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * BR-01: Validasi Kontrak Beririsan
 * - Satu unit tidak boleh memiliki dua kontrak draf atau aktif yang periodenya beririsan.
 * - Kontrak yang berakhir 31 Oktober dan baru mulai 1 November TIDAK dianggap beririsan.
 * 
 * @returns true jika beririsan (overlap), false jika aman
 */
export function isContractOverlapping(
  existingContracts: Array<{ tanggal_mulai: string; tanggal_selesai: string; status: string }>,
  newMulai: string,
  newSelesai: string
): boolean {
  const startNew = new Date(newMulai + 'T00:00:00').getTime();
  const endNew = new Date(newSelesai + 'T00:00:00').getTime();

  for (const c of existingContracts) {
    if (c.status !== 'draf' && c.status !== 'aktif') {
      continue; // Selesai, diakhiri, atau dibatalkan tidak memblokir
    }

    const startExist = new Date(c.tanggal_mulai + 'T00:00:00').getTime();
    const endExist = new Date(c.tanggal_selesai + 'T00:00:00').getTime();

    // Beririsan jika: startNew <= endExist AND endNew >= startExist
    if (startNew <= endExist && endNew >= startExist) {
      return true; // Overlap terdeteksi
    }
  }

  return false;
}

/**
 * BR-08: Validasi Nilai Pembayaran
 * - Minimal Rp100.000 per cicilan kecuali cicilan terakhir yang melunasi sisa.
 * - Jumlah tidak boleh melebihi sisa tagihan.
 */
export function validatePaymentAmount(
  jumlahBayar: number,
  sisaTagihan: number
): { valid: boolean; error?: string } {
  if (jumlahBayar <= 0) {
    return { valid: false, error: 'Jumlah pembayaran harus lebih besar dari 0' };
  }

  if (jumlahBayar > sisaTagihan) {
    return { 
      valid: false, 
      error: `Jumlah pembayaran (Rp${jumlahBayar.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp${sisaTagihan.toLocaleString('id-ID')})` 
    };
  }

  // Jika sisa tagihan >= 100.000 tapi cicilan < 100.000 -> Tolak
  if (sisaTagihan >= 100000 && jumlahBayar < 100000) {
    return { 
      valid: false, 
      error: 'Pembayaran cicilan minimal Rp100.000 per transaksi' 
    };
  }

  // Jika sisa tagihan < 100.000, jumlah bayar harus melunasi sisa tagihan tersebut
  if (sisaTagihan < 100000 && jumlahBayar !== sisaTagihan) {
    return { 
      valid: false, 
      error: `Karena sisa tagihan di bawah Rp100.000, pembayaran harus tepat melunasi sisa tagihan (Rp${sisaTagihan.toLocaleString('id-ID')})` 
    };
  }

  return { valid: true };
}

/**
 * BR-11: Validasi Batas Laporan Kerusakan Terbuka
 * - Satu penyewa paling banyak memiliki 3 laporan terbuka (dilaporkan, diproses, menunggu persetujuan).
 */
export function canCreateDamageReport(openReportsCount: number): boolean {
  return openReportsCount < 3;
}

/**
 * BR-12: Validasi Persetujuan Pemilik untuk Biaya Perbaikan
 * - Estimasi atau biaya aktual di atas Rp1.000.000 wajib disetujui Pemilik.
 * - Tepat Rp1.000.000 TIDAK perlu persetujuan.
 */
export function requiresOwnerApproval(biaya: number): boolean {
  return biaya > 1000000;
}

/**
 * Format Angka ke Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
