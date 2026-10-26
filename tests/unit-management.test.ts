import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/api/data-service';
import { MOCK_PROFILES, MOCK_UNITS } from '../src/data/mock-data';
import { Profile } from '../src/types/database';

const pemilik = MOCK_PROFILES.find(p => p.peran === 'pemilik') as unknown as Profile;
const pengelola = MOCK_PROFILES.find(p => p.peran === 'pengelola') as unknown as Profile;
const testUnit = MOCK_UNITS[0]; // Unit A-101

describe('Unit Management (Update Harga & Status Unit)', () => {
  beforeEach(() => {
    dataStore.resetToDefaults();
  });

  describe('updateUnitPrice', () => {
    it('mengizinkan Pemilik mengubah harga sewa unit', async () => {
      const newPrice = 1750000;
      await expect(
        dataStore.updateUnitPrice(testUnit.id, newPrice, pemilik)
      ).resolves.toBeUndefined();

      const updated = dataStore.getUnits().find(u => u.id === testUnit.id);
      expect(updated?.harga_sewa_bulanan).toBe(newPrice);
    });

    it('menolak selain Pemilik (misal Pengelola) saat mencoba mengubah harga sewa', async () => {
      await expect(
        dataStore.updateUnitPrice(testUnit.id, 2000000, pengelola)
      ).rejects.toThrow('Hanya Pemilik yang berhak mengubah harga sewa unit.');
    });

    it('menolak harga sewa yang kurang dari atau sama dengan 0', async () => {
      await expect(
        dataStore.updateUnitPrice(testUnit.id, 0, pemilik)
      ).rejects.toThrow('Harga sewa unit harus berupa angka lebih besar dari 0.');

      await expect(
        dataStore.updateUnitPrice(testUnit.id, -500000, pemilik)
      ).rejects.toThrow('Harga sewa unit harus berupa angka lebih besar dari 0.');
    });

    it('mencatat audit log setelah harga sewa berhasil diubah', async () => {
      await dataStore.updateUnitPrice(testUnit.id, 1800000, pemilik);
      const logs = dataStore.getAuditLogs();
      const unitLog = logs.find(l => l.tabel === 'unit' && l.data_id === testUnit.id && l.aksi === 'harga:unit');
      expect(unitLog).toBeDefined();
      expect(unitLog?.pelaku_id).toBe(pemilik.id);
      expect(unitLog?.sesudah?.harga).toBe(1800000);
    });
  });

  describe('updateUnitStatus', () => {
    it('mengizinkan pengelola mengubah status unit ke perbaikan', async () => {
      // Cari unit yang tersedia (tidak ada kontrak aktif/draf)
      const availableUnit = dataStore.getUnits().find(u => u.status === 'tersedia')!;
      await expect(
        dataStore.updateUnitStatus(availableUnit.id, 'perbaikan', pengelola)
      ).resolves.toBeUndefined();

      const updated = dataStore.getUnits().find(u => u.id === availableUnit.id);
      expect(updated?.status).toBe('perbaikan');
    });

    it('menolak penonaktifan unit yang masih memiliki kontrak aktif atau draf (BR-04)', async () => {
      // Cari kontrak aktif dan unit terkait
      const activeContract = dataStore.getContracts().find(k => k.status === 'aktif')!;
      await expect(
        dataStore.updateUnitStatus(activeContract.unit_id, 'nonaktif', pengelola)
      ).rejects.toThrow('Unit masih memiliki kontrak draf atau aktif sehingga tidak boleh dinonaktifkan.');
    });

    it('mencatat audit log setelah status unit berhasil diubah', async () => {
      const availableUnit = dataStore.getUnits().find(u => u.status === 'tersedia')!;
      await dataStore.updateUnitStatus(availableUnit.id, 'perbaikan', pengelola);
      const logs = dataStore.getAuditLogs();
      const unitLog = logs.find(l => l.tabel === 'unit' && l.data_id === availableUnit.id && l.aksi === 'status:unit');
      expect(unitLog).toBeDefined();
      expect(unitLog?.pelaku_id).toBe(pengelola.id);
      expect(unitLog?.sesudah?.status).toBe('perbaikan');
    });
  });
});
