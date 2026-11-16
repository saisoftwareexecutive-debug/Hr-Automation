import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dewcnqoreuhnrmvswxuf.supabase.co';
const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!pubKey || !secKey) {
  console.error('Missing pubKey or secKey in environment.');
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, pubKey, { auth: { persistSession: false } });
const adminClient = createClient(supabaseUrl, secKey, { auth: { persistSession: false } });

const TABLES = [
  'profiles',
  'jobs',
  'scoring_rules',
  'candidates',
  'applications',
  'form_answers',
  'messages_log',
  'status_history',
  'candidate_notes',
  'audit_log',
  'users',
  'login_attempts',
  'company_settings',
  'message_templates',
  'import_batches',
];

async function verify() {
  console.log('--- Checking Supabase Tables & RLS Status ---');
  let allTablesExist = true;
  let allAnonDenied = true;

  for (const table of TABLES) {
    // 1. Check with admin client
    const { error: adminErr } = await adminClient.from(table).select('*').limit(1);
    if (adminErr) {
      console.log(`[ADMIN FAIL] Table "${table}" error: ${adminErr.message} (code: ${adminErr.code})`);
      allTablesExist = false;
    } else {
      // 2. Check with anon client (Publishable key)
      // Since zero policies exist, anon select should return empty data or error
      const { data: anonData, error: anonErr } = await anonClient.from(table).select('*').limit(5);
      // In PostgreSQL RLS with no policies, select returns empty array [] with no rows
      // And insert/update/delete fails
      const { error: insertErr } = await anonClient.from(table).insert({ id: 'probe_test_id' });
      const insertDenied = Boolean(insertErr);
      const readDenied = (anonErr !== null) || (Array.isArray(anonData) && anonData.length === 0);

      console.log(`Table "${table}": Admin OK | Anon Read: ${readDenied ? 'DENIED/EMPTY' : 'LEAK'} | Anon Insert: ${insertDenied ? 'DENIED' : 'ALLOWED'}`);
      if (!readDenied || !insertDenied) {
        allAnonDenied = false;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`All 15 tables exist: ${allTablesExist ? 'YES' : 'NO'}`);
  console.log(`Publishable key denied on all tables: ${allAnonDenied ? 'YES' : 'NO'}`);
}

verify().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
