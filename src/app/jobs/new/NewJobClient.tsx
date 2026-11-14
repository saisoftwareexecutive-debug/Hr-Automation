'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Plus, X, Sliders } from 'lucide-react';
import { hasExcessiveRepeatedChars } from '@/lib/validation';

export function NewJobClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Job Details
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Customer Operations');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [mapUrlError, setMapUrlError] = useState('');
  const [openings, setOpenings] = useState(5);
  const [minExp, setMinExp] = useState(0.5);
  const [maxExp, setMaxExp] = useState(3.0);
  const [minSalary, setMinSalary] = useState(18000);
  const [maxSalary, setMaxSalary] = useState(30000);
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'rotational' | 'any'>('rotational');
  const [skillInput, setSkillInput] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([
    'Customer Support',
    'Calling',
    'Problem Solving',
  ]);

  // Scoring Weights (sum = 100)
  const [weights, setWeights] = useState({
    city_weight: 20,
    exp_weight: 25,
    skills_weight: 25,
    salary_weight: 15,
    notice_weight: 10,
    shift_weight: 5,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalWeights !== 100) {
      alert(`Scoring weights must sum to exactly 100% (Current sum: ${totalWeights}%). Please adjust weights.`);
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
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
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
          required_skills: requiredSkills,
          required_languages: ['Hindi', 'English'],
          status: 'active',
          created_by: 'HR Admin',
          scoring_rules: {
            weights,
            criteria: {
              preferred_cities: [city],
              max_acceptable_salary: Number(maxSalary) * 1.15,
              max_notice_days: 30,
              mandatory_skills: requiredSkills.slice(0, 1),
            },
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        router.push('/jobs');
      } else {
        alert(data.error || 'Failed to create job.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating job opening.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary mb-2 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          Create New Job Opening
        </h1>
        <p className="text-sm text-secondary mt-1">
          Specify role requirements and assign custom weights to objective evaluation criteria.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Role Details Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand" /> Role & Location Details
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Job Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Inbound Telesales Executive / Delivery Ops Associate"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Target City *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Bengaluru, Delhi NCR, Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
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
                Number of Openings *
              </label>
              <input
                type="number"
                required
                min={1}
                value={openings}
                onChange={(e) => setOpenings(parseInt(e.target.value) || 1)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Work Shift Type
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
                className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand font-medium focus:outline-hidden"
              >
                <option value="day">Day Shift</option>
                <option value="night">Night Shift</option>
                <option value="rotational">Rotational Shift</option>
                <option value="any">Any / Flexible Shift</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Required Experience Range (Years)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={minExp}
                  onChange={(e) => setMinExp(parseFloat(e.target.value) || 0)}
                  placeholder="Min"
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">to</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={maxExp}
                  onChange={(e) => setMaxExp(parseFloat(e.target.value) || 0)}
                  placeholder="Max"
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Monthly Salary Budget Range (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={1000}
                  min={5000}
                  value={minSalary}
                  onChange={(e) => setMinSalary(parseInt(e.target.value) || 0)}
                  placeholder="Min ₹"
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <span className="text-muted">to</span>
                <input
                  type="number"
                  step={1000}
                  min={5000}
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(parseInt(e.target.value) || 0)}
                  placeholder="Max ₹"
                  className="w-full text-sm rounded-xl border border-border p-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
              </div>
            </div>

            {/* Skills tag input */}
            <div className="sm:col-span-2 pt-2">
              <label className="block font-bold uppercase text-secondary tracking-wider mb-1.5">
                Required Candidate Skills (Will appear as checkboxes on candidate form)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Chat Support, Field Sales, Negotiation..."
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

        {/* Customizable Scoring Weights Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand" /> Fair-Hiring Scoring Weights
              </h2>
              <p className="text-xs text-muted">
                Adjust points awarded to each criteria. Must total exactly 100%.
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
              <label className="font-bold text-primary block mb-1">Required Skills Match</label>
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
              <label className="font-bold text-primary block mb-1">Salary within Range</label>
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
              <label className="font-bold text-primary block mb-1">Notice Period (Joining)</label>
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

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/jobs"
            className="px-5 py-2.5 rounded-xl border border-border text-xs font-semibold text-secondary hover:bg-surface-hover transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || totalWeights !== 100}
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-extrabold text-sm shadow-xs transition transform active:scale-95"
          >
            {submitting ? 'Creating Job...' : 'Publish Job & Activate Scoring'}
          </button>
        </div>
      </form>
    </div>
  );
}

