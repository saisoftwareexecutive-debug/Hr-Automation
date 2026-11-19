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
  altPhone?: string;
  email?: string;
  city?: string;
  experienceMonths?: string;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  qualification?: string;
  skills?: string;
  designation?: string;
  jobTitle?: string;
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

export interface JobGroupMatch {
  excelText: string;
  rowCount: number;
  matchedJobId: string | null; // job id, '__skip__', or null
  matchedJobTitle: string | null;
  isAutoMatched: boolean;
  confidence: number;
  method: 'exact' | 'normalized' | 'token_overlap' | 'manual' | 'none';
}

export type CandidateRowResultType =
  | 'new_candidate'
  | 'existing_candidate_new_app'
  | 'already_applied'
  | 'duplicate_in_file'
  | 'invalid_phone'
  | 'missing_name'
  | 'job_skipped'
  | 'job_unmatched';

export interface CandidateRowPreview {
  rowNumber: number;
  name: string;
  rawName: string;
  phone: string;
  rawPhone: string;
  isValidPhone: boolean;
  phoneError?: string;
  city: string;
  rawExperience: string;
  parsedExperienceYears: number | null;
  experienceDisplay: string;
  isExperienceValid: boolean;
  rawSalary: string;
  parsedSalaryMonthly: number | null;
  salaryDisplay: string;
  rawExpectedSalary?: string;
  parsedExpectedSalaryMonthly?: number | null;
  expectedSalaryDisplay?: string;
  rawJobText: string;
  targetJobId: string | null;
  targetJobTitle: string;
  resultType: CandidateRowResultType;
  resultBadgeText: string;
  resultBadgeColor: 'emerald' | 'blue' | 'amber' | 'rose' | 'muted';
  applicationToken?: string;
  formLink?: string;
  isImportable: boolean;
  applicationPayload?: Application;
}

export interface HardenedImportResult {
  sheetName: string;
  headerRowIndex: number;
  totalRowsInSheet: number;
  totalDataRowsRead: number;
  importedCount: number;
  newCandidatesCount: number;
  newApplicationsCount: number;
  alreadyAppliedCount: number;
  duplicateInFileCount: number;
  invalidNumbersCount: number;
  ignoredCount: number;
  isWrongSheetOrJobDescription: boolean;
  wrongSheetMessage?: string;
  ignoredFairHiringColumns: string[];
  jobMode: 'all_one_job' | 'read_from_excel';
  jobColumnDetected: boolean;
  jobGroups: JobGroupMatch[];
  rowPreviews: CandidateRowPreview[];
  importedApplications: Application[];
  errorRows: ErrorRowInfo[];
  ignoredRows: IgnoredRowInfo[];
  detectedMapping: ColumnMapping;
  summaryText: string;
  perJobCounts: Record<string, number>;
}

// Common summary words in HR spreadsheets (case-insensitive prefixes)
const SUMMARY_LABEL_REGEX = /^(total|average|avg|sum|count\b|shortlisted\s*\/\s*interview|note\b|notes\b|disclaimer|summary|grand\s*total|subtotal)/i;

// Noise words in job titles
const NOISE_WORDS = new Set([
  'required', 'requires', 'vacancy', 'vacancies', 'opening', 'openings',
  'for', 'urgent', 'urgently', 'hiring', 'job', 'jobs', 'profile', 'role',
  'position', 'need', 'needed', 'wanted', 'requirement', 'requirements'
]);

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
 * Parse Experience into decimal years.
 * Formats: "0", "Fresher", "Fresher / No experience", "1 Year", "2 yrs",
 * "2 Years 3 Months", "2.5", "0-1 Year", "6 Months", "5+ years", etc.
 * 0 means Fresher only.
 */
