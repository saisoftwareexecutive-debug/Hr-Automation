'use client';

import React, { useState } from 'react';
import {
  COMPANY_NAME,
  COMPANY_TAGLINE,
  DEFAULT_LOGO_PATH,
  DEFAULT_LOGO_MARK_PATH,
} from '@/lib/brand';

interface CompanyLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  markOnly?: boolean;
  companyName?: string;
  tagline?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  className?: string;
}

export function CompanyLogo({
  size = 'md',
  showText = false,
  markOnly = false,
  companyName = COMPANY_NAME,
  tagline = COMPANY_TAGLINE,
  logoUrl,
  accentColor,
  className = '',
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-9 h-9 text-sm rounded-xl',
    lg: 'w-12 h-12 text-lg rounded-2xl',
    xl: 'w-16 h-16 text-2xl rounded-2xl',
  };

  const badgeStyle = accentColor
    ? { backgroundColor: accentColor }
    : undefined;

  // Use custom logoUrl if provided; otherwise use brand default assets
  const fallbackSrc = markOnly ? DEFAULT_LOGO_MARK_PATH : DEFAULT_LOGO_PATH;
  const resolvedSrc = logoUrl || fallbackSrc;

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {!hasError && resolvedSrc ? (
        <div
          className={`${sizeClasses[size]} bg-white dark:bg-white p-0.5 border border-border/80 shadow-xs shrink-0 flex items-center justify-center overflow-hidden`}
        >
          <img
            src={resolvedSrc}
            alt={`${companyName} logo`}
            onError={() => setHasError(true)}
            className="w-full h-full object-contain select-none"
          />
        </div>
      ) : (
        <div
          style={badgeStyle}
          className={`${sizeClasses[size]} bg-gradient-to-tr from-brand-700 via-indigo-600 to-indigo-500 text-white font-black tracking-tight flex items-center justify-center shadow-xs shrink-0 select-none border border-white/20`}
        >
          CS
        </div>
      )}

      {showText && (
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`font-black tracking-tight leading-tight text-primary ${
              size === 'sm' ? 'text-xs' : 'text-sm'
            } [overflow-wrap:anywhere] break-words`}
          >
            {companyName}
          </span>
          {tagline && (
            <span className="text-[10px] text-secondary font-semibold uppercase tracking-wider mt-0.5 truncate">
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
