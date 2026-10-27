import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/api/data-service';

describe('Tenant Sorting - Konsistensi Urutan Abjad A-Z', () => {
  beforeEach(() => {
    dataStore.resetToDefaults();
  });

  it('mengembalikan daftar penyewa yang selalu terurut abjad A-Z berdasarkan nama_lengkap', () => {
    const tenants = dataStore.getTenants();
    expect(tenants.length).toBeGreaterThan(0);

    for (let i = 0; i < tenants.length - 1; i++) {
      const currentName = tenants[i].profile.nama_lengkap;
      const nextName = tenants[i + 1].profile.nama_lengkap;
      const comparison = currentName.localeCompare(nextName, 'id', { sensitivity: 'base' });
      expect(
        comparison,
        `Penyewa '${currentName}' harusnya berada sebelum atau sama dengan '${nextName}'`
      ).toBeLessThanOrEqual(0);
    }
  });

  it('mengembalikan profiles yang selalu terurut abjad A-Z berdasarkan nama_lengkap', () => {
    const profiles = dataStore.getProfiles();
    expect(profiles.length).toBeGreaterThan(0);

    for (let i = 0; i < profiles.length - 1; i++) {
      const currentName = profiles[i].nama_lengkap;
      const nextName = profiles[i + 1].nama_lengkap;
      const comparison = currentName.localeCompare(nextName, 'id', { sensitivity: 'base' });
      expect(
        comparison,
        `Profil '${currentName}' harusnya berada sebelum atau sama dengan '${nextName}'`
      ).toBeLessThanOrEqual(0);
    }
  });
});
