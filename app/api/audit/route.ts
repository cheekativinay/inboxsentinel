import { NextRequest, NextResponse } from 'next/server';
import { auditDomainDeliverability, validateAndSanitizeDomain } from '@/lib/dns-engine';
import { checkRateLimit, getClientIp } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Client Rate Limiting (20 audits / minute per IP)
    const clientIp = getClientIp(req.headers);
    const rateCheck = checkRateLimit(`audit_${clientIp}`, 20, 60000);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a moment before running another domain diagnostic.',
          retryAfterMs: rateCheck.resetTimeMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateCheck.resetTimeMs / 1000)),
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 2. Parse & Validate Payload
    let body: { domain?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const { domain } = body;
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Valid domain string is required (e.g. stripe.com).' }, { status: 400 });
    }

    const validation = validateAndSanitizeDomain(domain);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Valid domain name is required (e.g. yourbrand.com)' },
        { status: 400 }
      );
    }

    // 3. Execute Isolated Public DNS Audit
    const result = await auditDomainDeliverability(validation.domain);

    return NextResponse.json(result, {
      headers: {
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
      },
    });
  } catch (error: unknown) {
    console.error('[API /api/audit error]:', error);
    return NextResponse.json({ error: 'Domain audit failed due to a DNS resolution or network error.' }, { status: 500 });
  }
}
