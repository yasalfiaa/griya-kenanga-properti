import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as path from 'path';

const filePath = path.resolve('Data_Contoh_Properti.xlsx');
const workbook = readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(sheet);
  console.log(`\n--- Sheet: ${sheetName} (Rows: ${data.length}) ---`);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0] as object));
    console.log('Sample Row 0:', data[0]);
  }
});
