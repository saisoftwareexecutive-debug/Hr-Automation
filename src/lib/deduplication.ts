import { normalizeIndianPhone } from './phone';
import { Application, Candidate, ImportCandidateRow, ImportResult, Job } from '@/types';
import { generateUUID, generateSecureToken } from './id';

export interface ProcessedImportRow {
  rowNumber: number;
  candidateData: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;
  isValid: boolean;
  isDuplicateInFile: boolean;
  isDuplicateInJob: boolean;
  isExistingAcrossJobs: boolean;
  existingCandidateId?: string;
  error?: string;
}

/**
 * Trims strings, removes UTF-8 BOM, removes excessive spaces, normalizes cases
 */
export function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Generates a secure, unguessable 32-character token for the public screening form
 */
export function generateFormToken(): string {
  return generateSecureToken(16);
}

/**
 * Deduplicates and cleans bulk rows against existing candidates and applications
 */
export function processCandidateImport(
  rawRows: Record<string, any>[],
  columnMapping: {
    fullName: string;
    phone: string;
    email?: string;
    city?: string;
    experienceMonths?: string;
    currentSalary?: string;
  },
  currentJob: Job,
  existingCandidates: Candidate[],
  existingApplications: Application[]
): ImportResult {
  const processed: ProcessedImportRow[] = [];
  const phoneSeenInCurrentFile = new Set<string>();
  const errorRows: { rowNumber: number; reason: string; data: any }[] = [];

  // Index existing candidates and applications by normalized phone
  const candidateByPhone = new Map<string, Candidate>();
  for (const c of existingCandidates) {
    candidateByPhone.set(c.phone, c);
  }

  const jobApplicationsByPhone = new Map<string, Application>();
  for (const app of existingApplications) {
    if (app.job_id === currentJob.id && app.candidate?.phone) {
      jobApplicationsByPhone.set(app.candidate.phone, app);
    }
  }

  let validCount = 0;
  let duplicateCount = 0;
  let invalidNumbersCount = 0;

  const newApplicationsToCreate: Application[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Excel row index accounting for header
    const rawName = cleanText(row[columnMapping.fullName]);
    const rawPhone = row[columnMapping.phone];
    const rawEmail = columnMapping.email ? cleanText(row[columnMapping.email]) : undefined;
    const rawCity = columnMapping.city ? cleanText(row[columnMapping.city]) : undefined;
    const rawExp = columnMapping.experienceMonths ? Number(row[columnMapping.experienceMonths]) || 0 : 0;
    const rawSalary = columnMapping.currentSalary ? Number(row[columnMapping.currentSalary]) || undefined : undefined;

    if (!rawName) {
      errorRows.push({
        rowNumber,
        reason: 'Missing candidate name',
        data: row,
      });
      return;
    }

    // Phone validation and normalisation
    const phoneResult = normalizeIndianPhone(rawPhone);
    if (!phoneResult.isValid || !phoneResult.normalized) {
      invalidNumbersCount++;
      errorRows.push({
        rowNumber,
        reason: phoneResult.error || 'Invalid Indian phone number',
        data: row,
      });
      return;
    }

    const normalizedPhone = phoneResult.normalized;

    // Check duplicate within the same uploaded file
    if (phoneSeenInCurrentFile.has(normalizedPhone)) {
      duplicateCount++;
      errorRows.push({
        rowNumber,
        reason: `Duplicate row in this file for phone ${normalizedPhone}`,
        data: row,
      });
      return;
    }
    phoneSeenInCurrentFile.add(normalizedPhone);

    // Check duplicate within this exact job
    const existingJobApp = jobApplicationsByPhone.get(normalizedPhone);
    if (existingJobApp) {
      duplicateCount++;
      errorRows.push({
        rowNumber,
        reason: `Candidate with phone ${normalizedPhone} has already applied to this job (Status: ${existingJobApp.status})`,
        data: row,
      });
      return;
    }

    // Check if candidate exists in other jobs (cross-job candidate history)
    const existingCandidate = candidateByPhone.get(normalizedPhone);
    const candidateId = existingCandidate ? existingCandidate.id : `cand_${generateUUID()}`;
    const isCrossJob = !!existingCandidate;

    const candidateData: Candidate = existingCandidate
      ? {
          ...existingCandidate,
          full_name: rawName || existingCandidate.full_name,
          city: rawCity || existingCandidate.city,
          updated_at: new Date().toISOString(),
        }
      : {
          id: candidateId,
          full_name: rawName,
          phone: normalizedPhone,
          email: rawEmail || null,
          city: rawCity || null,
          total_experience_months: rawExp,
          current_salary: rawSalary || null,
          source: 'workindia',
          created_at: new Date().toISOString(),
        };

    const token = generateFormToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiry

    const newApp: Application = {
      id: `app_${generateUUID()}`,
      candidate_id: candidateId,
      job_id: currentJob.id,
      status: 'new',
      score: 0,
      score_breakdown: {
        city_score: 0,
        exp_score: 0,
        skills_score: 0,
        salary_score: 0,
        notice_score: 0,
        shift_score: 0,
        notes: isCrossJob
          ? [`Candidate previously registered in system (cross-job history)`]
          : [],
      },
      token,
      token_expires_at: expiresAt,
      created_at: new Date().toISOString(),
      candidate: candidateData,
      job: currentJob,
    };

    newApplicationsToCreate.push(newApp);
    validCount++;
  });

  return {
    totalRows: rawRows.length,
    validRows: validCount,
    duplicateRows: duplicateCount,
    invalidNumbers: invalidNumbersCount,
    importedApplications: newApplicationsToCreate,
    errorRows,
  };
}

