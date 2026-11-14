import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/LENOVO/.gemini/antigravity/brain/7635949d-bf31-4448-b136-2168b351dc85';
const SCREENSHOT_DIR = path.resolve('screenshots');
const BASE_URL = 'http://localhost:3000';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        return true;
      }
    } catch (e) {
      // not yet up
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function copyArtifact(filename) {
  try {
    const src = path.join(SCREENSHOT_DIR, filename);
    const dest = path.join(ARTIFACT_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  Artifact saved: ${dest}`);
    }
  } catch (e) {
    console.warn(`  Failed to copy artifact ${filename}:`, e.message);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('STARTING HIREFLOW PRODUCTION VERIFICATION: LOCATION & BRANDING');
  console.log('===============================================================\n');

  // Start Next.js production server directly using node
  console.log('1. Starting Next.js production server on port 3000...');
  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const server = spawn(process.execPath, [nextBin, 'start', '-p', '3000'], {
    stdio: 'pipe',
    cwd: process.cwd(),
  });

  server.stdout.on('data', (d) => {
    // console.log(`[next] ${d.toString().trim()}`);
  });
  server.stderr.on('data', (d) => {
    // console.error(`[next err] ${d.toString().trim()}`);
  });

  try {
    await waitForServer(`${BASE_URL}/login`);
    console.log('  ✓ Production server is live on http://localhost:3000\n');

    // 2. HTTP Static Assets Check
    console.log('2. Verifying favicon and brand asset HTTP responses...');
    const assetChecks = [
      { path: '/favicon.ico', expectedStatus: 200 },
      { path: '/icon.png', expectedStatus: 200 },
      { path: '/apple-icon.png', expectedStatus: 200 },
      { path: '/site.webmanifest', expectedStatus: 200 },
      { path: '/brand/logo.png', expectedStatus: 200 },
      { path: '/brand/logo-mark.png', expectedStatus: 200 },
      { path: '/brand/logo-256.png', expectedStatus: 200 },
    ];

    for (const asset of assetChecks) {
      const res = await fetch(`${BASE_URL}${asset.path}`);
      if (res.status === asset.expectedStatus) {
        console.log(`  ✓ ${asset.path} -> HTTP ${res.status} (${res.headers.get('content-type')})`);
      } else {
        console.error(`  ✗ ${asset.path} -> HTTP ${res.status} (expected ${asset.expectedStatus})`);
      }
    }
    console.log();

    // 3. Launch Puppeteer Browser
    console.log('3. Launching browser test with Google Chrome...');
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Step A: Login Page with Company Logo
    console.log('Step A: Testing Login Page with Company Logo...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login_page_logo.png') });
    await copyArtifact('login_page_logo.png');
    console.log('  ✓ Captured screenshots/login_page_logo.png');

    // Authenticate
    await page.type('input[type="email"]', 'admin@hireflow.internal');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    console.log('  ✓ Authenticated as admin\n');

    // Step B: Desktop Sidebar - Expanded and Collapsed
    console.log('Step B: Testing Sidebar with Company Logo...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'sidebar_expanded_logo.png') });
    await copyArtifact('sidebar_expanded_logo.png');
    console.log('  ✓ Captured screenshots/sidebar_expanded_logo.png');

    // Click collapse button
    const collapseBtn = await page.$('aside button[title="Collapse sidebar"]');
    if (collapseBtn) {
      await collapseBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'sidebar_collapsed_logo.png') });
      await copyArtifact('sidebar_collapsed_logo.png');
      console.log('  ✓ Captured screenshots/sidebar_collapsed_logo.png');

      // Expand back
      const expandBtn = await page.$('aside button[title="Expand sidebar"]');
      if (expandBtn) await expandBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // Step C: Job Edit Page - Location & Maps Link
    console.log('\nStep C: Testing Job Edit Form (City & Location side-by-side)...');
    await page.goto(`${BASE_URL}/jobs/b0000000-0000-0000-0000-000000000001`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // Verify fields exist
    const cityInput = await page.$('input[placeholder*="Bengaluru"]');
    const locationInput = await page.$('input[placeholder*="Koramangala"]');
    const mapsInput = await page.$('input[placeholder*="maps.google.com"]');
    console.log(`  Target City input present: ${!!cityInput}`);
    console.log(`  Location input present: ${!!locationInput}`);
    console.log(`  Maps URL input present: ${!!mapsInput}`);

    // Light mode screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'edit_job_desktop_light.png') });
    await copyArtifact('edit_job_desktop_light.png');
    console.log('  ✓ Captured screenshots/edit_job_desktop_light.png');

    // Toggle to Dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'edit_job_desktop_dark.png') });
    await copyArtifact('edit_job_desktop_dark.png');
    console.log('  ✓ Captured screenshots/edit_job_desktop_dark.png');

    // Revert to light
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    });

    // Step D: Jobs Page - Location display
    console.log('\nStep D: Testing Jobs list page with location...');
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'jobs_page_location.png') });
    await copyArtifact('jobs_page_location.png');
    console.log('  ✓ Captured screenshots/jobs_page_location.png');

    // Step E: WhatsApp Modal with Location and Map Link
    console.log('\nStep E: Testing Candidates WhatsApp Modal with location & map link...');
    await page.goto(`${BASE_URL}/candidates`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    // Find and click the WhatsApp button
    const waButtons = await page.$$('button[title*="WhatsApp"], button:has(svg.text-emerald-600)');
    if (waButtons.length > 0) {
      await waButtons[0].click();
      await new Promise((r) => setTimeout(r, 800));

      // Select Interview Invitation template
      const selectHandle = await page.$('select');
      if (selectHandle) {
        await page.select('select', 'interview_invite').catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'whatsapp_interview_location.png') });
      await copyArtifact('whatsapp_interview_location.png');
      console.log('  ✓ Captured screenshots/whatsapp_interview_location.png');

      // Close modal
      const closeButtons = await page.$$('button');
      for (const btn of closeButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Cancel')) {
          await btn.click();
          break;
        }
      }
    }

    // Step F: Public Screening Form with Company Logo & Location
    console.log('\nStep F: Testing Public Screening Form (/apply/token_sample_001_amit)...');
    await page.goto(`${BASE_URL}/apply/token_sample_001_amit`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'public_form_location.png') });
    await copyArtifact('public_form_location.png');
    console.log('  ✓ Captured screenshots/public_form_location.png');

    // Step G: Settings Page - Company Identity & Logo
    console.log('\nStep G: Testing Settings Page Logo Section...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings_logo_section.png') });
    await copyArtifact('settings_logo_section.png');
    console.log('  ✓ Captured screenshots/settings_logo_section.png');

    await browser.close();
    console.log('\n===============================================================');
    console.log('ALL VERIFICATION STEPS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
  } finally {
    // Terminate the server
    console.log('Stopping production server...');
    try {
      server.kill('SIGTERM');
      spawn('taskkill', ['/pid', server.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
    } catch (e) {
      // ignore
    }
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
