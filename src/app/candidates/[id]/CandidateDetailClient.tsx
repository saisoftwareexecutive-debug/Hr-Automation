'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Application,
  ApplicationStatus,
  CandidateNote,
  CallOutcome,
  RejectionReason,
  StatusHistoryItem,
  UserRole,
} from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { getFormUrl } from '@/lib/templates';
import { useToast } from '@/components/ToastProvider';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  IndianRupee,
  ShieldCheck,
  MessageSquare,
  Trash2,
  Send,
  PlusCircle,
  History,
  FileCheck,
  ExternalLink,
  Copy,
  Check,
  Award,
  AlertTriangle,
  UserCheck,
  PhoneCall,
  X,
} from 'lucide-react';

interface CandidateDetailClientProps {
  initialApplication: Application;
  initialNotes: CandidateNote[];
  initialHistory: StatusHistoryItem[];
  users?: Array<{ id: string; email: string; full_name: string; role: UserRole }>;
  currentUser?: { userId: string; email: string; name: string; role: UserRole };
}

const REJECTION_REASONS: { id: RejectionReason; label: string }[] = [
  { id: 'experience_mismatch', label: 'Experience Criteria Not Met' },
  { id: 'location_mismatch', label: 'Candidate Location / Commute Issue' },
  { id: 'salary_mismatch', label: 'Expected Salary Above Budget' },
  { id: 'notice_period', label: 'Notice Period Too Long' },
  { id: 'shift_mismatch', label: 'Shift Preference Incompatible' },
  { id: 'skills_mismatch', label: 'Missing Mandatory Job Skills' },
  { id: 'not_interested', label: 'Candidate Not Interested' },
  { id: 'no_response', label: 'Candidate Did Not Respond / Unreachable' },
];

