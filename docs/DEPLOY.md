# HireFlow Deployment Guide

This document outlines the architecture, deployment process, environment configuration, and hosting considerations for **HireFlow**.

---

## 🏛️ Hosting Architecture

- **Source Control**: GitHub (`main` branch)
- **Application & Serverless Functions**: **Vercel** (Next.js 14 App Router)
- **Database & Identity**: **Supabase** (Managed PostgreSQL Cloud Free Tier)
- **Offline / Local Backup**: Local JSON engine (run via `START_HIREFLOW.bat`)

---

## ⚖️ Hosting Terms of Service & Plan Guidelines

### Vercel Hobby Plan (Trial / Evaluation Use)
- **Terms Notice**: Section 4 of Vercel's Terms of Service specifies that the Hobby plan is provided solely for non-commercial or personal evaluation.
- **Trial Status**: The initial cloud deployment on Vercel Hobby is structured as a **Testing / Trial Deployment**.
- **Commercial Deployment**: For live company recruitment operations at scale for **Chhatrapati Shivaji’s Creative Solutions**, management should subscribe to **Vercel Pro** ($20/user/month) or self-host via Docker/VPS on infrastructure permitting commercial use.

### Supabase Free Tier Limits
- **Storage**: 500 MB PostgreSQL database (supports over 100,000 candidate records and logs).
- **Compute**: Shared CPU, 500 MB RAM, 1 GB file storage.
- **Inactivity Pause Rule**: Supabase Free Tier automatically pauses projects after **7 consecutive days of complete database inactivity**.
  - HireFlow includes an automated GitHub Actions keepalive workflow (`.github/workflows/keepalive.yml`) that pings `/api/health` twice a week to maintain activity.
  - Paused projects can be unpaused with a single click in the Supabase Dashboard at zero cost.

---

## 🛠️ Step-by-Step Deployment Instructions

### Step 1: Provision Free Supabase Project
1. Sign in to [Supabase](https://supabase.com) using your GitHub account.
2. Click **New Project**:
   - **Name**: `hireflow-prod`
   - **Database Password**: Set a strong random password (store safely in your password manager).
   - **Region**: Choose `ap-south-1` (Mumbai, India) for lowest latency.
   - **Plan**: Free ($0/mo).
3. Once the database is provisioned (approx. 2 minutes), go to **Project Settings -> API**:
   - Copy **Project URL** (`https://<project-id>.supabase.co`).
   - Copy **anon / public** key.
   - Copy **service_role** secret key (keep confidential).

### Step 2: Run Database Migrations
In the Supabase Dashboard, open the **SQL Editor**, and run the SQL migration scripts located in `supabase/migrations/` in sequential order:
1. `001_initial_schema.sql` (Creates core tables, foreign keys, and indexes)
2. `002_add_job_location.sql` (Adds location and map URL fields)
3. `003_cloud_parity_schema.sql` (Ensures full parity with local features)

Alternatively, run the database migration helper script locally with your keys configured.

### Step 3: Link Repository to Vercel
1. Sign in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New... -> Project** and select `saisoftwareexecutive-debug/Hr-Automation`.
3. Configure the Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm ci`

### Step 4: Configure Production Environment Variables in Vercel
In the Vercel project configuration, add the following Environment Variables for the **Production** environment:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `DATA_STORAGE_MODE` | `supabase` | Directs HireFlow to use cloud PostgreSQL |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` | Base URL for WhatsApp / SMS links |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-id>.supabase.co` | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ey...` | Client public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `ey...` | Server administrative key (RLS bypass) |
| `SESSION_SECRET` | *(Random 32+ char hex)* | Used to sign session cookies |
| `AUTH_SECRET` | *(Random 32+ char hex)* | Fallback session secret |

*Note: Never prefix `SUPABASE_SERVICE_ROLE_KEY` or `SESSION_SECRET` with `NEXT_PUBLIC_`.*

### Step 5: Deploy & Automated CI/CD
1. Click **Deploy**.
2. Once the build completes, Vercel assigns your production URL (`https://<project>.vercel.app`).
3. Ensure `NEXT_PUBLIC_APP_URL` matches your exact production domain.
4. From this point forward, every push to the `main` branch on GitHub automatically triggers a zero-downtime production deployment on Vercel.

---

## 🔍 Monitoring & Verification

- **Health Check Endpoint**: Test `https://<your-project>.vercel.app/api/health` — returns JSON with application version, build stamp, and database connectivity.
- **Rollback Procedure**: If an issue occurs after a deployment, navigate to **Vercel -> Deployments**, find the previously successful deployment, click the three dots (`...`), and select **Promote to Production** for instant zero-downtime rollback.
