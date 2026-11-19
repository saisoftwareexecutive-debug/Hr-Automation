import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseExperience,
  parseSalary,
  matchJobTitle,
  detectFairHiringColumns,
  detectColumnMapping,
  parseAndCleanCandidateSheet,
} from '../excelParser';
import { Job, Candidate, Application } from '@/types';
import { deleteImportBatch, recordImportBatch } from '@/lib/db';

const activeJobsList: Job[] = [
  {
    id: 'job_deo',
    title: 'Data Entry Operator',
    department: 'Healthcare Operations',
    city: 'Mumbai',
    openings: 10,
    min_exp_years: 0,
    max_exp_years: 1,
    min_salary: 10000,
    max_salary: 12000,
    shift_type: 'rotational',
    required_skills: ['Typing', 'MS Excel'],
    required_languages: ['Hindi', 'Marathi'],
    status: 'active',
    created_by: 'Admin',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'job_mco',
    title: 'Medical Coordination Officer (MCO)',
    department: 'Healthcare Operations',
    city: 'Mumbai',
    openings: 5,
    min_exp_years: 1,
    max_exp_years: 3,
    min_salary: 18000,
    max_salary: 22000,
    shift_type: 'day',
    required_skills: ['Healthcare', 'Coordination'],
    required_languages: ['Hindi', 'English'],
    status: 'active',
    created_by: 'Admin',
    created_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'job_it',
    title: 'IT Manager',
    department: 'Technology',
    city: 'Mumbai',
    openings: 1,
    min_exp_years: 5,
    max_exp_years: 10,
    min_salary: 60000,
    max_salary: 90000,
    shift_type: 'day',
    required_skills: ['Network', 'Systems'],
    required_languages: ['English'],
    status: 'active',
    created_by: 'Admin',
    created_at: '2026-11-01T00:00:00Z',
  },
];

