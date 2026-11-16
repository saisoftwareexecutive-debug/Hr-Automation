import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
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
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!secretKey) {
  console.error('\n❌ ERROR: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing from .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('='.repeat(70));
  console.log('Provisioning 3 Supabase Cloud Users for HireFlow');
  console.log(`Target Supabase URL: ${supabaseUrl}`);
  console.log('='.repeat(70));

  const alexPass = process.env.TEMP_ALEX_PWD;
  const pallaviPass = process.env.TEMP_PALLAVI_PWD;
  const shradhaPass = process.env.TEMP_SHRADHA_PWD;

  if (!alexPass || !pallaviPass || !shradhaPass) {
    console.error('Missing temp passwords in runtime process.env');
    process.exit(1);
  }

  // 1. Purge legacy or demo users from Supabase
  const { data: existingUsers, error: listErr } = await supabase.from('users').select('id, email');
  if (listErr) {
    console.error('Failed to list existing users:', listErr.message);
    process.exit(1);
  }

  const allowedEmails = ['admin@hireflow.internal', 'pallavimali@123', 'shradha.yadav@hireflow.internal'];
  for (const eu of existingUsers || []) {
    if (!allowedEmails.includes(eu.email.toLowerCase())) {
      console.log(`Removing non-production/demo user from Supabase: ${eu.email}`);
      await supabase.from('users').delete().eq('id', eu.id);
    }
  }

  // 2. Hash passwords
  const salt = await bcrypt.genSalt(10);
  const alexHash = await bcrypt.hash(alexPass, salt);
  const pallaviHash = await bcrypt.hash(pallaviPass, salt);
  const shradhaHash = await bcrypt.hash(shradhaPass, salt);

  const USERS = [
    {
      id: 'usr_admin_alex',
      email: 'admin@hireflow.internal',
      full_name: 'Alex',
      role: 'admin',
      hash: alexHash,
      mustChange: true,
    },
    {
      id: 'usr_exec_pallavi',
      email: 'Pallavimali@123',
      full_name: 'Pallavi Mali',
      role: 'hr_executive',
      hash: pallaviHash,
      mustChange: true,
    },
    {
      id: 'usr_exec_shradha',
      email: 'shradha.yadav@hireflow.internal',
      full_name: 'Shradha Yadav',
      role: 'hr_executive',
      hash: shradhaHash,
      mustChange: true,
    },
  ];

  for (const u of USERS) {
    const { error: upsertErr } = await supabase.from('users').upsert({
      id: u.id,
      email: u.email,
      password_hash: u.hash,
      full_name: u.full_name,
      role: u.role,
      is_active: true,
      must_change_password: u.mustChange,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (upsertErr) {
      console.error(`Failed to upsert user ${u.email}:`, upsertErr.message);
      process.exit(1);
    }

    // Clear all login attempts / rate limits
    await supabase.from('login_attempts').delete().ilike('email', u.email);
  }

  // Clear any residual rate limiting
  await supabase.from('login_attempts').delete().neq('id', 'keep_table_structure_probe');

  console.log('✅ Successfully provisioned 3 active users in Supabase PostgreSQL.');
  console.log('   All 3 users set to must_change_password: true.');
  console.log('   Zero plaintext passwords printed or stored.');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
