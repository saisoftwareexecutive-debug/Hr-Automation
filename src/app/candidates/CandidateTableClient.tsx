'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Application, ApplicationStatus, Job, UserRole } from '@/types';
import { ScoreBadge } from '@/components/ScoreBadge';
import { WhatsAppModal } from '@/components/WhatsAppModal';
import {
  Search,
  Filter,
  Download,
  MessageSquare,
  ChevronDown,
  ArrowUpDown,
  CheckCircle2,
  Trash2,
  Phone,
  FileSpreadsheet,
  AlertTriangle,
  UserCheck,
  Users,
  Sparkles,
  RotateCcw,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { COMPANY_NAME } from '@/lib/brand';

interface CandidateTableClientProps {
  initialApplications: Application[];
  jobs: Job[];
  users?: Array<{ id: string; email: string; full_name: string; role: UserRole }>;
  currentUser?: { userId: string; email: string; name: string; role: UserRole };
  initialJobId?: string;
  initialStatus?: string;
}

export function CandidateTableClient({
  initialApplications = [],
  jobs = [],
  users = [],
  currentUser,
  initialJobId = '',
  initialStatus = 'all',
}: CandidateTableClientProps) {
  const [applications, setApplications] = useState<Application[]>(initialApplications || []);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState(initialJobId || '');
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
  const [scoreFilter, setScoreFilter] = useState('all'); // all, 85, 70, 50
  const [assigneeFilter, setAssigneeFilter] = useState('all'); // all, me, unassigned, or userId
  const [sortField, setSortField] = useState<'score' | 'name' | 'date'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  // Deletion state
  const [candidatesToDelete, setCandidatesToDelete] = useState<{ id: string; name: string }[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo state
  const [undoBackup, setUndoBackup] = useState<any>(null);
  const [undoCount, setUndoCount] = useState<number>(0);
  const [undoTimer, setUndoTimer] = useState<number>(0);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>('shortlisted');
  const [bulkAssignee, setBulkAssignee] = useState<string>('auto_split');
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // WhatsApp modal
  const [activeModalApp, setActiveModalApp] = useState<Application | null>(null);
  const [modalApplications, setModalApplications] = useState<Application[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter & Sort Logic
  const filteredApps = useMemo(() => {
    const list = Array.isArray(applications) ? applications : [];
    return list
      .filter((app) => {
        if (!app) return false;
        // Job Filter
        if (jobFilter && app.job_id !== jobFilter) return false;

        // Status Filter
        if (statusFilter && statusFilter !== 'all' && app.status !== statusFilter) return false;

        const appScore = typeof app.score === 'number' && !isNaN(app.score) ? app.score : 0;
        // Score Filter
        if (scoreFilter === '85' && appScore < 85) return false;
        if (scoreFilter === '70' && appScore < 70) return false;
        if (scoreFilter === '50' && appScore < 50) return false;
        if (scoreFilter === 'unscored' && appScore > 0) return false;

        // Assignee Filter
        if (assigneeFilter === 'me' && currentUser) {
          if (app.assigned_to !== currentUser.userId) return false;
        } else if (assigneeFilter === 'unassigned') {
          if (app.assigned_to) return false;
        } else if (assigneeFilter !== 'all') {
          if (app.assigned_to !== assigneeFilter) return false;
        }

        // Search Query
        if (search) {
          const q = search.toLowerCase().trim();
          const nameMatch = app.candidate?.full_name?.toLowerCase().includes(q);
          const phoneMatch = app.candidate?.phone?.includes(q);
          const cityMatch = (app.candidate?.city || app.form_answers?.current_city || '').toLowerCase().includes(q);
          const assignedMatch = app.assigned_to_name?.toLowerCase().includes(q);
          if (!nameMatch && !phoneMatch && !cityMatch && !assignedMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const scoreA = typeof a.score === 'number' && !isNaN(a.score) ? a.score : 0;
        const scoreB = typeof b.score === 'number' && !isNaN(b.score) ? b.score : 0;
        if (sortField === 'score') {
          return sortAsc ? scoreA - scoreB : scoreB - scoreA;
        } else if (sortField === 'name') {
          const nameA = a.candidate?.full_name || '';
          const nameB = b.candidate?.full_name || '';
          return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return sortAsc ? timeA - timeB : timeB - timeA;
        }
      });
  }, [applications, search, jobFilter, statusFilter, scoreFilter, assigneeFilter, sortField, sortAsc, currentUser]);

  // Bulk Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredApps.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Bulk Status Update
  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0) return;
    setIsUpdatingBulk(true);

    try {
      for (const appId of selectedIds) {
        await fetch('/api/candidates/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: appId,
            newStatus: bulkStatus,
            changedBy: currentUser?.name || 'Bulk Status Action',
          }),
        });
      }

      setApplications((prev) =>
        prev.map((app) => (selectedIds.includes(app.id) ? { ...app, status: bulkStatus } : app))
      );
      setSelectedIds([]);
      toast.success(`Updated status of ${selectedIds.length} candidate(s) to ${bulkStatus}.`);
    } catch (err) {
      console.error('Bulk update error', err);
      toast.error('Failed to complete bulk status update.');
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  // Bulk Assign Action
  const handleBulkAssign = async () => {
    if (selectedIds.length === 0) return;
    setIsUpdatingBulk(true);

    try {
      if (bulkAssignee === 'auto_split') {
        const res = await fetch('/api/candidates/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'auto_split' }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Auto-split complete! Candidates evenly distributed between Pallavi Mali and Shradha Yadav.`);
          setTimeout(() => window.location.reload(), 500);
        } else {
          toast.error(data.error || 'Auto-split failed');
        }
      } else {
        const selectedUser = users.find((u) => u.id === bulkAssignee);
        const res = await fetch('/api/candidates/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign',
            applicationIds: selectedIds,
            userId: bulkAssignee,
            userName: selectedUser?.full_name || 'HR Executive',
          }),
        });
        const data = await res.json();
        if (data.success) {
          setApplications((prev) =>
            prev.map((app) =>
              selectedIds.includes(app.id)
                ? {
                    ...app,
                    assigned_to: bulkAssignee,
                    assigned_to_name: selectedUser?.full_name || 'HR Executive',
                  }
                : app
            )
          );
          setSelectedIds([]);
          toast.success(`Assigned ${selectedIds.length} candidate(s) to ${selectedUser?.full_name}.`);
        } else {
          toast.error(data.error || 'Assignment failed');
        }
      }
    } catch (err) {
      console.error('Assignment error', err);
      toast.error('Failed to perform candidate assignment.');
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  // Handle undo timer countdown
  React.useEffect(() => {
    if (!undoBackup || undoTimer <= 0) return;
    const interval = setInterval(() => {
      setUndoTimer((prev) => {
        if (prev <= 1) {
          setUndoBackup(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoBackup, undoTimer]);

  const handleTriggerBulkDelete = () => {
    const targets = applications
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => ({ id: a.candidate_id, name: a.candidate?.full_name || 'Candidate' }));
    setCandidatesToDelete(targets);
    setShowDeleteModal(true);
  };

  const handleSingleDelete = (app: Application) => {
    setCandidatesToDelete([{ id: app.candidate_id, name: app.candidate?.full_name || 'Candidate' }]);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (candidatesToDelete.length === 0) return;
    setIsDeleting(true);
    try {
      const candidateIds = candidatesToDelete.map((c) => c.id);
      const res = await fetch('/api/candidates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete candidate(s)');
      }

      setApplications((prev) => prev.filter((a) => !candidateIds.includes(a.candidate_id)));
      setSelectedIds((prev) => prev.filter((id) => !candidatesToDelete.some((c) => c.id === id)));
      setShowDeleteModal(false);

      if (data.backup) {
        setUndoBackup(data.backup);
        setUndoCount(data.count || candidateIds.length);
        setUndoTimer(10);
      }
      toast.success(`${candidatesToDelete.length} candidate(s) deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Error deleting candidates');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoBackup) return;
    try {
      const res = await fetch('/api/candidates/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: undoBackup }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore candidates');
      }

      if (data.restored?.applications) {
        setApplications((prev) => [...data.restored.applications, ...prev]);
      } else {
        window.location.reload();
      }
      setUndoBackup(null);
      setUndoTimer(0);
      toast.success(`Restored ${undoCount} candidate(s) successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore candidates');
    }
  };

  // Export to Excel / CSV with official company branding & UTF-8 BOM
  const handleExport = (format: 'xlsx' | 'csv', shortlistOnly = false) => {
    const listToExport = shortlistOnly
      ? filteredApps.filter((a) => a.status === 'shortlisted' || (typeof a.score === 'number' && a.score >= 85))
      : filteredApps;

    if (listToExport.length === 0) {
      toast.warning('No candidates found to export with current filters.');
      return;
    }

    const exportRows = listToExport.map((app, index) => ({
      'Company': COMPANY_NAME,
      'Rank': index + 1,
      'Candidate Name': app.candidate?.full_name || 'N/A',
      'Phone (+91)': app.candidate?.phone || '',
      'Email': app.candidate?.email || '',
      'Job Title': app.job?.title || 'N/A',
      'Job City': app.job?.city || '',
      'Job Location': app.job?.location || '',
      'Google Maps Link': app.job?.map_url || '',
      'Assigned To': app.assigned_to_name || 'Unassigned',
      'Call Outcome': app.call_outcome || 'Pending',
      'City': app.form_answers?.current_city || app.candidate?.city || '',
      'Experience (Yrs)': app.form_answers?.experience_years ?? (app.candidate?.total_experience_months ? (app.candidate.total_experience_months / 12).toFixed(1) : 0),
      'Score (100)': typeof app.score === 'number' ? app.score : 0,
      'Status': (app.status || 'NEW').toUpperCase(),
      'Expected Salary': app.form_answers?.expected_salary || '',
      'Notice Period': app.form_answers ? `${app.form_answers.notice_period_days} days` : '',
      'Shift Choice': app.form_answers?.shift_preference || '',
      'Interview Slot': app.form_answers?.preferred_interview_slot || '',
      'Application Date': app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN') : '',
      'Score Notes': (app.score_breakdown?.notes || []).join(' | '),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, shortlistOnly ? 'Shortlist' : 'Candidates');

    const fileName = `cscs_${shortlistOnly ? 'shortlist' : 'candidates'}_${new Date().toISOString().slice(0, 10)}.${format}`;

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      // Prepend UTF-8 BOM (\uFEFF) so Excel opens Hindi & Unicode cleanly
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
    }
    toast.success(`Exported ${listToExport.length} candidate(s) to ${format.toUpperCase()}.`);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Toolbar */}
      <div className="bg-surface rounded-2xl p-4 border border-border shadow-xs space-y-3 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search bar */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
            <input
              type="text"
              placeholder="Search by name, phone (+91), city, or HR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-border pl-9 pr-3 py-2.5 bg-surface text-primary placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-brand font-medium"
            />
          </div>

          {/* Job Filter */}
          <div>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-border py-2.5 px-3 bg-surface text-primary focus:ring-2 focus:ring-brand font-semibold"
            >
              <option value="">All Jobs ({jobs.length})</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}, {j.city}{j.location ? ` (${j.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-border py-2.5 px-3 bg-surface text-primary focus:ring-2 focus:ring-brand font-semibold"
            >
              <option value="all">All Stages</option>
              <option value="new">New</option>
              <option value="form_sent">Form Sent</option>
              <option value="replied">Replied</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview">Interview</option>
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Assigned HR Filter */}
          <div>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-border py-2.5 px-3 bg-surface text-primary focus:ring-2 focus:ring-brand font-semibold"
            >
              <option value="all">All Assignees</option>
              {currentUser && <option value="me">Assigned to Me</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role === 'admin' ? 'Admin' : 'HR'})
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* Score Match Filter */}
          <div>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-border py-2.5 px-3 bg-surface text-primary focus:ring-2 focus:ring-brand font-semibold"
            >
              <option value="all">Any Score</option>
              <option value="85">Top Match (85+)</option>
              <option value="70">Good Fit (70+)</option>
              <option value="50">Moderate (50+)</option>
              <option value="unscored">Unscored / Pending</option>
            </select>
          </div>
        </div>

        {/* Toolbar Secondary Row: Sort & Export Actions */}
        <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-secondary font-medium">Sort by:</span>
            <button
              type="button"
              onClick={() => {
                if (sortField === 'score') setSortAsc(!sortAsc);
                else { setSortField('score'); setSortAsc(false); }
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition ${
                sortField === 'score'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-surface border-border text-secondary hover:text-primary'
              }`}
            >
              Score {sortField === 'score' && (sortAsc ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortField === 'name') setSortAsc(!sortAsc);
                else { setSortField('name'); setSortAsc(true); }
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition ${
                sortField === 'name'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-surface border-border text-secondary hover:text-primary'
              }`}
            >
              Name {sortField === 'name' && (sortAsc ? '↑' : '↓')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortField === 'date') setSortAsc(!sortAsc);
                else { setSortField('date'); setSortAsc(false); }
              }}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition ${
                sortField === 'date'
                  ? 'bg-brand/10 border-brand text-brand'
                  : 'bg-surface border-border text-secondary hover:text-primary'
              }`}
            >
              Applied Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
            </button>

            <span className="text-muted ml-2">
              Showing <strong className="text-primary">{filteredApps.length}</strong> candidates
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('xlsx', true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-raised font-bold text-secondary hover:text-primary transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-brand" />
              Export Shortlist (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => handleExport('xlsx', false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-raised font-bold text-secondary hover:text-primary transition shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Export All (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Banner when rows selected */}
      {selectedIds.length > 0 && (
        <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in transition-colors text-primary">
          <div className="font-bold text-primary flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">
              {selectedIds.length}
            </span>
            Candidate(s) selected
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Bulk */}
            <button
              type="button"
              onClick={() => {
                const selected = filteredApps.filter((a) => selectedIds.includes(a.id));
                if (selected.length > 0) {
                  setModalApplications(selected);
                  setActiveModalApp(selected[0]);
                  setIsModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send WhatsApp ({selectedIds.length})
            </button>

            <span className="text-border">|</span>

            {/* Assign HR Dropdown */}
            <div className="flex items-center gap-1.5">
              <label className="text-secondary font-semibold">Assign:</label>
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="rounded-lg border border-border py-1 px-2.5 bg-surface text-primary text-xs font-semibold"
              >
                <option value="auto_split">Auto-Split (Pallavi &amp; Shradha)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={isUpdatingBulk}
                className="px-3 py-1 rounded-lg bg-surface-raised hover:bg-border text-primary font-bold border border-border transition shadow-xs flex items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-brand" />
                Assign
              </button>
            </div>

            <span className="text-border">|</span>

            {/* Status Change Dropdown */}
            <div className="flex items-center gap-1.5">
              <label className="text-secondary font-semibold">Status:</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as ApplicationStatus)}
                className="rounded-lg border border-border py-1 px-2.5 bg-surface text-primary text-xs font-semibold"
              >
                <option value="shortlisted">Shortlisted</option>
                <option value="interview">Interview</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                type="button"
                onClick={handleBulkStatusChange}
                disabled={isUpdatingBulk}
                className="px-3.5 py-1 rounded-lg bg-brand hover:bg-brand-hover text-white font-bold transition shadow-xs"
              >
                {isUpdatingBulk ? 'Updating...' : 'Apply Status'}
              </button>
            </div>

            {isAdmin && (
              <>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={handleTriggerBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.length})
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-muted hover:text-primary underline ml-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Candidates Table */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead className="bg-surface-subtle text-secondary text-left font-semibold">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredApps.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-brand rounded border-border"
                  />
                </th>
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4">Job Role</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Stage &amp; Outcome</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {filteredApps.map((app) => {
                const isSelected = selectedIds.includes(app.id);
                return (
                  <tr
                    key={app.id}
                    className={`hover:bg-surface-hover transition ${isSelected ? 'bg-brand/10' : ''}`}
                  >
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(app.id)}
                        className="w-4 h-4 text-brand rounded border-border"
                      />
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <Link
                        href={`/candidates/${app.id}`}
                        className="font-bold text-primary hover:text-brand block text-sm line-clamp-1 break-words"
                        title={app.candidate?.full_name}
                      >
                        {app.candidate?.full_name || <span className="text-amber-600 dark:text-amber-400 font-semibold">[Name Missing]</span>}
                      </Link>
                      <span className="font-mono text-muted text-[11px] block mt-0.5">
                        {app.candidate?.phone}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-[220px]">
                      <span
                        className="font-medium text-primary block line-clamp-1 break-words"
                        title={app.job?.title}
                      >
                        {app.job?.title}
                      </span>
                      <span
                        className="text-secondary text-[11px] block truncate"
                        title={`${app.job?.city}${app.job?.location ? ` · ${app.job.location}` : ''}`}
                      >
                        {app.job?.city}{app.job?.location ? ` · ${app.job.location}` : ''}
                      </span>
                      {app.job?.min_salary !== undefined ? (
                        <span className="text-muted text-[11px]">
                          ₹{Number(app.job.min_salary).toLocaleString('en-IN')} - ₹{Number(app.job.max_salary).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">—</span>
                      )}
                    </td>

                    {/* Assigned To Column */}
                    <td className="py-3.5 px-4">
                      {app.assigned_to_name ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-raised border border-border text-primary shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          {app.assigned_to_name}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted italic">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-secondary font-medium">
                      {app.form_answers?.current_city || app.candidate?.city || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <ScoreBadge score={app.score} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      {(() => {
                        const s = (app.status || 'new') as ApplicationStatus;
                        const statusStyles: Record<string, string> = {
                          new: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
                          form_sent: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800',
                          replied: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800',
                          shortlisted: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800',
                          interview: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
                          selected: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
                          rejected: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
                        };
                        const cls = statusStyles[s] || statusStyles.new;
                        return (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider ${cls}`}>
                            {String(s).replace(/_/g, ' ')}
                          </span>
                        );
                      })()}
                      {app.call_outcome && (
                        <span className="block text-[10px] font-bold text-secondary">
                          📞 {app.call_outcome.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setModalApplications([app]);
                            setActiveModalApp(app);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 font-semibold shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          WhatsApp
                        </button>

                        <Link
                          href={`/candidates/${app.id}`}
                          className="px-2.5 py-1 rounded-lg text-secondary hover:text-primary bg-surface-hover hover:bg-border border border-border font-semibold transition"
                        >
                          Details
                        </Link>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleSingleDelete(app)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition"
                            title="Delete candidate"
                            aria-label="Delete candidate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No candidates match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        application={activeModalApp}
        applications={modalApplications}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMarkSent={async (appId) => {
          setApplications((prev) =>
            prev.map((a) => (a.id === appId ? { ...a, status: 'form_sent' } : a))
          );
          await fetch('/api/candidates/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationId: appId,
              newStatus: 'form_sent',
              changedBy: currentUser?.name || 'WhatsApp Click Action',
            }),
          });
          setIsModalOpen(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-primary">
                  Delete {candidatesToDelete.length} Candidate{candidatesToDelete.length > 1 ? 's' : ''}
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Are you sure you want to delete {candidatesToDelete.length} candidate{candidatesToDelete.length > 1 ? 's' : ''} and their associated application history?
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

            <div className="p-3 rounded-2xl bg-surface-subtle border border-border text-xs text-muted max-h-32 overflow-y-auto space-y-1">
              {candidatesToDelete.map((c) => (
                <div key={c.id} className="font-semibold text-primary truncate">
                  • {c.name}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted">
              This action can be undone for 10 seconds immediately after deletion.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-border hover:bg-surface-hover text-xs font-semibold text-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Delete Candidates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Second Undo Toast */}
      {undoBackup && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-surface-raised border border-border text-primary shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 font-bold text-xs">
              {undoTimer}s
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">Candidate(s) deleted</p>
              <p className="text-[11px] text-muted truncate">{undoCount} candidate record(s) removed</p>
            </div>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-xs transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
