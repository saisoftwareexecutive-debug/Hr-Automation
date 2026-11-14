'use client';

import React, { useState } from 'react';
import { CompanySettings, MessageLanguage, MessageTone } from '@/types';
import { SessionData } from '@/lib/auth';
import { Building2, User, Phone, Globe, Sparkles, Clock, Save, Upload, Trash2, Check, Target, Palette } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { CompanyLogo } from '@/components/CompanyLogo';
import { COMPANY_NAME, DEFAULT_LOGO_PATH } from '@/lib/brand';

interface CompanySettingsClientProps {
  initialSettings: CompanySettings;
  user: SessionData;
}

const ACCENT_COLORS = [
  { name: 'Indigo (Default)', hex: '#4f46e5' },
  { name: 'Royal Blue', hex: '#1d4ed8' },
  { name: 'Emerald', hex: '#047857' },
  { name: 'Purple', hex: '#7e22ce' },
  { name: 'Rose', hex: '#be123c' },
];

export function CompanySettingsClient({ initialSettings, user }: CompanySettingsClientProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [loading, setLoading] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|svg\+xml)$/)) {
      toast.error('Please upload a PNG, JPG, or SVG image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({ ...prev, logo_url: base64 }));
      toast.success('Logo preview updated. Click "Save Company Settings" to apply.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, logo_url: null }));
    toast.info('Logo removed. Falling back to the sleek CS monogram.');
  };

  const handleResetToDefault = () => {
    setSettings((prev) => ({ ...prev, logo_url: DEFAULT_LOGO_PATH }));
    toast.info(`Restored ${COMPANY_NAME} official logo. Click "Save Company Settings" to apply.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update company settings');
      }

      setSettings(data.settings);
      toast.success('Company settings saved successfully! Branding & variables will update dynamically across all pages.');
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          Company &amp; Recruitment Settings
        </h1>
        <p className="text-sm text-secondary mt-1">
          Configure default branding, contact info, and session security. These values automatically populate template variables across candidate messaging.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branding & Logo Customization Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Palette className="w-5 h-5 text-brand" />
            <h2 className="text-base font-extrabold text-primary">Company Identity &amp; Visual Branding</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Live Logo Preview & Upload */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider">
                Logo &amp; Brand Monogram
              </label>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-raised border border-border">
                <CompanyLogo
                  size="xl"
                  logoUrl={settings.logo_url}
                  accentColor={settings.accent_color}
                  companyName={settings.company_name}
                  tagline={settings.tagline}
                  showText={false}
                />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs font-bold text-primary">
                    {settings.logo_url ? 'Custom / Selected Logo' : `Official ${COMPANY_NAME} Logo`}
                  </p>
                  <p className="text-[11px] text-muted">
                    Active across sidebar, login, public form &amp; reports
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="px-3 py-1.5 rounded-lg bg-surface hover:bg-border text-primary border border-border text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-brand" />
                      <span>Upload Logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-border text-secondary hover:text-primary border border-border text-[11px] font-bold transition flex items-center gap-1"
                      title={`Restore official ${COMPANY_NAME} logo`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Default Logo</span>
                    </button>
                    {settings.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-bold transition flex items-center gap-1"
                        title="Remove image and use monogram"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Monogram</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted">
                Accepts PNG, JPG, or SVG (square format recommended, max 2MB).
              </p>
            </div>

            {/* Accent Color Preset Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider">
                Accent Brand Color
              </label>
              <div className="grid grid-cols-5 gap-2.5 pt-1">
                {ACCENT_COLORS.map((preset) => {
                  const isSelected = (settings.accent_color || '#4f46e5').toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setSettings({ ...settings, accent_color: preset.hex })}
                      title={preset.name}
                      style={{ backgroundColor: preset.hex }}
                      className={`h-11 rounded-xl flex items-center justify-center text-white transition transform hover:scale-105 shadow-xs relative ${
                        isSelected ? 'ring-3 ring-offset-2 ring-primary scale-105' : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check className="w-5 h-5 drop-shadow-md stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted">
                Selected: <span className="font-semibold text-primary">{ACCENT_COLORS.find(c => c.hex.toLowerCase() === (settings.accent_color || '#4f46e5').toLowerCase())?.name || 'Custom'}</span> ({settings.accent_color || '#4f46e5'})
              </p>
            </div>
          </div>
        </div>

        {/* Company & HR Details Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Building2 className="w-5 h-5 text-brand" />
            <h2 className="text-base font-extrabold text-primary">Organization &amp; HR Representative</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Company Name <span className="text-brand font-mono">(&#123;&#123;company_name&#125;&#125;)</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  placeholder={`e.g. ${COMPANY_NAME}`}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                placeholder="e.g. Recruitment Desk"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Default HR Manager Name <span className="text-brand font-mono">(&#123;&#123;hr_name&#125;&#125;)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={settings.hr_name}
                  onChange={(e) => setSettings({ ...settings, hr_name: e.target.value })}
                  placeholder="e.g. Pallavi Mali"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                HR Contact Phone / WhatsApp <span className="text-brand font-mono">(&#123;&#123;hr_phone&#125;&#125;)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={settings.hr_phone}
                  onChange={(e) => setSettings({ ...settings, hr_phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Preferences & Daily Target Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Globe className="w-5 h-5 text-brand" />
            <h2 className="text-base font-extrabold text-primary">Candidate Messaging Defaults &amp; Daily Target</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Default Candidate Language
              </label>
              <select
                value={settings.default_language}
                onChange={(e) => setSettings({ ...settings, default_language: e.target.value as MessageLanguage })}
                className="w-full p-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
              >
                <option value="en">English (Professional Indian English)</option>
                <option value="hi">हिंदी (Hindi - Conversational &amp; Polite)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Default Tone of Voice
              </label>
              <select
                value={settings.default_tone}
                onChange={(e) => setSettings({ ...settings, default_tone: e.target.value as MessageTone })}
                className="w-full p-2.5 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand text-xs font-semibold focus:outline-hidden"
              >
                <option value="friendly">Friendly (Warm, encouraging, conversational)</option>
                <option value="professional">Professional (Corporate, clear, structured)</option>
                <option value="warm_respectful">Warm and Respectful (Namaste ji, courteous)</option>
                <option value="short_direct">Short and Direct (Crisp, action-oriented)</option>
                <option value="polite_urgent">Polite Urgent (Time-sensitive scheduling)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-secondary uppercase tracking-wider mb-1.5">
                Daily Outreach Target / User
              </label>
              <div className="relative">
                <Target className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={settings.daily_target || 25}
                  onChange={(e) => setSettings({ ...settings, daily_target: Number(e.target.value) || 25 })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-input-bg text-primary font-bold text-xs focus:ring-2 focus:ring-brand focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security & Inactivity Session Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-extrabold text-primary">Security &amp; Inactivity Auto-Logout</h2>
          </div>

          <div className="text-xs space-y-2 max-w-md">
            <label className="block font-bold text-secondary uppercase tracking-wider">
              Auto-Logout Inactivity Limit (Minutes)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={5}
                max={240}
                required
                value={settings.inactivity_timeout_minutes}
                onChange={(e) => setSettings({ ...settings, inactivity_timeout_minutes: Number(e.target.value) || 30 })}
                className="w-28 p-2.5 rounded-xl border border-border bg-input-bg text-primary font-bold text-sm focus:ring-2 focus:ring-brand focus:outline-hidden"
              />
              <span className="text-muted font-medium">Minutes (Default: 30 minutes)</span>
            </div>
            <p className="text-[11px] text-muted">
              Users inactive for this duration will be automatically logged out and redirected to login to protect candidate data privacy.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-xs shadow-xs transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving Settings...' : 'Save Company Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
