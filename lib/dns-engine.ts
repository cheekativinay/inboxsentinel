import dns from 'dns';

export interface BlacklistCheckResult {
  host: string;
  name: string;
  listed: boolean;
  returnCode?: string;
  description: string;
}

export interface DomainAuditResult {
  domain: string;
  scannedAt: string;
  responseTimeMs: number;
  healthScore: number;
  healthStatus: 'OPTIMAL' | 'AT_RISK' | 'CRITICAL';
  estimatedLostPipelineUsd: number;
  emailProvider: 'Google Workspace' | 'Microsoft 365' | 'Zoho Mail' | 'Custom / Self-Hosted' | 'No Mailserver';
  mx: {
    installed: boolean;
    records: Array<{ exchange: string; priority: number }>;
  };
  spf: {
    installed: boolean;
    rawRecord: string | null;
    lookupCount: number;
    lookupLimitExceeded: boolean; // RFC limit is 10
    qualifier: '~all' | '-all' | '?all' | '+all' | 'none';
    issues: string[];
  };
  dmarc: {
    installed: boolean;
    rawRecord: string | null;
    policy: 'reject' | 'quarantine' | 'none' | 'missing';
    rua: string | null;
    isCompliant2026: boolean;
    issues: string[];
  };
  dkim: {
    detected: boolean;
    testedSelector: string | null;
    rawRecord: string | null;
  };
  blacklists: {
    totalChecked: number;
    listedCount: number;
    cleanCount: number;
    results: BlacklistCheckResult[];
  };
  summary: {
    passed: string[];
    warnings: string[];
    critical: string[];
  };
}

const DNSBL_SERVERS = [
  { host: 'zen.spamhaus.org', name: 'Spamhaus ZEN', desc: 'SBL, XBL, and PBL multi-source blacklist. Fatal to inbox delivery.' },
  { host: 'b.barracudacentral.org', name: 'Barracuda Rep', desc: 'Widely used by corporate enterprise email gateways.' },
  { host: 'bl.spamcop.net', name: 'SpamCop', desc: 'Real-time automated user spam reporting list.' },
  { host: 'dnsbl.sorbs.net', name: 'SORBS Aggregate', desc: 'Comprehensive spam and open relay database.' },
  { host: 'psbl.surriel.com', name: 'PSBL', desc: 'Passive Spam Block List based on spam traps.' },
  { host: 'truncate.gbudb.net', name: 'GBUdb Truncate', desc: 'Real-time IP reputation and spam probability list.' },
];

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS query timeout')), ms)),
  ]);
}

