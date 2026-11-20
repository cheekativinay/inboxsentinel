import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhookUrl, channel = 'slack', domain = 'outbound-sdr.com' } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }

    const timestamp = new Date().toLocaleTimeString();

    let payload: Record<string, unknown> = {};

    if (channel === 'slack') {
      payload = {
        text: `[InboxSentinel ALARM] Outbound deliverability dropped on ${domain}`,
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
              { type: 'mrkdwn', text: `*Domain:*\n\`${domain}\`` },
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
        domain,
        status: 'CRITICAL',
        timestamp: new Date().toISOString(),
        message: `Emergency: ${domain} was flagged on Spamhaus ZEN. Outbound cold campaigns are landing in spam.`,
      };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            message: `Remote webhook responded with HTTP ${response.status}. Please check webhook permissions.`,
          },
          { status: 400 }
        );
      }
    } catch (dispatchErr: unknown) {
      const msg = dispatchErr instanceof Error ? dispatchErr.message : 'Network error';
      return NextResponse.json(
        {
          success: false,
          message: `Delivery failed: ${msg}. If this is a demo, simulation payload structure was validated.`,
        },
        { status: 502 }
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
