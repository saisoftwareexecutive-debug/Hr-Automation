import * as XLSX from 'xlsx';
import { normalizeIndianPhone } from './phone';
import { Application, Candidate, Job } from '@/types';
import { generateUUID, generateSecureToken } from './id';

export interface SheetInfo {
  name: string;
  rowCount: number;
  candidateScore: number;
  headerRowIndex: number;
  detectedHeaders: string[];
  isLikelyCandidateList: boolean;
}

export interface WorkbookAnalysis {
  sheetNames: string[];
  sheets: SheetInfo[];
  recommendedSheet: string;
}

export interface ColumnMapping {
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  experienceMonths?: string;
  currentSalary?: string;
  designation?: string;
}

export interface IgnoredRowInfo {
  rowNumber: number;
  reason: string;
  data: Record<string, any>;
}

export interface ErrorRowInfo {
  rowNumber: number;
  reason: string;
  data: Record<string, any>;
}

export interface HardenedImportResult {
  sheetName: string;
  headerRowIndex: number;
  totalRowsInSheet: number;
  totalDataRowsRead: number;
  importedCount: number;
  duplicateCount: number;
  invalidNumbersCount: number;
  ignoredCount: number;
  isWrongSheetOrJobDescription: boolean;
  wrongSheetMessage?: string;
  importedApplications: Application[];
  errorRows: ErrorRowInfo[];
  ignoredRows: IgnoredRowInfo[];
  detectedMapping: ColumnMapping;
}

// Common summary words in HR spreadsheets (case-insensitive prefixes)
const SUMMARY_LABEL_REGEX = /^(total|average|avg|sum|count\b|shortlisted\s*\/\s*interview|note\b|notes\b|disclaimer|summary|grand\s*total|subtotal)/i;

/**
 * Trims text, removes UTF-8 BOM, and collapses whitespace
 */
export function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Auto-maps column names based on flexible keywords
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    fullName: '',
    phone: '',
    email: '',
    city: '',
    experienceMonths: '',
    currentSalary: '',
    designation: '',
  };

  headers.forEach((h) => {
    const lower = h.toLowerCase().trim();

    // Name match
    if (!mapping.fullName) {
      if (
        lower === 'applicant name' ||
        lower === 'candidate name' ||
        lower === 'candidate' ||
        lower === 'applicant' ||
        lower === 'full name' ||
        lower === 'name of candidate' ||
        lower === 'name of applicant' ||
        lower === 'name'
      ) {
        mapping.fullName = h;
      }
    }

    // Phone match
    if (!mapping.phone) {
      if (
        lower === 'phone' ||
        lower === 'mobile' ||
        lower === 'contact number' ||
        lower === 'phone number' ||
        lower === 'mobile number' ||
        lower === 'contact' ||
        lower === 'contact no' ||
        lower === 'phone no' ||
        lower === 'whatsapp' ||
        lower.includes('mobile') ||
        lower.includes('phone')
      ) {
        mapping.phone = h;
      }
    }

    // Email match
    if (!mapping.email) {
      if (
        lower === 'email' ||
        lower === 'email id' ||
        lower === 'email address' ||
        lower === 'e-mail' ||
        lower === 'mail' ||
        lower.includes('email')
      ) {
        mapping.email = h;
      }
    }

    // City / Location match
    if (!mapping.city) {
      if (
        lower === 'city' ||
        lower === 'location' ||
        lower === 'current city' ||
        lower === 'current location' ||
        lower === 'residence' ||
        lower.includes('city') ||
        lower.includes('location')
      ) {
        mapping.city = h;
      }
    }

    // Experience match
    if (!mapping.experienceMonths) {
      if (
        lower.includes('experience') ||
        lower.includes('exp')
      ) {
        mapping.experienceMonths = h;
      }
    }

    // Salary / CTC match
    if (!mapping.currentSalary) {
      if (
        lower.includes('ctc') ||
        lower.includes('salary')
      ) {
        mapping.currentSalary = h;
      }
    }

    // Designation match
    if (!mapping.designation) {
      if (
        lower.includes('designation') ||
        lower.includes('role') ||
        lower.includes('profile')
      ) {
        mapping.designation = h;
      }
    }
  });

  return mapping;
}

/**
 * Searches the first 15 rows of a sheet matrix to find the true header row
 */
