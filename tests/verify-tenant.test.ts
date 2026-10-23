import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/api/data-service';
import { MOCK_IDENTITAS, MOCK_PROFILES } from '../src/data/mock-data';
import { Profile } from '../src/types/database';

const pengelola = MOCK_PROFILES.find(p => p.peran === 'pengelola') as unknown as Profile;
const penyewaDenganIdentitas = MOCK_IDENTITAS[0].penyewa_id;

describe('Verifikasi Identitas Penyewa - Validasi Alasan Penolakan', () => {
  beforeEach(() => {
    // Reset state in-memory agar tiap test terisolasi
    dataStore.resetToDefaults();
  });

  it('menolak penolakan identitas tanpa alasan (string kosong)', async () => {
    await expect(
      dataStore.verifyTenantIdentity(penyewaDenganIdentitas, 'ditolak', '', pengelola)
    ).rejects.toThrow('Alasan penolakan wajib diisi.');
  });

  it('menolak penolakan identitas dengan alasan hanya spasi (whitespace)', async () => {
    await expect(
      dataStore.verifyTenantIdentity(penyewaDenganIdentitas, 'ditolak', '   ', pengelola)
    ).rejects.toThrow('Alasan penolakan wajib diisi.');
  });

  it('tetap menolak dan tidak mengubah status saat validasi gagal', async () => {
    const tenantsBefore = dataStore
      .getTenants()
      .find(t => t.profile.id === penyewaDenganIdentitas);

    try {
      await dataStore.verifyTenantIdentity(penyewaDenganIdentitas, 'ditolak', '', pengelola);
    } catch {
      // diharapkan gagal
    }

    const tenantsAfter = dataStore
      .getTenants()
      .find(t => t.profile.id === penyewaDenganIdentitas);

    expect(tenantsAfter?.identitas?.status_verifikasi).toBe(
      tenantsBefore?.identitas?.status_verifikasi
    );
  });

  it('mengizinkan penolakan identitas dengan alasan yang diisi (spasi di awal/akhir di-trim)', async () => {
    await expect(
      dataStore.verifyTenantIdentity(
        penyewaDenganIdentitas,
        'ditolak',
        '  Foto KTP tidak jelas.  ',
        pengelola
      )
    ).resolves.toBeUndefined();

    const tenant = dataStore.getTenants().find(t => t.profile.id === penyewaDenganIdentitas);
    expect(tenant?.identitas?.status_verifikasi).toBe('ditolak');
    expect(tenant?.identitas?.catatan_verifikasi).toBe('Foto KTP tidak jelas.');
  });

  it('mengizinkan persetujuan verifikasi tanpa catatan', async () => {
    await expect(
      dataStore.verifyTenantIdentity(penyewaDenganIdentitas, 'terverifikasi', '', pengelola)
    ).resolves.toBeUndefined();

    const tenant = dataStore.getTenants().find(t => t.profile.id === penyewaDenganIdentitas);
    expect(tenant?.identitas?.status_verifikasi).toBe('terverifikasi');
  });
});
