import { NextRequest, NextResponse } from 'next/server';
import { auditDomainDeliverability, validateAndSanitizeDomain } from '@/lib/dns-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain } = body;

    const validation = validateAndSanitizeDomain(domain);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Valid domain name is required (e.g. yourbrand.com)' }, { status: 400 });
    }

    const result = await auditDomainDeliverability(validation.domain);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