export function findHeaderRow(matrix: any[][]): { headerRowIndex: number; headers: string[] } {
  let bestRowIndex = 0;
  let bestScore = -1;
  let bestHeaders: string[] = [];

  const maxScanRows = Math.min(15, matrix.length);

  for (let r = 0; r < maxScanRows; r++) {
    const row = matrix[r] || [];
    const nonBlankCells = row.map((c) => cleanText(c)).filter(Boolean);
    if (nonBlankCells.length === 0) continue;

    let rowScore = 0;
    nonBlankCells.forEach((cell) => {
      const lower = cell.toLowerCase();
      if (lower.includes('name')) rowScore += 10;
      if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) rowScore += 10;
      if (lower.includes('email') || lower.includes('mail')) rowScore += 5;
      if (lower.includes('exp')) rowScore += 4;
      if (lower.includes('salary') || lower.includes('ctc')) rowScore += 4;
      if (lower.includes('city') || lower.includes('location')) rowScore += 4;
      if (lower.includes('status')) rowScore += 3;
      if (lower.includes('date')) rowScore += 2;
    });

    if (rowScore > bestScore && nonBlankCells.length >= 2) {
      bestScore = rowScore;
      bestRowIndex = r;
      // Header row strings
      bestHeaders = row.map((c, i) => cleanText(c) || `Column_${i + 1}`);
    }
  }

  // Fallback if no candidate headers matched
  if (bestScore <= 0 && matrix.length > 0) {
    bestRowIndex = 0;
    bestHeaders = (matrix[0] || []).map((c, i) => cleanText(c) || `Column_${i + 1}`);
  }

  return { headerRowIndex: bestRowIndex, headers: bestHeaders };
}

/**
 * Inspects all sheets in a workbook and scores each to determine the candidate sheet
 */
export function analyzeWorkbook(workbook: XLSX.WorkBook): WorkbookAnalysis {
  const sheetNames = workbook.SheetNames;
  const sheets: SheetInfo[] = [];

  let bestSheetName = sheetNames[0];
  let highestScore = -100;

  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const rowCount = matrix.length;

    const { headerRowIndex, headers } = findHeaderRow(matrix);
    const mapping = detectColumnMapping(headers);

    let candidateScore = 0;
    if (mapping.fullName) candidateScore += 40;
    if (mapping.phone) candidateScore += 40;
    if (mapping.email) candidateScore += 10;
    if (mapping.experienceMonths) candidateScore += 10;
    if (mapping.currentSalary) candidateScore += 10;

    const nameLower = name.toLowerCase();
    if (nameLower.includes('applicant') || nameLower.includes('candidate') || nameLower.includes('resume')) {
      candidateScore += 25;
    }
    if (nameLower.includes('job') || nameLower.includes('posting') || nameLower.includes('jd') || nameLower.includes('description')) {
      candidateScore -= 30;
    }

    const isLikelyCandidateList = candidateScore >= 50;

    sheets.push({
      name,
      rowCount,
      candidateScore,
      headerRowIndex,
      detectedHeaders: headers,
      isLikelyCandidateList,
    });

    if (candidateScore > highestScore) {
      highestScore = candidateScore;
      bestSheetName = name;
    }
  }

  return {
    sheetNames,
    sheets,
    recommendedSheet: bestSheetName,
  };
}

/**
 * Checks whether a given row is a non-candidate row that should be ignored
 */
export function isNonCandidateRow(
  rowValues: any[],
  cellMap: Record<string, any>,
  fullNameVal: string,
  phoneVal: any
): { isIgnored: boolean; reason?: string } {
  // 1. Fully empty row
  const hasAnyContent = rowValues.some((v) => cleanText(v) !== '');
  if (!hasAnyContent) {
    return { isIgnored: true, reason: 'Empty blank row' };
  }

  const cleanName = cleanText(fullNameVal);
  const cleanPhone = cleanText(phoneVal);

  // 2. Both Name and Phone are missing
  if (!cleanName && !cleanPhone) {
    return { isIgnored: true, reason: 'Row has neither candidate name nor phone number' };
  }

  // 3. Formula check: cell starts with "=" or has formula
  for (const key in cellMap) {
    const val = cleanText(cellMap[key]);
    if (val.startsWith('=')) {
      return { isIgnored: true, reason: `Formula row: "${val}"` };
    }
  }

  // 4. Summary / Aggregation / Note labels
  const candidatesForSummary = [
    cleanName,
    ...rowValues.map((v) => cleanText(v)).filter((v) => v.length > 0).slice(0, 3),
  ];

  for (const text of candidatesForSummary) {
    if (SUMMARY_LABEL_REGEX.test(text)) {
      return { isIgnored: true, reason: `Summary or note row: "${text}"` };
    }
  }

  return { isIgnored: false };
}

/**
 * Core hardened candidate import function
 */
