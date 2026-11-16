import { FormAnswers, Job, ScoreBreakdown, ScoringRules, ScoringWeights } from '@/types';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  city_weight: 20,
  exp_weight: 25,
  skills_weight: 25,
  salary_weight: 15,
  notice_weight: 10,
  shift_weight: 5,
};

export interface ScoreCalculationResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
}

/**
 * FAIR-HIRING SCORING ENGINE
 * 
 * Strict compliance rule:
 * Scores candidates ONLY on objective, job-related criteria:
 * 1. City / Location match
 * 2. Relevant experience
 * 3. Required skills match
 * 4. Expected salary vs budget
 * 5. Notice period (joining time)
 * 6. Shift availability
 * 
 * Absolutely NEVER scores or ranks by:
 * religion, caste, gender, age, marital status, disability, or name-inferred characteristics.
 */
export function calculateCandidateScore(
  job: Job,
  rules: ScoringRules | undefined,
  answers: FormAnswers
): ScoreCalculationResult {
  const weights: ScoringWeights = rules?.weights || DEFAULT_SCORING_WEIGHTS;
  const criteria = rules?.criteria || {};
  const notes: string[] = [];

  // 1. City / Location Score (Max: weights.city_weight)
  let cityScore = 0;
  const jobCityClean = (job.city || '').trim().toLowerCase();
  const candCityClean = (answers.current_city || '').trim().toLowerCase();
  const preferredCities = (criteria.preferred_cities || []).map((c: string) => c.trim().toLowerCase());
  const isAnyCityJob =
    jobCityClean === 'pan india' ||
    jobCityClean === 'any' ||
    jobCityClean === '*' ||
    preferredCities.includes('any') ||
    preferredCities.includes('*') ||
    preferredCities.includes('pan india');

  if (isAnyCityJob) {
    cityScore = weights.city_weight;
    notes.push(`Pan-India/Flexible posting: any candidate location matches (+${cityScore.toFixed(1)} pts)`);
  } else if (candCityClean === jobCityClean || preferredCities.includes(candCityClean)) {
    cityScore = weights.city_weight;
    notes.push(`City match: "${answers.current_city}" matches job location (+${cityScore.toFixed(1)} pts)`);
  } else if (candCityClean.length > 0) {
    // Partial score if nearby / willing to relocate
    cityScore = Math.round(weights.city_weight * 0.35 * 10) / 10;
    notes.push(`Different city: "${answers.current_city}" vs job "${job.city}" (+${cityScore.toFixed(1)} pts)`);
  } else {
    cityScore = 0;
    notes.push(`City not specified (0 pts)`);
  }

  // 2. Experience Score (Max: weights.exp_weight)
  let expScore = 0;
  const expYears = Number(answers.experience_years) || 0;
  const minExp = Number(job.min_exp_years) || 0;
  const maxExp = Number(job.max_exp_years) || 10;

  if (expYears >= minExp && expYears <= maxExp + 1) {
    expScore = weights.exp_weight;
    notes.push(`Experience fit: ${expYears} yrs meets required ${minExp}-${maxExp} yrs (+${expScore.toFixed(1)} pts)`);
  } else if (expYears < minExp) {
    const ratio = minExp > 0 ? Math.max(0, expYears / minExp) : 1;
    expScore = Math.round(weights.exp_weight * ratio * 0.7 * 10) / 10;
    notes.push(`Below min experience: ${expYears} yrs vs ${minExp} yrs required (+${expScore.toFixed(1)} pts)`);
  } else {
    // Over-experienced
    expScore = Math.round(weights.exp_weight * 0.75 * 10) / 10;
    notes.push(`Higher experience: ${expYears} yrs vs max ${maxExp} yrs (+${expScore.toFixed(1)} pts)`);
  }

  // 3. Skills Match Score (Max: weights.skills_weight)
  let skillsScore = 0;
  const reqSkills = job.required_skills || [];
  const candidateSkills = answers.matched_skills || [];

  if (reqSkills.length === 0) {
    skillsScore = weights.skills_weight;
    notes.push(`No specific skills required (+${skillsScore.toFixed(1)} pts)`);
  } else {
    const candSkillsLower = candidateSkills.map((s) => s.toLowerCase().trim());
    let matchedCount = 0;

    for (const req of reqSkills) {
      if (candSkillsLower.includes(req.toLowerCase().trim())) {
        matchedCount++;
      }
    }

    const matchRatio = matchedCount / reqSkills.length;
    skillsScore = Math.round(weights.skills_weight * matchRatio * 10) / 10;
    notes.push(`Skills match: ${matchedCount} of ${reqSkills.length} required skills matched (+${skillsScore.toFixed(1)} pts)`);
  }

  // 4. Expected Salary vs Budget (Max: weights.salary_weight)
  let salaryScore = 0;
  const expSalary = Number(answers.expected_salary) || 0;
  const hasJobBudget = job.max_salary !== undefined && job.max_salary !== null && Number(job.max_salary) > 0;
  const maxBudget = hasJobBudget ? Number(job.max_salary) : 50000;

  if (!hasJobBudget) {
    salaryScore = weights.salary_weight;
    notes.push(`Salary as per company standards: neutral score awarded (+${salaryScore.toFixed(1)} pts)`);
  } else if (expSalary <= 0) {
    salaryScore = Math.round(weights.salary_weight * 0.5 * 10) / 10;
    notes.push(`Salary expectation not provided (+${salaryScore.toFixed(1)} pts)`);
  } else if (expSalary <= maxBudget) {
    salaryScore = weights.salary_weight;
    notes.push(`Salary within budget: ₹${expSalary.toLocaleString('en-IN')} <= ₹${maxBudget.toLocaleString('en-IN')} (+${salaryScore.toFixed(1)} pts)`);
  } else if (expSalary <= maxBudget * 1.15) {
    // Within 15% negotiation buffer
    salaryScore = Math.round(weights.salary_weight * 0.55 * 10) / 10;
    notes.push(`Salary slightly above budget (+${salaryScore.toFixed(1)} pts)`);
  } else {
    salaryScore = Math.round(weights.salary_weight * 0.15 * 10) / 10;
    notes.push(`Salary significantly exceeds budget: ₹${expSalary.toLocaleString('en-IN')} (+${salaryScore.toFixed(1)} pts)`);
  }

  // 5. Notice Period / Joining Time (Max: weights.notice_weight)
  let noticeScore = 0;
  const noticeDays = Number(answers.notice_period_days);

  if (noticeDays === 0 || noticeDays <= 7) {
    noticeScore = weights.notice_weight;
    notes.push(`Immediate/Quick joiner: ${noticeDays} days notice (+${noticeScore.toFixed(1)} pts)`);
  } else if (noticeDays <= 15) {
    noticeScore = Math.round(weights.notice_weight * 0.75 * 10) / 10;
    notes.push(`15-day notice period (+${noticeScore.toFixed(1)} pts)`);
  } else if (noticeDays <= 30) {
    noticeScore = Math.round(weights.notice_weight * 0.5 * 10) / 10;
    notes.push(`30-day notice period (+${noticeScore.toFixed(1)} pts)`);
  } else {
    noticeScore = Math.round(weights.notice_weight * 0.2 * 10) / 10;
    notes.push(`Long notice period: ${noticeDays} days (+${noticeScore.toFixed(1)} pts)`);
  }

  // 6. Shift Availability (Max: weights.shift_weight)
  let shiftScore = 0;
  const jobShift = (job.shift_type || 'any').toLowerCase();
  const candShift = (answers.shift_preference || 'any').toLowerCase();

  if (jobShift === 'any' || candShift === 'any' || jobShift === candShift) {
    shiftScore = weights.shift_weight;
    notes.push(`Shift preference compatible: "${answers.shift_preference}" (+${shiftScore.toFixed(1)} pts)`);
  } else {
    shiftScore = 0;
    notes.push(`Shift mismatch: "${answers.shift_preference}" vs required "${job.shift_type}" (0 pts)`);
  }

  const rawTotal = cityScore + expScore + skillsScore + salaryScore + noticeScore + shiftScore;
  const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal * 10) / 10));

  return {
    totalScore,
    breakdown: {
      city_score: cityScore,
      exp_score: expScore,
      skills_score: skillsScore,
      salary_score: salaryScore,
      notice_score: noticeScore,
      shift_score: shiftScore,
      notes,
    },
  };
}

