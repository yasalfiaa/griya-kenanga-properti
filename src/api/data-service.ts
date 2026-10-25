import {
  Unit,
  UnitStatus,
  Kontrak,
  Tagihan,
  Pembayaran,
  LaporanKerusakan,
  Profile,
  IdentitasPenyewa,
  VerifikasiStatus,
  AuditLog,
} from '../types/database';
import {
  MOCK_UNITS,
  MOCK_KONTRAK,
  MOCK_TAGIHAN,
  MOCK_PEMBAYARAN,
  MOCK_KERUSAKAN,
  MOCK_PROFILES,
  MOCK_IDENTITAS,
  MOCK_AUDIT_LOG,
} from '../data/mock-data';
import {
  calculateDenda,
  isContractOverlapping,
  validatePaymentAmount,
  canCreateDamageReport,
  calculateContractEndDate,
} from '../utils/business-rules';
import { supabase, isSupabaseConfigured } from './supabase';

// State penyimpanan data dengan sinkronisasi Supabase
class DataStore {
  private units: Unit[] = [];
  private kontrak: Kontrak[] = [];
  private tagihan: Tagihan[] = [];
  private pembayaran: Pembayaran[] = [];
  private kerusakan: LaporanKerusakan[] = [];
  private profiles: Profile[] = [];
  private identitas: IdentitasPenyewa[] = [];
  private auditLogs: AuditLog[] = [];
  private isLoadedFromSupabase = false;

  constructor() {
    this.resetToDefaults();
    if (typeof window !== 'undefined' && isSupabaseConfigured) {
      this.loadFromSupabase();
    }
  }

