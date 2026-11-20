import { NextResponse } from 'next/server';
import { runAllDomainChecks } from '@/lib/watchdog';

export async function POST() {
  try {
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
