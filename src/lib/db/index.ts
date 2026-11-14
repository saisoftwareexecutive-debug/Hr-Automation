import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  Application,
  ApplicationStatus,
  AuditLogItem,
  CallOutcome,
  Candidate,
  CandidateNote,
  CompanySettings,
  DailyProgress,
  FormAnswers,
  Job,
  LoginAttempt,
  MessageLanguage,
  MessageLogItem,
  MessageTemplate,
  MessageTone,
  RejectionReason,
  ScoringRules,
  StatusHistoryItem,
  TemplateType,
  User,
  UserRole,
} from '@/types';
import {
  INITIAL_APPLICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CANDIDATES,
  INITIAL_FORM_ANSWERS,
  INITIAL_JOBS,
  INITIAL_NOTES,
  INITIAL_SETTINGS,
  INITIAL_STATUS_HISTORY,
  INITIAL_TEMPLATES,
  INITIAL_USERS,
} from './initialData';
import { calculateCandidateScore } from '../scoring';
import { TONE_PRESETS } from '../templates';
import { generateUUID } from '../id';

import { ImportBatch } from '@/types';
import { validateJobInput } from '../validation';
import { COMPANY_NAME, COMPANY_TAGLINE } from '../brand';
import { isCloudMode } from '../supabase';
import * as cloudRepo from './supabaseRepo';

interface DatabaseSchema {
  jobs: Job[];
  candidates: Candidate[];
  applications: Application[];
  formAnswers: FormAnswers[];
  candidateNotes: CandidateNote[];
  statusHistory: StatusHistoryItem[];
  messagesLog: MessageLogItem[];
  auditLogs: AuditLogItem[];
  users: User[];
  companySettings: CompanySettings;
  templates: MessageTemplate[];
  loginAttempts: LoginAttempt[];
  importBatches?: ImportBatch[];
}

export function getDbFilePath(): string {
  if (process.env.HIREFLOW_DATA_FILE) {
    return path.resolve(process.env.HIREFLOW_DATA_FILE);
  }
  const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
  return path.join(dir, 'hireflow_db.json');
}

export function getDataDirPath(): string {
  return path.dirname(getDbFilePath());
}

// Ensure data folder and initialize database
export function getLocalDb(): DatabaseSchema {
  try {
    const dataDir = getDataDirPath();
    const dbFile = getDbFilePath();

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dbFile)) {
      const initialDb: DatabaseSchema = {
        jobs: INITIAL_JOBS,
        candidates: INITIAL_CANDIDATES,
        applications: INITIAL_APPLICATIONS,
        formAnswers: INITIAL_FORM_ANSWERS,
        candidateNotes: INITIAL_NOTES,
        statusHistory: INITIAL_STATUS_HISTORY,
        messagesLog: [],
        auditLogs: INITIAL_AUDIT_LOGS,
        users: INITIAL_USERS,
        companySettings: INITIAL_SETTINGS,
        templates: INITIAL_TEMPLATES,
        loginAttempts: [],
        importBatches: [],
      };
      fs.writeFileSync(dbFile, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }

    let content = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        content = fs.readFileSync(dbFile, 'utf-8');
        break;
      } catch (err: any) {
        if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < 4) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
          continue;
        }
        throw err;
      }
    }
    const db = JSON.parse(content) as DatabaseSchema;

    // Ensure migrations for new tables and official company branding
    let mutated = false;
    if (!db.users || db.users.length === 0) {
      db.users = INITIAL_USERS;
      mutated = true;
    }
    if (!db.companySettings) {
      db.companySettings = INITIAL_SETTINGS;
      mutated = true;
    } else if (db.companySettings.company_name === 'HireFlow Technologies Pvt Ltd' || !db.companySettings.company_name || db.companySettings.company_name !== COMPANY_NAME) {
      db.companySettings.company_name = COMPANY_NAME;
      db.companySettings.tagline = COMPANY_TAGLINE;
      if (db.companySettings.hr_name === 'Rajesh Sharma') {
        db.companySettings.hr_name = 'Alex';
      }
      db.companySettings.accent_color = db.companySettings.accent_color || '#4f46e5';
      db.companySettings.daily_target = db.companySettings.daily_target || 25;
      mutated = true;
    }

    // Safe migration for jobs: ensure location and map_url exist on all jobs
    if (db.jobs && Array.isArray(db.jobs)) {
      db.jobs.forEach((job) => {
        if (job.location === undefined) {
          if (job.city?.toLowerCase().includes('mumbai')) {
            job.location = 'Andheri East, near Marol Naka metro station';
            job.map_url = 'https://maps.google.com/?q=Andheri+East+Marol+Naka+Mumbai';
          } else if (job.city?.toLowerCase().includes('bengaluru') || job.city?.toLowerCase().includes('bangalore')) {
            job.location = 'Koramangala 4th Block, 80 Feet Road';
            job.map_url = 'https://maps.google.com/?q=Koramangala+4th+Block+Bengaluru';
          } else {
            job.location = '';
            job.map_url = '';
          }
          mutated = true;
        }
      });
    }

    // Seed real users: Alex (Admin), Pallavi Mali (HR Exec), Shradha Yadav (HR Exec)
    // 1. Admin: Alex
    const adminUser = db.users.find((u) => u.email.toLowerCase() === 'admin@hireflow.internal');
    if (adminUser) {
      if (adminUser.full_name === 'Rajesh Sharma') {
        adminUser.full_name = 'Alex';
        adminUser.phone = adminUser.phone || '+91 98765 01000';
        mutated = true;
      }
    } else {
      const defaultHash = '$2b$10$LV3d541DpzNnndkCvycHjeJwPZr3a9wJ2D0TV1yBJaIIK/GVL9LL2';
      db.users.push({
        id: 'usr_admin_alex',
        email: 'admin@hireflow.internal',
        password_hash: defaultHash,
        full_name: 'Alex',
        phone: '+91 98765 01000',
        role: 'admin',
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
      });
      mutated = true;
    }

    // 2. HR Exec: Pallavi Mali
    let pallavi = db.users.find((u) => u.email.toLowerCase() === 'pallavi.mali@hireflow.internal');
    if (!pallavi) {
      const defaultHash = '$2b$10$O/NFrA.MBTUjCAJ.7KbpF.bfrxCMKkGEIAp7/7iI/9BJF043nMBpu';
      pallavi = {
        id: 'usr_exec_pallavi',
        email: 'pallavi.mali@hireflow.internal',
        password_hash: defaultHash,
        full_name: 'Pallavi Mali',
        phone: '+91 98200 12345',
        role: 'hr_executive',
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
      };
      db.users.push(pallavi);
      mutated = true;
    }

    // 3. HR Exec: Shradha Yadav
    let shradha = db.users.find((u) => u.email.toLowerCase() === 'shradha.yadav@hireflow.internal');
    if (!shradha) {
      const defaultHash = '$2b$10$O/NFrA.MBTUjCAJ.7KbpF.bfrxCMKkGEIAp7/7iI/9BJF043nMBpu';
      shradha = {
        id: 'usr_exec_shradha',
        email: 'shradha.yadav@hireflow.internal',
        password_hash: defaultHash,
        full_name: 'Shradha Yadav',
        phone: '+91 98200 67890',
        role: 'hr_executive',
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
      };
      db.users.push(shradha);
      mutated = true;
    }

    // Purge demo profiles completely
    const initialUserCount = db.users.length;
    db.users = db.users.filter((u) => {
      const isDemo =
        u.email === 'hr.priya@hireflow.internal' ||
        u.full_name?.includes('Priya Menon') ||
        (u.full_name === 'Rajesh Sharma' && u.email !== 'admin@hireflow.internal');
      return !isDemo;
    });
    if (db.users.length !== initialUserCount) {
      mutated = true;
    }

    if (!db.importBatches) {
      db.importBatches = [];
      mutated = true;
    }

    // Auto-distribute candidates between Pallavi and Shradha if unassigned
    const activeExecs = [pallavi, shradha].filter(Boolean);
    if (activeExecs.length > 0 && db.applications) {
      db.applications.forEach((app, idx) => {
        if (!app.assigned_to) {
          const assignee = activeExecs[idx % activeExecs.length];
          app.assigned_to = assignee.id;
          app.assigned_to_name = assignee.full_name;
          mutated = true;
        }
      });
    }
    if (!db.templates || db.templates.length === 0) {
      db.templates = INITIAL_TEMPLATES;
      mutated = true;
    }
    if (!db.loginAttempts) {
      db.loginAttempts = [];
      mutated = true;
    }

    if (mutated) {
      saveLocalDb(db);
    }

    return db;
  } catch (err) {
    console.error('Error reading local db:', err);
    return {
      jobs: INITIAL_JOBS,
      candidates: INITIAL_CANDIDATES,
      applications: INITIAL_APPLICATIONS,
      formAnswers: INITIAL_FORM_ANSWERS,
      candidateNotes: INITIAL_NOTES,
      statusHistory: INITIAL_STATUS_HISTORY,
      messagesLog: [],
      auditLogs: INITIAL_AUDIT_LOGS,
      users: INITIAL_USERS,
      companySettings: INITIAL_SETTINGS,
      templates: INITIAL_TEMPLATES,
      loginAttempts: [],
    };
  }
}

