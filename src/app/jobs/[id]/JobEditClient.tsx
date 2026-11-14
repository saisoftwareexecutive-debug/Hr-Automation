'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Job, ScoringWeights } from '@/types';
import { ArrowLeft, Briefcase, Plus, X, Sliders, CheckCircle2, AlertCircle, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { hasExcessiveRepeatedChars } from '@/lib/validation';
import { useToast } from '@/components/ToastProvider';

interface JobEditClientProps {
  job: Job;
  candidateCount: number;
  userRole?: string;
}

export function JobEditClient({ job, candidateCount, userRole = 'hr_executive' }: JobEditClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = userRole === 'admin';
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Job Form State
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department);
  const [city, setCity] = useState(job.city);
  const [location, setLocation] = useState(job.location || '');
  const [mapUrl, setMapUrl] = useState(job.map_url || '');
  const [mapUrlError, setMapUrlError] = useState('');
  const [openings, setOpenings] = useState(job.openings);
  const [minExp, setMinExp] = useState(job.min_exp_years);
  const [maxExp, setMaxExp] = useState(job.max_exp_years);
  const [minSalary, setMinSalary] = useState(job.min_salary);
  const [maxSalary, setMaxSalary] = useState(job.max_salary);
  const [shiftType, setShiftType] = useState(job.shift_type);
  const [status, setStatus] = useState(job.status);

  // Skills
  const [skillInput, setSkillInput] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>(job.required_skills || []);

  // Scoring Weights
  const [weights, setWeights] = useState<ScoringWeights>(
    job.scoring_rules?.weights || {
      city_weight: 20,
      exp_weight: 25,
      skills_weight: 25,
      salary_weight: 15,
      notice_weight: 10,
      shift_weight: 5,
    }
  );

  const totalWeights = Object.values(weights).reduce((a, b) => a + Number(b), 0);

  const handleAddSkill = () => {
    if (skillInput.trim() && !requiredSkills.includes(skillInput.trim())) {
      setRequiredSkills([...requiredSkills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setRequiredSkills(requiredSkills.filter((s) => s !== skill));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalWeights !== 100) {
      alert(`Scoring weights must total 100%. Current total: ${totalWeights}%.`);
      return;
    }

    if (hasExcessiveRepeatedChars(title, 30)) {
      alert('Please enter a valid job title (avoid excessive repeated characters).');
      return;
    }
    if (hasExcessiveRepeatedChars(city, 30)) {
      alert('Please enter a valid target city (avoid excessive repeated characters).');
      return;
    }
    if (location && hasExcessiveRepeatedChars(location, 30)) {
      alert('Please enter a valid work location (avoid excessive repeated characters).');
      return;
    }

    if (mapUrl && !mapUrl.trim().startsWith('https://')) {
      alert('Google Maps link must be a valid https URL.');
      return;
    }

    setSubmitting(true);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          department,
          city,
          location: location.trim(),
          map_url: mapUrl.trim(),
          openings: Number(openings),
          min_exp_years: Number(minExp),
          max_exp_years: Number(maxExp),
          min_salary: Number(minSalary),
          max_salary: Number(maxSalary),
          shift_type: shiftType,
          status,
          required_skills: requiredSkills,
          scoring_rules: {
            weights,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to update job.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating job.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseJobInstead = async () => {
    setIsClosing(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to close job');
      }
      setStatus('closed');
      toast.success(`Job "${job.title}" has been closed. Candidate records preserved.`);
      setShowDeleteModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Error closing job');
    } finally {
      setIsClosing(false);
    }
  };

  const handleConfirmDelete = async () => {
    const hasApplicants = candidateCount > 0;
    if (hasApplicants && deleteConfirmationInput.trim() !== job.title.trim()) {
      toast.error('Job title does not match. Please type exact job title to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      const queryParam = hasApplicants ? '?forceWithCandidates=true' : '';
      const res = await fetch(`/api/jobs/${job.id}${queryParam}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete job');
      }

      toast.success(`Job "${job.title}" deleted.`);
      router.push('/jobs');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Jobs
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            Edit Job & Scoring Rules
          </h1>
          <p className="text-sm text-secondary mt-1">
            Modifying scoring rules automatically recalculates scores for all {candidateCount} candidates in this job.
          </p>
        </div>

        <Link
          href={`/pipeline?job=${job.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-brand bg-brand-subtle hover:bg-brand/20 rounded-xl border border-brand/30 transition"
        >
          View Pipeline Board
        </Link>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Job details and scoring weights updated successfully! Candidate scores recalculated.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Job Info */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand" /> Job Opening Details
            </h2>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-secondary">Status:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="text-xs rounded-lg border-border border py-1 px-2.5 bg-input-bg text-primary font-semibold focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="active">Active (Accepting)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand font-semibold focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Target City *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold uppercase text-secondary tracking-wider">
                  Work Location / Area
                </label>
                <span className="text-[11px] font-mono text-muted">
                  {location.length}/200
                </span>
              </div>
              <input
                type="text"
                maxLength={200}
                placeholder="e.g. Andheri East, near Marol Naka metro station"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
              <p className="text-[11px] text-muted mt-1">
                Area, address or landmark where the candidate will work (shown to candidates)
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Google Maps Link
              </label>
              <input
                type="url"
                placeholder="https://maps.google.com/?q=..."
                value={mapUrl}
                onChange={(e) => {
                  setMapUrl(e.target.value);
                  if (e.target.value && !e.target.value.startsWith('https://')) {
                    setMapUrlError('Must be a valid https URL');
                  } else {
                    setMapUrlError('');
                  }
                }}
                className={`w-full text-sm rounded-xl border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:outline-hidden ${
                  mapUrlError ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-brand'
                }`}
              />
              {mapUrlError ? (
                <p className="text-[11px] text-red-500 mt-1 font-semibold">{mapUrlError}</p>
              ) : (
                <p className="text-[11px] text-muted mt-1">
                  Optional Google Maps link. If left blank, a map search link will be automatically generated from Location + City.
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Openings
              </label>
              <input
                type="number"
                min={1}
                value={openings}
                onChange={(e) => setOpenings(parseInt(e.target.value) || 1)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Monthly Salary Range (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={1000}
                  value={minSalary}
                  onChange={(e) => setMinSalary(parseInt(e.target.value) || 0)}
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">to</span>
                <input
                  type="number"
                  step={1000}
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(parseInt(e.target.value) || 0)}
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Shift Type
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="day">Day Shift</option>
                <option value="night">Night Shift</option>
                <option value="rotational">Rotational Shift</option>
                <option value="any">Flexible / Any Shift</option>
              </select>
            </div>

            <div className="sm:col-span-2 pt-2">
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Required Skills
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add skill tag..."
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shrink-0 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {requiredSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-subtle text-brand rounded-lg text-xs font-semibold border border-brand/30"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s)}
                      className="text-brand hover:text-brand-hover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scoring Weights Editor */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand" /> Editable Scoring Weights (Admin)
              </h2>
              <p className="text-xs text-muted">
                Adjust the importance of each parameter. Candidate scores will recalculate instantly.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                totalWeights === 100
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              Total: {totalWeights} / 100%
            </span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">City / Location Match</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.city_weight}
                  onChange={(e) => setWeights({ ...weights, city_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">Experience Fit</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.exp_weight}
                  onChange={(e) => setWeights({ ...weights, exp_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">Skills Match</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.skills_weight}
                  onChange={(e) => setWeights({ ...weights, skills_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">Salary within Budget</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.salary_weight}
                  onChange={(e) => setWeights({ ...weights, salary_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">Notice Period</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.notice_weight}
                  onChange={(e) => setWeights({ ...weights, notice_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <label className="font-bold text-primary block mb-1">Shift Availability</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={weights.shift_weight}
                  onChange={(e) => setWeights({ ...weights, shift_weight: parseInt(e.target.value) || 0 })}
                  className="w-20 text-sm p-2 rounded-lg border border-border bg-input-bg text-primary font-mono font-bold text-center focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">% weight</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmationInput('');
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs transition"
            >
              <Trash2 className="w-4 h-4" /> Delete Job Opening
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="px-5 py-2.5 rounded-xl border border-border text-xs font-semibold text-secondary hover:bg-surface-hover transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || totalWeights !== 100}
              className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-extrabold text-sm shadow-xs transition transform active:scale-95 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              {submitting ? 'Recalculating & Saving...' : 'Save & Recalculate Candidate Scores'}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-3xl max-w-lg w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-primary">
                  {candidateCount === 0
                    ? 'Delete Job Opening'
                    : 'Delete Job with Applicants'}
                </h3>
                <p className="text-xs text-secondary mt-0.5 break-words">
                  Job: <strong className="text-primary">{job.title}</strong> ({job.city})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {candidateCount === 0 ? (
              <div className="text-xs text-secondary space-y-2">
                <p>
                  Are you sure you want to delete <strong>{job.title}</strong>? This job currently has 0 applicants.
                </p>
                <p className="text-muted text-[11px]">
                  You can restore deleted jobs within 10 seconds from the main Jobs page.
                </p>
              </div>
            ) : (
              <div className="text-xs text-secondary space-y-3">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                  <p className="font-bold">
                    This job has {candidateCount} applicant(s) attached!
                  </p>
                  <p className="text-[11px] mt-1 leading-relaxed">
                    <strong>Recommended:</strong> Close the job instead of deleting. Closing prevents new applications while fully preserving your existing candidate history and interview notes.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block font-bold text-primary">
                    To permanently delete this job AND all {candidateCount} candidates, type the job title below:
                  </label>
                  <div className="p-2 rounded-xl bg-surface-raised font-mono text-[11px] text-primary border border-border select-all">
                    {job.title}
                  </div>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="Type exact job title to confirm deletion"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input-bg text-primary text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting || isClosing}
                className="px-4 py-2 rounded-xl border border-border hover:bg-surface-hover text-xs font-semibold text-secondary transition"
              >
                Cancel
              </button>

              {candidateCount > 0 && (
                <button
                  type="button"
                  onClick={handleCloseJobInstead}
                  disabled={isDeleting || isClosing}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs"
                >
                  {isClosing ? 'Closing...' : 'Close Job Instead'}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  isClosing ||
                  (candidateCount > 0 &&
                    deleteConfirmationInput.trim() !== job.title.trim())
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
              >
                {isDeleting
                  ? 'Deleting...'
                  : candidateCount === 0
                  ? 'Delete Job'
                  : 'Delete Job & All Applicants'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

