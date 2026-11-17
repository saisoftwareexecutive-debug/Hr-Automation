'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionData } from '@/lib/auth';
import { COMPANY_NAME } from '@/lib/brand';
import { Application, Job, CompanySettings, MessageTemplate, User, MessageLanguage } from '@/types';
import { normalizeIndianPhone, formatIndianPhoneDisplay, getWhatsAppPhoneDigits } from '@/lib/phone';
import { renderTemplate, getFormUrl } from '@/lib/templates';
import {
  Send,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Users,
  XCircle,
  HelpCircle,
  Calendar,
  Undo2,
  Coffee,
} from 'lucide-react';

interface BatchCandidateItem {
  applicationId: string;
  candidateId: string;
  name: string;
  rawPhone: string;
  formattedPhone: string;
  whatsappPhone: string;
  city: string;
  appliedOn: string;
  status: string;
  formSentAt?: string | null;
  lastReminderAt?: string | null;
  token: string;
  assignedTo?: string | null;
  assignedToName?: string | null;
}

interface NeedsAttentionItem {
  applicationId: string;
  candidateId: string;
  name: string;
  rawPhone: string;
  city: string;
  reason: string;
}

interface BatchSendClientProps {
  currentUser: SessionData;
  jobs: Job[];
  companySettings: CompanySettings;
  templates: MessageTemplate[];
  users: Omit<User, 'password_hash'>[];
  allApplications: Application[];
  initialJobId?: string;
  initialMode?: 'screening' | 'reminder';
}

type BatchStatus = 'waiting' | 'current' | 'sent' | 'skipped' | 'wrong_number';

interface BatchSessionPerson {
  candidate: BatchCandidateItem;
  status: BatchStatus;
  savedAt?: string;
  wasSkippedBefore?: boolean;
}

