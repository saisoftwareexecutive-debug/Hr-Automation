import puppeteer from 'puppeteer-core';
import path from 'path';

async function reproduce() {
  console.log('Launching Chrome to reproduce upload bug...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}]`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[BROWSER PAGE ERROR]', err.message);
  });

  page.on('dialog', async dialog => {
    console.log(`[BROWSER DIALOG ALERT] Type: ${dialog.type()}, Message: "${dialog.message()}"`);
    await dialog.dismiss();
  });

  await page.goto('http://localhost:3000/import', { waitUntil: 'networkidle0' });
  console.log('Navigated to /import');

  // Find the file input
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    console.error('File input not found!');
    await browser.close();
    return;
  }

  const cleanFilePath = path.resolve('test_data', 'Candidates_clean_for_import.xlsx');
  console.log('Setting file on input:', cleanFilePath);
  await fileInput.uploadFile(cleanFilePath);

  // Wait 3 seconds to observe behavior
  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
  console.log('Browser closed.');
}

reproduce().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

