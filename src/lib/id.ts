/**
 * Universal ID & token generator that works seamlessly in:
 * 1. Modern browsers (window.crypto.randomUUID)
 * 2. Node.js (globalThis.crypto.randomUUID)
 * 3. Web Worker / Edge runtimes
 * 4. Fallback when Web Crypto is unavailable
 *
 * Avoids Node.js 'crypto' module imports that break client-side Next.js bundles.
 */

export function generateUUID(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Continue to fallback
  }

  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      globalThis.crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; // RFC4122 version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // RFC4122 variant
      return Array.from(buf)
        .map((b, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Continue to fallback
  }

  // Safe Math.random fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateSecureToken(byteLength: number = 16): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(byteLength);
      globalThis.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Continue to fallback
  }

  let res = '';
  for (let i = 0; i < byteLength * 2; i++) {
    res += Math.floor(Math.random() * 16).toString(16);
  }
  return res;
}
