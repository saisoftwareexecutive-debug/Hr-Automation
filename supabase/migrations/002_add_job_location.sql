-- Migration: 002_add_job_location.sql
-- Add specific work location/area and google maps link to jobs table

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS map_url TEXT;

COMMENT ON COLUMN jobs.location IS 'Specific work location/area or landmark shown to candidates (max 200 chars)';
COMMENT ON COLUMN jobs.map_url IS 'Optional Google Maps link or auto-generated search URL';

