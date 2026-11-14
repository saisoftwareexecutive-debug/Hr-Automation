'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Application,
  CallOutcome,
  CompanySettings,
  DailyProgress,
  MessageTemplate,
  RejectionReason,
  UserRole,
} from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import { useToast } from '@/components/ToastProvider';
import {
  MessageSquare,
  Phone,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  UserCheck,
  Sparkles,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  PlusCircle,
  FileText,
  User,
  ArrowUpRight,
  Check,
  PhoneCall,
  X,
} from 'lucide-react';

interface QueueClientProps {
  currentUser: {
    userId: string;
    email: string;
    name: string;
    role: UserRole;
  };
  initialApplications: Application[];
  companySettings: CompanySettings;
  initialProgress: { teamTarget: number; userStats: DailyProgress[] };
  templates: MessageTemplate[];
  users: Array<{ id: string; email: string; full_name: string; role: UserRole; is_active: boolean }>;
}

type QueueSection = 'all' | 'new' | 'replied' | 'overdue' | 'callbacks' | 'interviews';

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

export function QueueClient({
  currentUser,
  initialApplications,
  companySettings,
  initialProgress,
  templates,
  users,
}: QueueClientProps) {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [activeSection, setActiveSection] = useState<QueueSection>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    currentUser.role === 'admin' ? 'all' : currentUser.userId
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Modal states
  const [whatsAppModalApp, setWhatsAppModalApp] = useState<Application | null>(null);
  const [outcomeModalApp, setOutcomeModalApp] = useState<Application | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome>('interested');
  const [callBackTime, setCallBackTime] = useState('');
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>('experience_mismatch');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  // Undo tracking
  const [lastUndoAction, setLastUndoAction] = useState<{
    appId: string;
    previousState: Application;
    timeoutId: NodeJS.Timeout;
  } | null>(null);

  // Team daily progress stats
  const [progress, setProgress] = useState(initialProgress);

  // Active user's progress
  const myProgress = useMemo(() => {
    return (
      progress.userStats.find((u) => u.user_id === currentUser.userId) || {
        user_id: currentUser.userId,
        user_name: currentUser.name,
        date: new Date().toISOString().slice(0, 10),
        messages_sent: 0,
        forms_received: 0,
        calls_made: 0,
        interviews_booked: 0,
        selected: 0,
        target: companySettings.daily_target || 25,
      }
    );
  }, [progress, currentUser, companySettings]);

  // Categorize applications for Queue sections
  const categorized = useMemo(() => {
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowStr = new Date(now + 86400000).toISOString().slice(0, 10);

    // Apply assignee filter first
    let base = applications;
    if (assigneeFilter === 'me') {
      base = base.filter((a) => a.assigned_to === currentUser.userId);
    } else if (assigneeFilter !== 'all') {
      base = base.filter((a) => a.assigned_to === assigneeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter(
        (a) =>
          a.candidate?.full_name?.toLowerCase().includes(q) ||
          a.candidate?.phone?.includes(q) ||
          a.job?.title?.toLowerCase().includes(q)
      );
    }

    const newApps = base.filter((a) => a.status === 'new');
    const repliedApps = base.filter((a) => a.status === 'replied');
    const overdueApps = base.filter(
      (a) => a.status === 'form_sent' && now - new Date(a.created_at).getTime() > 24 * 3600 * 1000
    );
    const callbacksApps = base.filter(
      (a) => a.call_back_at && a.call_back_at.slice(0, 10) <= todayStr && a.status !== 'rejected'
    );
    const interviewApps = base.filter(
      (a) =>
        a.status === 'interview' ||
        (a.interview_scheduled_at &&
          (a.interview_scheduled_at.startsWith(todayStr) ||
            a.interview_scheduled_at.startsWith(tomorrowStr)))
    );

    return {
      all: base,
      new: newApps,
      replied: repliedApps,
      overdue: overdueApps,
      callbacks: callbacksApps,
      interviews: interviewApps,
    };
  }, [applications, assigneeFilter, searchQuery, currentUser]);

  const currentList = categorized[activeSection];

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= currentList.length) {
      setSelectedIndex(Math.max(0, currentList.length - 1));
    }
  }, [currentList, selectedIndex]);

  // Global Keyboard Shortcuts (J: Next, K: Prev, W: WhatsApp, C: Call, N: Note / Outcome)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input / textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, currentList.length - 1));
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'w' || e.key === 'W') {
        const current = currentList[selectedIndex];
        if (current) {
          e.preventDefault();
          setWhatsAppModalApp(current);
        }
      } else if (e.key === 'c' || e.key === 'C') {
        const current = currentList[selectedIndex];
        if (current && current.candidate?.phone) {
          e.preventDefault();
          window.location.href = `tel:${current.candidate.phone}`;
        }
      } else if (e.key === 'n' || e.key === 'N') {
        const current = currentList[selectedIndex];
        if (current) {
          e.preventDefault();
          setOutcomeModalApp(current);
        }
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('queue-search-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentList, selectedIndex]);

  // Handle Call Outcome submission
  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeModalApp) return;

    setSubmittingOutcome(true);
    try {
      const res = await fetch('/api/candidates/call-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: outcomeModalApp.id,
          outcome: selectedOutcome,
          notes: outcomeNotes,
          callBackAt: selectedOutcome === 'call_back_later' ? callBackTime : undefined,
          rejectionReason:
            selectedOutcome === 'not_interested' ||
            selectedOutcome === 'wrong_number' ||
            selectedOutcome === 'already_working'
              ? rejectionReason
              : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.application) {
        // Save previous state for Undo
        const prevState = { ...outcomeModalApp };
        const timer = setTimeout(() => {
          setLastUndoAction(null);
        }, 6000);

        setLastUndoAction({
          appId: outcomeModalApp.id,
          previousState: prevState,
          timeoutId: timer,
        });

        // Update applications list
        setApplications((prev) =>
          prev.map((a) => (a.id === data.application.id ? data.application : a))
        );

        toast.success(`Saved outcome for ${outcomeModalApp.candidate?.full_name || 'candidate'}.`);

        setOutcomeModalApp(null);
        setOutcomeNotes('');
        setCallBackTime('');

        // Move to next candidate in queue automatically for speed
        if (selectedIndex < currentList.length - 1) {
          setSelectedIndex((prev) => prev + 1);
        }
      } else {
        toast.error(data.error || 'Failed to record call outcome');
      }
    } catch (err: any) {
      toast.error(err.message || 'Call outcome request failed');
    } finally {
      setSubmittingOutcome(false);
    }
  };

  // Handle Undo Last Status Change
  const handleUndo = async () => {
    if (!lastUndoAction) return;

    clearTimeout(lastUndoAction.timeoutId);
    try {
      const res = await fetch('/api/candidates/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: lastUndoAction.appId,
          newStatus: lastUndoAction.previousState.status,
          reason: 'Undo previous call outcome / status change',
          changedBy: currentUser.name,
        }),
      });

      const data = await res.json();
      if (data.success && data.application) {
        setApplications((prev) =>
          prev.map((a) => (a.id === data.application.id ? data.application : a))
        );
        toast.info(`Reverted ${lastUndoAction.previousState.candidate?.full_name} back to ${lastUndoAction.previousState.status}.`);
      }
    } catch (err) {
      console.error('Failed to undo:', err);
    } finally {
      setLastUndoAction(null);
    }
  };

  // Auto-split unassigned candidates evenly
  const handleAutoSplit = async () => {
    const unassignedIds = applications
      .filter((a) => !a.assigned_to)
      .map((a) => a.id);

    if (unassignedIds.length === 0) {
      toast.info('There are no unassigned candidates in the pipeline.');
      return;
    }

    try {
      const res = await fetch('/api/candidates/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSplit: true,
          applicationIds: unassignedIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh local applications
        const refreshedRes = await fetch('/api/candidates');
        if (refreshedRes.ok) {
          const refreshedData = await refreshedRes.json();
          if (refreshedData.applications) {
            setApplications(refreshedData.applications);
          }
        }
        toast.success(`Distributed ${unassignedIds.length} candidates between active HR executives.`);
      }
    } catch (err) {
      toast.error('Failed to auto-split candidates.');
    }
  };

  // Accuracy helper checks
  const getAccuracyFlags = (app: Application) => {
    const flags: { label: string; color: string }[] = [];
    const city = app.form_answers?.current_city || app.candidate?.city;
    if (!city) {
      flags.push({ label: 'Missing City', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' });
    }

    const exp = app.form_answers?.experience_years ?? (app.candidate?.total_experience_months ? app.candidate.total_experience_months / 12 : 0);
    if (exp === 0) {
      flags.push({ label: '0 Yrs Exp', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' });
    }

    const expectedSalary = app.form_answers?.expected_salary;
    const maxSalary = app.job?.max_salary;
    if (expectedSalary && maxSalary && expectedSalary > maxSalary) {
      flags.push({
        label: `High CTC (₹${expectedSalary} vs max ₹${maxSalary})`,
        color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
      });
    }

    return flags;
  };

  const completedToday = myProgress.calls_made + myProgress.interviews_booked + myProgress.selected;
  const targetPercent = Math.min(100, Math.round((completedToday / (myProgress.target || 25)) * 100));

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-subtle text-brand border border-brand/20">
              High-Velocity HR
            </span>
            <span className="text-xs text-muted font-mono">
              [J] Next • [K] Prev • [W] WhatsApp • [C] Call • [N] Outcome
            </span>
          </div>
          <h1 className="text-2xl font-black text-primary tracking-tight mt-1">
            My Queue
          </h1>
          <p className="text-xs text-secondary mt-0.5">
            Prioritized daily candidate pipeline for {currentUser.name}. One-tap actions for high speed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={handleAutoSplit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-raised hover:bg-surface-hover border border-border text-primary shadow-xs transition"
              title="Evenly distribute unassigned applicants between Pallavi and Shradha"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Auto-Split Unassigned</span>
            </button>
          )}

          {/* Assignee Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-surface rounded-xl border border-border p-1 text-xs">
            <User className="w-3.5 h-3.5 text-muted ml-2" />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-transparent font-semibold text-primary focus:outline-hidden pr-2 py-1 cursor-pointer"
            >
              <option value="me">Assigned to Me ({currentUser.name})</option>
              <option value="all">All Team Members</option>
              {users
                .filter((u) => u.is_active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role === 'admin' ? 'Admin' : 'HR Exec'})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Daily Progress "Today" Bar */}
      <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-black shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-primary">Today&apos;s Outreach Progress</span>
                <span className="text-xs font-bold text-brand">{targetPercent}%</span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {completedToday} of {myProgress.target} candidate interactions completed today.
              </p>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-border">
              <span className="text-muted block text-[10px] uppercase font-bold">Calls</span>
              <span className="font-black text-primary text-sm">{myProgress.calls_made}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-border">
              <span className="text-muted block text-[10px] uppercase font-bold">Forms Sent</span>
              <span className="font-black text-primary text-sm">{myProgress.messages_sent}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-border">
              <span className="text-muted block text-[10px] uppercase font-bold">Interviews</span>
              <span className="font-black text-primary text-sm text-amber-600 dark:text-amber-400">
                {myProgress.interviews_booked}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-border">
              <span className="text-muted block text-[10px] uppercase font-bold">Selected</span>
              <span className="font-black text-primary text-sm text-emerald-600 dark:text-emerald-400">
                {myProgress.selected}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-surface-hover rounded-full overflow-hidden border border-border/50">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${targetPercent}%` }}
          />
        </div>
      </div>

      {/* Undo Toast Notification */}
      {lastUndoAction && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-surface-raised border border-border text-primary px-4 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-200">
          <RotateCcw className="w-4 h-4 text-brand animate-spin" />
          <span className="text-xs font-semibold">
            Outcome saved for {lastUndoAction.previousState.candidate?.full_name}.
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="px-3 py-1 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand-hover transition shadow-2xs"
          >
            Undo (revert)
          </button>
        </div>
      )}

      {/* Queue Tabs & Search Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-3">
        {/* Ordered Work Sections */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Active Queue', count: categorized.all.length },
            { id: 'new', label: '1. New (Send Form)', count: categorized.new.length },
            { id: 'replied', label: '2. Replied (Call Now)', count: categorized.replied.length },
            { id: 'overdue', label: '3. 24h Overdue', count: categorized.overdue.length },
            { id: 'callbacks', label: '4. Callbacks Today', count: categorized.callbacks.length },
            { id: 'interviews', label: '5. Interviews', count: categorized.interviews.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSection(tab.id as QueueSection);
                setSelectedIndex(0);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSection === tab.id
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  activeSection === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-subtle border border-border text-secondary'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
          <input
            id="queue-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name or phone [/]..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-input-bg border border-input-border text-primary focus:outline-hidden focus:ring-2 focus:ring-brand font-medium placeholder:text-muted"
          />
        </div>
      </div>

      {/* Main Candidate Queue List */}
      {currentList.length === 0 ? (
        <div className="bg-surface rounded-3xl p-12 text-center border border-border shadow-xs space-y-3">
          <div className="w-14 h-14 bg-surface-subtle text-muted rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-extrabold text-primary">Queue is clear!</h3>
          <p className="text-xs text-secondary max-w-sm mx-auto">
            No pending candidate actions in this section. Switch tabs or import fresh applicants from WorkIndia.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((app, index) => {
            const isSelected = index === selectedIndex;
            const flags = getAccuracyFlags(app);

            return (
              <div
                key={app.id}
                onClick={() => setSelectedIndex(index)}
                className={`bg-surface rounded-2xl p-4 sm:p-5 border transition-all duration-150 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-brand ring-2 ring-brand/20 shadow-md bg-surface-raised/40'
                    : 'border-border hover:border-brand/40 shadow-xs'
                }`}
              >
                {/* Left details: Identity, Job, Score & Accuracy warnings */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                    {app.candidate?.full_name?.charAt(0) || 'C'}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/candidates/${app.id}`}
                        className="font-extrabold text-sm text-primary hover:text-brand transition flex items-center gap-1"
                      >
                        {app.candidate?.full_name || 'Candidate'}
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                      </Link>

                      <ScoreBadge score={app.score} size="sm" />

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-subtle border border-border text-secondary">
                        {String(app.status || 'new').replace(/_/g, ' ')}
                      </span>

                      {app.assigned_to_name && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {app.assigned_to_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                      <span className="font-mono text-primary font-semibold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted" />
                        {app.candidate?.phone}
                      </span>
                      <span>•</span>
                      <span>{app.job?.title}</span>
                      <span>•</span>
                      <span>{app.form_answers?.current_city || app.candidate?.city || 'India'}</span>
                    </div>

                    {/* Accuracy Flags */}
                    {flags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {flags.map((flag, fi) => (
                          <span
                            key={fi}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${flag.color}`}
                          >
                            {flag.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Big One-Tap Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
                  {/* One-Tap WhatsApp */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWhatsAppModalApp(app);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs transition transform active:scale-95"
                    title="Open WhatsApp Template"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  {/* One-Tap Direct Call */}
                  <a
                    href={`tel:${app.candidate?.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-primary bg-surface-raised hover:bg-surface-hover border border-border shadow-xs transition transform active:scale-95"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-muted" />
                    <span>Call</span>
                  </a>

                  {/* Quick Call Outcome Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOutcomeModalApp(app);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover shadow-xs transition transform active:scale-95"
                    title="Record Call Outcome & Note"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Log Outcome</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp Modal */}
      {whatsAppModalApp && (
        <WhatsAppModal
          isOpen={!!whatsAppModalApp}
          onClose={() => setWhatsAppModalApp(null)}
          application={whatsAppModalApp}
          onMarkSent={async (appId) => {
            // refresh application
            setApplications((prev) =>
              prev.map((a) =>
                a.id === appId
                  ? { ...a, status: 'form_sent', form_sent_at: new Date().toISOString() }
                  : a
              )
            );
          }}
        />
      )}

      {/* Call Outcome Modal Dialog */}
      {outcomeModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-lg w-full shadow-2xl border border-border overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-tr from-brand-800 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">Record Call Outcome</h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Candidate: {outcomeModalApp.candidate?.full_name} ({outcomeModalApp.candidate?.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOutcomeModalApp(null)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOutcome} className="p-6 space-y-4 text-xs">
              {/* Select Call Outcome Preset */}
              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Call Outcome *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'interested', label: 'Interested', desc: 'Move to Shortlisted' },
                    { id: 'selected_for_interview', label: 'Invite to Interview', desc: 'Direct Schedule' },
                    { id: 'call_back_later', label: 'Call Back Later', desc: 'Set date & time' },
                    { id: 'not_reachable', label: 'Not Reachable', desc: 'No answer / busy' },
                    { id: 'not_interested', label: 'Not Interested', desc: 'Candidate declined' },
                    { id: 'wrong_number', label: 'Wrong Number', desc: 'Invalid contact' },
                    { id: 'already_working', label: 'Already Working', desc: 'Joined elsewhere' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedOutcome(preset.id as CallOutcome)}
                      className={`p-2.5 rounded-xl border text-left transition font-semibold ${
                        selectedOutcome === preset.id
                          ? 'border-brand bg-brand/10 text-primary ring-1 ring-brand'
                          : 'border-border bg-surface-subtle hover:bg-surface-hover text-secondary'
                      }`}
                    >
                      <strong className="block text-primary text-xs">{preset.label}</strong>
                      <span className="text-[10px] text-muted">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Call Back Time Picker (If callback selected) */}
              {selectedOutcome === 'call_back_later' && (
                <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1.5 animate-in fade-in">
                  <label className="block font-bold text-primary uppercase tracking-wider text-[11px]">
                    Schedule Callback Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={callBackTime}
                    onChange={(e) => setCallBackTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-input-bg border border-input-border text-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand text-xs"
                  />
                </div>
              )}

              {/* Fixed Job-Related Rejection Reasons (If rejected / not interested) */}
              {(selectedOutcome === 'not_interested' ||
                selectedOutcome === 'wrong_number' ||
                selectedOutcome === 'already_working') && (
                <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1.5 animate-in fade-in">
                  <label className="block font-bold text-primary uppercase tracking-wider text-[11px]">
                    Job-Related Rejection Reason * (Fair Hiring Compliant)
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value as RejectionReason)}
                    className="w-full px-3 py-2 rounded-lg bg-input-bg border border-input-border text-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand text-xs"
                  >
                    {REJECTION_REASONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Additional Notes */}
              <div>
                <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
                  Call Notes & Remarks
                </label>
                <textarea
                  rows={3}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Cleared communication check, available for rotational shift, expects ₹26,000 in-hand..."
                  className="w-full px-3 py-2 rounded-xl bg-input-bg border border-input-border text-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand text-xs placeholder:text-muted"
                />
              </div>

              {/* Dialog Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setOutcomeModalApp(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-surface-hover text-secondary font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutcome}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition"
                >
                  {submittingOutcome ? 'Saving...' : 'Confirm Outcome'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