export function parseExperience(val: any): {
  years: number | null;
  isFresher: boolean;
  rawText: string;
  isValid: boolean;
  display: string;
} {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { years: null, isFresher: false, rawText: '', isValid: true, display: '—' };
  }

  const rawText = cleanText(val);
  const lower = rawText.toLowerCase().replace(/,/g, ' ').trim();

  // 1. Fresher / No experience / 0
  if (
    lower === '0' ||
    lower === '0.0' ||
    lower === '0 yrs' ||
    lower === '0 yr' ||
    lower === '0 years' ||
    lower === '0 year' ||
    lower.includes('fresher') ||
    lower.includes('no experience') ||
    lower === 'none' ||
    lower === 'nil' ||
    lower === 'na' ||
    lower === 'n/a'
  ) {
    return { years: 0, isFresher: true, rawText, isValid: true, display: '0 yrs (Fresher)' };
  }

  // 2. Years and Months: e.g. "2 Years 3 Months", "2 yr 6 mo", "1y 4m"
  const yrMoMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:months?|mon?|mos?|m)/);
  if (yrMoMatch) {
    const yrs = parseFloat(yrMoMatch[1]);
    const mos = parseFloat(yrMoMatch[2]);
    const total = Math.round((yrs + mos / 12) * 100) / 100;
    return { years: total, isFresher: false, rawText, isValid: true, display: `${total} yrs` };
  }

  // 3. Only Months: e.g. "6 Months", "6 months", "18 mos", "6m"
  const onlyMoMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:months?|mon?|mos?|m)$/);
  if (onlyMoMatch) {
    const mos = parseFloat(onlyMoMatch[1]);
    const total = Math.round((mos / 12) * 100) / 100;
    return { years: total, isFresher: false, rawText, isValid: true, display: `${total} yrs` };
  }

  // 4. Ranges: e.g. "0-1 Year", "1-2 Years", "2 to 3 yrs"
  const rangeMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y|months?|mos?)?/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const isMonths = lower.includes('month') || lower.includes('mo');
    let avg = (low + high) / 2;
    if (isMonths) avg = avg / 12;
    const total = Math.round(avg * 100) / 100;
    return { years: total, isFresher: false, rawText, isValid: true, display: `${total} yrs` };
  }

  // 5. Single number with optional + and years: e.g. "5+ years", "2 yrs", "2.5", "1 Year"
  const singleMatch = lower.match(/^(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?|y)?$/);
  if (singleMatch) {
    const total = parseFloat(singleMatch[1]);
    if (!isNaN(total)) {
      return { years: total, isFresher: total === 0, rawText, isValid: true, display: `${total} yrs` };
    }
  }

  // 6. Generic digits match anywhere if followed by years
  const genericYr = lower.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/);
  if (genericYr) {
    const total = parseFloat(genericYr[1]);
    if (!isNaN(total)) {
      return { years: total, isFresher: total === 0, rawText, isValid: true, display: `${total} yrs` };
    }
  }

  // If cannot parse:
  return { years: null, isFresher: false, rawText, isValid: false, display: `Unrecognized: "${rawText}"` };
}

/**
 * Parse Salary into monthly rupees.
 * Handles "10000", "10,000", "Rs 10000", "10k", "1.2 LPA", ranges, etc.
 */
export function parseSalary(val: any): {
  monthly: number | null;
  rawText: string;
  isValid: boolean;
  display: string;
} {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { monthly: null, rawText: '', isValid: true, display: '—' };
  }

  const rawText = cleanText(val);
  const lower = rawText.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr/g, '').trim();

  // 1. Check for LPA / Lakhs per annum: e.g. "1.2 LPA", "1.2L", "1.2 Lakh", "1.2-2.4 LPA"
  const lpaRange = lower.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b)/);
  if (lpaRange) {
    const minLpa = parseFloat(lpaRange[1]);
    const maxLpa = parseFloat(lpaRange[2]);
    const avgLpa = (minLpa + maxLpa) / 2;
    const monthly = Math.round((avgLpa * 100000) / 12);
    return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
  }

  const singleLpa = lower.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b)/);
  if (singleLpa) {
    const lpa = parseFloat(singleLpa[1]);
    const monthly = Math.round((lpa * 100000) / 12);
    return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
  }

  // 2. Check for "10k", "15k - 20k"
  const kRange = lower.match(/(\d+(?:\.\d+)?)\s*k\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*k/);
  if (kRange) {
    const minK = parseFloat(kRange[1]) * 1000;
    const maxK = parseFloat(kRange[2]) * 1000;
    const monthly = Math.round((minK + maxK) / 2);
    return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
  }

  const singleK = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (singleK) {
    const monthly = Math.round(parseFloat(singleK[1]) * 1000);
    return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
  }

  // 3. Number Range: "10000 - 15000"
  const numRange = lower.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (numRange) {
    const minNum = parseFloat(numRange[1]);
    const maxNum = parseFloat(numRange[2]);
    let avg = (minNum + maxNum) / 2;
    if (avg >= 80000 && !lower.includes('pm') && !lower.includes('month')) {
      avg = Math.round(avg / 12);
    }
    const monthly = Math.round(avg);
    return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
  }

  // 4. Pure integer or decimal: "10000", "12000 pm"
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    let num = parseFloat(numMatch[1]);
    if (num > 0) {
      if (num >= 80000 && !lower.includes('pm') && !lower.includes('month')) {
        num = Math.round(num / 12);
      }
      const monthly = Math.round(num);
      return { monthly, rawText, isValid: true, display: `₹${monthly.toLocaleString('en-IN')}/mo` };
    }
  }

  return { monthly: null, rawText, isValid: false, display: `Unrecognized: "${rawText}"` };
}

