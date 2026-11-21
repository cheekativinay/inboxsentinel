import { NextRequest, NextResponse } from 'next/server';
import {
  getMonitoredDomains,
  saveMonitoredDomains,
  getCheckLogs,
  MonitoredDomain,
} from '@/lib/store';
import { executeDomainCheck } from '@/lib/watchdog';
import { validateAndSanitizeDomain } from '@/lib/dns-engine';
import { checkRateLimit, getClientIp, validateSafeWebhookUrl } from '@/lib/security';

function maskWebhook(url: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/...${url.slice(-6)}`;
  } catch {
    return 'https://...****';
  }
}

export async function GET() {
  try {
    const domains = getMonitoredDomains();
    const logs = getCheckLogs();

    // Sensitive data masking: Never leak secret Slack/Discord webhook tokens to public visitors
    const sanitizedDomains = domains.map((d) => ({
      ...d,
      webhookUrl: d.webhookUrl ? maskWebhook(d.webhookUrl) : '',
      hasWebhook: Boolean(d.webhookUrl),
    }));

    return NextResponse.json({ domains: sanitizedDomains, logs });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch monitors';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Client Rate Limiting (10 additions / min per IP)
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`monitor_add_${clientIp}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many domain additions. Please wait a moment before adding more domains.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await req.json();
    const { domain, label, intervalMinutes = 15, channel = 'slack', webhookUrl = '' } = body;

    const domainValidation = validateAndSanitizeDomain(domain);
    if (!domainValidation.valid) {
      return NextResponse.json({ error: domainValidation.error || 'Invalid domain' }, { status: 400 });
    }
    const cleanDomain = domainValidation.domain;

    if (webhookUrl && webhookUrl.trim()) {
      const webhookValidation = await validateSafeWebhookUrl(webhookUrl);
      if (!webhookValidation.valid) {
        return NextResponse.json({ error: webhookValidation.error || 'Invalid or unsafe webhook URL' }, { status: 400 });
      }
    }

    const domains = getMonitoredDomains();

    // Prevent unbounded memory growth / DoS
    if (domains.length >= 50) {
      return NextResponse.json(
        { error: 'Maximum fleet capacity reached (50 domains). Please remove unused monitors or contact for enterprise capacity.' },
        { status: 403 }
      );
    }

    const existing = domains.find((d) => d.domain.toLowerCase() === cleanDomain);
    if (existing) {
      return NextResponse.json(
        { error: `Domain ${cleanDomain} is already actively monitored.` },
        { status: 409 }
      );
    }

    // Input bounds validation
    const allowedChannels = ['slack', 'discord', 'telegram', 'webhook'];
    const safeChannel = allowedChannels.includes(channel) ? channel : 'slack';
    const safeInterval = Math.min(Math.max(Number(intervalMinutes) || 15, 5), 1440);
    const safeLabel = typeof label === 'string' && label.trim() ? label.trim().slice(0, 60) : cleanDomain;

    const newDomain: MonitoredDomain = {
      id: `dom_${crypto.randomUUID()}`,
      domain: cleanDomain,
      label: safeLabel,
      intervalMinutes: safeInterval,
      channel: safeChannel,
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
      domain: {
        ...evaluated,
        webhookUrl: evaluated.webhookUrl ? maskWebhook(evaluated.webhookUrl) : '',
        hasWebhook: Boolean(evaluated.webhookUrl),
      },
      initialLog: log,
      message: `Watchdog armed for ${cleanDomain}. Cadence: ${newDomain.intervalMinutes}m.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to register domain';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
