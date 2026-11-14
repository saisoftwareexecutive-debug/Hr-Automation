import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import {
  analyzeWorkbook,
  parseAndCleanCandidateSheet,
  buildRejectedRowsWorkbook,
} from '../src/lib/excelParser.js';
import { getJobs, getCandidates } from '../src/lib/db/index.js';

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('====================================================');
  console.log('VERIFYING HARDENED EXCEL IMPORT (REQUIREMENT 10)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED: ' + err.message);
      failed++;
    }
  }

  const jobs = await getJobs();
  const sampleJob = jobs[0];
  const existingCandidates = [];
  const existingApplications = [];

  // 1. Test Sample_Job_Posting.xlsx
  await check('1. Sample_Job_Posting.xlsx: Detects 2 sheets and auto-selects "Applicants"', async () => {
    const filePath = path.join(process.cwd(), 'test_data', 'Sample_Job_Posting.xlsx');
    const wb = XLSX.readFile(filePath);
    const analysis = analyzeWorkbook(wb);

    if (analysis.sheetNames.length !== 2) throw new Error(`Expected 2 sheets, found ${analysis.sheetNames.length}`);
    if (analysis.recommendedSheet !== 'Applicants') {
      throw new Error(`Expected recommended sheet to be "Applicants", got "${analysis.recommendedSheet}"`);
    }
  });

  await check('2. Sample_Job_Posting.xlsx: "Job Posting" sheet triggers friendly wrong-sheet message', async () => {
    const filePath = path.join(process.cwd(), 'test_data', 'Sample_Job_Posting.xlsx');
    const wb = XLSX.readFile(filePath);
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets['Job Posting'], { header: 1, defval: '' });

    const result = parseAndCleanCandidateSheet(matrix, {}, 'Job Posting', sampleJob, existingCandidates, existingApplications);
    if (!result.isWrongSheetOrJobDescription) throw new Error('Expected isWrongSheetOrJobDescription to be true');
    if (!result.wrongSheetMessage.includes('looks like a job description')) {
      throw new Error('Missing friendly wrong-sheet message');
    }
    if (result.errorRows.length !== 0) throw new Error(`Expected 0 row errors, got ${result.errorRows.length}`);
  });

  let applicantsImported;
  await check('3. Sample_Job_Posting.xlsx: "Applicants" sheet imports exactly 5 candidates', async () => {
    const filePath = path.join(process.cwd(), 'test_data', 'Sample_Job_Posting.xlsx');
    const wb = XLSX.readFile(filePath);
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets['Applicants'], { header: 1, defval: '' });

    applicantsImported = parseAndCleanCandidateSheet(matrix, {}, 'Applicants', sampleJob, existingCandidates, existingApplications);
    if (applicantsImported.importedCount !== 5) {
      throw new Error(`Expected 5 candidates imported, got ${applicantsImported.importedCount}`);
    }
    if (applicantsImported.invalidNumbersCount !== 0) {
      throw new Error(`Expected 0 invalid numbers, got ${applicantsImported.invalidNumbersCount}`);
    }
    if (applicantsImported.ignoredCount < 5) {
      throw new Error(`Expected at least 5 ignored rows (summary + blank + note), got ${applicantsImported.ignoredCount}`);
    }

    const expectedNames = ['Rohan Mehta', 'Priya Nair', 'Aditya Kulkarni', 'Sneha Iyer', 'Vikram Singh'];
    const actualNames = applicantsImported.importedApplications.map(a => a.candidate.full_name);
    for (const name of expectedNames) {
      if (!actualNames.includes(name)) throw new Error(`Missing expected candidate: ${name}`);
    }

    // Verify phone normalization
    for (const app of applicantsImported.importedApplications) {
      if (!app.candidate.phone.startsWith('+9198200')) {
        throw new Error(`Phone not normalized: ${app.candidate.phone}`);
      }
    }
  });

  // 4. Test Candidates_clean_for_import.xlsx
  await check('4. Candidates_clean_for_import.xlsx: Imports exactly 5 candidates', async () => {
    const filePath = path.join(process.cwd(), 'test_data', 'Candidates_clean_for_import.xlsx');
    const wb = XLSX.readFile(filePath);
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets['Candidates'], { header: 1, defval: '' });

    const cleanResult = parseAndCleanCandidateSheet(matrix, {}, 'Candidates', sampleJob, existingCandidates, existingApplications);
    if (cleanResult.importedCount !== 5) {
      throw new Error(`Expected 5 candidates imported, got ${cleanResult.importedCount}`);
    }
    if (cleanResult.invalidNumbersCount !== 0) {
      throw new Error(`Expected 0 invalid numbers, got ${cleanResult.invalidNumbersCount}`);
    }
  });

  // 5. Test Rejected and Ignored Rows file builder
  await check('5. buildRejectedRowsWorkbook generates valid audit sheet', async () => {
    const wb = buildRejectedRowsWorkbook(applicantsImported.errorRows, applicantsImported.ignoredRows);
    if (!wb.SheetNames.includes('Rejected and Ignored Rows')) {
      throw new Error('Workbook missing "Rejected and Ignored Rows" sheet');
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Rejected and Ignored Rows']);
    if (rows.length < 5) throw new Error(`Expected at least 5 audit rows, got ${rows.length}`);
    const hasTotal = rows.some(r => r.Reason && r.Reason.includes('Total Applicants'));
    if (!hasTotal) throw new Error('Missing "Total Applicants" in audit reasons');
  });

  // 6. Test Web Import Page endpoint
  await check('6. Web Import UI serves pre-loaded Sample_Job_Posting.xlsx and Candidates_clean_for_import.xlsx', async () => {
    const res1 = await fetch(`${BASE_URL}/Sample_Job_Posting.xlsx`);
    if (res1.status !== 200) throw new Error(`Sample_Job_Posting.xlsx returned status ${res1.status}`);

    const res2 = await fetch(`${BASE_URL}/Candidates_clean_for_import.xlsx`);
    if (res2.status !== 200) throw new Error(`Candidates_clean_for_import.xlsx returned status ${res2.status}`);

    const pageRes = await fetch(`${BASE_URL}/import`);
    const html = await pageRes.text();
    if (!html.includes('Sample_Job_Posting.xlsx')) {
      throw new Error('Import page does not contain sample test buttons');
    }
  });

  console.log('\n====================================================');
  console.log(`HARDENED IMPORT VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

