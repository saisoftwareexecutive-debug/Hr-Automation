# Changelog

All notable changes to the HireFlow project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security & Sanitization
- Removed all user objects, passwords, and static bcrypt password hashes from git-tracked source code (`src/lib/db/initialData.ts`, `src/lib/db/index.ts`, `supabase/seed.sql`).
- Permanently deleted legacy demo dataset `src/lib/db/sampleSeedData.ts` to ensure zero mock candidate or hash exposure in public git history.
- Added strict Bcrypt Password Hash pattern detection into pre-flight security guard (`scripts/guard.mjs`).
- Enforced strict non-fallback cloud mode: when `DATA_STORAGE_MODE=supabase`, the application throws explicit errors if credentials or database connections fail, preventing silent fallbacks to local mode in production.
- Verified Row Level Security (RLS) on all 15 tables with zero policies for anon/authenticated roles, with automated verification (`scripts/verify_supabase_rls.mjs`).

### Added
- Completed Supabase cloud migration: Company Settings (1), Message Templates (8), Jobs (1), Candidates (10), Applications (10), Status History (9).
- Provisioned exactly 3 active production accounts in Supabase PostgreSQL (Alex, Pallavi Mali, Shradha Yadav) with `must_change_password: true` and cleared lockouts.
- Updated build stamp to `Build 2026-11-16 12:45 IST`.
- Dynamic build stamp generation in `src/lib/version.ts` linked to `NEXT_PUBLIC_BUILD_TIME` (`Build 2026-11-16 12:45 IST`).
- Configured dynamic rendering (`force-dynamic`) on `/login` route to prevent CDN edge-cache staleness of build stamps and form states.
- Updated Pallavi Mali's recruiter account with dedicated Login ID (`Pallavimali@123`), bcrypt hash, active status, and HR Executive role permissions.
- Upgraded login input validation to accept case-insensitive alphanumeric login IDs without browser type constraints, maintaining existing UI and labels.
- Added comprehensive authentication test for Pallavi Mali account in `src/lib/__tests__/auth.test.ts` (71/71 tests passing).
- Strict Row Level Security deny-all policy for public/anon roles (`004_rls_deny_all_public.sql`).
- Single-file migration bundler `scripts/bundle_migrations.mjs` generating `supabase/_bundle.sql` (`npm run db:bundle`).
- Local JSON to Supabase PostgreSQL cloud migration runner `scripts/migrate-local-to-supabase.mjs` (`--dry-run` and `--real`).
- Supabase user provisioning runner `scripts/provision_supabase_users.mjs` with cryptographically secure temporary passwords.
- Real-time cloud database connectivity probe and latency telemetry at `/api/health`.
- Indian Standard Time (`Asia/Kolkata`) date and timestamp formatting utilities in `src/lib/dateUtils.ts`.
- Cryptographic HMAC-SHA256 session cookie signing with backward compatibility in `src/lib/auth.ts`.
- Production HTTP security headers in `next.config.mjs` (CSP framing, nosniff, referrer, permissions policy, noindex).
- PostgreSQL parity migration `003_cloud_parity_schema.sql` covering users, login attempts, company settings, message templates, import batches, workflow tracking, and Row Level Security (RLS).
- Dedicated cloud repository implementation `src/lib/db/supabaseRepo.ts` with complete signature parity to local JSON repository.
- Transparent storage engine dispatching in `src/lib/db/index.ts` enabled via `DATA_STORAGE_MODE=supabase`.
- Dual-storage parity test suite `src/lib/__tests__/supabaseParity.test.ts` (70/70 tests passing across 11 test suites).
- Cloud mode telemetry support in Admin `/health` diagnostics page.

## [0.1.0] - 2026-11-14

### Initial Public Repository Release & Cloud Production Readiness

#### Added
- Full end-to-end applicant tracking, scoring, and WhatsApp communication desk for Chhatrapati Shivaji’s Creative Solutions.
- Objective fair-hiring scoring engine complying with DPDP Act 2023 principles.
- Brand identity module (`src/lib/brand.ts`) enforcing typographic apostrophe (`’`) single source of truth.
- Dual storage engine support: offline local JSON store (`local`) and cloud PostgreSQL (`supabase`).
- Automated pre-flight security scanner (`scripts/guard.mjs`) and verify command (`npm run verify`).
- Continuous Integration workflow (`.github/workflows/ci.yml`) testing Node 20 builds and security policies.
- Multi-resolution brand assets: favicon set (16/32/48), apple-icon, PWA icons, and webmanifest.
- One-click Windows offline launchers: `START_HIREFLOW.bat` and `STOP_HIREFLOW.bat`.
- Comprehensive documentation: `docs/DEPLOY.md`, `README.md`, `CONTRIBUTING.md`.

#### Security
- Zero demo profiles or placeholder credentials in production builds.
- Strict `.gitignore` preventing commits of data stores, backups, uploaded files, or `.env` files.
- Enforced HTTP-only session cookies and bcrypt password hashing.
