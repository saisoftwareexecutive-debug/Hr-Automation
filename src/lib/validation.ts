/**
 * Input validation utilities for text fields and spam/junk prevention.
 */

export function hasExcessiveRepeatedChars(text: string, maxRepeat = 30): boolean {
  if (!text || typeof text !== 'string') return false;
  const regex = new RegExp(`(.)\\1{${maxRepeat - 1},}`);
  return regex.test(text);
}

export function validateJobInput(data: { title?: string; city?: string; location?: string }): { valid: boolean; error?: string } {
  if (data.title !== undefined) {
    const trimmedTitle = data.title.trim();
    if (!trimmedTitle) {
      return { valid: false, error: 'Job title is required' };
    }
    if (trimmedTitle.length > 100) {
      return { valid: false, error: 'Job title must be 100 characters or fewer' };
    }
    if (hasExcessiveRepeatedChars(trimmedTitle, 30)) {
      return { valid: false, error: 'Job title contains too many repeated identical characters.' };
    }
  }

  if (data.city !== undefined) {
    const trimmedCity = data.city.trim();
    if (hasExcessiveRepeatedChars(trimmedCity, 30)) {
      return { valid: false, error: 'Target city contains too many repeated identical characters.' };
    }
  }

  if (data.location !== undefined && data.location) {
    const trimmedLoc = data.location.trim();
    if (trimmedLoc.length > 200) {
      return { valid: false, error: 'Work location must be 200 characters or fewer' };
    }
    if (hasExcessiveRepeatedChars(trimmedLoc, 30)) {
      return { valid: false, error: 'Work location contains too many repeated identical characters.' };
    }
  }

  return { valid: true };
}