export function saveLocalDb(db: DatabaseSchema): void {
  try {
    const dataDir = getDataDirPath();
    const dbFile = getDbFilePath();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const tempFile = path.join(dataDir, `hireflow_db_${process.pid}_${Math.random().toString(36).slice(2)}.tmp`);
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    try {
      fs.renameSync(tempFile, dbFile);
    } catch {
      fs.copyFileSync(tempFile, dbFile);
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  } catch (err) {
    console.error('Error saving local db:', err);
  }
}

// -------------------------------------------------------------
// JOBS REPOSITORY
// -------------------------------------------------------------
export async function getJobs(): Promise<Job[]> {
  if (isCloudMode()) {
    return cloudRepo.getJobs();
  }
  const db = getLocalDb();
  return db.jobs;
}

export async function getJobById(id: string): Promise<Job | null> {
  if (isCloudMode()) {
    return cloudRepo.getJobById(id);
  }
  const db = getLocalDb();
  return db.jobs.find((j) => j.id === id) || null;
}

export function findDuplicateJob(title: string, city: string, location?: string, excludeJobId?: string): Job | undefined {
  const db = getLocalDb();
  const normTitle = (title || '').trim().toLowerCase();
  const normCity = (city || '').trim().toLowerCase();
  const normLoc = (location || '').trim().toLowerCase();

  return db.jobs.find((j) => {
    if (excludeJobId && j.id === excludeJobId) return false;
    const sameTitle = (j.title || '').trim().toLowerCase() === normTitle;
    const sameCity = (j.city || '').trim().toLowerCase() === normCity;
    const sameLoc = (j.location || '').trim().toLowerCase() === normLoc;
    return sameTitle && sameCity && sameLoc;
  });
}

export async function createJob(jobData: Omit<Job, 'id' | 'created_at'>): Promise<Job> {
  const validation = validateJobInput({
    title: jobData.title,
    city: jobData.city,
    location: jobData.location,
  });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (isCloudMode()) {
    return cloudRepo.createJob(jobData);
  }

  const db = getLocalDb();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const trimmedLocation = jobData.location ? jobData.location.trim().slice(0, 200) : '';
  let mapUrl = jobData.map_url ? jobData.map_url.trim() : '';
  if (!mapUrl && (trimmedLocation || jobData.city)) {
    const query = [trimmedLocation, jobData.city].filter(Boolean).join(', ');
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  const newJob: Job = {
    ...jobData,
    location: trimmedLocation,
    map_url: mapUrl,
    id,
    created_at: new Date().toISOString(),
    scoring_rules: jobData.scoring_rules || {
      id: `sr_${id}`,
      job_id: id,
      weights: {
        city_weight: 20,
        exp_weight: 25,
        skills_weight: 25,
        salary_weight: 15,
        notice_weight: 10,
        shift_weight: 5,
      },
      criteria: {
        preferred_cities: [jobData.city],
        max_acceptable_salary: jobData.max_salary,
        max_notice_days: 30,
        mandatory_skills: jobData.required_skills.slice(0, 2),
      },
    },
  };

  db.jobs.unshift(newJob);
  saveLocalDb(db);
  await logAuditEvent('admin@hireflow.internal', 'JOB_CREATED', 'job', id, {
    title: newJob.title,
    city: newJob.city,
    location: newJob.location,
    map_url: newJob.map_url,
  });
  return newJob;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  if (isCloudMode()) {
    return cloudRepo.updateJob(id, updates);
  }
  const db = getLocalDb();
  const index = db.jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;

  const currentJob = db.jobs[index];
  const mergedUpdates = { ...updates };

  if (mergedUpdates.location !== undefined) {
    mergedUpdates.location = mergedUpdates.location ? mergedUpdates.location.trim().slice(0, 200) : '';
  }

  if (mergedUpdates.map_url !== undefined) {
    let mapUrl = mergedUpdates.map_url ? mergedUpdates.map_url.trim() : '';
    const loc = mergedUpdates.location !== undefined ? mergedUpdates.location : currentJob.location;
    const city = mergedUpdates.city !== undefined ? mergedUpdates.city : currentJob.city;
    if (!mapUrl && (loc || city)) {
      const query = [loc, city].filter(Boolean).join(', ');
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    mergedUpdates.map_url = mapUrl;
  }

  db.jobs[index] = {
    ...db.jobs[index],
    ...mergedUpdates,
    updated_at: new Date().toISOString(),
  };

  saveLocalDb(db);
  await logAuditEvent('admin@hireflow.internal', 'JOB_UPDATED', 'job', id, mergedUpdates);
  return db.jobs[index];
}

export async function closeJob(jobId: string, adminEmail: string): Promise<Job | null> {
  if (isCloudMode()) {
    return cloudRepo.closeJob(jobId, adminEmail);
  }
  const db = getLocalDb();
  const index = db.jobs.findIndex((j) => j.id === jobId);
  if (index === -1) return null;

  db.jobs[index].status = 'closed';
  db.jobs[index].updated_at = new Date().toISOString();
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'JOB_CLOSED', 'job', jobId, {
    title: db.jobs[index].title,
    city: db.jobs[index].city,
  });

  return db.jobs[index];
}

export async function deleteJob(
  jobId: string,
  options: { deleteApplicants?: boolean; adminEmail: string }
): Promise<{ success: boolean; error?: string; deletedJob?: Job; deletedApplications?: Application[] }> {
  if (isCloudMode()) {
    return cloudRepo.deleteJob(jobId, options);
  }
  const db = getLocalDb();
  const jobIndex = db.jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) {
    return { success: false, error: 'Job not found' };
  }

  const job = db.jobs[jobIndex];
  const apps = db.applications.filter((a) => a.job_id === jobId);

  if (apps.length > 0 && !options.deleteApplicants) {
    return {
      success: false,
      error: `Job has ${apps.length} applicants. Please confirm applicant deletion or close the job instead.`,
    };
  }

  // Remove job
  db.jobs.splice(jobIndex, 1);

  let deletedApplications: Application[] = [];
  if (apps.length > 0) {
    const appIds = new Set(apps.map((a) => a.id));
    deletedApplications = apps;

    db.applications = db.applications.filter((a) => !appIds.has(a.id));
    db.formAnswers = (db.formAnswers || []).filter((fa) => !appIds.has(fa.application_id));
    db.candidateNotes = (db.candidateNotes || []).filter((cn) => !appIds.has(cn.application_id));
    db.statusHistory = (db.statusHistory || []).filter((sh) => !appIds.has(sh.application_id));
    db.messagesLog = (db.messagesLog || []).filter((ml) => !appIds.has(ml.application_id));
  }

  saveLocalDb(db);

  await logAuditEvent(options.adminEmail, 'JOB_DELETED', 'job', jobId, {
    title: job.title,
    city: job.city,
    location: job.location,
    deletedApplicantsCount: deletedApplications.length,
  });

  return {
    success: true,
    deletedJob: job,
    deletedApplications,
  };
}

export async function restoreJob(
  backup: { job: Job; applications?: Application[] },
  adminEmail: string
): Promise<boolean> {
  if (isCloudMode()) {
    return cloudRepo.restoreJob(backup, adminEmail);
  }
  const db = getLocalDb();
  if (db.jobs.some((j) => j.id === backup.job.id)) {
    return false;
  }

  db.jobs.unshift(backup.job);
  if (backup.applications && backup.applications.length > 0) {
    db.applications.unshift(...backup.applications);
  }

  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'JOB_RESTORED', 'job', backup.job.id, {
    title: backup.job.title,
    restoredApplicantsCount: backup.applications?.length || 0,
  });

  return true;
}

