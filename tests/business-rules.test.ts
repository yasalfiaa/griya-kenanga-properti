import { describe, it, expect } from 'vitest';
import {
  calculateDenda,
  maskNIK,
  calculateContractEndDate,
  isContractOverlapping,
  validatePaymentAmount,
  canCreateDamageReport,
  requiresOwnerApproval,
} from '../src/utils/business-rules';

describe('Aturan Bisnis Griya Kenanga Residence (BR-01 s/d BR-12)', () => {
  // BR-01: Satu unit tidak boleh memiliki dua kontrak berstatus draf atau aktif yang periodenya beririsan.
  // Kontrak yang berakhir 31 Oktober dan kontrak baru yang mulai 1 November tidak dianggap beririsan.
  describe('BR-01: Validasi Kontrak Beririsan', () => {
    const existingContracts = [
      {
        tanggal_mulai: '2026-08-01',
        tanggal_selesai: '2026-10-31',
        status: 'aktif',
      },
    ];

    it('menolak kontrak baru yang beririsan dengan periode aktif (misal 2026-10-01 s/d 2026-12-31)', () => {
      const overlap = isContractOverlapping(existingContracts, '2026-10-01', '2026-12-31');
      expect(overlap).toBe(true);
    });

    it('mengizinkan kontrak baru yang mulai tepat setelah kontrak lama selesai (1 November)', () => {
      const overlap = isContractOverlapping(existingContracts, '2026-11-01', '2027-01-31');
      expect(overlap).toBe(false);
    });

    it('mengabaikan kontrak yang berstatus dibatalkan atau selesai', () => {
      const inactiveContracts = [
        {
          tanggal_mulai: '2026-08-01',
          tanggal_selesai: '2026-10-31',
          status: 'dibatalkan',
        },
      ];
      const overlap = isContractOverlapping(inactiveContracts, '2026-09-01', '2026-11-30');
      expect(overlap).toBe(false);
    });
  });

  // BR-02: Kontrak selalu dimulai tanggal 1 dan berdurasi 1, 3, 6, atau 12 bulan.
  // Tanggal selesai dihitung otomatis (hari terakhir bulan ke-n).
  describe('BR-02: Perhitungan Tanggal Selesai Kontrak', () => {
    it('menghitung tanggal selesai durasi 1 bulan', () => {
      expect(calculateContractEndDate('2026-10-01', 1)).toBe('2026-10-31');
    });

    it('menghitung tanggal selesai durasi 3 bulan', () => {
      expect(calculateContractEndDate('2026-10-01', 3)).toBe('2026-12-31');
    });

    it('menghitung tanggal selesai durasi 6 bulan', () => {
      expect(calculateContractEndDate('2026-10-01', 6)).toBe('2027-03-31');
    });

    it('menghitung tanggal selesai durasi 12 bulan', () => {
      expect(calculateContractEndDate('2026-10-01', 12)).toBe('2027-09-30');
    });

    it('menghitung hari terakhir bulan Februari (bukan kabisat)', () => {
      expect(calculateContractEndDate('2027-02-01', 1)).toBe('2027-02-28');
    });
  });

  // BR-07: Pembayaran yang dicatat setelah jatuh tempo dikenai denda Rp20.000 per hari keterlambatan,
  // paling banyak Rp200.000 per tagihan. Pembayaran pada tanggal 10 belum dikenai denda.
  describe('BR-07: Perhitungan Denda Keterlambatan', () => {
    const jatuhTempo = '2026-10-10';

    it('pembayaran tepat pada tanggal 10 belum dikenai denda (Rp0)', () => {
      expect(calculateDenda(jatuhTempo, '2026-10-10')).toBe(0);
    });

    it('pembayaran sebelum tanggal 10 belum dikenai denda (Rp0)', () => {
      expect(calculateDenda(jatuhTempo, '2026-10-05')).toBe(0);
    });

    it('pembayaran terlambat 1 hari (11 Oktober) dikenai denda Rp20.000', () => {
      expect(calculateDenda(jatuhTempo, '2026-10-11')).toBe(20000);
    });

    it('kasus uji PRD Dimas: Pembayaran tagihan Oktober Dimas pada 15 Oktober dikenai denda Rp100.000 (5 hari x 20.000)', () => {
      expect(calculateDenda(jatuhTempo, '2026-10-15')).toBe(100000);
    });

    it('kasus uji PRD Hana: Tagihan September Hana (lewat lebih dari 10 hari) berhenti di batas Rp200.000', () => {
      const jatuhTempoSep = '2026-09-10';
      // 15 Oktober = 35 hari telat -> 35 * 20.000 = 700.000 -> dibatasi ke 200.000
      expect(calculateDenda(jatuhTempoSep, '2026-10-15')).toBe(200000);
    });
  });

  // BR-08: Pembayaran boleh dicicil, minimal Rp100.000 per cicilan kecuali cicilan terakhir yang melunasi sisa.
  // Jumlah tidak boleh melebihi sisa tagihan.
  describe('BR-08: Validasi Nilai Pembayaran & Cicilan', () => {
    const sisaTagihan = 1500000;

    it('menolak pembayaran 0 atau negatif', () => {
      const res = validatePaymentAmount(0, sisaTagihan);
      expect(res.valid).toBe(false);
    });

    it('menolak pembayaran melebihi sisa tagihan', () => {
      const res = validatePaymentAmount(1600000, sisaTagihan);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('melebihi sisa tagihan');
    });

    it('menolak cicilan di bawah Rp100.000 jika sisa tagihan masih besar', () => {
      const res = validatePaymentAmount(50000, sisaTagihan);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('minimal Rp100.000');
    });

    it('menerima cicilan valid (misal Rp500.000)', () => {
      const res = validatePaymentAmount(500000, sisaTagihan);
      expect(res.valid).toBe(true);
    });

    it('menerima pembayaran di bawah Rp100.000 jika memang sisa tagihan tersisa segitu untuk melunasi', () => {
      const sisaKecil = 75000;
      const res = validatePaymentAmount(75000, sisaKecil);
      expect(res.valid).toBe(true);
    });
  });

  // BR-10: NIK hanya bisa dilihat penyewa ybs dan Pengelola. Pemilik hanya melihat 4 angka terakhir NIK.
  describe('BR-10: Penyamaran NIK untuk Pemilik', () => {
    it('menyamarkan NIK 16 digit dan hanya menampilkan 4 angka terakhir', () => {
      const nik = '3404012345670001';
      expect(maskNIK(nik)).toBe('************0001');
    });
  });

  // BR-11: Satu penyewa paling banyak memiliki 3 laporan terbuka (dilaporkan, diproses, atau menunggu persetujuan).
  describe('BR-11: Pembatasan Laporan Kerusakan Terbuka', () => {
    it('mengizinkan pembuatan laporan jika laporan terbuka < 3', () => {
      expect(canCreateDamageReport(0)).toBe(true);
      expect(canCreateDamageReport(2)).toBe(true);
    });

    it('kasus uji PRD Dimas: Laporan kerusakan ke-4 Dimas ditolak karena sudah ada 3 laporan terbuka', () => {
      expect(canCreateDamageReport(3)).toBe(false);
      expect(canCreateDamageReport(4)).toBe(false);
    });
  });

  // BR-12: Estimasi atau biaya aktual di atas Rp1.000.000 wajib disetujui Pemilik sebelum dikerjakan;
  // estimasi tepat Rp1.000.000 tidak perlu persetujuan.
  describe('BR-12: Ambang Batas Persetujuan Pemilik untuk Biaya Perbaikan', () => {
    it('biaya di bawah Rp1.000.000 tidak perlu persetujuan Pemilik', () => {
      expect(requiresOwnerApproval(500000)).toBe(false);
    });

    it('biaya tepat Rp1.000.000 tidak perlu persetujuan Pemilik', () => {
      expect(requiresOwnerApproval(1000000)).toBe(false);
    });

    it('biaya di atas Rp1.000.000 (misal Rp1.000.001 atau Rp1.500.000) wajib disetujui Pemilik', () => {
      expect(requiresOwnerApproval(1000001)).toBe(true);
      expect(requiresOwnerApproval(1500000)).toBe(true);
    });
  });
});
