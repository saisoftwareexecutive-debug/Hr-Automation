import { parsePhoneNumberFromString, PhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null; // Always +91XXXXXXXXXX in E.164
  nationalNumber: string | null; // 10 digit local number
  error?: string;
}

/**
 * Normalizes and validates Indian phone numbers (+91).
 * Handles diverse formats from Excel/CSV:
 * - "+91 98200 11111"
 * - "098200 11111"
 * - "91-9820011111"
 * - Numeric cells: 9820011111
 * - Scientific notation: 9.82E+09 or 9.820011111E+09
 * - Excel floats: 9820011111.0
 * 
 * Returns E.164 standard +91XXXXXXXXXX or error if invalid.
 */
export function normalizeIndianPhone(input: string | number | null | undefined): PhoneValidationResult {
  if (input === null || input === undefined || input === '') {
    return {
      isValid: false,
      normalized: null,
      nationalNumber: null,
      error: 'Phone number is empty or missing',
    };
  }

  let raw = '';

  // Handle numbers, scientific notation, or floats from Excel
  if (typeof input === 'number') {
    if (!isNaN(input) && isFinite(input)) {
      raw = Math.round(input).toLocaleString('fullwide', { useGrouping: false });
    } else {
      raw = String(input);
    }
  } else {
    let str = String(input).trim();

    // Check for scientific notation like "9.82E+09" or "9.820011111e+09"
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
      const num = Number(str);
      if (!isNaN(num) && isFinite(num)) {
        str = Math.round(num).toLocaleString('fullwide', { useGrouping: false });
      }
    }

    // Strip trailing .0 or .00 if stored as Excel decimal string
    str = str.replace(/\.0+$/, '');

    raw = str;
  }

  // Remove common punctuation: spaces, hyphens, parentheses, dots
  raw = raw.replace(/[\s\-\(\)\.]/g, '');

  try {
    let parsed: PhoneNumber | undefined;

    // Check if it starts with +91 or 91 or 0
    if (raw.startsWith('+91')) {
      parsed = parsePhoneNumberFromString(raw, 'IN');
    } else if (raw.startsWith('91') && raw.length === 12) {
      parsed = parsePhoneNumberFromString('+' + raw, 'IN');
    } else if (raw.startsWith('0') && raw.length === 11) {
      parsed = parsePhoneNumberFromString('+91' + raw.substring(1), 'IN');
    } else {
      parsed = parsePhoneNumberFromString(raw, 'IN');
    }

    if (parsed && parsed.isValid() && parsed.country === 'IN') {
      const e164 = parsed.format('E.164');
      const national = parsed.nationalNumber;
      if (/^[6-9]\d{9}$/.test(national)) {
        return {
          isValid: true,
          normalized: e164,
          nationalNumber: national,
        };
      }
    }

    // Direct regex fallback for 10-digit Indian mobile numbers (starts with 6, 7, 8, or 9)
    const digitsOnly = raw.replace(/\D/g, '');
    let tenDigits = '';
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
      tenDigits = digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^[6-9]/.test(digitsOnly.slice(1))) {
      tenDigits = digitsOnly.slice(1);
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]/.test(digitsOnly.slice(2))) {
      tenDigits = digitsOnly.slice(2);
    }

    if (tenDigits.length === 10 && /^[6-9]\d{9}$/.test(tenDigits)) {
      return {
        isValid: true,
        normalized: `+91${tenDigits}`,
        nationalNumber: tenDigits,
      };
    }

    return {
      isValid: false,
      normalized: null,
      nationalNumber: null,
      error: `Invalid Indian mobile number: "${input}". Must be a valid 10-digit number starting with 6, 7, 8, or 9.`,
    };
  } catch (err: any) {
    return {
      isValid: false,
      normalized: null,
      nationalNumber: null,
      error: err?.message || 'Failed to parse phone number',
    };
  }
}

/**
 * Formats a phone number for UI display in standard Indian format: +91 XXXXX XXXXX
 */
export function formatIndianPhoneDisplay(input: string | number | null | undefined): string {
  const parsed = normalizeIndianPhone(input);
  if (!parsed.isValid || !parsed.nationalNumber) {
    return String(input || '');
  }
  const nat = parsed.nationalNumber;
  return `+91 ${nat.slice(0, 5)} ${nat.slice(5)}`;
}

/**
 * Extracts pure digits with country code for WhatsApp wa.me click-to-chat (e.g. 919876543210)
 */
export function getWhatsAppPhoneDigits(input: string | number | null | undefined): string {
  const parsed = normalizeIndianPhone(input);
  if (parsed.isValid && parsed.normalized) {
    return parsed.normalized.replace(/\D/g, '');
  }
  return String(input || '').replace(/\D/g, '');
}