/**
 * Tokenize and normalize job strings for comparison
 */
function normalizeJobTokens(str: string): string[] {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !NOISE_WORDS.has(t));
}

/**
 * Match a raw Excel job string to an active Job definition.
 * Exact match first, then normalized string, then token overlap (>= 80%).
 * Never guesses silently.
 */
export function matchJobTitle(
  excelText: string,
  activeJobs: Job[]
): {
  matchedJob: Job | null;
  confidence: number;
  method: 'exact' | 'normalized' | 'token_overlap' | 'none';
} {
  if (!excelText || !excelText.trim() || activeJobs.length === 0) {
    return { matchedJob: null, confidence: 0, method: 'none' };
  }

  const cleanInput = excelText.trim();
  const lowerInput = cleanInput.toLowerCase();

  // 1. Exact match (case-insensitive)
  for (const job of activeJobs) {
    if (job.title.toLowerCase() === lowerInput) {
      return { matchedJob: job, confidence: 1.0, method: 'exact' };
    }
  }

  // 2. Normalized token match
  const inputTokens = normalizeJobTokens(cleanInput);
  const inputNorm = inputTokens.join(' ');

  for (const job of activeJobs) {
    const jobTokens = normalizeJobTokens(job.title);
    const jobNorm = jobTokens.join(' ');
    if (inputNorm === jobNorm && inputNorm.length > 0) {
      return { matchedJob: job, confidence: 0.99, method: 'normalized' };
    }
  }

  // 3. Substring with high token overlap
  for (const job of activeJobs) {
    const jobTokens = normalizeJobTokens(job.title);
    const jobNorm = jobTokens.join(' ');
    if (jobNorm.length > 0 && (inputNorm.includes(jobNorm) || jobNorm.includes(inputNorm))) {
      const setJob = new Set(jobTokens);
      const setInput = new Set(inputTokens);
      const intersection = inputTokens.filter((t) => setJob.has(t));
      const overlap = intersection.length / Math.max(setJob.size, setInput.size);
      if (
        overlap >= 0.8 ||
        (intersection.length >= 2 && intersection.length === Math.min(setJob.size, setInput.size))
      ) {
        return { matchedJob: job, confidence: Math.max(overlap, 0.85), method: 'token_overlap' };
      }
    }
  }

  // 4. Token Overlap >= 80% (or min-tokens overlap for multi-word acronyms like MCO)
  let bestJob: Job | null = null;
  let bestOverlap = 0;

  for (const job of activeJobs) {
    const jobTokens = normalizeJobTokens(job.title);
    if (jobTokens.length === 0) continue;
    const setJob = new Set(jobTokens);
    const setInput = new Set(inputTokens);

    let shared = 0;
    inputTokens.forEach((t) => {
      if (setJob.has(t)) shared++;
    });

    const minTokens = Math.min(setJob.size, setInput.size);
    const maxTokens = Math.max(setJob.size, setInput.size);
    const overlap = maxTokens > 0 ? shared / maxTokens : 0;
    const overlapMin = minTokens > 0 ? shared / minTokens : 0;

    if (overlap >= 0.8 || (overlapMin >= 0.8 && minTokens >= 2)) {
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestJob = job;
      }
    }
  }

  if (bestJob && bestOverlap >= 0.65) {
    return { matchedJob: bestJob, confidence: bestOverlap, method: 'token_overlap' };
  }

  return { matchedJob: null, confidence: 0, method: 'none' };
}

