'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Application, Candidate, Job, ImportBatch } from '@/types';
import {
  analyzeWorkbook,
  parseAndCleanCandidateSheet,
  buildRejectedRowsWorkbook,
  validateSpreadsheetBuffer,
  WorkbookAnalysis,
  HardenedImportResult,
  ColumnMapping,
  JobGroupMatch,
} from '@/lib/excelParser';
import { JobDetailsCard } from '@/components/JobDetailsCard';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  Sparkles,
  Download,
  AlertTriangle,
  RefreshCw,
  Layers,
  HelpCircle,
  FileText,
  RotateCcw,
  History,
  Trash2,
  X,
  Send,
  ShieldCheck,
  Check,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import { useToast } from '@/components/ToastProvider';

interface ImportWizardClientProps {
  jobs: Job[];
  existingCandidates: Candidate[];
  existingApplications: Application[];
  userRole?: string;
}

export function ImportWizardClient({
  jobs,
  existingCandidates,
  existingApplications,
  userRole = 'hr_executive',
}: ImportWizardClientProps) {
  const { toast } = useToast();
  const isAdmin = userRole === 'admin';

  // Active jobs only for assignment
  const activeJobs = jobs.filter((j) => j.status !== 'closed');
  const [selectedJobId, setSelectedJobId] = useState<string>(activeJobs[0]?.id || jobs[0]?.id || '');
  const [jobMode, setJobMode] = useState<'all_one_job' | 'read_from_excel'>('all_one_job');

  // Excel workbook & sheet state
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [workbookAnalysis, setWorkbookAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Column Mapping state
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    city: '',
    experienceMonths: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    qualification: '',
    skills: '',
    designation: '',
    jobTitle: '',
  });

  // Job group overrides for "read_from_excel" mode: excelText -> jobId or '__skip__'
  const [jobGroupOverrides, setJobGroupOverrides] = useState<Record<string, string>>({});

  // Import Analysis
  const [importResult, setImportResult] = useState<HardenedImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [createdBatch, setCreatedBatch] = useState<ImportBatch | null>(null);
  const [lastImportPerJobCounts, setLastImportPerJobCounts] = useState<Record<string, number>>({});

  // History state
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isUndoingImport, setIsUndoingImport] = useState<boolean>(false);
  const [batchToUndo, setBatchToUndo] = useState<ImportBatch | null>(null);
  const [showUndoModal, setShowUndoModal] = useState<boolean>(false);

  const selectedJob = activeJobs.find((j) => j.id === selectedJobId) || activeJobs[0] || jobs[0];

  // Load import history on mount
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/candidates/import');
      const data = await res.json();
      if (data.success && Array.isArray(data.batches)) {
        setImportBatches(data.batches);
      }
    } catch (err) {
      console.warn('Failed to fetch import batches:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Re-run parsing whenever sheet, jobMode, selectedJobId, columnMapping, or jobGroupOverrides change
  const runParser = (
    wb: XLSX.WorkBook,
    sheetName: string,
    currentJobMode = jobMode,
    currentJobId = selectedJobId,
    currentOverrides = jobGroupOverrides,
    currentMap?: ColumnMapping
  ) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;

    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    const targetJob = activeJobs.find((j) => j.id === currentJobId) || activeJobs[0] || jobs[0];

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      sheetName,
      {
        jobMode: currentJobMode,
        targetJob,
        activeJobs,
        jobGroupOverrides: currentOverrides,
        customMapping:
          currentMap || (Object.values(columnMapping).some(Boolean) ? columnMapping : undefined),
      },
      existingCandidates,
      existingApplications
    );

    setImportResult(result);
    setColumnMapping(result.detectedMapping);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await parseUploadedFile(file);
    e.target.value = '';
  };

  const parseUploadedFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    setImportSuccess(false);
    setUploadError(null);
    setCreatedBatch(null);
    setColumnMapping({
      fullName: '',
      phone: '',
      altPhone: '',
      email: '',
      city: '',
      experienceMonths: '',
      currentSalary: '',
      expectedSalary: '',
      noticePeriod: '',
      qualification: '',
      skills: '',
      designation: '',
    });

    try {
      if (file.size === 0) {
        setUploadError('The selected file is empty (0 bytes). Please upload a valid Excel or CSV file.');
        setLoading(false);
        return;
      }

      const isCsv = file.name.toLowerCase().endsWith('.csv');

      if (isCsv) {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: false,
          encoding: 'UTF-8',
          complete: (results) => {
            try {
              if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
                setUploadError(`Failed to parse CSV file: ${results.errors[0]?.message || 'Unknown CSV format error'}`);
                setLoading(false);
                return;
              }

              const matrix = (results.data as any[][]) || [];
              if (matrix.length === 0) {
                setUploadError('The CSV file contains no readable data rows. Please check your file.');
                setLoading(false);
                return;
              }

              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.aoa_to_sheet(matrix);
              XLSX.utils.book_append_sheet(wb, ws, 'CSV Data');

              const analysis = analyzeWorkbook(wb);
              setWorkbook(wb);
              setWorkbookAnalysis(analysis);
              setSelectedSheetName(analysis.recommendedSheet);
              setJobGroupOverrides({});
              runParser(wb, analysis.recommendedSheet, jobMode, selectedJobId, {});
              setUploadError(null);
            } catch (innerErr: any) {
              console.error('CSV processing error:', innerErr);
              setUploadError(`Could not process CSV sheet: ${innerErr?.message || innerErr}`);
            } finally {
              setLoading(false);
            }
          },
          error: (err) => {
            console.error('Papa Parse CSV error:', err);
            setUploadError(`Could not read CSV file: ${err.message}`);
            setLoading(false);
          },
        });
      } else {
        let buffer: ArrayBuffer;
        try {
          buffer = await file.arrayBuffer();
        } catch (bufErr: any) {
          setUploadError(`Failed to read file: ${bufErr?.message || bufErr}`);
          setLoading(false);
          return;
        }

        const validation = validateSpreadsheetBuffer(buffer, file.name);
        if (!validation.isValid) {
          setUploadError(validation.error || 'Invalid file format.');
          setLoading(false);
          return;
        }

        let wb: XLSX.WorkBook;
        try {
          wb = XLSX.read(buffer, { type: 'array' });
        } catch (readErr: any) {
          setUploadError(`Could not parse Excel spreadsheet: ${readErr?.message || readErr}`);
          setLoading(false);
          return;
        }

        const analysis = analyzeWorkbook(wb);
        setWorkbook(wb);
        setWorkbookAnalysis(analysis);
        setSelectedSheetName(analysis.recommendedSheet);
        setJobGroupOverrides({});
        runParser(wb, analysis.recommendedSheet, jobMode, selectedJobId, {});
        setUploadError(null);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('General upload error:', err);
      setUploadError(`Upload failed: ${err.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  // Change job mode
  const handleJobModeChange = (newMode: 'all_one_job' | 'read_from_excel') => {
    setJobMode(newMode);
    if (workbook && selectedSheetName) {
      runParser(workbook, selectedSheetName, newMode, selectedJobId, jobGroupOverrides);
    }
  };

  // Change selected job in "all_one_job" mode
  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (workbook && selectedSheetName) {
      runParser(workbook, selectedSheetName, jobMode, jobId, jobGroupOverrides);
    }
  };

  // Change a job group match in "read_from_excel" mode
  const handleJobGroupChange = (excelText: string, targetJobId: string) => {
    const updated = { ...jobGroupOverrides, [excelText]: targetJobId };
    setJobGroupOverrides(updated);
    if (workbook && selectedSheetName) {
      runParser(workbook, selectedSheetName, jobMode, selectedJobId, updated);
    }
  };

  // Change column mapping
  const handleColumnMapChange = (field: keyof ColumnMapping, header: string) => {
    const updated = { ...columnMapping, [field]: header };
    setColumnMapping(updated);
    if (workbook && selectedSheetName) {
      runParser(workbook, selectedSheetName, jobMode, selectedJobId, jobGroupOverrides, updated);
    }
  };

  // Check if import is blocked due to unmatched job groups
  const hasUnmatchedJobGroups =
    jobMode === 'read_from_excel' &&
    importResult?.jobColumnDetected &&
    importResult?.jobGroups.some((g) => !g.matchedJobId);

  // Confirm and Import
  const handleConfirmImport = async () => {
    if (!importResult || importResult.importedApplications.length === 0) return;
    if (hasUnmatchedJobGroups) {
      toast.error('Please assign or skip all job groups before importing.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/candidates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: importResult.importedApplications,
          filename: fileName,
          jobId: jobMode === 'all_one_job' ? selectedJobId : undefined,
          jobTitle: jobMode === 'all_one_job' ? selectedJob?.title : undefined,
          perJobCounts: importResult.perJobCounts,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save imported candidates');
      }

      setImportSuccess(true);
      setCreatedBatch(data.batch || null);
      setLastImportPerJobCounts(data.perJobCounts || importResult.perJobCounts);
      toast.success(`Successfully imported ${data.count} candidate application(s)!`);
      loadBatches();
    } catch (err: any) {
      console.error('Import save error:', err);
      toast.error(err.message || 'Error saving candidates to database');
    } finally {
      setIsImporting(false);
    }
  };

  // Download rejected rows
  const handleDownloadRejectedRows = () => {
    if (!importResult) return;
    const wb = buildRejectedRowsWorkbook(importResult.errorRows, importResult.ignoredRows);
    XLSX.writeFile(wb, `Import_Issues_${fileName.replace(/\.[^/.]+$/, '')}.xlsx`);
  };

  // Undo Import
  const triggerUndoPrompt = (batch: ImportBatch) => {
    setBatchToUndo(batch);
    setShowUndoModal(true);
  };

  const handleConfirmUndo = async () => {
    if (!batchToUndo) return;
    setIsUndoingImport(true);
    try {
      const res = await fetch(`/api/candidates/import?batchId=${batchToUndo.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to undo import batch');
      }

      toast.success(data.message || 'Import batch undone successfully.');
      setShowUndoModal(false);
      setBatchToUndo(null);
      if (createdBatch?.id === batchToUndo.id) {
        setImportSuccess(false);
        setCreatedBatch(null);
      }
      loadBatches();
    } catch (err: any) {
      console.error('Undo error:', err);
      toast.error(err.message || 'Failed to undo import');
    } finally {
      setIsUndoingImport(false);
    }
  };

  // Primary job ID for navigation from success card
  const primaryJobId =
    jobMode === 'all_one_job'
      ? selectedJobId
      : importResult?.importedApplications[0]?.job_id || selectedJobId;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
            WorkIndia Excel &amp; CSV Candidate Import
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Auto-detects sheets, headers, Multi-Job routing, experience &amp; salary parsing, with fair-hiring protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-raised font-bold text-xs text-secondary hover:text-primary transition shadow-2xs"
          >
            <Briefcase className="w-3.5 h-3.5 text-brand" /> Manage Jobs
          </Link>
          <a
            href="#import-history"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-raised font-bold text-xs text-secondary hover:text-primary transition shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-brand" /> Past Batches ({importBatches.length})
          </a>
        </div>
      </div>

      {/* MODE SWITCHER */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-black uppercase tracking-wider text-muted">Import Destination Mode</span>
            <p className="text-xs text-secondary">
              Choose whether all candidate rows belong to one job or should be matched from the spreadsheet column.
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-surface-subtle border border-border shrink-0">
            <button
              type="button"
              onClick={() => handleJobModeChange('all_one_job')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-bold rounded-lg transition',
                jobMode === 'all_one_job'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-secondary hover:text-primary'
              )}
            >
              All rows go to one job
            </button>
            <button
              type="button"
              onClick={() => handleJobModeChange('read_from_excel')}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-bold rounded-lg transition',
                jobMode === 'read_from_excel'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-secondary hover:text-primary'
              )}
            >
              Read the job from my Excel column
            </button>
          </div>
        </div>

        {/* In 'all_one_job' mode: Job Dropdown & Details Card */}
        {jobMode === 'all_one_job' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="import-single-job" className="text-xs font-bold text-primary shrink-0">
                Target Active Job:
              </label>
              <select
                id="import-single-job"
                value={selectedJobId}
                onChange={(e) => handleSelectJob(e.target.value)}
                className="w-full sm:max-w-md rounded-xl border border-border py-2 px-3 bg-surface text-primary text-xs font-semibold focus:ring-2 focus:ring-brand"
              >
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} • {j.city} ({j.department})
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && <JobDetailsCard job={selectedJob} defaultExpanded={false} />}
          </div>
        )}
      </div>

      {/* DRAG & DROP UPLOAD BOX */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) parseUploadedFile(file);
        }}
        className={clsx(
          'relative border-2 border-dashed rounded-3xl p-8 text-center transition-all bg-surface/50 backdrop-blur-xs',
          isDragging
            ? 'border-brand bg-brand/5 scale-[1.005]'
            : 'border-border hover:border-brand/50 hover:bg-surface-raised'
        )}
      >
        <input
          type="file"
          id="spreadsheet-file-upload"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={loading}
        />

        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shadow-inner">
            {loading ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-primary">
              {fileName ? fileName : 'Choose or drop your WorkIndia Excel or CSV file here'}
            </h3>
            <p className="text-xs text-secondary">
              Supports .xlsx, .xls, and UTF-8 CSV exports. Maximum speed, zero data leakage.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-surface-subtle border border-border text-secondary">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Click to Browse Files
          </span>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold">Upload Error</p>
            <p>{uploadError}</p>
          </div>
        </div>
      )}

      {/* FAIR HIRING NOTICE */}
      {importResult && importResult.ignoredFairHiringColumns.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-brand/5 border border-brand/20 flex items-start gap-3 text-xs text-primary animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold">Fair Hiring Protection Active:</span> Ignored non-job criteria{' '}
            <strong>({importResult.ignoredFairHiringColumns.join(', ')})</strong>. These columns are never stored,
            scored, or visible to preserve bias-free hiring.
          </div>
        </div>
      )}

      {/* SHEET SELECTOR */}
      {workbookAnalysis && workbookAnalysis.sheetNames.length > 1 && (
        <div className="p-4 rounded-2xl bg-surface border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand" /> Multiple Sheets Detected ({workbookAnalysis.sheetNames.length})
            </span>
            <span className="text-[11px] text-muted">
              Auto-selected: <strong>{workbookAnalysis.recommendedSheet}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {workbookAnalysis.sheets.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setSelectedSheetName(s.name);
                  if (workbook) runParser(workbook, s.name);
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5',
                  selectedSheetName === s.name
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-surface-subtle hover:bg-surface-raised border border-border text-secondary'
                )}
              >
                {s.name}
                <span className="text-[10px] opacity-75">({s.rowCount} rows)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* JOB MATCHING TABLE (in 'read_from_excel' mode) */}
      {jobMode === 'read_from_excel' && importResult && (
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-brand" /> Excel Job Matching Table
              </span>
              <p className="text-xs text-secondary">
                Each distinct role in your spreadsheet must match an active job or be explicitly skipped.
              </p>
            </div>
            {hasUnmatchedJobGroups && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Action required
              </span>
            )}
          </div>

          {!importResult.jobColumnDetected ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
              No job title column was detected in your file. Please select a Job column under Smart Column Mapping below,
              or switch back to &ldquo;All rows go to one job&rdquo;.
            </div>
          ) : importResult.jobGroups.length === 0 ? (
            <div className="text-xs text-muted py-2">No distinct job rows found.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-surface-subtle font-bold text-secondary text-left">
                  <tr>
                    <th className="py-2.5 px-3">Excel Job Text</th>
                    <th className="py-2.5 px-3 w-20">Rows</th>
                    <th className="py-2.5 px-3">Matched Active Job</th>
                    <th className="py-2.5 px-3 w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {importResult.jobGroups.map((group) => {
                    const isSkipped = group.matchedJobId === '__skip__';
                    const isMatched = Boolean(group.matchedJobId && !isSkipped);
                    const matchedJob = activeJobs.find((j) => j.id === group.matchedJobId);

                    return (
                      <tr key={group.excelText} className="hover:bg-surface-subtle/50 transition">
                        <td className="py-2.5 px-3 font-bold text-primary">{group.excelText}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle border border-border">
                            {group.rowCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={group.matchedJobId || ''}
                            onChange={(e) => handleJobGroupChange(group.excelText, e.target.value)}
                            className={clsx(
                              'w-full max-w-sm rounded-lg border py-1.5 px-2.5 text-xs font-semibold bg-surface',
                              !group.matchedJobId
                                ? 'border-amber-400 dark:border-amber-600 bg-amber-500/5 text-amber-900 dark:text-amber-200'
                                : 'border-border text-primary'
                            )}
                          >
                            <option value="">— Choose a job —</option>
                            {activeJobs.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.title} ({j.city})
                              </option>
                            ))}
                            <option value="__skip__">🚫 Skip these rows (do not import)</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          {isSkipped ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-subtle text-muted border border-border">
                              Skipped
                            </span>
                          ) : isMatched ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" />
                              {group.method === 'exact'
                                ? 'Exact'
                                : group.method === 'manual'
                                ? 'Manual'
                                : 'Auto-match'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Choose a job
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HEADER DETECTION & SMART COLUMN MAPPING */}
      {importResult && (
        <details className="rounded-2xl border border-border bg-surface shadow-2xs overflow-hidden group">
          <summary className="p-3.5 bg-surface-subtle hover:bg-surface-raised cursor-pointer flex items-center justify-between text-xs font-bold text-primary transition select-none">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand" /> Header Detection &amp; Smart Column Mapping
            </span>
            <span className="text-[11px] text-muted group-open:hidden">Click to review or customize mapped columns</span>
          </summary>
          <div className="p-4 border-t border-border space-y-3 text-xs bg-surface">
            <p className="text-secondary">
              Review how spreadsheet headers map to candidate properties. You can re-assign any column manually:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Candidate Name *', key: 'fullName' as const },
                { label: 'Primary Phone *', key: 'phone' as const },
                { label: 'Alternate Phone', key: 'altPhone' as const },
                { label: 'Email Address', key: 'email' as const },
                { label: 'City / Location', key: 'city' as const },
                { label: 'Job Role / Title', key: 'jobTitle' as const },
                { label: 'Total Experience', key: 'experienceMonths' as const },
                { label: 'Current Salary', key: 'currentSalary' as const },
                { label: 'Expected Salary', key: 'expectedSalary' as const },
                { label: 'Notice Period', key: 'noticePeriod' as const },
                { label: 'Qualification', key: 'qualification' as const },
                { label: 'Designation / Company', key: 'designation' as const },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[11px] font-bold text-secondary">{label}</label>
                  <select
                    value={columnMapping[key] || ''}
                    onChange={(e) => handleColumnMapChange(key, e.target.value)}
                    className="w-full text-xs rounded-xl border border-border py-1.5 px-2 bg-surface text-primary font-medium"
                  >
                    <option value="">(Not Mapped)</option>
                    {importResult.detectedMapping &&
                      (workbookAnalysis?.sheets.find((s) => s.name === selectedSheetName)?.detectedHeaders || []).map(
                        (h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        )
                      )}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* PREVIEW & CANDIDATE ROWS TABLE */}
      {importResult && (
        <div className="space-y-4">
          {/* Counts & Summary Header */}
          <div className="p-4 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-extrabold text-primary text-sm flex items-center gap-2">
                Candidate Import Preview
              </span>
              <p className="text-secondary font-medium">{importResult.summaryText}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(importResult.errorRows.length > 0 || importResult.ignoredRows.length > 0) && (
                <button
                  type="button"
                  onClick={handleDownloadRejectedRows}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-raised font-bold text-xs text-secondary hover:text-primary transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-brand" />
                  Download Skipped Rows ({importResult.errorRows.length + importResult.ignoredRows.length})
                </button>
              )}
            </div>
          </div>

          {/* Candidate Preview Table */}
          <div className="border border-border rounded-2xl bg-surface shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-surface-subtle font-bold text-secondary text-left sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 w-10">#</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">City</th>
                    <th className="py-3 px-3">Experience (raw / parsed)</th>
                    <th className="py-3 px-3">Salary (Current / Exp)</th>
                    <th className="py-3 px-3">Job Target</th>
                    <th className="py-3 px-3">Import Result</th>
                    <th className="py-3 px-3">Form Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {importResult.rowPreviews.map((row) => (
                    <tr key={row.rowNumber} className="hover:bg-surface-subtle/50 transition">
                      <td className="py-2.5 px-3 text-muted font-mono">{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-primary">{row.name}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {row.isValidPhone ? (
                          <span className="text-primary">{row.phone}</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-bold" title={row.phoneError}>
                            {row.phone}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-secondary">{row.city}</td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <span className={clsx('font-semibold', !row.isExperienceValid && 'text-amber-600 dark:text-amber-400')}>
                            {row.experienceDisplay}
                          </span>
                          {row.rawExperience && row.rawExperience !== row.experienceDisplay && (
                            <span className="block text-[10px] text-muted truncate max-w-[120px]">
                              raw: &ldquo;{row.rawExperience}&rdquo;
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-primary">{row.salaryDisplay}</span>
                          {row.expectedSalaryDisplay && row.expectedSalaryDisplay !== '—' && (
                            <span className="block text-[10px] text-muted">exp: {row.expectedSalaryDisplay}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-primary truncate max-w-[140px] block">
                          {row.targetJobTitle}
                        </span>
                        {row.rawJobText && row.rawJobText !== row.targetJobTitle && (
                          <span className="text-[10px] text-muted truncate max-w-[140px] block">
                            from excel: {row.rawJobText}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block whitespace-nowrap',
                            row.resultBadgeColor === 'emerald' &&
                              'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
                            row.resultBadgeColor === 'blue' &&
                              'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                            row.resultBadgeColor === 'amber' &&
                              'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                            row.resultBadgeColor === 'rose' &&
                              'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
                            row.resultBadgeColor === 'muted' &&
                              'bg-surface-subtle text-muted border-border'
                          )}
                        >
                          {row.resultBadgeText}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted">
                        {row.applicationToken ? (
                          <span className="truncate block max-w-[80px]" title={row.formLink}>
                            {row.applicationToken.slice(0, 8)}...
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CONFIRM / SUCCESS CARD */}
          {!importSuccess ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border shadow-2xs">
              <div className="text-xs text-secondary">
                Ready to import <strong>{importResult.importedCount}</strong> valid applications (
                {importResult.newCandidatesCount} new candidates, {importResult.newApplicationsCount} existing candidates).
              </div>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || importResult.importedApplications.length === 0 || hasUnmatchedJobGroups}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition transform active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isImporting
                  ? 'Saving Applications...'
                  : `Confirm & Import ${importResult.importedCount} Candidates`}
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-100">
                  Import Completed Successfully!
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  {Object.entries(lastImportPerJobCounts).length > 0 ? (
                    <span>
                      Imported{' '}
                      {Object.entries(lastImportPerJobCounts)
                        .map(([t, c]) => `${c} candidates for ${t}`)
                        .join(' and ')}
                      .
                    </span>
                  ) : (
                    <span>Imported {importResult.importedCount} candidates into pipeline.</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href={`/pipeline?job=${primaryJobId}${createdBatch ? `&batch=${createdBatch.id}` : ''}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition"
                >
                  Open in Pipeline <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/candidates${createdBatch ? `?batch=${createdBatch.id}` : ''}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-secondary bg-surface border border-border hover:bg-surface-hover rounded-xl transition"
                >
                  Open Candidates
                </Link>
                <Link
                  href={`/batch-send?job=${primaryJobId}&mode=screening`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
                >
                  <Send className="w-4 h-4" /> Send forms (Batch Send)
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setImportSuccess(false);
                    setFileName('');
                    setWorkbook(null);
                    setImportResult(null);
                    setCreatedBatch(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-secondary bg-surface border border-border hover:bg-surface-raised rounded-xl transition"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IMPORT HISTORY SECTION */}
      <div id="import-history" className="bg-surface rounded-2xl border border-border p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-brand" /> WorkIndia Import History
            </h3>
            <p className="text-xs text-secondary">
              Past import batches recorded in the database. Admins can safely undo a batch.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBatches}
            disabled={loadingHistory}
            className="p-1.5 text-muted hover:text-primary rounded-lg border border-border hover:bg-surface-raised transition"
            title="Refresh history"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loadingHistory && 'animate-spin')} />
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-muted">Loading import history...</div>
          ) : importBatches.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">No import batches recorded yet.</div>
          ) : (
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-surface-subtle font-bold text-secondary text-left">
                <tr>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">File Name</th>
                  <th className="py-2.5 px-3">Imported By</th>
                  <th className="py-2.5 px-3">Job(s)</th>
                  <th className="py-2.5 px-3">Count</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {importBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-surface-subtle/50 transition">
                    <td className="py-2.5 px-3 text-secondary whitespace-nowrap">
                      {new Date(batch.imported_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-primary truncate max-w-[180px]">
                      {batch.filename}
                    </td>
                    <td className="py-2.5 px-3 text-secondary">{batch.imported_by}</td>
                    <td className="py-2.5 px-3 text-primary font-medium truncate max-w-[200px]">
                      {batch.job_title}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand">
                        {batch.candidate_count}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        href={`/candidates?batch=${batch.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-raised font-bold text-[11px] text-secondary hover:text-primary transition"
                      >
                        View Candidates
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => triggerUndoPrompt(batch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-[11px] transition"
                        >
                          <Trash2 className="w-3 h-3" /> Undo Import
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CONFIRM UNDO MODAL */}
      {showUndoModal && batchToUndo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-3xl max-w-md w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-primary">Undo Import Batch?</h3>
            </div>

            <div className="space-y-2 text-xs text-secondary leading-relaxed">
              <p>
                You are about to undo the import of{' '}
                <strong className="text-primary">{batchToUndo.filename}</strong> (
                {batchToUndo.candidate_count} candidates for {batchToUndo.job_title}).
              </p>
              <p className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                ⚠️ <strong>Safety Guard:</strong> This will remove only the new applications and candidates created
                by this batch. Any older records or candidate history from prior imports remain completely intact.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowUndoModal(false);
                  setBatchToUndo(null);
                }}
                disabled={isUndoingImport}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-secondary hover:text-primary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndo}
                disabled={isUndoingImport}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {isUndoingImport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isUndoingImport ? 'Undoing...' : 'Confirm Undo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
