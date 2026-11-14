import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  COMPANY_NAME,
  COMPANY_TAGLINE,
  DEFAULT_LOGO_PATH,
  DEFAULT_LOGO_MARK_PATH,
  MANIFEST_SHORT_NAME,
} from '../brand';
import { renderTemplate } from '../templates';

describe('Brand Identity & Single Source of Truth', () => {
  it('exports exact company name with typographic apostrophe (U+2019)', () => {
    expect(COMPANY_NAME).toBe('Chhatrapati Shivaji\u2019s Creative Solutions');
    // Ensure no straight apostrophe (ASCII 39)
    expect(COMPANY_NAME).not.toContain(String.fromCharCode(39));
    // Ensure U+2019 (8217) is present
    expect(COMPANY_NAME).toContain('’');
    expect(COMPANY_NAME.charCodeAt(COMPANY_NAME.indexOf('’'))).toBe(8217);
  });

  it('exports valid logo and manifest brand constants', () => {
    expect(COMPANY_TAGLINE).toBe('Recruitment Desk');
    expect(DEFAULT_LOGO_PATH).toBe('/brand/logo.png');
    expect(DEFAULT_LOGO_MARK_PATH).toBe('/brand/logo-mark.png');
    expect(MANIFEST_SHORT_NAME).toBe('CS Recruit');
  });

  it('renders {{company_name}} in templates accurately', () => {
    const template = 'Greetings from {{company_name}}! Position: {{job_title}}';
    const output = renderTemplate(template, {
      job_title: 'Senior Operations Executive',
      company_name: COMPANY_NAME,
    });
    expect(output).toBe(`Greetings from ${COMPANY_NAME}! Position: Senior Operations Executive`);
    expect(output).toContain('Chhatrapati Shivaji\u2019s Creative Solutions');
    expect(output).not.toContain(String.fromCharCode(39));
  });

  it('verifies public/site.webmanifest is valid JSON with correct brand data', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'site.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf8');
    const json = JSON.parse(content);
    expect(json.name).toBe(`${COMPANY_NAME} Recruitment Desk`);
    expect(json.short_name).toBe(MANIFEST_SHORT_NAME);
    expect(json.icons.length).toBeGreaterThanOrEqual(3);
  });

  it('verifies data store is valid JSON without BOM and has correct brand settings', () => {
    const livePath = path.join(process.cwd(), 'data', 'hireflow_db.json');
    const dbPath = fs.existsSync(livePath) ? livePath : (process.env.HIREFLOW_DATA_FILE || '');
    if (dbPath && fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      // Ensure NO UTF-8 Byte Order Mark (BOM) in JSON
      expect(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf).toBe(false);

      const db = JSON.parse(buf.toString('utf8'));
      expect(db.companySettings).toBeDefined();
      expect(db.companySettings.company_name).toBe(COMPANY_NAME);
      expect(db.companySettings.logo_url).toBe(DEFAULT_LOGO_PATH);
    }
  });

  it('confirms zero occurrences of forbidden legacy/broken brand strings in source files', () => {
    const straightApos = 'Shivaji' + String.fromCharCode(39) + 's';
    const forbidden = [
      { label: 'C.S Creative Solution', regex: /C\.S Creative Solution/ },
      { label: 'Creative Solution (singular)', regex: /Creative Solution(?![sS])/ },
      { label: 'CS Creative', regex: /CS Creative/ },
      { label: "Shivaji's (straight apostrophe)", regex: new RegExp(straightApos) },
    ];

    const violations: { file: string; label: string }[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (['node_modules', '.next', '.git', 'screenshots', 'test_data', 'search_terms.js'].includes(entry)) {
          continue;
        }
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx|ts|json|mjs|js|html)$/.test(entry) && !entry.endsWith('brand.test.ts')) {
          const text = fs.readFileSync(fullPath, 'utf8');
          for (const item of forbidden) {
            if (item.regex.test(text)) {
              violations.push({ file: fullPath, label: item.label });
            }
          }
        }
      }
    }

    scanDir(process.cwd());
    expect(violations).toEqual([]);
  });
});
