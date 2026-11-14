import { supabaseAdmin } from '../supabase';
import {
  Application,
  AuditLogItem,
  Candidate,
  CandidateNote,
  CompanySettings,
  DailyProgress,
  FormAnswers,
  ImportBatch,
  Job,
  LoginAttempt,
  MessageLogItem,
  MessageTemplate,
  ScoringRules,
  StatusHistoryItem,
  User,
} from '@/types';
import { calculateCandidateScore } from '../scoring';
import { generateUUID } from '../id';
import { COMPANY_NAME, COMPANY_TAGLINE } from '../brand';
import { TONE_PRESETS } from '../templates';

function getClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase client is not configured');
  }
  return supabaseAdmin;
}

// -------------------------------------------------------------
// JOBS & SCORING RULES
// -------------------------------------------------------------

export async function getJobs(): Promise<Job[]> {
  const supabase = getClient();
  const { data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('*, scoring_rules(*)')
    .order('created_at', { ascending: false });

  if (jobsError) {
    console.error('Supabase getJobs error:', jobsError);
    return [];
  }

  return (jobsData || []).map((row: any) => {
    const rules = Array.isArray(row.scoring_rules) ? row.scoring_rules[0] : row.scoring_rules;
    return {
      id: row.id,
      title: row.title,
      department: row.department,
      city: row.city,
      location: row.location || undefined,
      map_url: row.map_url || undefined,
      openings: Number(row.openings),
      min_exp_years: Number(row.min_exp_years),
      max_exp_years: Number(row.max_exp_years),
      min_salary: Number(row.min_salary),
      max_salary: Number(row.max_salary),
      shift_type: row.shift_type,
      required_skills: row.required_skills || [],
      required_languages: row.required_languages || [],
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      scoring_rules: rules
        ? {
            id: rules.id,
            job_id: rules.job_id,
            weights: rules.weights,
            criteria: rules.criteria,
            created_at: rules.created_at,
            updated_at: rules.updated_at,
          }
        : undefined,
    };
  });
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, scoring_rules(*)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const rules = Array.isArray(data.scoring_rules) ? data.scoring_rules[0] : data.scoring_rules;
  return {
    id: data.id,
    title: data.title,
    department: data.department,
    city: data.city,
    location: data.location || undefined,
    map_url: data.map_url || undefined,
    openings: Number(data.openings),
    min_exp_years: Number(data.min_exp_years),
    max_exp_years: Number(data.max_exp_years),
    min_salary: Number(data.min_salary),
    max_salary: Number(data.max_salary),
    shift_type: data.shift_type,
    required_skills: data.required_skills || [],
    required_languages: data.required_languages || [],
    status: data.status,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    scoring_rules: rules
      ? {
          id: rules.id,
          job_id: rules.job_id,
          weights: rules.weights,
          criteria: rules.criteria,
          created_at: rules.created_at,
          updated_at: rules.updated_at,
        }
      : undefined,
  };
}

export async function createJob(jobData: Omit<Job, 'id' | 'created_at'>): Promise<Job> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const id = generateUUID();

  const { scoring_rules: incomingRules, ...jobFields } = jobData;
  const trimmedLocation = jobFields.location ? jobFields.location.trim().slice(0, 200) : '';
  let mapUrl = jobFields.map_url ? jobFields.map_url.trim() : '';
  if (!mapUrl && (trimmedLocation || jobFields.city)) {
    const query = [trimmedLocation, jobFields.city].filter(Boolean).join(', ');
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  const { data: jobRow, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      id,
      title: jobFields.title,
      department: jobFields.department || 'Operations',
      city: jobFields.city,
      location: trimmedLocation || null,
      map_url: mapUrl || null,
      openings: jobFields.openings,
      min_exp_years: jobFields.min_exp_years,
      max_exp_years: jobFields.max_exp_years,
      min_salary: jobFields.min_salary,
      max_salary: jobFields.max_salary,
      shift_type: jobFields.shift_type,
      required_skills: jobFields.required_skills || [],
      required_languages: jobFields.required_languages || ['Hindi', 'English'],
      status: jobFields.status || 'active',
      created_by: jobFields.created_by || 'HR Admin',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (jobErr) {
    throw new Error(`Failed to create job in Supabase: ${jobErr.message}`);
  }

  const defaultWeights = incomingRules?.weights || {
    city_weight: 20,
    exp_weight: 25,
    skills_weight: 25,
    salary_weight: 15,
    notice_weight: 10,
    shift_weight: 5,
  };

  const defaultCriteria = incomingRules?.criteria || {
    preferred_cities: [jobFields.city],
    max_acceptable_salary: jobFields.max_salary,
    max_notice_days: 30,
    mandatory_skills: (jobFields.required_skills || []).slice(0, 2),
  };

  const ruleId = generateUUID();
  const { data: ruleRow } = await supabase
    .from('scoring_rules')
    .insert({
      id: ruleId,
      job_id: id,
      weights: defaultWeights,
      criteria: defaultCriteria,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  return {
    ...jobData,
    id,
    created_at: now,
    scoring_rules: ruleRow
      ? {
          id: ruleRow.id,
          job_id: ruleRow.job_id,
          weights: ruleRow.weights,
          criteria: ruleRow.criteria,
          created_at: ruleRow.created_at,
          updated_at: ruleRow.updated_at,
        }
      : undefined,
  };
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { scoring_rules: incomingRules, ...fields } = updates;
  const updatePayload: any = { updated_at: now };

  if (fields.title !== undefined) updatePayload.title = fields.title;
  if (fields.department !== undefined) updatePayload.department = fields.department;
  if (fields.city !== undefined) updatePayload.city = fields.city;
  if (fields.location !== undefined) updatePayload.location = fields.location || null;
  if (fields.map_url !== undefined) updatePayload.map_url = fields.map_url || null;
  if (fields.openings !== undefined) updatePayload.openings = fields.openings;
  if (fields.min_exp_years !== undefined) updatePayload.min_exp_years = fields.min_exp_years;
  if (fields.max_exp_years !== undefined) updatePayload.max_exp_years = fields.max_exp_years;
  if (fields.min_salary !== undefined) updatePayload.min_salary = fields.min_salary;
  if (fields.max_salary !== undefined) updatePayload.max_salary = fields.max_salary;
  if (fields.shift_type !== undefined) updatePayload.shift_type = fields.shift_type;
  if (fields.required_skills !== undefined) updatePayload.required_skills = fields.required_skills;
  if (fields.required_languages !== undefined) updatePayload.required_languages = fields.required_languages;
  if (fields.status !== undefined) updatePayload.status = fields.status;

  const { error } = await supabase.from('jobs').update(updatePayload).eq('id', id);
  if (error) {
    console.error('Supabase updateJob error:', error);
    return null;
  }

  if (incomingRules) {
    await updateScoringRules(id, incomingRules);
  }

  return getJobById(id);
}

export async function closeJob(jobId: string, adminEmail: string): Promise<Job | null> {
  const updated = await updateJob(jobId, { status: 'closed' });
  if (updated) {
    await logAuditEvent(adminEmail, 'JOB_CLOSED', 'job', jobId, { title: updated.title });
  }
  return updated;
}

export async function deleteJob(
  jobId: string,
  options: { deleteApplicants?: boolean; adminEmail: string }
): Promise<{ success: boolean; error?: string; deletedJob?: Job; deletedApplications?: Application[] }> {
  const supabase = getClient();
  const existingJob = await getJobById(jobId);
  if (!existingJob) {
    return { success: false, error: 'Job not found' };
  }

  const { data: appsData } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', jobId);

  const appsCount = (appsData || []).length;
  if (appsCount > 0 && !options.deleteApplicants) {
    return {
      success: false,
      error: `Job has ${appsCount} applicants. Please confirm applicant deletion or close the job instead.`,
    };
  }

  let deletedApplications: Application[] = [];
  if (appsCount > 0) {
    deletedApplications = await getCandidates({ jobId });
  }

  const { error: delErr } = await supabase.from('jobs').delete().eq('id', jobId);
  if (delErr) {
    return { success: false, error: delErr.message };
  }

  await logAuditEvent(options.adminEmail, 'JOB_DELETED', 'job', jobId, {
    title: existingJob.title,
    city: existingJob.city,
    location: existingJob.location,
    deletedApplicantsCount: deletedApplications.length,
  });

  return {
    success: true,
    deletedJob: existingJob,
    deletedApplications,
  };
}

export async function restoreJob(
  backup: { job: Job; applications?: Application[] },
  adminEmail: string
): Promise<boolean> {
  const supabase = getClient();
  const { job, applications = [] } = backup;

  const existing = await getJobById(job.id);
  if (existing) return false;

  const { error: jobErr } = await supabase.from('jobs').insert({
    id: job.id,
    title: job.title,
    department: job.department,
    city: job.city,
    location: job.location || null,
    map_url: job.map_url || null,
    openings: job.openings,
    min_exp_years: job.min_exp_years,
    max_exp_years: job.max_exp_years,
    min_salary: job.min_salary,
    max_salary: job.max_salary,
    shift_type: job.shift_type,
    required_skills: job.required_skills,
    required_languages: job.required_languages,
    status: job.status,
    created_by: job.created_by,
    created_at: job.created_at,
    updated_at: job.updated_at || job.created_at,
  });

  if (jobErr) return false;

  if (job.scoring_rules) {
    await supabase.from('scoring_rules').insert({
      id: job.scoring_rules.id || generateUUID(),
      job_id: job.id,
      weights: job.scoring_rules.weights,
      criteria: job.scoring_rules.criteria,
      created_at: job.scoring_rules.created_at || job.created_at,
      updated_at: job.scoring_rules.updated_at || job.created_at,
    });
  }

  if (applications.length > 0) {
    await saveImportedApplications(applications);
  }

  await logAuditEvent(adminEmail, 'JOB_RESTORED', 'job', job.id, {
    title: job.title,
    restoredApplicantsCount: applications.length,
  });

  return true;
}

export async function updateScoringRules(jobId: string, rules: Partial<ScoringRules>): Promise<ScoringRules | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (existing) {
    const updatedWeights = rules.weights ? { ...existing.weights, ...rules.weights } : existing.weights;
    const updatedCriteria = rules.criteria ? { ...existing.criteria, ...rules.criteria } : existing.criteria;

    const { data: updated, error } = await supabase
      .from('scoring_rules')
      .update({
        weights: updatedWeights,
        criteria: updatedCriteria,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !updated) return null;
    return {
      id: updated.id,
      job_id: updated.job_id,
      weights: updated.weights,
      criteria: updated.criteria,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  } else {
    const ruleId = generateUUID();
    const { data: created, error } = await supabase
      .from('scoring_rules')
      .insert({
        id: ruleId,
        job_id: jobId,
        weights: rules.weights || {},
        criteria: rules.criteria || {},
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !created) return null;
    return {
      id: created.id,
      job_id: created.job_id,
      weights: created.weights,
      criteria: created.criteria,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }
}

// -------------------------------------------------------------
// CANDIDATES & APPLICATIONS
// -------------------------------------------------------------

export async function getCandidates(filters?: {
  jobId?: string;
  status?: string;
  search?: string;
  assignedTo?: string;
  source?: string;
}): Promise<Application[]> {
  const supabase = getClient();
  let query = supabase.from('applications').select(`
    *,
    candidate:candidates(*),
    job:jobs(*),
    form_answers:form_answers(*)
  `);

  if (filters?.jobId) {
    query = query.eq('job_id', filters.jobId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase getCandidates error:', error);
    return [];
  }

  let apps = (data || []).map((row: any) => {
    const candidate = Array.isArray(row.candidate) ? row.candidate[0] : row.candidate;
    const job = Array.isArray(row.job) ? row.job[0] : row.job;
    const fa = Array.isArray(row.form_answers) ? row.form_answers[0] : row.form_answers;

    return {
      id: row.id,
      candidate_id: row.candidate_id,
      job_id: row.job_id,
      status: row.status,
      score: Number(row.score),
      score_breakdown: row.score_breakdown || {
        city_score: 0,
        exp_score: 0,
        skills_score: 0,
        salary_score: 0,
        notice_score: 0,
        shift_score: 0,
        notes: [],
      },
      token: row.token,
      token_expires_at: row.token_expires_at,
      form_sent_at: row.form_sent_at,
      replied_at: row.replied_at,
      interview_scheduled_at: row.interview_scheduled_at,
      assigned_to: row.assigned_to,
      assigned_to_name: row.assigned_to_name,
      call_outcome: row.call_outcome,
      call_back_at: row.call_back_at,
      rejection_reason: row.rejection_reason,
      batch_id: row.batch_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      candidate: candidate
        ? {
            id: candidate.id,
            full_name: candidate.full_name,
            phone: candidate.phone,
            email: candidate.email,
            city: candidate.city,
            total_experience_months: candidate.total_experience_months,
            current_salary: candidate.current_salary,
            source: candidate.source,
            batch_id: candidate.batch_id,
            created_at: candidate.created_at,
            updated_at: candidate.updated_at,
          }
        : undefined,
      job: job
        ? {
            id: job.id,
            title: job.title,
            department: job.department,
            city: job.city,
            location: job.location,
            map_url: job.map_url,
            openings: job.openings,
            min_exp_years: job.min_exp_years,
            max_exp_years: job.max_exp_years,
            min_salary: job.min_salary,
            max_salary: job.max_salary,
            shift_type: job.shift_type,
            required_skills: job.required_skills,
            required_languages: job.required_languages,
            status: job.status,
            created_by: job.created_by,
            created_at: job.created_at,
          }
        : undefined,
      form_answers: fa
        ? {
            id: fa.id,
            application_id: fa.application_id,
            current_city: fa.current_city,
            experience_years: Number(fa.experience_years),
            matched_skills: fa.matched_skills || [],
            expected_salary: Number(fa.expected_salary),
            notice_period_days: Number(fa.notice_period_days),
            shift_preference: fa.shift_preference,
            languages: fa.languages || [],
            preferred_interview_slot: fa.preferred_interview_slot,
            consent_given: fa.consent_given,
            consent_text: fa.consent_text,
            submitted_at: fa.submitted_at,
          }
        : undefined,
    } as Application;
  });

  if (filters?.source) {
    apps = apps.filter((a) => a.candidate?.source?.toLowerCase() === filters.source?.toLowerCase());
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    apps = apps.filter(
      (a) =>
        a.candidate?.full_name.toLowerCase().includes(term) ||
        a.candidate?.phone.includes(term) ||
        a.candidate?.city?.toLowerCase().includes(term) ||
        a.job?.title.toLowerCase().includes(term)
    );
  }

  return apps;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const apps = await getCandidates();
  return apps.find((a) => a.id === id) || null;
}

export async function getApplicationByToken(token: string): Promise<Application | null> {
  const apps = await getCandidates();
  return apps.find((a) => a.token === token) || null;
}

export async function saveImportedApplications(apps: Application[]): Promise<void> {
  const supabase = getClient();
  const now = new Date().toISOString();

  for (const app of apps) {
    if (app.candidate) {
      await supabase.from('candidates').upsert(
        {
          id: app.candidate.id,
          full_name: app.candidate.full_name,
          phone: app.candidate.phone,
          email: app.candidate.email || null,
          city: app.candidate.city || null,
          total_experience_months: app.candidate.total_experience_months || 0,
          current_salary: app.candidate.current_salary || null,
          source: app.candidate.source || 'csv_import',
          batch_id: app.candidate.batch_id || app.batch_id || null,
          created_at: app.candidate.created_at || now,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
    }

    await supabase.from('applications').upsert(
      {
        id: app.id,
        candidate_id: app.candidate_id,
        job_id: app.job_id,
        status: app.status || 'new',
        score: app.score || 0,
        score_breakdown: app.score_breakdown || {},
        token: app.token,
        token_expires_at: app.token_expires_at,
        form_sent_at: app.form_sent_at || null,
        replied_at: app.replied_at || null,
        interview_scheduled_at: app.interview_scheduled_at || null,
        assigned_to: app.assigned_to || null,
        assigned_to_name: app.assigned_to_name || null,
        call_outcome: app.call_outcome || null,
        call_back_at: app.call_back_at || null,
        rejection_reason: app.rejection_reason || null,
        batch_id: app.batch_id || null,
        created_at: app.created_at || now,
        updated_at: now,
      },
      { onConflict: 'id' }
    );
  }
}

export async function updateApplicationStatus(
  appId: string,
  newStatus: any,
  changedBy: string = 'System',
  reason?: string
): Promise<Application | null> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from('applications')
    .select('status, form_sent_at, interview_scheduled_at')
    .eq('id', appId)
    .single();

  const oldStatus = current?.status;

  const updateFields: any = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === 'form_sent' && !current?.form_sent_at) {
    updateFields.form_sent_at = now;
  }
  if (newStatus === 'interview' && !current?.interview_scheduled_at) {
    updateFields.interview_scheduled_at = now;
  }

  const { error } = await supabase
    .from('applications')
    .update(updateFields)
    .eq('id', appId);

  if (error) {
    console.error('Supabase updateApplicationStatus error:', error);
    return null;
  }

  // Record history
  await supabase.from('status_history').insert({
    id: generateUUID(),
    application_id: appId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason: reason || null,
    created_at: now,
  });

  return getApplicationById(appId);
}

export async function submitCandidateForm(
  token: string,
  formData: any
): Promise<{ success: boolean; score: number; error?: string; application?: Application }> {
  const supabase = getClient();
  const app = await getApplicationByToken(token);
  if (!app) {
    return { success: false, score: 0, error: 'Invalid or expired screening form link' };
  }

  const now = new Date();
  if (new Date(app.token_expires_at) < now) {
    return { success: false, score: 0, error: 'This screening form link has expired' };
  }

  const job = await getJobById(app.job_id);
  if (!job) {
    return { success: false, score: 0, error: 'Associated job opening is no longer available' };
  }

  const formId = generateUUID();
  const submittedAt = now.toISOString();

  const completeAnswers: FormAnswers = {
    id: formId,
    application_id: app.id,
    current_city: formData.current_city || formData.currentCity || '',
    experience_years: Number(formData.experience_years ?? formData.experienceYears) || 0,
    matched_skills: formData.matched_skills || formData.matchedSkills || [],
    expected_salary: Number(formData.expected_salary ?? formData.expectedSalary) || 0,
    notice_period_days: Number(formData.notice_period_days ?? formData.noticePeriodDays) || 0,
    shift_preference: formData.shift_preference || formData.shiftPreference || 'any',
    languages: formData.languages || ['Hindi', 'English'],
    preferred_interview_slot: formData.preferred_interview_slot || formData.preferredInterviewSlot || null,
    consent_given: formData.consent_given ?? formData.consentGiven ?? true,
    consent_text: formData.consent_text || formData.consentText || 'DPDP Act 2023 consent',
    submitted_at: submittedAt,
  };

  const { error: formErr } = await supabase.from('form_answers').insert({
    id: completeAnswers.id,
    application_id: completeAnswers.application_id,
    current_city: completeAnswers.current_city,
    experience_years: completeAnswers.experience_years,
    matched_skills: completeAnswers.matched_skills,
    expected_salary: completeAnswers.expected_salary,
    notice_period_days: completeAnswers.notice_period_days,
    shift_preference: completeAnswers.shift_preference,
    languages: completeAnswers.languages,
    preferred_interview_slot: completeAnswers.preferred_interview_slot,
    consent_given: completeAnswers.consent_given,
    consent_text: completeAnswers.consent_text,
    submitted_at: completeAnswers.submitted_at,
  });

  if (formErr) {
    return { success: false, score: 0, error: formErr.message };
  }

  // Calculate score using standard fair-hiring logic
  const scoring = calculateCandidateScore(job, job.scoring_rules, completeAnswers);
  const nextStatus = scoring.totalScore >= 50 ? 'shortlisted' : 'replied';

  await supabase
    .from('applications')
    .update({
      status: nextStatus,
      score: scoring.totalScore,
      score_breakdown: scoring.breakdown,
      replied_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq('id', app.id);

  // Status history
  await supabase.from('status_history').insert({
    id: generateUUID(),
    application_id: app.id,
    old_status: app.status,
    new_status: nextStatus,
    changed_by: 'Candidate (Self-Screening)',
    reason: `Automated scoring completed with transparent score ${scoring.totalScore}/100`,
    created_at: submittedAt,
  });

  const updatedApp = await getApplicationById(app.id);
  return { success: true, score: scoring.totalScore, application: updatedApp || undefined };
}

// -------------------------------------------------------------
// NOTES, MESSAGES, HISTORY & CALL OUTCOMES
// -------------------------------------------------------------

export async function addCandidateNote(
  applicationId: string,
  candidateId: string,
  noteText: string,
  authorName: string = 'HR Executive'
): Promise<CandidateNote> {
  const supabase = getClient();
  const id = generateUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from('candidate_notes').insert({
    id,
    application_id: applicationId,
    candidate_id: candidateId,
    author_name: authorName,
    note_text: noteText,
    created_at: now,
  });

  if (error) {
    console.error('Supabase addCandidateNote error:', error);
  }

  return {
    id,
    application_id: applicationId,
    candidate_id: candidateId,
    author_name: authorName,
    note_text: noteText,
    created_at: now,
  };
}

export async function getCandidateNotes(applicationId: string): Promise<CandidateNote[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('candidate_notes')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function deleteNote(noteId: string, userEmail: string): Promise<boolean> {
  const supabase = getClient();
  const { error } = await supabase.from('candidate_notes').delete().eq('id', noteId);
  if (!error) {
    await logAuditEvent(userEmail, 'NOTE_DELETED', 'candidate_note', noteId);
    return true;
  }
  return false;
}

export async function logWhatsAppOrSmsMessage(logItem: Omit<MessageLogItem, 'id' | 'sent_at'>): Promise<MessageLogItem> {
  const supabase = getClient();
  const id = generateUUID();
  const sent_at = new Date().toISOString();

  await supabase.from('messages_log').insert({
    id,
    application_id: logItem.application_id,
    recipient_phone: logItem.recipient_phone,
    template_type: logItem.template_type,
    language: logItem.language,
    channel: logItem.channel,
    message_body: logItem.message_body,
    sent_at,
  });

  return {
    id,
    ...logItem,
    sent_at,
  };
}

export async function getStatusHistory(applicationId: string): Promise<StatusHistoryItem[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('status_history')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function assignApplications(
  applicationIds: string[],
  userId: string,
  userName: string,
  adminEmail: string
): Promise<{ success: boolean; count: number }> {
  const supabase = getClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('applications')
    .update({
      assigned_to: userId,
      assigned_to_name: userName,
      updated_at: now,
    })
    .in('id', applicationIds);

  if (!error) {
    await logAuditEvent(adminEmail, 'APPLICATIONS_ASSIGNED', 'application', undefined, {
      count: applicationIds.length,
      assignedTo: userName,
      assignedUserId: userId,
      applicationIds,
    });
    return { success: true, count: applicationIds.length };
  }
  return { success: false, count: 0 };
}

export async function autoSplitApplications(
  applicationIds: string[],
  adminEmail: string,
  targetUserIds?: { id: string; name: string }[]
): Promise<{ success: boolean; assignments: Record<string, number> }> {
  const users = await getUsers();
  const execs = targetUserIds && targetUserIds.length > 0
    ? targetUserIds
    : users
        .filter((u) => u.role === 'hr_executive' && u.is_active)
        .map((u) => ({ id: u.id, name: u.full_name }));

  if (execs.length === 0) {
    throw new Error('No active HR Executives found to assign candidates to.');
  }

  const counts: Record<string, number> = {};
  execs.forEach((e) => (counts[e.name] = 0));

  for (let i = 0; i < applicationIds.length; i++) {
    const assignee = execs[i % execs.length];
    await assignApplications([applicationIds[i]], assignee.id, assignee.name, adminEmail);
    counts[assignee.name] = (counts[assignee.name] || 0) + 1;
  }

  return { success: true, assignments: counts };
}

export async function recordCallOutcome(data: {
  applicationId: string;
  outcome: any;
  notes?: string;
  callBackAt?: string;
  rejectionReason?: any;
  authorName: string;
  authorEmail: string;
}): Promise<Application> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const app = await getApplicationById(data.applicationId);
  if (!app) throw new Error('Application not found');

  const oldStatus = app.status;
  let newStatus: any = app.status;

  if (data.outcome === 'selected_for_interview') {
    newStatus = 'interview';
  } else if (data.outcome === 'interested') {
    if (app.status === 'new' || app.status === 'form_sent' || app.status === 'replied') {
      newStatus = 'shortlisted';
    }
  } else if (data.outcome === 'not_interested' || data.outcome === 'wrong_number' || data.outcome === 'already_working') {
    newStatus = 'rejected';
  }

  const updates: any = {
    call_outcome: data.outcome,
    call_back_at: data.callBackAt || null,
    rejection_reason: data.rejectionReason || null,
    status: newStatus,
    updated_at: now,
  };

  await supabase.from('applications').update(updates).eq('id', data.applicationId);

  const outcomeLabels: Record<string, string> = {
    interested: 'Interested in Job',
    not_interested: 'Not Interested',
    not_reachable: 'Not Reachable / No Answer',
    call_back_later: `Call Back Later (${data.callBackAt ? new Date(data.callBackAt).toLocaleString('en-IN') : 'Scheduled'})`,
    wrong_number: 'Wrong / Invalid Number',
    already_working: 'Already Employed / Working Elsewhere',
    selected_for_interview: 'Selected for Direct Interview',
  };

  const label = outcomeLabels[data.outcome] || data.outcome;
  const noteText = `[Call Outcome: ${label}]${
    data.rejectionReason ? ` Rejection Reason: ${String(data.rejectionReason).replace(/_/g, ' ')}.` : ''
  }${data.notes ? ` Notes: ${data.notes}` : ''}`;

  await addCandidateNote(app.id, app.candidate_id, noteText, data.authorName);

  if (newStatus !== oldStatus) {
    await supabase.from('status_history').insert({
      id: generateUUID(),
      application_id: data.applicationId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: data.authorName,
      reason: `Call outcome: ${label}${data.rejectionReason ? ` (${data.rejectionReason})` : ''}`,
      created_at: now,
    });
  }

  const updatedApp = await getApplicationById(data.applicationId);
  return updatedApp!;
}

export async function getDailyProgress(dateStr?: string): Promise<{
  teamTarget: number;
  userStats: DailyProgress[];
}> {
  const today = dateStr || new Date().toISOString().slice(0, 10);
  const users = await getUsers();
  const settings = await getCompanySettings();
  const dailyTarget = settings.daily_target || 25;

  const userProgressList: DailyProgress[] = users.map((u) => ({
    user_id: u.id,
    user_name: u.full_name,
    date: today,
    messages_sent: 0,
    forms_received: 0,
    calls_made: 0,
    interviews_booked: 0,
    selected: 0,
    target: dailyTarget,
  }));

  return {
    teamTarget: dailyTarget * users.length,
    userStats: userProgressList,
  };
}

// -------------------------------------------------------------
// DELETION & RESTORATION
// -------------------------------------------------------------

export async function deleteCandidates(
  candidateIds: string[],
  adminEmail: string
): Promise<{ success: boolean; count: number; deleted?: { candidates: Candidate[]; applications: Application[] } }> {
  const supabase = getClient();
  const allApps = await getCandidates();
  const toDeleteApps = allApps.filter((a) => candidateIds.includes(a.candidate_id));
  const toDeleteCandidates = toDeleteApps
    .map((a) => a.candidate)
    .filter((c): c is Candidate => Boolean(c));

  if (toDeleteCandidates.length === 0) {
    return { success: false, count: 0 };
  }

  await supabase.from('candidates').delete().in('id', candidateIds);

  await logAuditEvent(adminEmail, 'CANDIDATES_BULK_DELETED', 'candidate', undefined, {
    count: candidateIds.length,
  });

  return {
    success: true,
    count: toDeleteCandidates.length,
    deleted: {
      candidates: toDeleteCandidates,
      applications: toDeleteApps,
    },
  };
}

export async function deleteCandidateData(candidateId: string, adminEmail: string): Promise<boolean> {
  const res = await deleteCandidates([candidateId], adminEmail);
  return res.count > 0;
}

export async function restoreCandidates(
  backup: { candidates: Candidate[]; applications: Application[] },
  adminEmail: string
): Promise<boolean> {
  const supabase = getClient();
  for (const c of backup.candidates) {
    await supabase.from('candidates').upsert({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email || null,
      city: c.city || null,
      total_experience_months: c.total_experience_months || 0,
      current_salary: c.current_salary || null,
      source: c.source,
      batch_id: c.batch_id || null,
      created_at: c.created_at,
    });
  }

  await saveImportedApplications(backup.applications);

  await logAuditEvent(adminEmail, 'CANDIDATES_RESTORED', 'candidate', undefined, {
    candidateCount: backup.candidates.length,
    applicationCount: backup.applications.length,
  });

  return true;
}

// -------------------------------------------------------------
// IMPORT BATCHES
// -------------------------------------------------------------

export async function getImportBatches(): Promise<ImportBatch[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('imported_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function recordImportBatch(batch: ImportBatch): Promise<void> {
  const supabase = getClient();
  await supabase.from('import_batches').insert({
    id: batch.id,
    filename: batch.filename,
    job_id: batch.job_id,
    job_title: batch.job_title,
    candidate_count: batch.candidate_count,
    imported_by: batch.imported_by,
    imported_at: batch.imported_at,
  });
}

export async function deleteImportBatch(
  batchId: string,
  adminEmail: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const supabase = getClient();
  const { data: apps } = await supabase
    .from('applications')
    .select('id, candidate_id')
    .eq('batch_id', batchId);

  const deletedCount = (apps || []).length;
  if (deletedCount > 0) {
    const candidateIds = Array.from(new Set(apps!.map((a) => a.candidate_id)));
    await supabase.from('candidates').delete().in('id', candidateIds);
  }

  await supabase.from('import_batches').delete().eq('id', batchId);

  await logAuditEvent(adminEmail, 'IMPORT_BATCH_UNDONE', 'import_batch', batchId, {
    deletedApplicationsCount: deletedCount,
  });

  return { success: true, deletedCount };
}

// -------------------------------------------------------------
// USERS & AUTH
// -------------------------------------------------------------

export async function getUsers(): Promise<Omit<User, 'password_hash'>[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, role, is_active, must_change_password, last_login_at, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) return [];
  return data || [];
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = getClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function createUser(
  userData: {
    email: string;
    fullName: string;
    phone?: string;
    role: 'admin' | 'hr_executive';
    temporaryPassword?: string;
  },
  adminEmail: string
): Promise<{ user: Omit<User, 'password_hash'>; temporaryPassword: string }> {
  const supabase = getClient();
  const bcrypt = await import('bcryptjs');
  const tempPass = userData.temporaryPassword || 'Welcome@123';
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(tempPass, salt);
  const id = generateUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .insert({
      id,
      email: userData.email.trim().toLowerCase(),
      full_name: userData.fullName.trim(),
      phone: userData.phone?.trim() || null,
      role: userData.role,
      password_hash,
      is_active: true,
      must_change_password: true,
      created_at: now,
      updated_at: now,
    })
    .select('id, email, full_name, phone, role, is_active, must_change_password, last_login_at, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(`Failed to create user in Supabase: ${error.message}`);
  }

  await logAuditEvent(adminEmail, 'USER_CREATED', 'user', id, {
    email: userData.email,
    role: userData.role,
  });

  return { user: data, temporaryPassword: tempPass };
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'full_name' | 'phone' | 'role' | 'is_active'>>,
  adminEmail: string
): Promise<Omit<User, 'password_hash'> | null> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const updatePayload: any = { updated_at: now };

  if (updates.full_name !== undefined) updatePayload.full_name = updates.full_name.trim();
  if (updates.phone !== undefined) updatePayload.phone = updates.phone ? updates.phone.trim() : null;
  if (updates.role !== undefined) updatePayload.role = updates.role;
  if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .select('id, email, full_name, phone, role, is_active, must_change_password, last_login_at, created_at, updated_at')
    .single();

  if (error || !data) return null;

  await logAuditEvent(adminEmail, 'USER_UPDATED', 'user', id, updates);
  return data;
}

export async function resetUserPassword(
  id: string,
  adminEmail: string
): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
  const supabase = getClient();
  const bcrypt = await import('bcryptjs');
  const tempPass = 'Reset@123';
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(tempPass, salt);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('users')
    .update({
      password_hash,
      must_change_password: true,
      updated_at: now,
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditEvent(adminEmail, 'USER_PASSWORD_RESET', 'user', id);
  return { success: true, temporaryPassword: tempPass };
}

export async function changeUserPassword(
  id: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getClient();
  const user = await getUserById(id);
  if (!user) return { success: false, error: 'User not found' };

  const bcrypt = await import('bcryptjs');
  const isValid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('users')
    .update({
      password_hash,
      must_change_password: false,
      updated_at: now,
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  await logAuditEvent(user.email, 'PASSWORD_CHANGED', 'user', id);
  return { success: true };
}

export async function updateLastLogin(userId: string): Promise<void> {
  const supabase = getClient();
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  const supabase = getClient();
  await supabase.from('login_attempts').insert({
    id: generateUUID(),
    email: email.trim().toLowerCase(),
    timestamp: Date.now(),
    success,
    created_at: new Date().toISOString(),
  });
}

export async function isLoginRateLimited(
  email: string
): Promise<{ isLimited: boolean; retryAfterMinutes?: number }> {
  const supabase = getClient();
  const normalizedEmail = email.trim().toLowerCase();
  const windowMs = 15 * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  const { data: attempts } = await supabase
    .from('login_attempts')
    .select('timestamp, success')
    .eq('email', normalizedEmail)
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: false });

  const failedAttempts = (attempts || []).filter((a) => !a.success);
  if (failedAttempts.length >= 5) {
    const oldestFailure = failedAttempts[failedAttempts.length - 1].timestamp;
    const retryAfter = Math.ceil((oldestFailure + windowMs - Date.now()) / (60 * 1000));
    return { isLimited: true, retryAfterMinutes: Math.max(1, retryAfter) };
  }

  return { isLimited: false };
}

export async function deleteUser(userId: string, adminEmail: string): Promise<boolean> {
  const supabase = getClient();
  const user = await getUserById(userId);
  if (!user) return false;

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (!error) {
    await logAuditEvent(adminEmail, 'USER_DELETED', 'user', userId, {
      email: user.email,
      fullName: user.full_name,
    });
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// COMPANY SETTINGS
// -------------------------------------------------------------

export async function getCompanySettings(): Promise<CompanySettings> {
  const supabase = getClient();
  const { data, error } = await supabase.from('company_settings').select('*').maybeSingle();

  if (error || !data) {
    return {
      company_name: COMPANY_NAME,
      tagline: COMPANY_TAGLINE,
      hr_name: 'Alex',
      hr_phone: '+919820098200',
      default_language: 'en',
      default_tone: 'friendly',
      inactivity_timeout_minutes: 30,
      daily_target: 50,
    };
  }

  return {
    company_name: data.company_name || COMPANY_NAME,
    tagline: data.tagline || COMPANY_TAGLINE,
    hr_name: data.hr_name,
    hr_phone: data.hr_phone,
    default_language: data.default_language,
    default_tone: data.default_tone,
    inactivity_timeout_minutes: data.inactivity_timeout_minutes || 30,
    logo_url: data.logo_url || null,
    accent_color: data.accent_color || null,
    daily_target: data.daily_target || 50,
    updated_at: data.updated_at,
  };
}

export async function updateCompanySettings(
  settings: Partial<CompanySettings>,
  userEmail: string
): Promise<CompanySettings> {
  const supabase = getClient();
  const existing = await getCompanySettings();
  const updated: CompanySettings = {
    ...existing,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  const { data: currentRecord } = await supabase.from('company_settings').select('id').maybeSingle();

  if (currentRecord) {
    await supabase.from('company_settings').update(updated).eq('id', currentRecord.id);
  } else {
    await supabase.from('company_settings').insert({
      id: generateUUID(),
      ...updated,
    });
  }

  await logAuditEvent(userEmail, 'COMPANY_SETTINGS_UPDATED', 'company_settings', undefined, settings);
  return updated;
}

// -------------------------------------------------------------
// TEMPLATES
// -------------------------------------------------------------

export async function getTemplates(): Promise<MessageTemplate[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function getActiveTemplate(
  templateType: any,
  lang: any,
  jobId?: string | null
): Promise<MessageTemplate> {
  const templates = await getTemplates();

  if (jobId) {
    const jobSpecific = templates.find(
      (t) => t.template_type === templateType && t.language === lang && t.job_id === jobId && t.is_active
    );
    if (jobSpecific) return jobSpecific;
  }

  const globalActive = templates.find(
    (t) => t.template_type === templateType && t.language === lang && (!t.job_id || t.job_id === null) && t.is_active
  );
  if (globalActive) return globalActive;

  const presetContent = (TONE_PRESETS as any)[templateType]?.[lang]?.['friendly'] || '';
  return {
    id: `tmpl_default_${templateType}_${lang}`,
    template_type: templateType,
    language: lang,
    tone: 'friendly',
    title: `${templateType} (${lang})`,
    content: presetContent,
    version_number: 1,
    is_active: true,
    created_by: 'System Fallback',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getTemplateHistory(
  templateType: any,
  lang: any,
  jobId?: string | null
): Promise<MessageTemplate[]> {
  const templates = await getTemplates();
  return templates
    .filter(
      (t) =>
        t.template_type === templateType &&
        t.language === lang &&
        ((jobId && t.job_id === jobId) || (!jobId && (!t.job_id || t.job_id === null)))
    )
    .sort((a, b) => b.version_number - a.version_number);
}

export async function saveTemplateVersion(
  data: {
    template_type: any;
    language: any;
    tone: any;
    title: string;
    content: string;
    job_id?: string | null;
    set_active?: boolean;
  },
  userEmail: string
): Promise<MessageTemplate> {
  const supabase = getClient();
  const existingVersions = await getTemplateHistory(data.template_type, data.language, data.job_id);
  const nextVersionNumber = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1;
  const setActive = data.set_active !== undefined ? data.set_active : true;

  if (setActive && existingVersions.length > 0) {
    const ids = existingVersions.map((t) => t.id);
    await supabase.from('message_templates').update({ is_active: false }).in('id', ids);
  }

  const id = generateUUID();
  const now = new Date().toISOString();

  const { data: newRow, error } = await supabase
    .from('message_templates')
    .insert({
      id,
      template_type: data.template_type,
      language: data.language,
      tone: data.tone,
      title: data.title,
      content: data.content,
      version_number: nextVersionNumber,
      is_active: setActive,
      job_id: data.job_id || null,
      created_by: userEmail,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !newRow) {
    throw new Error(`Failed to save template version: ${error?.message}`);
  }

  await logAuditEvent(userEmail, 'TEMPLATE_SAVED_VERSION', 'message_template', id, {
    template_type: data.template_type,
    language: data.language,
    tone: data.tone,
    version_number: nextVersionNumber,
    job_id: data.job_id || 'global',
  });

  return newRow;
}

export async function resetTemplateToDefault(
  templateType: any,
  lang: any,
  userEmail: string,
  tone: any = 'friendly'
): Promise<MessageTemplate> {
  const preset = (TONE_PRESETS as any)[templateType]?.[lang]?.[tone] || '';
  return saveTemplateVersion(
    {
      template_type: templateType,
      language: lang,
      tone,
      title: `Default ${templateType} (${lang} - ${tone})`,
      content: preset,
      job_id: null,
      set_active: true,
    },
    userEmail
  );
}

export async function setActiveTemplate(templateId: string, userEmail: string): Promise<MessageTemplate> {
  const supabase = getClient();
  const templates = await getTemplates();
  const target = templates.find((t) => t.id === templateId);
  if (!target) throw new Error('Template not found');

  const matching = templates.filter(
    (t) =>
      t.template_type === target.template_type &&
      t.language === target.language &&
      t.tone === target.tone &&
      (target.job_id ? t.job_id === target.job_id : !t.job_id)
  );

  await supabase
    .from('message_templates')
    .update({ is_active: false })
    .in(
      'id',
      matching.map((t) => t.id)
    );

  const { data: updated } = await supabase
    .from('message_templates')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();

  await logAuditEvent(userEmail, 'TEMPLATE_ACTIVATED', 'template', templateId);
  return updated!;
}

export async function deleteTemplateVersion(templateId: string, adminEmail: string): Promise<boolean> {
  const supabase = getClient();
  const { error } = await supabase.from('message_templates').delete().eq('id', templateId);
  if (!error) {
    await logAuditEvent(adminEmail, 'TEMPLATE_DELETED', 'template', templateId);
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// AUDIT LOG
// -------------------------------------------------------------

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    user_email: r.user_email,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id || undefined,
    details: r.details || {},
    created_at: r.created_at,
  }));
}

export async function logAuditEvent(
  userEmail: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any>
): Promise<AuditLogItem> {
  const supabase = getClient();
  const id = generateUUID();
  const created_at = new Date().toISOString();

  await supabase.from('audit_log').insert({
    id,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    details: details || {},
    created_at,
  });

  return {
    id,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    created_at,
  };
}