export function CandidateDetailClient({
  initialApplication,
  initialNotes,
  initialHistory,
  users = [],
  currentUser,
}: CandidateDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [application, setApplication] = useState<Application>(initialApplication);
  const [notes, setNotes] = useState<CandidateNote[]>(initialNotes);
  const [history, setHistory] = useState<StatusHistoryItem[]>(initialHistory);

  // Notes state
  const [newNote, setNewNote] = useState('');
  const [authorName, setAuthorName] = useState(currentUser?.name || 'HR Executive');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // WhatsApp modal state
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  // Token copy state
  const [tokenCopied, setTokenCopied] = useState(false);

  // DPDP Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Call outcome modal states
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome>('call_back_later');
  const [callBackTime, setCallBackTime] = useState('');
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>('experience_mismatch');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const candidate = application.candidate;
  const job = application.job;
  const answers = application.form_answers;
  const breakdown = application.score_breakdown;

  const publicFormUrl = getFormUrl(application.token);

  const handleCopyFormLink = async () => {
    try {
      await navigator.clipboard.writeText(publicFormUrl);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
      toast.success('Public form link copied to clipboard!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (newStatus: ApplicationStatus, reason?: string) => {
    try {
      const response = await fetch('/api/candidates/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          newStatus,
          reason: reason || `Updated to ${newStatus} from candidate detail page`,
          changedBy: currentUser?.name || authorName,
        }),
      });

      const data = await response.json();
      if (data.success && data.application) {
        setApplication((prev) => ({ ...prev, status: newStatus }));
        toast.success(`Candidate moved to ${newStatus.replace('_', ' ')}.`);
        if (data.historyItem) {
          setHistory([data.historyItem, ...history]);
        }
      }
    } catch (err) {
      console.error('Failed to change status:', err);
      toast.error('Failed to update stage.');
    }
  };

  const handleAssignChange = async (newUserId: string) => {
    try {
      const selectedUser = users.find((u) => u.id === newUserId);
      const res = await fetch('/api/candidates/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          applicationIds: [application.id],
          userId: newUserId || null,
          userName: selectedUser?.full_name || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApplication((prev) => ({
          ...prev,
          assigned_to: newUserId || null,
          assigned_to_name: selectedUser?.full_name || null,
        }));
        toast.success(
          selectedUser
            ? `Assigned to ${selectedUser.full_name}`
            : 'Candidate unassigned'
        );
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update assignment');
    }
  };

  const handleQuickCallOutcome = async (outcome: CallOutcome) => {
    if (outcome === 'call_back_later' || outcome === 'not_interested') {
      setSelectedOutcome(outcome);
      setOutcomeModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/candidates/call-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          callOutcome: outcome,
        }),
      });
      const data = await res.json();
      if (data.success && data.application) {
        setApplication((prev) => ({
          ...prev,
          call_outcome: outcome,
          status: data.application.status,
        }));
        toast.success(`Logged call outcome: ${outcome.replace(/_/g, ' ')}`);
      }
    } catch (err) {
      toast.error('Failed to record outcome');
    }
  };

  const handleSubmitOutcomeModal = async () => {
    setSubmittingOutcome(true);
    try {
      const res = await fetch('/api/candidates/call-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          callOutcome: selectedOutcome,
          callBackAt: selectedOutcome === 'call_back_later' ? callBackTime || null : null,
          rejectionReason: selectedOutcome === 'not_interested' ? rejectionReason : null,
          notes: outcomeNotes || null,
        }),
      });

      const data = await res.json();
      if (data.success && data.application) {
        setApplication((prev) => ({
          ...prev,
          call_outcome: selectedOutcome,
          status: data.application.status,
          call_back_at: selectedOutcome === 'call_back_later' ? callBackTime : prev.call_back_at,
          rejection_reason: selectedOutcome === 'not_interested' ? rejectionReason : prev.rejection_reason,
        }));
        setOutcomeModalOpen(false);
        setOutcomeNotes('');
        toast.success(`Recorded: ${selectedOutcome.replace(/_/g, ' ')}`);
      }
    } catch (err) {
      toast.error('Failed to record outcome');
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const response = await fetch('/api/candidates/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          candidateId: candidate?.id,
          noteText: newNote,
          authorName: currentUser?.name || authorName,
        }),
      });

      const data = await response.json();
      if (data.success && data.note) {
        setNotes([data.note, ...notes]);
        setNewNote('');
        toast.success('Internal note added.');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteCandidateDPDP = async () => {
    if (!candidate) return;
    setIsDeleting(true);

    try {
      const response = await fetch('/api/candidates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          adminEmail: currentUser?.email || 'admin@hireflow.internal',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Candidate personal data completely erased under DPDP Act 2023.');
        router.push('/candidates');
      } else {
        toast.error(data.error || 'Failed to delete candidate.');
      }
    } catch (err) {
      console.error('Delete error', err);
      toast.error('Delete request failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/api/candidates/note?noteId=${noteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete note');
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Note deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Error deleting note');
    }
  };

  // Accuracy flags
  const hasNoCity = !candidate?.city && !answers?.current_city;
  const hasZeroExp = candidate?.total_experience_months === 0 && (!answers?.experience_years || answers?.experience_years === 0);
  const hasHighCTC = (answers?.expected_salary || 0) > (job?.max_salary || 40000);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/candidates"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Candidate Directory
        </Link>
      </div>

      {/* Candidate Top Profile Header Card */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
              {candidate?.full_name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-primary">{candidate?.full_name || 'Candidate'}</h1>
                <ScoreBadge score={application.score} size="md" />
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-subtle text-brand border border-brand/20">
                  {String(application.status || 'new').replace(/_/g, ' ')}
                </span>
                {application.call_outcome && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    📞 {String(application.call_outcome).replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {/* Contact and Job metadata */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-secondary mt-2">
                <span className="flex items-center gap-1 font-mono text-primary font-semibold">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> {candidate?.phone}
                </span>
                {candidate?.email && (
                  <span className="flex items-center gap-1 text-muted">
                    <Mail className="w-3.5 h-3.5" /> {candidate.email}
                  </span>
                )}
                <span className="flex items-center gap-1 text-muted">
                  <MapPin className="w-3.5 h-3.5 text-muted" />{' '}
                  {answers?.current_city || candidate?.city || 'India'}
                </span>
                <span className="flex items-center gap-1 text-muted flex-wrap">
                  <Briefcase className="w-3.5 h-3.5 text-muted shrink-0" /> Applied for:{' '}
                  <span className="font-semibold text-primary break-words">{job?.title}</span>
                  {job?.city && (
                    <span className="text-secondary font-medium break-words">
                      ({job.city}{job.location ? ` · ${job.location}` : ''})
                    </span>
                  )}
                  {job?.map_url && (
                    <a
                      href={job.map_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline font-semibold ml-1 inline-flex items-center gap-0.5"
                    >
                      Maps ↗
                    </a>
                  )}
                </span>
              </div>

              {/* Accuracy Warning Badges */}
              {(hasNoCity || hasZeroExp || hasHighCTC) && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {hasNoCity && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" /> Missing City
                    </span>
                  )}
                  {hasZeroExp && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                      <Clock className="w-3 h-3" /> 0 Yrs Exp (Fresher)
                    </span>
                  )}
                  {hasHighCTC && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                      <IndianRupee className="w-3 h-3" /> High CTC (&gt;₹{(job?.max_salary || 40000).toLocaleString('en-IN')})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Assign HR Selector */}
            <div className="flex items-center gap-1.5 bg-surface-raised px-2.5 py-1.5 rounded-xl border border-border text-xs">
              <UserCheck className="w-3.5 h-3.5 text-brand" />
              <select
                value={application.assigned_to || ''}
                onChange={(e) => handleAssignChange(e.target.value)}
                className="bg-transparent font-semibold text-primary text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role === 'admin' ? 'Admin' : 'HR'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition transform active:scale-95"
            >
              <MessageSquare className="w-4 h-4" /> Open WhatsApp
            </button>

            <a
              href={`tel:${candidate?.phone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-secondary bg-surface-raised border border-border hover:bg-surface-hover rounded-xl transition shadow-2xs"
            >
              <Phone className="w-3.5 h-3.5 text-muted" /> Call Phone
            </a>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              title="DPDP Act: Right to Erasure"
              className="p-2 text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Call Outcome Logging Strip */}
        <div className="bg-surface-subtle p-4 rounded-2xl border border-border space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-brand" /> Log Quick Call Outcome:
            </span>
            <span className="text-muted font-normal text-[11px]">One-click updates stage &amp; daily metrics</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('interested')}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-2xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Interested
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('selected_for_interview')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-2xs flex items-center gap-1"
            >
              <Award className="w-3.5 h-3.5" /> Selected for Interview
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('call_back_later')}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold transition shadow-2xs flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" /> Call Back Later
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('not_reachable')}
              className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-border text-secondary border border-border font-semibold transition"
            >
              Not Reachable
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('already_working')}
              className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-border text-secondary border border-border font-semibold transition"
            >
              Already Working
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('wrong_number')}
              className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-border text-secondary border border-border font-semibold transition"
            >
              Wrong Number
            </button>
            <button
              type="button"
              onClick={() => handleQuickCallOutcome('not_interested')}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-semibold transition flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reject / Not Interested
            </button>
          </div>
        </div>

        {/* Pipeline Stage Transition Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-subtle p-4 rounded-2xl border border-border">
          <span className="font-bold text-primary uppercase tracking-wider">
            Quick Pipeline Transition:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'shortlisted', label: 'Shortlist', color: 'bg-purple-700 hover:bg-purple-800 text-white' },
              { id: 'interview', label: 'Invite Interview', color: 'bg-amber-700 hover:bg-amber-800 text-white' },
              { id: 'selected', label: 'Mark Selected / Hired', color: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
              { id: 'rejected', label: 'Reject', color: 'bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleStatusChange(btn.id as ApplicationStatus)}
                className={`px-3 py-1.5 rounded-lg font-bold transition shadow-2xs ${btn.color}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Score Breakdown & Form Answers) | Right Column (Notes & History) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Score Breakdown & Screening Answers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transparent Score Breakdown Card */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand" /> Objective Scoring Breakdown
                </h2>
                <p className="text-xs text-muted">
                  Calculated by transparent job rules. 100% compliant with Fair-Hiring standards.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-primary font-mono">
                  {application.score.toFixed(1)}
                </span>
                <span className="text-xs text-muted">/100 pts</span>
              </div>
            </div>

            {/* Progress Bars for each criterion */}
            <div className="space-y-3.5 text-xs">
              {/* City */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Location / City Match</span>
                  <span className="text-primary font-mono">
                    {breakdown?.city_score ?? 0} / {job?.scoring_rules?.weights.city_weight || 20} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.city_score ?? 0) / (job?.scoring_rules?.weights.city_weight || 20)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Experience */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Relevant Experience Fit</span>
                  <span className="text-primary font-mono">
                    {breakdown?.exp_score ?? 0} / {job?.scoring_rules?.weights.exp_weight || 25} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.exp_score ?? 0) / (job?.scoring_rules?.weights.exp_weight || 25)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Required Skills Alignment</span>
                  <span className="text-primary font-mono">
                    {breakdown?.skills_score ?? 0} / {job?.scoring_rules?.weights.skills_weight || 25} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.skills_score ?? 0) / (job?.scoring_rules?.weights.skills_weight || 25)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Salary */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Salary Budget Fit</span>
                  <span className="text-primary font-mono">
                    {breakdown?.salary_score ?? 0} / {job?.scoring_rules?.weights.salary_weight || 15} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.salary_score ?? 0) / (job?.scoring_rules?.weights.salary_weight || 15)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Notice Period */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Notice Period &amp; Joining Speed</span>
                  <span className="text-primary font-mono">
                    {breakdown?.notice_score ?? 0} / {job?.scoring_rules?.weights.notice_weight || 10} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.notice_score ?? 0) / (job?.scoring_rules?.weights.notice_weight || 10)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Shift */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-secondary">Shift Availability Fit</span>
                  <span className="text-primary font-mono">
                    {breakdown?.shift_score ?? 0} / {job?.scoring_rules?.weights.shift_weight || 5} pts
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        ((breakdown?.shift_score ?? 0) / (job?.scoring_rules?.weights.shift_weight || 5)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Audit Notes from engine */}
            {breakdown?.notes && breakdown.notes.length > 0 && (
              <div className="p-4 bg-surface-subtle rounded-2xl border border-border text-xs text-secondary space-y-1">
                <span className="font-bold text-primary block mb-1">Rule Engine Evaluation Notes:</span>
                <ul className="list-disc list-inside space-y-1">
                  {breakdown.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Candidate Form Answers Card */}
          <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand" /> Screening Form Answers
                </h2>
                <p className="text-xs text-muted">Directly submitted by the candidate on their mobile phone</p>
              </div>

              {answers ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Submitted {new Date(answers.submitted_at).toLocaleDateString('en-IN')}
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Form Pending
                </span>
              )}
            </div>

            {answers ? (
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Current City / Location</span>
                  <span className="font-bold text-primary text-sm">{answers.current_city}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Self-Reported Experience</span>
                  <span className="font-bold text-primary text-sm">{answers.experience_years} Years</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Expected Monthly Salary</span>
                  <span className="font-bold text-primary text-sm">
                    ₹{Number(answers.expected_salary).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Notice Period</span>
                  <span className="font-bold text-primary text-sm">
                    {answers.notice_period_days === 0 ? 'Immediate Joiner' : `${answers.notice_period_days} Days`}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Shift Availability</span>
                  <span className="font-bold text-primary text-sm capitalize">{answers.shift_preference}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1">Preferred Interview Slot</span>
                  <span className="font-bold text-primary text-sm">{answers.preferred_interview_slot || 'Flexible'}</span>
                </div>

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-surface-subtle border border-border">
                  <span className="text-muted block mb-1.5">Confirmed Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {answers.matched_skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-md bg-surface border border-border font-semibold text-primary"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>DPDP Act 2023 Explicit Consent Provided</span>
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                    {new Date(answers.submitted_at).toLocaleTimeString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-surface-subtle border border-dashed border-border text-center space-y-3">
                <p className="text-xs text-muted">
                  Candidate has not yet submitted their screening form.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyFormLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-secondary text-xs font-semibold hover:bg-surface-hover transition"
                  >
                    {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {tokenCopied ? 'Link Copied!' : 'Copy Form Link'}
                  </button>

                  <a
                    href={publicFormUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-subtle text-brand text-xs font-semibold hover:bg-brand/20 border border-brand/30 transition"
                  >
                    Open Form <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 span): HR Internal Notes & Status Timeline */}
        <div className="space-y-6">
          {/* Notes Card */}
          <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand" /> Internal HR Notes
            </h2>

            {/* Add note form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={3}
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add an interview observation, call notes, or salary details..."
                className="w-full text-xs rounded-xl border border-border p-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={isAddingNote}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {isAddingNote ? 'Saving note...' : 'Add Note'}
              </button>
            </form>

            {/* Notes List */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pt-2">
              {notes.map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-surface-subtle border border-border text-xs space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-muted">
                    <span className="font-bold text-primary">{n.author_name}</span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(n.created_at).toLocaleDateString('en-IN')}</span>
                      {(currentUser?.role === 'admin' ||
                        currentUser?.name === n.author_name ||
                        currentUser?.email === n.author_name ||
                        currentUser?.email === n.created_by) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 rounded-md text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-secondary leading-relaxed break-words">{n.note_text}</p>
                </div>
              ))}

              {notes.length === 0 && (
                <p className="text-xs text-muted text-center py-4">No internal notes added yet.</p>
              )}
            </div>
          </div>

          {/* Status History Timeline Card */}
          <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-brand" /> Status Audit Trail
            </h2>

            <div className="relative border-l border-border ml-2 space-y-4 py-2">
              {history.map((sh) => (
                <div key={sh.id} className="ml-4 text-xs space-y-0.5">
                  <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-brand ring-4 ring-surface" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
                      {sh.new_status}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(sh.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <p className="text-secondary text-[11px]">{sh.reason}</p>
                  <span className="text-[10px] text-muted block font-medium">By: {sh.changed_by}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        application={application}
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onMarkSent={async (appId) => {
          await handleStatusChange('form_sent', 'WhatsApp screening invite sent');
          setIsWhatsAppOpen(false);
        }}
      />

      {/* Call Outcome Modal (for Callback time or Rejection reason) */}
      {outcomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-black text-primary">
                {selectedOutcome === 'call_back_later' ? 'Schedule Call Back' : 'Log Rejection Reason'}
              </h3>
              <button
                type="button"
                onClick={() => setOutcomeModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-primary hover:bg-surface-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedOutcome === 'call_back_later' && (
              <div className="space-y-3 text-xs">
                <label className="block font-bold text-secondary uppercase tracking-wider">
                  Call Back Time / Date
                </label>
                <input
                  type="datetime-local"
                  value={callBackTime}
                  onChange={(e) => setCallBackTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-input-bg text-primary font-bold focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
                <p className="text-[11px] text-muted">
                  Candidate will appear in "Callbacks Scheduled" on your Queue for today.
                </p>
              </div>
            )}

            {selectedOutcome === 'not_interested' && (
              <div className="space-y-3 text-xs">
                <label className="block font-bold text-secondary uppercase tracking-wider">
                  Fair-Hiring Objective Rejection Reason
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value as RejectionReason)}
                  className="w-full p-2.5 rounded-xl border border-border bg-input-bg text-primary font-semibold focus:ring-2 focus:ring-brand focus:outline-hidden"
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted">
                  Only job-related, transparent criteria are allowed (no demographic or personal bias).
                </p>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-secondary uppercase tracking-wider">
                Call Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Candidate feedback or reason..."
                className="w-full p-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setOutcomeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-hover rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitOutcomeModal}
                disabled={submittingOutcome}
                className="px-5 py-2 text-xs font-extrabold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs"
              >
                {submittingOutcome ? 'Saving...' : 'Confirm Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DPDP Act Right to Erasure Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-border text-center">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-primary">
              Execute DPDP Right to Erasure?
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Under India's Digital Personal Data Protection (DPDP) Act 2023, candidates can request full erasure of their personal data. This will permanently delete {candidate?.full_name}'s contact details, screening answers, and history from HireFlow.
            </p>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-hover rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCandidateDPDP}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition"
              >
                {isDeleting ? 'Erasing data...' : 'Permanently Erase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
