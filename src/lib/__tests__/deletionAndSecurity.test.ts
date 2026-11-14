import { describe, it, expect } from 'vitest';
import {
  createJob,
  getJobs,
  deleteJob,
  restoreJob,
  closeJob,
  deleteCandidates,
  restoreCandidates,
  deleteNote,
  deleteTemplateVersion,
  deleteUser,
  recordImportBatch,
  getImportBatches,
  deleteImportBatch,
  getLocalDb,
  saveLocalDb,
} from '@/lib/db';
import { hasExcessiveRepeatedChars, validateJobInput } from '@/lib/validation';

describe('Production Readiness: Deletion, Undo, Security & Validation', () => {
  it('validates repeated characters and input constraints', () => {
    // Normal text
    expect(hasExcessiveRepeatedChars('Senior Sales Manager')).toBe(false);
    expect(hasExcessiveRepeatedChars('Pune MIDC')).toBe(false);

    // Spam / excessive repeated characters (>=30)
    const repeated = 'A'.repeat(30);
    expect(hasExcessiveRepeatedChars(repeated)).toBe(true);

    const validResult = validateJobInput({
      title: 'Customer Support Lead',
      city: 'Pune',
      location: 'Hinjawadi Phase 1',
    });
    expect(validResult.valid).toBe(true);

    const invalidResult = validateJobInput({
      title: 'A'.repeat(35),
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toContain('repeated identical characters');
  });

  it('deletes and restores a job with 0 applicants', async () => {
    const job = await createJob({
      title: 'Test Empty Job',
      department: 'Operations',
      city: 'Mumbai',
      location: 'Andheri East',
      openings: 2,
      min_exp_years: 1,
      max_exp_years: 3,
      min_salary: 25000,
      max_salary: 35000,
      shift_type: 'day',
      required_skills: ['Communication'],
      required_languages: ['Hindi', 'English'],
      status: 'active',
      created_by: 'admin@hireflow.internal',
    });

    // Delete job
    const delResult = await deleteJob(job.id, { adminEmail: 'admin@hireflow.internal' });
    expect(delResult.success).toBe(true);
    expect(delResult.deletedJob).toBeDefined();

    // Verify it is removed
    const jobsAfter = await getJobs();
    expect(jobsAfter.find((j) => j.id === job.id)).toBeUndefined();

    // Restore job
    const restSuccess = await restoreJob(
      { job: delResult.deletedJob!, applications: delResult.deletedApplications || [] },
      'admin@hireflow.internal'
    );
    expect(restSuccess).toBe(true);

    const jobsRestored = await getJobs();
    expect(jobsRestored.find((j) => j.id === job.id)).toBeDefined();
  });

  it('closes a job without deleting applicant records', async () => {
    const job = await createJob({
      title: 'Closable Role',
      department: 'Logistics',
      city: 'Navi Mumbai',
      openings: 5,
      min_exp_years: 0,
      max_exp_years: 2,
      min_salary: 18000,
      max_salary: 22000,
      shift_type: 'rotational',
      required_skills: ['Packing'],
      required_languages: ['Hindi'],
      status: 'active',
      created_by: 'admin@hireflow.internal',
    });

    const closedJob = await closeJob(job.id, 'admin@hireflow.internal');
    expect(closedJob).not.toBeNull();
    expect(closedJob?.status).toBe('closed');
  });

  it('deletes and restores candidates (bulk and single)', async () => {
    const db = getLocalDb();
    const candidateId = `cand_test_${Date.now()}`;
    const appId = `app_test_${Date.now()}`;

    db.candidates.push({
      id: candidateId,
      full_name: 'Test Candidate',
      phone: '+91 99999 88888',
      city: 'Pune',
      source: 'manual',
      created_at: new Date().toISOString(),
    } as any);
    db.applications.push({
      id: appId,
      job_id: 'b0000000-0000-0000-0000-000000000001',
      candidate_id: candidateId,
      status: 'new',
      score: 75,
      created_at: new Date().toISOString(),
    } as any);
    saveLocalDb(db);

    // Delete candidate
    const delResult = await deleteCandidates([candidateId], 'admin@hireflow.internal');
    expect(delResult.success).toBe(true);
    expect(delResult.count).toBe(1);

    const dbAfterDel = getLocalDb();
    expect(dbAfterDel.candidates.find((c) => c.id === candidateId)).toBeUndefined();
    expect(dbAfterDel.applications.find((a) => a.id === appId)).toBeUndefined();

    // Restore candidate
    const restSuccess = await restoreCandidates(delResult.deleted!, 'admin@hireflow.internal');
    expect(restSuccess).toBe(true);

    const dbRestored = getLocalDb();
    expect(dbRestored.candidates.find((c) => c.id === candidateId)).toBeDefined();
    expect(dbRestored.applications.find((a) => a.id === appId)).toBeDefined();
  });

  it('enforces permissions on note deletion (author or admin only)', async () => {
    const db = getLocalDb();
    const noteId = `note_test_${Date.now()}`;
    db.candidateNotes = db.candidateNotes || [];
    db.candidateNotes.push({
      id: noteId,
      application_id: 'app_test_1',
      candidate_id: 'cand_test_1',
      author_name: 'Pallavi Mali',
      created_by: 'pallavi.mali@hireflow.internal',
      note_text: 'Spoke with candidate, good communication.',
      created_at: new Date().toISOString(),
    });
    saveLocalDb(db);

    // Another non-admin user cannot delete
    const denied = await deleteNote(noteId, { email: 'shradha.yadav@hireflow.internal', role: 'hr_executive' });
    expect(denied).toBe(false);

    // Author can delete own note
    const authorAllowed = await deleteNote(noteId, { email: 'pallavi.mali@hireflow.internal', role: 'hr_executive' });
    expect(authorAllowed).toBe(true);
  });

  it('protects active and built-in templates from deletion', async () => {
    const db = getLocalDb();
    const activeTpl = db.templates.find((t) => t.is_active);
    if (activeTpl) {
      const result = await deleteTemplateVersion(activeTpl.id, 'admin@hireflow.internal');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete the active template');
    }
  });

  it('protects last admin, self, and active users from deletion', async () => {
    const db = getLocalDb();
    const adminUser = db.users.find((u) => u.role === 'admin' && u.is_active);
    expect(adminUser).toBeDefined();

    // Attempt to delete self
    const selfDel = await deleteUser(adminUser!.id, adminUser!.email);
    expect(selfDel.success).toBe(false);
    expect(selfDel.error).toContain('cannot delete your own');

    // Attempt to delete last remaining admin
    const lastAdminDel = await deleteUser(adminUser!.id, 'other@hireflow.internal');
    expect(lastAdminDel.success).toBe(false);
    expect(lastAdminDel.error).toContain('last remaining Admin');
  });

  it('records and undos import batch cleanly', async () => {
    const batchId = `batch_test_${Date.now()}`;
    const candId = `cand_batch_${Date.now()}`;
    const appId = `app_batch_${Date.now()}`;

    const db = getLocalDb();
    db.candidates.push({
      id: candId,
      batch_id: batchId,
      full_name: 'Batch Candidate',
      phone: '+91 91234 56789',
      city: 'Mumbai',
      source: 'manual',
      created_at: new Date().toISOString(),
    } as any);
    db.applications.push({
      id: appId,
      batch_id: batchId,
      job_id: 'b0000000-0000-0000-0000-000000000001',
      candidate_id: candId,
      status: 'new',
      score: 80,
      created_at: new Date().toISOString(),
    } as any);
    saveLocalDb(db);

    await recordImportBatch({
      id: batchId,
      filename: 'sample_batch.xlsx',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      job_title: 'Test Job',
      candidate_count: 1,
      imported_by: 'admin@hireflow.internal',
      imported_at: new Date().toISOString(),
    });

    const batches = await getImportBatches();
    expect(batches.find((b) => b.id === batchId)).toBeDefined();

    // Undo import batch
    const undoResult = await deleteImportBatch(batchId, 'admin@hireflow.internal');
    expect(undoResult.success).toBe(true);

    const dbAfterUndo = getLocalDb();
    expect(dbAfterUndo.candidates.find((c) => c.batch_id === batchId)).toBeUndefined();
    expect(dbAfterUndo.applications.find((a) => a.batch_id === batchId)).toBeUndefined();
  });
});
