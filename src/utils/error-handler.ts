/**
 * Utility untuk membersihkan dan menstandarkan pesan error sistem / database / aturan bisnis
 * Menghilangkan tag teknis seperti "(BR-xx)" atau "Aturan BR-xx: " sehingga hanya menyisakan alasan errornya saja.
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

  // Tangani pesan umum PostgreSQL / Supabase RLS
  if (rawMessage.toLowerCase().includes('row-level security') || rawMessage.includes('42501')) {
    return 'Aksi ditolak oleh sistem keamanan: Akun Anda tidak memiliki izin untuk melakukan perubahan ini.';
  }

  return cleanErrorMessage(rawMessage);
}
