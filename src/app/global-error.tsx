'use client';

import React from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-2xl">
            !
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Application Error / सिस्टम त्रुटि</h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              A critical error occurred. Your hiring database is intact.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              एक गंभीर त्रुटि हुई। आपका डेटा सुरक्षित है।
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs"
            >
              Reload Application / पुनः लोड करें
            </button>
            <a
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition"
            >
              Dashboard / डैशबोर्ड
            </a>
          </div>

          {error?.message && (
            <p className="text-[10px] text-slate-400 font-mono break-words pt-2 border-t border-slate-700">
              {error.message}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

