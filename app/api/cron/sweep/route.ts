import { NextRequest, NextResponse } from 'next/server';
import { runAllDomainChecks } from '@/lib/watchdog';

/**
 * 24/7 Background Sweep Endpoint
 * Can be called by:
 * - cron-job.org (Free external scheduled pinger)
 * - GitHub Actions (schedule cron)
 * - Netlify / Vercel scheduled cron jobs
 * - UptimeRobot / BetterStack HTTP monitor
 */
async function handleSweep(req: NextRequest) {
  const startTime = Date.now();

  // Security check: If CRON_SECRET is configured, enforce authorization
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const secretParam = req.nextUrl.searchParams.get('secret');

    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or missing CRON_SECRET.' },
        { status: 401 }
      );
    }
  }

  try {
    const summary = await runAllDomainChecks();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      summary: {
        totalChecked: summary.totalChecked,
        criticalCount: summary.criticalCount,
        atRiskCount: summary.atRiskCount,
        optimalCount: summary.optimalCount,
        unconfiguredCount: summary.unconfiguredCount,
      },
      message: `24/7 passive DNS sweep completed across ${summary.totalChecked} outbound domains in ${durationMs}ms.`,
      domains: summary.domains.map((d) => ({
        domain: d.domain,
        status: d.status,
        blacklistedOn: d.blacklistedOn,
        dmarcPolicy: d.dmarcPolicy,
        spfLookupCount: d.spfLookupCount,
        lastCheckedAt: d.lastCheckedAt,
      })),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown background check error';
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleSweep(req);
}

export async function POST(req: NextRequest) {
  return handleSweep(req);
}