export async function updateScoringRules(jobId: string, rules: Partial<ScoringRules>): Promise<ScoringRules | null> {
  if (isCloudMode()) {
    return cloudRepo.updateScoringRules(jobId, rules);
  }
  const db = getLocalDb();
  const jobIndex = db.jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) return null;

  const currentRules = db.jobs[jobIndex].scoring_rules || {
    id: `sr_${jobId}`,
    job_id: jobId,
    weights: {
      city_weight: 20,
      exp_weight: 25,
      skills_weight: 25,
      salary_weight: 15,
      notice_weight: 10,
      shift_weight: 5,
    },
    criteria: {},
  };

  const updatedRules: ScoringRules = {
    ...currentRules,
    ...rules,
    weights: {
      ...currentRules.weights,
      ...(rules.weights || {}),
    },
    criteria: {
      ...currentRules.criteria,
      ...(rules.criteria || {}),
    },
    updated_at: new Date().toISOString(),
  };

  db.jobs[jobIndex].scoring_rules = updatedRules;

  // Recalculate scores for all candidates in this job who have already submitted answers!
  for (let i = 0; i < db.applications.length; i++) {
    const app = db.applications[i];
    if (app.job_id === jobId && (app.status === 'replied' || app.status === 'shortlisted' || app.status === 'interview' || app.status === 'selected')) {
      const answers = db.formAnswers.find((fa) => fa.application_id === app.id);
      if (answers) {
        const res = calculateCandidateScore(db.jobs[jobIndex], updatedRules, answers);
        db.applications[i].score = res.totalScore;
        db.applications[i].score_breakdown = res.breakdown;
      }
    }
  }

  saveLocalDb(db);
  await logAuditEvent('admin@hireflow.internal', 'SCORING_RULES_UPDATED', 'scoring_rules', jobId, rules);
  return updatedRules;
}

// -------------------------------------------------------------
// CANDIDATES & APPLICATIONS REPOSITORY
// -------------------------------------------------------------
export async function getCandidates(filters?: {
  jobId?: string;
  status?: string;
  search?: string;
  minScore?: number;
  city?: string;
}): Promise<Application[]> {
  if (isCloudMode()) {
    return cloudRepo.getCandidates(filters);
  }
  const db = getLocalDb();
  let results = db.applications.map((app) => {
    let candidate = db.candidates.find((c) => c.id === app.candidate_id);
    if (!candidate && (app as any).candidate?.phone) {
      candidate = db.candidates.find((c) => c.phone === (app as any).candidate.phone);
    }
    const job = db.jobs.find((j) => j.id === app.job_id);
    const formAnswers = db.formAnswers.find((fa) => fa.application_id === app.id);
    return {
      ...app,
      candidate,
      job,
      form_answers: formAnswers,
    };
  });

  if (filters?.jobId) {
    results = results.filter((a) => a.job_id === filters.jobId);
  }

  if (filters?.status && filters.status !== 'all') {
    results = results.filter((a) => a.status === filters.status);
  }

  if (filters?.minScore !== undefined && filters.minScore > 0) {
    results = results.filter((a) => a.score >= filters.minScore!);
  }

  if (filters?.city) {
    const cLower = filters.city.toLowerCase();
    results = results.filter(
      (a) =>
        a.candidate?.city?.toLowerCase().includes(cLower) ||
        a.form_answers?.current_city?.toLowerCase().includes(cLower)
    );
  }

  if (filters?.search) {
    const query = filters.search.toLowerCase().trim();
    results = results.filter(
      (a) =>
        (a.candidate?.full_name || '').toLowerCase().includes(query) ||
        (a.candidate?.phone || '').includes(query) ||
        (a.candidate?.email || '').toLowerCase().includes(query)
    );
  }

  // Sort by score descending by default
  results.sort((a, b) => b.score - a.score);

  return results;
}

export const getApplications = getCandidates;

export async function getApplicationById(id: string): Promise<Application | null> {
  if (isCloudMode()) {
    return cloudRepo.getApplicationById(id);
  }
  const db = getLocalDb();
  const app = db.applications.find((a) => a.id === id);
  if (!app) return null;

  const candidate = db.candidates.find((c) => c.id === app.candidate_id);
  const job = db.jobs.find((j) => j.id === app.job_id);
  const formAnswers = db.formAnswers.find((fa) => fa.application_id === app.id);

  return {
    ...app,
    candidate,
    job,
    form_answers: formAnswers,
  };
}

export async function getApplicationByToken(token: string): Promise<Application | null> {
  if (isCloudMode()) {
    return cloudRepo.getApplicationByToken(token);
  }
  const db = getLocalDb();
  const app = db.applications.find((a) => a.token === token);
  if (!app) return null;

  const candidate = db.candidates.find((c) => c.id === app.candidate_id);
  const job = db.jobs.find((j) => j.id === app.job_id);
  const formAnswers = db.formAnswers.find((fa) => fa.application_id === app.id);

  return {
    ...app,
    candidate,
    job,
    form_answers: formAnswers,
  };
}

