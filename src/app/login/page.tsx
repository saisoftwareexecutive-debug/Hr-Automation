'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, Globe, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { CompanyLogo } from '@/components/CompanyLogo';
import { BUILD_STAMP } from '@/lib/version';
import { COMPANY_NAME } from '@/lib/brand';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectTarget = searchParams.get('redirect') || '/';
  const reason = searchParams.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (reason === 'timeout') {
      setError(
        language === 'en'
          ? 'Your session expired due to 30 minutes of inactivity. Please log in again.'
          : '30 मिनट की निष्क्रियता के कारण आपका सत्र समाप्त हो गया। कृपया पुनः लॉगिन करें।'
      );
    }
  }, [reason, language]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      toast.success(
        language === 'en'
          ? `Welcome back, ${data.user.full_name}!`
          : `स्वागत है, ${data.user.full_name}!`
      );

      // Return user to the requested page
      router.push(redirectTarget);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-background text-primary transition-colors">
      {/* Language Switcher Pill */}
      <div className="mb-4 flex items-center gap-1.5 p-1 bg-surface rounded-full border border-border shadow-xs text-xs font-bold">
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full transition ${
            language === 'en'
              ? 'bg-brand text-white shadow-xs'
              : 'text-secondary hover:text-primary'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLanguage('hi')}
          className={`px-3 py-1 rounded-full transition ${
            language === 'hi'
              ? 'bg-brand text-white shadow-xs'
              : 'text-secondary hover:text-primary'
          }`}
        >
          हिंदी (Hindi)
        </button>
      </div>

      <div className="max-w-md w-full bg-surface rounded-3xl p-8 sm:p-10 border border-border shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <CompanyLogo
              size="xl"
              showText={false}
              companyName={COMPANY_NAME}
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight [overflow-wrap:anywhere] break-words">
            {language === 'en' ? COMPANY_NAME : 'छत्रपति शिवाजीज क्रिएटिव सॉल्यूशंस'}
          </h1>
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider">
            {language === 'en' ? 'Recruitment Desk' : 'भर्ती डेस्क'}
          </p>
          <p className="text-xs text-muted">
            {language === 'en'
              ? 'Candidate screening & hiring operations portal'
              : 'उम्मीदवार स्क्रीनिंग एवं भर्ती संचालन पोर्टल'}
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
              {language === 'en' ? 'Email Address' : 'ईमेल पता'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-medium focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-secondary uppercase tracking-wider mb-1">
              {language === 'en' ? 'Password' : 'पासवर्ड'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-medium focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-muted hover:text-primary"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-secondary">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-brand rounded border-border focus:ring-brand cursor-pointer"
              />
              <span>{language === 'en' ? 'Remember me' : 'मुझे याद रखें'}</span>
            </label>

            <span className="text-[11px] text-muted">
              {language === 'en' ? 'Role-protected' : 'भूमिका-सुरक्षित'}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-xs shadow-md shadow-brand/20 transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>{language === 'en' ? 'Authenticating...' : 'सत्यापन हो रहा है...'}</span>
            ) : (
              <>
                <span>{language === 'en' ? 'Sign In' : 'साइन इन करें'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Password Assistance Notice */}
        <div className="pt-4 border-t border-border text-center space-y-1">
          <p className="text-xs text-muted">
            {language === 'en'
              ? 'Forgot password? Contact your Admin.'
              : 'पासवर्ड भूल गए? अपने एडमिन से संपर्क करें।'}
          </p>
          <p className="text-[10px] font-mono text-muted/80">
            {BUILD_STAMP} · {COMPANY_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-primary font-bold">Loading {COMPANY_NAME}...</div>}>
      <LoginForm />
    </Suspense>
  );
}
