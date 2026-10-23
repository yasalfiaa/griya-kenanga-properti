/**
 * Utility untuk membersihkan & menstandarkan pesan error sistem/database/aturan bisnis.
 * - cleanErrorMessage : buang tag teknis "(BR-xx)" dsb.
 * - translateServerMessage : terjemahkan pesan mentah Postgres/Supabase (RLS,
 *   constraint, unique/FK) menjadi pesan bisnis berbahasa Indonesia.
 * - parseErrorMessage : satu pintu dipakai SEMUA modal & alur status.
 *   Pola: every mutation -> try/catch -> parseErrorMessage(error) -> modalErrorState -> ModalErrorAlert.
 */

export function cleanErrorMessage(message: string): string {
  if (!message) return '';

  return message
    // Hapus awalan seperti "Aturan BR-01: ", "Aturan BR-04: ", dll.
    .replace(/^aturan\s+br-\d+:\s*/i, '')
    .replace(/aturan\s+br-\d+:\s*/gi, '')
    .replace(/aturan\s+br-\d+\s*s\/d\s*br-\d+:\s*/gi, '')
    // Hapus akhiran/tengah seperti "(BR-01)", "(BR-05)", "(BR-11, BR-12)", "(BR-01 s/d BR-05)"
    .replace(/\s*\(\s*br-\d+(\s*,\s*br-\d+)*\s*\)/gi, '')
    .replace(/\s*\(\s*br-\d+\s*s\/d\s*br-\d+\s*\)/gi, '')
    .replace(/\s*\(br-[^)]+\)/gi, '')
    // Rapikan spasi ganda dan tanda baca di akhir
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Terjemahkan pesan mentah dari Postgres/RPC menjadi pesan bisnis Indonesia */
export function translateServerMessage(rawMessage: string): string | null {
  const msg = rawMessage.toLowerCase();

  // --- Keamanan / RLS (kode 42501) ---
  if (msg.includes('row-level security') || msg.includes('42501')) {
    return 'Aksi ditolak oleh sistem keamanan: akun Anda tidak memiliki izin melakukan perubahan ini. Login ulang dengan akun yang berhak.';
  }
  if (msg.includes('type name') && msg.includes('not allowed')) {
    return 'Aksi ditolak: peran akun Anda tidak berhak melakukan proses ini.';
  }

  // --- Duplikat / unique constraint ---
  if (msg.includes('duplicate key value') || msg.includes('unique constraint')) {
    if (msg.includes('kontrak_nomor_key')) return 'Nomor kontrak sudah terpakai. Coba simpan kembali (nomor akan dibuat ulang otomatis).';
    if (msg.includes('unik_kontrak_periode')) return 'Sudah ada tagihan untuk kontrak & periode ini (BR: satu tagihan per kontrak per periode).';
    return 'Gagal tersimpan: data dengan nomor/kode tersebut sudah ada (tidak boleh dobel).';
  }

  // --- Foreign key / referensi ---
  if (msg.includes('violates foreign key constraint') || msg.includes('23503')) {
    return 'Gagal tersimpan: data yang dirujuk tidak valid (misal unit, penyewa, tagihan, atau kontrak tidak ada).';
  }

  // --- CHECK constraint ---
  if (msg.includes('check constraint')) {
    if (msg.includes('unit_status_check')) {
      return 'Status unit tidak valid. Gunakan: tersedia, dikontrak, perbaikan, atau nonaktif.';
    }
    if (msg.includes('identitas_penyewa_tolak_wajib_catatan')) {
      return 'Penolakan identitas wajib disertai alasan (catatan tidak boleh kosong).';
    }
    if (msg.includes('denda')) return 'Nilai denda di luar batas aturan (minimal Rp0, maksimal Rp200.000).';
    if (msg.includes('harga_sewa_bulanan')) return 'Harga sewa bulanan harus lebih besar dari Rp0.';
    if (msg.includes('durasi_bulan')) return 'Durasi sewa hanya boleh 1, 3, 6, atau 12 bulan.';
    if (msg.includes('status_verifikasi')) return 'Status verifikasi tidak valid (belum / terverifikasi / ditolak).';
    if (msg.includes('status')) return 'Status tidak memenuhi daftar nilai yang diizinkan database.';
    return 'Gagal tersimpan: data tidak memenuhi aturan validasi database.';
  }

  // --- Not-null / format data ---
  if (msg.includes('violates not-null constraint')) {
    const col = rawMessage.match(/constraint "(.+?)"/);
    return `Gagal tersimpan: kolom wajib "${col?.[1]?.replace(/_/g, ' ') || 'tertentu'}" tidak boleh kosong.`;
  }
  if (msg.includes('23508')) {
    return 'Gagal tersimpan: data tidak memenuhi aturan integritas tabel.';
  }

  // --- Kesalahan sesi / izin RPC ---
  if (msg.includes('jwt') || msg.includes('session')) {
    return 'Sesi login berakhir. Silakan login ulang lalu coba lagi.';
  }
  if (msg.includes('could not find the function') || msg.includes('schema cache')) {
    return 'Fungsi proses belum tersedia di server. Pastikan skrip migration SQL sudah dijalankan di SQL Editor.';
  }

  // --- Overlap/kontrak ganda: pesan dari fn sudah Indonesia, biarkan lewat ---
  if (
    msg.includes('beririsan') ||
    msg.includes('kontrak aktif lain') ||
    msg.includes('hanya unit berstatus') ||
    msg.includes('hanya kontrak draf') ||
    msg.includes('belum diverifikasi') ||
    msg.includes('harus selalu tanggal 1') ||
    msg.includes('unauthenticated')
  ) {
    return cleanErrorMessage(rawMessage);
  }

  return null; // tidak dikenali -> biarkan diproses penuh
}

export function parseErrorMessage(error: any): string {
  if (!error) return 'Terjadi kesalahan sistem yang tidak diketahui.';

  let rawMessage = '';

  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else if (error.error_description) {
    rawMessage = error.error_description;
  } else if (error.message) {
    rawMessage = error.message;
  } else if (error.error?.message) {
    rawMessage = error.error.message;
  } else if (typeof error === 'object') {
    rawMessage = JSON.stringify(error);
  } else {
    rawMessage = String(error);
  }

  // Translasi pesan server ke pesan bisnis (BR) bila cocok
  const translated = translateServerMessage(rawMessage);
  if (translated) return translated;

  return cleanErrorMessage(rawMessage);
}
