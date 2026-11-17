-- =========================================================================
-- HireFlow Full Database Schema Bundle
-- Generated: 2026-11-17T06:34:20.401Z
-- For Supabase Project: dewcnqoreuhnrmvswxuf (Tokyo, ap-northeast-1)
-- =========================================================================

-- -------------------------------------------------------------------------
-- MIGRATION: 001_initial_schema.sql
-- -------------------------------------------------------------------------

-- HireFlow PostgreSQL Database Schema for Supabase
-- Designed specifically for high-efficiency, zero-cost Indian HR recruiting workflows

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (HR Users & Roles)
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'hr_executive')) DEFAULT 'hr_executive',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    title TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Operations',
    city TEXT NOT NULL,
    openings INTEGER NOT NULL DEFAULT 1,
    min_exp_years NUMERIC(4, 1) NOT NULL DEFAULT 0,
    max_exp_years NUMERIC(4, 1) NOT NULL DEFAULT 5,
    min_salary NUMERIC(10, 2) NOT NULL DEFAULT 15000,
    max_salary NUMERIC(10, 2) NOT NULL DEFAULT 35000,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night', 'rotational', 'any')) DEFAULT 'day',
    required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_languages JSONB NOT NULL DEFAULT '["Hindi", "English"]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
    created_by TEXT DEFAULT 'HR Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SCORING RULES PER JOB (Transparent, Fair-Hiring Compliant)
CREATE TABLE IF NOT EXISTS scoring_rules (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
    weights JSONB NOT NULL DEFAULT '{
        "city_weight": 20,
        "exp_weight": 25,
        "skills_weight": 25,
        "salary_weight": 15,
        "notice_weight": 10,
        "shift_weight": 5
    }'::jsonb,
    criteria JSONB NOT NULL DEFAULT '{
        "preferred_cities": [],
        "max_acceptable_salary": null,
        "max_notice_days": 30,
        "mandatory_skills": []
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CANDIDATES (Master record de-duplicated by Indian E.164 phone)
CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    city TEXT,
    total_experience_months INTEGER DEFAULT 0,
    current_salary NUMERIC(10, 2),
    source TEXT NOT NULL DEFAULT 'workindia',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);

-- 5. APPLICATIONS (Candidate application per job with state machine & token)
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('new', 'form_sent', 'replied', 'shortlisted', 'interview', 'selected', 'rejected')) DEFAULT 'new',
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    score_breakdown JSONB NOT NULL DEFAULT '{
        "city_score": 0,
        "exp_score": 0,
        "skills_score": 0,
        "salary_score": 0,
        "notice_score": 0,
        "shift_score": 0,
        "notes": []
    }'::jsonb,
    token TEXT NOT NULL UNIQUE,
    token_expires_at TIMESTAMPTZ NOT NULL,
    form_sent_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    interview_scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_candidate_job UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_token ON applications(token);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_score ON applications(score DESC);

-- 6. FORM ANSWERS (Candidate submitted answers)
CREATE TABLE IF NOT EXISTS form_answers (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
    current_city TEXT NOT NULL,
    experience_years NUMERIC(4, 1) NOT NULL,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_salary NUMERIC(10, 2) NOT NULL,
    notice_period_days INTEGER NOT NULL DEFAULT 0,
    shift_preference TEXT NOT NULL DEFAULT 'any',
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_interview_slot TEXT,
    consent_given BOOLEAN NOT NULL DEFAULT true,
    consent_text TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. MESSAGES LOG (Audit trail of WhatsApp & SMS triggers)
CREATE TABLE IF NOT EXISTS messages_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('screening_invite', 'reminder_24h', 'interview_invite', 'rejection', 'custom')),
    language TEXT NOT NULL CHECK (language IN ('hi', 'en')),
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
    message_body TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. STATUS HISTORY (Audit trail of pipeline transitions)
CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'System',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_app ON status_history(application_id);

-- 9. CANDIDATE NOTES
CREATE TABLE IF NOT EXISTS candidate_notes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL DEFAULT 'HR Executive',
    note_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. AUDIT LOG (Complete system event trail)
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow public read & submission ONLY on applications by valid token, and form_answers
CREATE POLICY "Public can view application by token"
    ON applications FOR SELECT
    USING (token IS NOT NULL AND token_expires_at > now());

CREATE POLICY "Public can insert form answers"
    ON form_answers FOR INSERT
    WITH CHECK (true);

-- Authenticated HR users have full access
CREATE POLICY "Authenticated users have full access to profiles"
    ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to jobs"
    ON jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to scoring_rules"
    ON scoring_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to candidates"
    ON candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to applications"
    ON applications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to form_answers"
    ON form_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to messages_log"
    ON messages_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to status_history"
    ON status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to candidate_notes"
    ON candidate_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to audit_log"
    ON audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- MIGRATION: 002_add_job_location.sql
-- -------------------------------------------------------------------------

-- Migration: 002_add_job_location.sql
-- Add specific work location/area and google maps link to jobs table

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS map_url TEXT;

COMMENT ON COLUMN jobs.location IS 'Specific work location/area or landmark shown to candidates (max 200 chars)';
COMMENT ON COLUMN jobs.map_url IS 'Optional Google Maps link or auto-generated search URL';

-- -------------------------------------------------------------------------
-- MIGRATION: 003_cloud_parity_schema.sql
-- -------------------------------------------------------------------------

