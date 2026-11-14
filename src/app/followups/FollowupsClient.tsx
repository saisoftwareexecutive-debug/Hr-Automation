'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Application, TemplateType } from '@/types';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import {
  Clock,
  CalendarCheck,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Phone,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface FollowupsClientProps {
  overdueNoReply: Application[];
  tomorrowInterviews: Application[];
}

export function FollowupsClient({
  overdueNoReply,
  tomorrowInterviews,
}: FollowupsClientProps) {
  const [activeTab, setActiveTab] = useState<'noreply' | 'interview'>('noreply');
  const [activeModalApp, setActiveModalApp] = useState<Application | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('reminder_24h');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenReminder = (app: Application, template: TemplateType) => {
    setActiveModalApp(app);
    setActiveTemplate(template);
    setIsModalOpen(true);
  };

  const getHoursElapsed = (isoDate?: string | null) => {
    if (!isoDate) return '24+';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('noreply')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'noreply'
              ? 'border-brand text-brand'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <Clock className="w-4 h-4" />
          No Reply After 24 Hours
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
            {overdueNoReply.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('interview')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'interview'
              ? 'border-brand text-brand'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          Interviews Tomorrow
          <span className="px-2 py-0.5 rounded-full text-xs bg-brand-subtle text-brand border border-brand/20 font-bold">
            {tomorrowInterviews.length}
          </span>
        </button>
      </div>

      {/* Gentle Safe-Sending Batching Notice */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Indian HR Best Practice:</span> WhatsApp click-to-chat links are 100% free and don't cost anything per message. To maintain high candidate response rates and avoid automated spam limits, tap through candidates in batches of 5 to 10 at a time.
        </div>
      </div>

      {/* Tab 1: No Reply After 24 Hours */}
      {activeTab === 'noreply' && (
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 bg-surface-subtle border-b border-border flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-secondary">
              Unanswered Screening Forms ({overdueNoReply.length})
            </span>
            <span className="text-xs text-muted">Form sent more than 24 hours ago</span>
          </div>

          <div className="divide-y divide-border">
            {overdueNoReply.map((app) => {
              const hoursElapsed = getHoursElapsed(app.form_sent_at);
              return (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/candidates/${app.id}`}
                        className="font-bold text-sm text-primary hover:text-brand transition"
                      >
                        {app.candidate?.full_name || 'Candidate'}
                      </Link>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full">
                        Sent {hoursElapsed}h ago
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="font-mono text-secondary">{app.candidate?.phone || ''}</span>
                      <span>•</span>
                      <span>{app.job?.title || 'Job Opening'}</span>
                      <span>•</span>
                      <span>{app.candidate?.city || 'India'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenReminder(app, 'reminder_24h')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Reminder
                    </button>

                    <Link
                      href={`/candidates/${app.id}`}
                      className="px-3 py-2 text-xs font-semibold text-secondary bg-surface-raised hover:bg-surface-hover border border-border rounded-xl transition"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}

            {overdueNoReply.length === 0 && (
              <div className="py-12 text-center text-xs text-muted">
                🎉 Excellent! There are no candidates with overdue replies after 24 hours.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Interviews Tomorrow */}
      {activeTab === 'interview' && (
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 bg-surface-subtle border-b border-border flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-secondary">
              Candidates Scheduled for Tomorrow ({tomorrowInterviews.length})
            </span>
            <span className="text-xs text-muted">Confirm time slot and venue</span>
          </div>

          <div className="divide-y divide-border">
            {tomorrowInterviews.map((app) => (
              <div
                key={app.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/candidates/${app.id}`}
                      className="font-bold text-sm text-primary hover:text-brand transition"
                    >
                      {app.candidate?.full_name || 'Candidate'}
                    </Link>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-brand-subtle text-brand border border-brand/20 rounded-full">
                      Score: {typeof app.score === 'number' ? app.score : 0}/100
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="font-mono text-secondary">{app.candidate?.phone || ''}</span>
                    <span>•</span>
                    <span>{app.job?.title || 'Job Opening'}</span>
                    <span>•</span>
                    <span className="font-semibold text-brand flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {app.form_answers?.preferred_interview_slot || 'Tomorrow at 11:00 AM'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenReminder(app, 'interview_invite')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Send Slot Confirmation
                  </button>

                  <a
                    href={`tel:${app.candidate?.phone}`}
                    className="p-2 text-secondary bg-surface-raised hover:bg-surface-hover border border-border rounded-xl transition"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}

            {tomorrowInterviews.length === 0 && (
              <div className="py-12 text-center text-xs text-muted">
                No interviews scheduled for tomorrow yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        application={activeModalApp}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultTemplate={activeTemplate}
      />
    </div>
  );
}

