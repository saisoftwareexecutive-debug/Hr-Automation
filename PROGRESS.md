# HireFlow — Progress Tracker & Production Readiness Log

## 📜 STANDING RULES (Apply to EVERY future task and conversation)
1. **After every completed change to code, config, docs or tests**: run `npm run verify`. Only if it passes: update `CHANGELOG.md` (one short line per change, newest first), commit with `"type: short summary"` (feat, fix, chore, docs, test, refactor), and push to `main`. Never push broken code, never use `--no-verify`, never force-push.
2. **Before every push**: `git status` must show no data, backup, upload, screenshot or `.env` files, and `npm run guard` must pass.
3. **After a push to main**: Vercel deploys automatically: check that the deployment succeeded and that `/api/health` returns OK; if the deployment fails, fix it first and report it.
4. **Database changes**: always come as a NEW migration file; state exactly when it must be run, and never run destructive SQL without user confirmation.
5. **Release tagging**: tag a release (`v0.1.1`, `v0.2.0`, etc.) when a milestone is completed.
6. **Authentication / Push failures**: if a push or deployment fails (sign-in, network, rejected, build error), stop and explain the exact reason and required user action. No retry loops, no workarounds around authentication.
7. **Reporting requirement**: every final report must contain `"GitHub: pushed commit <short hash> - <message>"` with the link `https://github.com/saisoftwareexecutive-debug/Hr-Automation/commit/<full hash>`, and `"Live: <url> - deployed / failed"`.
8. **Data Security**: NEVER commit or print real candidate data, passwords, or keys in code, docs, logs, tests, or chat.

---

**Company:** Chhatrapati Shivaji’s Creative Solutions  
**Last updated:** 2026-11-19 21:45 IST  
**Backup:** backups/hireflow_db_backup_2026-11-19T15-07-16-944Z.json & backups/supabase_backup_2026-11-19T15-07-16-944Z.json ✅  
**Repository:** https://github.com/saisoftwareexecutive-debug/Hr-Automation.git (main)  
**Tests:** 109/109 passing across 13 test files (`npm test`) ✅  
**Guard:** 0 leaks or prohibited files tracked (`npm run guard`) ✅  
**Build:** Passes cleanly (`npm run build` — 30/30 routes generated) ✅  

---

## 🚧 Active Unfinished Tasks (In Progress)
- [x] **D1**: Multi-sheet auto-detection and smart candidate sheet scoring (`Applicants` over `Job Description`).
- [x] **D2**: Mode switcher: "All rows go to one job" vs "Read the job from my Excel column".
- [x] **D3**: Smart Job Matching table with exact, normalized, token overlap (>=80%), and manual assignment/skip options.
- [x] **D4**: Robust Experience parser ("Fresher"=0, months, years, ranges) and Salary parser (monthly INR, LPA, ranges, k).
- [x] **D5**: Fair hiring column detection (auto-ignore gender, age, religion, photo, marital status).
- [x] **D6**: Import Wizard UI overhaul: Collapsible Job Details card, smart column mapping, preview table with raw vs parsed badges, success screen with direct actions.
- [x] **D7**: Pipeline & Candidate directory integration: Instant `onChange` job filter, batch banner with formatted timestamp and "(Show everyone)", and "New import" tags.
- [x] **D8**: On-page Safe Undo Import functionality with batch tracking and orphan candidate cleanup.
- [x] **D9**: Step 0 Safety Backup & Step 1 Root Cause Analysis completed.
- [ ] **D10**: Apply database repairs for damaged import batches (Awaiting user approval on DRY RUN report).
- [x] **A0**: Add `description` text column and allow null salary in DB schema and types (Migration 005).
- [x] **A1**: Create Health Coordinator (Hospital Coordinator) job (Pan India, Rs 12,000-15,000, food/acc/travel) in local & live DB.
- [x] **A2**: Create Medical Coordination Officer (MCO) job (unbiased, zero gender clause) from MCO JD in local & live DB.
- [x] **A3**: Implement `isAnyCityJob` in `src/lib/scoring.ts` & unit tests for Pan India applicant matching.
- [x] **A4**: Fix HR Manager salary to not specified (`null`), card display "As per company standards" (never "Rs 0"). Check Admin Manager salary text.
- [x] **A5**: Store complete structured job descriptions (11 sections) for all 7 jobs into DB via git-ignored script.
- [x] **A6**: Add "View details" button & modal on job cards and description field in Job Edit form; verify public `/apply/<token>` & template variables.
- [x] **B1**: Measure baseline live site performance across routes.
- [x] **B2**: Set Vercel function region to Tokyo (`hnd1`) in `vercel.json`.
- [x] **B3**: Add database indexes in Migration 005 and run on Supabase; optimize queries.
- [x] **B4**: Add in-memory caching for settings, templates, jobs with proper invalidation; cheap session checks.
- [x] **B5**: Dynamic imports for heavy frontend libraries (Recharts, xlsx).
- [x] **B6**: Measure live performance after deployment, run Playwright verification, verify 7 jobs on live site.
- [x] **C1**: Implement High-Velocity Batch Send (`/batch-send`) with 3-step wizard (Choose, Send, Summary).
- [x] **C2**: Free-only WhatsApp click-to-chat integration (`wa.me` in reusable `hireflow_whatsapp` window) with zero bots or scraping.
- [x] **C3**: Concurrency protection, duplicate prevention, and stage validation for screening and reminder modes.
- [x] **C4**: Migration 006 (`last_reminder_at` column and index on `applications` table).
- [x] **C5**: Navigation shortcuts on Sidebar, WorkIndia Import success card, and Follow-ups page.
- [x] **C6**: Unit tests (88/88 passing) and full browser automation suite with zero console errors and data integrity preserved.

