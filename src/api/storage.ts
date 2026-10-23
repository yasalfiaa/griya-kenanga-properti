import { supabase, isSupabaseConfigured } from './supabase';

// ------------------------------------------------------------------
// Konstanta validasi gambar (dipakai frontend + mode demo)
// ------------------------------------------------------------------
export const MAX_IMAGE_SIZE_MB = 2;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024; // 2MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_IMAGE_ATTR = 'image/jpeg,image/png,image/webp';

/** Nama bucket yang dipakai aplikasi */
export const STORAGE_BUCKETS = {
  ktp: 'ktp', // privat -> akses via signed URL
  buktiBayar: 'bukti-bayar', // publik
  laporanKerusakan: 'laporan_kerusakan', // publik
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export interface UploadedDocument {
  /** Path relatif di dalam bucket, mis: "<userId>/ktp_<userId>_1731620000.jpg" */
  path: string;
  /**
   * URL untuk ditampilkan:
   *  - bucket publik  => URL publik permanen
   *  - bucket privat  => path relatif (URL signed diambil via getSignedImageUrl)
   */
  url: string;
  bucket: StorageBucket;
}

/**
 * Validasi file gambar di sisi frontend.
 * @returns pesan error (Indonesia) bila tidak valid, atau null bila valid.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Format file harus JPG, PNG, atau WEBP.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Ukuran file maksimal ${MAX_IMAGE_SIZE_MB}MB (file Anda ${(
      file.size / (1024 * 1024)
    ).toFixed(2)}MB).`;
  }
  if (file.size === 0) {
    return 'File kosong. Silakan pilih file gambar yang benar.';
  }
  return null;
}

/** Apakah sebuah path adalah URL lengkap (bukan path relatif bucket)? */
export function isHttpUrl(path?: string | null): boolean {
  return Boolean(path && path.startsWith('http'));
}

/** Ekstensi file dari tipe MIME yang sudah tervalidasi */
function extFromType(type: string): string {
  switch (type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

interface UploadOptions {
  bucket: StorageBucket;
  /** ID profil pengguna (sama dengan auth.uid() bila login dengan password) */
  userId: string;
  /** Awalan nama file, mis: 'ktp' | 'bukti' | 'kerusakan' */
  kind: string;
  file: File;
  /** Indeks opsional untuk upload multi-foto (1, 2, 3, dst) */
  index?: number;
}

/**
 * Pastikan ada sesi login Supabase Auth yang VALID (login dengan kata sandi),
 * dan id profil aktif sama dengan auth.uid() — syarat kebijakan RLS Storage
 * (folder nama = auth.uid()). Dipanggil sebelum setiap upload.
 */
export async function ensureAuthenticatedForUpload(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser) {
    throw new Error(
      'Sesi login Supabase tidak ditemukan. Untuk mengunggah foto, masuk lewat halaman Login ' +
      'dengan email dan kata sandi (login cepat/demo tidak membentuk sesi, sehingga Storage menolak berkas).'
    );
  }
  if (sessionUser.id !== userId) {
    throw new Error(
      'Akun aktif tidak cocok dengan sesi Supabase Auth. Silakan logout lalu login kembali ' +
      'dengan email dan kata sandi akun yang sama.'
    );
  }
}

/**
 * Unggah 1 gambar ke Supabase Storage.
 * Nama file dibuat unik: <folder>/<kind>_<userId>_<timestamp>[__i].<ext>
 *  - Bucket publik  => kembalikan public URL permanen.
 *  - Bucket privat  => kembalikan path relatif (akses via getSignedImageUrl).
 */
export async function uploadImage(opts: UploadOptions): Promise<UploadedDocument> {
  if (!isSupabaseConfigured) {
    // Mode demo tanpa Supabase: tidak ada Storage, kembalikan nama file saja.
    return { bucket: opts.bucket, path: opts.file.name, url: opts.file.name };
  }

  // Guard: RLS Storage hanya mengizinkan pengguna dengan sesi asli (auth.uid())
  await ensureAuthenticatedForUpload(opts.userId);

  const ext = extFromType(opts.file.type);
  const ts = Date.now();
  const suffix = opts.index ? `_${opts.index}` : '';
  const path = `${opts.userId}/${opts.kind}_${opts.userId}_${ts}${suffix}.${ext}`;

  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(path, opts.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: opts.file.type,
    });

  if (error) {
    // Pesan "violates row-level security policy" kebanyakan karena:
    // 1) 06_storage_policies.sql belum dijalankan di SQL Editor, atau
    // 2) sesi Supabase Auth tidak ada/berbeda (▼ guard di atas sudah menanggulangi,
    //    tapi tetap beri petunjuk bila sanggup lolos).
    if (error.message.includes('violates row-level security')) {
      throw new Error(
        'Gagal mengunggah: kebijakan Storage menolak berkas ini. Pastikan ' +
        '(1) skrip supabase/migrations/06_storage_policies.sql sudah dijalankan di SQL Editor, dan ' +
        '(2) Anda login dengan email + kata sandi (bukan login cepat/demo).'
      );
    }
    throw new Error(`Gagal mengunggah ke Server Storage: ${error.message}`);
  }

  // Bucket publik -> ambil URL permanen; bucket privat -> simpan path saja
  if (isPublicBucket(opts.bucket)) {
    const { data } = supabase.storage.from(opts.bucket).getPublicUrl(path);
    return { bucket: opts.bucket, path, url: data.publicUrl };
  }
  return { bucket: opts.bucket, path, url: path };
}

/** Bucket publik daftar di storage.buckets.public = true (lihat 06_storage_policies.sql) */
function isPublicBucket(bucket: StorageBucket): boolean {
  return bucket === STORAGE_BUCKETS.buktiBayar || bucket === STORAGE_BUCKETS.laporanKerusakan;
}

/**
 * Ambil URL sementara (signed) untuk berkas di bucket PRIVAT (mis. KTP).
 * @param path path relatif di bucket
 * @param expiresIn kedaluwarsa dalam detik (default 5 menit)
 * @returns URL signed atau null bila gagal (mis. mock data demo)
 */
export async function getSignedImageUrl(
  path: string,
  bucket: StorageBucket = STORAGE_BUCKETS.ktp,
  expiresIn = 300
): Promise<string | null> {
  if (!isSupabaseConfigured || isHttpUrl(path) || path === 'ktp/my_ktp.jpg') return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