export function BatchSendClient({
  currentUser,
  jobs,
  companySettings,
  templates,
  users,
  allApplications,
  initialJobId,
  initialMode = 'screening',
}: BatchSendClientProps) {
  const router = useRouter();

  // Wizard Step: 1 (Choose), 2 (Send), 3 (Summary)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Controls
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || (jobs[0]?.id || ''));
  const [mode, setMode] = useState<'screening' | 'reminder'>(initialMode);
  const [language, setLanguage] = useState<MessageLanguage>('en');
  const [assignedFilter, setAssignedFilter] = useState<string>(
    currentUser.role === 'admin' ? 'all' : currentUser.userId
  );

  // Selected candidate application IDs in Step 1
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());

  // Step 2 Session State
  const [batchQueue, setBatchQueue] = useState<BatchSessionPerson[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [whatsAppOpenedForCurrent, setWhatsAppOpenedForCurrent] = useState<boolean>(false);
  const [copiedMessageForCurrent, setCopiedMessageForCurrent] = useState<boolean>(false);
  const [copiedLinkForCurrent, setCopiedLinkForCurrent] = useState<boolean>(false);
  const [showSavedFlash, setShowSavedFlash] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [concurrencyNotice, setConcurrencyNotice] = useState<string | null>(null);
  const [popupBlockedNotice, setPopupBlockedNotice] = useState<boolean>(false);
  const [showWrongNumberConfirm, setShowWrongNumberConfirm] = useState<boolean>(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState<boolean>(false);
  const [showBreakBanner, setShowBreakBanner] = useState<boolean>(false);

  // Telemetry & Timing
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sessionSendsCount, setSessionSendsCount] = useState<number>(0);

  // Auto-scroll ref for right-hand list in Step 2
  const currentItemRef = useRef<HTMLDivElement | null>(null);

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('hireflow_batch_lang');
      if (savedLang === 'en' || savedLang === 'hi') {
        setLanguage(savedLang as MessageLanguage);
      } else if (companySettings.default_language) {
        setLanguage(companySettings.default_language);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [companySettings.default_language]);

  const handleLanguageChange = (lang: MessageLanguage) => {
    setLanguage(lang);
    try {
      localStorage.setItem('hireflow_batch_lang', lang);
    } catch {
      // ignore
    }
  };

  // Timer effect for session
  useEffect(() => {
    if (step === 2 && startTime > 0) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, startTime]);

  // Selected job entity
  const selectedJob = useMemo(() => {
    return jobs.find((j) => j.id === selectedJobId) || jobs[0];
  }, [jobs, selectedJobId]);

  // Check App URL Configuration
  const appUrlConfig = useMemo(() => {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const isLocal = !rawUrl || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1');
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      url: rawUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
      isLocal,
      isProduction,
      hasError: isProduction && isLocal,
    };
  }, []);

  // Filter candidates matching current job, mode, and assigned filter
  const { validCandidates, needsAttentionList, waitingCountsByJob } = useMemo(() => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const effectiveAssigned = currentUser.role === 'admin' ? assignedFilter : currentUser.userId;

    const matchesModeAndAssignee = (a: Application, targetJobId?: string) => {
      if (targetJobId && a.job_id !== targetJobId) return false;
      if (effectiveAssigned && effectiveAssigned !== 'all' && a.assigned_to !== effectiveAssigned) {
        return false;
      }

      if (mode === 'screening') {
        return a.status === 'new' && !a.form_sent_at;
      } else {
        if (a.status !== 'form_sent' || a.replied_at || !a.form_sent_at) return false;
        const sentTime = new Date(a.form_sent_at).getTime();
        return sentTime <= twentyFourHoursAgo;
      }
    };

    // Calculate waiting count per job for dropdown
    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      const count = allApplications.filter((a) => {
        if (!matchesModeAndAssignee(a, job.id)) return false;
        const phone = a.candidate?.phone;
        const parsed = normalizeIndianPhone(phone);
        return parsed.isValid;
      }).length;
      counts[job.id] = count;
    });

    // Candidates for selected job
    const matchingApps = allApplications.filter((a) => matchesModeAndAssignee(a, selectedJobId));

    const valids: BatchCandidateItem[] = [];
    const needsAttn: NeedsAttentionItem[] = [];

    matchingApps.forEach((a) => {
      const candidate = a.candidate;
      const rawPhone = candidate?.phone || '';
      const parsed = normalizeIndianPhone(rawPhone);

      if (parsed.isValid && parsed.nationalNumber) {
        valids.push({
          applicationId: a.id,
          candidateId: candidate?.id || a.candidate_id,
          name: candidate?.full_name || 'Candidate',
          rawPhone,
          formattedPhone: formatIndianPhoneDisplay(rawPhone),
          whatsappPhone: getWhatsAppPhoneDigits(rawPhone),
          city: candidate?.city || '',
          appliedOn: a.created_at,
          status: a.status,
          formSentAt: a.form_sent_at,
          lastReminderAt: a.last_reminder_at || null,
          token: a.token,
          assignedTo: a.assigned_to,
          assignedToName: a.assigned_to_name,
        });
      } else {
        const reason = !rawPhone.trim() ? 'phone number missing' : 'number looks wrong';
        needsAttn.push({
          applicationId: a.id,
          candidateId: candidate?.id || a.candidate_id,
          name: candidate?.full_name || 'Candidate',
          rawPhone,
          city: candidate?.city || '',
          reason,
        });
      }
    });

    return {
      validCandidates: valids,
      needsAttentionList: needsAttn,
      waitingCountsByJob: counts,
    };
  }, [allApplications, selectedJobId, mode, assignedFilter, currentUser, jobs]);

  // When candidates list changes in Step 1, select all valid candidates by default
  useEffect(() => {
    if (step === 1) {
      setSelectedAppIds(new Set(validCandidates.map((c) => c.applicationId)));
    }
  }, [validCandidates, step]);

  // Active template for mode and language
  const activeTemplate = useMemo(() => {
    const targetType = mode === 'screening' ? 'screening_invite' : 'reminder_24h';

    // 1. Try job-specific active template
    const jobSpecific = templates.find(
      (t) =>
        t.job_id === selectedJobId &&
        t.template_type === targetType &&
        t.language === language &&
        t.is_active
    );
    if (jobSpecific) return jobSpecific;

    // 2. Try global active template for this language
    const globalMatch = templates.find(
      (t) =>
        !t.job_id &&
        t.template_type === targetType &&
        t.language === language &&
        t.is_active
    );
    if (globalMatch) return globalMatch;

    // 3. Fallback to any active template of target type
    return (
      templates.find((t) => t.template_type === targetType && t.is_active) || null
    );
  }, [templates, mode, language, selectedJobId]);

  // Check template variables
  const templateValidation = useMemo(() => {
    if (!activeTemplate) {
      return { hasLink: false, missingLinkError: 'No active template found for this mode.' };
    }
    const hasLink = activeTemplate.content.includes('{{form_link}}');
    return {
      hasLink,
      missingLinkError: hasLink
        ? null
        : 'This template has no form link. Ask the Admin to fix it.',
    };
  }, [activeTemplate]);

  // Render message for a given candidate
  const getRenderedMessage = useCallback(
    (candidate: BatchCandidateItem) => {
      if (!activeTemplate || !selectedJob) return '';

      const formUrl = getFormUrl(candidate.token, appUrlConfig.url);

      const salaryRange =
        selectedJob.min_salary && selectedJob.max_salary
          ? `₹${Number(selectedJob.min_salary).toLocaleString('en-IN')} - ₹${Number(
              selectedJob.max_salary
            ).toLocaleString('en-IN')}`
          : undefined;

      const rendered = renderTemplate(activeTemplate.content, {
        candidate_name: candidate.name,
        job_title: selectedJob.title,
        company_name: companySettings.company_name || COMPANY_NAME,
        form_link: formUrl,
        hr_name: companySettings.hr_name || currentUser.name,
        hr_phone: companySettings.hr_phone || '',
        job_city: selectedJob.city || '',
        job_location: selectedJob.location || '',
        map_link: selectedJob.map_url || '',
        salary_range: salaryRange,
      });

      return rendered;
    },
    [activeTemplate, selectedJob, companySettings, currentUser, appUrlConfig.url]
  );

  // Preview message for first candidate in Step 1
  const previewCandidate = validCandidates[0] || null;
  const previewMessage = useMemo(() => {
    if (!previewCandidate) return '';
    return getRenderedMessage(previewCandidate);
  }, [previewCandidate, getRenderedMessage]);

  const previewIsTooLong = previewMessage.length > 1500;

  // Toggle candidate selection in table
  const handleToggleSelect = (appId: string) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedAppIds(new Set(validCandidates.map((c) => c.applicationId)));
  };

  const handleClearAll = () => {
    setSelectedAppIds(new Set());
  };

  // Start Sending Button Action
  const handleStartSending = () => {
    const selectedList = validCandidates.filter((c) => selectedAppIds.has(c.applicationId));
    if (selectedList.length === 0) return;

    const initialQueue: BatchSessionPerson[] = selectedList.map((c) => ({
      candidate: c,
      status: 'waiting',
    }));

    setBatchQueue(initialQueue);
    setCurrentIndex(0);
    setWhatsAppOpenedForCurrent(false);
    setCopiedMessageForCurrent(false);
    setCopiedLinkForCurrent(false);
    setSessionSendsCount(0);
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setStep(2);
  };

  // Current person in Step 2
  const currentPerson = batchQueue[currentIndex] || null;

  // Auto-scroll current item in right list
  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  // Reset actions when current candidate changes
  useEffect(() => {
    setWhatsAppOpenedForCurrent(false);
    setCopiedMessageForCurrent(false);
    setCopiedLinkForCurrent(false);
    setConcurrencyNotice(null);
    setPopupBlockedNotice(false);
    setShowWrongNumberConfirm(false);
    setShowUndoConfirm(false);
  }, [currentIndex]);

  // Current rendered message in Step 2
  const currentMessageText = useMemo(() => {
    if (!currentPerson) return '';
    return getRenderedMessage(currentPerson.candidate);
  }, [currentPerson, getRenderedMessage]);

  // Open WhatsApp in reusable named window
  const handleOpenWhatsApp = () => {
    if (!currentPerson) return;
    setPopupBlockedNotice(false);

    const cleanDigits = currentPerson.candidate.whatsappPhone;
    const encodedText = encodeURIComponent(currentMessageText);
    const url = `https://wa.me/${cleanDigits}?text=${encodedText}`;

    // One reusable named tab: 'hireflow_whatsapp'
    const newWindow = window.open(url, 'hireflow_whatsapp');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      setPopupBlockedNotice(true);
    }

    setWhatsAppOpenedForCurrent(true);
  };

  // Copy Message
  const handleCopyMessage = async () => {
    if (!currentMessageText) return;
    try {
      await navigator.clipboard.writeText(currentMessageText);
      setCopiedMessageForCurrent(true);
      setTimeout(() => setCopiedMessageForCurrent(false), 2500);
    } catch {
      // ignore
    }
  };

  // Copy Link
  const handleCopyLink = async () => {
    if (!currentPerson) return;
    const formUrl = getFormUrl(currentPerson.candidate.token, appUrlConfig.url);
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopiedLinkForCurrent(true);
      setTimeout(() => setCopiedLinkForCurrent(false), 2500);
    } catch {
      // ignore
    }
  };

  // Navigate to Next Person in Batch or Step 3 if done
  const advanceToNextOrFinish = (updatedQueue: BatchSessionPerson[], newSessionSends: number) => {
    // Check if any waiting candidate remains
    const nextWaitingIdx = updatedQueue.findIndex((p, idx) => idx > currentIndex && p.status === 'waiting');

    if (nextWaitingIdx !== -1) {
      setCurrentIndex(nextWaitingIdx);
      if (newSessionSends > 0 && newSessionSends % 10 === 0) {
        setShowBreakBanner(true);
      }
      return;
    }

    // Check if any earlier candidate is still waiting (e.g. jumped or skipped)
    const anyWaitingIdx = updatedQueue.findIndex((p) => p.status === 'waiting');
    if (anyWaitingIdx !== -1) {
      setCurrentIndex(anyWaitingIdx);
      if (newSessionSends > 0 && newSessionSends % 10 === 0) {
        setShowBreakBanner(true);
      }
      return;
    }

    // Check if there are skipped candidates that have not been brought back yet
    const unretriedSkippedIdx = updatedQueue.findIndex(
      (p) => p.status === 'skipped' && !p.wasSkippedBefore
    );

    if (unretriedSkippedIdx !== -1) {
      // Bring back skipped candidates once at the end
      const requeued = updatedQueue.map((p) => {
        if (p.status === 'skipped' && !p.wasSkippedBefore) {
          return { ...p, status: 'waiting' as BatchStatus, wasSkippedBefore: true };
        }
        return p;
      });
      setBatchQueue(requeued);
      const firstReturned = requeued.findIndex((p) => p.status === 'waiting');
      setCurrentIndex(firstReturned !== -1 ? firstReturned : 0);
      return;
    }

    // All done! Proceed to Step 3 Summary
    setStep(3);
  };

  // Confirm Send: "I sent it, next →"
  const handleConfirmSent = async () => {
    if (!currentPerson || isSaving) return;
    setIsSaving(true);
    setConcurrencyNotice(null);

    try {
      const res = await fetch('/api/batch-send/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: currentPerson.candidate.applicationId,
          mode,
          recipientPhone: currentPerson.candidate.formattedPhone,
          messageBody: currentMessageText,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.conflict) {
          setConcurrencyNotice(`Already updated by another user (${data.currentStatus || 'updated'}), skipped.`);
          // Mark as skipped due to conflict
          const updated = [...batchQueue];
          updated[currentIndex] = { ...currentPerson, status: 'skipped', wasSkippedBefore: true };
          setBatchQueue(updated);
          setTimeout(() => advanceToNextOrFinish(updated, sessionSendsCount), 1500);
          return;
        }
        throw new Error(data.error || 'Failed to record send');
      }

      // Show brief green saved flash
      setShowSavedFlash(true);
      setTimeout(() => setShowSavedFlash(false), 800);

      const nextSends = sessionSendsCount + 1;
      setSessionSendsCount(nextSends);

      const updated = [...batchQueue];
      updated[currentIndex] = {
        ...currentPerson,
        status: 'sent',
        savedAt: new Date().toISOString(),
      };
      setBatchQueue(updated);

      advanceToNextOrFinish(updated, nextSends);
    } catch (err: any) {
      console.error('Send save failed:', err);
      alert(err.message || 'Failed to save sent status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Skip Candidate
  const handleSkip = () => {
    if (!currentPerson) return;
    const updated = [...batchQueue];
    // If skipping for the first time, mark as skipped so they can come back once at end
    updated[currentIndex] = {
      ...currentPerson,
      status: 'skipped',
      wasSkippedBefore: currentPerson.wasSkippedBefore || false,
    };
    setBatchQueue(updated);
    advanceToNextOrFinish(updated, sessionSendsCount);
  };

  // Wrong Number
  const handleConfirmWrongNumber = async () => {
    if (!currentPerson || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/candidates/call-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: currentPerson.candidate.applicationId,
          outcome: 'wrong_number',
          notes: 'Marked wrong number during Batch Send outreach',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to mark wrong number');
      }

      const updated = [...batchQueue];
      updated[currentIndex] = {
        ...currentPerson,
        status: 'wrong_number',
      };
      setBatchQueue(updated);
      setShowWrongNumberConfirm(false);
      advanceToNextOrFinish(updated, sessionSendsCount);
    } catch (err: any) {
      console.error('Wrong number error:', err);
      alert(err.message || 'Error marking wrong number');
    } finally {
      setIsSaving(false);
    }
  };

  // Back Button
  const handleBack = () => {
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    const prevPerson = batchQueue[prevIdx];

    if (prevPerson.status === 'sent') {
      setShowUndoConfirm(true);
    } else {
      setCurrentIndex(prevIdx);
    }
  };

  // Confirm Undo Previous Send
  const handleConfirmUndo = async () => {
    const prevIdx = currentIndex - 1;
    if (prevIdx < 0) return;
    const prevPerson = batchQueue[prevIdx];
    setIsSaving(true);

    try {
      const res = await fetch('/api/batch-send/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: prevPerson.candidate.applicationId,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to undo send');
      }

      const updated = [...batchQueue];
      updated[prevIdx] = {
        ...prevPerson,
        status: 'waiting',
        savedAt: undefined,
      };
      setBatchQueue(updated);
      setSessionSendsCount((prev) => Math.max(0, prev - 1));
      setShowUndoConfirm(false);
      setCurrentIndex(prevIdx);
    } catch (err: any) {
      console.error('Undo error:', err);
      alert(err.message || 'Failed to undo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Jump directly to a candidate in the queue
  const handleJumpToPerson = (idx: number) => {
    if (idx >= 0 && idx < batchQueue.length) {
      setCurrentIndex(idx);
    }
  };

  // Stop batch and show summary confirmation
  const handleStopAndSeeSummary = () => {
    const waitingCount = batchQueue.filter((p) => p.status === 'waiting').length;
    if (waitingCount > 0) {
      if (!confirm(`Stop? ${waitingCount} people are still waiting in this batch.`)) {
        return;
      }
    }
    setStep(3);
  };

  // Summary counts
  const summaryCounts = useMemo(() => {
    const sent = batchQueue.filter((p) => p.status === 'sent').length;
    const skipped = batchQueue.filter((p) => p.status === 'skipped').length;
    const wrongNumber = batchQueue.filter((p) => p.status === 'wrong_number').length;

    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const timeFormatted = mins > 0 ? `${mins} min ${secs} s` : `${secs}s`;

    return { sent, skipped, wrongNumber, timeFormatted };
  }, [batchQueue, elapsedSeconds]);

  // Restart batch with skipped candidates
  const handleSendSkippedOnes = () => {
    const skippedCandidates = batchQueue
      .filter((p) => p.status === 'skipped')
      .map((p) => ({
        candidate: p.candidate,
        status: 'waiting' as BatchStatus,
      }));

    if (skippedCandidates.length === 0) return;

    setBatchQueue(skippedCandidates);
    setCurrentIndex(0);
    setSessionSendsCount(0);
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setStep(2);
  };

  // Keyboard Shortcuts (Enter, Space, S, B)
  useEffect(() => {
    if (step !== 2) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing inside input, textarea, select, or editable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Do not handle if modal dialogs are open
      if (showWrongNumberConfirm || showUndoConfirm || showBreakBanner) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleOpenWhatsApp();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (whatsAppOpenedForCurrent || copiedMessageForCurrent) {
          handleConfirmSent();
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    step,
    whatsAppOpenedForCurrent,
    copiedMessageForCurrent,
    showWrongNumberConfirm,
    showUndoConfirm,
    showBreakBanner,
    handleOpenWhatsApp,
    handleConfirmSent,
    handleSkip,
    handleBack,
  ]);

  // Status helper text for table in Step 1
  const getStatusDisplay = (c: BatchCandidateItem) => {
    if (mode === 'screening') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">New</span>;
    }
    if (c.formSentAt) {
      const hours = Math.floor((Date.now() - new Date(c.formSentAt).getTime()) / (3600 * 1000));
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
          Form sent {hours}h ago
        </span>
      );
    }
    return <span className="text-muted text-xs">Form sent</span>;
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 3-STEP WIZARD HEADER BAR */}
      {/* ======================================================== */}
      <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-extrabold">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition ${
              step === 1
                ? 'bg-brand/10 text-brand font-black ring-1 ring-brand/30'
                : 'text-secondary opacity-70'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>
            <span>Choose</span>
          </div>

          <span className="text-muted font-bold">›</span>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition ${
              step === 2
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black ring-1 ring-emerald-500/30'
                : 'text-secondary opacity-70'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>
            <span>Send</span>
          </div>

          <span className="text-muted font-bold">›</span>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition ${
              step === 3
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black ring-1 ring-purple-500/30'
                : 'text-secondary opacity-70'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">3</span>
            <span>Summary</span>
          </div>
        </div>

        {step === 2 && (
          <button
            type="button"
            onClick={handleStopAndSeeSummary}
            className="text-xs font-bold text-muted hover:text-primary underline transition"
          >
            Stop and see summary
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* APP URL WARNINGS (LOCAL / PRODUCTION) */}
      {/* ======================================================== */}
      {appUrlConfig.hasError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 text-rose-950 dark:text-rose-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-xs font-bold leading-relaxed">
            The app address is not set correctly. Ask the Admin. (NEXT_PUBLIC_APP_URL is not configured for production public access).
          </p>
        </div>
      )}

      {appUrlConfig.isLocal && !appUrlConfig.isProduction && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3 text-amber-950 dark:text-amber-200 flex items-center gap-2.5 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>This link only works on this computer (local development address).</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: CHOOSE */}
      {/* ======================================================== */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Title */}
          <div>
            <h1 className="text-2xl font-black text-primary flex items-center gap-2.5">
              <Send className="w-7 h-7 text-brand" />
              Batch Send
            </h1>
            <p className="text-xs text-secondary mt-1">
              Send the screening form to everyone who applied for one job. WhatsApp opens for each person with the message ready.
            </p>
          </div>

          {/* Row of Controls (Job, Mode, Language, Assigned to) */}
          <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Job Dropdown */}
              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Job Position
                </label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-border p-2.5 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                >
                  {jobs.length === 0 && <option value="">Select a job</option>}
                  {jobs.map((job) => {
                    const waitingCount = waitingCountsByJob[job.id] || 0;
                    return (
                      <option key={job.id} value={job.id}>
                        {job.title}, {job.city || 'Pan India'} ({waitingCount} waiting)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Mode Switch (Toggle Buttons) */}
              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Outreach Mode
                </label>
                <div className="grid grid-cols-2 gap-1 bg-surface-subtle p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setMode('screening')}
                    className={`py-2 rounded-lg font-bold transition text-center ${
                      mode === 'screening'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Send form
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('reminder')}
                    className={`py-2 rounded-lg font-bold transition text-center ${
                      mode === 'reminder'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    Send reminder
                  </button>
                </div>
              </div>

              {/* Language Switch */}
              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Message Language
                </label>
                <div className="grid grid-cols-2 gap-1 bg-surface-subtle p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`py-2 rounded-lg font-bold transition text-center ${
                      language === 'en'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('hi')}
                    className={`py-2 rounded-lg font-bold transition text-center ${
                      language === 'hi'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>

              {/* Assigned To Filter (Admin Only or Locked for HR Exec) */}
              <div>
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1.5">
                  Assigned HR
                </label>
                {currentUser.role === 'admin' ? (
                  <select
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-border p-2.5 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
                  >
                    <option value="all">All Team Members</option>
                    {users
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role === 'admin' ? 'Admin' : 'HR Exec'})
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="w-full text-xs font-bold rounded-xl border border-border p-2.5 bg-surface-subtle text-secondary truncate">
                    Assigned to {currentUser.name} (Only yours)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Message Preview Card */}
          <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-extrabold text-primary">Message preview</h3>
                {activeTemplate && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-subtle border border-border text-secondary">
                    {activeTemplate.title} ({activeTemplate.tone})
                  </span>
                )}
              </div>

              {currentUser.role === 'admin' && (
                <Link
                  href="/templates"
                  className="text-xs font-bold text-brand hover:text-brand-hover underline transition"
                >
                  Edit templates &rarr;
                </Link>
              )}
            </div>

            {/* Missing {{form_link}} Warning */}
            {!templateValidation.hasLink && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 text-rose-950 dark:text-rose-200 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <p className="text-xs font-bold">
                  This template has no form link. Ask the Admin to fix it.
                </p>
              </div>
            )}

            {/* Over 1500 chars Warning */}
            {previewIsTooLong && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3 text-amber-950 dark:text-amber-200 flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  This message is {previewMessage.length} characters long. WhatsApp may truncate preview links on mobile.
                </span>
              </div>
            )}

            {/* WhatsApp Chat Bubble */}
            {previewCandidate ? (
              <div className="max-w-lg p-4 rounded-2xl bg-[#DCF8C6]/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-primary leading-relaxed whitespace-pre-line shadow-xs">
                {previewMessage}
              </div>
            ) : (
              <p className="text-xs text-muted italic">
                Select a job with waiting candidates to preview message.
              </p>
            )}
          </div>

          {/* Candidate Selection Table */}
          <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
            {/* Table Control Header */}
            <div className="p-4 sm:p-5 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-primary">
                  {selectedAppIds.size} selected of {validCandidates.length}
                </span>
                <span className="text-muted">·</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-brand hover:text-brand-hover underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-bold text-secondary hover:text-primary underline"
                >
                  Clear all
                </button>
              </div>

              <span className="text-xs text-muted">
                Mode: {mode === 'screening' ? 'New Applicants' : 'Unreplied > 24 Hours'}
              </span>
            </div>

            {/* Candidate Rows */}
            {validCandidates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised border-b border-border text-secondary font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedAppIds.size === validCandidates.length && validCandidates.length > 0}
                          onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearAll())}
                          className="rounded border-border text-brand focus:ring-brand cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">City</th>
                      <th className="p-3">Applied on</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {validCandidates.map((c) => {
                      const isChecked = selectedAppIds.has(c.applicationId);
                      return (
                        <tr
                          key={c.applicationId}
                          onClick={() => handleToggleSelect(c.applicationId)}
                          className={`hover:bg-surface-hover transition cursor-pointer ${
                            isChecked ? 'bg-brand/5' : ''
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelect(c.applicationId)}
                              className="rounded border-border text-brand focus:ring-brand cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-primary">{c.name}</td>
                          <td className="p-3 font-mono text-secondary">{c.formattedPhone}</td>
                          <td className="p-3 text-secondary">{c.city || '—'}</td>
                          <td className="p-3 text-muted">
                            {new Date(c.appliedOn).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="p-3">{getStatusDisplay(c)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center space-y-3">
                <Users className="w-10 h-10 text-muted mx-auto" />
                <h4 className="font-extrabold text-sm text-primary">
                  Nobody is waiting for this job right now.
                </h4>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  All applicants have either already received the form or do not match the selected mode criteria.
                </p>
                <div className="pt-2">
                  <Link
                    href="/import"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs shadow-xs hover:bg-brand-hover transition"
                  >
                    Go to WorkIndia Import &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Needs Attention Box (Invalid / Missing Phones) */}
          {needsAttentionList.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">
                  Needs attention ({needsAttentionList.length})
                </h4>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                These candidates have missing or invalid phone numbers and are excluded from batch sending until corrected:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {needsAttentionList.map((item) => (
                  <div
                    key={item.applicationId}
                    className="bg-white dark:bg-surface p-3 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-primary block">{item.name}</span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Problem: {item.reason} ({item.rawPhone || 'empty'})
                      </span>
                    </div>
                    <Link
                      href={`/candidates`}
                      className="text-xs font-bold text-brand hover:text-brand-hover underline ml-2 shrink-0"
                    >
                      Open candidate
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Sending Primary Button */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 pt-4 border-t border-border">
            <p className="text-xs text-muted">
              You will press Send in WhatsApp for each person.
            </p>

            <button
              type="button"
              onClick={handleStartSending}
              disabled={
                selectedAppIds.size === 0 ||
                !selectedJobId ||
                !templateValidation.hasLink ||
                appUrlConfig.hasError
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-brand hover:bg-brand-hover text-white font-black text-sm shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-98"
            >
              <Send className="w-5 h-5" />
              {language === 'hi'
                ? `भेजना शुरू करें (${selectedAppIds.size})`
                : `Start sending (${selectedAppIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: SEND */}
      {/* ======================================================== */}
      {step === 2 && currentPerson && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Progress Bar & Stop Link */}
          <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-primary">
                Person {currentIndex + 1} of {batchQueue.length}
              </span>
              <span className="text-secondary">
                {Math.round(((currentIndex + 1) / batchQueue.length) * 100)}% completed
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-surface-subtle overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / batchQueue.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 10-Send Break Banner */}
          {showBreakBanner && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-emerald-950 dark:text-emerald-100">
                    Good job! Take a 2 minute break to keep WhatsApp happy.
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Spreading outreach evenly prevents rate-limiting and account flags.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakBanner(false)}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition"
              >
                Continue &rarr;
              </button>
            </div>
          )}

          {/* Concurrency conflict banner */}
          {concurrencyNotice && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-amber-950 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{concurrencyNotice}</span>
            </div>
          )}

          {/* Popup blocked fallback banner */}
          {popupBlockedNotice && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl p-4 text-rose-950 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>WhatsApp was blocked by browser pop-up blocker.</span>
              </div>
              <a
                href={`https://wa.me/${currentPerson.candidate.whatsappPhone}?text=${encodeURIComponent(
                  currentMessageText
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsAppOpenedForCurrent(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs underline"
              >
                Click here to open
              </a>
            </div>
          )}

          {/* Two Columns Layout: Left Wide Card, Right Narrow List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Current Candidate Card */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6 relative overflow-hidden">
                {/* Saved Flash Green Bar */}
                {showSavedFlash && (
                  <div className="absolute top-0 inset-x-0 bg-emerald-500 text-white py-1.5 px-4 text-xs font-black flex items-center justify-center gap-1.5 animate-in fade-in">
                    <Check className="w-4 h-4" /> Saved!
                  </div>
                )}

                {/* Row 1: Initial Avatar + Large Bold Name + Job Title */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand font-black text-xl flex items-center justify-center shrink-0">
                    {currentPerson.candidate.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-primary leading-tight">
                      {currentPerson.candidate.name}
                    </h2>
                    <p className="text-xs font-bold text-secondary mt-0.5">
                      {selectedJob.title}
                    </p>
                  </div>
                </div>

                {/* Row 2: Phone with icon (+91 XXXXX XXXXX) + City */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-secondary">
                  <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-xl border border-border">
                    <Phone className="w-3.5 h-3.5 text-muted" />
                    <span className="font-mono font-bold text-primary">
                      {currentPerson.candidate.formattedPhone}
                    </span>
                  </div>
                  {currentPerson.candidate.city && (
                    <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-xl border border-border">
                      <MapPin className="w-3.5 h-3.5 text-muted" />
                      <span>{currentPerson.candidate.city}</span>
                    </div>
                  )}
                </div>

                {/* Row 3: Message to Send Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-secondary">
                    <span>Message to send</span>
                    <span className="text-[11px] text-muted font-normal">
                      {currentMessageText.length} characters
                    </span>
                  </div>
                  <div className="w-full p-4 rounded-2xl bg-surface-subtle border border-border text-xs text-primary leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto font-sans select-text">
                    {currentMessageText}
                  </div>
                </div>

                {/* Row 4: Two Helper Buttons (Copy message, Copy link) */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-secondary transition"
                  >
                    {copiedMessageForCurrent ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied message
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy message
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-secondary transition"
                  >
                    {copiedLinkForCurrent ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied link
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </>
                    )}
                  </button>
                </div>

                {/* Row 5: Main Big Action Buttons (Open WhatsApp & I sent it) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Green Open WhatsApp Button */}
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition transform active:scale-98"
                  >
                    <MessageSquare className="w-5 h-5 fill-current" />
                    Open WhatsApp
                  </button>

                  {/* Purple I sent it Button */}
                  <button
                    type="button"
                    onClick={handleConfirmSent}
                    disabled={
                      (!whatsAppOpenedForCurrent && !copiedMessageForCurrent) || isSaving
                    }
                    title={
                      !whatsAppOpenedForCurrent && !copiedMessageForCurrent
                        ? 'Open WhatsApp first'
                        : undefined
                    }
                    className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-98"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isSaving ? 'Saving...' : 'I sent it, next →'}
                  </button>
                </div>

                {/* Row 6: Small Secondary Buttons (Skip, Wrong number, Back) */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentIndex === 0 || isSaving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-secondary hover:text-primary transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    ← Back
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowWrongNumberConfirm(true)}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      Wrong number
                    </button>
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-secondary hover:text-primary hover:bg-surface-hover transition"
                    >
                      Skip
                    </button>
                  </div>
                </div>

                {/* Row 7: Keyboard Shortcuts Help */}
                <div className="text-[11px] text-muted text-center pt-1 border-t border-border/50">
                  Enter = Open WhatsApp · Space = I sent it, next · S = Skip · B = Back
                </div>
              </div>

              {/* Confirm Wrong Number Modal */}
              {showWrongNumberConfirm && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-3 animate-in fade-in">
                  <p className="text-xs font-bold text-rose-950 dark:text-rose-100">
                    Mark {currentPerson.candidate.name}&apos;s number as wrong?
                  </p>
                  <p className="text-xs text-rose-800 dark:text-rose-300">
                    This will log an outcome of &quot;Wrong Number&quot;, remove them from the batch, and advance to the next person.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmWrongNumber}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                    >
                      Yes, mark wrong number
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWrongNumberConfirm(false)}
                      className="px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Undo Modal */}
              {showUndoConfirm && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3 animate-in fade-in">
                  <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                    Undo previous send for {batchQueue[currentIndex - 1]?.candidate.name}?
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    This will revert the stage back to {mode === 'screening' ? 'New' : 'Unreminded'} and log an undo audit event.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmUndo}
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      Yes, undo previous send
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUndoConfirm(false)}
                      className="px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: "Everyone in this batch" list */}
            <div className="bg-surface rounded-3xl p-5 border border-border shadow-xs space-y-3 max-h-[580px] flex flex-col">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-secondary">
                  Everyone in this batch
                </h3>
                <span className="text-xs font-mono font-bold text-muted">
                  {batchQueue.filter((p) => p.status === 'sent').length}/{batchQueue.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {batchQueue.map((person, idx) => {
                  const isCurrent = idx === currentIndex;

                  let iconNode = <span className="text-muted font-bold">○</span>;
                  if (person.status === 'sent') {
                    iconNode = <span className="text-emerald-600 dark:text-emerald-400 font-black">✓</span>;
                  } else if (person.status === 'skipped') {
                    iconNode = <span className="text-muted font-bold">↷</span>;
                  } else if (person.status === 'wrong_number') {
                    iconNode = <span className="text-rose-600 dark:text-rose-400 font-bold">✗</span>;
                  } else if (isCurrent) {
                    iconNode = <span className="text-brand font-black">▶</span>;
                  }

                  return (
                    <div
                      key={person.candidate.applicationId}
                      ref={isCurrent ? currentItemRef : null}
                      onClick={() => handleJumpToPerson(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                        isCurrent
                          ? 'bg-brand/10 text-brand font-black ring-1 ring-brand/30'
                          : person.status === 'sent'
                          ? 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                          : person.status === 'skipped'
                          ? 'opacity-60 text-muted'
                          : person.status === 'wrong_number'
                          ? 'opacity-60 text-rose-600 dark:text-rose-400 line-through'
                          : 'hover:bg-surface-hover text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-4 text-center shrink-0">{iconNode}</span>
                        <span className="truncate">{person.candidate.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-muted shrink-0 ml-2">
                        {person.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: SUMMARY */}
      {/* ======================================================== */}
      {step === 3 && (
        <div className="bg-surface rounded-3xl p-8 border border-border shadow-xs space-y-8 animate-in fade-in duration-150">
          <div className="text-center space-y-2 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-primary">Batch finished</h2>
            <p className="text-xs text-secondary leading-relaxed">
              All messages for <strong>{selectedJob?.title}</strong> outreach have been processed and logged to candidate histories.
            </p>
          </div>

          {/* 4 Summary Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface-subtle p-5 rounded-2xl border border-border text-center space-y-1">
              <span className="text-[11px] uppercase font-extrabold text-muted">Sent</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {summaryCounts.sent}
              </p>
            </div>

            <div className="bg-surface-subtle p-5 rounded-2xl border border-border text-center space-y-1">
              <span className="text-[11px] uppercase font-extrabold text-muted">Skipped</span>
              <p className="text-2xl sm:text-3xl font-black text-secondary">
                {summaryCounts.skipped}
              </p>
            </div>

            <div className="bg-surface-subtle p-5 rounded-2xl border border-border text-center space-y-1">
              <span className="text-[11px] uppercase font-extrabold text-muted">Wrong number</span>
              <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
                {summaryCounts.wrongNumber}
              </p>
            </div>

            <div className="bg-surface-subtle p-5 rounded-2xl border border-border text-center space-y-1">
              <span className="text-[11px] uppercase font-extrabold text-muted">Time taken</span>
              <p className="text-2xl sm:text-3xl font-black text-primary font-mono">
                {summaryCounts.timeFormatted}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-border">
            {summaryCounts.skipped > 0 && (
              <button
                type="button"
                onClick={handleSendSkippedOnes}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition"
              >
                <RotateCcw className="w-4 h-4" />
                Send the skipped ones ({summaryCounts.skipped})
              </button>
            )}

            <Link
              href="/queue"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-xs shadow-xs transition"
            >
              Go to My Queue &rarr;
            </Link>

            <Link
              href="/pipeline"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-surface border border-border hover:bg-surface-hover text-primary font-bold text-xs transition"
            >
              Open Pipeline Board
            </Link>

            <button
              type="button"
              onClick={() => {
                setBatchQueue([]);
                setCurrentIndex(0);
                setStep(1);
              }}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-surface border border-border hover:bg-surface-hover text-secondary font-bold text-xs transition"
            >
              Start another batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
