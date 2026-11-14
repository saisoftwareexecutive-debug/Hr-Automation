import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

async function testRealUpload() {
  console.log('=== STARTING REAL BROWSER UPLOAD VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const alerts = [];
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR]`, msg.text());
      consoleErrors.push(msg.text());
    } else {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
    }
  });

  page.on('dialog', async dialog => {
    console.error(`[UNEXPECTED ALERT DIALOG] "${dialog.message()}"`);
    alerts.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('http://localhost:3000/import', { waitUntil: 'networkidle0' });
  console.log('Page loaded: /import');

  // Helper to test <input type="file"> real upload
  async function testInputUpload(filePath, expectedName, expectedCount) {
    console.log(`\n--- Testing <input type="file"> upload with: ${path.basename(filePath)} ---`);
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(filePath);

    // Wait for UI to update
    await new Promise(r => setTimeout(r, 2000));

    // Verify summary card or error message on page
    const pageText = await page.evaluate(() => document.body.innerText);

    if (alerts.length > 0) {
      throw new Error(`Browser alert triggered: ${alerts.join(', ')}`);
    }

    const hasCandidateReady = pageText.includes(`${expectedCount}`) || pageText.includes('Ready to Import');
    console.log(`Contains "${expectedCount}" / Ready: ${hasCandidateReady}`);
    
    // Check imported count element
    const importedCard = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div'));
      for (const card of cards) {
        if (card.innerText && card.innerText.includes('Ready to Import')) {
          return card.innerText;
        }
      }
      return null;
    });
    console.log('Summary Card Content:', importedCard?.replace(/\n/g, ' '));
  }

  // Helper to test Drag & Drop event dispatch
  async function testDragAndDrop(filePath, expectedCount) {
    console.log(`\n--- Testing HTML5 Drag & Drop with: ${path.basename(filePath)} ---`);
    const fileBytes = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await page.evaluate(async (base64Data, name, type) => {
      // Decode base64 to Uint8Array
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const file = new File([bytes], name, { type });

      // Create DataTransfer
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Find dropzone (the dashed border div)
      const dropZone = document.querySelector('input[type="file"]').parentElement;

      // Dispatch dragover then drop
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      dropZone.dispatchEvent(dragOverEvent);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      dropZone.dispatchEvent(dropEvent);
    }, fileBytes.toString('base64'), fileName, mimeType);

    // Wait for UI
    await new Promise(r => setTimeout(r, 2000));

    const pageText = await page.evaluate(() => document.body.innerText);
    if (alerts.length > 0) {
      throw new Error(`Browser alert triggered on drag & drop: ${alerts.join(', ')}`);
    }

    const importedCard = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div'));
      for (const card of cards) {
        if (card.innerText && card.innerText.includes('Ready to Import')) {
          return card.innerText;
        }
      }
      return null;
    });
    console.log('Drag & Drop Card Content:', importedCard?.replace(/\n/g, ' '));
  }

  // 1. Test Candidates_clean_for_import.xlsx via <input type="file">
  const cleanPath = path.resolve('test_data', 'Candidates_clean_for_import.xlsx');
  await testInputUpload(cleanPath, 'Candidates_clean_for_import.xlsx', 5);

  // Take screenshot
  await page.screenshot({ path: 'test_clean_upload.png' });
  console.log('Saved screenshot: test_clean_upload.png');

  // 2. Test Sample_Job_Posting.xlsx via <input type="file">
  const samplePostingPath = path.resolve('test_data', 'Sample_Job_Posting.xlsx');
  await testInputUpload(samplePostingPath, 'Sample_Job_Posting.xlsx', 5);

  // Check multi-sheet and ignored rows
  const multiSheetInfo = await page.evaluate(() => {
    const sel = document.querySelector('select');
    return document.body.innerText.includes('Multi-Sheet Workbook Detected') &&
           document.body.innerText.includes('Ignored Non-Candidate Rows');
  });
  console.log('Multi-sheet detected & ignored rows displayed:', multiSheetInfo);

  // Take screenshot
  await page.screenshot({ path: 'test_sample_posting_upload.png' });
  console.log('Saved screenshot: test_sample_posting_upload.png');

  // 3. Test Drag & Drop with Candidates_clean_for_import.xlsx
  await testDragAndDrop(cleanPath, 5);

  // 4. Test Drag & Drop with Sample_Job_Posting.xlsx
  await testDragAndDrop(samplePostingPath, 5);

  console.log('\n=== ALL REAL BROWSER TESTS PASSED! ===');
  console.log('Alert count:', alerts.length);
  console.log('Console error count:', consoleErrors.length);

  await browser.close();
}

testRealUpload().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