---

## Production Readiness Summary

| Area | Status | Verification |
|------|--------|--------------|
| **All 7 Jobs Configured & View Details** | ✅ Completed | DEO, IT Manager, Admin Manager, MIS Manager, HR Manager, Health Coordinator (Pan-India), MCO (Zero Gender Bias) populated with complete 11-section structured descriptions. "View details" modal and edit description form integrated. |
| **Salary Fix & Null Support** | ✅ Completed | HR Manager salary updated to null / not specified; job cards render "As per company standards" without "Rs 0"; neutral scoring engine awarded for missing budgets. |
| **Speed Optimization & Tokyo Region** | ✅ Completed | Added `vercel.json` with Tokyo (`hnd1`) region co-located with Supabase; in-memory short-TTL cache for jobs/settings/templates; dynamic Recharts and XLSX imports. |
| **Forced Password Pop-up Removed** | ✅ Resolved | Permanently removed `ChangePasswordModal.tsx`, client auto-prompts, sidebar/drawer triggers, server-side enforcement in `/api/auth/login` and `/api/auth/me`. Set `must_change_password: false` across local and Supabase cloud DB for all users. |
| **Supabase Cloud Live Connection** | ✅ Completed | Connected live Supabase PostgreSQL (Tokyo `dewcnqoreuhnrmvswxuf`), applied strict RLS (0 policies for anon/auth), migrated real data (1 job, 10 candidates, 10 applications, 9 status history, 8 templates, settings). |
| **User Accounts Provisioned** | ✅ Configured | Alex (Admin), Pallavi Mali (HR Exec, `Pallavimali@123`), Shradha Yadav (HR Exec) provisioned with bcrypt hashes and `must_change_password: true`. Zero demo users. |
| **Repository Sanitization** | ✅ Enforced | Completely removed users, password hashes, and demo candidate datasets from git-tracked code (`initialData.ts`, `sampleSeedData.ts` deleted, `seed.sql` sanitized, `guard.mjs` hash scanner added). |
| **Strict Cloud Fallback Prevention** | ✅ Enforced | Cloud storage mode locked; unconfigured or unreachable Supabase explicitly errors out without falling back to local JSON. |
| **P1: `/candidates` Crash Fix** | ✅ Resolved | Null-safe property access across `CandidateTableClient.tsx`, `ScoreBadge.tsx`, and `DashboardCharts.tsx`. Added `src/app/error.tsx`, `src/app/global-error.tsx`, and `src/app/not-found.tsx`. Verified across Empty, Realistic, and 2,000-candidate states. |
| **P2: Demo Mode Purge** | ✅ Resolved | Wiped stale port 3000 process and cached `.next`. Purged mock names and orphan notes. Added visible build stamp to login footer, layout footer, and `/health`. Verified 100% absence of demo blocks. |
| **P3: Real User Data Restored** | ✅ Restored | Restored the "Data Entry Operator" (Mumbai) job and candidate applications in local data store. Assignments distributed evenly between HR executives. |
| **System Health Telemetry** | ✅ Built | Admin-only `/health` dashboard page showing build stamp, database file size and path, entity counts, and real-time client error buffer (`/api/client-error`). |
| **Export with UTF-8 BOM** | ✅ Built | Candidate directory and shortlist exports prepend UTF-8 Byte Order Mark (`\uFEFF`) so Excel opens Indian names and symbols cleanly. |
| **One-Click Windows Launchers** | ✅ Built | Created `START_HIREFLOW.bat` (cleans port 3000, 14-day rotating backup, auto-builds, starts server, launches browser) and `STOP_HIREFLOW.bat`. |
| **Real User Accounts** | ✅ Configured | Alex (Admin), Pallavi Mali (HR Exec), Shradha Yadav (HR Exec) provisioned with bcrypt hashes and forced first-login password change. Zero demo profiles. |
| **Fair-Hiring Rule** | ✅ Preserved | 100% compliant: zero filtering, scoring, or ranking by religion, caste, gender, age, marital status, or names. |
| **Brand Single Source of Truth** | ✅ Enforced | `src/lib/brand.ts` with typographic apostrophe (`’`), derived favicons and PWA icons regenerated from official logo. |
| **Phase A: Git, GitHub & CI** | ✅ Completed | Pushed to GitHub `main` (`28e0a6c`) with tag `v0.1.0`. Fresh clone verified (0 forbidden files, 64/64 tests pass, production build clean, port 3100 server returns 200 with official brand). GitHub Actions CI verified: status `completed`, conclusion `success`. |
| **Phase B: Supabase Data Layer** | ✅ Completed | Full parity migration `003_cloud_parity_schema.sql` (users, attempts, settings, templates, batches, workflow, RLS). Repository layer `src/lib/db/supabaseRepo.ts` with transparent dispatch. Added `supabaseParity.test.ts` (70/70 passing). |
| **Phase C: Serverless Readiness** | ✅ Completed | Zero-disk-write checks under cloud mode, HMAC session signing, HTTP security headers, IST telemetry, `/api/health` connectivity probe, and migration/provisioning runners ready. |
| **Pallavi Mali Account** | ✅ Configured | Dedicated Login ID `Pallavimali@123` configured with bcrypt hash, case-insensitive login validation, zero lockout, active HR Executive role, and dual storage parity. |