  public async loadFromSupabase(): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const [u, k, t, p, lk, prof, id, al] = await Promise.all([
        supabase.from('unit').select('*').order('kode'),
        supabase.from('kontrak').select('*').order('tanggal_mulai', { ascending: false }),
        supabase.from('tagihan').select('*').order('periode', { ascending: false }),
        supabase.from('pembayaran').select('*').order('tanggal_bayar', { ascending: false }),
        supabase.from('laporan_kerusakan').select('*').order('dibuat_pada', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('identitas_penyewa').select('*'),
        supabase.from('audit_log').select('*').order('dibuat_pada', { ascending: false }),
      ]);

      if (u.data && u.data.length > 0) this.units = u.data as Unit[];
      if (k.data && k.data.length > 0) this.kontrak = k.data as Kontrak[];
      if (t.data && t.data.length > 0) this.tagihan = t.data as Tagihan[];
      if (p.data && p.data.length > 0) this.pembayaran = p.data as Pembayaran[];
      if (lk.data && lk.data.length > 0) this.kerusakan = lk.data as LaporanKerusakan[];
      if (prof.data && prof.data.length > 0) this.profiles = prof.data as Profile[];
      if (id.data && id.data.length > 0) this.identitas = id.data as IdentitasPenyewa[];
      if (al.data && al.data.length > 0) this.auditLogs = al.data as AuditLog[];
      this.isLoadedFromSupabase = true;
      console.log('✅ Berhasil menyinkronkan data langsung dari Supabase!');
    } catch (e) {
      console.warn('Gagal sinkronisasi data Supabase, menggunakan data cache default:', e);
    }
  }

  public resetToDefaults() {
    this.units = JSON.parse(JSON.stringify(MOCK_UNITS));
    this.kontrak = JSON.parse(JSON.stringify(MOCK_KONTRAK));
    this.tagihan = JSON.parse(JSON.stringify(MOCK_TAGIHAN));
    this.pembayaran = JSON.parse(JSON.stringify(MOCK_PEMBAYARAN));
    this.kerusakan = JSON.parse(JSON.stringify(MOCK_KERUSAKAN));
    this.profiles = JSON.parse(JSON.stringify(MOCK_PROFILES));
    this.identitas = JSON.parse(JSON.stringify(MOCK_IDENTITAS));
    this.auditLogs = JSON.parse(JSON.stringify(MOCK_AUDIT_LOG));
  }

  // --- UNIT ---
  public getUnits(): Unit[] {
    return [...this.units];
  }

  public updateUnitStatus(id: string, newStatus: UnitStatus, actor: Profile): void {
    const unit = this.units.find(u => u.id === id);
    if (!unit) throw new Error('Unit tidak ditemukan');

    // BR-04: Unit yang masih punya kontrak draf atau aktif tidak boleh dinonaktifkan
    if (newStatus === 'nonaktif') {
      const hasActiveContract = this.kontrak.some(
        k => k.unit_id === id && (k.status === 'draf' || k.status === 'aktif')
      );
      if (hasActiveContract) {
        throw new Error('Unit masih memiliki kontrak draf atau aktif sehingga tidak boleh dinonaktifkan.');
      }
    }

    const oldStatus = unit.status;
    unit.status = newStatus;

    this.logAudit(actor, 'status:unit', 'unit', id, { status: oldStatus }, { status: newStatus });
  }

  public updateUnitPrice(id: string, newPrice: number, actor: Profile): void {
    if (actor.peran !== 'pemilik') {
      throw new Error('Hanya Pemilik yang berhak mengubah harga sewa unit.');
    }
    const unit = this.units.find(u => u.id === id);
    if (!unit) throw new Error('Unit tidak ditemukan');

    const oldPrice = unit.harga_sewa_bulanan;
    unit.harga_sewa_bulanan = newPrice;

    this.logAudit(actor, 'harga:unit', 'unit', id, { harga: oldPrice }, { harga: newPrice });
  }

  // --- PENYEWA & IDENTITAS ---
  public getTenants(): { profile: Profile; identitas?: IdentitasPenyewa }[] {
    return this.profiles
      .filter(p => p.peran === 'penyewa')
      .map(p => ({
        profile: p,
        identitas: this.identitas.find(i => i.penyewa_id === p.id),
      }));
  }

  public async verifyTenantIdentity(penyewaId: string, status: 'terverifikasi' | 'ditolak', notes: string, actor: Profile): Promise<void> {
    if (actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak memverifikasi identitas penyewa');
    }
    let ident = this.identitas.find(i => i.penyewa_id === penyewaId);
    if (!ident) {
      throw new Error('Data identitas penyewa belum diisi');
    }

    // Validasi: Penolakan identitas wajib disertai alasan (tidak boleh kosong)
    const trimmedNotes = notes.trim();
    if (status === 'ditolak' && trimmedNotes.length === 0) {
      throw new Error('Alasan penolakan wajib diisi.');
    }

    const oldStatus = ident.status_verifikasi;
    ident.status_verifikasi = status;
    ident.diverifikasi_oleh = actor.id;
    ident.diverifikasi_pada = new Date().toISOString();
    ident.catatan_verifikasi = trimmedNotes;

    // Sinkronisasi ke Supabase (didegradasi ke lokal bila gagal)
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('identitas_penyewa')
        .update({
          status_verifikasi: status,
          diverifikasi_oleh: actor.id,
          diverifikasi_pada: ident.diverifikasi_pada,
          catatan_verifikasi: trimmedNotes,
        })
        .eq('penyewa_id', penyewaId);
      if (error) {
        console.warn('Verifikasi tersimpan lokal, namun gagal sinkron ke Supabase:', error.message);
      }
    }

    this.logAudit(actor, `verifikasi_identitas:${status}`, 'identitas_penyewa', penyewaId, { status: oldStatus }, { status, notes });
  }

  // --- KONTRAK ---
  public getContracts(): Kontrak[] {
    return this.kontrak.map(k => ({
      ...k,
      unit: this.units.find(u => u.id === k.unit_id),
      penyewa: this.profiles.find(p => p.id === k.penyewa_id),
    }));
  }

  /**
   * Buat kontrak draf baru.
   * Mode Supabase : lewat fn_create_contract (#08) — satu transaksi aman,
   *                 unit dikunci FOR UPDATE, nomor dari generate_nomor_urut.
   * Gagal DB      = throw (pesan tampil di modal, tidak tersimpan).
   * Mode demo     : logika lokal lama dipertahankan.
   */
  public async createContract(data: {
    unit_id: string;
    penyewa_id: string;
    tanggal_mulai: string;
    durasi_bulan: 1 | 3 | 6 | 12;
    actor: Profile;
  }): Promise<Kontrak> {
    const unit = this.units.find(u => u.id === data.unit_id);
    if (!unit) throw new Error('Unit tidak ditemukan');

    // Kontrak baru hanya bisa dibuat untuk unit berstatus "tersedia"
    if (unit.status !== 'tersedia') {
      throw new Error(`Unit berstatus ${unit.status}, hanya unit berstatus 'tersedia' yang dapat dikontrakkan.`);
    }

    if (isSupabaseConfigured) {
      // ---- Alur database transaksional (BR-01, BR-02, BR-04) ----
      const { data: res, error } = await supabase.rpc('fn_create_contract', {
        p_unit_id: data.unit_id,
        p_penyewa_id: data.penyewa_id,
        p_tanggal_mulai: data.tanggal_mulai,
        p_durasi_bulan: data.durasi_bulan,
      });
      if (error) {
        throw new Error(error.message);
      }
      const row = Array.isArray(res) ? res[0] : res;
      if (!row?.out_id || !row?.out_nomor) {
        throw new Error('Respons database tidak sesuai saat membuat kontrak.');
      }

      const tanggal_selesai = calculateContractEndDate(data.tanggal_mulai, data.durasi_bulan);
      const newContract: Kontrak = {
        id: row.out_id,
        nomor: row.out_nomor,
        unit_id: data.unit_id,
        penyewa_id: data.penyewa_id,
        tanggal_mulai: data.tanggal_mulai,
        durasi_bulan: data.durasi_bulan,
        tanggal_selesai,
        harga_sewa_bulanan: unit.harga_sewa_bulanan,
        status: 'draf',
        dibuat_oleh: data.actor.id,
        dibuat_pada: new Date().toISOString(),
      };

      // Setelah tersimpan di DB, muat ulang cache agar sinkron penuh (unit/join)
      await this.loadFromSupabase();
      const created = this.kontrak.find(k => k.id === row.out_id);
      return created || newContract;
    }

    // ---- Fallback mode demo (tanpa Supabase tetap jalan) ----
    // Tanggal selesai dihitung otomatis
    const tanggal_selesai = calculateContractEndDate(data.tanggal_mulai, data.durasi_bulan);

    // Validasi Kontrak Beririsan
    const existingUnitContracts = this.kontrak.filter(k => k.unit_id === data.unit_id);
    if (isContractOverlapping(existingUnitContracts, data.tanggal_mulai, tanggal_selesai)) {
      throw new Error('Unit sudah memiliki kontrak berstatus draf atau aktif pada periode tersebut. Periode sewa tidak boleh beririsan.');
    }

    // Nomor urut baru
    const seq = this.kontrak.length + 1;
    const nomor = `KTR-2026-${String(seq).padStart(4, '0')}`;

    const newContract: Kontrak = {
      id: crypto.randomUUID(),
      nomor,
      unit_id: data.unit_id,
      penyewa_id: data.penyewa_id,
      tanggal_mulai: data.tanggal_mulai,
      durasi_bulan: data.durasi_bulan,
      tanggal_selesai,
      harga_sewa_bulanan: unit.harga_sewa_bulanan, // BR-04: Harga dikunci saat kontrak dibuat
      status: 'draf',
      dibuat_oleh: data.actor.id,
      dibuat_pada: new Date().toISOString(),
    };

    this.kontrak.push(newContract);
    this.logAudit(data.actor, 'buat:kontrak', 'kontrak', newContract.id, null, newContract);
    return newContract;
  }

  /**
   * Aktivasi kontrak draf (mode Supabase: fn_activate_contract — atomik:
   * kontrak aktif + unit dikontrak + penyewa aktif). Gagal dilempar agar
   * pesan error tampil di UI.
   */
  public async activateContract(kontrakId: string, actor: Profile): Promise<void> {
    if (actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak mengaktifkan kontrak');
    }

    const k = this.kontrak.find(item => item.id === kontrakId);
    if (!k) throw new Error('Kontrak tidak ditemukan');

    // Identitas penyewa harus sudah diverifikasi
    const ident = this.identitas.find(i => i.penyewa_id === k.penyewa_id);
    if (!ident || ident.status_verifikasi !== 'terverifikasi') {
      throw new Error('Kontrak draf hanya bisa diaktifkan bila identitas penyewa sudah diverifikasi oleh Pengelola.');
    }

    // Satu penyewa paling banyak memiliki satu kontrak aktif
    const hasOtherActive = this.kontrak.some(
      other => other.penyewa_id === k.penyewa_id && other.status === 'aktif' && other.id !== kontrakId
    );
    if (hasOtherActive) {
      throw new Error('Penyewa ini sudah memiliki kontrak aktif.');
    }

    if (isSupabaseConfigured) {
      // ---- Alur database atomik: kontrak + unit + profil dalam 1 transaksi ----
      const { error } = await supabase.rpc('fn_activate_contract', {
        p_kontrak_id: kontrakId,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    // Perbaiki cache lokal agar UI langsung tercermin (unit & penyewa ikut)
    k.status = 'aktif';
    const unit = this.units.find(u => u.id === k.unit_id);
    if (unit && unit.status === 'tersedia') unit.status = 'dikontrak';
    const penyewa = this.profiles.find(p => p.id === k.penyewa_id);
    if (penyewa) penyewa.aktif = true;

    this.logAudit(actor, 'aktivasi:kontrak', 'kontrak', kontrakId, { status: 'draf' }, { status: 'aktif' });
  }

  public async terminateContractEarly(kontrakId: string, alasan: string, actor: Profile): Promise<void> {
    // Pengakhiran lebih awal hanya oleh Pemilik, wajib dengan alasan, berlaku sampai akhir bulan berjalan
    if (actor.peran !== 'pemilik') {
      throw new Error('Pengakhiran kontrak lebih awal hanya dapat dilakukan oleh Pemilik.');
    }
    if (!alasan || alasan.trim().length === 0) {
      throw new Error('Alasan pengakhiran kontrak wajib diisi.');
    }

    const k = this.kontrak.find(item => item.id === kontrakId);
    if (!k) throw new Error('Kontrak tidak ditemukan');

    if (isSupabaseConfigured) {
      // ---- Alur database atomik (unit & profil dipulihkan di server) ----
      const { error } = await supabase.rpc('fn_terminate_contract', {
        p_kontrak_id: kontrakId,
        p_alasan: alasan,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    k.status = 'diakhiri';
    k.alasan_berakhir = alasan;
    k.tanggal_berakhir_aktual = '2026-10-31'; // Akhir bulan berjalan (acuan 15 Okt 2026)

    // Sinkronkan cache lokal: unit kembali tersedia jika tak ada kontrak aktif lain
    const masihAdaAktif = this.kontrak.some(
      other => other.unit_id === k.unit_id && other.status === 'aktif' && other.id !== kontrakId
    );
    if (!masihAdaAktif) {
      const unit = this.units.find(u => u.id === k.unit_id);
      if (unit && unit.status === 'dikontrak') unit.status = 'tersedia';
    }
    const penyewaMasihAktif = this.kontrak.some(
      other => other.penyewa_id === k.penyewa_id && other.status === 'aktif' && other.id !== kontrakId
    );
    if (!penyewaMasihAktif) {
      const penyewa = this.profiles.find(p => p.id === k.penyewa_id);
      if (penyewa) penyewa.aktif = false;
    }

    this.logAudit(actor, 'akhiri:kontrak', 'kontrak', kontrakId, { status: 'aktif' }, { status: 'diakhiri', alasan });
  }

  // --- TAGIHAN & PEMBAYARAN ---
  public getInvoices(): Tagihan[] {
    return this.tagihan.map(t => {
      const k = this.kontrak.find(c => c.id === t.kontrak_id);
      const unit = k ? this.units.find(u => u.id === k.unit_id) : undefined;
      const penyewa = k ? this.profiles.find(p => p.id === k.penyewa_id) : undefined;
      
      // Hitung denda dinamis per 15 Oktober 2026 (atau tanggal bayar)
      let calculatedDenda = t.denda;
      if (t.status !== 'lunas') {
        calculatedDenda = calculateDenda(t.jatuh_tempo, '2026-10-15');
      }

      const total_tagihan = t.nominal_sewa + calculatedDenda;
      const sisa_tagihan = Math.max(0, total_tagihan - t.terbayar);

      return {
        ...t,
        denda: calculatedDenda,
        total_tagihan,
        sisa_tagihan,
        kontrak: k ? { ...k, unit, penyewa } : undefined,
      };
    });
  }

  /**
   * Generate tagihan bulanan (BR-06).
   * Mode Supabase : fn_generate_monthly_invoices (#09) — kunci FOR UPDATE
   *                 semua kontrak aktif → aman dijalankan dua pengguna
   *                 bersamaan (yang kedua mengulang kunci, cek ulang, lalu
   *                 melewati tagihan yang sudah ada, bukan dobel).
   * Gagal DB      = throw (pesan tampil di modal).
   * Mode demo     : logika lokal dipertahankan.
   */
  public async generateMonthlyInvoices(
    periode: string,
    actor: Profile
  ): Promise<{ dibuat: number; dilewati: number }> {
    if (actor.peran !== 'pengelola' && actor.peran !== 'pemilik') {
      throw new Error('Hanya Pengelola atau Pemilik yang berhak membuat tagihan bulanan.');
    }

    const periodeBulan = periode.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(periodeBulan)) {
      throw new Error('Format periode tidak valid. Gunakan format Tahun-Bulan (contoh: 2026-11).');
    }

    if (isSupabaseConfigured) {
      // ---- Alur database transaksional, aman race condition (BR-06) ----
      const { data: res, error } = await supabase.rpc('fn_generate_monthly_invoices', {
        p_periode: `${periodeBulan}-01`,
      });
      if (error) {
        throw new Error(error.message);
      }
      const row = Array.isArray(res) ? res[0] : res;
      if (!row || typeof row.out_dibuat !== 'number') {
        throw new Error('Respons database tidak sesuai saat membuat tagihan bulanan.');
      }
      return { dibuat: row.out_dibuat, dilewati: row.out_dilewati || 0 };
    }

    // ---- Fallback mode demo (tanpa Supabase tetap jalan) ----
    let createdCount = 0;

    const periodeStr = periodeBulan.replace('-', ''); // 202610
    const jatuhTempo = `${periodeBulan}-10`; // Selalu tanggal 10 (BR-06)

    for (const k of this.kontrak.filter(item => item.status === 'aktif')) {
      // BR-06: Satu kontrak hanya punya satu tagihan per periode
      const exists = this.tagihan.some(t => t.kontrak_id === k.id && t.periode.startsWith(periodeBulan));
      if (!exists) {
        const seq = this.tagihan.length + 1;
        const nomor = `INV-${periodeStr}-${String(seq).padStart(4, '0')}`;

        const newTagihan: Tagihan = {
          id: crypto.randomUUID(),
          nomor,
          kontrak_id: k.id,
          periode: `${periodeBulan}-01`,
          jatuh_tempo: jatuhTempo,
          nominal_sewa: k.harga_sewa_bulanan,
          denda: 0,
          terbayar: 0,
          status: 'belum_bayar',
        };

        this.tagihan.push(newTagihan);
        createdCount++;
      }
    }

    this.logAudit(actor, 'buat_massal:tagihan', 'tagihan', periodeBulan, null, { createdCount, periode: periodeBulan });
    return { dibuat: createdCount, dilewati: 0 };
  }

  public async recordPayment(data: {
    tagihan_id: string;
    jumlah: number;
    metode: 'tunai' | 'transfer';
    bukti_path?: string;
    tanggal_bayar: string;
    actor: Profile;
  }): Promise<Pembayaran> {
    if (data.actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak mencatat pembayaran.');
    }

    const t = this.tagihan.find(item => item.id === data.tagihan_id);
    if (!t) throw new Error('Tagihan tidak ditemukan');

    // Hitung denda s/d tanggal pembayaran dicatat
    const dendaSaatBayar = calculateDenda(t.jatuh_tempo, data.tanggal_bayar);
    const totalTagihan = t.nominal_sewa + dendaSaatBayar;
    const sisa = totalTagihan - t.terbayar;

    // Validasi nilai pembayaran
    const val = validatePaymentAmount(data.jumlah, sisa);
    if (!val.valid) {
      throw new Error(val.error);
    }

    if (data.metode === 'transfer' && !data.bukti_path) {
      throw new Error('Pembayaran transfer wajib melampirkan foto bukti transfer.');
    }

    const payment: Pembayaran = {
      id: crypto.randomUUID(),
      tagihan_id: data.tagihan_id,
      jumlah: data.jumlah,
      metode: data.metode,
      tanggal_bayar: data.tanggal_bayar,
      bukti_path: data.bukti_path || null,
      status: 'sah',
      dicatat_oleh: data.actor.id,
      dibuat_pada: new Date().toISOString(),
    };

    this.pembayaran.push(payment);

    // Sinkronisasi ke Supabase (didegradasi ke lokal bila gagal, mis. sesi kedaluwarsa)
    await this.persistPayment(payment);

    // Update status tagihan otomatis (BR-08)
    t.denda = dendaSaatBayar;
    t.terbayar += data.jumlah;
    if (t.terbayar >= totalTagihan) {
      t.status = 'lunas';
    } else {
      t.status = 'sebagian';
    }

    this.logAudit(data.actor, 'catat:pembayaran', 'pembayaran', payment.id, null, payment);
    return payment;
  }

  public cancelPayment(paymentId: string, alasan: string, actor: Profile): void {
    if (actor.peran !== 'pemilik') {
      throw new Error('Hanya Pemilik yang berhak membatalkan pembayaran.');
    }
    if (!alasan || alasan.trim().length === 0) {
      throw new Error('Alasan pembatalan pembayaran wajib diisi.');
    }

    const p = this.pembayaran.find(item => item.id === paymentId);
    if (!p) throw new Error('Pembayaran tidak ditemukan');

    p.status = 'dibatalkan';
    p.alasan_batal = alasan;
    p.dibatalkan_oleh = actor.id;

    // Hitung ulang tagihan
    const t = this.tagihan.find(item => item.id === p.tagihan_id);
    if (t) {
      const validPayments = this.pembayaran.filter(item => item.tagihan_id === t.id && item.status === 'sah');
      t.terbayar = validPayments.reduce((acc, curr) => acc + curr.jumlah, 0);
      const totalHarusBayar = t.nominal_sewa + t.denda;
      if (t.terbayar === 0) {
        t.status = 'belum_bayar';
      } else if (t.terbayar >= totalHarusBayar) {
        t.status = 'lunas';
      } else {
        t.status = 'sebagian';
      }
    }

    this.logAudit(actor, 'batal:pembayaran', 'pembayaran', paymentId, { status: 'sah' }, { status: 'dibatalkan', alasan });
  }

  public cancelInvoice(tagihanId: string, actor: Profile): void {
    if (actor.peran !== 'pemilik') {
      throw new Error('Hanya Pemilik yang berhak membatalkan tagihan.');
    }

    const t = this.tagihan.find(item => item.id === tagihanId);
    if (!t) throw new Error('Tagihan tidak ditemukan');

    // Tagihan hanya bisa dibatalkan Pemilik bila belum ada pembayaran sama sekali
    const hasPayments = this.pembayaran.some(p => p.tagihan_id === tagihanId && p.status === 'sah');
    if (hasPayments || t.terbayar > 0) {
      throw new Error('Tagihan yang sudah memiliki catatan pembayaran tidak bisa dibatalkan.');
    }

    t.status = 'dibatalkan';
    this.logAudit(actor, 'batal:tagihan', 'tagihan', tagihanId, { status: 'belum_bayar' }, { status: 'dibatalkan' });
  }

  // --- SINKRONISASI SUPABASE (menyimpan perubahan ke database) ---
  // Semua metode berikut didegradasi ke lokal bila Supabase tidak dikonfigurasi
  // atau sesi otentikasi tidak valid, agar mode demo tetap berjalan.

  /**
   * Data hasil seed (Data_Contoh_Properti) dianggap dummy: status verifikasinya
   * TIDAK boleh di-reset ke antrean saat penggunanya menyimpan ulang identitas.
   * Reset 'belum' hanya berlaku untuk pengguna baru di luar data dummy.
   */
  private isSeedDummyPenyewa(penyewaId: string): boolean {
    return MOCK_IDENTITAS.some(i => i.penyewa_id === penyewaId);
  }

  /** Simpan/upsert data identitas penyewa (KTP) ke tabel identitas_penyewa */
  public async saveTenantIdentity(data: {
    penyewa_id: string;
    nik: string;
    alamat_asal: string;
    kontak_darurat_nama: string;
    kontak_darurat_hp: string;
    foto_ktp_path?: string;
  }): Promise<void> {
    // Reset antrean verifikasi hanya untuk pengguna di luar data dummy (seed)
    const idx = this.identitas.findIndex(i => i.penyewa_id === data.penyewa_id);
    const isDummy = this.isSeedDummyPenyewa(data.penyewa_id);
    const newStatus: VerifikasiStatus =
      isDummy && idx >= 0 ? this.identitas[idx].status_verifikasi : 'belum';

    if (idx >= 0) {
      this.identitas[idx] = {
        ...this.identitas[idx],
        nik: data.nik,
        alamat_asal: data.alamat_asal,
        kontak_darurat_nama: data.kontak_darurat_nama,
        kontak_darurat_hp: data.kontak_darurat_hp,
        foto_ktp_path: data.foto_ktp_path ?? this.identitas[idx].foto_ktp_path,
        status_verifikasi: newStatus, // data dummy tetap memakai status seed-nya
      };
    } else {
      this.identitas.push({
        penyewa_id: data.penyewa_id,
        nik: data.nik,
        alamat_asal: data.alamat_asal,
        kontak_darurat_nama: data.kontak_darurat_nama,
        kontak_darurat_hp: data.kontak_darurat_hp,
        foto_ktp_path: data.foto_ktp_path,
        status_verifikasi: newStatus,
      });
    }

    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('identitas_penyewa').upsert({
      penyewa_id: data.penyewa_id,
      nik: data.nik,
      alamat_asal: data.alamat_asal,
      kontak_darurat_nama: data.kontak_darurat_nama,
      kontak_darurat_hp: data.kontak_darurat_hp,
      foto_ktp_path: data.foto_ktp_path ?? null,
      status_verifikasi: newStatus,
    }, { onConflict: 'penyewa_id' });
    if (error) {
      throw new Error(`Gagal menyimpan identitas ke database: ${error.message}`);
    }
  }

  /** Masukkan ke pembayaran ke Supabase (dipanggil setelah rekam lokal) */
  private async persistPayment(payment: Pembayaran): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('pembayaran').insert({
      id: payment.id,
      tagihan_id: payment.tagihan_id,
      jumlah: payment.jumlah,
      metode: payment.metode,
      tanggal_bayar: payment.tanggal_bayar,
      bukti_path: payment.bukti_path,
      status: payment.status,
      dicatat_oleh: payment.dicatat_oleh,
      dibuat_pada: payment.dibuat_pada,
    });
    if (error) {
      console.warn('Pembayaran tersimpan lokal, namun gagal sinkron ke Supabase:', error.message);
    }
  }

  /** Nomor laporan kerusakan: diminta dari SERVER lewat fungsi thread-safe
   *  generate_nomor_urut (BR-06) agar tidak bentrok dengan nomor di database
   *  yang tidak terlihat oleh penyewa (RLS). Fallback: penomoran lokal. */
  private async nomorLaporanBerikutnya(): Promise<{ nomor: string; tahun: string; dariServer: boolean }> {
    // Demo memakai tanggal acuan 2026
    const tahun = '2026';
    try {
      const { data, error } = await supabase.rpc('generate_nomor_urut', {
        p_jenis: 'LK',
        p_periode: tahun,
      });
      if (!error && typeof data === 'string' && data.startsWith('LK-')) {
        return { nomor: data, tahun, dariServer: true };
      }
      console.warn('Nomor via generate_nomor_urut gagal, memakai fallback lokal:', error?.message);
    } catch (e) {
      console.warn('RPC generate_nomor_urut tidak tersedia:', e);
    }
    return {
      nomor: `LK-${tahun}-${String(this.kerusakan.length + 1).padStart(4, '0')}`,
      tahun,
      dariServer: false,
    };
  }

  // --- LAPORAN KERUSAKAN ---
  public getDamageReports(): LaporanKerusakan[] {
    return this.kerusakan.map(lk => ({
      ...lk,
      unit: this.units.find(u => u.id === lk.unit_id),
      pelapor: this.profiles.find(p => p.id === lk.pelapor_id),
    }));
  }

  public async createDamageReport(data: {
    unit_id: string;
    kategori: string;
    judul: string;
    deskripsi?: string;
    foto_paths: string[];
    actor: Profile;
  }): Promise<LaporanKerusakan> {
    // Laporan kerusakan hanya bisa dibuat penyewa yang memiliki kontrak aktif
    const activeContract = this.kontrak.find(
      k => k.penyewa_id === data.actor.id && k.unit_id === data.unit_id && k.status === 'aktif'
    );
    if (!activeContract) {
      throw new Error('Laporan kerusakan hanya bisa dibuat oleh penyewa dengan kontrak aktif di unit tersebut.');
    }

    // Foto 1 s/d 3
    if (!data.foto_paths || data.foto_paths.length < 1 || data.foto_paths.length > 3) {
      throw new Error('Setiap laporan kerusakan wajib melampirkan 1 sampai 3 foto.');
    }

    // Satu penyewa paling banyak memiliki 3 laporan terbuka
    const openCount = this.kerusakan.filter(
      lk => lk.pelapor_id === data.actor.id &&
      ['dilaporkan', 'diproses', 'menunggu_persetujuan'].includes(lk.status)
    ).length;

    if (!canCreateDamageReport(openCount)) {
      throw new Error('Anda sudah memiliki 3 laporan kerusakan yang masih terbuka. Harap selesaikan atau tunggu laporan sebelumnya ditutup terlebih dahulu.');
    }

    // Nomor thread-safe dari server (fallback lokal bila RPC gagal)
    const { nomor: nomorAwal, tahun } = await this.nomorLaporanBerikutnya();

    const dasar: Omit<LaporanKerusakan, 'nomor'> = {
      id: crypto.randomUUID(),
      kontrak_id: activeContract.id,
      unit_id: data.unit_id,
      pelapor_id: data.actor.id,
      kategori: data.kategori,
      judul: data.judul,
      deskripsi: data.deskripsi,
      foto_paths: data.foto_paths,
      status: 'dilaporkan',
      dibuat_pada: new Date().toISOString(),
    };

    // Simpan ke SERVER terlebih dahulu — kegagalan tidak boleh di-swallow
    // (dulu berujung "tersimpan lokal namun hilang setelah reload").
    let nomorFinal = nomorAwal;
    if (isSupabaseConfigured) {
      let nomor = nomorAwal;
      // Bila nomor bentrok (23505) dengan baris yang tak terlihat penyewa,
      // coba nomor urut berikutnya (maks 20 upaya).
      for (let attempt = 0; attempt < 20; attempt++) {
        const reportCoba = { ...dasar, nomor };
        const { error } = await supabase.from('laporan_kerusakan').insert({
          id: reportCoba.id,
          nomor: reportCoba.nomor,
          kontrak_id: reportCoba.kontrak_id,
          unit_id: reportCoba.unit_id,
          pelapor_id: reportCoba.pelapor_id,
          kategori: reportCoba.kategori,
          judul: reportCoba.judul,
          deskripsi: reportCoba.deskripsi,
          foto_paths: reportCoba.foto_paths,
          status: reportCoba.status,
          dibuat_pada: reportCoba.dibuat_pada,
        });
        if (!error) {
          nomorFinal = nomor;
          break;
        }
        const bentrokNomor =
          error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '');
        if (bentrokNomor && attempt < 19) {
          const urut = parseInt(nomor.split('-')[2] || '0', 10) + 1;
          nomor = `LK-${tahun}-${String(urut).padStart(4, '0')}`;
          continue;
        }
        throw new Error(`Gagal menyimpan laporan ke server: ${error.message}`);
      }
    }

    // Rekam ke memori HANYA setelah server mengkonfirmasi tersimpan,
    // memakai nomor final yang benar-benar tersimpan di server.
    const report: LaporanKerusakan = { ...dasar, nomor: nomorFinal };
    this.kerusakan.push(report);

    this.logAudit(data.actor, 'buat:laporan_kerusakan', 'laporan_kerusakan', report.id, null, report);
    return report;
  }

  /** Sinkronkan perubahan laporan kerusakan ke server SEBELUM mutasi memori.
   *  Keagalan di-throw ke UI (tidak di-swallow) agar tidak ada perubahan
   *  status yang "siluman" — hilang setelah reload. */
  private async sinkronKerusakanKeServer(
    reportId: string,
    fields: Partial<Pick<LaporanKerusakan, 'status' | 'estimasi_biaya' | 'biaya_aktual' | 'disetujui_oleh' | 'selesai_pada' | 'alasan_penolakan'>>
  ): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('laporan_kerusakan').update(fields).eq('id', reportId);
    if (error) {
      throw new Error(`Gagal menyimpan perubahan status laporan ke server: ${error.message}`);
    }
  }

  public async processDamageReport(reportId: string, estimasiBiaya: number, actor: Profile): Promise<void> {
    if (actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak memproses laporan kerusakan.');
    }

    const r = this.kerusakan.find(item => item.id === reportId);
    if (!r) throw new Error('Laporan tidak ditemukan');

    // Estimasi di atas Rp1.000.000 wajib persetujuan Pemilik
    const statusBaru = estimasiBiaya > 1000000 ? 'menunggu_persetujuan' : 'diproses';

    // Simpan ke server dahulu (throw bila gagal), baru mutasi memori
    await this.sinkronKerusakanKeServer(reportId, { status: statusBaru, estimasi_biaya: estimasiBiaya });
    r.estimasi_biaya = estimasiBiaya;
    r.status = statusBaru;

    this.logAudit(actor, 'proses:laporan_kerusakan', 'laporan_kerusakan', reportId, null, { estimasiBiaya, status: statusBaru });
  }

  /** Pengelola menolak laporan (hanya dari status 'dilaporkan').
   *  Alasan penolakan wajib — tersimpan di kolom alasan_penolakan. */
  public async rejectDamageReport(reportId: string, alasan: string, actor: Profile): Promise<void> {
    if (actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak menolak laporan kerusakan.');
    }

    const alasanFinal = alasan.trim();
    if (alasanFinal.length < 10) {
      throw new Error('Alasan penolakan wajib diisi (minimal 10 karakter) agar penyewa memahami keputusan.');
    }

    const r = this.kerusakan.find(item => item.id === reportId);
    if (!r) throw new Error('Laporan tidak ditemukan');
    if (r.status !== 'dilaporkan') {
      throw new Error('Hanya laporan berstatus Dilaporkan yang dapat ditolak.');
    }

    // Simpan ke server dahulu (throw bila gagal), baru mutasi memori
    const statusLama = r.status;
    await this.sinkronKerusakanKeServer(reportId, { status: 'ditolak', alasan_penolakan: alasanFinal });
    r.status = 'ditolak';
    r.alasan_penolakan = alasanFinal;

    this.logAudit(actor, 'tolak:laporan_kerusakan', 'laporan_kerusakan', reportId, { status: statusLama }, { status: 'ditolak', alasan: alasanFinal });
  }

  /** Pengelola menandai laporan 'diproses' sebagai selesai dikerjakan.
   *  Laporan berstatus 'selesai' dan siap ditutup resmi (BR-12). */
  public async completeDamageReport(reportId: string, actor: Profile): Promise<void> {
    if (actor.peran !== 'pengelola') {
      throw new Error('Hanya Pengelola yang berhak menandai laporan selesai.');
    }

    const r = this.kerusakan.find(item => item.id === reportId);
    if (!r) throw new Error('Laporan tidak ditemukan');
    if (r.status !== 'diproses') {
      throw new Error('Hanya laporan berstatus Diproses yang dapat ditandai selesai.');
    }

    // Simpan ke server dahulu (throw bila gagal), baru mutasi memori
    const statusLama = r.status;
    const selesaiPada = new Date().toISOString();
    await this.sinkronKerusakanKeServer(reportId, { status: 'selesai', selesai_pada: selesaiPada });
    r.status = 'selesai';
    r.selesai_pada = selesaiPada;

    this.logAudit(actor, 'selesai:laporan_kerusakan', 'laporan_kerusakan', reportId, { status: statusLama }, { status: 'selesai' });
  }

  public async approveDamageReport(reportId: string, actor: Profile): Promise<void> {
    if (actor.peran !== 'pemilik') {
      throw new Error('Hanya Pemilik yang berhak menyetujui biaya perbaikan besar.');
    }
    const r = this.kerusakan.find(item => item.id === reportId);
    if (!r) throw new Error('Laporan tidak ditemukan');

    // Simpan ke server dahulu (throw bila gagal), baru mutasi memori
    await this.sinkronKerusakanKeServer(reportId, { status: 'diproses', disetujui_oleh: actor.id });
    r.status = 'diproses';
    r.disetujui_oleh = actor.id;

    this.logAudit(actor, 'setujui:laporan_kerusakan', 'laporan_kerusakan', reportId, null, { status: 'diproses' });
  }

  public async closeDamageReport(reportId: string, actor: Profile): Promise<void> {
    const r = this.kerusakan.find(item => item.id === reportId);
    if (!r) throw new Error('Laporan tidak ditemukan');

    // BR-12: Ditutup oleh penyewa pelapor, atau Pengelola setelah selesai
    // Simpan ke server dahulu (throw bila gagal), baru mutasi memori
    await this.sinkronKerusakanKeServer(reportId, { status: 'ditutup' });
    r.status = 'ditutup';
    this.logAudit(actor, 'tutup:laporan_kerusakan', 'laporan_kerusakan', reportId, null, { status: 'ditutup' });
  }

  // --- AUDIT LOG ---
  public getAuditLogs(): AuditLog[] {
    return this.auditLogs.map(log => ({
      ...log,
      pelaku: this.profiles.find(p => p.id === log.pelaku_id),
    }));
  }

  private logAudit(
    actor: Profile,
    aksi: string,
    tabel: string,
    data_id: string,
    sebelum: any,
    sesudah: any
  ): void {
    const log: AuditLog = {
      id: this.auditLogs.length + 1,
      pelaku_id: actor.id,
      peran: actor.peran,
      aksi,
      tabel,
      data_id,
      sebelum,
      sesudah,
      dibuat_pada: new Date().toISOString(),
    };
    this.auditLogs.unshift(log); // Taruh di awal
  }
}

export const dataStore = new DataStore();
