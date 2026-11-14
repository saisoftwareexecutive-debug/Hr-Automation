'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    // Log error to client-side logging API
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Unknown error',
          stack: error?.stack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        }),
      })
        .then(() => setReported(true))
        .catch(() => {});
    } catch {
      // Ignore network errors during logging
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-background text-primary">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">
            Something Went Wrong / कुछ गड़बड़ हुई
          </h2>
          <p className="text-xs text-secondary mt-1.5 leading-relaxed">
            An unexpected error occurred while loading this view. Your saved hiring data remains secure and untouched.
          </p>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            इस पृष्ठ को लोड करते समय एक अनपेक्षित त्रुटि हुई। आपका डेटा सुरक्षित है।
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again / पुनः प्रयास करें
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-secondary hover:text-primary text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard / डैशबोर्ड
          </Link>
        </div>

        {reported && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            ✓ Error diagnostics automatically reported to system health
          </p>
        )}

        <div className="pt-3 border-t border-border text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] text-muted hover:text-primary font-semibold flex items-center gap-1 mx-auto"
          >
            {showDetails ? 'Hide technical details' : 'Show technical details'}
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showDetails && (
            <div className="mt-3 p-3 rounded-xl bg-surface-subtle border border-border text-[11px] font-mono text-muted space-y-1.5 overflow-x-auto max-h-48 overflow-y-auto">
              <div className="font-bold text-rose-500 break-words">
                {error?.message || 'Error details unavailable'}
              </div>
              {error?.digest && (
                <div>Digest: <span className="text-secondary">{error.digest}</span></div>
              )}
              {error?.stack && (
                <pre className="text-[10px] text-secondary whitespace-pre-wrap break-all mt-1">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

