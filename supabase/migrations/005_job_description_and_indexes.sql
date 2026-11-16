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