export async function saveImportedApplications(apps: Application[]): Promise<void> {
  if (isCloudMode()) {
    return cloudRepo.saveImportedApplications(apps);
  }
  const db = getLocalDb();

  for (const newApp of apps) {
    if (newApp.candidate) {
      const existingCandIndex = db.candidates.findIndex((c) => c.phone === newApp.candidate!.phone);
      if (existingCandIndex >= 0) {
        db.candidates[existingCandIndex] = {
          ...db.candidates[existingCandIndex],
          ...newApp.candidate,
          updated_at: new Date().toISOString(),
        };
        newApp.candidate_id = db.candidates[existingCandIndex].id;
      } else {
        db.candidates.push(newApp.candidate);
        newApp.candidate_id = newApp.candidate.id;
      }
    }

    const { candidate, job, ...appOnly } = newApp;
    db.applications.unshift({
      ...appOnly,
      candidate_id: newApp.candidate_id,
    });
  }

  saveLocalDb(db);
  await logAuditEvent('hr.executive@hireflow.internal', 'CANDIDATES_IMPORTED', 'application', undefined, {
    count: apps.length,
    jobId: apps[0]?.job_id,
  });
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  reason?: string,
  changedBy: string = 'HR Team'
): Promise<Application | null> {
  if (isCloudMode()) {
    return cloudRepo.updateApplicationStatus(applicationId, newStatus, changedBy, reason);
  }
  const db = getLocalDb();
  const index = db.applications.findIndex((a) => a.id === applicationId);
  if (index === -1) return null;

  const oldStatus = db.applications[index].status;
  db.applications[index].status = newStatus;
  db.applications[index].updated_at = new Date().toISOString();

  if (newStatus === 'form_sent' && !db.applications[index].form_sent_at) {
    db.applications[index].form_sent_at = new Date().toISOString();
  }

  // Record in status history
  const historyItem: StatusHistoryItem = {
    id: `sh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    application_id: applicationId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
    created_at: new Date().toISOString(),
  };
  db.statusHistory.unshift(historyItem);

  saveLocalDb(db);
  await logAuditEvent(changedBy, 'STATUS_CHANGED', 'application', applicationId, {
    oldStatus,
    newStatus,
    reason,
  });

  return getApplicationById(applicationId);
}

// -------------------------------------------------------------
// PUBLIC SCREENING FORM SUBMISSION
// -------------------------------------------------------------
export async function submitCandidateForm(
  token: string,
  answersData: Omit<FormAnswers, 'id' | 'application_id' | 'submitted_at'>
): Promise<{ success: boolean; score: number; error?: string }> {
  if (isCloudMode()) {
    return cloudRepo.submitCandidateForm(token, answersData);
  }
  const db = getLocalDb();
  const appIndex = db.applications.findIndex((a) => a.token === token);
  if (appIndex === -1) {
    return { success: false, score: 0, error: 'Invalid or expired screening link' };
  }

  const app = db.applications[appIndex];

  // Check token expiry
  if (new Date(app.token_expires_at).getTime() < Date.now()) {
    return { success: false, score: 0, error: 'This screening link has expired (validity was 7 days).' };
  }

  const job = db.jobs.find((j) => j.id === app.job_id);
  if (!job) {
    return { success: false, score: 0, error: 'Job not found' };
  }

  const formAnswerId = `fa_${Date.now()}`;
  const completeAnswers: FormAnswers = {
    ...answersData,
    id: formAnswerId,
    application_id: app.id,
    submitted_at: new Date().toISOString(),
  };

  // Run transparent Fair-Hiring scoring engine!
  const scoreResult = calculateCandidateScore(job, job.scoring_rules, completeAnswers);

  // Update application
  db.applications[appIndex].status = 'replied';
  db.applications[appIndex].score = scoreResult.totalScore;
  db.applications[appIndex].score_breakdown = scoreResult.breakdown;
  db.applications[appIndex].replied_at = new Date().toISOString();
  db.applications[appIndex].updated_at = new Date().toISOString();

  // Save or update form answers
  const faIndex = db.formAnswers.findIndex((f) => f.application_id === app.id);
  if (faIndex >= 0) {
    db.formAnswers[faIndex] = completeAnswers;
  } else {
    db.formAnswers.push(completeAnswers);
  }

  // Update candidate city if not set
  const candIndex = db.candidates.findIndex((c) => c.id === app.candidate_id);
  if (candIndex >= 0 && answersData.current_city) {
    db.candidates[candIndex].city = answersData.current_city;
  }

  // Record status history
  db.statusHistory.unshift({
    id: `sh_${Date.now()}`,
    application_id: app.id,
    old_status: app.status,
    new_status: 'replied',
    changed_by: 'Candidate Form Submission',
    reason: `Form submitted. Scored ${scoreResult.totalScore}/100.`,
    created_at: new Date().toISOString(),
  });

  saveLocalDb(db);
  await logAuditEvent('Candidate (Public Form)', 'FORM_SUBMITTED', 'application', app.id, {
    score: scoreResult.totalScore,
    token,
  });

  return { success: true, score: scoreResult.totalScore };
}

// -------------------------------------------------------------
// NOTES, MESSAGES LOG, AUDIT LOG & PRIVACY (DPDP)
// -------------------------------------------------------------
export async function addCandidateNote(
  applicationId: string,
  candidateId: string,
  noteText: string,
  authorName: string = 'HR Executive'
): Promise<CandidateNote> {
  if (isCloudMode()) {
    return cloudRepo.addCandidateNote(applicationId, candidateId, noteText, authorName);
  }
  const db = getLocalDb();
  const note: CandidateNote = {
    id: `note_${Date.now()}`,
    application_id: applicationId,
    candidate_id: candidateId,
    author_name: authorName,
    note_text: noteText,
    created_at: new Date().toISOString(),
  };
  db.candidateNotes.unshift(note);
  saveLocalDb(db);
  await logAuditEvent(authorName, 'NOTE_ADDED', 'candidate_note', candidateId, { textLength: noteText.length });
  return note;
}

// -------------------------------------------------------------
// ASSIGNMENT & CALL OUTCOMES (PART 4)
// -------------------------------------------------------------
export async function assignApplications(
  applicationIds: string[],
  userId: string,
  userName: string,
  adminEmail: string
): Promise<{ success: boolean; count: number }> {
  if (isCloudMode()) {
    return cloudRepo.assignApplications(applicationIds, userId, userName, adminEmail);
  }
  const db = getLocalDb();
  let updatedCount = 0;

  db.applications.forEach((app) => {
    if (applicationIds.includes(app.id)) {
      app.assigned_to = userId;
      app.assigned_to_name = userName;
      app.updated_at = new Date().toISOString();
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    saveLocalDb(db);
    await logAuditEvent(adminEmail, 'APPLICATIONS_ASSIGNED', 'application', undefined, {
      count: updatedCount,
      assignedTo: userName,
      assignedUserId: userId,
      applicationIds,
    });
  }

  return { success: true, count: updatedCount };
}

export async function autoSplitApplications(
  applicationIds: string[],
  adminEmail: string,
  targetUserIds?: { id: string; name: string }[]
): Promise<{ success: boolean; assignments: Record<string, number> }> {
  if (isCloudMode()) {
    return cloudRepo.autoSplitApplications(applicationIds, adminEmail, targetUserIds);
  }
  const db = getLocalDb();
  const execs = targetUserIds && targetUserIds.length > 0
    ? targetUserIds
    : db.users
        .filter((u) => u.role === 'hr_executive' && u.is_active)
        .map((u) => ({ id: u.id, name: u.full_name }));

  if (execs.length === 0) {
    throw new Error('No active HR Executives found to assign candidates to.');
  }

  const counts: Record<string, number> = {};
  execs.forEach((e) => (counts[e.name] = 0));

  let assignedCount = 0;
  db.applications.forEach((app) => {
    if (applicationIds.includes(app.id)) {
      const assignee = execs[assignedCount % execs.length];
      app.assigned_to = assignee.id;
      app.assigned_to_name = assignee.name;
      app.updated_at = new Date().toISOString();
      counts[assignee.name] = (counts[assignee.name] || 0) + 1;
      assignedCount++;
    }
  });

  saveLocalDb(db);
  await logAuditEvent(adminEmail, 'APPLICATIONS_AUTO_SPLIT', 'application', undefined, {
    totalAssigned: assignedCount,
    splits: counts,
  });

  return { success: true, assignments: counts };
}

export async function recordCallOutcome(data: {
  applicationId: string;
  outcome: CallOutcome;
  notes?: string;
  callBackAt?: string;
  rejectionReason?: RejectionReason;
  authorName: string;
  authorEmail: string;
}): Promise<Application> {
  if (isCloudMode()) {
    return cloudRepo.recordCallOutcome(data);
  }
  const db = getLocalDb();
  const app = db.applications.find((a) => a.id === data.applicationId);
  if (!app) throw new Error('Application not found');

  const oldStatus = app.status;
  let newStatus: ApplicationStatus = app.status;

  app.call_outcome = data.outcome;
  if (data.callBackAt) app.call_back_at = data.callBackAt;
  if (data.rejectionReason) app.rejection_reason = data.rejectionReason;

  if (data.outcome === 'selected_for_interview') {
    newStatus = 'interview';
  } else if (data.outcome === 'interested') {
    if (app.status === 'new' || app.status === 'form_sent' || app.status === 'replied') {
      newStatus = 'shortlisted';
    }
  } else if (data.outcome === 'not_interested' || data.outcome === 'wrong_number' || data.outcome === 'already_working') {
    newStatus = 'rejected';
  }

  app.status = newStatus;
  app.updated_at = new Date().toISOString();

  const outcomeLabels: Record<CallOutcome, string> = {
    interested: 'Interested in Job',
    not_interested: 'Not Interested',
    not_reachable: 'Not Reachable / No Answer',
    call_back_later: `Call Back Later (${data.callBackAt ? new Date(data.callBackAt).toLocaleString('en-IN') : 'Scheduled'})`,
    wrong_number: 'Wrong / Invalid Number',
    already_working: 'Already Employed / Working Elsewhere',
    selected_for_interview: 'Selected for Direct Interview',
  };

  const noteText = `[Call Outcome: ${outcomeLabels[data.outcome]}]${
    data.rejectionReason ? ` Rejection Reason: ${data.rejectionReason.replace(/_/g, ' ')}.` : ''
  }${data.notes ? ` Notes: ${data.notes}` : ''}`;

  const note: CandidateNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    application_id: app.id,
    candidate_id: app.candidate_id,
    author_name: data.authorName,
    note_text: noteText,
    created_at: new Date().toISOString(),
  };
  db.candidateNotes.unshift(note);

  if (newStatus !== oldStatus) {
    db.statusHistory.unshift({
      id: `sh_${Date.now()}`,
      application_id: app.id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: data.authorName,
      reason: `Call outcome: ${outcomeLabels[data.outcome]}`,
      created_at: new Date().toISOString(),
    });
  }

  saveLocalDb(db);
  await logAuditEvent(data.authorEmail, 'CALL_OUTCOME_RECORDED', 'application', app.id, {
    outcome: data.outcome,
    oldStatus,
    newStatus,
    rejectionReason: data.rejectionReason,
  });

  const candidate = db.candidates.find((c) => c.id === app.candidate_id);
  const job = db.jobs.find((j) => j.id === app.job_id);
  const formAnswers = db.formAnswers.find((f) => f.application_id === app.id);
  return { ...app, candidate, job, form_answers: formAnswers };
}

export async function getDailyProgress(dateStr?: string): Promise<{
  teamTarget: number;
  userStats: DailyProgress[];
}> {
  if (isCloudMode()) {
    return cloudRepo.getDailyProgress(dateStr);
  }
  const db = getLocalDb();
  const settings = db.companySettings || INITIAL_SETTINGS;
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);

  const execs = db.users.filter((u) => u.is_active);
  const stats: DailyProgress[] = execs.map((u) => {
    const sentCount = (db.messagesLog || []).filter((m) => {
      return m.sent_at?.startsWith(targetDate);
    }).length;

    const assignedApps = db.applications.filter((a) => a.assigned_to === u.id);
    const formsReceived = assignedApps.filter((a) => a.replied_at && a.replied_at.startsWith(targetDate)).length;

    const callsMade = db.candidateNotes.filter((n) => {
      const matchAuthor = n.author_name?.toLowerCase().includes(u.full_name.toLowerCase());
      const isCall = n.note_text?.startsWith('[Call Outcome:');
      const isToday = n.created_at?.startsWith(targetDate);
      return matchAuthor && isCall && isToday;
    }).length;

    const interviewsBooked = db.statusHistory.filter((sh) => {
      const matchApp = assignedApps.some((a) => a.id === sh.application_id);
      const isInterview = sh.new_status === 'interview';
      const isToday = sh.created_at?.startsWith(targetDate);
      return matchApp && isInterview && isToday;
    }).length;

    const selected = db.statusHistory.filter((sh) => {
      const matchApp = assignedApps.some((a) => a.id === sh.application_id);
      const isSelected = sh.new_status === 'selected';
      const isToday = sh.created_at?.startsWith(targetDate);
      return matchApp && isSelected && isToday;
    }).length;

    return {
      user_id: u.id,
      user_name: u.full_name,
      date: targetDate,
      messages_sent: sentCount,
      forms_received: formsReceived,
      calls_made: callsMade,
      interviews_booked: interviewsBooked,
      selected,
      target: settings.daily_target || 25,
    };
  });

  return {
    teamTarget: (settings.daily_target || 25) * execs.length,
    userStats: stats,
  };
}

export async function getCandidateNotes(applicationId: string): Promise<CandidateNote[]> {
  if (isCloudMode()) {
    return cloudRepo.getCandidateNotes(applicationId);
  }
  const db = getLocalDb();
  return db.candidateNotes.filter((n) => n.application_id === applicationId);
}

export async function logWhatsAppOrSmsMessage(logItem: Omit<MessageLogItem, 'id' | 'sent_at'>): Promise<MessageLogItem> {
  if (isCloudMode()) {
    return cloudRepo.logWhatsAppOrSmsMessage(logItem);
  }
  const db = getLocalDb();
  const item: MessageLogItem = {
    ...logItem,
    id: `msg_${Date.now()}`,
    sent_at: new Date().toISOString(),
  };
  db.messagesLog.unshift(item);
  saveLocalDb(db);
  return item;
}

export async function getStatusHistory(applicationId: string): Promise<StatusHistoryItem[]> {
  if (isCloudMode()) {
    return cloudRepo.getStatusHistory(applicationId);
  }
  const db = getLocalDb();
  return db.statusHistory.filter((sh) => sh.application_id === applicationId);
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  if (isCloudMode()) {
    return cloudRepo.getAuditLogs();
  }
  const db = getLocalDb();
  return db.auditLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function logAuditEvent(
  userEmail: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any>
): Promise<void> {
  if (isCloudMode()) {
    await cloudRepo.logAuditEvent(userEmail, action, entityType, entityId, details);
    return;
  }
  const db = getLocalDb();
  const entry: AuditLogItem = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details || {},
    created_at: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500); // cap in memory
  }
  saveLocalDb(db);
}

/**
 * India DPDP Act Compliance:
 * Candidate Right to Erasure (Delete all personal data on verified request)
 */
export async function deleteCandidateData(candidateId: string, adminEmail: string): Promise<boolean> {
  if (isCloudMode()) {
    return cloudRepo.deleteCandidateData(candidateId, adminEmail);
  }
  const db = getLocalDb();
  const cand = db.candidates.find((c) => c.id === candidateId);
  if (!cand) return false;

  const appIds = db.applications.filter((a) => a.candidate_id === candidateId).map((a) => a.id);

  // Erase candidate
  db.candidates = db.candidates.filter((c) => c.id !== candidateId);
  db.applications = db.applications.filter((a) => a.candidate_id !== candidateId);
  db.formAnswers = db.formAnswers.filter((fa) => !appIds.includes(fa.application_id));
  db.candidateNotes = db.candidateNotes.filter((n) => n.candidate_id !== candidateId);
  db.statusHistory = db.statusHistory.filter((sh) => !appIds.includes(sh.application_id));

  saveLocalDb(db);
  await logAuditEvent(adminEmail, 'DPDP_RIGHT_TO_ERASURE_EXECUTED', 'candidate', candidateId, {
    phoneMasked: `${cand.phone.slice(0, 5)}*****${cand.phone.slice(-2)}`,
    reason: 'Candidate requested data erasure under India DPDP Act 2023',
  });

  return true;
}

export async function deleteCandidates(
  candidateIds: string[],
  adminEmail: string
): Promise<{ success: boolean; count: number; deleted?: { candidates: Candidate[]; applications: Application[] } }> {
  if (isCloudMode()) {
    return cloudRepo.deleteCandidates(candidateIds, adminEmail);
  }
  const db = getLocalDb();
  const idSet = new Set(candidateIds);

  const deletedCandidates = db.candidates.filter((c) => idSet.has(c.id));
  if (deletedCandidates.length === 0) {
    return { success: false, count: 0 };
  }

  const deletedApplications = db.applications.filter((a) => idSet.has(a.candidate_id));
  const appIds = new Set(deletedApplications.map((a) => a.id));

  db.candidates = db.candidates.filter((c) => !idSet.has(c.id));
  db.applications = db.applications.filter((a) => !idSet.has(a.candidate_id));
  db.formAnswers = (db.formAnswers || []).filter((fa) => !appIds.has(fa.application_id));
  db.candidateNotes = (db.candidateNotes || []).filter((cn) => !idSet.has(cn.candidate_id) && !appIds.has(cn.application_id));
  db.statusHistory = (db.statusHistory || []).filter((sh) => !appIds.has(sh.application_id));
  db.messagesLog = (db.messagesLog || []).filter((ml) => !appIds.has(ml.application_id));

  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'CANDIDATES_BULK_DELETED', 'candidate', candidateIds.join(','), {
    count: deletedCandidates.length,
    applicationsCount: deletedApplications.length,
  });

  return {
    success: true,
    count: deletedCandidates.length,
    deleted: {
      candidates: deletedCandidates,
      applications: deletedApplications,
    },
  };
}

export async function restoreCandidates(
  backup: { candidates: Candidate[]; applications: Application[] },
  adminEmail: string
): Promise<boolean> {
  if (isCloudMode()) {
    return cloudRepo.restoreCandidates(backup, adminEmail);
  }
  const db = getLocalDb();

  const existingCandIds = new Set(db.candidates.map((c) => c.id));
  const toAddCands = backup.candidates.filter((c) => !existingCandIds.has(c.id));

  const existingAppIds = new Set(db.applications.map((a) => a.id));
  const toAddApps = backup.applications.filter((a) => !existingAppIds.has(a.id));

  db.candidates.unshift(...toAddCands);
  db.applications.unshift(...toAddApps);

  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'CANDIDATES_RESTORED', 'candidate', 'bulk_restore', {
    candidatesRestored: toAddCands.length,
    applicationsRestored: toAddApps.length,
  });

  return true;
}

export async function deleteNote(
  noteId: string,
  user: { email: string; role: string }
): Promise<boolean> {
  if (isCloudMode()) {
    return cloudRepo.deleteNote(noteId, user.email);
  }
  const db = getLocalDb();
  const noteIndex = (db.candidateNotes || []).findIndex((n) => n.id === noteId);
  if (noteIndex === -1) return false;

  const note = db.candidateNotes[noteIndex];
  const isAuthor =
    (note.created_by && note.created_by.toLowerCase() === user.email.toLowerCase()) ||
    (note.author_name && note.author_name.toLowerCase() === user.email.toLowerCase());

  if (user.role !== 'admin' && !isAuthor) {
    return false;
  }

  db.candidateNotes.splice(noteIndex, 1);
  saveLocalDb(db);

  await logAuditEvent(user.email, 'CANDIDATE_NOTE_DELETED', 'note', noteId, {
    candidateId: note.candidate_id,
    applicationId: note.application_id,
  });

  return true;
}

export async function deleteTemplateVersion(
  templateId: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isCloudMode()) {
    const ok = await cloudRepo.deleteTemplateVersion(templateId, adminEmail);
    return { success: ok };
  }
  const db = getLocalDb();
  const index = (db.templates || []).findIndex((t) => t.id === templateId);
  if (index === -1) {
    return { success: false, error: 'Template version not found' };
  }

  const template = db.templates[index];
  if (template.is_active) {
    return { success: false, error: 'Cannot delete the active template version. Set another version as active first.' };
  }

  const isBuiltIn = template.created_by === 'System Initializer' || template.id.endsWith('_v1');
  if (isBuiltIn) {
    return { success: false, error: 'Cannot delete built-in default templates.' };
  }

  db.templates.splice(index, 1);
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'TEMPLATE_VERSION_DELETED', 'template', templateId, {
    title: template.title,
    language: template.language,
    tone: template.tone,
  });

  return { success: true };
}

export async function deleteUser(
  userId: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isCloudMode()) {
    const ok = await cloudRepo.deleteUser(userId, adminEmail);
    return ok ? { success: true } : { success: false, error: 'User not found or deletion failed' };
  }
  const db = getLocalDb();
  const userIndex = (db.users || []).findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }

  const targetUser = db.users[userIndex];

  if (targetUser.email.toLowerCase() === adminEmail.toLowerCase()) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  if (targetUser.role === 'admin') {
    const activeAdmins = db.users.filter((u) => u.role === 'admin' && u.is_active && u.id !== userId);
    if (activeAdmins.length === 0) {
      return { success: false, error: 'Cannot delete the last remaining Admin account.' };
    }
  }

  const hasAssignedApps = (db.applications || []).some((a) => a.assigned_to === targetUser.id);
  const hasAuthoredNotes = (db.candidateNotes || []).some(
    (n) =>
      (n.created_by && n.created_by.toLowerCase() === targetUser.email.toLowerCase()) ||
      (n.author_name && n.author_name.toLowerCase() === targetUser.email.toLowerCase())
  );
  const hasAuditLogs = (db.auditLogs || []).some((l) => l.user_email?.toLowerCase() === targetUser.email.toLowerCase());

  if (hasAssignedApps || hasAuthoredNotes || hasAuditLogs) {
    return {
      success: false,
      error: 'User has recorded activity in the system (applications, notes, or audits). Deactivate the account instead of deleting.',
    };
  }

  db.users.splice(userIndex, 1);
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'USER_PERMANENTLY_DELETED', 'user', userId, {
    email: targetUser.email,
    name: targetUser.full_name,
    role: targetUser.role,
  });

  return { success: true };
}

export async function getImportBatches(): Promise<ImportBatch[]> {
  if (isCloudMode()) {
    return cloudRepo.getImportBatches();
  }
  const db = getLocalDb();
  return db.importBatches || [];
}

export async function recordImportBatch(batch: ImportBatch): Promise<void> {
  if (isCloudMode()) {
    return cloudRepo.recordImportBatch(batch);
  }
  const db = getLocalDb();
  if (!db.importBatches) db.importBatches = [];
  db.importBatches.unshift(batch);
  if (db.importBatches.length > 50) {
    db.importBatches = db.importBatches.slice(0, 50);
  }
  saveLocalDb(db);
}

export async function deleteImportBatch(
  batchId: string,
  adminEmail: string
): Promise<{ success: boolean; count: number }> {
  if (isCloudMode()) {
    const res = await cloudRepo.deleteImportBatch(batchId, adminEmail);
    return { success: res.success, count: res.deletedCount };
  }
  const db = getLocalDb();
  const batchIndex = (db.importBatches || []).findIndex((b) => b.id === batchId);
  const batch = batchIndex !== -1 ? db.importBatches![batchIndex] : null;

  const deletedCandidates = db.candidates.filter((c) => c.batch_id === batchId);
  const candIds = new Set(deletedCandidates.map((c) => c.id));

  const deletedApps = db.applications.filter((a) => a.batch_id === batchId || candIds.has(a.candidate_id));
  const appIds = new Set(deletedApps.map((a) => a.id));

  db.candidates = db.candidates.filter((c) => c.batch_id !== batchId);
  db.applications = db.applications.filter((a) => a.batch_id !== batchId && !candIds.has(a.candidate_id));
  db.formAnswers = (db.formAnswers || []).filter((fa) => !appIds.has(fa.application_id));
  db.candidateNotes = (db.candidateNotes || []).filter((cn) => !appIds.has(cn.application_id) && !candIds.has(cn.candidate_id));
  db.statusHistory = (db.statusHistory || []).filter((sh) => !appIds.has(sh.application_id));
  db.messagesLog = (db.messagesLog || []).filter((ml) => !appIds.has(ml.application_id));

  if (batchIndex !== -1) {
    db.importBatches!.splice(batchIndex, 1);
  }

  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'IMPORT_BATCH_UNDONE', 'import', batchId, {
    batchId,
    filename: batch?.filename,
    candidatesRemoved: deletedCandidates.length,
    applicationsRemoved: deletedApps.length,
  });

  return { success: true, count: deletedCandidates.length };
}

// -------------------------------------------------------------
// USER MANAGEMENT & AUTHENTICATION REPOSITORY
// -------------------------------------------------------------
export async function getUsers(): Promise<Omit<User, 'password_hash'>[]> {
  if (isCloudMode()) {
    return cloudRepo.getUsers();
  }
  const db = getLocalDb();
  return (db.users || []).map(({ password_hash, ...rest }) => rest);
}

export async function getUserById(id: string): Promise<User | null> {
  if (isCloudMode()) {
    return cloudRepo.getUserById(id);
  }
  const db = getLocalDb();
  return db.users?.find((u) => u.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (isCloudMode()) {
    return cloudRepo.getUserByEmail(email);
  }
  const db = getLocalDb();
  return db.users?.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function createUser(
  data: { email: string; full_name: string; role: UserRole; temporaryPassword?: string },
  adminEmail: string
): Promise<{ user: Omit<User, 'password_hash'>; tempPassword: string }> {
  if (isCloudMode()) {
    const res = await cloudRepo.createUser(
      {
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        temporaryPassword: data.temporaryPassword,
      },
      adminEmail
    );
    return { user: res.user, tempPassword: res.temporaryPassword };
  }
  const db = getLocalDb();
  const existing = db.users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
  if (existing) {
    throw new Error(`User with email "${data.email}" already exists.`);
  }

  const tempPassword = data.temporaryPassword || `HF@${Math.floor(100000 + Math.random() * 900000)}`;
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  const newUser: User = {
    id: `usr_${generateUUID()}`,
    email: data.email.toLowerCase().trim(),
    password_hash: passwordHash,
    full_name: data.full_name.trim(),
    role: data.role,
    is_active: true,
    must_change_password: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.users.push(newUser);
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'USER_CREATED', 'user', newUser.id, {
    email: newUser.email,
    role: newUser.role,
  });

  const { password_hash, ...safeUser } = newUser;
  return { user: safeUser, tempPassword };
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'full_name' | 'role' | 'is_active'>>,
  adminEmail: string
): Promise<Omit<User, 'password_hash'>> {
  if (isCloudMode()) {
    const updated = await cloudRepo.updateUser(id, updates, adminEmail);
    if (!updated) throw new Error('User not found');
    return updated;
  }
  const db = getLocalDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) {
    throw new Error('User not found');
  }

  const existing = db.users[index];
  const updatedUser: User = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  db.users[index] = updatedUser;
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'USER_UPDATED', 'user', id, {
    changes: updates,
    targetEmail: existing.email,
  });

  const { password_hash, ...safeUser } = updatedUser;
  return safeUser;
}

export async function resetUserPassword(
  id: string,
  adminEmail: string
): Promise<{ tempPassword: string }> {
  if (isCloudMode()) {
    const res = await cloudRepo.resetUserPassword(id, adminEmail);
    if (!res.success || !res.temporaryPassword) throw new Error(res.error || 'User not found');
    return { tempPassword: res.temporaryPassword };
  }
  const db = getLocalDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) {
    throw new Error('User not found');
  }

  const tempPassword = `Reset@${Math.floor(100000 + Math.random() * 900000)}`;
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  db.users[index].password_hash = passwordHash;
  db.users[index].must_change_password = true;
  db.users[index].updated_at = new Date().toISOString();
  saveLocalDb(db);

  await logAuditEvent(adminEmail, 'USER_PASSWORD_RESET', 'user', id, {
    targetEmail: db.users[index].email,
  });

  return { tempPassword };
}

export async function changeUserPassword(
  userId: string,
  oldPass: string,
  newPass: string
): Promise<boolean> {
  if (isCloudMode()) {
    const res = await cloudRepo.changeUserPassword(userId, oldPass, newPass);
    if (!res.success) throw new Error(res.error || 'Password change failed');
    return true;
  }
  const db = getLocalDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found');

  if (!bcrypt.compareSync(oldPass, user.password_hash)) {
    throw new Error('Current password is incorrect');
  }

  if (oldPass === newPass) {
    throw new Error('New password must be different from current password');
  }

  if (newPass.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  user.password_hash = bcrypt.hashSync(newPass, 10);
  user.must_change_password = false;
  user.updated_at = new Date().toISOString();
  saveLocalDb(db);

  await logAuditEvent(user.email, 'PASSWORD_CHANGED', 'user', userId, {});
  return true;
}

export async function updateLastLogin(userId: string): Promise<void> {
  if (isCloudMode()) {
    return cloudRepo.updateLastLogin(userId);
  }
  const db = getLocalDb();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.last_login_at = new Date().toISOString();
    saveLocalDb(db);
  }
}

// -------------------------------------------------------------
// RATE LIMITING REPOSITORY
// -------------------------------------------------------------
export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  if (isCloudMode()) {
    return cloudRepo.recordLoginAttempt(email, success);
  }
  const db = getLocalDb();
  db.loginAttempts.push({
    id: `att_${generateUUID()}`,
    email: email.toLowerCase().trim(),
    timestamp: Date.now(),
    success,
  });

  // Keep only attempts in past 2 hours
  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  db.loginAttempts = db.loginAttempts.filter((a) => a.timestamp > twoHoursAgo);
  saveLocalDb(db);
}

export async function isLoginRateLimited(email: string): Promise<{ isLimited: boolean; retryAfterMinutes?: number }> {
  if (isCloudMode()) {
    return cloudRepo.isLoginRateLimited(email);
  }
  const db = getLocalDb();
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const recentFailed = db.loginAttempts.filter(
    (a) => a.email.toLowerCase() === email.toLowerCase() && !a.success && a.timestamp > fifteenMinutesAgo
  );

  if (recentFailed.length >= 5) {
    const oldest = recentFailed[0].timestamp;
    const remainingMs = fifteenMinutesAgo + 15 * 60 * 1000 - Date.now();
    const retryAfter = Math.max(1, Math.ceil(remainingMs / 60000));
    return { isLimited: true, retryAfterMinutes: retryAfter };
  }

  return { isLimited: false };
}

// -------------------------------------------------------------
// COMPANY SETTINGS REPOSITORY
// -------------------------------------------------------------
export async function getCompanySettings(): Promise<CompanySettings> {
  if (isCloudMode()) {
    return cloudRepo.getCompanySettings();
  }
  const db = getLocalDb();
  return db.companySettings || INITIAL_SETTINGS;
}

export async function updateCompanySettings(
  settings: Partial<CompanySettings>,
  userEmail: string
): Promise<CompanySettings> {
  if (isCloudMode()) {
    return cloudRepo.updateCompanySettings(settings, userEmail);
  }
  const db = getLocalDb();
  db.companySettings = {
    ...db.companySettings,
    ...settings,
    updated_at: new Date().toISOString(),
  };
  saveLocalDb(db);

  await logAuditEvent(userEmail, 'COMPANY_SETTINGS_UPDATED', 'company_settings', undefined, {
    updatedFields: Object.keys(settings),
  });

  return db.companySettings;
}

// -------------------------------------------------------------
// TEMPLATES & VERSIONING REPOSITORY
// -------------------------------------------------------------
export async function getTemplates(): Promise<MessageTemplate[]> {
  if (isCloudMode()) {
    return cloudRepo.getTemplates();
  }
  const db = getLocalDb();
  return db.templates || [];
}

export async function getActiveTemplate(
  templateType: TemplateType,
  lang: MessageLanguage,
  jobId?: string | null
): Promise<MessageTemplate> {
  if (isCloudMode()) {
    return cloudRepo.getActiveTemplate(templateType, lang, jobId);
  }
  const db = getLocalDb();
  const templates = db.templates || [];

  // 1. Try to find per-job active override if jobId provided
  if (jobId) {
    const jobSpecific = templates.find(
      (t) => t.template_type === templateType && t.language === lang && t.job_id === jobId && t.is_active
    );
    if (jobSpecific) return jobSpecific;
  }

  // 2. Try to find global active template
  const globalActive = templates.find(
    (t) => t.template_type === templateType && t.language === lang && (!t.job_id || t.job_id === null) && t.is_active
  );
  if (globalActive) return globalActive;

  // 3. Fallback to friendly tone preset
  const presetContent = TONE_PRESETS[templateType]?.[lang]?.['friendly'] || '';
  return {
    id: `tmpl_default_${templateType}_${lang}`,
    template_type: templateType,
    language: lang,
    tone: 'friendly',
    title: `${templateType} (${lang})`,
    content: presetContent,
    version_number: 1,
    is_active: true,
    created_by: 'System Fallback',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getTemplateHistory(
  templateType: TemplateType,
  lang: MessageLanguage,
  jobId?: string | null
): Promise<MessageTemplate[]> {
  if (isCloudMode()) {
    return cloudRepo.getTemplateHistory(templateType, lang, jobId);
  }
  const db = getLocalDb();
  const templates = db.templates || [];
  return templates
    .filter(
      (t) =>
        t.template_type === templateType &&
        t.language === lang &&
        ((jobId && t.job_id === jobId) || (!jobId && (!t.job_id || t.job_id === null)))
    )
    .sort((a, b) => b.version_number - a.version_number);
}

export async function saveTemplateVersion(
  data: {
    template_type: TemplateType;
    language: MessageLanguage;
    tone: MessageTone;
    title: string;
    content: string;
    job_id?: string | null;
    set_active?: boolean;
  },
  userEmail: string
): Promise<MessageTemplate> {
  if (isCloudMode()) {
    return cloudRepo.saveTemplateVersion(data, userEmail);
  }
  const db = getLocalDb();
  if (!db.templates) db.templates = [];

  const existingVersions = await getTemplateHistory(data.template_type, data.language, data.job_id);
  const nextVersionNumber = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1;

  const setActive = data.set_active !== undefined ? data.set_active : true;

  if (setActive) {
    // Deactivate previous active versions for this scope
    db.templates.forEach((t) => {
      if (
        t.template_type === data.template_type &&
        t.language === data.language &&
        ((data.job_id && t.job_id === data.job_id) || (!data.job_id && (!t.job_id || t.job_id === null)))
      ) {
        t.is_active = false;
      }
    });
  }

  const newVersion: MessageTemplate = {
    id: `tmpl_${generateUUID()}`,
    template_type: data.template_type,
    language: data.language,
    tone: data.tone,
    title: data.title,
    content: data.content,
    version_number: nextVersionNumber,
    is_active: setActive,
    job_id: data.job_id || null,
    created_by: userEmail,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.templates.unshift(newVersion);
  saveLocalDb(db);

  await logAuditEvent(userEmail, 'TEMPLATE_SAVED_VERSION', 'message_template', newVersion.id, {
    template_type: data.template_type,
    language: data.language,
    tone: data.tone,
    version_number: nextVersionNumber,
    job_id: data.job_id || 'global',
  });

  return newVersion;
}

export async function setActiveTemplate(templateId: string, userEmail: string): Promise<MessageTemplate> {
  if (isCloudMode()) {
    return cloudRepo.setActiveTemplate(templateId, userEmail);
  }
  const db = getLocalDb();
  const target = db.templates?.find((t) => t.id === templateId);
  if (!target) throw new Error('Template version not found');

  // Deactivate sibling templates in same scope
  db.templates.forEach((t) => {
    if (
      t.template_type === target.template_type &&
      t.language === target.language &&
      ((target.job_id && t.job_id === target.job_id) || (!target.job_id && (!t.job_id || t.job_id === null)))
    ) {
      t.is_active = false;
    }
  });

  target.is_active = true;
  target.updated_at = new Date().toISOString();
  saveLocalDb(db);

  await logAuditEvent(userEmail, 'TEMPLATE_SET_ACTIVE', 'message_template', templateId, {
    template_type: target.template_type,
    version_number: target.version_number,
    language: target.language,
  });

  return target;
}

export async function restoreTemplateVersion(templateId: string, userEmail: string): Promise<MessageTemplate> {
  const db = getLocalDb();
  const target = db.templates?.find((t) => t.id === templateId);
  if (!target) throw new Error('Template version not found');

  return saveTemplateVersion(
    {
      template_type: target.template_type,
      language: target.language,
      tone: target.tone,
      title: `${target.title} (Restored v${target.version_number})`,
      content: target.content,
      job_id: target.job_id,
      set_active: true,
    },
    userEmail
  );
}

export async function resetTemplateToDefault(
  templateType: TemplateType,
  lang: MessageLanguage,
  userEmail: string,
  tone: MessageTone = 'friendly'
): Promise<MessageTemplate> {
  if (isCloudMode()) {
    return cloudRepo.resetTemplateToDefault(templateType, lang, userEmail, tone);
  }
  const preset = TONE_PRESETS[templateType]?.[lang]?.[tone] || '';
  return saveTemplateVersion(
    {
      template_type: templateType,
      language: lang,
      tone,
      title: `Default ${templateType} (${lang} - ${tone})`,
      content: preset,
      job_id: null,
      set_active: true,
    },
    userEmail
  );
}
