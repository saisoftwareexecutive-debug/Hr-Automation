import { describe, it, expect } from 'vitest';
import {
  assignApplications,
  autoSplitApplications,
  recordCallOutcome,
  getDailyProgress,
  getApplications,
  getUsers,
} from '../db';
import { renderTemplate } from '../templates';
import { COMPANY_NAME } from '../brand';

describe('HR Workflow: Assignment, Outcomes, Queue & Branding', () => {
  it('correctly assigns candidates to an HR Executive', async () => {
    const apps = await getApplications();
    expect(apps.length).toBeGreaterThan(0);
    const targetApp = apps[0];

    const result = await assignApplications(
      [targetApp.id],
      'usr_exec_pallavi',
      'Pallavi Mali',
      'admin@hireflow.internal'
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);

    const refreshed = await getApplications();
    const updated = refreshed.find((a) => a.id === targetApp.id);
    expect(updated?.assigned_to).toBe('usr_exec_pallavi');
    expect(updated?.assigned_to_name).toBe('Pallavi Mali');
  });

  it('auto-splits candidates evenly between Pallavi and Shradha', async () => {
    const apps = await getApplications();
    const candidateIds = apps.slice(0, 4).map((a) => a.id);

    const result = await autoSplitApplications(
      candidateIds,
      'admin@hireflow.internal',
      [
        { id: 'usr_exec_pallavi', name: 'Pallavi Mali' },
        { id: 'usr_exec_shradha', name: 'Shradha Yadav' },
      ]
    );

    expect(result.success).toBe(true);
    expect(result.assignments['Pallavi Mali']).toBe(2);
    expect(result.assignments['Shradha Yadav']).toBe(2);
  });

  it('records quick call outcomes with fair-hiring rejection reasons and updates status', async () => {
    const apps = await getApplications();
    const app = apps[0];

    // 1. Outcome: Selected for Interview
    const updated1 = await recordCallOutcome({
      applicationId: app.id,
      outcome: 'selected_for_interview',
      notes: 'Cleared initial screening, strong communication',
      authorName: 'Pallavi Mali',
      authorEmail: 'pallavi.mali@hireflow.internal',
    });

    expect(updated1.status).toBe('interview');
    expect(updated1.call_outcome).toBe('selected_for_interview');

    // 2. Outcome: Call back later with time
    const callbackTime = new Date(Date.now() + 3600000).toISOString();
    const updated2 = await recordCallOutcome({
      applicationId: app.id,
      outcome: 'call_back_later',
      callBackAt: callbackTime,
      notes: 'Candidate travelling in metro',
      authorName: 'Pallavi Mali',
      authorEmail: 'pallavi.mali@hireflow.internal',
    });

    expect(updated2.call_outcome).toBe('call_back_later');
    expect(updated2.call_back_at).toBe(callbackTime);

    // 3. Outcome: Not interested with fair job-related rejection reason
    const updated3 = await recordCallOutcome({
      applicationId: app.id,
      outcome: 'not_interested',
      rejectionReason: 'salary_mismatch',
      notes: 'Expects 50k, budget is 30k',
      authorName: 'Pallavi Mali',
      authorEmail: 'pallavi.mali@hireflow.internal',
    });

    expect(updated3.status).toBe('rejected');
    expect(updated3.call_outcome).toBe('not_interested');
    expect(updated3.rejection_reason).toBe('salary_mismatch');
  });

  it('computes daily progress statistics per HR user', async () => {
    const progress = await getDailyProgress();
    expect(progress).toBeDefined();
    expect(progress.teamTarget).toBeGreaterThan(0);
    expect(Array.isArray(progress.userStats)).toBe(true);

    const pallaviStats = progress.userStats.find((s) => s.user_name.includes('Pallavi'));
    expect(pallaviStats).toBeDefined();
    expect(pallaviStats?.target).toBe(25);
  });

  it('renders default company name in templates', () => {
    const template = 'Welcome to {{company_name}}! Position: {{job_title}}';
    const rendered = renderTemplate(template, {
      job_title: 'Customer Executive',
      company_name: COMPANY_NAME,
    });

    expect(rendered).toBe(`Welcome to ${COMPANY_NAME}! Position: Customer Executive`);
  });
});

