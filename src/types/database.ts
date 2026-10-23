export type RoleType = 'pemilik' | 'pengelola' | 'penyewa';
export type UnitStatus = 'tersedia' | 'dikontrak' | 'perbaikan' | 'nonaktif';
export type KontrakStatus = 'draf' | 'aktif' | 'selesai' | 'diakhiri' | 'dibatalkan';
export type TagihanStatus = 'belum_bayar' | 'sebagian' | 'lunas' | 'dibatalkan';
export type PembayaranMetode = 'tunai' | 'transfer' | 'mayar';
export type PembayaranStatus = 'sah' | 'dibatalkan';
export type KerusakanStatus = 
  | 'dilaporkan' 
  | 'menunggu_persetujuan' 
  | 'diproses' 
  | 'selesai' 
  | 'ditutup' 
  | 'ditolak';
export type VerifikasiStatus = 'belum' | 'terverifikasi' | 'ditolak';

export interface Profile {
  id: string; // uuid FK to auth.users
  nama_lengkap: string;
  email: string;
  no_hp: string;
  peran: RoleType;
  aktif: boolean;
  dibuat_pada: string;
}

export interface IdentitasPenyewa {
  penyewa_id: string; // uuid FK to profiles.id
  nik: string; // char(16) - Rahasia
  alamat_asal: string;
  foto_ktp_path?: string;
  kontak_darurat_nama: string;
  kontak_darurat_hp: string;
  status_verifikasi: VerifikasiStatus;
  diverifikasi_oleh?: string | null;
  diverifikasi_pada?: string | null;
  catatan_verifikasi?: string | null;
}

export interface IdentitasPenyewaMasked extends Omit<IdentitasPenyewa, 'nik'> {
  nik_masked: string; // e.g. ************1234 untuk Pemilik
}

export interface Unit {
  id: string;
  kode: string; // contoh: 'A-101'
  lantai: number; // 1, 2, 3
  tipe: 'standar' | 'ac' | 'studio';
  luas_m2: number;
  harga_sewa_bulanan: number;
  status: UnitStatus;
  keterangan?: string;
}

export interface Kontrak {
  id: string;
  nomor: string; // KTR-2026-0001
  unit_id: string;
  penyewa_id: string;
  tanggal_mulai: string; // format YYYY-MM-DD (selalu tgl 1)
  durasi_bulan: 1 | 3 | 6 | 12;
  tanggal_selesai: string; // format YYYY-MM-DD (hari terakhir bulan ke-n)
  harga_sewa_bulanan: number; // dikunci saat kontrak dibuat
  status: KontrakStatus;
  tanggal_berakhir_aktual?: string | null;
  alasan_berakhir?: string | null;
  dibuat_oleh: string;
  dibuat_pada?: string;
  // Join properties (optional for display)
  unit?: Unit;
  penyewa?: Profile;
}

export interface Tagihan {
  id: string;
  nomor: string; // INV-202610-0001
  kontrak_id: string;
  periode: string; // format YYYY-MM-01
  jatuh_tempo: string; // format YYYY-MM-10
  nominal_sewa: number;
  denda: number; // 0 s/d 200000 (BR-07)
  terbayar: number;
  status: TagihanStatus;
  mayar_invoice_id?: string | null;
  mayar_link?: string | null;
  // Calculated/Joined
  kontrak?: Kontrak;
  total_tagihan?: number;
  sisa_tagihan?: number;
}

export interface Pembayaran {
  id: string;
  tagihan_id: string;
  jumlah: number;
  metode: PembayaranMetode;
  tanggal_bayar: string;
  bukti_path?: string | null;
  referensi_mayar?: string | null;
  status: PembayaranStatus;
  alasan_batal?: string | null;
  dicatat_oleh: string;
  dibatalkan_oleh?: string | null;
  dibuat_pada?: string;
  // Joined
  tagihan?: Tagihan;
  pencatat?: Profile;
}

export interface LaporanKerusakan {
  id: string;
  nomor: string; // LK-2026-0001
  kontrak_id: string;
  unit_id: string;
  pelapor_id: string;
  kategori: string;
  judul: string;
  deskripsi?: string;
  foto_paths: string[]; // 1 s/d 3 foto
  status: KerusakanStatus;
  estimasi_biaya?: number | null;
  biaya_aktual?: number | null;
  disetujui_oleh?: string | null;
  selesai_pada?: string | null;
  alasan_penolakan?: string | null;
  dibuat_pada?: string;
  // Joined
  unit?: Unit;
  pelapor?: Profile;
}

export interface NomorUrut {
  jenis: 'KTR' | 'INV' | 'LK';
  periode: string; // '2026' atau '202610'
  terakhir: number;
}

export interface AuditLog {
  id: number;
  pelaku_id: string;
  peran: RoleType;
  aksi: string;
  tabel: string;
  data_id: string;
  sebelum?: Record<string, any> | null;
  sesudah?: Record<string, any> | null;
  dibuat_pada: string;
  pelaku?: Profile;
}
