'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Application, ApplicationStatus, Job, UserRole } from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import {
  MessageSquare,
  Phone,
  Clock,
  ArrowRight,
  Search,
  Filter,
  UserCheck,
  CheckCircle2,
  Calendar,
  XCircle,
  Award,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface KanbanBoardClientProps {
  initialApplications: Application[];
  jobs: Job[];
  users?: Array<{ id: string; email: string; full_name: string; role: UserRole }>;
  currentUser?: { userId: string; email: string; name: string; role: UserRole };
  selectedJobId?: string;
}

const STAGES: { id: ApplicationStatus; title: string; color: string; bg: string; dot: string }[] = [
  { id: 'new', title: 'New', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100/80 dark:bg-slate-900/40', dot: 'bg-slate-400 dark:bg-slate-500' },
  { id: 'form_sent', title: 'Form Sent', color: 'text-sky-800 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/30', dot: 'bg-sky-500' },
  { id: 'replied', title: 'Replied', color: 'text-indigo-800 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/30', dot: 'bg-indigo-500' },
  { id: 'shortlisted', title: 'Shortlisted', color: 'text-purple-800 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/30', dot: 'bg-purple-500' },
  { id: 'interview', title: 'Interview', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30', dot: 'bg-amber-500' },
  { id: 'selected', title: 'Selected', color: 'text-emerald-800 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
  { id: 'rejected', title: 'Rejected', color: 'text-rose-800 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/30', dot: 'bg-rose-500' },
];

export function KanbanBoardClient({
  initialApplications = [],
  jobs = [],
  users = [],
  currentUser,
  selectedJobId,
}: KanbanBoardClientProps) {
  const [applications, setApplications] = useState<Application[]>(initialApplications || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

  // WhatsApp Modal state
  const [activeModalApp, setActiveModalApp] = useState<Application | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtered by search and assignee
  const list = Array.isArray(applications) ? applications : [];
  const filteredApps = list.filter((app) => {
    if (!app) return false;
    // Assignee Filter
    if (assigneeFilter === 'me' && currentUser) {
      if (app.assigned_to !== currentUser.userId) return false;
    } else if (assigneeFilter === 'unassigned') {
      if (app.assigned_to) return false;
    } else if (assigneeFilter !== 'all') {
      if (app.assigned_to !== assigneeFilter) return false;
    }

    // Search Filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.candidate?.full_name?.toLowerCase().includes(q) ||
      app.candidate?.phone?.includes(q) ||
      app.job?.title?.toLowerCase().includes(q) ||
      app.assigned_to_name?.toLowerCase().includes(q)
    );
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedAppId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: ApplicationStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedAppId;
    if (!id) return;

    await moveApplicationStatus(id, newStatus);
    setDraggedAppId(null);
  };

  const moveApplicationStatus = async (appId: string, newStatus: ApplicationStatus) => {
    // Optimistic UI update
    setApplications((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
    );

    if (newStatus === 'selected') {
      confetti({ particleCount: 50, spread: 60 });
    }

    try {
      const response = await fetch('/api/candidates/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appId,
          newStatus,
          changedBy: currentUser?.name || 'Kanban Board Move',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stage');
      }
    } catch (err) {
      console.error(err);
      // Revert if error
      setApplications(initialApplications);
      alert('Could not update application status.');
    }
  };

  const openWhatsApp = (app: Application) => {
    setActiveModalApp(app);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Filter candidates by name, phone, or job..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-xl border-border border pl-9 pr-3 py-2 bg-input-bg text-primary placeholder:text-muted shadow-2xs font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
            />
          </div>
        </div>

        {/* Assigned HR filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-secondary">Assignee:</label>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="text-xs rounded-xl border-border border py-1.5 px-3 bg-input-bg text-primary shadow-2xs font-semibold focus:ring-2 focus:ring-brand"
          >
            <option value="all">All Assignees</option>
            {currentUser && <option value="me">Assigned to Me</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* 7 Columns Kanban Board */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-4">
        <div className="inline-flex gap-4 h-full min-w-full">
          {STAGES.map((stage) => {
            const columnApps = filteredApps.filter((a) => a.status === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-2xl border border-border ${stage.bg} overflow-hidden shadow-xs`}
              >
                {/* Column Header */}
                <div className="p-3.5 bg-surface/85 backdrop-blur-xs border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                    <span className={`font-bold text-xs uppercase tracking-wider ${stage.color}`}>
                      {stage.title}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface-raised text-primary border border-border shadow-2xs">
                    {columnApps.length}
                  </span>
                </div>

                {/* Candidate Cards List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {columnApps.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      className="bg-surface rounded-xl p-3.5 border border-border shadow-2xs hover:shadow-md hover:border-brand/40 transition cursor-grab active:cursor-grabbing space-y-2.5 group"
                    >
                      {/* Top Row: Name and Score Badge */}
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <Link
                          href={`/candidates/${app.id}`}
                          className="font-bold text-sm text-primary group-hover:text-brand line-clamp-1 break-words min-w-0 flex-1 transition"
                          title={app.candidate?.full_name}
                        >
                          {app.candidate?.full_name || 'Candidate'}
                        </Link>
                        {app.score > 0 && <ScoreBadge score={app.score} size="sm" showLabel={false} />}
                      </div>

                      {/* Job & City info */}
                      <div className="text-[11px] text-muted space-y-0.5 min-w-0">
                        <p
                          className="truncate font-medium text-secondary"
                          title={`${app.job?.title || 'Job Opening'} ${app.job?.city ? `(${app.job.city}${app.job.location ? ` · ${app.job.location}` : ''})` : ''}`}
                        >
                          {app.job?.title || 'Job Opening'} {app.job?.city ? `(${app.job.city}${app.job.location ? ` · ${app.job.location}` : ''})` : ''}
                        </p>
                        <p className="flex items-center gap-1 min-w-0 truncate">
                          <span className="truncate">{app.candidate?.city || app.form_answers?.current_city || 'India'}</span>
                          <span>•</span>
                          <span className="font-mono text-secondary shrink-0">{app.candidate?.phone || ''}</span>
                        </p>
                      </div>

                      {/* Assigned HR & Call Outcome badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {app.assigned_to_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-raised border border-border text-primary">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                            {app.assigned_to_name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted italic">Unassigned</span>
                        )}
                        {app.call_outcome && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                            📞 {String(app.call_outcome).replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openWhatsApp(app)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition border border-emerald-200 dark:border-emerald-800/60"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          WhatsApp
                        </button>

                        {/* Move stage dropdown for quick mobile touch */}
                        <select
                          value={app.status}
                          onChange={(e) =>
                            moveApplicationStatus(app.id, e.target.value as ApplicationStatus)
                          }
                          className="text-[10px] rounded border-border py-0.5 px-1 bg-input-bg font-medium text-secondary"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move: {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {columnApps.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-xs text-muted font-medium select-none">
                      Drop candidate here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp Message Modal */}
      <WhatsAppModal
        application={activeModalApp}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMarkSent={async (appId) => {
          await moveApplicationStatus(appId, 'form_sent');
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
