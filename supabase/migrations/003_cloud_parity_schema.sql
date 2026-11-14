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
