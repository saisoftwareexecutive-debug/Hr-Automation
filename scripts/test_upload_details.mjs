import puppeteer from 'puppeteer-core';
import path from 'path';

async function check() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('[LOG]', msg.text()));
  page.on('dialog', async d => {
    console.error('[DIALOG ALERT]', d.message());
    await d.dismiss();
  });
  await page.goto('http://localhost:3000/import', { waitUntil: 'networkidle0' });

  // 1. Upload Candidates_clean_for_import.xlsx
  console.log('\n========================================');
  console.log('Testing Candidates_clean_for_import.xlsx');
  console.log('========================================');
  let fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(path.resolve('test_data', 'Candidates_clean_for_import.xlsx'));
  await new Promise(r => setTimeout(r, 2000));

  let text = await page.evaluate(() => document.body.innerText);
  console.log('Clean file - Has Ready to Import:', text.includes('Ready to Import'));
  console.log('Clean file - Has 5 imported:', text.includes('5'));
  console.log('Clean file - Candidate table includes candidate names:', text.includes('Rohan Mehta') || text.includes('Kavita') || text.includes('Priya') || text.includes('Applicant'));

  // Extract summary card numbers
  let summaryBadges = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.bg-white.p-4, .bg-emerald-50.p-4, .bg-amber-50.p-4, .bg-rose-50.p-4, .bg-gray-50.p-4'));
    return cards.map(c => c.innerText.replace(/\n/g, ' | '));
  });
  console.log('Clean file summary cards:\n ', summaryBadges.join('\n  '));

  // 2. Upload Sample_Job_Posting.xlsx
  console.log('\n========================================');
  console.log('Testing Sample_Job_Posting.xlsx');
  console.log('========================================');
  fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(path.resolve('test_data', 'Sample_Job_Posting.xlsx'));
  await new Promise(r => setTimeout(r, 2000));

  text = await page.evaluate(() => document.body.innerText);
  console.log('Sample Posting - Multi-Sheet Detected:', text.includes('Multi-Sheet Workbook Detected'));
  console.log('Sample Posting - Active Sheet selection has Applicants:', text.includes('Applicants'));
  console.log('Sample Posting - Has Ready to Import:', text.includes('Ready to Import'));
  console.log('Sample Posting - Has Ignored Non-Candidate Rows:', text.includes('Ignored Non-Candidate Rows'));
  console.log('Sample Posting - Has Rohan Mehta:', text.includes('Rohan Mehta'));

  summaryBadges = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.bg-white.p-4, .bg-emerald-50.p-4, .bg-amber-50.p-4, .bg-rose-50.p-4, .bg-gray-50.p-4'));
    return cards.map(c => c.innerText.replace(/\n/g, ' | '));
  });
  console.log('Sample Posting summary cards:\n ', summaryBadges.join('\n  '));

  await browser.close();
  console.log('\nDone.');
}
check().catch(console.error);

