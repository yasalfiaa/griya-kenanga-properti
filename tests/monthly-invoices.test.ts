import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/api/data-service';
import { Profile } from '../src/types/database';

describe('Fitur Buat Tagihan Bulanan (BR-06 & Multi-Periode)', () => {
  const pengelola: Profile = {
    id: '04e98049-133d-5664-9e2c-579ddd2d1d01',
    nama_lengkap: 'Bayu Prasetyo',
    email: 'bayu@griyakenanga.test',
    peran: 'pengelola',
    aktif: true,
    dibuat_pada: '2026-07-27',
  };

  const pemilik: Profile = {
    id: 'd2fe618c-8788-577e-b188-9c67073bf8d0',
    nama_lengkap: 'Ratna Kusumawardani',
    email: 'ratna@griyakenanga.test',
    peran: 'pemilik',
    aktif: true,
    dibuat_pada: '2026-07-27',
  };

  const penyewa: Profile = {
    id: '4dfac964-253c-5ff5-829a-503cabaffead',
    nama_lengkap: 'Aditya Pratama',
    email: 'aditya@griyakenanga.test',
    peran: 'penyewa',
    aktif: true,
    dibuat_pada: '2026-07-27',
  };

  beforeEach(() => {
    dataStore.resetToDefaults();
  });

  it('dapat membuat tagihan bulanan untuk periode baru berikutnya (November 2026)', async () => {
    const result = await dataStore.generateMonthlyInvoices('2026-11', pengelola);
    expect(result.dibuat).toBeGreaterThan(0);
    expect(result.dilewati).toBe(0);

    const invoices = dataStore.getInvoices().filter(i => i.periode.startsWith('2026-11'));
    expect(invoices.length).toBe(result.dibuat);

    // Pastikan nomor tagihan berformat INV-YYYYMM-XXXX
    invoices.forEach(inv => {
      expect(inv.nomor).toMatch(/^INV-202611-\d{4}$/);
      expect(inv.jatuh_tempo).toBe('2026-11-10');
      expect(inv.status).toBe('belum_bayar');
      expect(inv.denda).toBe(0);
      expect(inv.terbayar).toBe(0);
    });
  });

  it('dapat membuat tagihan bulanan untuk periode Desember 2026', async () => {
    const result = await dataStore.generateMonthlyInvoices('2026-12', pemilik);
    expect(result.dibuat).toBeGreaterThan(0);

    const invoices = dataStore.getInvoices().filter(i => i.periode.startsWith('2026-12'));
    expect(invoices.length).toBe(result.dibuat);
    invoices.forEach(inv => {
      expect(inv.nomor).toMatch(/^INV-202612-\d{4}$/);
      expect(inv.jatuh_tempo).toBe('2026-12-10');
    });
  });

  it('idempoten: tidak membuat tagihan ganda bila diulang untuk periode yang sama (BR-06)', async () => {
    // Jalankan pertama kali
    const firstRun = await dataStore.generateMonthlyInvoices('2026-11', pengelola);
    expect(firstRun.dibuat).toBeGreaterThan(0);

    // Jalankan kedua kali untuk periode yang sama
    const secondRun = await dataStore.generateMonthlyInvoices('2026-11', pengelola);
    expect(secondRun.dibuat).toBe(0);
    expect(secondRun.dilewati).toBe(firstRun.dibuat);

    // Total tagihan periode November tidak bertambah
    const invoices = dataStore.getInvoices().filter(i => i.periode.startsWith('2026-11'));
    expect(invoices.length).toBe(firstRun.dibuat);
  });

  it('hanya mencakup kontrak yang masa berlakunya masih aktif pada periode tersebut', async () => {
    // Kontrak KTR-2026-0003 berakhir 2026-10-31
    const resultNov = await dataStore.generateMonthlyInvoices('2026-11', pengelola);
    const invoicesNov = dataStore.getInvoices().filter(i => i.periode.startsWith('2026-11'));

    const kontrakExpired = dataStore.getContracts().find(k => k.nomor === 'KTR-2026-0003');
    if (kontrakExpired) {
      const inv = invoicesNov.find(i => i.kontrak_id === kontrakExpired.id);
      expect(inv).toBeUndefined();
    }
  });

  it('menolak pembuatan tagihan jika bukan Pengelola atau Pemilik', async () => {
    await expect(dataStore.generateMonthlyInvoices('2026-11', penyewa)).rejects.toThrow(
      'Hanya Pengelola atau Pemilik yang berhak membuat tagihan bulanan.'
    );
  });

  it('menolak format periode yang tidak sesuai (bukan YYYY-MM)', async () => {
    await expect(dataStore.generateMonthlyInvoices('invalid-date', pengelola)).rejects.toThrow(
      'Format periode tidak valid'
    );
  });
});
