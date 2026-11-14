import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
      const val = trimmed.slice(eqIdx + 1).trim();
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
  console.error('Please configure SUPABASE_SECRET_KEY in .env.local and re-run this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Unambiguous characters (avoiding 0, O, 1, l, I)
const CHARSET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ!@#$%*';

function generateSecurePassword(length = 14) {
  let pwd = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pwd += CHARSET[bytes[i] % CHARSET.length];
  }
  return pwd;
}

const USERS_TO_PROVISION = [
  {
    id: 'usr_admin_alex',
    email: 'admin@hireflow.internal',
    full_name: 'Alex',
    role: 'admin',
  },
  {
    id: 'usr_exec_pallavi',
    email: 'pallavi.mali@hireflow.internal',
    full_name: 'Pallavi Mali',
    role: 'hr_executive',
  },
  {
    id: 'usr_exec_shradha',
    email: 'shradha.yadav@hireflow.internal',
    full_name: 'Shradha Yadav',
    role: 'hr_executive',
  },
];

async function run() {
  console.log('='.repeat(70));
  console.log('Provisioning Supabase Cloud Users for HireFlow');
  console.log(`Target Supabase URL: ${supabaseUrl}`);
  console.log('='.repeat(70));

  const results = [];

  for (const u of USERS_TO_PROVISION) {
    const tempPassword = generateSecurePassword(14);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const { error: upsertErr } = await supabase.from('users').upsert({
      id: u.id,
      email: u.email,
      password_hash: passwordHash,
      full_name: u.full_name,
      role: u.role,
      is_active: true,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (upsertErr) {
      console.error(`❌ Failed to upsert user ${u.email}:`, upsertErr.message);
      process.exit(1);
    }

    // Reset rate-limiting / login attempts for this user
    await supabase.from('login_attempts').delete().eq('email', u.email);

    results.push({
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      tempPassword,
    });
  }

  console.log('\n✅ Successfully provisioned 3 real users in Supabase PostgreSQL!\n');
  console.log('+' + '-'.repeat(68) + '+');
  console.log('| SECURE TEMPORARY CREDENTIALS GENERATED (DISPLAY ONCE, NEVER STORE) |');
  console.log('+' + '-'.repeat(68) + '+');
  for (const r of results) {
    console.log(`| User:     ${r.fullName.padEnd(56)}|`);
    console.log(`| Role:     ${r.role.padEnd(56)}|`);
    console.log(`| Email:    ${r.email.padEnd(56)}|`);
    console.log(`| Temp Pwd: ${r.tempPassword.padEnd(56)}|`);
    console.log('+' + '-'.repeat(68) + '+');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
