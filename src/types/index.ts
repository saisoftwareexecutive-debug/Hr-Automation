export type UserRole = 'admin' | 'hr_executive';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active?: boolean;
  must_change_password?: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  must_change_password?: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export type MessageTone =
  | 'friendly'
  | 'professional'
  | 'warm_respectful'
  | 'short_direct'
  | 'polite_urgent';

export type MessageLanguage = 'en' | 'hi';

export type TemplateType =
  | 'screening_invite'
  | 'reminder_24h'
  | 'interview_invite'
  | 'rejection';

export interface MessageTemplate {
  id: string;
  template_type: TemplateType;
  language: MessageLanguage;
  tone: MessageTone;
  title: string;
  content: string;
  version_number: number;
  is_active: boolean;
  job_id?: string | null; // optional per-job override
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  tagline?: string;
  hr_name: string;
  hr_phone: string;
  default_language: MessageLanguage;
  default_tone: MessageTone;
  inactivity_timeout_minutes: number;
  logo_url?: string | null;      // uploaded logo or null for monogram
  accent_color?: string | null;  // hex color preset
  daily_target?: number;         // daily call/outreach target per HR user
  updated_at?: string;
}

export type CallOutcome =
  | 'interested'
  | 'not_interested'
  | 'not_reachable'
  | 'call_back_later'
  | 'wrong_number'
  | 'already_working'
  | 'selected_for_interview';

export type RejectionReason =
  | 'experience_mismatch'
  | 'location_mismatch'
  | 'salary_mismatch'
  | 'notice_period'
  | 'shift_mismatch'
  | 'skills_mismatch'
  | 'not_interested'
  | 'no_response';

export interface DailyProgress {
  user_id: string;
  user_name: string;
  date: string;
  messages_sent: number;
  forms_received: number;
  calls_made: number;
  interviews_booked: number;
  selected: number;
  target?: number;
}

export interface LoginAttempt {
  id: string;
  email: string;
  timestamp: number;
  success: boolean;
}

export type ShiftType = 'day' | 'night' | 'rotational' | 'any';

export interface Job {
  id: string;
  title: string;
  department: string;
  city: string;
  location?: string; // Specific work area or address (e.g., "Andheri East, near Marol Naka metro")
  map_url?: string;  // Optional Google Maps link (https URL)
  openings: number;
  min_exp_years: number;
  max_exp_years: number;
  min_salary: number;
  max_salary: number;
  shift_type: ShiftType;
  required_skills: string[];
  required_languages: string[];
  status: 'active' | 'closed';
  created_by: string;
  created_at: string;
  updated_at?: string;
  scoring_rules?: ScoringRules;
}

export interface ScoringWeights {
  city_weight: number;
  exp_weight: number;
  skills_weight: number;
  salary_weight: number;
  notice_weight: number;
  shift_weight: number;
}

export interface ScoringCriteria {
  preferred_cities?: string[];
  max_acceptable_salary?: number;
  max_notice_days?: number;
  mandatory_skills?: string[];
}

export interface ScoringRules {
  id: string;
  job_id: string;
  weights: ScoringWeights;
  criteria: ScoringCriteria;
  created_at?: string;
  updated_at?: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  phone: string; // Normalized E.164 (+91XXXXXXXXXX)
  email?: string | null;
  city?: string | null;
  total_experience_months?: number;
  current_salary?: number | null;
  source: string;
  batch_id?: string;
  created_at: string;
  updated_at?: string;
}

export type ApplicationStatus =
  | 'new'
  | 'form_sent'
  | 'replied'
  | 'shortlisted'
  | 'interview'
  | 'selected'
  | 'rejected';

export interface ScoreBreakdown {
  city_score: number;
  exp_score: number;
  skills_score: number;
  salary_score: number;
  notice_score: number;
  shift_score: number;
  notes: string[];
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  status: ApplicationStatus;
  score: number;
  score_breakdown: ScoreBreakdown;
  token: string;
  token_expires_at: string;
  form_sent_at?: string | null;
  replied_at?: string | null;
  interview_scheduled_at?: string | null;
  assigned_to?: string | null;        // user id of assigned HR
  assigned_to_name?: string | null;   // denormalized for display
  call_outcome?: CallOutcome | null;
  call_back_at?: string | null;       // ISO date for callback scheduling
  rejection_reason?: RejectionReason | null;
  batch_id?: string;
  created_at: string;
  updated_at?: string;

  // Joined fields for display
  candidate?: Candidate;
  job?: Job;
  form_answers?: FormAnswers;
}

export interface FormAnswers {
  id: string;
  application_id: string;
  current_city: string;
  experience_years: number;
  matched_skills: string[];
  expected_salary: number;
  notice_period_days: number;
  shift_preference: string;
  languages: string[];
  preferred_interview_slot?: string;
  consent_given: boolean;
  consent_text: string;
  submitted_at: string;
}

export interface CandidateNote {
  id: string;
  application_id: string;
  candidate_id: string;
  author_name: string;
  created_by?: string;
  note_text: string;
  created_at: string;
}

export interface StatusHistoryItem {
  id: string;
  application_id: string;
  old_status?: string | null;
  new_status: ApplicationStatus;
  changed_by: string;
  reason?: string;
  created_at: string;
}

export interface MessageLogItem {
  id: string;
  application_id: string;
  recipient_phone: string;
  template_type: 'screening_invite' | 'reminder_24h' | 'interview_invite' | 'rejection' | 'custom';
  language: 'hi' | 'en';
  channel: 'whatsapp' | 'sms';
  message_body: string;
  sent_at: string;
}

export interface AuditLogItem {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface ImportCandidateRow {
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  experienceMonths?: number;
  currentSalary?: number;
  source?: string;
  rawRowIndex?: number;
  error?: string;
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidNumbers: number;
  importedApplications: Application[];
  errorRows: { rowNumber: number; reason: string; data: any }[];
  batchId?: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  job_id: string;
  job_title: string;
  candidate_count: number;
  imported_by: string;
  imported_at: string;
}

