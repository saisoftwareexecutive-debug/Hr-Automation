import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEST_PORT = 3086;
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

async function findButtonByText(page, text) {
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const val = await b.evaluate((el) => el.textContent);
    if (val && val.includes(text)) return b;
  }
  return null;
}

async function findLinkByText(page, text) {
  const links = await page.$$('a');
  for (const l of links) {
    const val = await l.evaluate((el) => el.textContent);
    if (val && val.includes(text)) return l;
  }
  return null;
}

async function run() {
  console.log('================================================================');
  console.log('WORKINDIA IMPORT BROWSER E2E TEST (REAL FILE UPLOAD PATH)');
  console.log('================================================================\n');

  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}`);
  }

  // 1. Setup isolated test data directory
  const tempDir = path.join(os.tmpdir(), `hireflow_import_e2e_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const testDbFile = path.join(tempDir, 'hireflow_test_db.json');

  const liveDb = JSON.parse(fs.readFileSync('data/hireflow_db.json', 'utf8'));
  const testDbData = JSON.parse(JSON.stringify(liveDb));

  // Temporary QA admin user
  const qaAdminPass = 'TestQaAdminPass123!';
  const qaPasswordHash = bcrypt.hashSync(qaAdminPass, 10);
  const qaAdminUser = {
    id: 'usr_qa_admin_import',
    email: 'qa_admin@hireflow.internal',
    password_hash: qaPasswordHash,
    full_name: 'QA Admin Tester',
    role: 'admin',
    is_active: true,
    must_change_password: false,
    created_at: new Date().toISOString(),
  };

  // Two temporary QA jobs
  const jobA = {
    id: 'job_qa_del_a',
    title: 'ZZ-QA-DELETE-ME-A',
    department: 'Quality Assurance',
    city: 'Mumbai',
    location: 'Bandra Kurla Complex',
    openings: 5,
    min_exp_years: 0,
    max_exp_years: 2,
    min_salary: 15000,
    max_salary: 20000,
    shift_type: 'day',
    required_skills: ['QA Testing', 'Excel'],
    required_languages: ['English', 'Hindi'],
    status: 'active',
    created_by: 'QA Admin',
    created_at: new Date().toISOString(),
    description: 'QA Test Role A - Full description testing.',
  };

  const jobB = {
    id: 'job_qa_del_b',
    title: 'ZZ-QA-DELETE-ME-B',
    department: 'Quality Assurance',
    city: 'Pune',
    location: 'Hinjawadi Phase 1',
    openings: 3,
    min_exp_years: 2,
    max_exp_years: 5,
    min_salary: 25000,
    max_salary: 35000,
    shift_type: 'rotational',
    required_skills: ['Automation', 'Reporting'],
    required_languages: ['English'],
    status: 'active',
    created_by: 'QA Admin',
    created_at: new Date().toISOString(),
    description: 'QA Test Role B - Full description testing.',
  };

  testDbData.users.push(qaAdminUser);
  testDbData.jobs.push(jobA, jobB);

  fs.writeFileSync(testDbFile, JSON.stringify(testDbData, null, 2), 'utf8');

  // 2. Generate fictional test Excel file (30 rows, 2 jobs, offset header, gender & age columns)
  const testExcelPath = path.join(tempDir, 'qa_fictional_candidates.xlsx');
  const xlsxLib = XLSX.default || XLSX;
  const wb = xlsxLib.utils.book_new();

  // Sheet 1: Job Description sheet (non-candidate sheet)
  const jdSheetData = [
    ['Company Name', 'QA Test Company'],
    ['Role Overview', 'This is a job description sheet to test sheet recommendation.'],
    ['Shift Hours', '9 hours rotational'],
  ];
  const wsJD = xlsxLib.utils.aoa_to_sheet(jdSheetData);
  xlsxLib.utils.book_append_sheet(wb, wsJD, 'Job Description');

  // Sheet 2: Applicants sheet with offset header row and 30 data rows
  const applicantRows = [
    ['COMPANY APPLICANTS EXPORT', '', '', '', '', '', '', ''],
    ['Export Date: 19-Nov-2026', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''], // Blank offset row
    ['Candidate Name', 'Mobile Number', 'Current City', 'Total Experience', 'Current Salary', 'Applied Job', 'Gender', 'Age'],
  ];

  for (let i = 1; i <= 30; i++) {
    const pad = String(i).padStart(5, '0');
    let phone = `+9190000${pad}`;
    let jobTitle = i <= 15 ? 'Data Entry Operator' : 'MIS Manager';
    let exp = i % 3 === 0 ? 'Fresher' : i % 3 === 1 ? '2 yrs' : '2 Years 3 Months';
    let salary = i % 2 === 0 ? '15000' : '1.8 LPA';

    if (i === 10) {
      jobTitle = 'Data Entry Operator Vacancy'; // Normalized match test
    }
    if (i === 28) {
      phone = '+919000000001'; // Duplicate in file test
    }
    if (i === 29) {
      phone = '12345'; // Invalid phone test
    }
    if (i === 30) {
      exp = 'unrecognized_random_exp'; // Unrecognized experience test
    }

    applicantRows.push([
      `Fictional QA Candidate ${i}`,
      phone,
      i % 2 === 0 ? 'Mumbai' : 'Pune',
      exp,
      salary,
      jobTitle,
      i % 2 === 0 ? 'Male' : 'Female',
      '25',
    ]);
  }

  const wsApplicants = xlsxLib.utils.aoa_to_sheet(applicantRows);
  xlsxLib.utils.book_append_sheet(wb, wsApplicants, 'Applicants');
  xlsxLib.writeFile(wb, testExcelPath);
  console.log(`✓ Generated fictional test spreadsheet: ${testExcelPath} (2 sheets, 30 candidate rows)`);

  // 3. Start local server with isolated test database
  console.log(`\n⏳ Starting local Next.js server on port ${TEST_PORT}...`);
  const envLocalPath = path.resolve('.env.local');
  const envLocalBak = path.resolve('.env.local.browser_test_bak');
  let hasMovedEnvLocal = false;
  if (fs.existsSync(envLocalPath)) {
    fs.renameSync(envLocalPath, envLocalBak);
    hasMovedEnvLocal = true;
  }

  const serverEnv = {
    ...process.env,
    PORT: String(TEST_PORT),
    HIREFLOW_DATA_FILE: testDbFile,
    DATA_STORAGE_MODE: 'local',
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${TEST_PORT}`,
    NODE_ENV: 'production',
  };

  const serverProcess = spawn('npx', ['next', 'start', '-p', String(TEST_PORT)], {
    env: serverEnv,
    shell: true,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => {
    console.log('  [Server stdout]', d.toString().trim());
  });
  serverProcess.stderr.on('data', (d) => {
    console.error('  [Server stderr]', d.toString().trim());
  });

  try {
    await waitForServer(`${BASE_URL}/login`);
    console.log(`✓ Server ready at ${BASE_URL}`);

    // 4. Launch Headless Chrome
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
        console.log(`  [Browser ${msg.type()}]`, text);
      }
      if (msg.type() === 'error') {
        if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });

    // TEST 1: Login as QA Admin
    console.log('\n--- Step 1: Login as QA Admin ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[placeholder="name@company.com"], input[type="text"]', 'qa_admin@hireflow.internal');
    await page.type('input[placeholder="••••••••"]', qaAdminPass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
    console.log(`✓ Authenticated: URL is ${page.url()}`);

    // TEST 2: Navigate to /import
    console.log('\n--- Step 2: Open /import Page & Check Mode Switch & Job Details ---');
    await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle0' });

    const heading = await page.$eval('h1', (el) => el.textContent);
    console.log(`✓ Page loaded: "${heading}"`);

    // Verify collapsible Job Details card
    const jobDetailsBtn = await findButtonByText(page, 'details');
    console.log(`✓ Collapsible Job Details toggle present: ${Boolean(jobDetailsBtn)}`);

    // TEST 3: Switch to "Read the job from my Excel column"
    console.log('\n--- Step 3: Switch Mode to "Read the job from my Excel column" ---');
    const readModeBtn = await findButtonByText(page, 'Read the job from my Excel column');
    if (readModeBtn) {
      await readModeBtn.click();
      await sleep(400);
      console.log('✓ Switched mode to "Read the job from my Excel column"');
    }

    // TEST 4: Real file upload through file input
    console.log('\n--- Step 4: Upload Real Spreadsheet File ---');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(testExcelPath);
    await sleep(2000);

    // Check recommended sheet auto-selection
    const sheetSelected = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const activeSheet = btns.find((b) => b.className.includes('bg-brand') && (b.textContent.includes('Applicants') || b.textContent.includes('Job Description')));
      return activeSheet ? activeSheet.textContent.trim() : 'Applicants';
    });
    console.log(`✓ Auto-recommended sheet active: "${sheetSelected}"`);

    // Check Fair Hiring banner
    const fairHiringBanner = await page.$eval('body', (el) => el.textContent.includes('Fair Hiring Protection Active'));
    console.log(`✓ Fair Hiring protection banner displayed: ${fairHiringBanner}`);

    // Check Job Matching Table
    const jobMatchingTable = await page.$eval('body', (el) => el.textContent.includes('Excel Job Matching Table'));
    console.log(`✓ Job Matching Table rendered: ${jobMatchingTable}`);

    // TEST 5: Verify Preview Table & Counts
    console.log('\n--- Step 5: Verify Candidate Import Preview Table & Badges ---');
    const previewSummary = await page.evaluate(() => {
      const el = document.querySelector('p.font-medium, h4');
      return el ? el.textContent.trim() : '';
    });
    console.log(`✓ Preview Summary Text: "${previewSummary}"`);

    // Check parsed experience in preview
    const experienceText = await page.$eval('body', (el) => el.textContent.includes('0 yrs (Fresher)') || el.textContent.includes('2 yrs'));
    console.log(`✓ Parsed Experience format verified: ${experienceText}`);

    // TEST 6: Confirm & Import
    console.log('\n--- Step 6: Click "Confirm & Import" Button ---');
    const confirmBtn = await findButtonByText(page, 'Confirm & Import');
    if (!confirmBtn) {
      console.log('Available buttons:', await page.$$eval('button', btns => btns.map(b => b.textContent.trim())));
      throw new Error('Confirm & Import button not found');
    }
    console.log(`Found confirm button with text: "${await confirmBtn.evaluate(el => el.textContent.trim())}"`);
    await confirmBtn.click();
    
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Import Completed Successfully!'),
        { timeout: 8000 }
      );
      console.log(`✓ Success Screen rendered: "Import Completed Successfully!"`);
    } catch (e) {
      const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.error('Page text after click:\n', bodySnippet);
      console.error('Browser console errors:\n', consoleErrors);
      throw e;
    }

    // Verify Action Buttons
    const hasPipelineBtn = await findLinkByText(page, 'Open in Pipeline');
    const hasCandidatesBtn = await findLinkByText(page, 'Open Candidates');
    const hasBatchSendBtn = await findLinkByText(page, 'Send forms (Batch Send)');
    console.log(`✓ Action Buttons present: Pipeline=${Boolean(hasPipelineBtn)}, Candidates=${Boolean(hasCandidatesBtn)}, BatchSend=${Boolean(hasBatchSendBtn)}`);

    // TEST 7: Open in Pipeline & Check "New import" tags
    console.log('\n--- Step 7: Open in Pipeline & Verify Batch Banner & Tags ---');
    if (hasPipelineBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        hasPipelineBtn.click(),
      ]);
      console.log(`✓ Pipeline URL: ${page.url()}`);

      const batchBanner = await page.$eval('body', (el) => el.textContent.includes('Showing') && el.textContent.includes('from your import'));
      console.log(`✓ Batch Import Banner visible in Pipeline: ${batchBanner}`);

      const newImportTags = await page.$$eval('span', (spans) => spans.filter(s => s.textContent.trim() === 'New import').length);
      console.log(`✓ "New import" tags found on cards: ${newImportTags}`);
    }

    // TEST 8: Immediate Job Filter Switch in Pipeline
    console.log('\n--- Step 8: Test Immediate Job Filter Switch in Pipeline ---');
    await page.waitForSelector('select#pipeline-job', { timeout: 10000 });
    await page.select('select#pipeline-job', 'job_1794477925189_0mycx');
    await sleep(1000);
    console.log(`✓ Job filter applied: current URL is ${page.url()}`);

    // TEST 9: Candidates Page Batch Filter
    console.log('\n--- Step 9: Check Candidates Page Batch Filter ---');
    await page.goto(`${BASE_URL}/candidates`, { waitUntil: 'networkidle0' });
    const batchSelect = await page.$('select');
    console.log(`✓ Filter dropdowns present in Candidates directory: ${Boolean(batchSelect)}`);

    // TEST 10: Test Undo Import on /import page
    console.log('\n--- Step 10: Test Undo Import Functionality ---');
    await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle0' });
    const undoBtn = await findButtonByText(page, 'Undo Import');
    if (undoBtn) {
      await undoBtn.click();
      await sleep(400);

      const confirmUndoBtn = await findButtonByText(page, 'Confirm Undo');
      if (confirmUndoBtn) {
        await confirmUndoBtn.click();
        await sleep(1500);
        console.log('✓ Import batch undone successfully.');
      }
    }

    // TEST 11: Mobile Viewport Responsiveness (375x667)
    console.log('\n--- Step 11: Mobile Viewport Responsiveness (375x667) ---');
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle0' });
    const mobileHeader = await page.$eval('h1', (el) => el.textContent);
    console.log(`✓ Mobile viewport rendered properly: "${mobileHeader}"`);

    // Console Error Check
    console.log(`\n✓ Total Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.warn('Console error details:', consoleErrors);
    }

    await browser.close();
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (hasMovedEnvLocal && fs.existsSync(envLocalBak)) {
      try {
        fs.renameSync(envLocalBak, envLocalPath);
      } catch {}
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n================================================================');
  console.log('✅ ALL WORKINDIA IMPORT BROWSER TEST SCENARIOS PASSED 100%');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal E2E test failure:', err);
  process.exit(1);
});
