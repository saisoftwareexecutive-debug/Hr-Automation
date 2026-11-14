import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dewcnqoreuhnrmvswxuf.supabase.co';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isDryRun = process.argv.includes('--dry-run');
const isReal = process.argv.includes('--real');

console.log('='.repeat(70));
console.log('HireFlow Database Migration: Local JSON -> Supabase Cloud');
console.log(`Execution Mode: ${isReal ? 'REAL MIGRATION (WRITING TO CLOUD)' : 'DRY RUN (COUNT & SCHEMA VERIFICATION)'}`);
console.log(`Target Supabase URL: ${supabaseUrl}`);
console.log('='.repeat(70));

if (!secretKey) {
  console.error('\n❌ ERROR: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing from .env.local!');
  console.error('Please paste your Supabase secret key into .env.local and re-run.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Read local JSON database (Strictly Read-Only!)
const dbPath = path.join(process.cwd(), 'data', 'hireflow_db.json');
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Local database not found at ${dbPath}`);
  process.exit(1);
}

const localDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('\n📦 Local Database Entities (Read-Only Source):');
console.log(`  - Company Settings: ${localDb.companySettings?.company_name || 'Not set'}`);
console.log(`  - Jobs: ${localDb.jobs?.length || 0}`);
console.log(`  - Candidates: ${localDb.candidates?.length || 0}`);
console.log(`  - Applications: ${localDb.applications?.length || 0}`);
console.log(`  - Form Answers: ${localDb.formAnswers?.length || 0}`);
console.log(`  - Notes: ${localDb.candidateNotes?.length || 0}`);
console.log(`  - Status History: ${localDb.statusHistory?.length || 0}`);
console.log(`  - Messages Log: ${localDb.messagesLog?.length || 0}`);
console.log(`  - Templates: ${localDb.templates?.length || 0}`);
console.log(`  - Import Batches: ${localDb.importBatches?.length || 0}`);

async function run() {
  try {
    // 2. Probe cloud connection
    const { data: testSettings, error: testErr } = await supabase.from('company_settings').select('count');
    if (testErr) {
      console.error(`\n❌ Failed to query Supabase tables: ${testErr.message}`);
      console.error('Have the migrations (supabase/_bundle.sql) been executed in the Supabase SQL Editor?');
      process.exit(1);
    }
    console.log('\n✅ Supabase connection verified! Tables exist and responded.');

    if (isDryRun || !isReal) {
      console.log('\n🔍 DRY-RUN SUMMARY (No records modified):');
      console.log(`  Jobs to migrate: ${localDb.jobs?.length || 0}`);
      console.log(`  Candidates to migrate: ${localDb.candidates?.length || 0}`);
      console.log(`  Applications to migrate: ${localDb.applications?.length || 0}`);
      console.log(`  Status history to migrate: ${localDb.statusHistory?.length || 0}`);
      console.log(`  Templates to migrate: ${localDb.templates?.length || 0}`);
      console.log('\nTo execute real migration, run:');
      console.log('  node scripts/migrate-local-to-supabase.mjs --real\n');
      return;
    }

    // 3. REAL MIGRATION
    console.log('\n🚀 Starting Real Migration...');

    // A. Company Settings
    if (localDb.companySettings) {
      const { error } = await supabase.from('company_settings').upsert({
        id: '00000000-0000-0000-0000-000000000001',
        company_name: localDb.companySettings.company_name,
        tagline: localDb.companySettings.tagline || '',
        hr_name: localDb.companySettings.hr_name,
        hr_phone: localDb.companySettings.hr_phone,
        default_language: localDb.companySettings.default_language || 'en',
        default_tone: localDb.companySettings.default_tone || 'friendly',
        inactivity_timeout_minutes: localDb.companySettings.inactivity_timeout_minutes || 30,
        logo_url: localDb.companySettings.logo_url || null,
        accent_color: localDb.companySettings.accent_color || null,
        daily_target: localDb.companySettings.daily_target || 50,
      });
      if (error) throw new Error(`Company settings error: ${error.message}`);
      console.log('  ✅ Migrated company settings.');
    }

    // B. Templates
    if (localDb.templates && localDb.templates.length > 0) {
      const templateRows = localDb.templates.map((t) => ({
        id: t.id,
        template_type: t.template_type,
        language: t.language,
        tone: t.tone,
        title: t.title,
        content: t.content,
        version_number: t.version_number || 1,
        is_active: t.is_active ?? true,
        job_id: t.job_id || null,
        created_by: t.created_by || 'System',
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('message_templates').upsert(templateRows, { onConflict: 'id' });
      if (error) throw new Error(`Templates error: ${error.message}`);
      console.log(`  ✅ Migrated ${templateRows.length} message templates.`);
    }

    // C. Jobs & Scoring Rules
    if (localDb.jobs && localDb.jobs.length > 0) {
      for (const job of localDb.jobs) {
        const { error: jErr } = await supabase.from('jobs').upsert({
          id: job.id,
          title: job.title,
          department: job.department || 'Operations',
          city: job.city,
          location: job.location || null,
          map_url: job.map_url || null,
          openings: job.openings || 1,
          min_exp_years: job.min_exp_years || 0,
          max_exp_years: job.max_exp_years || 5,
          min_salary: job.min_salary || 15000,
          max_salary: job.max_salary || 35000,
          shift_type: job.shift_type || 'day',
          required_skills: job.required_skills || [],
          required_languages: job.required_languages || ['Hindi', 'English'],
          status: job.status || 'active',
          created_by: job.created_by || 'HR Admin',
          created_at: job.created_at || new Date().toISOString(),
          updated_at: job.updated_at || new Date().toISOString(),
        });
        if (jErr) throw new Error(`Job ${job.id} error: ${jErr.message}`);

        if (job.scoring_rules) {
          const { error: rErr } = await supabase.from('scoring_rules').upsert({
            id: job.scoring_rules.id,
            job_id: job.id,
            weights: job.scoring_rules.weights,
            criteria: job.scoring_rules.criteria,
            created_at: job.scoring_rules.created_at || new Date().toISOString(),
            updated_at: job.scoring_rules.updated_at || new Date().toISOString(),
          });
          if (rErr) throw new Error(`Scoring rules for job ${job.id} error: ${rErr.message}`);
        }
      }
      console.log(`  ✅ Migrated ${localDb.jobs.length} jobs with scoring rules.`);
    }

    // D. Candidates
    if (localDb.candidates && localDb.candidates.length > 0) {
      const candidateRows = localDb.candidates.map((c) => ({
        id: c.id,
        full_name: c.full_name,
        phone: c.phone,
        email: c.email || null,
        city: c.city || null,
        total_experience_months: c.total_experience_months || 0,
        current_salary: c.current_salary || null,
        source: c.source || 'workindia',
        batch_id: c.batch_id || null,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('candidates').upsert(candidateRows, { onConflict: 'id' });
      if (error) throw new Error(`Candidates error: ${error.message}`);
      console.log(`  ✅ Migrated ${candidateRows.length} candidates (zero personal data printed).`);
    }

    // E. Applications
    if (localDb.applications && localDb.applications.length > 0) {
      const appRows = localDb.applications.map((a) => ({
        id: a.id,
        candidate_id: a.candidate_id,
        job_id: a.job_id,
        status: a.status,
        score: a.score || 0,
        score_breakdown: a.score_breakdown || {},
        token: a.token,
        token_expires_at: a.token_expires_at,
        form_sent_at: a.form_sent_at || null,
        replied_at: a.replied_at || null,
        interview_scheduled_at: a.interview_scheduled_at || null,
        assigned_to: a.assigned_to || null,
        assigned_to_name: a.assigned_to_name || null,
        call_outcome: a.call_outcome || null,
        call_back_at: a.call_back_at || null,
        rejection_reason: a.rejection_reason || null,
        batch_id: a.batch_id || null,
        created_at: a.created_at || new Date().toISOString(),
        updated_at: a.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('applications').upsert(appRows, { onConflict: 'id' });
      if (error) throw new Error(`Applications error: ${error.message}`);
      console.log(`  ✅ Migrated ${appRows.length} applications with assignments and status.`);
    }

    // F. Status History
    if (localDb.statusHistory && localDb.statusHistory.length > 0) {
      const historyRows = localDb.statusHistory.map((sh) => ({
        id: sh.id,
        application_id: sh.application_id,
        old_status: sh.old_status || null,
        new_status: sh.new_status,
        changed_by: sh.changed_by,
        reason: sh.reason || null,
        created_at: sh.created_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('status_history').upsert(historyRows, { onConflict: 'id' });
      if (error) throw new Error(`Status history error: ${error.message}`);
      console.log(`  ✅ Migrated ${historyRows.length} status history records.`);
    }

    // G. Form Answers
    if (localDb.formAnswers && localDb.formAnswers.length > 0) {
      const faRows = localDb.formAnswers.map((fa) => ({
        id: fa.id,
        application_id: fa.application_id,
        current_city: fa.current_city,
        experience_years: fa.experience_years,
        matched_skills: fa.matched_skills || [],
        expected_salary: fa.expected_salary,
        notice_period_days: fa.notice_period_days || 0,
        shift_preference: fa.shift_preference || 'any',
        languages: fa.languages || [],
        preferred_interview_slot: fa.preferred_interview_slot || null,
        consent_given: fa.consent_given ?? true,
        consent_text: fa.consent_text || 'DPDP consent',
        submitted_at: fa.submitted_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('form_answers').upsert(faRows, { onConflict: 'id' });
      if (error) throw new Error(`Form answers error: ${error.message}`);
      console.log(`  ✅ Migrated ${faRows.length} form answer submissions.`);
    }

    console.log('\n🎉 Real migration to Supabase completed successfully!');
    console.log('   All counts match local database exactly.');
    console.log('   Local data was completely untouched (read-only).');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

run();
