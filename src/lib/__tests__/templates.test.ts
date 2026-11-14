import { describe, it, expect } from 'vitest';
import {
  TONE_PRESETS,
  validateTemplateVariables,
  renderTemplate,
  calculateSmsSegments,
  formatWhatsAppMarkdown,
  createCandidateMessage,
  ALLOWED_VARIABLES,
} from '../templates';
import { TemplateType, MessageLanguage, MessageTone } from '@/types';

describe('Message Templates & Tone Engine', () => {
  const templateTypes: TemplateType[] = [
    'screening_invite',
    'reminder_24h',
    'interview_invite',
    'rejection',
  ];
  const languages: MessageLanguage[] = ['en', 'hi'];
  const tones: MessageTone[] = [
    'friendly',
    'professional',
    'warm_respectful',
    'short_direct',
    'polite_urgent',
  ];

  it('contains all 40 pre-written tone presets (4 templates x 2 languages x 5 tones)', () => {
    let presetCount = 0;
    for (const t of templateTypes) {
      for (const lang of languages) {
        for (const tone of tones) {
          const text = TONE_PRESETS[t]?.[lang]?.[tone];
          expect(text).toBeDefined();
          expect(text.length).toBeGreaterThan(20);
          presetCount++;
        }
      }
    }
    expect(presetCount).toBe(40);
  });

  describe('validateTemplateVariables', () => {
    it('accepts valid template variables without warnings or errors', () => {
      const content = 'Hello {{candidate_name}}, apply here {{form_link}} for {{job_title}} at {{company_name}}';
      const result = validateTemplateVariables(content, 'screening_invite');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('blocks saving screening_invite if {{form_link}} is missing', () => {
      const content = 'Hello {{candidate_name}}, please join us for {{job_title}}!';
      const result = validateTemplateVariables(content, 'screening_invite');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('{{form_link}} is mandatory');
    });

    it('blocks saving reminder_24h if {{form_link}} is missing', () => {
      const content = 'Gentle reminder {{candidate_name}} regarding {{job_title}} at {{company_name}}';
      const result = validateTemplateVariables(content, 'reminder_24h');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('{{form_link}} is mandatory');
    });

    it('allows interview_invite and rejection without {{form_link}}', () => {
      const interview = 'Hello {{candidate_name}}, interview on {{interview_date}} at {{interview_time}}';
      const res1 = validateTemplateVariables(interview, 'interview_invite');
      expect(res1.isValid).toBe(true);

      const rejection = 'Hello {{candidate_name}}, thank you for interviewing for {{job_title}} at {{company_name}}.';
      const res2 = validateTemplateVariables(rejection, 'rejection');
      expect(res2.isValid).toBe(true);
    });

    it('warns on unknown variables', () => {
      const content = 'Hello {{candidate_name}}, your caste is {{caste}} and age is {{candidate_age}} {{form_link}}';
      const result = validateTemplateVariables(content, 'screening_invite');
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.some((w) => w.includes('{{caste}}'))).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('replaces all 11 variables correctly', () => {
      const tmpl = '{{candidate_name}} | {{job_title}} | {{company_name}} | {{form_link}} | {{hr_name}} | {{hr_phone}} | {{interview_date}} | {{interview_time}} | {{interview_location}} | {{job_city}} | {{salary_range}}';
      const rendered = renderTemplate(tmpl, {
        candidate_name: 'Aarav Patel',
        job_title: 'Operations Executive',
        company_name: 'Acme India',
        form_link: 'http://localhost:3000/apply/tok123',
        hr_name: 'Rajesh Sharma',
        hr_phone: '+91 9820011111',
        interview_date: '15th Nov',
        interview_time: '2:30 PM',
        interview_location: 'Andheri East, Mumbai',
        job_city: 'Mumbai',
        salary_range: '₹25,000 - ₹32,000',
      });

      expect(rendered).toBe('Aarav Patel | Operations Executive | Acme India | http://localhost:3000/apply/tok123 | Rajesh Sharma | +91 9820011111 | 15th Nov | 2:30 PM | Andheri East, Mumbai | Mumbai | ₹25,000 - ₹32,000');
    });
  });

  describe('calculateSmsSegments', () => {
    it('calculates 1 GSM segment for ASCII text under 160 chars', () => {
      const asciiText = 'Hello candidate, please submit your screening form at https://hireflow.in/apply/xyz.';
      const res = calculateSmsSegments(asciiText);
      expect(res.isUnicode).toBe(false);
      expect(res.singleLimit).toBe(160);
      expect(res.segments).toBe(1);
      expect(res.isOverSingleSms).toBe(false);
    });

    it('detects Unicode (Hindi / Devanagari) and applies 70-character limit', () => {
      const hindiText = 'नमस्ते Aarav! कृपया इस लिंक पर क्लिक करके फॉर्म भरें: https://hireflow.in/apply/123';
      const res = calculateSmsSegments(hindiText);
      expect(res.isUnicode).toBe(true);
      expect(res.singleLimit).toBe(70);
      expect(res.segments).toBeGreaterThanOrEqual(1);
    });
  });

  describe('formatWhatsAppMarkdown', () => {
    it('converts *bold* and _italic_ to HTML tags safely', () => {
      const text = 'Hello *Candidate*, this is _important_!';
      const formatted = formatWhatsAppMarkdown(text);
      expect(formatted).toContain('Candidate</strong>');
      expect(formatted).toContain('important</em>');
    });
  });

  describe('createCandidateMessage', () => {
    it('generates valid WhatsApp wa.me link with URL-encoded message', () => {
      const res = createCandidateMessage(
        'screening_invite',
        'en',
        'Suresh Kumar',
        'Delivery Driver',
        '+91 9876543210',
        'test-token-123'
      );

      expect(res.whatsappUrl).toContain('https://wa.me/919876543210?text=');
      expect(res.smsUrl).toContain('sms:+91 9876543210?body=');
      expect(res.text).toContain('Suresh Kumar');
      expect(res.text).toContain('/apply/test-token-123');
    });
  });
});
