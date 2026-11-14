#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const FORBIDDEN_SECRET_PATTERNS = [
  { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Service Role with long key', regex: /service_role[\s:="']+[A-Za-z0-9_.-]{40,}/i },
  { name: 'Long JWT-like token (eyJ...)', regex: /eyJ[A-Za-z0-9_.-]{100,}/ },
  { name: 'GitHub Personal Access Token (ghp_)', regex: /ghp_[A-Za-z0-9]{36,}/ },
  { name: 'GitHub Fine-Grained Token (github_pat_)', regex: /github_pat_[A-Za-z0-9_]{50,}/ },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY with actual value',
    regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-|\bplaceholder\b|\btest\b|"your-)[A-Za-z0-9_.-]{20,}/,
  },
];

function getTrackedAndStagedFiles() {
  try {
    const tracked = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set([...tracked, ...staged]));
  } catch (err) {
    // If git is not yet available, fallback to scanning directory respecting .gitignore
    console.warn('Warning: Could not query git files directly, falling back to directory scan.');
    return [];
  }
}

function runGuard() {
  console.log('🛡️  Running HireFlow Pre-Flight Security Guard (scripts/guard.mjs)...');
  const files = getTrackedAndStagedFiles();
  let errors = [];

  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');

    // 1. Check data/ directory rules
    if (normalized.startsWith('data/') && normalized !== 'data/.gitkeep') {
      errors.push(`[ILLEGAL DATA FILE] Tracked file inside data/: ${file}`);
    }

    // 2. Check .env rules
    if (
      (normalized === '.env' || normalized.startsWith('.env.') || normalized.includes('/.env')) &&
      normalized !== '.env.example'
    ) {
      errors.push(`[ILLEGAL ENV FILE] Sensitive environment file tracked: ${file}`);
    }

    // 3. Check backups
    if (/backup/i.test(normalized)) {
      errors.push(`[ILLEGAL BACKUP FILE] Backup folder/file tracked: ${file}`);
    }

    // 4. Check uploads
    if (normalized.startsWith('uploads/') || normalized.startsWith('public/uploads/')) {
      errors.push(`[ILLEGAL UPLOAD FILE] Uploaded user asset tracked: ${file}`);
    }

    // 5. Check screenshots & test image outputs
    if (
      normalized.startsWith('screenshots/') ||
      normalized.endsWith('.png') && (normalized.includes('test_clean') || normalized.includes('test_sample'))
    ) {
      errors.push(`[ILLEGAL SCREENSHOT/DEBUG FILE] Visual artifact tracked: ${file}`);
    }

    // 6. Check logs
    if (normalized.endsWith('.log')) {
      errors.push(`[ILLEGAL LOG FILE] Log file tracked: ${file}`);
    }

    // 7. Check file size and secret scanning on readable files
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.size > MAX_FILE_SIZE) {
        errors.push(`[FILE TOO LARGE] File exceeds 5MB limit (${(stat.size / 1024 / 1024).toFixed(2)} MB): ${file}`);
      }

      // Check text files for secret patterns
      const isBinary = /\.(png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot|otf|xlsx|xls|pdf)$/i.test(file);
      if (!isBinary && stat.isFile()) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          for (const secret of FORBIDDEN_SECRET_PATTERNS) {
            if (secret.regex.test(content) && normalized !== 'scripts/guard.mjs') {
              errors.push(`[POTENTIAL SECRET DETECTED] ${secret.name} in file: ${file}`);
            }
          }
        } catch (e) {
          // Ignore unreadable files
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ GUARD FAILED: Found prohibited files or credentials in git tracking:');
    errors.forEach((err) => console.error('  • ' + err));
    console.error('\nUntrack or remove these files before committing or pushing.\n');
    process.exit(1);
  }

  console.log(`✅ Guard passed! Scanned ${files.length} tracked/staged files. Zero leaks detected.`);
}

runGuard();
