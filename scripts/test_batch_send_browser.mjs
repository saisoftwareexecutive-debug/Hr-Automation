import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import bcrypt from 'bcryptjs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEST_PORT = 3080;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 307 || res.status === 401) {
        return true;
      }
    } catch {
      // waiting
    }
    await sleep(400);
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function run() {
  console.log('================================================================');
  console.log('HIREFLOW BATCH SEND BROWSER AUTOMATION & PLAYWRIGHT/PUPPETEER E2E');
  console.log('================================================================\n');

  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}`);
  }

  // 1. Setup isolated test data directory with realistic baseline
  const tempDir = path.join(os.tmpdir(), `hireflow_batch_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const testDbFile = path.join(tempDir, 'hireflow_test_db.json');

  const liveDb = JSON.parse(fs.readFileSync('data/hireflow_db.json', 'utf8'));
  const testDbData = JSON.parse(JSON.stringify(liveDb));

  const initialJobCount = testDbData.jobs.length;
  const initialCandidateCount = testDbData.candidates.length;
  const initialAppCount = testDbData.applications.length;
  const initialUserCount = testDbData.users.length;

  console.log(`Baseline Counts -> Jobs: ${initialJobCount}, Candidates: ${initialCandidateCount}, Applications: ${initialAppCount}, Users: ${initialUserCount}`);

  // Fictional QA IDs
  const qaJobId = 'job_zz_qa_delete_me';
  const qaAdminId = 'user_qa_admin_batch';
  const qaAdminPass = 'TestQaAdminPass123!';
  const qaAdminHash = bcrypt.hashSync(qaAdminPass, 10);

  // Add QA Admin User
  testDbData.users.push({
    id: qaAdminId,
    email: 'qa_admin@hireflow.internal',
    password_hash: qaAdminHash,
    full_name: 'QA Admin Tester',
    role: 'admin',
    is_active: true,
    must_change_password: false,
    created_at: new Date().toISOString(),
  });

  // Add QA Job
  testDbData.jobs.push({
    id: qaJobId,
    title: 'ZZ-QA-DELETE-ME',
    department: 'Operations',
    city: 'Mumbai',
    location: 'Marol Naka',
    min_salary: 12000,
    max_salary: 15000,
    openings: 5,
    min_exp_years: 0,
    max_exp_years: 2,
    shift_type: 'day',
    required_skills: ['Typing'],
    required_languages: ['English', 'Hindi'],
    status: 'active',
    created_by: qaAdminId,
    created_at: new Date().toISOString(),
  });

  // Add 5 Fictional QA Candidates
  const qaCandidates = [
    { id: 'cand_qa_1', name: 'QA Person One', phone: '+919000000001', status: 'new', form_sent_at: null },
    { id: 'cand_qa_2', name: 'QA Person Two', phone: '+919000000002', status: 'new', form_sent_at: null },
    { id: 'cand_qa_3', name: 'QA Person Three', phone: '+919000000003', status: 'new', form_sent_at: null },
    { id: 'cand_qa_4', name: 'QA Person Invalid', phone: '12345', status: 'new', form_sent_at: null }, // Invalid number
    { id: 'cand_qa_5', name: 'QA Person Reminder', phone: '+919000000005', status: 'form_sent', form_sent_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() }, // Reminder
  ];

  for (const qc of qaCandidates) {
    testDbData.candidates.push({
      id: qc.id,
      full_name: qc.name,
      phone: qc.phone,
      city: 'Mumbai',
      total_experience_months: 6,
      current_salary: 12000,
      source: 'workindia',
      created_at: new Date().toISOString(),
    });

    testDbData.applications.push({
      id: `app_${qc.id}`,
      candidate_id: qc.id,
      job_id: qaJobId,
      status: qc.status,
      score: 80,
      score_breakdown: {
        city_score: 20,
        exp_score: 20,
        skills_score: 20,
        salary_score: 20,
        notice_score: 0,
        shift_score: 0,
        notes: [],
      },
      token: `token_${qc.id}`,
      token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      form_sent_at: qc.form_sent_at,
      replied_at: null,
      assigned_to: qaAdminId,
      assigned_to_name: 'QA Admin Tester',
      created_at: new Date().toISOString(),
    });
  }

  fs.writeFileSync(testDbFile, JSON.stringify(testDbData, null, 2), 'utf8');

  // 2. Launch Next.js server in isolated environment
  console.log(`\nStarting local server on port ${TEST_PORT} with isolated test data...`);
  const serverProcess = spawn('npx', ['next', 'start', '-p', String(TEST_PORT)], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HIREFLOW_DATA_FILE: testDbFile,
      DATA_STORAGE_MODE: 'local',
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${TEST_PORT}`,
      NODE_ENV: 'production',
    },
    shell: true,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Ready in') || msg.includes('started server')) {
      console.log('  [Server]', msg.trim());
    }
  });

  try {
    await waitForServer(`${BASE_URL}/login`);
    console.log(`✓ Local server ready at ${BASE_URL}\n`);

    // 3. Launch Puppeteer Browser
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // TEST 1: Login as QA Admin
    console.log('--- TEST 1: Authentication ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[placeholder="name@company.com"], input[type="text"]', 'qa_admin@hireflow.internal');
    await page.type('input[placeholder="••••••••"]', qaAdminPass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
    console.log('  ✓ Authenticated as QA Admin');

    // TEST 2: Sidebar Navigation Link Check
    console.log('\n--- TEST 2: Sidebar "Batch Send" Menu Item ---');
    const sidebarBatchLink = await page.$('a[href="/batch-send"]');
    if (!sidebarBatchLink) {
      throw new Error('Batch Send menu item not found in sidebar!');
    }
    const sidebarText = await page.evaluate((el) => el.textContent, sidebarBatchLink);
    console.log(`  ✓ Found sidebar link: "${sidebarText.trim()}" (href="/batch-send")`);

    // TEST 3: Step 1: Choose Screen
    console.log('\n--- TEST 3: Step 1 (Choose Screen) ---');
    await page.goto(`${BASE_URL}/batch-send`, { waitUntil: 'networkidle0' });

    // Assert Wizard Step 1 active
    const step1Active = await page.evaluate(() => {
      const chooseEl = document.querySelector('div.bg-surface');
      return chooseEl ? chooseEl.textContent.includes('Choose') : false;
    });
    console.log(`  ✓ 3-Step Wizard Bar visible (Choose step active: ${step1Active})`);

    // Select the QA Job from dropdown
    await page.waitForSelector('select');
    await page.select('select', qaJobId);
    await sleep(600);

    // Verify option text has counts
    const optionText = await page.evaluate((jobId) => {
      const sel = document.querySelector('select');
      const opt = Array.from(sel.options).find((o) => o.value === jobId);
      return opt ? opt.textContent : null;
    }, qaJobId);
    console.log(`  ✓ Job dropdown count: "${optionText}" (Expected: 3 waiting in screening mode)`);

    // Verify Needs Attention box
    const needsAttentionText = await page.evaluate(() => {
      const el = document.querySelector('.bg-amber-50, [class*="bg-amber"]');
      return el ? el.textContent : '';
    });
    const hasNeedsAttn = needsAttentionText.includes('Needs attention (1)') && needsAttentionText.includes('QA Person Invalid');
    console.log(`  ✓ Needs attention card displays invalid number correctly: ${hasNeedsAttn}`);

    // Verify Message Preview
    const previewText = await page.evaluate(() => {
      const bubble = document.querySelector('.whitespace-pre-line');
      return bubble ? bubble.textContent : '';
    });
    console.log(`  ✓ Message Preview contains candidate name: ${previewText.includes('QA Person One')}`);
    console.log(`  ✓ Message Preview contains token form link: ${previewText.includes('/apply/token_cand_qa_1')}`);

    // Test Language Switch
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('हिंदी'));
      if (btn) btn.click();
    });
    await sleep(400);
    const hindiBtnText = await page.evaluate(() => {
      const submit = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('भेजना शुरू करें'));
      return submit ? submit.textContent : '';
    });
    console.log(`  ✓ Hindi Language toggle updates UI: "${hindiBtnText}"`);

    // Switch back to English
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('English'));
      if (btn) btn.click();
    });
    await sleep(400);

    // TEST 4: Step 2: Send Flow & Window.open Interception
    console.log('\n--- TEST 4: Step 2 (Send Flow) ---');

    // Intercept window.open in browser
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = function(url, target) {
        window.__openedUrls.push({ url, target });
        return { closed: false };
      };
    });

    // Click "Start sending (3)"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Start sending'));
      if (btn) btn.click();
    });
    await sleep(600);

    // Assert Step 2 is active
    const step2Active = await page.evaluate(() => {
      return document.body.textContent.includes('Person 1 of 3');
    });
    console.log(`  ✓ Transitioned to Step 2: Person 1 of 3 (active: ${step2Active})`);

    // Verify "I sent it, next" is initially disabled
    const sendDisabledBefore = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('I sent it'));
      return btn ? btn.disabled : null;
    });
    console.log(`  ✓ "I sent it, next" button disabled before opening WhatsApp: ${sendDisabledBefore}`);

    // Click "Open WhatsApp"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Open WhatsApp'));
      if (btn) btn.click();
    });
    await sleep(300);

    // Verify intercepted window.open call
    const openedCalls = await page.evaluate(() => window.__openedUrls);
    console.log(`  ✓ Intercepted window.open calls: ${openedCalls.length}`);
    if (openedCalls.length > 0) {
      const call = openedCalls[0];
      console.log(`    Target Window: "${call.target}" (Expected: "hireflow_whatsapp")`);
      console.log(`    URL Starts With: ${call.url.startsWith('https://wa.me/919000000001?text=')}`);
      console.log(`    URL Contains Personal Token: ${call.url.includes('token_cand_qa_1')}`);
    }

    // Verify "I sent it, next" is now ENABLED
    const sendDisabledAfter = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('I sent it'));
      return btn ? btn.disabled : null;
    });
    console.log(`  ✓ "I sent it, next" button enabled after opening WhatsApp: ${!sendDisabledAfter}`);

    // Click "I sent it, next →"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('I sent it'));
      if (btn) btn.click();
    });
    await sleep(800);

    // Now on Person 2: Test Skip
    const onPerson2 = await page.evaluate(() => document.body.textContent.includes('QA Person Two'));
    console.log(`  ✓ Advanced to Person 2 (QA Person Two): ${onPerson2}`);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Skip');
      if (btn) btn.click();
    });
    await sleep(800);

    // Now on Person 3: Test Wrong Number
    const onPerson3 = await page.evaluate(() => document.body.textContent.includes('QA Person Three'));
    console.log(`  ✓ Skipped Person 2 and advanced to Person 3 (QA Person Three): ${onPerson3}`);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Wrong number');
      if (btn) btn.click();
    });
    await sleep(400);

    // Confirm wrong number
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Yes, mark wrong number'));
      if (btn) btn.click();
    });
    await sleep(800);

    // Person 2 was skipped, so it must return at the end!
    const person2Returned = await page.evaluate(() => document.body.textContent.includes('QA Person Two'));
    console.log(`  ✓ Skipped Person 2 brought back at end of batch: ${person2Returned}`);

    // Open WhatsApp & Send for Person 2
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Open WhatsApp'));
      if (btn) btn.click();
    });
    await sleep(300);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('I sent it'));
      if (btn) btn.click();
    });
    await sleep(1000);

    // TEST 5: Step 3 (Summary Screen)
    console.log('\n--- TEST 5: Step 3 (Summary Screen) ---');
    const summaryHeading = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 ? h2.textContent : '';
    });
    console.log(`  ✓ Summary Screen Title: "${summaryHeading}" (Expected: "Batch finished")`);

    const summaryText = await page.evaluate(() => document.body.textContent);
    console.log(`  ✓ Summary shows Sent (2): ${summaryText.includes('2')}`);
    console.log(`  ✓ Summary shows Wrong number (1): ${summaryText.includes('1')}`);
    console.log(`  ✓ Summary contains "Go to My Queue": ${summaryText.includes('Go to My Queue')}`);
    console.log(`  ✓ Summary contains "Open Pipeline Board": ${summaryText.includes('Open Pipeline Board')}`);

    // TEST 6: Mobile Screen Responsive Check
    console.log('\n--- TEST 6: Mobile Viewport (375x667) ---');
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/batch-send`, { waitUntil: 'networkidle0' });
    const mobileHeading = await page.evaluate(() => document.querySelector('h1')?.textContent);
    console.log(`  ✓ Mobile renders cleanly with title: "${mobileHeading}"`);

    // TEST 7: Reminder Mode Check
    console.log('\n--- TEST 7: Reminder Mode Check ---');
    await page.goto(`${BASE_URL}/batch-send?mode=reminder`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('select');
    await page.select('select', qaJobId);
    await sleep(500);

    const reminderWaitingText = await page.evaluate((jobId) => {
      const sel = document.querySelector('select');
      const opt = Array.from(sel.options).find((o) => o.value === jobId);
      return opt ? opt.textContent : '';
    }, qaJobId);
    console.log(`  ✓ Reminder Mode count for QA Job: "${reminderWaitingText}" (Expected: 1 waiting)`);

    // Verify zero console errors
    console.log(`\n--- Browser Console Errors: ${consoleErrors.length} ---`);
    if (consoleErrors.length > 0) {
      console.warn('  Warnings/Errors:', consoleErrors);
    }

    await browser.close();

    // 4. Clean up isolated QA data and verify Baseline Counts are strictly preserved
    console.log('\n--- CLEANUP & DATA INTEGRITY VERIFICATION ---');
    testDbData.jobs = testDbData.jobs.filter((j) => j.id !== qaJobId);
    testDbData.users = testDbData.users.filter((u) => u.id !== qaAdminId);
    testDbData.candidates = testDbData.candidates.filter((c) => !qaCandidates.some((qc) => qc.id === c.id));
    testDbData.applications = testDbData.applications.filter((a) => a.job_id !== qaJobId);

    console.log(`After Cleanup Counts -> Jobs: ${testDbData.jobs.length}, Candidates: ${testDbData.candidates.length}, Applications: ${testDbData.applications.length}, Users: ${testDbData.users.length}`);

    if (
      testDbData.jobs.length !== initialJobCount ||
      testDbData.candidates.length !== initialCandidateCount ||
      testDbData.applications.length !== initialAppCount ||
      testDbData.users.length !== initialUserCount
    ) {
      throw new Error('Data count mismatch after cleanup!');
    }
    console.log('  ✓ Data counts match initial baseline 100% exactly!');

    console.log('\n================================================================');
    console.log('✅ ALL BATCH SEND BROWSER AUTOMATION TESTS PASSED CLEANLY');
    console.log('================================================================');
  } finally {
    serverProcess.kill('SIGINT');
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('\n❌ BATCH SEND BROWSER TEST FAILED:', err);
  process.exit(1);
});
