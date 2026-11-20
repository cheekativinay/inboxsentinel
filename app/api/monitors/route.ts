import { NextRequest, NextResponse } from 'next/server';
import {
  getMonitoredDomains,
  saveMonitoredDomains,
  getCheckLogs,
  MonitoredDomain,
} from '@/lib/store';
import { executeDomainCheck } from '@/lib/watchdog';

export async function GET() {
  try {
    const domains = getMonitoredDomains();
    const logs = getCheckLogs();
    return NextResponse.json({ domains, logs });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch monitors';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, label, intervalMinutes = 15, channel = 'slack', webhookUrl = '' } = body;

    if (!domain || typeof domain !== 'string' || !domain.trim().includes('.')) {
      return NextResponse.json({ error: 'Valid domain name is required' }, { status: 400 });
    }

    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0];

    const domains = getMonitoredDomains();

    const existing = domains.find((d) => d.domain.toLowerCase() === cleanDomain);
    if (existing) {
      return NextResponse.json(
        { error: `Domain ${cleanDomain} is already actively monitored.` },
        { status: 409 }
      );
    }

    const newDomain: MonitoredDomain = {
      id: `dom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      domain: cleanDomain,
      label: label && label.trim() ? label.trim() : cleanDomain,
      intervalMinutes: Number(intervalMinutes) || 15,
      channel: channel || 'slack',
      webhookUrl: webhookUrl ? webhookUrl.trim() : '',
      status: 'optimal',
      lastCheckedAt: null,
      lastResponseTimeMs: null,
      dmarcPolicy: 'checking...',
      spfLookupCount: 0,
      blacklistedOn: [],
      issues: [],
      createdAt: new Date().toISOString(),
    };

    // Execute immediate baseline probe
    const { domain: evaluated, log } = await executeDomainCheck(newDomain);

    domains.unshift(evaluated);
    saveMonitoredDomains(domains);

    return NextResponse.json({
      success: true,
      domain: evaluated,
      initialLog: log,
      message: `Watchdog armed for ${cleanDomain}. Cadence: ${newDomain.intervalMinutes}m.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to register domain';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
