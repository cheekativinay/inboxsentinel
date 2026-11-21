import { NextRequest, NextResponse } from 'next/server';
import { validateAndSanitizeDomain } from '@/lib/dns-engine';
import { checkRateLimit, getClientIp, dispatchSecureWebhook, validateSafeWebhookUrl } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (10 test siren dispatches / minute per IP)
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`alert_${clientIp}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many siren tests. Please wait a minute before sending another test alarm.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await req.json();
    const { webhookUrl, channel = 'slack', domain = 'outbound-sdr.com' } = body;

    // 2. Strict Pre-flight SSRF Validation (Blocks localhost, private CIDRs & cloud metadata)
    const webhookValidation = await validateSafeWebhookUrl(webhookUrl);
    if (!webhookValidation.valid) {
      return NextResponse.json({ error: webhookValidation.error || 'Invalid or unsafe webhook URL' }, { status: 400 });
    }

    const domainValidation = validateAndSanitizeDomain(domain);
    const targetDomain = domainValidation.valid ? domainValidation.domain : 'outbound-domain.com';

    const timestamp = new Date().toLocaleTimeString();

    let payload: Record<string, unknown> = {};

    if (channel === 'slack') {
      payload = {
        text: `[InboxSentinel ALARM] Outbound deliverability dropped on ${targetDomain}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 InboxSentinel: Outbound Blacklist Emergency',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Domain:*\n\`${targetDomain}\`` },
              { type: 'mrkdwn', text: `*Severity:*\n🔥 CRITICAL BLACKLIST` },
              { type: 'mrkdwn', text: `*Flagged Authority:*\nSpamhaus ZEN` },
              { type: 'mrkdwn', text: `*Est. Pipeline Risk:*\n~$3,200 in burned meetings` },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Timestamp: ${timestamp} | Automated Deliverability Tripwire`,
              },
            ],
          },
        ],
      };
    } else {
      payload = {
        source: 'InboxSentinel',
        alert: 'CRITICAL_BLACKLIST_LISTING',
        domain: targetDomain,
        status: 'CRITICAL',
        timestamp: new Date().toISOString(),
        message: `Emergency: ${targetDomain} was flagged on Spamhaus ZEN. Outbound cold campaigns are landing in spam.`,
      };
    }

    // 3. Dispatch Webhook with Strict Timeout & Size Limits
    const dispatchResult = await dispatchSecureWebhook(webhookUrl, payload);

    if (!dispatchResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: `Delivery failed: ${dispatchResult.error}. If this is a demo, simulation payload structure was validated.`,
        },
        { status: dispatchResult.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      channel,
      message: `Alarm successfully dispatched to ${channel.toUpperCase()}!`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Alert failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