-- Migration: 003_cloud_parity_schema.sql
-- Completes full feature parity between local JSON database and Supabase PostgreSQL

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'hr_executive')) DEFAULT 'hr_executive',
    is_active BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. LOGIN ATTEMPTS (BRUTE-FORCE & RATE-LIMITING)
CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON login_attempts(timestamp DESC);

-- 3. COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
    company_name TEXT NOT NULL,
    tagline TEXT,
    hr_name TEXT NOT NULL,
    hr_phone TEXT NOT NULL,
    default_language TEXT NOT NULL CHECK (default_language IN ('hi', 'en')) DEFAULT 'en',
    default_tone TEXT NOT NULL DEFAULT 'friendly',
    inactivity_timeout_minutes INTEGER NOT NULL DEFAULT 30,
    logo_url TEXT,
    accent_color TEXT,
    daily_target INTEGER DEFAULT 50,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. MESSAGE TEMPLATES & VERSIONING
CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    template_type TEXT NOT NULL CHECK (template_type IN ('screening_invite', 'reminder_24h', 'interview_invite', 'rejection')),
    language TEXT NOT NULL CHECK (language IN ('hi', 'en')),
    tone TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL DEFAULT 'System',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_templates_type_lang_tone ON message_templates(template_type, language, tone);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON message_templates(is_active);

-- 5. IMPORT BATCHES & BATCH UNDO
CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    filename TEXT NOT NULL,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    imported_by TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_import_batches_job_id ON import_batches(job_id);

-- 6. UPGRADE APPLICATIONS TABLE WITH WORKFLOW & ASSIGNMENT COLUMNS
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS assigned_to TEXT,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS call_outcome TEXT,
ADD COLUMN IF NOT EXISTS call_back_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_assigned_to ON applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_applications_call_outcome ON applications(call_outcome);
CREATE INDEX IF NOT EXISTS idx_applications_batch_id ON applications(batch_id);

-- 7. UPGRADE CANDIDATES & NOTES
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS batch_id TEXT;

ALTER TABLE candidate_notes
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 8. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- 9. AUTHENTICATED HR ACCESS POLICIES
CREATE POLICY "Authenticated users have full access to users"
    ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to login_attempts"
    ON login_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to company_settings"
    ON company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to message_templates"
    ON message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to import_batches"
    ON import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- MIGRATION: 004_rls_deny_all_public.sql
-- -------------------------------------------------------------------------

-- Migration: 004_rls_deny_all_public.sql
-- Strict Row Level Security: Deny all direct client/browser access by default.
-- All database operations execute exclusively on the server using the Supabase Secret Key (Service Role),
-- which bypasses RLS. Zero policies exist for anon and authenticated roles.

-- 1. Ensure RLS is enabled on every table
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS import_batches ENABLE ROW LEVEL SECURITY;

-- 2. Drop all policies from initial schema (001)
DROP POLICY IF EXISTS "Public can view application by token" ON applications;
DROP POLICY IF EXISTS "Public can insert form answers" ON form_answers;
DROP POLICY IF EXISTS "Authenticated users have full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users have full access to jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users have full access to scoring_rules" ON scoring_rules;
DROP POLICY IF EXISTS "Authenticated users have full access to candidates" ON candidates;
DROP POLICY IF EXISTS "Authenticated users have full access to applications" ON applications;
DROP POLICY IF EXISTS "Authenticated users have full access to form_answers" ON form_answers;
DROP POLICY IF EXISTS "Authenticated users have full access to messages_log" ON messages_log;
DROP POLICY IF EXISTS "Authenticated users have full access to status_history" ON status_history;
DROP POLICY IF EXISTS "Authenticated users have full access to candidate_notes" ON candidate_notes;
DROP POLICY IF EXISTS "Authenticated users have full access to audit_log" ON audit_log;

-- 3. Drop all policies from cloud parity schema (003)
DROP POLICY IF EXISTS "Authenticated users have full access to users" ON users;
DROP POLICY IF EXISTS "Authenticated users have full access to login_attempts" ON login_attempts;
DROP POLICY IF EXISTS "Authenticated users have full access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users have full access to message_templates" ON message_templates;
DROP POLICY IF EXISTS "Authenticated users have full access to import_batches" ON import_batches;

-- 4. Result: Zero policies for 'anon' and 'authenticated' roles.
-- Any direct requests made using the Publishable / Anon key will be completely rejected by PostgreSQL.

-- -------------------------------------------------------------------------
-- MIGRATION: 005_job_description_and_indexes.sql
-- -------------------------------------------------------------------------

-- =========================================================================
-- Migration 005: Add Job Description Column and Performance Indexes
-- Generated: 2026-11-16
-- Target: Supabase PostgreSQL (Project dewcnqoreuhnrmvswxuf)
-- =========================================================================

-- 1. Schema Expansion for Job Descriptions and Flexible Salary
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jobs ALTER COLUMN min_salary DROP NOT NULL;
ALTER TABLE jobs ALTER COLUMN max_salary DROP NOT NULL;

-- 2. Database Indexes for High-Traffic Queries
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_to ON applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- -------------------------------------------------------------------------
-- MIGRATION: 006_batch_send_last_reminder.sql
-- -------------------------------------------------------------------------

-- Migration 006: Batch Send and Reminder Tracking
-- Adds last_reminder_at column and index to applications table.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_last_reminder_at
  ON applications(last_reminder_at);