/**
 * Fair Hiring: Detect columns that should be strictly ignored.
 */
export function detectFairHiringColumns(headers: string[]): string[] {
  const fairHiringTerms = [
    'gender', 'sex', 'लिंग',
    'religion', 'धर्म',
    'caste', 'category', 'जाति',
    'marital', 'marital status', 'marital_status', 'वैवाहिक स्थिति',
    'age', 'dob', 'date of birth', 'birth date', 'birthdate', 'd.o.b', 'वय', 'उम्र', 'जन्म तारीख', 'जन्मतिथि',
    'photo', 'picture', 'image', 'avatar', 'फोटो'
  ];

  const ignored: string[] = [];
  headers.forEach((h) => {
    const lower = h.toLowerCase().trim();
    if (fairHiringTerms.some((term) => lower === term || lower.includes(term))) {
      ignored.push(h);
    }
  });

  return Array.from(new Set(ignored));
}

/**
 * Auto-maps column names based on flexible keywords
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    city: '',
    experienceMonths: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    qualification: '',
    skills: '',
    designation: '',
    jobTitle: '',
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
        lower === 'name' ||
        lower.includes('candidate name') ||
        lower.includes('applicant name')
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
    } else if (!mapping.altPhone && mapping.phone !== h) {
      if (
        lower.includes('alternate') ||
        lower.includes('alt') ||
        lower.includes('secondary') ||
        lower.includes('other phone')
      ) {
        mapping.altPhone = h;
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
      if (lower.includes('experience') || lower.includes('exp')) {
        mapping.experienceMonths = h;
      }
    }

    // Expected Salary match
    if (!mapping.expectedSalary && (lower.includes('expected') || lower.includes('exp ctc') || lower.includes('expected salary'))) {
      mapping.expectedSalary = h;
    }

    // Current Salary / CTC match
    if (!mapping.currentSalary && !lower.includes('expected')) {
      if (lower.includes('ctc') || lower.includes('salary') || lower.includes('current salary')) {
        mapping.currentSalary = h;
      }
    }

    // Notice Period match
    if (!mapping.noticePeriod && (lower.includes('notice') || lower.includes('joining'))) {
      mapping.noticePeriod = h;
    }

    // Qualification / Education match
    if (!mapping.qualification && (lower.includes('qualification') || lower.includes('education') || lower.includes('degree'))) {
      mapping.qualification = h;
    }

    // Skills match
    if (!mapping.skills && (lower.includes('skill') || lower.includes('technologies'))) {
      mapping.skills = h;
    }

    // Designation / Role match
    if (!mapping.designation && (lower.includes('designation') || lower.includes('last company') || lower.includes('current company'))) {
      mapping.designation = h;
    }

    // Job Title match (Job Title, Job, Position, Applied For, Applied Job, Designation, Profile, Role, Vacancy)
    if (!mapping.jobTitle) {
      if (
        lower === 'job title' ||
        lower === 'applied for' ||
        lower === 'applied job' ||
        lower === 'job profile applied' ||
        lower === 'job profile' ||
        lower === 'position' ||
        lower === 'vacancy' ||
        lower === 'job' ||
        lower === 'role' ||
        lower === 'profile' ||
        lower === 'designation' ||
        lower.includes('job profile') ||
        lower.includes('applied for') ||
        lower.includes('applied job')
      ) {
        mapping.jobTitle = h;
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
      if (lower.includes('job') || lower.includes('applied') || lower.includes('profile')) rowScore += 5;
      if (lower.includes('status')) rowScore += 3;
      if (lower.includes('date')) rowScore += 2;
    });

    if (rowScore > bestScore && nonBlankCells.length >= 2) {
      bestScore = rowScore;
      bestRowIndex = r;
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
    if (mapping.jobTitle) candidateScore += 10;

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
  const hasAnyContent = rowValues.some((v) => cleanText(v) !== '');
  if (!hasAnyContent) {
    return { isIgnored: true, reason: 'Empty blank row' };
  }

  const cleanName = cleanText(fullNameVal);
  const cleanPhone = cleanText(phoneVal);

  if (!cleanName && !cleanPhone) {
    return { isIgnored: true, reason: 'Row has neither candidate name nor phone number' };
  }

  // Formula check
  for (const key in cellMap) {
    const val = cleanText(cellMap[key]);
    if (val.startsWith('=')) {
      return { isIgnored: true, reason: `Formula row: "${val}"` };
    }
  }

  // Summary labels check
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

export interface ParseOptions {
  jobMode?: 'all_one_job' | 'read_from_excel';
  targetJob?: Job;
  activeJobs?: Job[];
  jobGroupOverrides?: Record<string, string>; // excelText -> jobId or '__skip__'
  customMapping?: ColumnMapping;
}

/**
 * Core hardened candidate import function with Multi-Job & Experience/Salary support
 */
