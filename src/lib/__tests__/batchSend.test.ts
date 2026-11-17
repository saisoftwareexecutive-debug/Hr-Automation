import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeIndianPhone,
  formatIndianPhoneDisplay,
  getWhatsAppPhoneDigits,
} from '../phone';
import {
  renderTemplate,
  validateTemplateVariables,
  getFormUrl,
} from '../templates';
import { COMPANY_NAME } from '../brand';
import {
  batchSendConfirm,
  batchSendUndo,
  recordCallOutcome,
  getApplicationById,
  getLocalDb,
  saveLocalDb,
} from '../db';
import { Application, Candidate, Job } from '@/types';

describe('Batch Send Unit Tests', () => {
  describe('1. Phone Formatting and Normalization', () => {
    it('normalizes standard 10-digit Indian mobile numbers', () => {
      const res = normalizeIndianPhone('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('+919876543210');
      expect(res.nationalNumber).toBe('9876543210');
    });

    it('handles +91, spaces, dashes, leading 0, and 12-digit numbers', () => {
      expect(normalizeIndianPhone('+91 98765 43210').normalized).toBe('+919876543210');
      expect(normalizeIndianPhone('98765-43210').normalized).toBe('+919876543210');
      expect(normalizeIndianPhone('09876543210').normalized).toBe('+919876543210');
      expect(normalizeIndianPhone('919876543210').normalized).toBe('+919876543210');
    });

    it('rejects numbers that are too short, too long, letters, or invalid mobile series', () => {
      expect(normalizeIndianPhone('12345').isValid).toBe(false);
      expect(normalizeIndianPhone('98765432109999').isValid).toBe(false);
      expect(normalizeIndianPhone('abcdefghij').isValid).toBe(false);
      // Indian mobile numbers must start with 6, 7, 8, or 9
      expect(normalizeIndianPhone('5123456789').isValid).toBe(false);
      expect(normalizeIndianPhone('').isValid).toBe(false);
    });

    it('formats display phone in +91 XXXXX XXXXX standard layout', () => {
      expect(formatIndianPhoneDisplay('9876543210')).toBe('+91 98765 43210');
      expect(formatIndianPhoneDisplay('+91 98200 11111')).toBe('+91 98200 11111');
    });

    it('extracts pure country code + digits for WhatsApp click-to-chat', () => {
      expect(getWhatsAppPhoneDigits('+91 98765 43210')).toBe('919876543210');
      expect(getWhatsAppPhoneDigits('09876543210')).toBe('919876543210');
    });
  });

  describe('2. Message Encoding for WhatsApp click-to-chat', () => {
    it('properly encodes Hindi text, emojis, newlines, and special characters', () => {
      const complexMessage = `नमस्ते Pallavi! 😊\nThank you for applying for the *Data Entry Operator* role & "opportunity" at ${COMPANY_NAME} #1.\nHere is your link: https://app.example.com/apply/tok123?ref=test%20mode+more`;

      const encoded = encodeURIComponent(complexMessage);
      const url = `https://wa.me/919876543210?text=${encoded}`;

      expect(url).toContain('https://wa.me/919876543210?text=');
      // Hindi text encoded
      expect(encoded).toContain(encodeURIComponent('नमस्ते'));
      // Emojis encoded
      expect(encoded).toContain(encodeURIComponent('😊'));
      // Ampersand encoded
      expect(encoded).toContain('%26');
      // Hash encoded
      expect(encoded).toContain('%23');
      // Question mark encoded
      expect(encoded).toContain('%3F');
      // Percent sign encoded
      expect(encoded).toContain('%25');
      // Newlines encoded
      expect(encoded).toContain('%0A');

      // Decodes back losslessly
      expect(decodeURIComponent(encoded)).toBe(complexMessage);
    });
  });

  describe('3. Template Rendering and Validation', () => {
    it('renders all contextual variables cleanly without extra blank lines', () => {
      const template = `Hello {{candidate_name}},\n\nApply for {{job_title}} at {{company_name}}.\nLink: {{form_link}}\n\nLocation: {{job_location}}\nMap: {{map_link}}`;

      const rendered = renderTemplate(template, {
        candidate_name: 'Rahul Sharma',
        job_title: 'Health Coordinator',
        company_name: COMPANY_NAME,
        form_link: 'https://example.com/apply/tok_abc',
        job_location: '', // empty: line removed cleanly
        map_link: '',     // empty: line removed cleanly
      });

      expect(rendered).toContain('Hello Rahul Sharma,');
      expect(rendered).toContain(`Apply for Health Coordinator at ${COMPANY_NAME}.`);
      expect(rendered).toContain('Link: https://example.com/apply/tok_abc');
      expect(rendered).not.toContain('Location:');
      expect(rendered).not.toContain('Map:');
    });

    it('flags missing {{form_link}} as an invalid template error', () => {
      const invalidTemplate = `Hello {{candidate_name}}, please call us for the job.`;
      const validation = validateTemplateVariables(invalidTemplate, 'screening_invite');
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('{{form_link}} is mandatory');
    });

    it('builds public token apply links', () => {
      const link = getFormUrl('token_xyz', 'https://hr-automation-sooty-eight.vercel.app');
      expect(link).toBe('https://hr-automation-sooty-eight.vercel.app/apply/token_xyz');
    });
  });

  describe('4. Concurrency Protection & Stage State Checks', () => {
    const testAppId = 'test_app_concurrency_1';
    const testCandidateId = 'test_cand_concurrency_1';
    const testJobId = 'job_deo';

    beforeEach(() => {
      const db = getLocalDb();
      // Set up a mock candidate and application in local DB
      db.candidates = db.candidates.filter((c) => c.id !== testCandidateId);
      db.applications = db.applications.filter((a) => a.id !== testAppId);

      db.candidates.push({
        id: testCandidateId,
        full_name: 'Fictional Candidate',
        phone: '+919000000001',
        city: 'Mumbai',
        total_experience_months: 12,
        current_salary: 15000,
        source: 'workindia',
        created_at: new Date().toISOString(),
      });

      db.applications.push({
        id: testAppId,
        candidate_id: testCandidateId,
        job_id: testJobId,
        status: 'new',
        score: 75,
        score_breakdown: {
          city_score: 20,
          exp_score: 20,
          skills_score: 20,
          salary_score: 15,
          notice_score: 0,
          shift_score: 0,
          notes: [],
        },
        token: 'test_token_batch_1',
        token_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        form_sent_at: null,
        replied_at: null,
        assigned_to: 'user_alex',
        assigned_to_name: 'Alex Admin',
        created_at: new Date().toISOString(),
      });

      saveLocalDb(db);
    });

    it('allows confirmed batch send when status is new, updating to form_sent', async () => {
      const res = await batchSendConfirm({
        applicationId: testAppId,
        mode: 'screening',
        recipientPhone: '+91 90000 00001',
        authorName: 'Alex Admin',
        authorEmail: 'alex@example.com',
        userRole: 'admin',
        userId: 'user_alex',
      });

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe('form_sent');
      expect(res.application?.form_sent_at).toBeTruthy();
    });

    it('blocks double-send if status is already form_sent, returning conflict: true', async () => {
      // First send succeeds
      await batchSendConfirm({
        applicationId: testAppId,
        mode: 'screening',
        recipientPhone: '+91 90000 00001',
        authorName: 'Alex Admin',
        authorEmail: 'alex@example.com',
        userRole: 'admin',
        userId: 'user_alex',
      });

      // Second attempt by admin or in another tab while candidate is already form_sent
      const duplicateRes = await batchSendConfirm({
        applicationId: testAppId,
        mode: 'screening',
        recipientPhone: '+91 90000 00001',
        authorName: 'Alex Admin 2',
        authorEmail: 'alex@example.com',
        userRole: 'admin',
        userId: 'user_alex',
      });

      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.conflict).toBe(true);
      expect(duplicateRes.currentStatus).toBe('form_sent');
    });

    it('enforces HR Executive role boundaries (cannot send for someone else)', async () => {
      const res = await batchSendConfirm({
        applicationId: testAppId, // Assigned to 'user_alex'
        mode: 'screening',
        recipientPhone: '+91 90000 00001',
        authorName: 'Shradha Yadav',
        authorEmail: 'shradha@example.com',
        userRole: 'hr_executive',
        userId: 'user_shradha', // Different user
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    });

    it('allows undoing a send, reverting status back to new', async () => {
      // Send first
      await batchSendConfirm({
        applicationId: testAppId,
        mode: 'screening',
        recipientPhone: '+91 90000 00001',
        authorName: 'Alex Admin',
        authorEmail: 'alex@example.com',
        userRole: 'admin',
        userId: 'user_alex',
      });

      // Undo
      const undoRes = await batchSendUndo({
        applicationId: testAppId,
        mode: 'screening',
        authorName: 'Alex Admin',
        authorEmail: 'alex@example.com',
        userRole: 'admin',
        userId: 'user_alex',
      });

      expect(undoRes.success).toBe(true);
      expect(undoRes.application?.status).toBe('new');
      expect(undoRes.application?.form_sent_at).toBeNull();
    });

    it('records wrong number outcome properly', async () => {
      const updated = await recordCallOutcome({
        applicationId: testAppId,
        outcome: 'wrong_number',
        notes: 'Marked wrong number in batch outreach',
        authorName: 'Alex Admin',
        authorEmail: 'alex@example.com',
      });

      expect(updated.call_outcome).toBe('wrong_number');
    });
  });
});
