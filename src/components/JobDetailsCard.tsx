'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Job } from '@/types';
import {
  ChevronDown,
  ChevronUp,
  Briefcase,
  MapPin,
  Clock,
  IndianRupee,
  Users,
  Award,
  ExternalLink,
  Phone,
  Layers,
} from 'lucide-react';

interface JobDetailsCardProps {
  job: Job;
  defaultExpanded?: boolean;
}

export function formatJobSalary(min?: number | null, max?: number | null): string {
  const hasMin = typeof min === 'number' && min > 0;
  const hasMax = typeof max === 'number' && max > 0;

  if (hasMin && hasMax) {
    return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')} per month`;
  }
  if (hasMin) {
    return `From ₹${min.toLocaleString('en-IN')} per month`;
  }
  if (hasMax) {
    return `Up to ₹${max.toLocaleString('en-IN')} per month`;
  }
  return 'As per experience and company standards';
}

export function JobDetailsCard({ job, defaultExpanded = false }: JobDetailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!job) return null;

  const salaryDisplay = formatJobSalary(job.min_salary, job.max_salary);
  const locationDisplay = [job.city, job.location].filter(Boolean).join(' • ');

  const expDisplay =
    job.min_exp_years === 0 && job.max_exp_years <= 1
      ? 'Freshers can apply (0 - 1 years)'
      : `${job.min_exp_years} - ${job.max_exp_years} years`;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-2xs overflow-hidden transition-all text-xs">
      {/* Header bar / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3.5 bg-surface-subtle hover:bg-surface-raised flex items-center justify-between text-left transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-primary truncate text-sm">{job.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand shrink-0">
                {job.department}
              </span>
            </div>
            <p className="text-[11px] text-secondary truncate mt-0.5">
              {locationDisplay} • {salaryDisplay}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[11px] font-bold text-muted hidden sm:inline">
            {isExpanded ? 'Hide details' : 'View full details'}
          </span>
          <div className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Collapsible Body */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-border bg-surface text-secondary animate-in fade-in">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand" /> Location
              </span>
              <p className="font-semibold text-primary">{locationDisplay || 'Not specified'}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Salary
              </span>
              <p className="font-semibold text-primary">{salaryDisplay}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Shift &amp; Hours
              </span>
              <p className="font-semibold text-primary capitalize">{job.shift_type || 'Rotational'} shift</p>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-subtle border border-border space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Experience
              </span>
              <p className="font-semibold text-primary">{expDisplay}</p>
            </div>
          </div>

          {/* Description / Requirements */}
          {job.description && (
            <div className="space-y-1.5 p-3 rounded-xl bg-surface-subtle border border-border">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Job Description &amp; Responsibilities
              </span>
              <p className="text-xs text-secondary whitespace-pre-line leading-relaxed">
                {job.description}
              </p>
            </div>
          )}

          {/* Skills Badges */}
          {job.required_skills && job.required_skills.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Required Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-border font-medium text-primary text-[11px]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer link to manage jobs */}
          <div className="flex items-center justify-between pt-2 border-t border-border text-[11px]">
            <span className="text-muted">
              {job.openings} opening{job.openings === 1 ? '' : 's'} available
            </span>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
            >
              Add or edit jobs <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
