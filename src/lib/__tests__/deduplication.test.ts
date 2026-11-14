import { describe, it, expect } from 'vitest';
import { processCandidateImport } from '../deduplication';
import { Candidate, Application, Job } from '@/types';

describe('Candidate Deduplication and Cleaning', () => {
  const dummyJob: Job = {
    id: 'job-101',
    title: 'Telecaller',
    department: 'Sales',
    city: 'Delhi',
    openings: 5,
    min_exp_years: 0,
    max_exp_years: 2,
    min_salary: 15000,
    max_salary: 22000,
    shift_type: 'day',
    required_skills: ['Calling'],
    required_languages: ['Hindi'],
    status: 'active',
    created_by: 'HR',
    created_at: new Date().toISOString(),
  };

  const existingCandidate: Candidate = {
    id: 'cand-existing-1',
    full_name: 'Aakash Verma',
    phone: '+919811122233',
    city: 'Delhi',
    source: 'workindia',
    created_at: new Date().toISOString(),
  };

  const existingApp: Application = {
    id: 'app-existing-1',
    candidate_id: 'cand-existing-1',
    job_id: 'job-101',
    status: 'form_sent',
    score: 0,
    score_breakdown: {
      city_score: 0,
      exp_score: 0,
      skills_score: 0,
      salary_score: 0,
      notice_score: 0,
      shift_score: 0,
      notes: [],
    },
    token: 'tok-123',
    token_expires_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    candidate: existingCandidate,
  };

  it('imports valid new candidates and formats phone numbers', () => {
    const rawRows = [
      { 'Candidate Name': 'Ramesh Kumar', 'Mobile Number': '9899001122', 'City': 'Delhi' },
      { 'Candidate Name': 'Kavita Singh', 'Mobile Number': '+91 9711002233', 'City': 'Noida' },
    ];

    const result = processCandidateImport(
      rawRows,
      { fullName: 'Candidate Name', phone: 'Mobile Number', city: 'City' },
      dummyJob,
      [],
      []
    );

    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(0);
    expect(result.invalidNumbers).toBe(0);
    expect(result.importedApplications[0].candidate?.phone).toBe('+919899001122');
    expect(result.importedApplications[1].candidate?.phone).toBe('+919711002233');
    expect(result.importedApplications[0].token).toHaveLength(32);
  });

  it('detects duplicate row within the same uploaded file', () => {
    const rawRows = [
      { 'Name': 'Ramesh Kumar', 'Phone': '9899001122' },
      { 'Name': 'Ramesh Kumar Duplicate', 'Phone': '9899001122' },
    ];

    const result = processCandidateImport(
      rawRows,
      { fullName: 'Name', phone: 'Phone' },
      dummyJob,
      [],
      []
    );

    expect(result.validRows).toBe(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.errorRows.length).toBe(1);
  });

  it('detects duplicate application for candidate already in this job', () => {
    const rawRows = [
      { 'Name': 'Aakash Verma', 'Phone': '9811122233' }, // Already exists in dummyJob
    ];

    const result = processCandidateImport(
      rawRows,
      { fullName: 'Name', phone: 'Phone' },
      dummyJob,
      [existingCandidate],
      [existingApp]
    );

    expect(result.validRows).toBe(0);
    expect(result.duplicateRows).toBe(1);
  });

  it('merges candidate history when existing candidate applies to a DIFFERENT job', () => {
    const anotherJob: Job = { ...dummyJob, id: 'job-202', title: 'Customer Support' };
    const rawRows = [
      { 'Name': 'Aakash Verma', 'Phone': '9811122233' },
    ];

    const result = processCandidateImport(
      rawRows,
      { fullName: 'Name', phone: 'Phone' },
      anotherJob,
      [existingCandidate],
      [existingApp] // existingApp is for job-101, not job-202
    );

    expect(result.validRows).toBe(1);
    expect(result.duplicateRows).toBe(0);
    // Preserves existing candidate id!
    expect(result.importedApplications[0].candidate_id).toBe('cand-existing-1');
    expect(result.importedApplications[0].score_breakdown.notes[0]).toContain('cross-job history');
  });

  it('rejects invalid phone numbers and tracks row numbers', () => {
    const rawRows = [
      { 'Name': 'Bad Phone', 'Phone': '12345' },
    ];

    const result = processCandidateImport(
      rawRows,
      { fullName: 'Name', phone: 'Phone' },
      dummyJob,
      [],
      []
    );

    expect(result.invalidNumbers).toBe(1);
    expect(result.validRows).toBe(0);
    expect(result.errorRows[0].reason).toContain('Invalid Indian mobile number');
  });
});
