import { NextResponse } from 'next/server';
import { BUILD_STAMP, APP_VERSION } from '@/lib/version';
import { isCloudMode } from '@/lib/supabase';
import { getCompanySettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    const settings = await getCompanySettings();
    const dbLatencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'ok',
        version: APP_VERSION,
        buildStamp: BUILD_STAMP,
        storageMode: isCloudMode() ? 'supabase' : 'local',
        dbConnectivity: Boolean(settings?.company_name),
        latencyMs: dbLatencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        buildStamp: BUILD_STAMP,
        storageMode: isCloudMode() ? 'supabase' : 'local',
        error: error.message || 'Health probe failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
