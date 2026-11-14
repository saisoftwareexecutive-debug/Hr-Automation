import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll } from 'vitest';
import { COMPANY_NAME, COMPANY_TAGLINE, DEFAULT_LOGO_PATH } from '../lib/brand';

// Configure isolated test database file
const testDir = path.join(os.tmpdir(), `hireflow_test_env_${process.pid}`);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}
const testDbFile = path.join(testDir, `hireflow_test_db_${Date.now()}.json`);

process.env.HIREFLOW_DATA_FILE = testDbFile;
process.env.DATA_DIR = testDir;
(process.env as any).NODE_ENV = 'test';

// Populate initial test data from sampleSeedData so tests have a clean sandbox
try {
  // Read sample seed data
  const sampleJobs = [
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      title: 'Customer Support Executive (Blended - Inbound/Chat)',
      department: 'Customer Operations',
      city: 'Bengaluru',
      location: 'Koramangala 4th Block, 80 Feet Road',
      map_url: 'https://maps.google.com/?q=Koramangala+4th+Block+Bengaluru',
      openings: 8,
      min_exp_years: 0.5,
      max_exp_years: 3.0,
      min_salary: 20000,
      max_salary: 32000,
      shift_type: 'rotational',
      required_skills: ['Customer Service', 'Chat Support', 'Email Writing', 'CRM Handling', 'Problem Solving'],
      required_languages: ['Hindi', 'English', 'Kannada'],
      status: 'active',
      created_by: 'Alex',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      scoring_rules: {
        id: 'sr_001',
        job_id: 'b0000000-0000-0000-0000-000000000001',
        weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
        criteria: { preferred_cities: ['Bengaluru', 'Bangalore', 'Mysuru'], max_acceptable_salary: 35000, max_notice_days: 30, mandatory_skills: ['Customer Service'] }
      }
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      title: 'Field Sales & Operations Representative',
      department: 'Direct Sales',
      city: 'Mumbai',
      location: 'Andheri East, near Marol Naka metro station',
      map_url: 'https://maps.google.com/?q=Andheri+East+Marol+Naka+Mumbai',
      openings: 12,
      min_exp_years: 1.0,
      max_exp_years: 4.0,
      min_salary: 22000,
      max_salary: 38000,
      shift_type: 'day',
      required_skills: ['Field Sales', 'Lead Generation', 'Merchant Onboarding', 'Negotiation', 'B2B Sales'],
      required_languages: ['Hindi', 'Marathi', 'English'],
      status: 'active',
      created_by: 'Alex',
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      scoring_rules: {
        id: 'sr_002',
        job_id: 'b0000000-0000-0000-0000-000000000002',
        weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
        criteria: { preferred_cities: ['Mumbai', 'Thane', 'Navi Mumbai'], max_acceptable_salary: 40000, max_notice_days: 15, mandatory_skills: ['Field Sales'] }
      }
    }
  ];

  const sampleCandidates = [
    { id: 'c01', full_name: 'Amit Kumar Verma', phone: '+919876500001', email: 'amit.verma@example.com', city: 'Bengaluru', total_experience_months: 24, current_salary: 24000, source: 'workindia', created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
    { id: 'c02', full_name: 'Priya S. Patel', phone: '+919876500002', email: 'priya.patel@example.com', city: 'Bengaluru', total_experience_months: 18, current_salary: 22000, source: 'workindia', created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
    { id: 'c03', full_name: 'Rahul Dev Roy', phone: '+919876500003', email: 'rahul.roy@example.com', city: 'Bengaluru', total_experience_months: 36, current_salary: 28000, source: 'workindia', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
    { id: 'c04', full_name: 'Sneha M. Iyer', phone: '+919876500004', email: 'sneha.iyer@example.com', city: 'Bengaluru', total_experience_months: 12, current_salary: 19000, source: 'workindia', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }
  ];

  const sampleApps = [
    {
      id: 'app_01',
      candidate_id: 'c01',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'new',
      score: 88,
      source: 'workindia',
      token: 'test_token_01',
      token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      assigned_to: 'usr_exec_pallavi',
      assigned_to_name: 'Pallavi Mali'
    },
    {
      id: 'app_02',
      candidate_id: 'c02',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'shortlisted',
      score: 92,
      source: 'workindia',
      token: 'test_token_02',
      token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      assigned_to: 'usr_exec_shradha',
      assigned_to_name: 'Shradha Yadav'
    },
    {
      id: 'app_03',
      candidate_id: 'c03',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'interview_scheduled',
      score: 85,
      source: 'workindia',
      token: 'test_token_03',
      token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      assigned_to: 'usr_exec_pallavi',
      assigned_to_name: 'Pallavi Mali'
    },
    {
      id: 'app_04',
      candidate_id: 'c04',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'new',
      score: 75,
      source: 'workindia',
      token: 'test_token_04',
      token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      assigned_to: 'usr_exec_shradha',
      assigned_to_name: 'Shradha Yadav'
    }
  ];

  // Test bcrypt hash for "testpassword123"
  const testHash = '$2b$10$LV3d541DpzNnndkCvycHjeJwPZr3a9wJ2D0TV1yBJaIIK/GVL9LL2'; // admin123
  const testUsers = [
    {
      id: 'usr_admin_alex',
      email: 'admin@hireflow.internal',
      password_hash: testHash,
      full_name: 'Alex',
      phone: '+91 98765 01000',
      role: 'admin',
      is_active: true,
      must_change_password: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_exec_pallavi',
      email: 'pallavi.mali@hireflow.internal',
      password_hash: testHash,
      full_name: 'Pallavi Mali',
      phone: '+91 98200 12345',
      role: 'hr_executive',
      is_active: true,
      must_change_password: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_exec_shradha',
      email: 'shradha.yadav@hireflow.internal',
      password_hash: testHash,
      full_name: 'Shradha Yadav',
      phone: '+91 98200 67890',
      role: 'hr_executive',
      is_active: true,
      must_change_password: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_exec_02',
      email: 'hr.priya@hireflow.internal',
      password_hash: '$2b$10$disabled_account_demo_inactivated_hash_x99',
      full_name: 'Priya Menon (Demo)',
      phone: '+91 98765 43210',
      role: 'hr_executive',
      is_active: false,
      must_change_password: false,
      created_at: new Date().toISOString()
    }
  ];

  const testDb = {
    jobs: sampleJobs,
    candidates: sampleCandidates,
    applications: sampleApps,
    formAnswers: [],
    candidateNotes: [],
    statusHistory: [],
    messagesLog: [],
    auditLogs: [],
    users: testUsers,
    companySettings: {
      company_name: COMPANY_NAME,
      tagline: COMPANY_TAGLINE,
      hr_name: 'Alex',
      hr_phone: '+91 9876543210',
      default_language: 'en',
      default_tone: 'friendly',
      inactivity_timeout_minutes: 30,
      logo_url: DEFAULT_LOGO_PATH,
      accent_color: '#4f46e5',
      daily_target: 25,
      updated_at: new Date().toISOString(),
    },
    templates: [],
    loginAttempts: []
  };

  fs.writeFileSync(testDbFile, JSON.stringify(testDb, null, 2), 'utf-8');
} catch (e) {
  console.error('Failed to setup test database:', e);
}

afterAll(() => {
  try {
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  } catch (e) {
    // ignore
  }
});
