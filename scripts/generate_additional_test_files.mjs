import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const outDir = path.resolve('test_data', 'additional_formats');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. .csv with UTF-8 BOM and commas inside quotes
const csvContentWithBomAndQuotes = 
  '\uFEFF"Candidate Name","Contact Number","Current Location","Experience (Yrs)","Expected Salary","Email"\n' +
  '"Sharma, Deepak Kumar","+91 98111 22334","Mumbai, Maharashtra","4.5","18,00,000","deepak.sharma@example.com"\n' +
  '"Verma, Priya R.","9820099887","Pune, Maharashtra","6","22,00,000","priya.verma@example.com"\n' +
  '"Patel, Amit","09833344556","Ahmedabad, Gujarat","3","12,00,000","amit.patel@example.com"\n';

fs.writeFileSync(path.join(outDir, 'candidates_bom_quotes.csv'), csvContentWithBomAndQuotes, 'utf8');
console.log('Created: candidates_bom_quotes.csv (UTF-8 BOM + Quotes with commas)');

// 2. .xls (BIFF8 legacy Excel format)
const xlsData = [
  ['Applicant Name', 'Mobile Number', 'City', 'Total Exp (Years)', 'Expected CTC'],
  ['Anil Kapoor', '9820111222', 'Mumbai', '5', '1600000'],
  ['Sunita Rao', '+91-9820222333', 'Bengaluru', '4', '1400000'],
  ['Rajesh Khanna', '09820333444', 'Delhi', '7', '2100000']
];
const wsXls = XLSX.utils.aoa_to_sheet(xlsData);
const wbXls = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbXls, wsXls, 'Sheet1');
XLSX.writeFile(wbXls, path.join(outDir, 'candidates_legacy.xls'), { bookType: 'biff8' });
console.log('Created: candidates_legacy.xls (BIFF8 .xls)');

// 3. File saved by Excel (.xlsx)
const excelData = [
  ['Candidate Name', 'Phone Number', 'Current City', 'Experience (Yrs)', 'Expected CTC (LPA)', 'Email'],
  ['Manoj Bajpayee', '+91 9820444555', 'Mumbai', '8', '24.0', 'manoj@example.com'],
  ['Tabu Hashmi', '9820555666', 'Hyderabad', '6.5', '20.0', 'tabu@example.com'],
  ['Nawazuddin Siddiqui', '919820666777', 'Mumbai', '7', '22.0', 'nawaz@example.com']
];
const wsExcel = XLSX.utils.aoa_to_sheet(excelData);
const wbExcel = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbExcel, wsExcel, 'Applicants');
XLSX.writeFile(wbExcel, path.join(outDir, 'excel_saved_candidates.xlsx'), { bookType: 'xlsx' });
console.log('Created: excel_saved_candidates.xlsx (Excel standard .xlsx)');

// 4. File simulating Google Sheets export (.xlsx with sheet name "Sheet1" and standard XML structure)
const gsheetsData = [
  ['Candidate Name', 'Contact', 'Email', 'Location', 'Experience (Yrs)', 'Current CTC'],
  ['Vikrant Massey', '9820777888', 'vikrant@example.com', 'Mumbai', '5', '1500000'],
  ['Radhika Apte', '9820888999', 'radhika@example.com', 'Pune', '6', '1800000'],
  ['Pankaj Tripathi', '9820999000', 'pankaj@example.com', 'Patna', '10', '2500000']
];
const wsGSheets = XLSX.utils.aoa_to_sheet(gsheetsData);
const wbGSheets = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbGSheets, wsGSheets, 'Sheet1');
XLSX.writeFile(wbGSheets, path.join(outDir, 'google_sheets_export.xlsx'), { bookType: 'xlsx' });
console.log('Created: google_sheets_export.xlsx (Google Sheets exported .xlsx)');

// 5. Empty file (0 bytes)
fs.writeFileSync(path.join(outDir, 'empty_file.xlsx'), Buffer.alloc(0));
console.log('Created: empty_file.xlsx (0 bytes)');

// 6. Non-Excel file renamed to .xlsx (plain text file)
fs.writeFileSync(path.join(outDir, 'fake_renamed.xlsx'), 'This is a text file that was renamed to .xlsx to test error handling.\n');
console.log('Created: fake_renamed.xlsx (text file renamed to .xlsx)');

console.log('\nAll test files successfully created in test_data/additional_formats/');

