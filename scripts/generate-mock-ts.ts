import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.resolve('Data_Contoh_Properti.xlsx');
const workbook = readFile(filePath);

const data: Record<string, any> = {};

['Akun Uji', 'profiles', 'identitas_penyewa', 'unit', 'kontrak', 'tagihan', 'pembayaran', 'laporan_kerusakan', 'nomor_urut', 'audit_log'].forEach(sheet => {
  data[sheet] = utils.sheet_to_json(workbook.Sheets[sheet]);
});

const tsContent = `// Auto-generated mock data from Data_Contoh_Properti.xlsx
// Digunakan untuk mode pengujian, demo, atau saat belum terkoneksi ke Supabase aktif

export const MOCK_ACCOUNTS = ${JSON.stringify(data['Akun Uji'], null, 2)};
export const MOCK_PROFILES = ${JSON.stringify(data['profiles'], null, 2)};
export const MOCK_IDENTITAS = ${JSON.stringify(data['identitas_penyewa'], null, 2)};
export const MOCK_UNITS = ${JSON.stringify(data['unit'], null, 2)};
export const MOCK_KONTRAK = ${JSON.stringify(data['kontrak'], null, 2)};
export const MOCK_TAGIHAN = ${JSON.stringify(data['tagihan'], null, 2)};
export const MOCK_PEMBAYARAN = ${JSON.stringify(data['pembayaran'], null, 2)};
export const MOCK_KERUSAKAN = ${JSON.stringify(data['laporan_kerusakan'], null, 2)};
export const MOCK_AUDIT_LOG = ${JSON.stringify(data['audit_log'], null, 2)};
`;

fs.mkdirSync(path.resolve('src/data'), { recursive: true });
fs.writeFileSync(path.resolve('src/data/mock-data.ts'), tsContent, 'utf8');
console.log('Mock data generated at src/data/mock-data.ts');
