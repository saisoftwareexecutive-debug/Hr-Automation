import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

export interface ClientErrorRecord {
  id: string;
  message: string;
  stack?: string;
  url?: string;
  timestamp: string;
  userAgent?: string;
}

const MAX_ERRORS = 200;
let inMemoryErrors: ClientErrorRecord[] = [];

function sanitizeString(str: string): string {
  if (!str) return '';
  // Strip out possible tokens or passwords
  return str
    .replace(/password["']?\s*[:=]\s*["'][^"']+["']/gi, 'password:[REDACTED]')
    .replace(/token=[a-f0-9]{16,}/gi, 'token=[REDACTED]')
    .slice(0, 2000);
}

function getErrorLogPath(): string {
  return path.join(process.cwd(), 'data', 'client_errors.json');
}

function loadPersistedErrors(): ClientErrorRecord[] {
  try {
    const filePath = getErrorLogPath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) {
        return data.slice(-MAX_ERRORS);
      }
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

function persistErrors(errors: ClientErrorRecord[]) {
  try {
    const filePath = getErrorLogPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(errors.slice(-MAX_ERRORS), null, 2), 'utf8');
  } catch {
    // Ignore write errors
  }
}

// Initialize from file if empty
if (inMemoryErrors.length === 0) {
  inMemoryErrors = loadPersistedErrors();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const record: ClientErrorRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      message: sanitizeString(body.message || 'Unknown client error'),
      stack: sanitizeString(body.stack || ''),
      url: sanitizeString(body.url || ''),
      timestamp: body.timestamp || new Date().toISOString(),
      userAgent: req.headers.get('user-agent')?.slice(0, 200) || undefined,
    };

    inMemoryErrors.push(record);
    if (inMemoryErrors.length > MAX_ERRORS) {
      inMemoryErrors = inMemoryErrors.slice(-MAX_ERRORS);
    }
    persistErrors(inMemoryErrors);

    return NextResponse.json({ success: true, id: record.id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    total: inMemoryErrors.length,
    errors: inMemoryErrors.slice().reverse(),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  inMemoryErrors = [];
  persistErrors([]);

  return NextResponse.json({ success: true, message: 'Client error log cleared' });
}

