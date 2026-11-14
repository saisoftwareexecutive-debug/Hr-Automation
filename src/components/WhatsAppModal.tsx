'use client';

import React, { useState, useEffect } from 'react';
import { Application, CompanySettings, MessageLanguage, MessageTone, TemplateType } from '@/types';
import { createCandidateMessage, calculateSmsSegments } from '@/lib/templates';
import { COMPANY_NAME } from '@/lib/brand';
import {
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Edit3,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface WhatsAppModalProps {
  application?: Application | null;
  applications?: Application[];
  isOpen: boolean;
  onClose: () => void;
  onMarkSent?: (appId: string) => Promise<void>;
  defaultTemplate?: TemplateType;
}

export function WhatsAppModal({
  application,
  applications,
  isOpen,
  onClose,
  onMarkSent,
  defaultTemplate = 'screening_invite',
}: WhatsAppModalProps) {
  // Normalize candidate list
  const candidateList: Application[] = applications && applications.length > 0
    ? applications
    : application
    ? [application]
    : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [template, setTemplate] = useState<TemplateType>(defaultTemplate);
  const [language, setLanguage] = useState<MessageLanguage>('en');
  const [copied, setCopied] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  // Active template & settings state
  const [activeTemplateText, setActiveTemplateText] = useState<string>('');
  const [activeTone, setActiveTone] = useState<MessageTone>('friendly');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [customText, setCustomText] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // Sync default template when prop changes
  useEffect(() => {
    if (defaultTemplate) {
      setTemplate(defaultTemplate);
    }
  }, [defaultTemplate]);

  // Reset index when opening modal
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setCustomText(null);
      setIsEditing(false);
    }
  }, [isOpen]);

  // Fetch company settings once
  useEffect(() => {
    if (!isOpen) return;
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
          if (data.settings.default_language) {
            setLanguage(data.settings.default_language);
          }
        }
      } catch (err) {
        console.error('Failed to load company settings', err);
      }
    }
    loadSettings();
  }, [isOpen]);

  const currentApp = candidateList[currentIndex] || null;

  // Fetch active template when template, language, or current candidate's job changes
  useEffect(() => {
    if (!isOpen || !currentApp) return;

    let isCancelled = false;
    async function loadActiveTemplate() {
      setIsLoadingTemplate(true);
      try {
        const jobId = currentApp?.job_id;
        const url = `/api/templates?type=${template}&lang=${language}${jobId ? `&jobId=${jobId}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!isCancelled && data.success && data.template) {
          setActiveTemplateText(data.template.content);
          setActiveTone(data.template.tone);
        } else if (!isCancelled) {
          setActiveTemplateText('');
        }
      } catch (err) {
        console.error('Failed to fetch active template', err);
      } finally {
        if (!isCancelled) setIsLoadingTemplate(false);
      }
    }

    loadActiveTemplate();
    setCustomText(null);
    setIsEditing(false);

    return () => {
      isCancelled = true;
    };
  }, [isOpen, template, language, currentApp?.job_id, currentIndex]);

  if (!isOpen || candidateList.length === 0 || !currentApp || !currentApp.candidate) {
    return null;
  }

  const candidate = currentApp.candidate;
  const jobTitle = currentApp.job?.title || 'Job Opening';
  const token = currentApp.token;

  // Extra variable substitutions
  const salaryRange = currentApp.job
    ? `₹${(currentApp.job.min_salary / 1000).toFixed(0)}k - ₹${(currentApp.job.max_salary / 1000).toFixed(0)}k`
    : 'Competitive';

  const extraContext = {
    company_name: settings?.company_name || COMPANY_NAME,
    hr_name: settings?.hr_name || 'HR Recruitment Team',
    hr_phone: settings?.hr_phone || '+91 9876543210',
    job_city: currentApp.job?.city || 'Mumbai',
    job_location: currentApp.job?.location || '',
    map_link: currentApp.job?.map_url || (currentApp.job?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentApp.job.location + (currentApp.job.city ? ', ' + currentApp.job.city : ''))}` : ''),
    interview_location: currentApp.job?.location || 'Office / Telephonic',
    salary_range: salaryRange,
  };

  const slot = currentApp.interview_scheduled_at
    ? new Date(currentApp.interview_scheduled_at).toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

  const generated = createCandidateMessage(
    template,
    language,
    candidate.full_name,
    jobTitle,
    candidate.phone,
    token,
    slot,
    undefined,
    customText ?? (activeTemplateText || undefined),
    extraContext
  );

  const displayedText = customText ?? generated.text;
  const smsSegments = calculateSmsSegments(displayedText);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  };

  const handleOpenWhatsApp = async () => {
    // Open wa.me link with encoded text
    const cleanPhone = candidate.phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(displayedText);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

    window.open(url, '_blank', 'noopener,noreferrer');

    // Automatically mark status as form_sent if appropriate
    if (onMarkSent && (currentApp.status === 'new' || template === 'screening_invite')) {
      setIsMarking(true);
      try {
        await onMarkSent(currentApp.id);
      } catch (err) {
        console.error('Error marking as sent', err);
      } finally {
        setIsMarking(false);
      }
    }

    // If batch mode and not at the end, advance
    if (candidateList.length > 1 && currentIndex < candidateList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setCustomText(null);
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface rounded-3xl max-w-xl w-full shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Send Candidate Message</h3>
                {candidateList.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-700/80 text-emerald-100">
                    {currentIndex + 1} of {candidateList.length}
                  </span>
                )}
              </div>
              <p className="text-emerald-100 text-xs">
                To: <span className="font-bold text-white">{candidate.full_name}</span> ({candidate.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Navigation Banner if multiple */}
        {candidateList.length > 1 && (
          <div className="px-6 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-900 dark:text-emerald-200">
              Queue: Candidate {currentIndex + 1} of {candidateList.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (currentIndex > 0) {
                    setCurrentIndex((i) => i - 1);
                    setCustomText(null);
                    setIsEditing(false);
                  }
                }}
                disabled={currentIndex === 0}
                className="p-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-surface text-emerald-800 dark:text-emerald-300 disabled:opacity-40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                title="Previous Candidate"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentIndex < candidateList.length - 1) {
                    setCurrentIndex((i) => i + 1);
                    setCustomText(null);
                    setIsEditing(false);
                  }
                }}
                disabled={currentIndex === candidateList.length - 1}
                className="p-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-surface text-emerald-800 dark:text-emerald-300 disabled:opacity-40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                title="Next Candidate"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Template & Language Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1">
                Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as TemplateType)}
                className="w-full text-xs rounded-xl border border-border p-2 bg-input-bg text-primary focus:ring-2 focus:ring-brand font-medium focus:outline-hidden"
              >
                <option value="screening_invite">Screening Form Invite</option>
                <option value="reminder_24h">24h Follow-up Reminder</option>
                <option value="interview_invite">Interview Invitation</option>
                <option value="rejection">Polite &quot;Not Selected&quot;</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase mb-1">
                Language (भाषा)
              </label>
              <div className="flex rounded-xl border border-border p-0.5 bg-surface-subtle">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                    language === 'en' ? 'bg-surface shadow-xs text-brand font-bold' : 'text-secondary'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                    language === 'hi' ? 'bg-surface shadow-xs text-brand font-bold' : 'text-secondary'
                  }`}
                >
                  हिंदी (Hindi)
                </button>
              </div>
            </div>
          </div>

          {/* Active Tone Badge & Status */}
          <div className="flex items-center justify-between px-3 py-2 bg-surface-subtle border border-border rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted">Active Tone:</span>
              <span className="inline-flex items-center gap-1 font-bold text-brand bg-brand-subtle border border-brand/20 px-2 py-0.5 rounded-full capitalize">
                <Sparkles className="w-3 h-3 text-brand" />
                {activeTone.replace('_', ' ')}
              </span>
              {isLoadingTemplate && <span className="text-muted text-[11px]">(Loading...)</span>}
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditing ? 'Done Editing' : 'Edit for this candidate'}
            </button>
          </div>

          {/* Message Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-secondary uppercase">
                WhatsApp Message (Free Click-to-Chat)
              </label>
              <div className="flex items-center gap-3">
                {customText !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomText(null)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-rose-500"
                    title="Reset candidate custom edits"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:text-emerald-700 dark:hover:text-emerald-400 font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy text'}
                </button>
              </div>
            </div>

            {isEditing ? (
              <textarea
                value={displayedText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={6}
                className="w-full text-xs font-sans p-3 border border-border rounded-xl bg-input-bg text-primary focus:ring-2 focus:ring-brand shadow-inner leading-relaxed focus:outline-hidden"
                placeholder="Type your message here..."
              />
            ) : (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 rounded-2xl p-4 font-sans text-xs whitespace-pre-wrap leading-relaxed text-primary shadow-inner max-h-52 overflow-y-auto">
                {displayedText}
              </div>
            )}

            {/* Character & SMS segment counter */}
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
              <span>{smsSegments.characterCount} characters ({smsSegments.isUnicode ? 'Unicode' : 'Standard'})</span>
              {smsSegments.isOverSingleSms ? (
                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                  ⚠️ Fits in {smsSegments.segments} SMS parts (WhatsApp has no limit)
                </span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400">✓ 1 SMS segment</span>
              )}
            </div>
          </div>

          {/* Gentle WhatsApp Anti-Spam Tip */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Safe Sending:</span> Send in batches of 5–10 candidates at a time. This keeps candidate response rates high and avoids spam warnings on WorkIndia applicants without paying for WhatsApp Business API.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-surface-subtle border-t border-border flex flex-wrap items-center justify-between gap-3">
          <a
            href={`sms:${candidate.phone}?body=${encodeURIComponent(displayedText)}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-secondary bg-surface border border-border rounded-xl hover:bg-surface-hover transition shadow-2xs"
          >
            <Smartphone className="w-3.5 h-3.5 text-muted" />
            SMS Fallback
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-hover rounded-xl transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isMarking}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition transform active:scale-95 disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {isMarking
                ? 'Updating status...'
                : candidateList.length > 1 && currentIndex < candidateList.length - 1
                ? 'Open WhatsApp & Next'
                : 'Open WhatsApp & Mark Sent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
