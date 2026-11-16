import { COMPANY_NAME } from './brand';

export const APP_VERSION = '1.1.0';
export const BUILD_DATE = '2026-11-16';
export const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_TIME
  ? `Build ${process.env.NEXT_PUBLIC_BUILD_TIME}`
  : 'Build 2026-11-16 13:15 IST';
export { COMPANY_NAME };
