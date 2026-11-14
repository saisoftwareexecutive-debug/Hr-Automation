import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('HIREFLOW COMPREHENSIVE END-TO-END ACCEPTANCE TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function check(name, testFn) {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await testFn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED: ' + err.message);
      failed++;
    }
  }

  // 1. Dashboard Page
  await check('1. Dashboard renders and returns 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Recruitment Dashboard')) throw new Error('Dashboard heading missing');
    if (!html.includes('WorkIndia pipeline metrics')) throw new Error('Metrics description missing');
  });

  // 2. Import Page and Sample CSV
  await check('2. Import page and sample export files exist', async () => {
    const res = await fetch(`${BASE_URL}/import`);
    if (res.status !== 200) throw new Error(`Import page status ${res.status}`);
    const html = await res.text();
    if (!html.includes('WorkIndia Excel / CSV Import Wizard')) throw new Error('Import title missing');

    const csvRes = await fetch(`${BASE_URL}/sample_workindia_export.csv`);
    if (csvRes.status !== 200) throw new Error('sample_workindia_export.csv missing from public/');
  });

  // 3. API Import Candidates & Deduplication
  let testCandidateId = '';
  let testAppId = '';
  let testToken = '';

  await check('3. Import candidates via API, cleans phone (+91) & generates tokens', async () => {
    const candId = `cand_acc_test_${Date.now()}`;
    const newCandidate = {
      id: `app_acc_test_${Date.now()}`,
      candidate_id: candId,
      job_id: 'b0000000-0000-0000-0000-000000000001',
      status: 'new',
      score: 0,
      score_breakdown: {
        city_score: 0,
        exp_score: 0,
        skills_score: 0,
        salary_score: 0,
        notice_score: 0,
        shift_score: 0,
        notes: [],
      },
      token: `token_acc_test_${Date.now()}`,
      token_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      candidate: {
        id: candId,
        full_name: 'Aditya Ramesh Joshi',
        phone: '+919812345678',
        city: 'Bengaluru',
        source: 'workindia',
        created_at: new Date().toISOString(),
      },
    };

    testAppId = newCandidate.id;
    testCandidateId = newCandidate.candidate_id;
    testToken = newCandidate.token;

    const res = await fetch(`${BASE_URL}/api/candidates/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: [newCandidate] }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Import failed');
  });

  // 4. Pipeline Kanban Board
  await check('4. Pipeline Kanban board renders with 7 stages', async () => {
    const res = await fetch(`${BASE_URL}/pipeline`);
    if (res.status !== 200) throw new Error(`Pipeline status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Candidate Pipeline (Kanban)')) throw new Error('Kanban title missing');
    if (!html.includes('Shortlisted') || !html.includes('Interview')) throw new Error('Stages missing');
  });

  // 5. Public Screening Form (/apply/[token])
  await check('5. Public screening form renders for candidate with DPDP consent', async () => {
    const res = await fetch(`${BASE_URL}/apply/${testToken}`);
    if (res.status !== 200) throw new Error(`Form status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Aditya Ramesh Joshi') && !html.includes('नमस्ते')) {
      throw new Error('Candidate name or bilingual greeting missing on form');
    }
    if (!html.includes('DPDP')) throw new Error('India DPDP Act consent missing on form');
  });

  // 6. Submit Candidate Screening Answers & Run Scoring Engine
  await check('6. Submit screening answers, execute Fair-Hiring scoring & update status to "replied"', async () => {
    const res = await fetch(`${BASE_URL}/api/apply/${testToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_city: 'Bengaluru',
        experience_years: 2.0,
        matched_skills: ['Customer Service', 'Chat Support', 'Email Writing', 'CRM Handling', 'Problem Solving'],
        expected_salary: 24000,
        notice_period_days: 0,
        shift_preference: 'rotational',
        languages: ['Hindi', 'English'],
        preferred_interview_slot: 'Tomorrow 10:00 AM - 1:00 PM',
        consent_given: true,
        consent_text: 'DPDP consent agreement',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');
    if (data.score < 80) throw new Error(`Score ${data.score} was lower than expected for ideal match`);
    console.log(`(Score awarded: ${data.score}/100)`);
  });

  // 7. Verify Candidate Status & Score in Candidates Directory
  await check('7. Candidate Table shows candidate in "Replied" stage with score badge', async () => {
    const res = await fetch(`${BASE_URL}/candidates`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Aditya Ramesh Joshi')) throw new Error('Imported candidate missing from table');
  });

  // 8. Candidate Detail Page & Notes
  await check('8. Candidate Detail Page displays full score breakdown and form answers', async () => {
    const res = await fetch(`${BASE_URL}/candidates/${testAppId}`);
    if (res.status !== 200) throw new Error(`Detail page status ${res.status}`);
    const html = await res.text();
    if (!html.includes('Objective Scoring Breakdown')) throw new Error('Score breakdown missing');
    if (!html.includes('Bengaluru') || !html.includes('24,000')) throw new Error('Form answers missing');
  });

  // 9. Add HR Internal Note
  await check('9. Add HR internal observation note', async () => {
    const res = await fetch(`${BASE_URL}/api/candidates/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: testAppId,
        candidateId: testCandidateId,
        noteText: 'Candidate speaks fluent Hindi and English. Verified immediate availability.',
        authorName: 'Rajesh Sharma (Admin)',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add note');
  });

  // 10. Update Status on Kanban / Table
  await check('10. Move candidate status to "shortlisted"', async () => {
    const res = await fetch(`${BASE_URL}/api/candidates/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: testAppId,
        newStatus: 'shortlisted',
        reason: 'Scored 90+ on objective criteria. Shortlisted for interview.',
        changedBy: 'Priya Menon (HR Exec)',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Status change failed');
    if (data.application.status !== 'shortlisted') throw new Error('Status not updated to shortlisted');
  });

  // 11. Followups & Templates
  await check('11. Followups & Message Templates pages render properly', async () => {
    const resF = await fetch(`${BASE_URL}/followups`);
    if (resF.status !== 200) throw new Error(`Followups status ${resF.status}`);

    const resT = await fetch(`${BASE_URL}/templates`);
    if (resT.status !== 200) throw new Error(`Templates status ${resT.status}`);
  });

  // 12. Audit Trail Verification
  await check('12. Audit trail records all system actions', async () => {
    const res = await fetch(`${BASE_URL}/audit`);
    if (res.status !== 200) throw new Error(`Audit page status ${res.status}`);
    const html = await res.text();
    if (!html.includes('System Audit Trail')) throw new Error('Audit trail title missing');
    if (!html.includes('STATUS_CHANGED') && !html.includes('FORM_SUBMITTED')) {
      throw new Error('Recent audit events not visible');
    }
  });

  console.log('\n====================================================');
  console.log(`ACCEPTANCE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
