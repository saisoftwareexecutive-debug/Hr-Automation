# Changelog

All notable changes to the HireFlow project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- PostgreSQL parity migration `003_cloud_parity_schema.sql` covering users, login attempts, company settings, message templates, import batches, workflow tracking, and Row Level Security (RLS).
- Dedicated cloud repository implementation `src/lib/db/supabaseRepo.ts` with complete signature parity to local JSON repository.
- Transparent storage engine dispatching in `src/lib/db/index.ts` enabled via `DATA_STORAGE_MODE=supabase`.
- Dual-storage parity test suite `src/lib/__tests__/supabaseParity.test.ts` (68/68 tests passing across 11 test suites).
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
