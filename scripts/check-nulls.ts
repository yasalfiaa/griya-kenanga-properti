import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as path from 'path';

const filePath = path.resolve('Data_Contoh_Properti.xlsx');
const workbook = readFile(filePath);

const tables = [
  'profiles',
  'identitas_penyewa',
  'unit',
  'kontrak',
  'tagihan',
  'pembayaran',
  'laporan_kerusakan',
  'nomor_urut',
  'audit_log',
];

console.log('--- CHECKING NULLS IN ALL EXCEL SHEETS ---');

tables.forEach(tableName => {
  const sheet = workbook.Sheets[tableName];
  if (!sheet) return;
  const rows = utils.sheet_to_json(sheet, { defval: null }) as any[];
  if (rows.length === 0) return;

  const cols = Object.keys(rows[0]);
  const nullCols: Record<string, number> = {};

  rows.forEach(r => {
    cols.forEach(c => {
      if (r[c] === null || r[c] === undefined || r[c] === '') {
        nullCols[c] = (nullCols[c] || 0) + 1;
      }
    });
  });

  const nullSummary = Object.entries(nullCols).map(([c, count]) => `${c}: ${count} nulls`);
  if (nullSummary.length > 0) {
    console.log(`Table ${tableName} has nulls in:`, nullSummary.join(', '));
  } else {
    console.log(`Table ${tableName}: No nulls found.`);
  }
});
