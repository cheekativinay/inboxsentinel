import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAllDomainChecks } from '@/lib/watchdog';
import { checkRateLimit, getClientIp } from '@/lib/security';

/**
 * 24/7 Background Sweep Endpoint
 * Protected against unauthorized sweeps, timing attacks, and query-string credential leakage.
 */
async function handleSweep(req: NextRequest) {
  const startTime = Date.now();
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && cronSecret.length >= 8) {
    // Constant-time token verification via Authorization header only
    const authHeader = req.headers.get('authorization') || '';
    const expected = `Bearer ${cronSecret}`;

    const authBuf = Buffer.from(authHeader);
    const expectedBuf = Buffer.from(expected);

    const isAuthorized =
      authBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(authBuf, expectedBuf);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Bearer token in Authorization header required.' },
        { status: 401 }
      );
    }
  } else {
    // Fallback defense if CRON_SECRET is not yet set: Limit to 1 sweep per 2 minutes per IP
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`cron_sweep_${clientIp}`, 1, 120000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for sweep invocations. Set CRON_SECRET for unlimited authorized sweeps.' },
        { status: 429, headers: { 'Retry-After': '120' } }
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

export async function POST(req: NextRequest) {
  return handleSweep(req);
}

// Allow GET only for standard monitoring pingers (e.g. cron-job.org / GitHub Action HTTP steps)
export async function GET(req: NextRequest) {
  return handleSweep(req);
}