export async function auditDomainDeliverability(rawInput: string): Promise<DomainAuditResult> {
  const startTime = Date.now();
  let domain = rawInput
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split('?')[0];

  const resolver = new dns.promises.Resolver();

  // 1. Resolve A records to get mail/host IP
  let ips: string[] = [];
  try {
    ips = await withTimeout(resolver.resolve4(domain), 2500);
  } catch {
    // Domain might still have MX records even without A record
  }

  // 2. Resolve MX Records
  let mxRecords: Array<{ exchange: string; priority: number }> = [];
  try {
    const rawMx = await withTimeout(resolver.resolveMx(domain), 2500);
    mxRecords = rawMx.sort((a, b) => a.priority - b.priority);
  } catch {
    // No MX found
  }

  let emailProvider: DomainAuditResult['emailProvider'] = 'No Mailserver';
  if (mxRecords.length > 0) {
    const mxStr = mxRecords.map((m) => m.exchange.toLowerCase()).join(' ');
    if (mxStr.includes('google') || mxStr.includes('aspmx')) {
      emailProvider = 'Google Workspace';
    } else if (mxStr.includes('outlook') || mxStr.includes('microsoft')) {
      emailProvider = 'Microsoft 365';
    } else if (mxStr.includes('zoho')) {
      emailProvider = 'Zoho Mail';
    } else {
      emailProvider = 'Custom / Self-Hosted';
    }
  }

  // 3. Resolve TXT records for SPF
  let txtRecords: string[][] = [];
  try {
    txtRecords = await withTimeout(resolver.resolveTxt(domain), 2500);
  } catch {
    // No TXT
  }

  const flatTxt = txtRecords.map((chunk) => chunk.join(''));
  const spfRecord = flatTxt.find((r) => r.toLowerCase().startsWith('v=spf1')) || null;

  let spfLookupCount = 0;
  let spfQualifier: DomainAuditResult['spf']['qualifier'] = 'none';
  const spfIssues: string[] = [];

  if (spfRecord) {
    const parts = spfRecord.split(/\s+/);
    // Count DNS lookup mechanisms
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (
        lower.startsWith('include:') ||
        lower.startsWith('a:') ||
        lower === 'a' ||
        lower.startsWith('mx:') ||
        lower === 'mx' ||
        lower.startsWith('ptr:') ||
        lower.startsWith('exists:') ||
        lower.startsWith('redirect=')
      ) {
        spfLookupCount++;
      }
    }

    if (spfRecord.includes('~all')) spfQualifier = '~all';
    else if (spfRecord.includes('-all')) spfQualifier = '-all';
    else if (spfRecord.includes('?all')) spfQualifier = '?all';
    else if (spfRecord.includes('+all')) spfQualifier = '+all';

    if (spfLookupCount > 10) {
      spfIssues.push(`SPF DNS lookup limit exceeded (${spfLookupCount}/10 maximum). RFC 7208 mandates a 10-lookup ceiling; exceeding this causes Google and Yahoo to throw PermError and reject messages.`);
    }

    if (spfQualifier === '+all') {
      spfIssues.push('SPF qualifier is set to "+all" (Pass all). This allows any unauthorized IP in the world to spoof your domain.');
    } else if (spfQualifier === '?all') {
      spfIssues.push('SPF qualifier is set to "?all" (Neutral). Outbound email will not pass strict spam filtering.');
    }
  } else {
    spfIssues.push('No SPF record found. Email sent from this domain will fail sender authentication.');
  }

  // 4. Resolve DMARC Record (_dmarc.<domain>)
  let dmarcTxt: string[][] = [];
  try {
    dmarcTxt = await withTimeout(resolver.resolveTxt(`_dmarc.${domain}`), 2500);
  } catch {
    // No DMARC
  }

  const flatDmarc = dmarcTxt.map((chunk) => chunk.join(''));
  const dmarcRecord = flatDmarc.find((r) => r.toLowerCase().startsWith('v=dmarc1')) || null;

  let dmarcPolicy: DomainAuditResult['dmarc']['policy'] = 'missing';
  let dmarcRua: string | null = null;
  const dmarcIssues: string[] = [];

  if (dmarcRecord) {
    const pMatch = dmarcRecord.match(/p=([a-z]+)/i);
    if (pMatch) {
      const pol = pMatch[1].toLowerCase();
      if (pol === 'reject') dmarcPolicy = 'reject';
      else if (pol === 'quarantine') dmarcPolicy = 'quarantine';
      else if (pol === 'none') dmarcPolicy = 'none';
    }

    const ruaMatch = dmarcRecord.match(/rua=([^;]+)/i);
    if (ruaMatch) {
      dmarcRua = ruaMatch[1].trim();
    }

    if (dmarcPolicy === 'none') {
      dmarcIssues.push('DMARC policy is set to "p=none" (monitoring only). While compliant for basic setup, modern outbound deliverability requires "p=quarantine" or "p=reject" to prevent domain spoofing.');
    }
  } else {
    dmarcIssues.push('No DMARC record found at _dmarc.' + domain + '. As of 2024, Google and Yahoo reject unauthenticated bulk emails missing DMARC.');
  }

  // 5. DKIM Selector Probe (Check standard selectors: google, default, selector1, k1)
  const commonSelectors = ['google', 'default', 'selector1', 'k1', 's1'];
  let dkimDetected = false;
  let dkimSelector: string | null = null;
  let dkimRaw: string | null = null;

  for (const sel of commonSelectors) {
    try {
      const dkimLookup = await withTimeout(resolver.resolveTxt(`${sel}._domainkey.${domain}`), 1500);
      const raw = dkimLookup.map((c) => c.join('')).join('');
      if (raw.toLowerCase().includes('v=dkim1') || raw.toLowerCase().includes('p=')) {
        dkimDetected = true;
        dkimSelector = sel;
        dkimRaw = raw;
        break;
      }
    } catch {
      // Selector not found, continue
    }
  }

  // 6. Real-time DNSBL / RBL Blacklist Checks
  const targetIp = ips[0] || '127.0.0.1';
  const reversedIp = targetIp.split('.').reverse().join('.');

  const blacklistResults: BlacklistCheckResult[] = [];
  let listedCount = 0;

  // Query blacklists in parallel with strict timeout
  const blPromises = DNSBL_SERVERS.map(async (server) => {
    const queryHost = `${reversedIp}.${server.host}`;
    try {
      const res = await withTimeout(resolver.resolve4(queryHost), 2000);
      if (res && res.length > 0) {
        listedCount++;
        return {
          host: server.host,
          name: server.name,
          listed: true,
          returnCode: res[0],
          description: server.desc,
        };
      }
    } catch {
      // ENOTFOUND means NOT listed (Clean!)
    }

    return {
      host: server.host,
      name: server.name,
      listed: false,
      description: server.desc,
    };
  });

  const resolvedBL = await Promise.all(blPromises);
  blacklistResults.push(...resolvedBL);

  // 7. Calculate Health Score and Status
  let score = 100;
  const passed: string[] = [];
  const warnings: string[] = [];
  const critical: string[] = [];

  // Blacklist deductions (Fatal)
  if (listedCount > 0) {
    score -= listedCount * 35;
    critical.push(`CRITICAL: Domain/IP is actively listed on ${listedCount} spam blacklist(s). Outbound emails are getting flagged directly into junk folders.`);
  } else {
    passed.push(`Clean across all ${DNSBL_SERVERS.length} major spam blacklists (Spamhaus, Barracuda, SpamCop, SORBS).`);
  }

  // MX checks
  if (mxRecords.length > 0) {
    passed.push(`Active mailserver configured (${emailProvider} • ${mxRecords[0].exchange})`);
  } else {
    score -= 30;
    critical.push('No MX records detected. Domain cannot receive bounce reports or incoming replies.');
  }

  // SPF checks
  if (spfRecord) {
    if (spfLookupCount <= 10 && spfQualifier !== '+all' && spfQualifier !== '?all') {
      passed.push(`Valid SPF record found (${spfLookupCount}/10 DNS lookups, qualifier: ${spfQualifier})`);
    } else if (spfLookupCount > 10) {
      score -= 20;
      critical.push(`SPF PermError: 10-lookup limit exceeded (${spfLookupCount} lookups). Google and Yahoo reject this.`);
    } else {
      score -= 10;
      warnings.push(`SPF qualifier "${spfQualifier}" is weak for outbound cold email.`);
    }
  } else {
    score -= 25;
    critical.push('Missing SPF record. Outbound mail fails sender authorization.');
  }

  // DMARC checks
  if (dmarcRecord) {
    if (dmarcPolicy === 'reject' || dmarcPolicy === 'quarantine') {
      passed.push(`Strict DMARC policy active (p=${dmarcPolicy}) with reporting configured.`);
    } else {
      score -= 10;
      warnings.push('DMARC policy is set to "p=none". Upgrade to quarantine or reject to protect sender reputation.');
    }
  } else {
    score -= 25;
    critical.push('Missing DMARC record (_dmarc.' + domain + '). Violates 2024-2026 bulk sender compliance.');
  }

  // DKIM checks
  if (dkimDetected) {
    passed.push(`DKIM signature public key discovered (selector: "${dkimSelector}").`);
  } else {
    warnings.push('Could not verify DKIM on common default selectors. Verify DKIM is signed by your sending ESP.');
  }

  score = Math.max(10, Math.min(100, score));

  let healthStatus: DomainAuditResult['healthStatus'] = 'OPTIMAL';
  if (score < 60 || critical.length > 0) {
    healthStatus = 'CRITICAL';
  } else if (score < 85 || warnings.length > 0) {
    healthStatus = 'AT_RISK';
  }

  let estimatedLostPipelineUsd = 0;
  if (healthStatus === 'CRITICAL') {
    estimatedLostPipelineUsd = 3200;
  } else if (healthStatus === 'AT_RISK') {
    estimatedLostPipelineUsd = 850;
  }

  const responseTimeMs = Date.now() - startTime;

  return {
    domain,
    scannedAt: new Date().toISOString(),
    responseTimeMs,
    healthScore: score,
    healthStatus,
    estimatedLostPipelineUsd,
    emailProvider,
    mx: {
      installed: mxRecords.length > 0,
      records: mxRecords,
    },
    spf: {
      installed: Boolean(spfRecord),
      rawRecord: spfRecord,
      lookupCount: spfLookupCount,
      lookupLimitExceeded: spfLookupCount > 10,
      qualifier: spfQualifier,
      issues: spfIssues,
    },
    dmarc: {
      installed: Boolean(dmarcRecord),
      rawRecord: dmarcRecord,
      policy: dmarcPolicy,
      rua: dmarcRua,
      isCompliant2026: dmarcPolicy === 'reject' || dmarcPolicy === 'quarantine',
      issues: dmarcIssues,
    },
    dkim: {
      detected: dkimDetected,
      testedSelector: dkimSelector,
      rawRecord: dkimRaw,
    },
    blacklists: {
      totalChecked: DNSBL_SERVERS.length,
      listedCount,
      cleanCount: DNSBL_SERVERS.length - listedCount,
      results: blacklistResults,
    },
    summary: {
      passed,
      warnings,
      critical,
    },
  };
}