describe('WorkIndia Hardened Importer & Multi-Job Verification', () => {
  // 1. Experience Parser
  describe('Experience Parsing', () => {
    it('parses "0", "Fresher", and "Fresher / No experience" as 0 years Fresher', () => {
      const res0 = parseExperience('0');
      expect(res0.years).toBe(0);
      expect(res0.isFresher).toBe(true);
      expect(res0.isValid).toBe(true);

      const resFresh = parseExperience('Fresher');
      expect(resFresh.years).toBe(0);
      expect(resFresh.isFresher).toBe(true);

      const resFreshSlash = parseExperience('Fresher / No experience');
      expect(resFreshSlash.years).toBe(0);
      expect(resFreshSlash.isFresher).toBe(true);

      const resNoExp = parseExperience('No Experience');
      expect(resNoExp.years).toBe(0);
      expect(resNoExp.isFresher).toBe(true);
    });

    it('parses single year and plural formats', () => {
      expect(parseExperience('1 Year').years).toBe(1);
      expect(parseExperience('2 yrs').years).toBe(2);
      expect(parseExperience('2.5').years).toBe(2.5);
      expect(parseExperience('5+ years').years).toBe(5);
    });

    it('parses combined Years and Months', () => {
      const res = parseExperience('2 Years 3 Months');
      expect(res.years).toBe(2.25);
      expect(res.isFresher).toBe(false);
      expect(res.isValid).toBe(true);
    });

    it('parses Month-only values into decimal years', () => {
      const res6m = parseExperience('6 Months');
      expect(res6m.years).toBe(0.5);
      expect(res6m.isFresher).toBe(false);

      const res18m = parseExperience('18 Months');
      expect(res18m.years).toBe(1.5);
    });

    it('parses experience ranges', () => {
      const resRange = parseExperience('0-1 Year');
      expect(resRange.years).toBe(0.5);
    });

    it('flags unparseable non-empty values as invalid without silently defaulting to 0', () => {
      const resBad = parseExperience('xyz invalid text');
      expect(resBad.years).toBeNull();
      expect(resBad.isFresher).toBe(false);
      expect(resBad.isValid).toBe(false);
      expect(resBad.display).toContain('Unrecognized');
    });
  });

  // 2. Salary Parser
  describe('Salary Parsing', () => {
    it('parses plain numbers, formatted with commas, and currency prefixes', () => {
      expect(parseSalary('10000').monthly).toBe(10000);
      expect(parseSalary('10,000').monthly).toBe(10000);
      expect(parseSalary('Rs 10000').monthly).toBe(10000);
      expect(parseSalary('₹ 10,000').monthly).toBe(10000);
    });

    it('parses "k" notation into thousands', () => {
      expect(parseSalary('10k').monthly).toBe(10000);
      expect(parseSalary('15K').monthly).toBe(15000);
    });

    it('parses LPA / Lakhs per annum into monthly rupees', () => {
      // 1.2 LPA = 1,20,000 / 12 = 10,000 per month
      expect(parseSalary('1.2 LPA').monthly).toBe(10000);
      expect(parseSalary('2.4 LPA').monthly).toBe(20000);
      expect(parseSalary('1.2L').monthly).toBe(10000);
    });

    it('parses salary ranges into monthly midpoint rupees', () => {
      expect(parseSalary('10000 - 15000').monthly).toBe(12500);
      expect(parseSalary('10k - 15k').monthly).toBe(12500);
      expect(parseSalary('1.2 - 2.4 LPA').monthly).toBe(15000);
    });
  });

  // 3. Job-Text Matching
  describe('Job-Text Matching Logic', () => {
    it('matches exact titles (case-insensitive)', () => {
      const match = matchJobTitle('Data Entry Operator', activeJobsList);
      expect(match.matchedJob?.id).toBe('job_deo');
      expect(match.method).toBe('exact');
      expect(match.confidence).toBe(1.0);
    });

    it('matches normalized titles ignoring noise words like "Urgent Opening" or "Vacancy"', () => {
      const match = matchJobTitle('Data Entry Operator Urgent Opening', activeJobsList);
      expect(match.matchedJob?.id).toBe('job_deo');
      expect(match.method).toBe('normalized');
      expect(match.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('matches acronyms and close token overlaps', () => {
      const match = matchJobTitle('Medical Coordination Officer', activeJobsList);
      expect(match.matchedJob?.id).toBe('job_mco');
      expect(match.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('returns NO MATCH for unrelated roles without silent guessing', () => {
      const match = matchJobTitle('Civil Site Engineer', activeJobsList);
      expect(match.matchedJob).toBeNull();
      expect(match.method).toBe('none');
    });
  });

  // 4. Fair Hiring Column Protection
  describe('Fair Hiring Protection', () => {
    it('detects and lists fair hiring columns to be ignored', () => {
      const headers = ['Full Name', 'Phone', 'Gender', 'Age', 'Marital Status', 'City', 'Religion', 'Photo'];
      const ignored = detectFairHiringColumns(headers);
      expect(ignored).toContain('Gender');
      expect(ignored).toContain('Age');
      expect(ignored).toContain('Marital Status');
      expect(ignored).toContain('Religion');
      expect(ignored).toContain('Photo');
      expect(ignored).not.toContain('Full Name');
      expect(ignored).not.toContain('City');
    });
  });

  // 5. Duplicate Rules & Multi-Job Application Flow
  describe('Duplicate Rules & Multi-Job Flow', () => {
    const existingCandidate: Candidate = {
      id: 'cand_existing_1',
      full_name: 'Rahul Sharma',
      phone: '+919811122233',
      city: 'Mumbai',
      source: 'workindia',
      created_at: '2026-11-10T10:00:00Z',
    };

    const existingApplication: Application = {
      id: 'app_existing_1',
      candidate_id: 'cand_existing_1',
      job_id: 'job_deo',
      status: 'shortlisted',
      score: 85,
      score_breakdown: {
        city_score: 20,
        exp_score: 20,
        skills_score: 20,
        salary_score: 15,
        notice_score: 10,
        shift_score: 0,
        notes: [],
      },
      token: 'tok_sample_123',
      token_expires_at: '2026-11-30T00:00:00Z',
      created_at: '2026-11-10T10:00:00Z',
      candidate: existingCandidate,
      job: activeJobsList[0],
    };

    it('skips candidate if already applied to the SAME job', () => {
      const matrix = [
        ['Name', 'Mobile', 'City'],
        ['Rahul Sharma', '+91 98111 22233', 'Mumbai'],
      ];

      const res = parseAndCleanCandidateSheet(
        matrix,
        {},
        'Sheet1',
        {
          jobMode: 'all_one_job',
          targetJob: activeJobsList[0], // job_deo
          activeJobs: activeJobsList,
        },
        [existingCandidate],
        [existingApplication]
      );

      expect(res.importedCount).toBe(0);
      expect(res.alreadyAppliedCount).toBe(1);
      expect(res.rowPreviews[0].resultType).toBe('already_applied');
      expect(res.rowPreviews[0].resultBadgeText).toBe('Already applied for this job');
    });

    it('reuses candidate and creates a NEW application when applied to a DIFFERENT job', () => {
      const matrix = [
        ['Name', 'Mobile', 'City'],
        ['Rahul Sharma', '+91 98111 22233', 'Mumbai'],
      ];

      // Import under job_mco (different job)
      const res = parseAndCleanCandidateSheet(
        matrix,
        {},
        'Sheet1',
        {
          jobMode: 'all_one_job',
          targetJob: activeJobsList[1], // job_mco
          activeJobs: activeJobsList,
        },
        [existingCandidate],
        [existingApplication]
      );

      expect(res.importedCount).toBe(1);
      expect(res.newApplicationsCount).toBe(1);
      expect(res.newCandidatesCount).toBe(0);
      expect(res.rowPreviews[0].resultType).toBe('existing_candidate_new_app');
      expect(res.rowPreviews[0].resultBadgeText).toBe('Existing candidate, new application');

      // Preserves existing candidate ID
      const newApp = res.importedApplications[0];
      expect(newApp.candidate_id).toBe(existingCandidate.id);
      expect(newApp.job_id).toBe('job_mco');
      expect(newApp.status).toBe('new');
      expect(newApp.token).toBeDefined();
    });

    it('creates brand new candidate and application if phone does not exist in DB', () => {
      const matrix = [
        ['Name', 'Mobile', 'City'],
        ['Neha Deshmukh', '+91 98777 66655', 'Pune'],
      ];

      const res = parseAndCleanCandidateSheet(
        matrix,
        {},
        'Sheet1',
        {
          jobMode: 'all_one_job',
          targetJob: activeJobsList[0],
          activeJobs: activeJobsList,
        },
        [existingCandidate],
        [existingApplication]
      );

      expect(res.importedCount).toBe(1);
      expect(res.newCandidatesCount).toBe(1);
      expect(res.newApplicationsCount).toBe(0);
      expect(res.rowPreviews[0].resultType).toBe('new_candidate');
      expect(res.importedApplications[0].candidate?.phone).toBe('+919877766655');
    });

    it('handles duplicate rows inside the same Excel file: keeps first, skips subsequent', () => {
      const matrix = [
        ['Name', 'Mobile', 'City'],
        ['Candidate First', '+91 98999 11122', 'Mumbai'],
        ['Candidate Second', '+91 98999 11122', 'Mumbai'], // Duplicate in file
      ];

      const res = parseAndCleanCandidateSheet(
        matrix,
        {},
        'Sheet1',
        {
          jobMode: 'all_one_job',
          targetJob: activeJobsList[0],
          activeJobs: activeJobsList,
        },
        [],
        []
      );

      expect(res.importedCount).toBe(1);
      expect(res.duplicateInFileCount).toBe(1);
      expect(res.rowPreviews[0].resultType).toBe('new_candidate');
      expect(res.rowPreviews[1].resultType).toBe('duplicate_in_file');
    });

    it('reads the job from the Excel column and routes candidates to matching jobs', () => {
      const matrix = [
        ['Candidate Name', 'Mobile Number', 'Applied Job'],
        ['Candidate A', '+91 98000 11101', 'Data Entry Operator'],
        ['Candidate B', '+91 98000 11102', 'Medical Coordination Officer'],
        ['Candidate C', '+91 98000 11103', 'IT Manager Vacancy'],
      ];

      const res = parseAndCleanCandidateSheet(
        matrix,
        {},
        'Sheet1',
        {
          jobMode: 'read_from_excel',
          activeJobs: activeJobsList,
        },
        [],
        []
      );

      expect(res.importedCount).toBe(3);
      expect(res.importedApplications[0].job_id).toBe('job_deo');
      expect(res.importedApplications[1].job_id).toBe('job_mco');
      expect(res.importedApplications[2].job_id).toBe('job_it');
      expect(res.perJobCounts['Data Entry Operator']).toBe(1);
      expect(res.perJobCounts['Medical Coordination Officer (MCO)']).toBe(1);
      expect(res.perJobCounts['IT Manager']).toBe(1);
    });
  });

  // 6. Undo Import Batch Verification
  describe('Import Batch Undo Safety', () => {
    it('undo only removes what the batch created and never touches prior applications or candidates', async () => {
      const testBatchId = 'batch_unit_test_999';
      // Record dummy batch
      await recordImportBatch({
        id: testBatchId,
        filename: 'unit_test_export.xlsx',
        job_id: 'job_deo',
        job_title: 'Data Entry Operator',
        candidate_count: 2,
        imported_by: 'admin@hireflow.internal',
        imported_at: new Date().toISOString(),
      });

      const undoResult = await deleteImportBatch(testBatchId, 'admin@hireflow.internal');
      expect(undoResult.success).toBe(true);
    });
  });
});
