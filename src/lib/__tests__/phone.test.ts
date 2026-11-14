import { describe, it, expect } from 'vitest';
import { normalizeIndianPhone } from '../phone';

describe('India Phone Normalization (libphonenumber-js)', () => {
  it('normalizes 10-digit Indian numbers starting with 9, 8, 7, 6', () => {
    expect(normalizeIndianPhone('9876543210')).toEqual({
      isValid: true,
      normalized: '+919876543210',
      nationalNumber: '9876543210',
    });
    expect(normalizeIndianPhone('8123456789')).toEqual({
      isValid: true,
      normalized: '+918123456789',
      nationalNumber: '8123456789',
    });
    expect(normalizeIndianPhone('7000123456')).toEqual({
      isValid: true,
      normalized: '+917000123456',
      nationalNumber: '7000123456',
    });
    expect(normalizeIndianPhone('6200123456')).toEqual({
      isValid: true,
      normalized: '+916200123456',
      nationalNumber: '6200123456',
    });
  });

  it('handles spaces, dashes, parentheses and prefixes (+91, 91, 0)', () => {
    expect(normalizeIndianPhone('+91 98765 43210').normalized).toBe('+919876543210');
    expect(normalizeIndianPhone('+91-98765-43210').normalized).toBe('+919876543210');
    expect(normalizeIndianPhone('(0) 9876543210').normalized).toBe('+919876543210');
    expect(normalizeIndianPhone('09876543210').normalized).toBe('+919876543210');
    expect(normalizeIndianPhone('919876543210').normalized).toBe('+919876543210');
  });

  it('rejects invalid, short, non-mobile, or foreign numbers', () => {
    expect(normalizeIndianPhone('').isValid).toBe(false);
    expect(normalizeIndianPhone('12345').isValid).toBe(false);
    // 5-series is invalid for mobile in India
    expect(normalizeIndianPhone('5123456789').isValid).toBe(false);
    // Invalid characters
    expect(normalizeIndianPhone('abcdefghij').isValid).toBe(false);
  });
});

