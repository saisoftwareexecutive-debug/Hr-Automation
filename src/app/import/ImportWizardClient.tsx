'use client';

import React, { useState } from 'react';
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
} from '@/lib/excelParser';
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
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
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
    email: '',
    city: '',
    experienceMonths: '',
    currentSalary: '',
    designation: '',
  });

  // Import Analysis
  const [importResult, setImportResult] = useState<HardenedImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  // Undo and History state
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isUndoingImport, setIsUndoingImport] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  // Process a selected sheet from a workbook
  const processSheet = (
    wb: XLSX.WorkBook,
    sheetName: string,
    targetJob: Job = selectedJob,
    customMap?: ColumnMapping
  ) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;

    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

    const result = parseAndCleanCandidateSheet(
      matrix,
      {},
      sheetName,
      targetJob,
      existingCandidates,
      existingApplications,
      customMap
    );

    setImportResult(result);
    setColumnMapping(result.detectedMapping);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await parseUploadedFile(file);
    // Reset file input value so re-uploading the same file triggers onChange
    e.target.value = '';
  };

  const parseUploadedFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    setImportSuccess(false);
    setUploadError(null);

    try {
      if (file.size === 0) {
        setUploadError('The selected file is empty (0 bytes). Please upload a valid Excel (.xlsx, .xls) or CSV file with candidate rows.');
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
              processSheet(wb, analysis.recommendedSheet, selectedJob);
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
          console.error('Error reading file arrayBuffer:', bufErr);
          setUploadError(`Failed to read file from browser: ${bufErr?.message || bufErr}`);
          setLoading(false);
          return;
        }

        // Validate format signatures for .xlsx and .xls to catch empty or non-Excel files renamed to .xlsx
        const validation = validateSpreadsheetBuffer(buffer, file.name);
        if (!validation.isValid) {
          setUploadError(validation.error || 'Invalid file format.');
          setLoading(false);
          return;
        }

        let wb: XLSX.WorkBook;
        try {
          wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        } catch (readErr: any) {
          console.error('XLSX.read error:', readErr);
          setUploadError(
            `The file "${file.name}" could not be opened as a valid spreadsheet. ` +
            `It appears to be corrupted or not a valid Excel/CSV file. ` +
            `If you renamed an unsupported file to .xlsx, please use an actual Excel or CSV file.`
          );
          setLoading(false);
          return;
        }

        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          setUploadError('The spreadsheet contains no readable sheets or tables.');
          setLoading(false);
          return;
        }

        try {
          const analysis = analyzeWorkbook(wb);
          setWorkbook(wb);
          setWorkbookAnalysis(analysis);
          setSelectedSheetName(analysis.recommendedSheet);
          processSheet(wb, analysis.recommendedSheet, selectedJob);
          setUploadError(null);
        } catch (sheetErr: any) {
          console.error('Sheet analysis error:', sheetErr);
          setUploadError(`Could not read sheet data: ${sheetErr?.message || sheetErr}`);
        } finally {
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadError(`Failed to process file "${file.name}": ${err?.message || err}`);
      setLoading(false);
    }
  };

  // Pre-loaded sample files loader
  const handleLoadSampleFile = async (samplePath: string, displayName: string) => {
    setLoading(true);
    setImportSuccess(false);
    setUploadError(null);
    try {
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: Failed to download sample file`);
      }
      const buffer = await response.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const analysis = analyzeWorkbook(wb);

      setFileName(displayName);
      setWorkbook(wb);
      setWorkbookAnalysis(analysis);
      setSelectedSheetName(analysis.recommendedSheet);
      processSheet(wb, analysis.recommendedSheet, selectedJob);
      setUploadError(null);
    } catch (err: any) {
      console.error('Error loading sample:', err);
      setUploadError(`Could not load sample workbook: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Re-run analysis on sheet change
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheetName(sheetName);
    processSheet(workbook, sheetName, selectedJob);
  };

  // Re-run when mapping changes
  const handleMappingChange = (updatedMapping: ColumnMapping) => {
    setColumnMapping(updatedMapping);
    if (!workbook || !selectedSheetName) return;
    processSheet(workbook, selectedSheetName, selectedJob, updatedMapping);
  };

  // Download rejected and ignored rows
  const handleDownloadRejectedRows = () => {
    if (!importResult) return;
    const wb = buildRejectedRowsWorkbook(importResult.errorRows, importResult.ignoredRows);
    XLSX.writeFile(wb, `rejected_and_ignored_${selectedSheetName}_${Date.now()}.xlsx`);
  };

  // Confirm and save valid imported candidates
  const handleConfirmImport = async () => {
    if (!importResult || importResult.importedApplications.length === 0) return;
    setIsImporting(true);

    try {
      const response = await fetch('/api/candidates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: importResult.importedApplications,
          filename: fileName || 'workindia_import.xlsx',
          jobId: selectedJob?.id,
          jobTitle: selectedJob?.title,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save applications');
      }

      setCurrentBatchId(data.batchId || null);
      setImportSuccess(true);
      toast.success(`Successfully imported ${importResult.importedCount} candidates!`);
    } catch (err: any) {
      console.error('Import save error:', err);
      setUploadError(err.message || 'Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleUndoImport = async (batchIdToUndo?: string) => {
    const id = batchIdToUndo || currentBatchId;
    if (!id) return;
    if (!confirm('Are you sure you want to undo this import? All imported candidates from this batch will be removed.')) return;
    setIsUndoingImport(true);
    try {
      const res = await fetch(`/api/candidates/import?batchId=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to undo import');
      }
      toast.success(`Import undone. Removed ${data.count || 0} candidate(s).`);
      setImportSuccess(false);
      setImportResult(null);
      setCurrentBatchId(null);
      if (showHistoryModal) {
        fetchHistory();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error undoing import');
    } finally {
      setIsUndoingImport(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/candidates/import');
      const data = await res.json();
      if (data.success) {
        setImportBatches(data.batches || []);
      }
    } catch (err) {
      console.error('Error fetching import batches', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header with Import History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            WorkIndia Excel / CSV Import Wizard
          </h1>
          <p className="text-sm text-secondary mt-1">
            Upload applicant export sheets. HireFlow normalizes Indian numbers (+91), removes duplicates, and generates secure screening links.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              fetchHistory();
              setShowHistoryModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-primary font-bold text-xs transition shadow-2xs shrink-0"
          >
            <History className="w-4 h-4 text-brand" /> View Import History
          </button>
        )}
      </div>

      {/* Step 1: Target Job & File Upload */}
      <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
        <div className="grid md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5">
              1. Select Target Job Opening
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                setSelectedJobId(e.target.value);
                const job = jobs.find((j) => j.id === e.target.value);
                if (job && workbook && selectedSheetName) {
                  processSheet(workbook, selectedSheetName, job, columnMapping);
                }
              }}
              className="w-full text-sm rounded-xl border border-border py-3 px-4 bg-input-bg text-primary focus:ring-2 focus:ring-brand font-semibold focus:outline-hidden"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.city}{j.location ? ` · ${j.location}` : ''} ({j.openings} openings)
                </option>
              ))}
            </select>
          </div>

          {/* Quick Test Dataset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleLoadSampleFile('/Sample_Job_Posting.xlsx', 'Sample_Job_Posting.xlsx (Multi-Sheet)')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand bg-brand-subtle border border-brand/30 hover:bg-brand/20 rounded-xl transition shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              Test Multi-Sheet (Sample_Job_Posting.xlsx)
            </button>

            <button
              type="button"
              onClick={() => handleLoadSampleFile('/Candidates_clean_for_import.xlsx', 'Candidates_clean_for_import.xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Test Clean (Candidates_clean_for_import.xlsx)
            </button>
          </div>
        </div>

        {/* On-screen Upload Error Display */}
        {uploadError && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-5 text-rose-950 dark:text-rose-200 flex items-start justify-between gap-4 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">Upload / Parsing Error</h4>
                <p className="text-xs text-rose-800 dark:text-rose-300 mt-1 leading-relaxed whitespace-pre-wrap">{uploadError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:text-rose-900 bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/50 px-3 py-1.5 rounded-xl transition shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Drag and Drop Upload Area */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) {
              await parseUploadedFile(droppedFile);
            }
          }}
          className={clsx(
            "border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer relative",
            isDragging
              ? "border-brand bg-brand-subtle ring-4 ring-brand/20 scale-[1.005]"
              : "border-border hover:border-brand/60 bg-surface-subtle hover:bg-surface-hover"
          )}
        >
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className={clsx(
            "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner transition",
            isDragging ? "bg-brand text-white" : "bg-brand-subtle text-brand"
          )}>
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-primary mb-1">
            {fileName ? fileName : isDragging ? 'Drop your file here...' : 'Drag & drop Excel (.xlsx, .xls) or CSV workbook here'}
          </h3>
          <p className="text-xs text-muted">
            Supports multi-sheet workbooks, automatic candidate sheet detection, header skipping, and phone normalization
          </p>
        </div>
      </div>

      {/* Step 2: Multi-Sheet Selector */}
      {workbookAnalysis && workbookAnalysis.sheetNames.length > 1 && (
        <div className="bg-surface rounded-3xl p-6 border border-border shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" /> Multi-Sheet Workbook Detected
              </h2>
              <p className="text-xs text-muted">
                Found {workbookAnalysis.sheetNames.length} sheets. We auto-selected the sheet matching candidate attributes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-secondary">Active Sheet:</label>
              <select
                value={selectedSheetName}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="text-xs font-bold rounded-xl border border-border py-2 px-3 bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                {workbookAnalysis.sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.rowCount} rows) {s.name === workbookAnalysis.recommendedSheet ? '⭐ [Recommended Candidate List]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Wrong Sheet / Job Description Warning */}
      {importResult && importResult.isWrongSheetOrJobDescription && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-3xl p-6 text-amber-950 dark:text-amber-200 space-y-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                {importResult.wrongSheetMessage || 'This sheet looks like a job description, not a candidate list.'}
              </h3>
              <p className="text-xs text-amber-900/90 dark:text-amber-300 mt-1 leading-relaxed">
                The sheet &quot;<strong>{importResult.sheetName}</strong>&quot; contains job requirements or descriptive labels rather than candidate records. If your workbook contains multiple sheets, select another sheet (like <em>Applicants</em>) using the dropdown above.
              </p>
            </div>
          </div>

          {workbookAnalysis && workbookAnalysis.sheetNames.length > 1 && (
            <div className="pt-2 flex items-center gap-3">
              <span className="text-xs font-semibold">Switch to recommended sheet:</span>
              <button
                type="button"
                onClick={() => handleSheetChange(workbookAnalysis.recommendedSheet)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition shadow-xs"
              >
                Switch to &quot;{workbookAnalysis.recommendedSheet}&quot; &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Column Mapping Section (Only shown if candidate sheet) */}
      {importResult && !importResult.isWrongSheetOrJobDescription && (
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand" /> Header Detection & Smart Column Mapping
              </h2>
              <p className="text-xs text-muted">
                Real header row detected at <strong>Row {importResult.headerRowIndex + 1}</strong>. Verify mapping below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-secondary mb-1">
                Candidate Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={columnMapping.fullName}
                onChange={(e) => handleMappingChange({ ...columnMapping, fullName: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {Object.keys(importResult.detectedMapping).length > 0 &&
                  (workbook?.Sheets[selectedSheetName] ? (
                    XLSX.utils
                      .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                      [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                        const colName = String(h || `Column_${idx + 1}`);
                        return (
                          <option key={colName} value={colName}>
                            {colName}
                          </option>
                        );
                      })
                  ) : null)}
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary mb-1">
                Mobile / Phone <span className="text-rose-500">*</span>
              </label>
              <select
                value={columnMapping.phone}
                onChange={(e) => handleMappingChange({ ...columnMapping, phone: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {workbook?.Sheets[selectedSheetName] &&
                  XLSX.utils
                    .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                    [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                      const colName = String(h || `Column_${idx + 1}`);
                      return (
                        <option key={colName} value={colName}>
                          {colName}
                        </option>
                      );
                    })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary mb-1">Email (Optional)</label>
              <select
                value={columnMapping.email}
                onChange={(e) => handleMappingChange({ ...columnMapping, email: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {workbook?.Sheets[selectedSheetName] &&
                  XLSX.utils
                    .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                    [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                      const colName = String(h || `Column_${idx + 1}`);
                      return (
                        <option key={colName} value={colName}>
                          {colName}
                        </option>
                      );
                    })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary mb-1">City / Location</label>
              <select
                value={columnMapping.city}
                onChange={(e) => handleMappingChange({ ...columnMapping, city: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {workbook?.Sheets[selectedSheetName] &&
                  XLSX.utils
                    .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                    [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                      const colName = String(h || `Column_${idx + 1}`);
                      return (
                        <option key={colName} value={colName}>
                          {colName}
                        </option>
                      );
                    })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary mb-1">Experience (Yrs)</label>
              <select
                value={columnMapping.experienceMonths}
                onChange={(e) => handleMappingChange({ ...columnMapping, experienceMonths: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {workbook?.Sheets[selectedSheetName] &&
                  XLSX.utils
                    .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                    [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                      const colName = String(h || `Column_${idx + 1}`);
                      return (
                        <option key={colName} value={colName}>
                          {colName}
                        </option>
                      );
                    })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary mb-1">Expected Salary / CTC</label>
              <select
                value={columnMapping.currentSalary}
                onChange={(e) => handleMappingChange({ ...columnMapping, currentSalary: e.target.value })}
                className="w-full text-xs rounded-xl border border-border p-2.5 bg-input-bg text-primary font-medium focus:ring-2 focus:ring-brand focus:outline-hidden"
              >
                <option value="">Select column...</option>
                {workbook?.Sheets[selectedSheetName] &&
                  XLSX.utils
                    .sheet_to_json<any[]>(workbook.Sheets[selectedSheetName], { header: 1 })
                    [importResult.headerRowIndex]?.map((h: any, idx: number) => {
                      const colName = String(h || `Column_${idx + 1}`);
                      return (
                        <option key={colName} value={colName}>
                          {colName}
                        </option>
                      );
                    })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards & Preview (Only shown if candidate sheet) */}
      {importResult && !importResult.isWrongSheetOrJobDescription && (
        <div className="space-y-6">
          {/* Summary Badges Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-surface p-4 rounded-2xl border border-border">
              <span className="text-xs font-bold text-muted uppercase">Total Rows Read</span>
              <div className="text-2xl font-black text-primary mt-1">{importResult.totalRowsInSheet}</div>
              <span className="text-[11px] text-muted">Sheet: {importResult.sheetName}</span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Ready to Import</span>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">{importResult.importedCount}</div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Cleaned &amp; Valid</span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Duplicates Filtered</span>
              <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">{importResult.duplicateCount}</div>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">In file or job</span>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/40 p-4 rounded-2xl border border-rose-200 dark:border-rose-800">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Invalid Numbers</span>
              <div className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1">{importResult.invalidNumbersCount}</div>
              <span className="text-[11px] text-rose-700 dark:text-rose-400">Malformed digits</span>
            </div>

            <div className="bg-surface-raised p-4 rounded-2xl border border-border">
              <span className="text-xs font-bold text-secondary uppercase">Ignored Rows</span>
              <div className="text-2xl font-black text-primary mt-1">{importResult.ignoredCount}</div>
              <span className="text-[11px] text-muted">Summary / Notes / Blanks</span>
            </div>
          </div>

          {/* Action Row: Download Rejected & Ignored Rows */}
          {(importResult.errorRows.length > 0 || importResult.ignoredRows.length > 0) && (
            <div className="flex items-center justify-between p-4 bg-surface-subtle border border-border rounded-2xl text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <HelpCircle className="w-4 h-4 text-muted" />
                <span>
                  {importResult.ignoredCount} non-candidate rows skipped (summaries, formulas, blank lines) and {importResult.errorRows.length} rejected.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadRejectedRows}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-secondary font-bold transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-muted" />
                Download Rejected &amp; Ignored Rows (.xlsx)
              </button>
            </div>
          )}

          {/* Ignored Rows List (Accordion / Viewer) */}
          {importResult.ignoredRows.length > 0 && (
            <div className="bg-surface-subtle border border-border rounded-2xl p-4 text-xs space-y-2">
              <span className="font-bold text-primary uppercase tracking-wider text-[11px] block">
                Automatically Ignored Rows ({importResult.ignoredRows.length})
              </span>
              <div className="grid sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {importResult.ignoredRows.map((r, i) => (
                  <div key={i} className="p-2 bg-surface rounded-lg border border-border text-secondary">
                    <span className="font-bold text-primary">Row {r.rowNumber}:</span> {r.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cleaned Candidates Preview Table */}
          <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 bg-surface-subtle border-b border-border flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-secondary">
                Valid Candidates to Import ({importResult.importedApplications.length})
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                ✓ Indian phones normalized to +91 E.164
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-surface-subtle text-muted text-left font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Candidate Name</th>
                    <th className="py-2.5 px-4">Cleaned Phone (+91)</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">City</th>
                    <th className="py-2.5 px-4">Experience</th>
                    <th className="py-2.5 px-4">Form Link Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {importResult.importedApplications.map((app, idx) => (
                    <tr key={idx} className="hover:bg-surface-hover transition">
                      <td className="py-3 px-4 font-bold text-primary">
                        {app.candidate?.full_name}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        {app.candidate?.phone}
                      </td>
                      <td className="py-3 px-4 text-muted">{app.candidate?.email || '—'}</td>
                      <td className="py-3 px-4 text-secondary">{app.candidate?.city || '—'}</td>
                      <td className="py-3 px-4 text-secondary">
                        {app.candidate?.total_experience_months
                          ? `${(app.candidate.total_experience_months / 12).toFixed(1)} yrs`
                          : '0 yrs'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted">
                        /apply/{app.token.substring(0, 10)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm & Save Button */}
          {!importSuccess ? (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || importResult.importedApplications.length === 0}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-xs transition transform active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isImporting
                  ? 'Saving to Database...'
                  : `Confirm & Import ${importResult.importedCount} Candidates`}
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-100">
                Successfully Imported {importResult.importedCount} Candidates!
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
                All candidates have been added to the pipeline for <strong>{selectedJob?.title}</strong>, assigned secure 7-day screening tokens, and ready for WhatsApp screening link dispatch.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href={`/pipeline?job=${selectedJobId}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition"
                >
                  View Kanban Pipeline <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/candidates?job=${selectedJobId}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-secondary bg-surface border border-border hover:bg-surface-hover rounded-xl transition"
                >
                  View Candidate Table
                </Link>
                {isAdmin && currentBatchId && (
                  <button
                    type="button"
                    onClick={() => handleUndoImport()}
                    disabled={isUndoingImport}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isUndoingImport ? 'Undoing...' : 'Undo This Import'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-3xl max-w-2xl w-full shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-primary flex items-center gap-2">
                <History className="w-5 h-5 text-brand" /> WorkIndia Import History
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-muted hover:text-primary p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-secondary">
              Review recent candidate import batches. Admins can safely undo any batch to remove all candidates associated with it.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2 pt-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-muted">Loading import history...</div>
              ) : importBatches.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">No import batches recorded yet.</div>
              ) : (
                importBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="p-3.5 rounded-2xl bg-surface-subtle border border-border flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary truncate">{batch.filename}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-subtle text-brand">
                          {batch.candidate_count} candidates
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 truncate">
                        Job: {batch.job_title} • Imported by {batch.imported_by} on{' '}
                        {new Date(batch.imported_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleUndoImport(batch.id)}
                        disabled={isUndoingImport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Undo Batch
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-border">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
