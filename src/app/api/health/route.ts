import { NextResponse } from 'next/server';
import { BUILD_STAMP, APP_VERSION } from '@/lib/version';
import { isCloudMode, supabaseAdmin } from '@/lib/supabase';
import { getCompanySettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    const isCloud = isCloudMode();
    let cloudProbeOk = true;
    let cloudError: string | null = null;
    let secretKeySource = 'none';

    if (process.env.SUPABASE_SECRET_KEY) {
      secretKeySource = 'SUPABASE_SECRET_KEY';
    } else if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      secretKeySource = 'SUPABASE_SERVICE_ROLE_KEY';
    }

    if (isCloud) {
      if (!supabaseAdmin) {
        cloudProbeOk = false;
        cloudError = 'supabaseAdmin is null';
      } else {
        const { error: probeErr } = await supabaseAdmin
          .from('users')
          .select('count', { count: 'exact', head: true });
        if (probeErr) {
          cloudProbeOk = false;
          cloudError = probeErr.message;
        }
      }
    }

    const settings = await getCompanySettings();
    const dbLatencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: cloudProbeOk ? 'ok' : 'error',
        version: APP_VERSION,
        buildStamp: BUILD_STAMP,
        storageMode: isCloud ? 'supabase' : 'local',
        secretKeySource,
        dbConnectivity: cloudProbeOk,
        cloudError: cloudError || undefined,
        latencyMs: dbLatencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: cloudProbeOk ? 200 : 503,
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
