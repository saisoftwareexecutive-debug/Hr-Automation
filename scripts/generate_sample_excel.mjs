import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const candidates = [
  {
    'Candidate Name': 'Manoj Kumar Sharma',
    'Mobile Number': '9812345001',
    'Email': 'manoj.sharma@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 2.5,
    'Current Salary (Monthly)': 24000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '10-Nov-2026',
  },
  {
    'Candidate Name': 'Deepika Ramesh Rao',
    'Mobile Number': '+91 98123 45002',
    'Email': 'deepika.rao@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 1.0,
    'Current Salary (Monthly)': 21000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '10-Nov-2026',
  },
  {
    'Candidate Name': 'Sunil V. Nair',
    'Mobile Number': '09812345003',
    'Email': 'sunil.nair@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 3.0,
    'Current Salary (Monthly)': 28000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '11-Nov-2026',
  },
  {
    'Candidate Name': 'Aarti Santosh Jadhav',
    'Mobile Number': '+91-98123-45004',
    'Email': 'aarti.jadhav@example.com',
    'Current City': 'Mysuru',
    'Total Experience (Years)': 0.5,
    'Current Salary (Monthly)': 18000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '11-Nov-2026',
  },
  {
    'Candidate Name': 'Vinay Kumar Tiwari',
    'Mobile Number': '9812345005',
    'Email': 'vinay.tiwari@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 4.0,
    'Current Salary (Monthly)': 30000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '11-Nov-2026',
  },
  {
    'Candidate Name': 'Duplicate In File Test',
    'Mobile Number': '9812345001', // Exact duplicate of row 1
    'Email': 'manoj.duplicate@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 2.5,
    'Current Salary (Monthly)': 24000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '11-Nov-2026',
  },
  {
    'Candidate Name': 'Bad Phone Candidate',
    'Mobile Number': '12345', // Invalid phone
    'Email': 'bad.phone@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 1.0,
    'Current Salary (Monthly)': 20000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '11-Nov-2026',
  },
  {
    'Candidate Name': 'Cross Job Candidate (Amit Kumar Verma)',
    'Mobile Number': '+919876500001', // Exists from seed!
    'Email': 'amit.verma@example.com',
    'Current City': 'Bengaluru',
    'Total Experience (Years)': 2.0,
    'Current Salary (Monthly)': 25000,
    'Job Profile Applied': 'Customer Support Executive',
    'Application Date': '12-Nov-2026',
  },
];

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write Excel (.xlsx)
const worksheet = XLSX.utils.json_to_sheet(candidates);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'WorkIndia Applicants');
const xlsxPath = path.join(publicDir, 'sample_workindia_export.xlsx');
XLSX.writeFile(workbook, xlsxPath);

// Write CSV
const csv = XLSX.utils.sheet_to_csv(worksheet);
const csvPath = path.join(publicDir, 'sample_workindia_export.csv');
fs.writeFileSync(csvPath, csv, 'utf-8');

console.log('Generated sample Excel & CSV files successfully in public/');

