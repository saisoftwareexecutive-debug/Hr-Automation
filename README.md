# HireFlow (हायर-फ्लो) 🚀
### Intelligent, Zero-Cost, Fair-Hiring Applicant Automation Desk
**Official Client:** Chhatrapati Shivaji’s Creative Solutions

HireFlow is an end-to-end recruitment management and screening automation platform designed for high-velocity hiring workflows. It seamlessly imports bulk candidate export files (from job portals like WorkIndia), standardizes Indian mobile numbers to E.164 (`+91XXXXXXXXXX`), deduplicates applications, dispatches 1-tap WhatsApp screening invites, scores applicants against objective job requirements, and provides a 7-stage Kanban pipeline with team task assignment.

---

## 🇮🇳 Non-Negotiable Fair-Hiring Guarantee & DPDP Act 2023 Compliance
HireFlow strictly enforces objective, merit-based scoring by architecture:
- **Zero Demographic Bias**: Candidates are **never** filtered, scored, ranked, hidden, or rejected based on religion, caste, community, gender, age, marital status, disability, or name-inferred characteristics.
- **Strictly Objective Evaluation**:
  1. City & Workplace Location Match
  2. Verified Work Experience
  3. Job Skills Compatibility (Applicant self-assessment)
  4. Salary Expectation vs Position Budget
  5. Notice Period / Immediate Availability
  6. Shift Compatibility (Day / Night / Rotational)
- **DPDP Act 2023 Compliance**: Explicit candidate data consent is captured on all public screening forms (`/apply/[token]`). Candidates can exercise their **Right to Erasure**, allowing Admins to completely delete their data upon verified request.
- **Tamper-Evident Audit Logs**: All state transitions, assignments, scoring rule updates, and data deletions are permanently logged with timestamps and actor IDs.

---

## 🏗️ Technology Stack & Requirements

- **Framework**: Next.js 14 App Router with React 18 & TypeScript 5.6
- **Styling**: Tailwind CSS with Semantic Design Tokens (Dark / Light / System auto-detect)
- **Data Layer**: Dual-Engine (Offline Local JSON Store for office PCs or Supabase PostgreSQL Cloud)
- **Security & Cryptography**: bcryptjs password hashing, signed HTTP-only session cookies, strict RLS
- **Spreadsheet Processing**: SheetJS (`xlsx`) + Papa Parse with UTF-8 BOM encoding
- **Phone Number Parsing**: Google `libphonenumber-js` (India +91 validation)
- **Node.js Runtime**: **Node.js >= 20.0.0 LTS** (Required)

---

## 🚀 Getting Started Locally

### 1. Prerequisites
Ensure Node.js 20+ is installed:
```bash
node -v   # Should output v20.x or higher
npm -v
```

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/saisoftwareexecutive-debug/Hr-Automation.git
cd Hr-Automation
npm ci
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
For local offline use, keep `DATA_STORAGE_MODE=local`.

### 4. Run the Application
You can run using npm:
```bash
# Development server (http://localhost:3000)
npm run dev

# Production build and run
npm run build
npm start
```
On Windows office PCs, you can simply double-click `START_HIREFLOW.bat` for automatic daily rotating backups, port cleanup, and one-click launch.

---

## 🔑 Initial Administrator Account Provisioning

When running HireFlow on a fresh installation with an empty database:
1. The system provisions the primary administrator account:
   - **User**: `Alex`
   - **Role**: Administrator (`admin`)
   - **Initial Status**: Requires immediate password change on first login (`must_change_password: true`)
2. Upon logging in with the initial one-time temporary password provided by your system administrator, HireFlow prompts for an immediate password update requiring at least 8 characters with mixed case and digits.
3. No demo profiles or sample logins exist in production builds.

---

## ⚙️ Environment Variables

Refer to `.env.example` for all configurable keys:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATA_STORAGE_MODE` | Storage backend (`local` or `supabase`) | `local` |
| `NEXT_PUBLIC_APP_URL` | Base URL used in candidate WhatsApp / SMS links | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Cloud project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client API key for Supabase | `ey...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative key (RLS bypass) | `ey...` |
| `SESSION_SECRET` | 32+ character random string for signing cookies | Generated random string |
| `AUTH_SECRET` | Fallback secret for session token verification | Generated random string |

---

## 🧪 Testing & Verification Suite

HireFlow maintains a comprehensive automated testing suite:

```bash
# Run security guard pre-flight scan (verifies no leaks, keys, or sensitive files)
npm run guard

# Run full unit & workflow test suite (vitest)
npm test

# Run full pre-commit verification (guard + tests + production build)
npm run verify

# Run browser smoke test audit (Puppeteer / Playwright)
npm run smoke
```

---

## 🔒 Security Architecture

1. **Zero Secret Leaks**: Automated pre-flight guard (`scripts/guard.mjs`) scans all staged files to prevent committing `.env` files, credentials, backups, or real candidate information.
2. **Database Protection**: When running with Supabase, Row Level Security (RLS) is enabled on all tables with zero public access policies. All authenticated operations route strictly through server-side endpoints using the `SUPABASE_SERVICE_ROLE_KEY`.
3. **Session Hardening**: Sessions use signed, encrypted, `httpOnly`, `SameSite=Lax` cookies with strict inactivity timeouts.
4. **No Personal Data in Code**: The public repository contains zero candidate personal data, phone numbers, or active credentials.

---

## ☁️ Deployment & Vercel Terms of Service Notice

HireFlow is configured for automated continuous deployment from GitHub to **Vercel** with a free-tier **Supabase PostgreSQL** database.

> **Important Hosting Notice regarding Vercel Hobby:**  
> Section 4 of Vercel's Terms of Service stipulates that the **Hobby Plan** is designated exclusively for personal, educational, or non-commercial evaluation use.  
> Deployments on the Vercel Hobby tier should be treated strictly as **Trial / Evaluation Deployments**.  
> For official, commercial, or enterprise recruitment operations for **Chhatrapati Shivaji’s Creative Solutions**, the organization should subscribe to **Vercel Pro** or host the application on a commercial-use cloud provider (such as AWS, Google Cloud, Fly.io, or an on-premise Docker server).

Detailed deployment and migration instructions are documented in [docs/DEPLOY.md](docs/DEPLOY.md).

---

## 📄 License

Proprietary and Confidential — Built for Chhatrapati Shivaji’s Creative Solutions. All rights reserved.
