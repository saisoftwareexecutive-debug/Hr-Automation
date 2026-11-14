import { describe, it, expect } from 'vitest';
import { calculateCandidateScore, DEFAULT_SCORING_WEIGHTS } from '../scoring';
import { FormAnswers, Job, ScoringRules } from '@/types';

describe('Fair-Hiring Scoring Engine', () => {
  const sampleJob: Job = {
    id: 'job-1',
    title: 'Customer Support Executive',
    department: 'Customer Ops',
    city: 'Bengaluru',
    openings: 5,
    min_exp_years: 1,
    max_exp_years: 3,
    min_salary: 20000,
    max_salary: 30000,
    shift_type: 'rotational',
    required_skills: ['Customer Support', 'Chat Support', 'CRM', 'Problem Solving'],
    required_languages: ['Hindi', 'English'],
    status: 'active',
    created_by: 'Admin',
    created_at: new Date().toISOString(),
  };

  const sampleRules: ScoringRules = {
    id: 'rule-1',
    job_id: 'job-1',
    weights: DEFAULT_SCORING_WEIGHTS,
    criteria: {
      preferred_cities: ['Bengaluru', 'Bangalore'],
      max_acceptable_salary: 32000,
      max_notice_days: 15,
    },
  };

  it('awards full score (100) to an ideal candidate', () => {
    const idealAnswers: FormAnswers = {
      id: 'ans-1',
      application_id: 'app-1',
      current_city: 'Bengaluru',
      experience_years: 2,
      matched_skills: ['Customer Support', 'Chat Support', 'CRM', 'Problem Solving'],
      expected_salary: 25000,
      notice_period_days: 0, // Immediate
      shift_preference: 'rotational',
      languages: ['Hindi', 'English'],
      consent_given: true,
      consent_text: 'DPDP consent',
      submitted_at: new Date().toISOString(),
    };

    const result = calculateCandidateScore(sampleJob, sampleRules, idealAnswers);
    expect(result.totalScore).toBe(100);
    expect(result.breakdown.city_score).toBe(20);
    expect(result.breakdown.exp_score).toBe(25);
    expect(result.breakdown.skills_score).toBe(25);
    expect(result.breakdown.salary_score).toBe(15);
    expect(result.breakdown.notice_score).toBe(10);
    expect(result.breakdown.shift_score).toBe(5);
  });

  it('deducts points proportionately for partial skills and long notice periods', () => {
    const partialAnswers: FormAnswers = {
      id: 'ans-2',
      application_id: 'app-2',
      current_city: 'Bengaluru',
      experience_years: 2,
      matched_skills: ['Customer Support', 'Chat Support'], // 2 out of 4 skills = 50%
      expected_salary: 28000,
      notice_period_days: 30, // 30 days notice
      shift_preference: 'rotational',
      languages: ['Hindi'],
      consent_given: true,
      consent_text: 'DPDP consent',
      submitted_at: new Date().toISOString(),
    };

    const result = calculateCandidateScore(sampleJob, sampleRules, partialAnswers);
    expect(result.breakdown.skills_score).toBe(12.5); // 50% of 25
    expect(result.breakdown.notice_score).toBe(5); // 50% of 10
    expect(result.totalScore).toBeLessThan(100);
    expect(result.totalScore).toBeGreaterThan(60);
  });

  it('penalizes when expected salary significantly exceeds maximum budget', () => {
    const highSalaryAnswers: FormAnswers = {
      id: 'ans-3',
      application_id: 'app-3',
      current_city: 'Bengaluru',
      experience_years: 2,
      matched_skills: ['Customer Support', 'Chat Support', 'CRM', 'Problem Solving'],
      expected_salary: 55000, // Max budget is 30,000
      notice_period_days: 0,
      shift_preference: 'rotational',
      languages: ['Hindi', 'English'],
      consent_given: true,
      consent_text: 'DPDP consent',
      submitted_at: new Date().toISOString(),
    };

    const result = calculateCandidateScore(sampleJob, sampleRules, highSalaryAnswers);
    expect(result.breakdown.salary_score).toBeLessThanOrEqual(3);
    expect(result.totalScore).toBeLessThan(90);
  });

  it('respects custom scoring weights defined by Admin', () => {
    const customRules: ScoringRules = {
      id: 'rule-custom',
      job_id: 'job-1',
      weights: {
        city_weight: 40,
        exp_weight: 10,
        skills_weight: 30,
        salary_weight: 10,
        notice_weight: 5,
        shift_weight: 5,
      },
      criteria: {},
    };

    const answers: FormAnswers = {
      id: 'ans-4',
      application_id: 'app-4',
      current_city: 'Bengaluru',
      experience_years: 1.5,
      matched_skills: ['Customer Support', 'Chat Support', 'CRM', 'Problem Solving'],
      expected_salary: 22000,
      notice_period_days: 0,
      shift_preference: 'rotational',
      languages: ['English'],
      consent_given: true,
      consent_text: 'DPDP',
      submitted_at: new Date().toISOString(),
    };

    const result = calculateCandidateScore(sampleJob, customRules, answers);
    expect(result.breakdown.city_score).toBe(40);
    expect(result.breakdown.exp_score).toBe(10);
    expect(result.breakdown.skills_score).toBe(30);
  });
});

