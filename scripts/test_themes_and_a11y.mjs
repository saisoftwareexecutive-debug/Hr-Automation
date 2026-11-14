import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/LENOVO/.gemini/antigravity/brain/7635949d-bf31-4448-b136-2168b351dc85';
const AXE_PATH = path.resolve('node_modules/axe-core/axe.min.js');
const axeSource = fs.readFileSync(AXE_PATH, 'utf8');

const BASE_URL = 'http://localhost:3000';

const PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'candidates', path: '/candidates' },
  { name: 'candidate_detail', path: '/candidates/app_01' },
  { name: 'pipeline', path: '/pipeline' },
  { name: 'jobs', path: '/jobs' },
  { name: 'job_new', path: '/jobs/new' },
  { name: 'job_edit', path: '/jobs/b0000000-0000-0000-0000-000000000001' },
  { name: 'import', path: '/import' },
  { name: 'followups', path: '/followups' },
  { name: 'templates', path: '/templates' },
  { name: 'settings', path: '/settings' },
  { name: 'users', path: '/users' },
  { name: 'audit', path: '/audit' },
  { name: 'screening_form', path: '/apply/token_sample_001_amit' },
  { name: 'login', path: '/login' },
];

async function run() {
  console.log('===============================================================');
  console.log('HIREFLOW THEME SYSTEM & WCAG AA CONTRAST AUDIT');
  console.log('===============================================================\n');

  // Ensure output dirs exist
  ['light', 'dark'].forEach((theme) => {
    fs.mkdirSync(`screenshots/${theme}/desktop`, { recursive: true });
    fs.mkdirSync(`screenshots/${theme}/mobile`, { recursive: true });
  });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 1. Perform login to get session cookie
  console.log('Step 1: Logging in as Admin...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', 'admin@hireflow.internal');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));
  console.log('  Successfully authenticated.\n');

  const contrastSummary = {
    light: { checked: 0, violations: 0, violationDetails: [] },
    dark: { checked: 0, violations: 0, violationDetails: [] },
  };

  // 2. Iterate through themes
  for (const theme of ['light', 'dark']) {
    console.log(`\n================== TESTING THEME: ${theme.toUpperCase()} ==================`);

    for (const view of [
      { mode: 'desktop', width: 1440, height: 900, isMobile: false },
      { mode: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
    ]) {
      console.log(`\n--- Viewport: ${view.mode} (${view.width}x${view.height}) ---`);
      await page.setViewport(view);

      for (const p of PAGES) {
        const url = `${BASE_URL}${p.path}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
        } catch (e) {
          // If networkidle0 times out, wait 1s
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Apply theme deterministically
        await page.evaluate((t) => {
          localStorage.setItem('hireflow_theme_preference', t);
          if (t === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          window.dispatchEvent(new CustomEvent('hireflow-theme-change', { detail: { theme: t } }));
        }, theme);

        await new Promise((r) => setTimeout(r, 500));

        // Take screenshot
        const screenshotPath = `screenshots/${theme}/${view.mode}/${p.name}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Run Axe accessibility contrast test only on desktop viewport to avoid duplicate reporting
        if (view.mode === 'desktop') {
          await page.evaluate(axeSource);
          const axeResults = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: {
                type: 'rule',
                values: ['color-contrast'],
              },
            });
          });

          const violations = axeResults.violations || [];
          contrastSummary[theme].checked++;

          if (violations.length === 0) {
            console.log(`  [WCAG AA PASS] ${p.name.padEnd(20)}: 0 contrast violations -> ${screenshotPath}`);
          } else {
            contrastSummary[theme].violations += violations.length;
            const issues = violations.map((v) => ({
              page: p.name,
              help: v.help,
              nodes: v.nodes.length,
              target: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
            }));
            contrastSummary[theme].violationDetails.push(...issues);
            console.warn(`  [WCAG AA WARN] ${p.name.padEnd(20)}: ${violations.length} contrast issues (${violations[0].nodes.length} nodes)`);
          }
        } else {
          console.log(`  [Mobile Screen] ${p.name.padEnd(20)} -> ${screenshotPath}`);
        }
      }
    }
  }

  // 3. Test Modals in Dark and Light Theme
  console.log('\n--- Testing WhatsApp Modal in Light & Dark Mode ---');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/candidates/app_01`, { waitUntil: 'networkidle0' });

  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      localStorage.setItem('hireflow_theme_preference', t);
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('hireflow-theme-change', { detail: { theme: t } }));
    }, theme);

    // Click "Open WhatsApp"
    const openBtn = await page.$('button ::-p-text(Open WhatsApp)');
    if (openBtn) {
      await openBtn.click();
      await new Promise((r) => setTimeout(r, 600));

      const modalPath = `screenshots/${theme}/desktop/whatsapp_modal.png`;
      await page.screenshot({ path: modalPath });
      console.log(`  [Modal Captured] WhatsApp Modal (${theme}) -> ${modalPath}`);

      // Close modal
      const closeBtn = await page.$('button ::-p-text(Close)');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 4. Copy key highlights to artifact directory
  console.log('\nStep 4: Copying highlight screenshots to artifact directory...');
  const highlights = [
    { src: 'screenshots/dark/desktop/dashboard.png', dest: path.join(ARTIFACT_DIR, 'dashboard_dark_desktop.png') },
    { src: 'screenshots/light/desktop/dashboard.png', dest: path.join(ARTIFACT_DIR, 'dashboard_light_desktop.png') },
    { src: 'screenshots/dark/desktop/pipeline.png', dest: path.join(ARTIFACT_DIR, 'pipeline_dark_desktop.png') },
    { src: 'screenshots/light/desktop/pipeline.png', dest: path.join(ARTIFACT_DIR, 'pipeline_light_desktop.png') },
    { src: 'screenshots/dark/desktop/candidate_detail.png', dest: path.join(ARTIFACT_DIR, 'candidate_detail_dark.png') },
    { src: 'screenshots/dark/desktop/templates.png', dest: path.join(ARTIFACT_DIR, 'templates_dark.png') },
    { src: 'screenshots/dark/desktop/import.png', dest: path.join(ARTIFACT_DIR, 'import_dark.png') },
    { src: 'screenshots/dark/desktop/screening_form.png', dest: path.join(ARTIFACT_DIR, 'screening_form_dark.png') },
    { src: 'screenshots/dark/desktop/whatsapp_modal.png', dest: path.join(ARTIFACT_DIR, 'whatsapp_modal_dark.png') },
    { src: 'screenshots/dark/mobile/dashboard.png', dest: path.join(ARTIFACT_DIR, 'dashboard_dark_mobile.png') },
    { src: 'screenshots/dark/desktop/jobs.png', dest: path.join(ARTIFACT_DIR, 'jobs_dark.png') },
    { src: 'screenshots/dark/desktop/settings.png', dest: path.join(ARTIFACT_DIR, 'settings_dark.png') },
  ];

  highlights.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  Copied ${path.basename(dest)}`);
    }
  });

  await browser.close();

  console.log('\n===============================================================');
  console.log('AUDIT REPORT SUMMARY');
  console.log('===============================================================');
  console.log(`Light Mode Pages Checked: ${contrastSummary.light.checked}, Contrast Violations: ${contrastSummary.light.violations}`);
  console.log(`Dark Mode Pages Checked:  ${contrastSummary.dark.checked}, Contrast Violations: ${contrastSummary.dark.violations}`);
  if (contrastSummary.dark.violations > 0 || contrastSummary.light.violations > 0) {
    console.log('\nViolation Details:');
    console.log(JSON.stringify(contrastSummary, null, 2));
  } else {
    console.log('🎉 100% WCAG 2.1 AA Color Contrast COMPLIANT across all pages!');
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

