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
