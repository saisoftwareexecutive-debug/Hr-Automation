-- Migration 006: Batch Send and Reminder Tracking
-- Adds last_reminder_at column and index to applications table.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_last_reminder_at
  ON applications(last_reminder_at);
