import { Application, Candidate, Job, ScoringRules, FormAnswers, CandidateNote, StatusHistoryItem, AuditLogItem, User, CompanySettings, MessageTemplate } from '@/types';
import { TONE_PRESETS } from '../templates';
import { COMPANY_NAME, COMPANY_TAGLINE, DEFAULT_LOGO_PATH } from '../brand';

// In production, HireFlow initializes clean with 0 dummy jobs or candidates.
// Sample demo datasets are preserved in src/lib/db/sampleSeedData.ts for optional developer testing via "npm run seed:sample".
export const INITIAL_JOBS: Job[] = [];

export const INITIAL_CANDIDATES: Candidate[] = [];

export const INITIAL_APPLICATIONS: Application[] = [];

export const INITIAL_FORM_ANSWERS: FormAnswers[] = [];

export const INITIAL_NOTES: CandidateNote[] = [];

export const INITIAL_STATUS_HISTORY: StatusHistoryItem[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_alex',
    email: 'admin@hireflow.internal',
    password_hash: '$2b$10$LV3d541DpzNnndkCvycHjeJwPZr3a9wJ2D0TV1yBJaIIK/GVL9LL2', // Seed placeholder replaced at init
    full_name: 'Alex',
    phone: '+91 98765 01000',
    role: 'admin',
    is_active: true,
    must_change_password: true,
    last_login_at: undefined,
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_exec_pallavi',
    email: 'Pallavimali@123',
    password_hash: '$2b$10$9JCeZPGSLJ06sMR99QrWGubJPtElBzmmZRJVUyfJeOule1sLXu.iC',
    full_name: 'Pallavi Mali',
    phone: '+91 98200 12345',
    role: 'hr_executive',
    is_active: true,
    must_change_password: false,
    last_login_at: undefined,
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_exec_shradha',
    email: 'shradha.yadav@hireflow.internal',
    password_hash: '$2b$10$O/NFrA.MBTUjCAJ.7KbpF.bfrxCMKkGEIAp7/7iI/9BJF043nMBpu',
    full_name: 'Shradha Yadav',
    phone: '+91 98200 67890',
    role: 'hr_executive',
    is_active: true,
    must_change_password: true,
    last_login_at: undefined,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_SETTINGS: CompanySettings = {
  company_name: COMPANY_NAME,
  tagline: COMPANY_TAGLINE,
  hr_name: 'Alex',
  hr_phone: '+91 9876543210',
  default_language: 'en',
  default_tone: 'friendly',
  inactivity_timeout_minutes: 30,
  logo_url: DEFAULT_LOGO_PATH,
  accent_color: '#4f46e5',
  daily_target: 25,
  updated_at: new Date().toISOString(),
};

export const INITIAL_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tmpl_screen_en_v1',
    template_type: 'screening_invite',
    language: 'en',
    tone: 'friendly',
    title: 'Screening Form Invite (English - Friendly)',
    content: TONE_PRESETS.screening_invite.en.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_screen_hi_v1',
    template_type: 'screening_invite',
    language: 'hi',
    tone: 'friendly',
    title: 'स्क्रीनिंग फॉर्म आमंत्रण (हिंदी - मैत्रीपूर्ण)',
    content: TONE_PRESETS.screening_invite.hi.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_remind_en_v1',
    template_type: 'reminder_24h',
    language: 'en',
    tone: 'friendly',
    title: '24-Hour Follow-up Reminder (English - Friendly)',
    content: TONE_PRESETS.reminder_24h.en.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_remind_hi_v1',
    template_type: 'reminder_24h',
    language: 'hi',
    tone: 'friendly',
    title: '24 घंटे का स्मरण पत्र (हिंदी - मैत्रीपूर्ण)',
    content: TONE_PRESETS.reminder_24h.hi.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_interview_en_v1',
    template_type: 'interview_invite',
    language: 'en',
    tone: 'friendly',
    title: 'Interview Invitation (English - Friendly)',
    content: TONE_PRESETS.interview_invite.en.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_interview_hi_v1',
    template_type: 'interview_invite',
    language: 'hi',
    tone: 'friendly',
    title: 'इंटरव्यू आमंत्रण (हिंदी - मैत्रीपूर्ण)',
    content: TONE_PRESETS.interview_invite.hi.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_reject_en_v1',
    template_type: 'rejection',
    language: 'en',
    tone: 'friendly',
    title: 'Polite Not Selected (English - Friendly)',
    content: TONE_PRESETS.rejection.en.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tmpl_reject_hi_v1',
    template_type: 'rejection',
    language: 'hi',
    tone: 'friendly',
    title: 'विनम्र अस्वीकृति संदेश (हिंदी - मैत्रीपूर्ण)',
    content: TONE_PRESETS.rejection.hi.friendly,
    version_number: 1,
    is_active: true,
    created_by: 'System Initializer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