export function parseAndCleanCandidateSheet(
  matrix: any[][],
  sheetFormulaMap: Record<string, string>, // cell address -> formula
  sheetName: string,
  targetJob: Job,
  existingCandidates: Candidate[],
  existingApplications: Application[],
  customMapping?: ColumnMapping
): HardenedImportResult {
  const { headerRowIndex, headers } = findHeaderRow(matrix);
  const mapping = customMapping || detectColumnMapping(headers);

  // Check wrong-sheet / job description detection
  if (!mapping.phone && !mapping.fullName) {
    return {
      sheetName,
      headerRowIndex,
      totalRowsInSheet: matrix.length,
      totalDataRowsRead: 0,
      importedCount: 0,
      duplicateCount: 0,
      invalidNumbersCount: 0,
      ignoredCount: 0,
      isWrongSheetOrJobDescription: true,
      wrongSheetMessage: `This sheet ("${sheetName}") looks like a job description, not a candidate list. Try another sheet or check your file.`,
      importedApplications: [],
      errorRows: [],
      ignoredRows: [],
      detectedMapping: mapping,
    };
  }

  const dataRows = matrix.slice(headerRowIndex + 1);
  const phoneSeenInCurrentFile = new Set<string>();

  // Index existing candidates & applications by phone
  const candidateByPhone = new Map<string, Candidate>();
  existingCandidates.forEach((c) => candidateByPhone.set(c.phone, c));

  const jobApplicationsByPhone = new Map<string, Application>();
  existingApplications.forEach((app) => {
    if (app.job_id === targetJob.id && app.candidate?.phone) {
      jobApplicationsByPhone.set(app.candidate.phone, app);
    }
  });

  const importedApplications: Application[] = [];
  const errorRows: ErrorRowInfo[] = [];
  const ignoredRows: IgnoredRowInfo[] = [];
  let duplicateCount = 0;
  let invalidNumbersCount = 0;

  // Track how many rows had non-phone text labels to detect job descriptions
  let textLabelsInPhoneCount = 0;
  let evaluatedRowsCount = 0;

  dataRows.forEach((row, idx) => {
    const excelRowNumber = headerRowIndex + 2 + idx;
    evaluatedRowsCount++;

    // Map row cells to header keys
    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
    });

    const rawName = mapping.fullName ? rowObj[mapping.fullName] : '';
    const rawPhone = mapping.phone ? rowObj[mapping.phone] : '';
    const rawEmail = mapping.email ? rowObj[mapping.email] : '';
    const rawCity = mapping.city ? rowObj[mapping.city] : '';
    const rawExp = mapping.experienceMonths ? rowObj[mapping.experienceMonths] : '';
    const rawSalary = mapping.currentSalary ? rowObj[mapping.currentSalary] : '';

    // Check if this row is a non-candidate row to ignore
    const ignoreCheck = isNonCandidateRow(row, rowObj, rawName, rawPhone);
    if (ignoreCheck.isIgnored) {
      ignoredRows.push({
        rowNumber: excelRowNumber,
        reason: ignoreCheck.reason || 'Ignored non-candidate row',
        data: rowObj,
      });
      return;
    }

    const cleanName = cleanText(rawName);

    // Block candidate row if name is missing (Requirement C.3)
    if (!cleanName) {
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: 'Candidate name is missing. Row blocked from import.',
        data: rowObj,
      });
      return;
    }

    // Validate and clean phone
    const phoneResult = normalizeIndianPhone(rawPhone);

    if (!phoneResult.isValid || !phoneResult.normalized) {
      // Check if the phone value is a descriptive label like "Mumbai, Maharashtra, India" or "Hybrid"
      const phoneStr = cleanText(rawPhone);
      if (phoneStr.length > 15 || /[a-zA-Z]{3,}/.test(phoneStr)) {
        textLabelsInPhoneCount++;
      }

      invalidNumbersCount++;
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: phoneResult.error || 'Invalid Indian phone number',
        data: rowObj,
      });
      return;
    }

    const normalizedPhone = phoneResult.normalized;

    // Check duplicate in file
    if (phoneSeenInCurrentFile.has(normalizedPhone)) {
      duplicateCount++;
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: `Duplicate row in this file for phone ${normalizedPhone}`,
        data: rowObj,
      });
      return;
    }
    phoneSeenInCurrentFile.add(normalizedPhone);

    // Check duplicate in this job
    const existingJobApp = jobApplicationsByPhone.get(normalizedPhone);
    if (existingJobApp) {
      duplicateCount++;
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: `Candidate with phone ${normalizedPhone} has already applied to this job (Status: ${existingJobApp.status})`,
        data: rowObj,
      });
      return;
    }

    // Candidate deduplication across jobs
    const existingCandidate = candidateByPhone.get(normalizedPhone);
    const candidateId = existingCandidate ? existingCandidate.id : `cand_${generateUUID()}`;
    const isCrossJob = !!existingCandidate;

    const candidateData: Candidate = existingCandidate
      ? {
          ...existingCandidate,
          full_name: cleanName || existingCandidate.full_name,
          city: cleanText(rawCity) || existingCandidate.city,
          updated_at: new Date().toISOString(),
        }
      : {
          id: candidateId,
          full_name: cleanName,
          phone: normalizedPhone,
          email: cleanText(rawEmail) || null,
          city: cleanText(rawCity) || null,
          total_experience_months: Number(rawExp) ? Math.round(Number(rawExp) * 12) : 0,
          current_salary: Number(rawSalary) || null,
          source: 'workindia',
          created_at: new Date().toISOString(),
        };

    const token = generateSecureToken(16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newApp: Application = {
      id: `app_${generateUUID()}`,
      candidate_id: candidateId,
      job_id: targetJob.id,
      status: 'new',
      score: 0,
      score_breakdown: {
        city_score: 0,
        exp_score: 0,
        skills_score: 0,
        salary_score: 0,
        notice_score: 0,
        shift_score: 0,
        notes: isCrossJob ? ['Candidate previously registered in system (cross-job history)'] : [],
      },
      token,
      token_expires_at: expiresAt,
      created_at: new Date().toISOString(),
      candidate: candidateData,
      job: targetJob,
    };

    importedApplications.push(newApp);
  });

  // Check if almost all rows evaluated were text labels in phone column (e.g. Job Posting sheet)
  const isWrongSheet =
    evaluatedRowsCount > 3 &&
    importedApplications.length === 0 &&
    textLabelsInPhoneCount / evaluatedRowsCount >= 0.5;

  if (isWrongSheet) {
    return {
      sheetName,
      headerRowIndex,
      totalRowsInSheet: matrix.length,
      totalDataRowsRead: evaluatedRowsCount,
      importedCount: 0,
      duplicateCount: 0,
      invalidNumbersCount: 0,
      ignoredCount: 0,
      isWrongSheetOrJobDescription: true,
      wrongSheetMessage: `This sheet ("${sheetName}") looks like a job description, not a candidate list. Try another sheet or check your file.`,
      importedApplications: [],
      errorRows: [],
      ignoredRows: [],
      detectedMapping: mapping,
    };
  }

  return {
    sheetName,
    headerRowIndex,
    totalRowsInSheet: matrix.length,
    totalDataRowsRead: evaluatedRowsCount,
    importedCount: importedApplications.length,
    duplicateCount,
    invalidNumbersCount,
    ignoredCount: ignoredRows.length,
    isWrongSheetOrJobDescription: false,
    importedApplications,
    errorRows,
    ignoredRows,
    detectedMapping: mapping,
  };
}

