import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isCloudMode, isSupabaseConfigured } from '../supabase';
import * as db from '../db';
import * as cloudRepo from '../db/supabaseRepo';

describe('Supabase Data Layer & Dual Storage Parity', () => {
  it('defaults to local storage mode when Supabase is not configured', () => {
    expect(isCloudMode()).toBe(false);
  });

  it('verifies migration 003_cloud_parity_schema.sql exists and contains all required tables and columns', () => {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '003_cloud_parity_schema.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Required tables
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS login_attempts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS company_settings');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS message_templates');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS import_batches');

    // Required columns on applications
    expect(sql).toContain('assigned_to TEXT');
    expect(sql).toContain('assigned_to_name TEXT');
    expect(sql).toContain('call_outcome TEXT');
    expect(sql).toContain('call_back_at TIMESTAMPTZ');
    expect(sql).toContain('rejection_reason TEXT');
    expect(sql).toContain('batch_id TEXT');

    // Required columns on candidates & notes
    expect(sql).toContain('ALTER TABLE candidates');
    expect(sql).toContain('ALTER TABLE candidate_notes');

    // RLS enabled on all new tables
    expect(sql).toContain('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY');
  });

  it('verifies cloud repository implements the complete function contract of local repository', () => {
    const expectedFunctions = [
      'getJobs',
      'getJobById',
      'createJob',
      'updateJob',
      'closeJob',
      'deleteJob',
      'restoreJob',
      'updateScoringRules',
      'getCandidates',
      'getApplicationById',
      'getApplicationByToken',
      'saveImportedApplications',
      'updateApplicationStatus',
      'submitCandidateForm',
      'addCandidateNote',
      'getCandidateNotes',
      'deleteNote',
      'logWhatsAppOrSmsMessage',
      'getStatusHistory',
      'assignApplications',
      'autoSplitApplications',
      'recordCallOutcome',
      'getDailyProgress',
      'deleteCandidates',
      'deleteCandidateData',
      'restoreCandidates',
      'getImportBatches',
      'recordImportBatch',
      'deleteImportBatch',
      'getUsers',
      'getUserById',
      'getUserByEmail',
      'createUser',
      'updateUser',
      'resetUserPassword',
      'changeUserPassword',
      'updateLastLogin',
      'recordLoginAttempt',
      'isLoginRateLimited',
      'deleteUser',
      'getCompanySettings',
      'updateCompanySettings',
      'getTemplates',
      'getActiveTemplate',
      'getTemplateHistory',
      'saveTemplateVersion',
      'setActiveTemplate',
      'deleteTemplateVersion',
      'resetTemplateToDefault',
      'getAuditLogs',
      'logAuditEvent',
    ];

    for (const fnName of expectedFunctions) {
      expect(typeof (cloudRepo as any)[fnName]).toBe('function');
      expect(typeof (db as any)[fnName]).toBe('function');
    }
  });

  it('verifies migration 004_rls_deny_all_public.sql exists and enforces strict deny-by-default RLS', () => {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '004_rls_deny_all_public.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Confirms all policies for public/anon/authenticated are dropped
    expect(sql).toContain('DROP POLICY IF EXISTS "Public can view application by token" ON applications');
    expect(sql).toContain('DROP POLICY IF EXISTS "Public can insert form answers" ON form_answers');
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users have full access to users" ON users');
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users have full access to jobs" ON jobs');
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users have full access to candidates" ON candidates');
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users have full access to applications" ON applications');
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users have full access to company_settings" ON company_settings');

    // Confirms RLS remains strictly enabled across all tables
    expect(sql).toContain('ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE IF EXISTS company_settings ENABLE ROW LEVEL SECURITY');
  });

  it('verifies migration bundle supabase/_bundle.sql compiles all 4 migrations', () => {
    const bundlePath = path.join(process.cwd(), 'supabase', '_bundle.sql');
    expect(fs.existsSync(bundlePath)).toBe(true);

    const bundleSql = fs.readFileSync(bundlePath, 'utf8');
    expect(bundleSql).toContain('001_initial_schema.sql');
    expect(bundleSql).toContain('002_add_job_location.sql');
    expect(bundleSql).toContain('003_cloud_parity_schema.sql');
    expect(bundleSql).toContain('004_rls_deny_all_public.sql');
  });

  it('executes repository operations cleanly in local mode without cloud network overhead', async () => {
    const settings = await db.getCompanySettings();
    expect(settings).toBeDefined();
    expect(typeof settings.company_name).toBe('string');

    const jobs = await db.getJobs();
    expect(Array.isArray(jobs)).toBe(true);

    const users = await db.getUsers();
    expect(Array.isArray(users)).toBe(true);
  });
});
