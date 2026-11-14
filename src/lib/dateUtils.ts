/**
 * India Standard Time (IST - Asia/Kolkata, UTC+05:30) Date Utilities
 */

export const INDIA_TIMEZONE = 'Asia/Kolkata';

export function getIndiaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: INDIA_TIMEZONE }).format(d);
}

export function formatIndiaDateTime(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}
