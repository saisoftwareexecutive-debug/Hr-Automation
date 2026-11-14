import React from 'react';
import { getApplicationByToken, getCompanySettings } from '@/lib/db';
import { ScreeningFormClient } from './ScreeningFormClient';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { CompanyLogo } from '@/components/CompanyLogo';

export const dynamic = 'force-dynamic';

export default async function PublicScreeningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const application = await getApplicationByToken(token);
  const settings = await getCompanySettings();

  if (!application) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-primary mb-2">Invalid or Expired Link</h1>
          <p className="text-sm text-secondary mb-6 leading-relaxed">
            This screening form link is either invalid or has expired. Please contact the recruitment team at {settings.company_name} directly if you believe this is a mistake.
          </p>
          <div className="text-xs text-muted">
            {settings.company_name} • Powered by HireFlow
          </div>
        </div>
      </div>
    );
  }

  const isExpired = new Date(application.token_expires_at).getTime() < Date.now();
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-border">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-primary mb-2">Form Link Expired</h1>
          <p className="text-sm text-secondary mb-6 leading-relaxed">
            The 7-day validity window for this application link has passed. Please contact {settings.company_name} HR to request a new link.
          </p>
          <div className="text-xs text-muted">
            {settings.company_name} • Powered by HireFlow
          </div>
        </div>
      </div>
    );
  }

  const isAlreadySubmitted = application.status !== 'new' && application.status !== 'form_sent' && !!application.form_answers;

  return (
    <div className="min-h-screen bg-background py-6 sm:py-10 px-4 text-primary">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Top Branding Header */}
        <div className="flex items-center justify-between px-1 gap-3">
          <CompanyLogo
            size="md"
            showText={true}
            companyName={settings.company_name}
            tagline={settings.tagline || 'Recruitment Desk'}
            logoUrl={settings.logo_url}
            accentColor={settings.accent_color}
          />
          <span className="text-[11px] font-bold text-muted bg-surface px-3 py-1.5 rounded-full border border-border shadow-xs flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Official Screening Form
          </span>
        </div>

        {/* Screening Form Container */}
        <ScreeningFormClient
          application={application}
          token={token}
          alreadySubmitted={isAlreadySubmitted}
        />

        {/* Required Footer */}
        <footer className="pt-4 pb-8 text-center text-xs text-muted space-y-1">
          <p className="font-semibold text-secondary">
            {settings.company_name} • India DPDP Act 2023 Verified
          </p>
          <p className="text-[11px] text-muted">
            Powered by HireFlow
          </p>
        </footer>
      </div>
    </div>
  );
}
