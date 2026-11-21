import { NextRequest, NextResponse } from 'next/server';
import { getMonitoredDomains, saveMonitoredDomains } from '@/lib/store';
import { executeDomainCheck } from '@/lib/watchdog';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const domains = getMonitoredDomains();
    const filtered = domains.filter((d) => d.id !== id);

    if (filtered.length === domains.length) {
      return NextResponse.json({ error: 'Domain monitor not found' }, { status: 404 });
    }

    saveMonitoredDomains(filtered);
    return NextResponse.json({ success: true, message: 'Domain removed from watchdog' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const domains = getMonitoredDomains();
    const index = domains.findIndex((d) => d.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Domain monitor not found' }, { status: 404 });
    }

    const target = domains[index];
    const { domain: updated, log } = await executeDomainCheck(target);

    domains[index] = updated;
    saveMonitoredDomains(domains);

    return NextResponse.json({
      success: true,
      domain: updated,
      log,
      message: `Re-check complete for ${updated.domain}. Status: ${updated.status.toUpperCase()}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Re-check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
