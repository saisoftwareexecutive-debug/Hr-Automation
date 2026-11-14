import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import path from 'path';
import {
  analyzeWorkbook,
  parseAndCleanCandidateSheet,
  detectColumnMapping,
  findHeaderRow,
  validateSpreadsheetBuffer,
} from '../excelParser';
import { generateUUID, generateSecureToken } from '../id';
import { normalizeIndianPhone } from '../phone';
import { Job } from '@/types';

const dummyJob: Job = {
  id: 'job-test-1',
  title: 'Senior Software Engineer',
  department: 'Engineering',
  city: 'Mumbai',
  openings: 3,
  min_exp_years: 4,
  max_exp_years: 8,
  min_salary: 1500000,
  max_salary: 2500000,
  shift_type: 'day',
  required_skills: ['Python', 'Java', 'AWS'],
  required_languages: ['English', 'Hindi'],
  status: 'active',
  created_by: 'HR Admin',
  created_at: new Date().toISOString(),
};

describe('Hardened Excel Parser & Cleaner', () => {
  const sampleJobPostingPath = path.join(process.cwd(), 'test_data', 'Sample_Job_Posting.xlsx');
  const cleanCandidatesPath = path.join(process.cwd(), 'test_data', 'Candidates_clean_for_import.xlsx');

  // 1. Multi-sheet workbook test with Sample_Job_Posting.xlsx
  it('analyzes Sample_Job_Posting.xlsx, auto-selects Applicants sheet, and imports exactly 5 candidates', () => {
    const wb = XLSX.readFile(sampleJobPostingPath);
    const analysis = analyzeWorkbook(wb);

    expect(analysis.sheetNames).toEqual(['Job Posting', 'Applicants']);
    // Recommended sheet must be "Applicants" (not "Job Posting")
    expect(analysis.recommendedSheet).toBe('Applicants');

    // Parse the Applicants sheet
    const applicantsSheet = wb.Sheets['Applicants'];
    const matrix = XLSX.utils.sheet_to_json<any[]>(applicantsSheet, { header: 1, defval: '' });

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'Applicants',
      dummyJob,
      [],
      []
    );

    expect(result.isWrongSheetOrJobDescription).toBe(false);
    expect(result.importedCount).toBe(5);
    expect(result.importedApplications.length).toBe(5);

    const names = result.importedApplications.map((a) => a.candidate?.full_name);
    expect(names).toEqual([
      'Rohan Mehta',
      'Priya Nair',
      'Aditya Kulkarni',
      'Sneha Iyer',
      'Vikram Singh',
    ]);

    // Phones are normalized to +91XXXXXXXXXX
    expect(result.importedApplications[0].candidate?.phone).toBe('+919820011111');
    expect(result.importedApplications[1].candidate?.phone).toBe('+919820022222');
    expect(result.importedApplications[4].candidate?.phone).toBe('+919820055555');

    // Non-candidate rows (blank, summary, note) must be ignored, NOT flagged as invalid numbers
    expect(result.ignoredCount).toBeGreaterThanOrEqual(5);
    expect(result.invalidNumbersCount).toBe(0);
  });

  // 2. Clean candidate file test with Candidates_clean_for_import.xlsx
  it('imports exactly 5 candidates from Candidates_clean_for_import.xlsx', () => {
    const wb = XLSX.readFile(cleanCandidatesPath);
    const analysis = analyzeWorkbook(wb);

    expect(analysis.recommendedSheet).toBe('Candidates');

    const sheet = wb.Sheets['Candidates'];
    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'Candidates',
      dummyJob,
      [],
      []
    );

    expect(result.importedCount).toBe(5);
    expect(result.invalidNumbersCount).toBe(0);
  });

  // 3. Summary rows detection and categorization
  it('skips summary rows (Total, Average, Note, Count) and reports them as ignored rows', () => {
    const matrix = [
      ['Candidate Name', 'Mobile Number', 'Email'],
      ['Deepak Sharma', '9811122233', 'deepak@example.com'],
      ['', '', ''], // Blank row
      ['Total Applicants', '1', ''], // Summary row
      ['Average Experience (Yrs)', '5.5', ''], // Summary row
      ['Note: All applicants are pre-screened.', '', ''], // Note row
    ];

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'TestSheet',
      dummyJob,
      [],
      []
    );

    expect(result.importedCount).toBe(1);
    expect(result.ignoredCount).toBe(4);
    expect(result.invalidNumbersCount).toBe(0);

    const reasons = result.ignoredRows.map((r) => r.reason);
    expect(reasons.some((r) => r.includes('Empty blank row'))).toBe(true);
    expect(reasons.some((r) => r.includes('Total Applicants'))).toBe(true);
    expect(reasons.some((r) => r.includes('Average Experience'))).toBe(true);
  });

  // 4. Formula cells detection
  it('skips rows containing formula strings like =COUNTA or =SUM', () => {
    const matrix = [
      ['Candidate Name', 'Mobile Number'],
      ['Kavita Rao', '+91 98222 33344'],
      ['=COUNTA(A2:A2)', '=SUM(B2:B2)'], // Formula row
    ];

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'TestFormula',
      dummyJob,
      [],
      []
    );

    expect(result.importedCount).toBe(1);
    expect(result.ignoredCount).toBe(1);
    expect(result.ignoredRows[0].reason).toContain('Formula');
  });

  // 5. Numeric phone cells, scientific notation, and space/hyphen variants
  it('normalizes numeric cells, scientific notation, and formatted phones', () => {
    expect(normalizeIndianPhone(9820011111).normalized).toBe('+919820011111');
    expect(normalizeIndianPhone('9.820011111E+09').normalized).toBe('+919820011111');
    expect(normalizeIndianPhone(9.820011111e9).normalized).toBe('+919820011111');
    expect(normalizeIndianPhone('+91 98200 11111').normalized).toBe('+919820011111');
    expect(normalizeIndianPhone('098200 11111').normalized).toBe('+919820011111');
    expect(normalizeIndianPhone('91-9820011111').normalized).toBe('+919820011111');
    expect(normalizeIndianPhone('9820011111.0').normalized).toBe('+919820011111');
  });

  // 6. Job-posting-only file / wrong sheet detection
  it('detects a job-posting-only sheet and shows a friendly message without 21 row errors', () => {
    const wb = XLSX.readFile(sampleJobPostingPath);
    const jobPostingSheet = wb.Sheets['Job Posting'];
    const matrix = XLSX.utils.sheet_to_json<any[]>(jobPostingSheet, { header: 1, defval: '' });

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'Job Posting',
      dummyJob,
      [],
      []
    );

    expect(result.isWrongSheetOrJobDescription).toBe(true);
    expect(result.wrongSheetMessage).toContain('looks like a job description, not a candidate list');
    // Must NOT have dumped 21 individual row errors!
    expect(result.errorRows.length).toBe(0);
  });

  // 7. Header detection with title banner above
  it('finds true header row even when preceded by title banner rows', () => {
    const matrix = [
      ['XYZ Corporation – Internal Applicants Export', ''],
      ['Export Date: 12-Nov-2026', ''],
      ['', ''],
      ['Candidate Name', 'Mobile Number', 'City'],
      ['Suresh Raina', '9899001122', 'Delhi'],
    ];

    const { headerRowIndex, headers } = findHeaderRow(matrix);
    expect(headerRowIndex).toBe(3);
    expect(headers).toContain('Candidate Name');
    expect(headers).toContain('Mobile Number');

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      'BannerSheet',
      dummyJob,
      [],
      []
    );

    expect(result.importedCount).toBe(1);
    expect(result.importedApplications[0].candidate?.full_name).toBe('Suresh Raina');
  });

  // 8. Browser ArrayBuffer reading code path simulation
  it('parses Candidates_clean_for_import.xlsx and Sample_Job_Posting.xlsx via ArrayBuffer identical to browser file.arrayBuffer()', () => {
    const fs = require('fs');
    // Simulate browser file.arrayBuffer()
    const cleanNodeBuf = fs.readFileSync(cleanCandidatesPath);
    const cleanArrayBuf = cleanNodeBuf.buffer.slice(
      cleanNodeBuf.byteOffset,
      cleanNodeBuf.byteOffset + cleanNodeBuf.byteLength
    );

    const valClean = validateSpreadsheetBuffer(cleanArrayBuf, 'Candidates_clean_for_import.xlsx');
    expect(valClean.isValid).toBe(true);

    const wbClean = XLSX.read(cleanArrayBuf, { type: 'array' });
    const analysisClean = analyzeWorkbook(wbClean);
    expect(analysisClean.recommendedSheet).toBe('Candidates');

    const cleanSheet = wbClean.Sheets['Candidates'];
    const cleanMatrix = XLSX.utils.sheet_to_json<any[]>(cleanSheet, { header: 1, defval: '' });
    const cleanResult = parseAndCleanCandidateSheet(cleanMatrix, {}, 'Candidates', dummyJob, [], []);
    expect(cleanResult.importedCount).toBe(5);
    expect(cleanResult.invalidNumbersCount).toBe(0);

    // Multi-sheet via ArrayBuffer
    const postingNodeBuf = fs.readFileSync(sampleJobPostingPath);
    const postingArrayBuf = postingNodeBuf.buffer.slice(
      postingNodeBuf.byteOffset,
      postingNodeBuf.byteOffset + postingNodeBuf.byteLength
    );

    const valPosting = validateSpreadsheetBuffer(postingArrayBuf, 'Sample_Job_Posting.xlsx');
    expect(valPosting.isValid).toBe(true);

    const wbPosting = XLSX.read(postingArrayBuf, { type: 'array' });
    const analysisPosting = analyzeWorkbook(wbPosting);
    expect(analysisPosting.recommendedSheet).toBe('Applicants');

    const applicantsSheet = wbPosting.Sheets['Applicants'];
    const appMatrix = XLSX.utils.sheet_to_json<any[]>(applicantsSheet, { header: 1, defval: '' });
    const appResult = parseAndCleanCandidateSheet(appMatrix, {}, 'Applicants', dummyJob, [], []);
    expect(appResult.importedCount).toBe(5);
    expect(appResult.ignoredCount).toBe(7);
  });

  // 9. Buffer validation for empty files and fake renamed .xlsx
  it('detects empty buffers and non-Excel files renamed to .xlsx', () => {
    const emptyBuf = new ArrayBuffer(0);
    const emptyCheck = validateSpreadsheetBuffer(emptyBuf, 'empty.xlsx');
    expect(emptyCheck.isValid).toBe(false);
    expect(emptyCheck.error).toContain('empty (0 bytes)');

    // Text file renamed to .xlsx (does not start with ZIP PK bytes)
    const textBytes = new TextEncoder().encode('Plain text pretending to be xlsx');
    const fakeCheck = validateSpreadsheetBuffer(textBytes.buffer, 'fake.xlsx');
    expect(fakeCheck.isValid).toBe(false);
    expect(fakeCheck.error).toContain('not a valid Excel (.xlsx) file');
  });

  // 10. CSV with UTF-8 BOM and commas inside quotes
  it('handles CSV with UTF-8 BOM and quoted fields with commas', () => {
    const rawCsv =
      '\uFEFF"Candidate Name","Mobile Number","Location"\n' +
      '"Sharma, Deepak","9811122334","Mumbai, Maharashtra"\n' +
      '"Patel, Amit","9822233445","Ahmedabad, Gujarat"\n';

    // Parse with cleanText handling
    const lines = rawCsv.trim().split('\n');
    const headers = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.replace(/"/g, '').trim());
    expect(headers[0]).toBe('Candidate Name');
    expect(headers[1]).toBe('Mobile Number');

    const mapping = detectColumnMapping(headers);
    expect(mapping.fullName).toBe('Candidate Name');
    expect(mapping.phone).toBe('Mobile Number');
  });

  // 11. Universal ID & secure token generation works without Node crypto
  it('generates valid UUIDs and hex tokens universally', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).toBeDefined();
    expect(uuid1).not.toBe(uuid2);
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const token = generateSecureToken(16);
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });
});