/**
 * Builds an Excel file (.xlsx) or CSV containing all rejected/skipped and ignored rows
 */
export function buildRejectedRowsWorkbook(
  errorRows: ErrorRowInfo[],
  ignoredRows: IgnoredRowInfo[]
): XLSX.WorkBook {
  const rejectedData = [
    ...errorRows.map((e) => ({
      'Row Number': e.rowNumber,
      'Category': 'REJECTED_INVALID_DATA',
      'Reason': e.reason,
      ...e.data,
    })),
    ...ignoredRows.map((i) => ({
      'Row Number': i.rowNumber,
      'Category': 'IGNORED_NON_CANDIDATE',
      'Reason': i.reason,
      ...i.data,
    })),
  ];

  const ws = XLSX.utils.json_to_sheet(rejectedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rejected and Ignored Rows');
  return wb;
}

/**
 * Validates file signature / magic bytes before parsing to detect empty files,
 * corrupted files, and non-Excel files renamed to .xlsx / .xls.
 */
export function validateSpreadsheetBuffer(
  buffer: ArrayBuffer,
  fileName: string
): { isValid: boolean; error?: string } {
  if (!buffer || buffer.byteLength === 0) {
    return {
      isValid: false,
      error: 'The selected file is empty (0 bytes). Please upload a valid Excel or CSV file.',
    };
  }

  const lower = fileName.toLowerCase();
  const bytes = new Uint8Array(buffer.slice(0, 4));

  if (lower.endsWith('.xlsx')) {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // 'PK'
    if (!isZip) {
      return {
        isValid: false,
        error: `The file "${fileName}" is not a valid Excel (.xlsx) file. It appears to be a plain text or other non-Excel file renamed to .xlsx.`,
      };
    }
  } else if (lower.endsWith('.xls')) {
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    const isXml = bytes[0] === 0x3c;
    if (!isOle && !isXml) {
      return {
        isValid: false,
        error: `The file "${fileName}" is not a valid Excel (.xls) file.`,
      };
    }
  }

  return { isValid: true };
}

