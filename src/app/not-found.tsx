import React from 'react';
import Link from 'next/link';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-background text-primary">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-brand/10 text-brand flex items-center justify-center">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div>
          <span className="text-4xl font-black text-brand tracking-tight">404</span>
          <h2 className="text-xl font-black text-primary mt-1">
            Page Not Found / पृष्ठ नहीं मिला
          </h2>
          <p className="text-xs text-secondary mt-2 leading-relaxed">
            The page or candidate record you are looking for does not exist or has been removed.
          </p>
          <p className="text-[11px] text-muted mt-1">
            आप जिस पृष्ठ या उम्मीदवार को खोज रहे हैं वह उपलब्ध नहीं है।
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Dashboard / डैशबोर्ड
          </Link>
          <Link
            href="/candidates"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-secondary hover:text-primary text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Candidates / उम्मीदवार
          </Link>
        </div>
      </div>
    </div>
  );
}

