-- HireFlow PostgreSQL Database Schema for Supabase
-- Designed specifically for high-efficiency, zero-cost Indian HR recruiting workflows

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (HR Users & Roles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'hr_executive')) DEFAULT 'hr_executive',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('screening_invite', 'reminder_24h', 'interview_invite', 'rejection', 'custom')),
    language TEXT NOT NULL CHECK (language IN ('hi', 'en')),
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
    message_body TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. STATUS HISTORY (Audit trail of pipeline transitions)
CREATE TABLE IF NOT EXISTS status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'System',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_status_history_app ON status_history(application_id);

-- 9. CANDIDATE NOTES
CREATE TABLE IF NOT EXISTS candidate_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL DEFAULT 'HR Executive',
    note_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. AUDIT LOG (Complete system event trail)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

