'use client';

import React, { useState } from 'react';
import { Application } from '@/types';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Send,
  ShieldCheck,
  Building2,
  MapPin,
  Clock,
  Briefcase,
  IndianRupee,
  Calendar,
  Languages,
} from 'lucide-react';

interface ScreeningFormClientProps {
  application: Application;
  token: string;
  alreadySubmitted?: boolean;
}

export function ScreeningFormClient({
  application,
  token,
  alreadySubmitted = false,
}: ScreeningFormClientProps) {
  const [lang, setLang] = useState<'en' | 'hi'>('hi');
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const job = application.job;
  const candidate = application.candidate;

  // Form Fields State
  const [currentCity, setCurrentCity] = useState(
    application.form_answers?.current_city || candidate?.city || ''
  );
  const [experienceYears, setExperienceYears] = useState(
    application.form_answers?.experience_years?.toString() ||
      (candidate?.total_experience_months ? (candidate.total_experience_months / 12).toFixed(1) : '1')
  );
  const [matchedSkills, setMatchedSkills] = useState<string[]>(
    application.form_answers?.matched_skills || []
  );
  const [expectedSalary, setExpectedSalary] = useState(
    application.form_answers?.expected_salary?.toString() ||
      (job && job.min_salary != null && job.max_salary != null ? ((job.min_salary + job.max_salary) / 2).toString() : '25000')
  );
  const [noticePeriodDays, setNoticePeriodDays] = useState(
    application.form_answers?.notice_period_days?.toString() || '0'
  );
  const [shiftPreference, setShiftPreference] = useState(
    application.form_answers?.shift_preference || job?.shift_type || 'any'
  );
  const [preferredInterviewSlot, setPreferredInterviewSlot] = useState(
    application.form_answers?.preferred_interview_slot || 'Tomorrow 10:00 AM - 1:00 PM'
  );
  const [consentGiven, setConsentGiven] = useState(
    application.form_answers ? application.form_answers.consent_given : true
  );

  const t = {
    en: {
      tag: 'Candidate Screening Form',
      greeting: `Namaste ${candidate?.full_name || 'Candidate'}!`,
      subtitle: `Please complete this quick 2-minute form for the ${job?.title || 'Job Opening'} position.`,
      company: 'HR Recruitment Team',
      cityLabel: 'Your Current City / Location',
      cityPlaceholder: 'e.g. Bengaluru, Mumbai, Delhi',
      expLabel: 'Total Work Experience (Years)',
      skillsLabel: 'Select skills that you have hands-on experience with:',
      noSkills: 'General candidate aptitude',
      salaryLabel: 'Expected Monthly In-Hand Salary (₹)',
      noticeLabel: 'When can you join if selected?',
      noticeImmediate: 'Immediate (0 - 3 days)',
      notice7: 'Within 7 days',
      notice15: 'Within 15 days',
      notice30: 'Within 30 days',
      noticeMore: 'More than 30 days',
      shiftLabel: 'Shift Availability',
      shiftDay: 'Day Shift Only',
      shiftNight: 'Night Shift Only',
      shiftRotational: 'Rotational Shift',
      shiftAny: 'Flexible / Any Shift',
      slotLabel: 'Preferred Telephonic / Online Interview Slot',
      slot1: 'Tomorrow 10:00 AM - 1:00 PM',
      slot2: 'Tomorrow 2:00 PM - 5:00 PM',
      slot3: 'Day After Tomorrow 11:00 AM - 2:00 PM',
      consentLabel: 'DPDP Act 2023 Data Consent',
      consentText:
        'I give my consent to HireFlow and the recruiting company to process my application data solely for hiring and candidate evaluation purposes, compliant with the India Digital Personal Data Protection Act 2023.',
      submitBtn: 'Submit Application & Screening',
      submittingBtn: 'Submitting...',
      thankYouTitle: 'Application Submitted Successfully!',
      thankYouDesc:
        'Thank you! Your responses have been recorded and scored. The HR recruitment team will review your profile and contact you on WhatsApp or call for the next steps.',
      badgeReview: 'Status: Under HR Review',
      openInMaps: 'Open in Maps ↗',
    },
    hi: {
      tag: 'उम्मीदवार स्क्रीनिंग फॉर्म',
      greeting: `नमस्ते ${candidate?.full_name || 'उम्मीदवार'}!`,
      subtitle: `${job?.title || 'नौकरी'} पद के लिए कृपया यह 2 मिनट का संक्षिप्त फॉर्म भरें।`,
      company: 'एचआर भर्ती टीम',
      cityLabel: 'आपका वर्तमान शहर / पता',
      cityPlaceholder: 'जैसे: बेंगलुरु, मुंबई, दिल्ली',
      expLabel: 'कुल कार्य अनुभव (वर्षों में)',
      skillsLabel: 'जिन कौशलों (Skills) में आपको अनुभव है, उन्हें चुनें:',
      noSkills: 'सामान्य कार्य योग्यता',
      salaryLabel: 'अपेक्षित मासिक वेतन / सैलरी (₹)',
      noticeLabel: 'चयन होने पर आप कितने दिनों में काम शुरू कर सकते हैं?',
      noticeImmediate: 'तुरंत (Immediate - 0 से 3 दिन)',
      notice7: '7 दिनों के भीतर',
      notice15: '15 दिनों के भीतर',
      notice30: '30 दिनों के भीतर',
      noticeMore: '30 दिनों से अधिक',
      shiftLabel: 'काम की पाली (Shift Availability)',
      shiftDay: 'केवल दिन की पाली (Day Shift)',
      shiftNight: 'केवल रात की पाली (Night Shift)',
      shiftRotational: 'रोटेशनल पाली (Rotational)',
      shiftAny: 'किसी भी पाली में काम करने को तैयार (Flexible)',
      slotLabel: 'इंटरव्यू के लिए पसंदीदा समय स्लॉट',
      slot1: 'कल सुबह 10:00 से दोपहर 1:00 बजे',
      slot2: 'कल दोपहर 2:00 से शाम 5:00 बजे',
      slot3: 'परसों सुबह 11:00 से दोपहर 2:00 बजे',
      consentLabel: 'डेटा सहमति (DPDP Act 2023)',
      consentText:
        'मैं अपने आवेदन विवरण को नौकरी मूल्यांकन हेतु संसाधित करने के लिए सहमति देता/देती हूँ (भारत डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत)।',
      submitBtn: 'स्क्रीनिंग फॉर्म जमा करें',
      submittingBtn: 'जमा हो रहा है...',
      thankYouTitle: 'स्क्रीनिंग फॉर्म सफलतापूर्वक जमा हो गया!',
      thankYouDesc:
        'धन्यवाद! आपके उत्तर दर्ज कर लिए गए हैं। एचआर भर्ती टीम आपके प्रोफ़ाइल की समीक्षा करेगी और आगे के चरणों के लिए आपसे व्हाट्सएप या फोन पर संपर्क करेगी।',
      badgeReview: 'स्थिति: एचआर समीक्षाधीन',
      openInMaps: 'गूगल मैप में देखें ↗',
    },
  }[lang];

  const handleSkillToggle = (skill: string) => {
    if (matchedSkills.includes(skill)) {
      setMatchedSkills(matchedSkills.filter((s) => s !== skill));
    } else {
      setMatchedSkills([...matchedSkills, skill]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      setErrorMessage(
        lang === 'hi'
          ? 'कृपया आगे बढ़ने के लिए डेटा सहमति चेकबॉक्स पर टिक करें।'
          : 'Please accept the data consent checkbox to proceed.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/apply/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_city: currentCity,
          experience_years: parseFloat(experienceYears) || 0,
          matched_skills: matchedSkills,
          expected_salary: parseFloat(expectedSalary) || 0,
          notice_period_days: parseInt(noticePeriodDays) || 0,
          shift_preference: shiftPreference,
          languages: ['Hindi', 'English'],
          preferred_interview_slot: preferredInterviewSlot,
          consent_given: true,
          consent_text: t.consentText,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit screening answers');
      }

      setSubmitted(true);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface rounded-3xl p-8 sm:p-10 shadow-2xl border border-border text-center animate-in zoom-in-95 duration-200">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <span className="inline-block px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800 mb-3">
          {t.badgeReview}
        </span>

        <h2 className="text-2xl font-black text-primary mb-3">{t.thankYouTitle}</h2>
        <p className="text-sm text-secondary leading-relaxed max-w-md mx-auto mb-6">
          {t.thankYouDesc}
        </p>

        <div className="p-4 rounded-2xl bg-surface-subtle border border-border text-left text-xs text-secondary space-y-1.5">
          <div className="font-bold text-primary uppercase tracking-wider text-[11px] mb-1">
            Application Summary
          </div>
          <div><span className="text-muted">Applicant:</span> {candidate?.full_name}</div>
          <div><span className="text-muted">Job Role:</span> {job?.title}</div>
          <div><span className="text-muted">Notice Period:</span> {noticePeriodDays} days</div>
          <div><span className="text-muted">Shift Choice:</span> {shiftPreference}</div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>India DPDP Act 2023 Verified • HireFlow Zero-Cost HR</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-3xl shadow-xl border border-border overflow-hidden">
      {/* Header with Bilingual Toggle */}
      <div className="bg-gradient-to-r from-brand-700 to-indigo-700 text-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" /> {t.tag}
          </span>

          {/* Language Switcher */}
          <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/20">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                lang === 'en' ? 'bg-white text-brand-900 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('hi')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                lang === 'hi' ? 'bg-white text-brand-900 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t.greeting}</h1>
        <p className="text-sm text-indigo-100 mt-2 leading-relaxed">{t.subtitle}</p>

        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-indigo-200">
          <span className="flex items-center gap-1 font-semibold text-white">
            <Briefcase className="w-4 h-4" /> {job?.title}
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <MapPin className="w-4 h-4 text-emerald-300" />
            <span>{job?.city}{job?.location ? ` · ${job.location}` : ''}</span>
            {job?.map_url && (
              <a
                href={job.map_url}
                target="_blank"
                rel="noreferrer"
                className="underline text-white font-bold ml-1.5 hover:text-emerald-200 transition"
              >
                {t.openInMaps}
              </a>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="w-4 h-4" /> {job?.department}
          </span>
        </div>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="m-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {/* 1. Current City */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-brand" /> {t.cityLabel} *
          </label>
          <input
            type="text"
            required
            value={currentCity}
            onChange={(e) => setCurrentCity(e.target.value)}
            placeholder={t.cityPlaceholder}
            className="w-full text-sm rounded-xl border border-border px-4 py-3 bg-input-bg text-primary placeholder:text-muted focus:ring-2 focus:ring-brand focus:outline-hidden transition"
          />
        </div>

        {/* 2. Total Experience */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-brand" /> {t.expLabel} *
          </label>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {['0', '1', '2', '3+'].map((val) => {
              const numVal = val === '3+' ? '3.5' : val;
              const isSelected = experienceYears === numVal || (val === '3+' && parseFloat(experienceYears) >= 3);
              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => setExperienceYears(numVal)}
                  className={`py-2.5 rounded-xl border font-bold transition text-center ${
                    isSelected
                      ? 'border-brand bg-brand-subtle text-brand ring-2 ring-brand/20'
                      : 'border-border bg-surface text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {val} {lang === 'hi' ? 'साल' : 'yrs'}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Required Skills Checkboxes */}
        {job?.required_skills && job.required_skills.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand" /> {t.skillsLabel}
            </label>
            <div className="space-y-2">
              {job.required_skills.map((skill) => {
                const checked = matchedSkills.includes(skill);
                return (
                  <label
                    key={skill}
                    onClick={() => handleSkillToggle(skill)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                      checked
                        ? 'border-brand bg-brand-subtle text-brand font-semibold shadow-xs'
                        : 'border-border hover:bg-surface-hover text-secondary'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="w-4 h-4 text-brand rounded border-border focus:ring-brand"
                    />
                    <span className="text-sm">{skill}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Expected Salary */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <IndianRupee className="w-4 h-4 text-brand" /> {t.salaryLabel} *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3 text-muted font-bold">₹</span>
            <input
              type="number"
              required
              min={5000}
              step={1000}
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
              className="w-full text-sm pl-8 pr-4 py-3 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand focus:outline-hidden"
            />
          </div>
        </div>

        {/* 5. Notice Period / Joining availability */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-brand" /> {t.noticeLabel} *
          </label>
          <select
            value={noticePeriodDays}
            onChange={(e) => setNoticePeriodDays(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand font-medium focus:outline-hidden"
          >
            <option value="0">{t.noticeImmediate}</option>
            <option value="7">{t.notice7}</option>
            <option value="15">{t.notice15}</option>
            <option value="30">{t.notice30}</option>
            <option value="45">{t.noticeMore}</option>
          </select>
        </div>

        {/* 6. Shift Availability */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-brand" /> {t.shiftLabel} *
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { val: 'day', label: t.shiftDay },
              { val: 'night', label: t.shiftNight },
              { val: 'rotational', label: t.shiftRotational },
              { val: 'any', label: t.shiftAny },
            ].map((s) => (
              <button
                type="button"
                key={s.val}
                onClick={() => setShiftPreference(s.val)}
                className={`p-3 rounded-xl border font-bold transition text-left ${
                  shiftPreference === s.val
                    ? 'border-brand bg-brand-subtle text-brand ring-2 ring-brand/20'
                    : 'border-border bg-surface text-secondary hover:bg-surface-hover'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 7. Preferred Interview Slot */}
        <div>
          <label className="block text-xs font-bold uppercase text-secondary tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand" /> {t.slotLabel}
          </label>
          <select
            value={preferredInterviewSlot}
            onChange={(e) => setPreferredInterviewSlot(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl border border-border bg-input-bg text-primary focus:ring-2 focus:ring-brand font-medium focus:outline-hidden"
          >
            <option value="Tomorrow 10:00 AM - 1:00 PM">{t.slot1}</option>
            <option value="Tomorrow 2:00 PM - 5:00 PM">{t.slot2}</option>
            <option value="Day After Tomorrow 11:00 AM - 2:00 PM">{t.slot3}</option>
          </select>
        </div>

        {/* 8. DPDP Act 2023 Explicit Consent */}
        <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-brand rounded border-border focus:ring-brand"
            />
            <span className="text-xs text-secondary leading-relaxed">
              <span className="font-bold text-primary block mb-0.5">{t.consentLabel}</span>
              {t.consentText}
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 px-6 rounded-2xl bg-brand hover:bg-brand-hover active:scale-[0.99] text-white font-extrabold text-base shadow-lg shadow-brand/20 transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <span>{t.submittingBtn}</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{t.submitBtn}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

