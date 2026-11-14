import puppeteer from 'puppeteer-core';
import path from 'path';

async function testAllFormats() {
  console.log('========================================================');
  console.log('TESTING ALL WORKBOOK & CSV FORMATS IN CHROME VIA REAL UPLOAD');
  console.log('========================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const alerts = [];
  page.on('dialog', async d => {
    alerts.push(d.message());
    console.error(`[UNHANDLED BROWSER ALERT] "${d.message()}"`);
    await d.dismiss();
  });

  await page.goto('http://localhost:3000/import', { waitUntil: 'networkidle0' });

  async function uploadAndEvaluate(filePath, expectedType) {
    const fileName = path.basename(filePath);
    process.stdout.write(`Testing: ${fileName.padEnd(32)} ... `);

    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(filePath);

    // Wait for processing
    await new Promise(r => setTimeout(r, 1500));

    const pageText = await page.evaluate(() => document.body.innerText);

    if (expectedType === 'success') {
      const hasReadyCard = pageText.includes('READY TO IMPORT') || pageText.includes('Ready to Import');
      const hasErrorBanner = pageText.includes('Upload / Parsing Error');
      if (hasReadyCard && !hasErrorBanner) {
        // Extract ready count
        const readyCount = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('.bg-emerald-50 div'));
          return els.find(el => /^\d+$/.test(el.innerText.trim()))?.innerText.trim();
        });
        console.log(`✅ PASSED (${readyCount || 'candidates'} ready)`);
        return true;
      } else {
        console.log(`❌ FAILED (Expected success, text: ${pageText.slice(0, 200)}...)`);
        return false;
      }
    } else if (expectedType === 'empty_error') {
      const hasEmptyError = pageText.includes('empty (0 bytes)');
      if (hasEmptyError) {
        console.log(`✅ PASSED (Caught friendly empty error)`);
        return true;
      } else {
        console.log(`❌ FAILED (Did not display empty error)`);
        return false;
      }
    } else if (expectedType === 'corrupt_error') {
      const hasCorruptError = pageText.includes('could not be opened as a valid spreadsheet') ||
                             pageText.includes('not a valid Excel/CSV');
      if (hasCorruptError) {
        console.log(`✅ PASSED (Caught friendly format error)`);
        return true;
      } else {
        console.log(`❌ FAILED (Did not display corruption error)`);
        return false;
      }
    }
  }

  const results = {};

  // 1. Candidates_clean_for_import.xlsx
  results['clean_openpyxl'] = await uploadAndEvaluate(
    path.resolve('test_data', 'Candidates_clean_for_import.xlsx'),
    'success'
  );

  // 2. Sample_Job_Posting.xlsx
  results['multi_sheet_posting'] = await uploadAndEvaluate(
    path.resolve('test_data', 'Sample_Job_Posting.xlsx'),
    'success'
  );

  // 3. candidates_bom_quotes.csv
  results['csv_bom_quotes'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'candidates_bom_quotes.csv'),
    'success'
  );

  // 4. candidates_legacy.xls
  results['legacy_xls'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'candidates_legacy.xls'),
    'success'
  );

  // 5. excel_saved_candidates.xlsx
  results['excel_saved'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'excel_saved_candidates.xlsx'),
    'success'
  );

  // 6. google_sheets_export.xlsx
  results['gsheets_export'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'google_sheets_export.xlsx'),
    'success'
  );

  // 7. empty_file.xlsx
  results['empty_file'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'empty_file.xlsx'),
    'empty_error'
  );

  // 8. fake_renamed.xlsx
  results['fake_renamed'] = await uploadAndEvaluate(
    path.resolve('test_data', 'additional_formats', 'fake_renamed.xlsx'),
    'corrupt_error'
  );

  await browser.close();

  console.log('\n========================================================');
  console.log('SUMMARY OF ALL FORMAT TESTS:');
  const allPassed = Object.values(results).every(Boolean) && alerts.length === 0;
  console.log(`Total tests: ${Object.keys(results).length}`);
  console.log(`Passed: ${Object.values(results).filter(Boolean).length}`);
  console.log(`Unhandled browser alerts: ${alerts.length}`);
  console.log(`Status: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log('========================================================');

  if (!allPassed) process.exit(1);
}

testAllFormats().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

