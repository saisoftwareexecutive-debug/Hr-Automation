'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  CompanySettings,
  Job,
  MessageLanguage,
  MessageTemplate,
  MessageTone,
  TemplateType,
} from '@/types';
import { SessionData } from '@/lib/auth';
import {
  ALLOWED_VARIABLES,
  calculateSmsSegments,
  formatWhatsAppMarkdown,
  renderTemplate,
  TONE_PRESETS,
  validateTemplateVariables,
  TemplateVariableContext,
  getWhatsAppCleanPhone,
} from '@/lib/templates';
import { COMPANY_NAME } from '@/lib/brand';
import {
  FileText,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Save,
  Send,
  History,
  Layers,
  AlertTriangle,
  Info,
  Clock,
  Smartphone,
  ExternalLink,
  X,
  Plus,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

interface TemplatesClientProps {
  user: SessionData;
  jobs: Job[];
  companySettings: CompanySettings;
  initialTemplates: MessageTemplate[];
}

export function TemplatesClient({
  user,
  jobs,
  companySettings,
  initialTemplates,
}: TemplatesClientProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Template selection state
  const [activeType, setActiveType] = useState<TemplateType>('screening_invite');
  const [activeLang, setActiveLang] = useState<MessageLanguage>(companySettings.default_language || 'en');
  const [activeTone, setActiveTone] = useState<MessageTone>(companySettings.default_tone || 'friendly');
  const [selectedJobId, setSelectedJobId] = useState<string>('global'); // 'global' or job id

  // Template store state
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Test modal state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  // Editable sample preview values
  const [sampleValues, setSampleValues] = useState<TemplateVariableContext>({
    candidate_name: 'Rahul Verma',
    job_title: 'Field Sales & Operations Representative',
    company_name: companySettings.company_name || COMPANY_NAME,
    form_link: 'https://hireflow.internal/apply/abc123token',
    hr_name: companySettings.hr_name || 'Pallavi Mali',
    hr_phone: companySettings.hr_phone || '+91 9876543210',
    interview_date: 'Tomorrow (Friday)',
    interview_time: '11:30 AM',
    interview_location: 'Andheri East, near Marol Naka metro station',
    job_city: 'Mumbai',
    job_location: 'Andheri East, near Marol Naka metro station',
    map_link: 'https://maps.google.com/?q=Andheri+East+Mumbai',
    salary_range: '₹22,000 - ₹38,000 / month',
  });

  const [sampleValuesDrawerOpen, setSampleValuesDrawerOpen] = useState(false);

  // Find currently active template in store for this combination
  const currentActiveTemplate = useMemo(() => {
    const targetJob = selectedJobId === 'global' ? null : selectedJobId;
    return templates.find(
      (t) =>
        t.template_type === activeType &&
        t.language === activeLang &&
        ((targetJob && t.job_id === targetJob) || (!targetJob && (!t.job_id || t.job_id === null))) &&
        t.is_active
    );
  }, [templates, activeType, activeLang, selectedJobId]);

  // Editor content state
  const [content, setContent] = useState<string>(() => {
    if (currentActiveTemplate) return currentActiveTemplate.content;
    return TONE_PRESETS[activeType]?.[activeLang]?.[activeTone] || '';
  });

  // Keep editor content synchronized when selecting new tab/language/job
  useEffect(() => {
    if (currentActiveTemplate) {
      setContent(currentActiveTemplate.content);
      setActiveTone(currentActiveTemplate.tone);
    } else {
      const preset = TONE_PRESETS[activeType]?.[activeLang]?.[activeTone] || '';
      setContent(preset);
    }
  }, [activeType, activeLang, selectedJobId, currentActiveTemplate]);

  // When user changes tone preset selector: load that tone preset into the editor
  const handleToneChange = (newTone: MessageTone) => {
    setActiveTone(newTone);
    const preset = TONE_PRESETS[activeType]?.[activeLang]?.[newTone];
    if (preset) {
      setContent(preset);
      toast.info(`Loaded "${getToneLabel(newTone)}" preset. You can customize it freely.`);
    }
  };

  // Variable chip click: insert at cursor position
  const insertVariable = (variableName: string) => {
    if (!textareaRef.current) {
      setContent((prev) => prev + variableName);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + variableName + current.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableName.length, start + variableName.length);
    }, 0);
  };

  // Rendered preview text with replaced variables
  const renderedPreviewText = useMemo(() => {
    return renderTemplate(content, sampleValues);
  }, [content, sampleValues]);

  // SMS length calculation
  const smsCalc = useMemo(() => {
    return calculateSmsSegments(renderedPreviewText);
  }, [renderedPreviewText]);

  // Save template version
  const handleSave = async (asNewVersion = false) => {
    if (user.role !== 'admin') {
      toast.error('Permission denied: Only Administrators can edit or save message templates.');
      return;
    }

    // Validation
    const validation = validateTemplateVariables(content, activeType);
    if (!validation.isValid) {
      toast.error(validation.errors.join('. '));
      return;
    }

    if (validation.warnings.length > 0) {
      if (!confirm(`Warning: ${validation.warnings.join(' ')}\n\nDo you want to save anyway?`)) {
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          template_type: activeType,
          language: activeLang,
          tone: activeTone,
          title: `${getTemplateTypeTitle(activeType)} (${activeLang === 'en' ? 'English' : 'Hindi'} - ${getToneLabel(activeTone)})`,
          content,
          job_id: selectedJobId === 'global' ? null : selectedJobId,
          set_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save template');
      }

      // Refresh local templates list
      setTemplates((prev) => [data.template, ...prev.map((t) => (t.id === data.template.id ? data.template : t))]);
      toast.success(`Template saved as active Version ${data.template.version_number}!`);
    } catch (err: any) {
      toast.error(err.message || 'Error saving template');
    } finally {
      setLoading(false);
    }
  };

  // Reset to default preset
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset this template to the factory default preset?')) {
      return;
    }
    const defaultText = TONE_PRESETS[activeType]?.[activeLang]?.[activeTone] || '';
    setContent(defaultText);
    toast.info('Template reset to default preset in editor. Click "Save Template" to persist.');
  };

  // Restore previous version
  const handleRestoreVersion = async (templateId: string) => {
    if (user.role !== 'admin') {
      toast.error('Permission denied: Only Admin can restore versions.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', templateId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore version');
      }

      setTemplates((prev) => [data.template, ...prev]);
      setContent(data.template.content);
      setActiveTone(data.template.tone);
      setHistoryOpen(false);
      toast.success(`Restored Version ${data.template.version_number} and marked as Active!`);
    } catch (err: any) {
      toast.error(err.message || 'Error restoring version');
    } finally {
      setLoading(false);
    }
  };

  // Delete previous version
  const handleDeleteVersion = async (templateId: string) => {
    if (user.role !== 'admin') {
      toast.error('Permission denied: Only Admin can delete template versions.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this template version?')) return;

    try {
      const res = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete template version');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success('Template version deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Error deleting template version');
    }
  };

  // Copy preview to clipboard
  const handleCopyPreview = () => {
    navigator.clipboard.writeText(renderedPreviewText);
    setCopied(true);
    toast.success('Message copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Send test message to my number
  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    const clean = getWhatsAppCleanPhone(testNumber);
    const encoded = encodeURIComponent(renderedPreviewText);
    const url = `https://wa.me/${clean}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setTestModalOpen(false);
    toast.success('WhatsApp test message link opened!');
  };

  // Version history for current type/lang/job
  const currentHistory = useMemo(() => {
    const targetJob = selectedJobId === 'global' ? null : selectedJobId;
    return templates
      .filter(
        (t) =>
          t.template_type === activeType &&
          t.language === activeLang &&
          ((targetJob && t.job_id === targetJob) || (!targetJob && (!t.job_id || t.job_id === null)))
      )
      .sort((a, b) => b.version_number - a.version_number);
  }, [templates, activeType, activeLang, selectedJobId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            WhatsApp &amp; SMS Message Templates
          </h1>
          <p className="text-sm text-secondary mt-1">
            Standardized, high-converting messages with editable tones, variable chips, and live WhatsApp bubble preview.
          </p>
        </div>

        {/* Scope selector: Global vs Job Override */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-surface p-1.5 rounded-2xl border border-border shadow-xs text-xs font-bold">
          <label className="text-muted pl-2">Scope:</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="p-2 rounded-xl bg-input-bg text-primary border-none font-bold text-xs"
          >
            <option value="global">🌐 Global (All Jobs Default)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                🎯 Override: {j.title} ({j.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Role Alert for HR Executives */}
      {user.role !== 'admin' && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            You are logged in as an <strong>HR Executive</strong>. You can preview, test, and use active templates, but template edits are restricted to Administrators.
          </span>
        </div>
      )}

      {/* Template Type Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setActiveType('screening_invite')}
          className={`p-3.5 rounded-2xl border text-left transition font-bold text-xs ${
            activeType === 'screening_invite'
              ? 'border-brand-600 bg-brand-50/70 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Step 1</span>
          <span>1. Screening Invite</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveType('reminder_24h')}
          className={`p-3.5 rounded-2xl border text-left transition font-bold text-xs ${
            activeType === 'reminder_24h'
              ? 'border-brand-600 bg-brand-50/70 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Step 2</span>
          <span>2. 24h Reminder</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveType('interview_invite')}
          className={`p-3.5 rounded-2xl border text-left transition font-bold text-xs ${
            activeType === 'interview_invite'
              ? 'border-brand-600 bg-brand-50/70 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Step 3</span>
          <span>3. Interview Invite</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveType('rejection')}
          className={`p-3.5 rounded-2xl border text-left transition font-bold text-xs ${
            activeType === 'rejection'
              ? 'border-brand-600 bg-brand-50/70 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Step 4</span>
          <span>4. Polite Not Selected</span>
        </button>
      </div>

      {/* Editor & Preview Split Grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: EDITING & TONE CONTROLS (7 Cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          {/* Tone Selector & Language Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            {/* Tone Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                <span>Preset Tone:</span>
              </label>
              <select
                value={activeTone}
                onChange={(e) => handleToneChange(e.target.value as MessageTone)}
                className="py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs"
              >
                <option value="friendly">Friendly (Conversational, warm)</option>
                <option value="professional">Professional (Structured, formal)</option>
                <option value="warm_respectful">Warm and Respectful (Namaste ji)</option>
                <option value="short_direct">Short and Direct (Crisp, action-oriented)</option>
                <option value="polite_urgent">Polite Urgent (Time-sensitive scheduling)</option>
              </select>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeLang === 'en'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('hi')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeLang === 'hi'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                हिंदी (Hindi)
              </button>
            </div>
          </div>

          {/* Active Version Info Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {getTemplateTypeTitle(activeType)}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Tone: {getToneLabel(activeTone)}
              </span>
              {currentActiveTemplate && (
                <span className="text-[10px] font-bold text-slate-400">
                  Active v{currentActiveTemplate.version_number}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              <History className="w-3.5 h-3.5" />
              <span>Version History ({currentHistory.length})</span>
            </button>
          </div>

          {/* Clickable Variable Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Insert Variable (Clicks insert at cursor):
            </span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {ALLOWED_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 hover:border-brand-300 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold transition active:scale-95"
                  title={`Insert ${v}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea Editor */}
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write template message here..."
              className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:bg-white focus:ring-2 focus:ring-brand-500 leading-relaxed"
            />

            {/* Character & SMS Warning Counters */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-medium">
                  Length: <strong className="text-slate-900 dark:text-white">{smsCalc.characterCount}</strong> chars
                </span>

                {/* SMS Segment Warning */}
                {smsCalc.isOverSingleSms ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Exceeds 1 SMS ({smsCalc.segments} segments)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Fits 1 standard SMS ({smsCalc.singleLimit} char limit)</span>
                  </span>
                )}
              </div>

              <span className="text-[11px] text-slate-400">
                Supports WhatsApp *bold*, _italic_, ~strike~
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset to Default Preset</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={loading || user.role !== 'admin'}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : 'Save as Active Version'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: LIVE WHATSAPP BUBBLE PREVIEW (5 Cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Live WhatsApp Preview
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[11px] text-slate-700 dark:text-slate-300"
                  title="Copy Message"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTestModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] hover:bg-emerald-100 transition"
                  title="Send Test on WhatsApp"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Test Send</span>
                </button>
              </div>
            </div>

            {/* Simulated WhatsApp Chat Screen */}
            <div className="bg-[#EFEAE2] dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
              <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-4 shadow-sm border border-slate-100 dark:border-slate-700 max-w-[95%] space-y-2">
                <div
                  className="text-xs text-slate-900 dark:text-slate-100 leading-relaxed break-words font-sans"
                  dangerouslySetInnerHTML={{ __html: formatWhatsAppMarkdown(renderedPreviewText) }}
                />
                <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 pt-1">
                  <span>10:45 AM</span>
                  <span className="text-emerald-600">✓✓</span>
                </div>
              </div>
            </div>

            {/* Editable Sample Values Drawer Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSampleValuesDrawerOpen(!sampleValuesDrawerOpen)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                <span>Customize Preview Sample Values</span>
                <span className="text-[11px] text-slate-400">{sampleValuesDrawerOpen ? '▲ Hide' : '▼ Expand'}</span>
              </button>

              {/* Editable Sample Inputs */}
              {sampleValuesDrawerOpen && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 mt-2 space-y-3 text-xs animate-in fade-in">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      &#123;&#123;candidate_name&#125;&#125;
                    </label>
                    <input
                      type="text"
                      value={sampleValues.candidate_name || ''}
                      onChange={(e) => setSampleValues({ ...sampleValues, candidate_name: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      &#123;&#123;job_title&#125;&#125;
                    </label>
                    <input
                      type="text"
                      value={sampleValues.job_title || ''}
                      onChange={(e) => setSampleValues({ ...sampleValues, job_title: e.target.value })}
                      className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      &#123;&#123;interview_date&#125;&#125; &amp; &#123;&#123;interview_time&#125;&#125;
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sampleValues.interview_date || ''}
                        onChange={(e) => setSampleValues({ ...sampleValues, interview_date: e.target.value })}
                        className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 font-medium"
                      />
                      <input
                        type="text"
                        value={sampleValues.interview_time || ''}
                        onChange={(e) => setSampleValues({ ...sampleValues, interview_time: e.target.value })}
                        className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Practical Advice Tips Card (Requirement A.9: Replaces 4x claim) */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold">
              <Info className="w-4 h-4 text-brand-600" />
              <span>Practical Advice for WhatsApp Hiring Messages</span>
            </div>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              <li className="flex items-start gap-2">
                <span className="font-bold text-brand-600">•</span>
                <span>
                  <strong>Keep it short:</strong> Indian blue-collar and mid-level job seekers read on mobile screens. Keep invitations under 160 characters when possible.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-brand-600">•</span>
                <span>
                  <strong>One clear call to action:</strong> Include only one primary action per message—either tap the screening link or reply with CONFIRM.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-brand-600">•</span>
                <span>
                  <strong>Batch your sending:</strong> Tap to send in batches of 10–15 messages every few hours to avoid trigger alerts from WhatsApp spam heuristics.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-brand-600">•</span>
                <span>
                  <strong>Polite &amp; respectful:</strong> Simple greetings like <em>Namaste</em> build trust and eliminate hesitation to click the screening link.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DRAWER / MODAL: VERSION HISTORY */}
      {/* ======================================================== */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">Version History: {getTemplateTypeTitle(activeType)}</h3>
                <p className="text-[11px] text-slate-400">
                  Language: {activeLang === 'en' ? 'English' : 'Hindi'} | Scope: {selectedJobId === 'global' ? 'Global' : 'Job Override'}
                </p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {currentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No previous versions saved yet.</p>
              ) : (
                currentHistory.map((v) => (
                  <div
                    key={v.id}
                    className={`p-4 rounded-2xl border text-xs space-y-2.5 transition ${
                      v.is_active
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          Version {v.version_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Tone: {getToneLabel(v.tone)}
                        </span>
                        {v.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {new Date(v.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {!v.is_active && user.role === 'admin' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestoreVersion(v.id)}
                              className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] transition"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVersion(v.id)}
                              className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 font-bold text-[11px] transition"
                              title="Delete this version"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-[10px] text-muted italic"
                            title="Active and system default templates cannot be deleted"
                          >
                            Protected
                          </span>
                        )}
                      </div>
                    </div>

                    <pre className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                      {v.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TEST SEND TO MY NUMBER */}
      {/* ======================================================== */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>Send WhatsApp Test Message</span>
              </h3>
              <button onClick={() => setTestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter your own mobile number to test how this message appears on WhatsApp with live variables replaced.
            </p>

            <form onSubmit={handleSendTest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Your Indian Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98200 11111"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open in WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getTemplateTypeTitle(type: TemplateType): string {
  switch (type) {
    case 'screening_invite':
      return '1. Screening Form Invite';
    case 'reminder_24h':
      return '2. 24-Hour Follow-up Reminder';
    case 'interview_invite':
      return '3. Interview Invitation';
    case 'rejection':
      return '4. Polite Not Selected Message';
  }
}

function getToneLabel(tone: MessageTone): string {
  switch (tone) {
    case 'friendly':
      return 'Friendly';
    case 'professional':
      return 'Professional';
    case 'warm_respectful':
      return 'Warm & Respectful';
    case 'short_direct':
      return 'Short & Direct';
    case 'polite_urgent':
      return 'Polite Urgent';
  }
}

