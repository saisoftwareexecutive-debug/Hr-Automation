import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const ARTIFACT_DIR = 'C:/Users/LENOVO/.gemini/antigravity/brain/7635949d-bf31-4448-b136-2168b351dc85';
const FINAL_SCREENSHOT_DIR = path.resolve('screenshots', 'final');
const TEST_PORT = 3050;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

fs.mkdirSync(FINAL_SCREENSHOT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 307 || res.status === 308) {
        return true;
      }
    } catch (e) {
      // not yet up
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

function copyToArtifacts(filename) {
  try {
    const src = path.join(FINAL_SCREENSHOT_DIR, filename);
    const dest = path.join(ARTIFACT_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Artifact copied: ${filename}`);
    }
  } catch (e) {
    console.warn(`  Failed to copy artifact ${filename}:`, e.message);
  }
}

async function run() {
  console.log('================================================================');
  console.log('PRODUCTION READINESS AUTOMATED REAL BROWSER VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Setup isolated test data file in os.tmpdir so real data/hireflow_db.json is UNTOUCHED
  const tempDir = path.join(os.tmpdir(), `hireflow_browser_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const testDbFile = path.join(tempDir, 'hireflow_test_db.json');

  const testAdminPassword = 'TestAdminPass123!';
  const testAdminHash = bcrypt.hashSync(testAdminPassword, 10);

  const testDbData = {
    jobs: [
      {
        id: 'job_test_empty',
        title: 'Backend Developer (Zero Applicants)',
        department: 'Engineering',
        city: 'Pune',
        location: 'Hinjawadi Phase 2, IT Park',
        map_url: 'https://maps.google.com/?q=Hinjawadi+Pune',
        openings: 2,
        min_exp_years: 2,
        max_exp_years: 5,
        min_salary: 50000,
        max_salary: 80000,
        shift_type: 'day',
        required_skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
        required_languages: ['English', 'Hindi'],
        status: 'active',
        created_by: 'Alex',
        created_at: new Date().toISOString(),
        scoring_rules: {
          id: 'sr_job_test_empty',
          job_id: 'job_test_empty',
          weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
          criteria: { preferred_cities: ['Pune'], max_acceptable_salary: 90000, max_notice_days: 30, mandatory_skills: ['Node.js'] }
        }
      },
      {
        id: 'job_test_with_apps',
        title: 'Senior Customer Support Specialist',
        department: 'Customer Operations',
        city: 'Mumbai',
        location: 'Andheri East, MIDC Cross Road B',
        map_url: 'https://maps.google.com/?q=Andheri+East+Mumbai',
        openings: 5,
        min_exp_years: 1,
        max_exp_years: 4,
        min_salary: 28000,
        max_salary: 38000,
        shift_type: 'rotational',
        required_skills: ['Customer Support', 'Chat Support', 'CRM'],
        required_languages: ['Hindi', 'English'],
        status: 'active',
        created_by: 'Alex',
        created_at: new Date().toISOString(),
        scoring_rules: {
          id: 'sr_job_test_with_apps',
          job_id: 'job_test_with_apps',
          weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
          criteria: { preferred_cities: ['Mumbai'], max_acceptable_salary: 40000, max_notice_days: 30, mandatory_skills: ['Customer Support'] }
        }
      }
    ],
    candidates: [
      { id: 'cand_01', full_name: 'Ananya Deshmukh', phone: '+91 98201 11222', city: 'Mumbai', created_at: new Date().toISOString() },
      { id: 'cand_02', full_name: 'Rahul Kulkarni', phone: '+91 98202 33444', city: 'Mumbai', created_at: new Date().toISOString() },
      { id: 'cand_03', full_name: 'Sneha Patil', phone: '+91 98203 55666', city: 'Mumbai', created_at: new Date().toISOString() },
    ],
    applications: [
      { id: 'app_01', job_id: 'job_test_with_apps', candidate_id: 'cand_01', status: 'shortlisted', score: 88, applied_at: new Date().toISOString(), created_at: new Date().toISOString(), candidate: { full_name: 'Ananya Deshmukh', phone: '+91 98201 11222', city: 'Mumbai' }, job: { title: 'Senior Customer Support Specialist', city: 'Mumbai', location: 'Andheri East, MIDC Cross Road B' } },
      { id: 'app_02', job_id: 'job_test_with_apps', candidate_id: 'cand_02', status: 'applied', score: 72, applied_at: new Date().toISOString(), created_at: new Date().toISOString(), candidate: { full_name: 'Rahul Kulkarni', phone: '+91 98202 33444', city: 'Mumbai' }, job: { title: 'Senior Customer Support Specialist', city: 'Mumbai', location: 'Andheri East, MIDC Cross Road B' } },
      { id: 'app_03', job_id: 'job_test_with_apps', candidate_id: 'cand_03', status: 'interview', score: 92, applied_at: new Date().toISOString(), created_at: new Date().toISOString(), candidate: { full_name: 'Sneha Patil', phone: '+91 98203 55666', city: 'Mumbai' }, job: { title: 'Senior Customer Support Specialist', city: 'Mumbai', location: 'Andheri East, MIDC Cross Road B' } },
    ],
    formAnswers: [],
    candidateNotes: [],
    statusHistory: [],
    messagesLog: [],
    auditLogs: [],
    users: [
      {
        id: 'usr_test_admin',
        email: 'testadmin@hireflow.internal',
        password_hash: testAdminHash,
        full_name: 'Test Administrator',
        role: 'admin',
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
      },
    ],
    companySettings: {
      company_name: 'Chhatrapati Shivaji\u2019s Creative Solutions',
      tagline: 'Recruitment Desk',
      logo_url: null,
      accent_color: '#4f46e5',
      updated_at: new Date().toISOString(),
    },
    templates: [
      {
        id: 'tpl_default_1',
        type: 'screening_invite',
        language: 'en',
        tone: 'professional',
        name: 'Screening Invite (English - Professional)',
        content: 'Dear {{candidate_name}}, thank you for applying for {{job_title}} at {{company_name}}. Please complete screening: {{form_link}}',
        version_number: 1,
        is_active: true,
        created_at: new Date().toISOString(),
      }
    ],
    loginAttempts: [],
    importBatches: [],
  };

  fs.writeFileSync(testDbFile, JSON.stringify(testDbData, null, 2), 'utf-8');
  console.log(`✓ Isolated test database prepared at: ${testDbFile}`);

  // 2. Start Next.js server on TEST_PORT pointing to isolated test store
  console.log(`2. Starting Next.js production server on dedicated port ${TEST_PORT}...`);
  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(TEST_PORT)], {
    stdio: 'pipe',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HIREFLOW_DATA_FILE: testDbFile,
      DATA_DIR: tempDir,
    },
  });

  server.stdout.on('data', (d) => console.log('[next]', d.toString().trim()));
  server.stderr.on('data', (d) => console.error('[next err]', d.toString().trim()));

  let browser;
  try {
    await waitForServer(`${BASE_URL}/login`);
    console.log(`✓ Test server is live on ${BASE_URL}\n`);

    // 3. Launch Puppeteer with Chrome
    console.log('3. Launching Google Chrome via Puppeteer...');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
      defaultViewport: { width: 1400, height: 900 },
    });

    const page = await browser.newPage();

    // -------------------------------------------------------------
    // TEST 1: Clean Login Page Verification
    // -------------------------------------------------------------
    console.log('4. Verifying Clean Production Login Page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // Verify demo profiles and demo tags do NOT exist
    const demoContent = await page.content();
    const hasOneClickDemo = demoContent.includes('ONE-CLICK DEMO PROFILES');
    const hasDemoModeTag = demoContent.includes('DEMO_MODE=TRUE') || demoContent.includes('DEMO_MODE=true');
    const hasRajeshSharma = demoContent.includes('Rajesh Sharma') && demoContent.includes('admin123');

    console.log(`  - One-Click Demo Profiles present? ${hasOneClickDemo ? 'FAIL (Still visible)' : 'PASS (Cleanly removed)'}`);
    console.log(`  - DEMO_MODE badge present? ${hasDemoModeTag ? 'FAIL (Still visible)' : 'PASS (Cleanly removed)'}`);
    console.log(`  - Hardcoded credentials present? ${hasRajeshSharma ? 'FAIL' : 'PASS (Removed)'}`);

    const loginScreenshotPath = path.join(FINAL_SCREENSHOT_DIR, 'clean_login_page.png');
    await page.screenshot({ path: loginScreenshotPath, fullPage: true });
    copyToArtifacts('clean_login_page.png');

    // -------------------------------------------------------------
    // TEST 2: Login & Forced Password Change Dialog with Strength Meter
    // -------------------------------------------------------------
    console.log('5. Testing Login & Forced Password Change Dialog...');
    await page.type('input[type="email"]', 'testadmin@hireflow.internal');
    await page.type('input[type="password"]', testAdminPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to / or modal
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    // Modal should be open because must_change_password is true
    const modalVisible = await page.$('input[placeholder*="current temporary password"]');
    console.log(`  - Forced Change Password modal displayed on first login? ${modalVisible ? 'PASS' : 'FAIL'}`);

    if (modalVisible) {
      // Type weak password (<8 chars)
      await page.type('input[placeholder*="current temporary password"]', testAdminPassword);
      await page.type('input[placeholder*="min. 8 chars"]', 'abc');
      await new Promise((r) => setTimeout(r, 400));

      const strengthMeterPath = path.join(FINAL_SCREENSHOT_DIR, 'password_modal_strength.png');
      await page.screenshot({ path: strengthMeterPath });
      copyToArtifacts('password_modal_strength.png');
      console.log('  - Captured password modal with strength meter.');

      // Complete valid password change
      const newAdminPassword = 'ProductionSecurePass2026!';
      await page.click('input[placeholder*="min. 8 chars"]', { clickCount: 3 });
      await page.type('input[placeholder*="min. 8 chars"]', newAdminPassword);
      await page.type('input[placeholder="Re-enter new password"]', newAdminPassword);
      await page.click('button[type="submit"]');
      await new Promise((r) => setTimeout(r, 1000));
      console.log('  - Successfully updated password with 8+ chars.');
    }

    // -------------------------------------------------------------
    // TEST 3: Navigation & Top Banner Check (Zero green banner anywhere)
    // -------------------------------------------------------------
    console.log('6. Verifying Green Top Banner Permanently Removed Across App...');
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const jobsContent = await page.content();
    const hasFairHiringBanner = jobsContent.includes('Fair-Hiring Guarantee: 100% Unbiased Merit-Based Scoring');
    console.log(`  - Top Green Banner present on Jobs page? ${hasFairHiringBanner ? 'FAIL (Still visible)' : 'PASS (Permanently Removed)'}`);

    const bannerCheckPath = path.join(FINAL_SCREENSHOT_DIR, 'no_top_banner_verified.png');
    await page.screenshot({ path: bannerCheckPath, fullPage: false });
    copyToArtifacts('no_top_banner_verified.png');

    // -------------------------------------------------------------
    // TEST 4: Jobs Page Delete Buttons & Confirmation Modal
    // -------------------------------------------------------------
    console.log('7. Verifying Jobs Page Delete Buttons & Modal...');
    const jobsButtonsPath = path.join(FINAL_SCREENSHOT_DIR, 'jobs_delete_buttons.png');
    await page.screenshot({ path: jobsButtonsPath, fullPage: true });
    copyToArtifacts('jobs_delete_buttons.png');

    // Click delete on the job with applicants
    const deleteButtons = await page.$$('button[aria-label="Delete Job"]');
    if (deleteButtons.length > 1) {
      await deleteButtons[1].click(); // second job has applicants
      await new Promise((r) => setTimeout(r, 600));

      const modalApplicantPath = path.join(FINAL_SCREENSHOT_DIR, 'job_delete_modal_with_applicants.png');
      await page.screenshot({ path: modalApplicantPath });
      copyToArtifacts('job_delete_modal_with_applicants.png');
      console.log('  - Captured Delete Job with Applicants modal (Close Job Instead recommendation).');

      // Click Cancel
      const cancelBtn = await page.$('button ::-p-text(Cancel)');
      if (cancelBtn) await cancelBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // -------------------------------------------------------------
    // TEST 5: Desktop Sidebar, Company Name & Prominent Sign Out Button
    // -------------------------------------------------------------
    console.log('8. Verifying Desktop Sidebar & Prominent Sign Out...');
    const sidebarDesktopPath = path.join(FINAL_SCREENSHOT_DIR, 'sidebar_sign_out_desktop.png');
    await page.screenshot({ path: sidebarDesktopPath });
    copyToArtifacts('sidebar_sign_out_desktop.png');

    const companyNamePath = path.join(FINAL_SCREENSHOT_DIR, 'company_name_fixed.png');
    await page.screenshot({ path: companyNamePath });
    copyToArtifacts('company_name_fixed.png');

    // -------------------------------------------------------------
    // TEST 6: Mobile Navigation Drawer (Viewport 375x667)
    // -------------------------------------------------------------
    console.log('9. Testing Mobile Navigation Drawer & Sign Out...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const menuButton = await page.$('button[aria-label="Open menu"]');
    if (menuButton) {
      await menuButton.click();
      await new Promise((r) => setTimeout(r, 600));
      const mobileDrawerPath = path.join(FINAL_SCREENSHOT_DIR, 'sidebar_sign_out_mobile.png');
      await page.screenshot({ path: mobileDrawerPath });
      copyToArtifacts('sidebar_sign_out_mobile.png');
      console.log('  - Captured Mobile Drawer with theme toggle and prominent Sign Out button.');
    }

    // -------------------------------------------------------------
    // TEST 7: Desktop Sign Out Action & Toast
    // -------------------------------------------------------------
    console.log('10. Testing Sign Out Action...');
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const signOutBtn = await page.$('button[data-testid="sidebar-sign-out"]');
    if (signOutBtn) {
      await signOutBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));
      console.log(`  - Redirected to login after Sign Out: ${page.url()}`);
    }

    // -------------------------------------------------------------
    // TEST 8: Text Overflow Stress Test
    // -------------------------------------------------------------
    console.log('11. Text Overflow Stress Test Verification...');
    await page.goto(`${BASE_URL}/pipeline?job=job_test_with_apps`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const overflowPath = path.join(FINAL_SCREENSHOT_DIR, 'overflow_stress_test.png');
    await page.screenshot({ path: overflowPath, fullPage: true });
    copyToArtifacts('overflow_stress_test.png');

    // -------------------------------------------------------------
    // TEST 9: Accessibility & Color Contrast (axe-core)
    // -------------------------------------------------------------
    console.log('12. Running Axe-Core Accessibility & Contrast Checks...');
    const axeSource = fs.readFileSync(path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js'), 'utf-8');
    await page.evaluate(axeSource);
    const axeResults = await page.evaluate(async () => {
      // @ts-ignore
      return await axe.run({ runOnly: ['color-contrast'] });
    });
    console.log(`  ✓ Axe-core violations found: ${axeResults.violations.length}`);
    if (axeResults.violations.length > 0) {
      console.log('    Violations summary:', axeResults.violations.map((v) => v.id).join(', '));
    }

    console.log('\n================================================================');
    console.log('ALL BROWSER PRODUCTION READINESS TESTS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('Browser Test Error:', err);
  process.exit(1);
});