export function parseAndCleanCandidateSheet(
  matrix: any[][],
  sheetFormulaMap: Record<string, string>,
  sheetName: string,
  targetJobOrOptions: Job | ParseOptions,
  existingCandidates: Candidate[],
  existingApplications: Application[],
  customMappingOverride?: ColumnMapping
): HardenedImportResult {
  let options: ParseOptions;
  if ('id' in targetJobOrOptions && 'title' in targetJobOrOptions) {
    options = {
      jobMode: 'all_one_job',
      targetJob: targetJobOrOptions as Job,
      activeJobs: [targetJobOrOptions as Job],
      customMapping: customMappingOverride,
    };
  } else {
    options = targetJobOrOptions as ParseOptions;
  }

  const jobMode = options.jobMode || 'all_one_job';
  const defaultTargetJob = options.targetJob;
  const activeJobs = options.activeJobs || (defaultTargetJob ? [defaultTargetJob] : []);
  const jobGroupOverrides = options.jobGroupOverrides || {};

  const { headerRowIndex, headers } = findHeaderRow(matrix);
  const hasCustom = Boolean(
    (options.customMapping && Object.values(options.customMapping).some(Boolean)) ||
    (customMappingOverride && Object.values(customMappingOverride).some(Boolean))
  );
  const mapping = hasCustom
    ? (options.customMapping || customMappingOverride!)
    : detectColumnMapping(headers);

  // Detect Fair-Hiring columns
  const ignoredFairHiringColumns = detectFairHiringColumns(headers);

  // Check wrong-sheet / job description detection
  if (!mapping.phone && !mapping.fullName) {
    return {
      sheetName,
      headerRowIndex,
      totalRowsInSheet: matrix.length,
      totalDataRowsRead: 0,
      importedCount: 0,
      newCandidatesCount: 0,
      newApplicationsCount: 0,
      alreadyAppliedCount: 0,
      duplicateInFileCount: 0,
      invalidNumbersCount: 0,
      ignoredCount: 0,
      isWrongSheetOrJobDescription: true,
      wrongSheetMessage: `This sheet ("${sheetName}") looks like a job description, not a candidate list. Try another sheet or check your file.`,
      ignoredFairHiringColumns,
      jobMode,
      jobColumnDetected: Boolean(mapping.jobTitle),
      jobGroups: [],
      rowPreviews: [],
      importedApplications: [],
      errorRows: [],
      ignoredRows: [],
      detectedMapping: mapping,
      summaryText: '0 rows imported',
      perJobCounts: {},
    };
  }

  const dataRows = matrix.slice(headerRowIndex + 1);
  const jobColumnDetected = Boolean(mapping.jobTitle);

  // First pass: if in read_from_excel mode (or job column detected), discover all distinct job strings
  const jobTextCounts = new Map<string, number>();
  if (jobColumnDetected) {
    dataRows.forEach((row) => {
      const rowObj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
      });
      const rawJob = cleanText(rowObj[mapping.jobTitle!]);
      if (rawJob) {
        jobTextCounts.set(rawJob, (jobTextCounts.get(rawJob) || 0) + 1);
      }
    });
  }

  // Build JobGroupMatch list
  const jobGroups: JobGroupMatch[] = [];
  jobTextCounts.forEach((count, text) => {
    const override = jobGroupOverrides[text];
    if (override !== undefined) {
      if (override === '__skip__') {
        jobGroups.push({
          excelText: text,
          rowCount: count,
          matchedJobId: '__skip__',
          matchedJobTitle: 'Skip these rows',
          isAutoMatched: false,
          confidence: 1.0,
          method: 'manual',
        });
      } else {
        const foundJob = activeJobs.find((j) => j.id === override);
        jobGroups.push({
          excelText: text,
          rowCount: count,
          matchedJobId: override,
          matchedJobTitle: foundJob ? foundJob.title : 'Chosen Job',
          isAutoMatched: false,
          confidence: 1.0,
          method: 'manual',
        });
      }
    } else {
      const match = matchJobTitle(text, activeJobs);
      jobGroups.push({
        excelText: text,
        rowCount: count,
        matchedJobId: match.matchedJob ? match.matchedJob.id : null,
        matchedJobTitle: match.matchedJob ? match.matchedJob.title : null,
        isAutoMatched: Boolean(match.matchedJob),
        confidence: match.confidence,
        method: match.method,
      });
    }
  });

  const jobGroupMap = new Map<string, JobGroupMatch>();
  jobGroups.forEach((g) => jobGroupMap.set(g.excelText, g));

  // Index existing candidates & applications by phone
  const candidateByPhone = new Map<string, Candidate>();
  existingCandidates.forEach((c) => candidateByPhone.set(c.phone, c));

  // Map of candidateId -> Set of existing job_ids
  const existingJobIdsByCandidateId = new Map<string, Set<string>>();
  existingApplications.forEach((app) => {
    if (!existingJobIdsByCandidateId.has(app.candidate_id)) {
      existingJobIdsByCandidateId.set(app.candidate_id, new Set());
    }
    existingJobIdsByCandidateId.get(app.candidate_id)!.add(app.job_id);
  });

  const phoneSeenInCurrentFile = new Set<string>();
  const importedApplications: Application[] = [];
  const rowPreviews: CandidateRowPreview[] = [];
  const errorRows: ErrorRowInfo[] = [];
  const ignoredRows: IgnoredRowInfo[] = [];

  let newCandidatesCount = 0;
  let newApplicationsCount = 0;
  let alreadyAppliedCount = 0;
  let duplicateInFileCount = 0;
  let invalidNumbersCount = 0;
  const perJobCounts: Record<string, number> = {};

  let textLabelsInPhoneCount = 0;
  let evaluatedRowsCount = 0;

  dataRows.forEach((row, idx) => {
    const excelRowNumber = headerRowIndex + 2 + idx;
    evaluatedRowsCount++;

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
    const rawExpectedSalary = mapping.expectedSalary ? rowObj[mapping.expectedSalary] : '';
    const rawJob = mapping.jobTitle ? cleanText(rowObj[mapping.jobTitle]) : '';

    // Ignore non-candidate rows
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
    const expResult = parseExperience(rawExp);
    const salResult = parseSalary(rawSalary);
    const expSalResult = parseSalary(rawExpectedSalary);

    // Determine target job for this row
    let rowTargetJob: Job | null = null;
    let jobResultStatus: 'ok' | 'skipped' | 'unmatched' = 'ok';

    if (jobMode === 'read_from_excel' && jobColumnDetected) {
      const groupMatch = jobGroupMap.get(rawJob);
      if (groupMatch) {
        if (groupMatch.matchedJobId === '__skip__') {
          jobResultStatus = 'skipped';
        } else if (groupMatch.matchedJobId) {
          rowTargetJob = activeJobs.find((j) => j.id === groupMatch.matchedJobId) || null;
        } else {
          jobResultStatus = 'unmatched';
        }
      } else {
        jobResultStatus = 'unmatched';
      }
    } else {
      rowTargetJob = defaultTargetJob || activeJobs[0] || null;
    }

    // Validate phone
    const phoneResult = normalizeIndianPhone(rawPhone);

    // 1. Missing Name
    if (!cleanName) {
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: 'Candidate name is missing',
        data: rowObj,
      });
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: '—',
        rawName,
        phone: cleanText(rawPhone),
        rawPhone: String(rawPhone || ''),
        isValidPhone: false,
        phoneError: 'Missing name',
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: rowTargetJob?.id || null,
        targetJobTitle: rowTargetJob?.title || (jobResultStatus === 'skipped' ? 'Skipped' : 'Unmatched'),
        resultType: 'missing_name',
        resultBadgeText: 'Missing Name',
        resultBadgeColor: 'rose',
        isImportable: false,
      });
      return;
    }

    // 2. Invalid Phone
    if (!phoneResult.isValid || !phoneResult.normalized) {
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
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: cleanName,
        rawName,
        phone: cleanText(rawPhone) || '—',
        rawPhone: String(rawPhone || ''),
        isValidPhone: false,
        phoneError: phoneResult.error || 'Invalid phone',
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: rowTargetJob?.id || null,
        targetJobTitle: rowTargetJob?.title || (jobResultStatus === 'skipped' ? 'Skipped' : 'Unmatched'),
        resultType: 'invalid_phone',
        resultBadgeText: 'Invalid Phone',
        resultBadgeColor: 'rose',
        isImportable: false,
      });
      return;
    }

    const normalizedPhone = phoneResult.normalized;

    // 3. Duplicate row in current file
    if (phoneSeenInCurrentFile.has(normalizedPhone)) {
      duplicateInFileCount++;
      errorRows.push({
        rowNumber: excelRowNumber,
        reason: `Duplicate row in this file for phone ${normalizedPhone}`,
        data: rowObj,
      });
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: cleanName,
        rawName,
        phone: normalizedPhone,
        rawPhone: String(rawPhone || ''),
        isValidPhone: true,
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: rowTargetJob?.id || null,
        targetJobTitle: rowTargetJob?.title || (jobResultStatus === 'skipped' ? 'Skipped' : 'Unmatched'),
        resultType: 'duplicate_in_file',
        resultBadgeText: 'Duplicate in File',
        resultBadgeColor: 'amber',
        isImportable: false,
      });
      return;
    }
    phoneSeenInCurrentFile.add(normalizedPhone);

    // 4. Job group skipped or unmatched
    if (jobResultStatus === 'skipped') {
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: cleanName,
        rawName,
        phone: normalizedPhone,
        rawPhone: String(rawPhone || ''),
        isValidPhone: true,
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: null,
        targetJobTitle: 'Skipped by choice',
        resultType: 'job_skipped',
        resultBadgeText: 'Job Skipped',
        resultBadgeColor: 'muted',
        isImportable: false,
      });
      return;
    }

    if (jobResultStatus === 'unmatched' || !rowTargetJob) {
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: cleanName,
        rawName,
        phone: normalizedPhone,
        rawPhone: String(rawPhone || ''),
        isValidPhone: true,
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: null,
        targetJobTitle: 'Choose a job',
        resultType: 'job_unmatched',
        resultBadgeText: 'Choose a job',
        resultBadgeColor: 'amber',
        isImportable: false,
      });
      return;
    }

    // 5. Existing Candidate & Application Check
    const existingCandidate = candidateByPhone.get(normalizedPhone);
    const candidateId = existingCandidate ? existingCandidate.id : `cand_${generateUUID()}`;
    const candidateJobs = existingCandidate ? existingJobIdsByCandidateId.get(candidateId) : null;
    const hasAlreadyAppliedForThisJob = candidateJobs ? candidateJobs.has(rowTargetJob.id) : false;

    if (hasAlreadyAppliedForThisJob) {
      alreadyAppliedCount++;
      rowPreviews.push({
        rowNumber: excelRowNumber,
        name: cleanName,
        rawName,
        phone: normalizedPhone,
        rawPhone: String(rawPhone || ''),
        isValidPhone: true,
        city: cleanText(rawCity) || '—',
        rawExperience: cleanText(rawExp),
        parsedExperienceYears: expResult.years,
        experienceDisplay: expResult.display,
        isExperienceValid: expResult.isValid,
        rawSalary: cleanText(rawSalary),
        parsedSalaryMonthly: salResult.monthly,
        salaryDisplay: salResult.display,
        rawExpectedSalary: cleanText(rawExpectedSalary),
        parsedExpectedSalaryMonthly: expSalResult.monthly,
        expectedSalaryDisplay: expSalResult.display,
        rawJobText: rawJob,
        targetJobId: rowTargetJob.id,
        targetJobTitle: rowTargetJob.title,
        resultType: 'already_applied',
        resultBadgeText: 'Already applied for this job',
        resultBadgeColor: 'amber',
        isImportable: false,
      });
      return;
    }

    // Determine result type
    const isCrossJob = Boolean(existingCandidate);
    const resultType: CandidateRowResultType = isCrossJob
      ? 'existing_candidate_new_app'
      : 'new_candidate';

    if (isCrossJob) {
      newApplicationsCount++;
    } else {
      newCandidatesCount++;
    }

    perJobCounts[rowTargetJob.title] = (perJobCounts[rowTargetJob.title] || 0) + 1;

    // Prepare Candidate entity
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
          total_experience_months: expResult.years !== null ? Math.round(expResult.years * 12) : 0,
          current_salary: salResult.monthly || null,
          source: 'workindia',
          created_at: new Date().toISOString(),
        };

    const token = generateSecureToken(16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newApp: Application = {
      id: `app_${generateUUID()}`,
      candidate_id: candidateId,
      job_id: rowTargetJob.id,
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
      job: rowTargetJob,
    };

    importedApplications.push(newApp);

    rowPreviews.push({
      rowNumber: excelRowNumber,
      name: cleanName,
      rawName,
      phone: normalizedPhone,
      rawPhone: String(rawPhone || ''),
      isValidPhone: true,
      city: cleanText(rawCity) || '—',
      rawExperience: cleanText(rawExp),
      parsedExperienceYears: expResult.years,
      experienceDisplay: expResult.display,
      isExperienceValid: expResult.isValid,
      rawSalary: cleanText(rawSalary),
      parsedSalaryMonthly: salResult.monthly,
      salaryDisplay: salResult.display,
      rawExpectedSalary: cleanText(rawExpectedSalary),
      parsedExpectedSalaryMonthly: expSalResult.monthly,
      expectedSalaryDisplay: expSalResult.display,
      rawJobText: rawJob,
      targetJobId: rowTargetJob.id,
      targetJobTitle: rowTargetJob.title,
      resultType,
      resultBadgeText: isCrossJob ? 'Existing candidate, new application' : 'New candidate',
      resultBadgeColor: isCrossJob ? 'blue' : 'emerald',
      applicationToken: token,
      formLink: `/apply/${token}`,
      isImportable: true,
      applicationPayload: newApp,
    });
  });

  // Check if almost all rows evaluated were text labels in phone column
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
      newCandidatesCount: 0,
      newApplicationsCount: 0,
      alreadyAppliedCount: 0,
      duplicateInFileCount: 0,
      invalidNumbersCount: 0,
      ignoredCount: 0,
      isWrongSheetOrJobDescription: true,
      wrongSheetMessage: `This sheet ("${sheetName}") looks like a job description, not a candidate list. Try another sheet or check your file.`,
      ignoredFairHiringColumns,
      jobMode,
      jobColumnDetected,
      jobGroups,
      rowPreviews: [],
      importedApplications: [],
      errorRows: [],
      ignoredRows: [],
      detectedMapping: mapping,
      summaryText: '0 rows imported',
      perJobCounts: {},
    };
  }

  const totalValidImports = importedApplications.length;
  const summaryParts: string[] = [];
  if (totalValidImports > 0) {
    summaryParts.push(`${totalValidImports} to import (${newCandidatesCount} new, ${newApplicationsCount} existing with new application)`);
  }
  if (alreadyAppliedCount > 0) {
    summaryParts.push(`${alreadyAppliedCount} already applied`);
  }
  if (duplicateInFileCount > 0) {
    summaryParts.push(`${duplicateInFileCount} duplicate in file`);
  }
  if (invalidNumbersCount > 0) {
    summaryParts.push(`${invalidNumbersCount} need attention`);
  }

  const summaryText = `${evaluatedRowsCount} rows: ${summaryParts.join(', ')}`;

  return {
    sheetName,
    headerRowIndex,
    totalRowsInSheet: matrix.length,
    totalDataRowsRead: evaluatedRowsCount,
    importedCount: totalValidImports,
    newCandidatesCount,
    newApplicationsCount,
    alreadyAppliedCount,
    duplicateInFileCount,
    invalidNumbersCount,
    ignoredCount: ignoredRows.length,
    isWrongSheetOrJobDescription: false,
    ignoredFairHiringColumns,
    jobMode,
    jobColumnDetected,
    jobGroups,
    rowPreviews,
    importedApplications,
    errorRows,
    ignoredRows,
    detectedMapping: mapping,
    summaryText,
    perJobCounts,
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
