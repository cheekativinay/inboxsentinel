import { NextRequest, NextResponse } from 'next/server';
import { runAllDomainChecks } from '@/lib/watchdog';
import { checkRateLimit, getClientIp } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`check_all_${clientIp}`, 2, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Fleet check rate limit exceeded. Please wait 1 minute before checking all domains again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const summary = await runAllDomainChecks();
    return NextResponse.json({
      success: true,
      summary,
      message: `Fleet check completed across ${summary.totalChecked} outbound domains.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fleet check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
