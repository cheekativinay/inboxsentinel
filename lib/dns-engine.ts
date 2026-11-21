import dns from 'dns';

export interface BlacklistCheckResult {
  host: string;
  name: string;
  type: 'domain' | 'ip';
  target: string;
  listed: boolean;
  returnCode?: string;
  description: string;
  notice?: string;
}

export type DeliverabilityHealthStatus =
  | 'OPTIMAL'
  | 'AT_RISK'
  | 'CRITICAL_BLACKLISTED'
  | 'CONFIGURATION_ERROR'
  | 'UNCONFIGURED';

export interface DomainAuditResult {
  domain: string;
  scannedAt: string;
  responseTimeMs: number;
  healthScore: number;
  healthStatus: DeliverabilityHealthStatus;
  statusLabel: string;
  statusDescription: string;
  estimatedLostPipelineUsd: number;
  emailProvider: 'Google Workspace' | 'Microsoft 365' | 'Zoho Mail' | 'Custom / Self-Hosted' | 'No Mailserver';
  mx: {
    installed: boolean;
    records: Array<{ exchange: string; priority: number; resolvedIp?: string }>;
  };
  spf: {
    installed: boolean;
    status: 'valid' | 'missing' | 'fail';
    rawRecord: string | null;
    lookupCount: number;
    lookupLimitExceeded: boolean; // RFC 7208 limit is 10
    qualifier: '~all' | '-all' | '?all' | '+all' | 'none';
    issues: string[];
  };
  dmarc: {
    installed: boolean;
    rawRecord: string | null;
    policy: 'reject' | 'quarantine' | 'none' | 'missing';
    rua: string | null;
    isCompliantGoogleYahoo2024: boolean;
    recommendedRecord: string;
    rolloutPhase: string;
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
    openResolverWarnings: number;
    results: BlacklistCheckResult[];
  };
  summary: {
    passed: string[];
    warnings: string[];
    critical: string[];
  };
}

// 1. True Domain-Based Blacklists (Query format: <domain>.<host>)
const DOMAIN_BLACKLISTS = [
  {
    host: 'dbl.spamhaus.org',
    name: 'Spamhaus DBL (Domain)',
    type: 'domain' as const,
    desc: 'Spamhaus Domain Block List. Checks domain reputation directly across phishing, malware, and spam sources.',
  },
  {
    host: 'multi.surbl.org',
    name: 'SURBL (Domain URI)',
    type: 'domain' as const,
    desc: 'SURBL multi-list domain reputation. Detects domains appearing in unsolicited emails.',
  },
];

// 2. Mailserver IP Blacklists (Query format: <reversed-mx-ip>.<host>)
// NOTE: SORBS was shut down in June 2024 and has been permanently removed.
const IP_BLACKLISTS = [
  {
    host: 'zen.spamhaus.org',
    name: 'Spamhaus ZEN (Mail IP)',
    type: 'ip' as const,
    desc: 'Combined SBL, XBL, and PBL IP reputation list. Checks the sending mailserver IP.',
  },
  {
    host: 'bl.spamcop.net',
    name: 'SpamCop (Mail IP)',
    type: 'ip' as const,
    desc: 'Automated real-time user-reported spam trap database for sending mailserver IPs.',
  },
  {
    host: 'b.barracudacentral.org',
    name: 'Barracuda Rep (Mail IP)',
    type: 'ip' as const,
    desc: 'Barracuda Central IP reputation list used widely across enterprise email gateways.',
  },
  {
    host: 'psbl.surriel.com',
    name: 'PSBL (Mail IP)',
    type: 'ip' as const,
    desc: 'Passive Spam Block List based on automated trap hits.',
  },
];

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS query timeout')), ms)),
  ]);
}

// Security: Validates domain to prevent SSRF and internal network probing
export function validateAndSanitizeDomain(rawInput: string): { valid: boolean; domain: string; error?: string } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, domain: '', error: 'Domain name is required.' };
  }

  const cleaned = rawInput
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0]; // Remove port if present

  if (!cleaned || cleaned.length > 253) {
    return { valid: false, domain: '', error: 'Domain name must be between 1 and 253 characters.' };
  }

  // Reject IP addresses (IPv4 & IPv6)
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
  const isIpv6 = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(cleaned);
  if (isIpv4 || isIpv6) {
    return { valid: false, domain: '', error: 'Direct IP addresses are not permitted. Please provide an outbound domain name (e.g., yourcompany.com).' };
  }

  // Reject private / non-routable hostnames
  const forbiddenNames = ['localhost', 'broadcasthost'];
  const forbiddenSuffixes = ['.local', '.internal', '.lan', '.test', '.example', '.invalid', '.home', '.corp'];
  if (forbiddenNames.includes(cleaned) || forbiddenSuffixes.some((suffix) => cleaned.endsWith(suffix))) {
    return { valid: false, domain: '', error: 'Internal, local, and test domains cannot be monitored.' };
  }

  // Strict FQDN regex
  const fqdnRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  if (!fqdnRegex.test(cleaned)) {
    return { valid: false, domain: '', error: 'Invalid domain syntax. Please provide a standard domain name (e.g., acme-mail.com).' };
  }

  // Ensure TLD is at least 2 characters and conforms to ICANN/RFC 1123 standards (no purely numeric TLDs)
  const parts = cleaned.split('.');
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || !/^[a-z]{2,}$|^xn--[a-z0-9]+$/i.test(tld)) {
    return { valid: false, domain: '', error: 'Invalid top-level domain (TLD). TLD must be alphabetic or valid punycode.' };
  }

  return { valid: true, domain: cleaned };
}

// Security: Validates outbound webhooks to prevent SSRF
export function validateWebhookUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Webhook URL is required.' };
  }

  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Webhooks must use secure HTTPS protocol.' };
    }

    const host = parsed.hostname.toLowerCase();

    // Disallow localhost and private IP ranges
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return { valid: false, error: 'Private, internal, or loopback webhook destinations are rejected.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed webhook URL syntax.' };
  }
}

export async function auditDomainDeliverability(rawInput: string): Promise<DomainAuditResult> {
  const startTime = Date.now();
  const validation = validateAndSanitizeDomain(rawInput);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid domain');
  }
  const domain = validation.domain;

  const resolver = new dns.promises.Resolver();

  // 1. Resolve MX Records (Primary routing for email delivery)
  let mxRecords: Array<{ exchange: string; priority: number; resolvedIp?: string }> = [];
  try {
    const rawMx = await withTimeout(resolver.resolveMx(domain), 2500);
    mxRecords = rawMx.sort((a, b) => a.priority - b.priority);
  } catch {
    // No MX records found
  }

  let emailProvider: DomainAuditResult['emailProvider'] = 'No Mailserver';
  let primaryMxIp: string | null = null;

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

    // Resolve primary MX exchange to IPv4 to accurately test mailserver IP blacklists
    try {
      const resolved = await withTimeout(resolver.resolve4(mxRecords[0].exchange), 2000);
      if (resolved && resolved.length > 0) {
        primaryMxIp = resolved[0];
        mxRecords[0].resolvedIp = primaryMxIp;
      }
    } catch {
      // Could not resolve MX host IP
    }
  }

  // 2. Resolve TXT records for SPF
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
  const isSpfInstalled = Boolean(spfRecord);

  if (spfRecord) {
    const parts = spfRecord.split(/\s+/);
    for (const part of parts) {
      const lower = part.toLowerCase();
      // Strip leading RFC 7208 qualifier (+, -, ~, ?) before matching mechanism name
      const mechanism = lower.replace(/^[+\-~?]/, '');
      if (
        mechanism.startsWith('include:') ||
        mechanism.startsWith('a:') ||
        mechanism === 'a' ||
        mechanism.startsWith('mx:') ||
        mechanism === 'mx' ||
        mechanism.startsWith('ptr:') ||
        mechanism.startsWith('exists:') ||
        mechanism.startsWith('redirect=')
      ) {
        spfLookupCount++;
      }
    }

    if (spfRecord.includes('~all')) spfQualifier = '~all';
    else if (spfRecord.includes('-all')) spfQualifier = '-all';
    else if (spfRecord.includes('?all')) spfQualifier = '?all';
    else if (spfRecord.includes('+all')) spfQualifier = '+all';

    if (spfLookupCount > 10) {
      spfIssues.push(`SPF PermError: ${spfLookupCount}/10 lookup limit exceeded (RFC 7208). Google & Yahoo reject mail exceeding this limit.`);
    }

    if (spfQualifier === '+all') {
      spfIssues.push('SPF qualifier is "+all" (Pass all), which allows anyone to send on your behalf.');
    } else if (spfQualifier === '?all') {
      spfIssues.push('SPF qualifier is "?all" (Neutral), which provides weak authentication for cold outbound.');
    }
  } else {
    spfIssues.push('No SPF TXT record found. Outbound emails will fail SPF authentication.');
  }

  const spfStatus: DomainAuditResult['spf']['status'] = !isSpfInstalled
    ? 'missing'
    : spfLookupCount > 10
    ? 'fail'
    : 'valid';

  // 3. Resolve DMARC Record (_dmarc.<domain>)
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
    // Assert start-of-record or semicolon delimiter to prevent 'sp=reject' from matching 'p=reject'
    const pMatch = dmarcRecord.match(/(?:^|;\s*)p=([a-z]+)/i);
    if (pMatch) {
      const pol = pMatch[1].toLowerCase();
      if (pol === 'reject') dmarcPolicy = 'reject';
      else if (pol === 'quarantine') dmarcPolicy = 'quarantine';
      else if (pol === 'none') dmarcPolicy = 'none';
    }

    const ruaMatch = dmarcRecord.match(/(?:^|;\s*)rua=([^;]+)/i);
    if (ruaMatch) {
      dmarcRua = ruaMatch[1].trim();
    }

    if (dmarcPolicy === 'none') {
      dmarcIssues.push('DMARC policy is set to "p=none" (monitoring mode). Fully meets Google/Yahoo 2024 compliance; advance to quarantine/reject once alignment is confirmed.');
    }
  } else {
    dmarcIssues.push('No DMARC record found at _dmarc.' + domain + '. Senders of 5,000+ daily emails to Google/Yahoo require DMARC with at least p=none.');
  }

  // Google & Yahoo 2024 Bulk Sender rules require DMARC with at least p=none
  const isCompliantGoogleYahoo2024 = dmarcPolicy !== 'missing';

  // Safe DMARC Recommendation: If domain has no MX, warn that rua must use a working mail domain
  const reportingMailbox = mxRecords.length > 0
    ? `dmarc-reports@${domain}`
    : `reports@your-primary-domain.com`;

  const recommendedDmarcRecord = `v=DMARC1; p=none; pct=100; rua=mailto:${reportingMailbox}; sp=none; aspf=r;`;

  // 4. DKIM Selector Probe
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
      // Continue
    }
  }

  // 5. Blacklist Observability (Domain DBL + Mailserver IP RBL)
  const blacklistResults: BlacklistCheckResult[] = [];
  let listedCount = 0;
  let openResolverWarnings = 0;

  // A. Check Domain Blacklists (DBL, SURBL)
  const domainBlPromises = DOMAIN_BLACKLISTS.map(async (server) => {
    const queryHost = `${domain}.${server.host}`;
    try {
      const res = await withTimeout(resolver.resolve4(queryHost), 2000);
      if (res && res.length > 0) {
        const returnCode = res[0];

        // Spamhaus DBL: 127.0.1.255 indicates query refusal via open/public resolver
        if (server.host.includes('spamhaus') && returnCode === '127.0.1.255') {
          openResolverWarnings++;
          return {
            host: server.host,
            name: server.name,
            type: server.type,
            target: domain,
            listed: false,
            returnCode,
            description: server.desc,
            notice: 'Spamhaus public resolver query limit (Requires direct DNS resolver or registered DQS key).',
          };
        }

        listedCount++;
        return {
          host: server.host,
          name: server.name,
          type: server.type,
          target: domain,
          listed: true,
          returnCode,
          description: server.desc,
        };
      }
    } catch {
      // ENOTFOUND = Clean
    }

    return {
      host: server.host,
      name: server.name,
      type: server.type,
      target: domain,
      listed: false,
      description: server.desc,
    };
  });

  // B. Check Mailserver IP Blacklists (Only if MX records exist and primary IP resolved)
  const ipBlPromises = IP_BLACKLISTS.map(async (server) => {
    if (!primaryMxIp) {
      return {
        host: server.host,
        name: server.name,
        type: server.type,
        target: 'No MX IP',
        listed: false,
        description: server.desc,
        notice: 'Skipped: Domain has no configured mailserver IP.',
      };
    }

    const reversedMxIp = primaryMxIp.split('.').reverse().join('.');
    const queryHost = `${reversedMxIp}.${server.host}`;

    try {
      const res = await withTimeout(resolver.resolve4(queryHost), 2000);
      if (res && res.length > 0) {
        const returnCode = res[0];

        // Spamhaus ZEN: 127.255.255.0/24 indicates query refusal or rate-limit code
        if (server.host.includes('spamhaus') && returnCode.startsWith('127.255.255.')) {
          openResolverWarnings++;
          return {
            host: server.host,
            name: server.name,
            type: server.type,
            target: primaryMxIp,
            listed: false,
            returnCode,
            description: server.desc,
            notice: 'Spamhaus public resolver refusal code (Requires direct DNS resolver or registered DQS key).',
          };
        }

        listedCount++;
        return {
          host: server.host,
          name: server.name,
          type: server.type,
          target: primaryMxIp,
          listed: true,
          returnCode,
          description: server.desc,
        };
      }
    } catch {
      // ENOTFOUND = Clean
    }

    return {
      host: server.host,
      name: server.name,
      type: server.type,
      target: primaryMxIp,
      listed: false,
      description: server.desc,
    };
  });

  const [resolvedDomainBL, resolvedIpBL] = await Promise.all([
    Promise.all(domainBlPromises),
    Promise.all(ipBlPromises),
  ]);

  blacklistResults.push(...resolvedDomainBL, ...resolvedIpBL);

  // 6. Transparent, Accurate Health Status Determination
  const passed: string[] = [];
  const warnings: string[] = [];
  const critical: string[] = [];

  let healthStatus: DeliverabilityHealthStatus = 'OPTIMAL';
  let statusLabel = 'Optimal Deliverability';
  let statusDescription = 'Domain records and mailservers passed standard deliverability checks.';
  let score = 100;

  // CASE 1: UNCONFIGURED DOMAIN (No MX records)
  if (mxRecords.length === 0) {
    healthStatus = 'UNCONFIGURED';
    statusLabel = 'Unconfigured (No Mail Records)';
    statusDescription = 'This domain has no MX records. It is not configured to send or receive emails.';
    score = 0; // Distinct from "Burned / Blacklisted"
    critical.push('No MX records detected. Domain cannot receive incoming emails or bounce reports.');

    if (!isSpfInstalled) {
      warnings.push('No SPF record found (Not configured for email sending).');
    }
    if (dmarcPolicy === 'missing') {
      warnings.push('No DMARC record found (Not configured for email sending).');
    }

    if (listedCount > 0) {
      critical.push(`Domain is flagged on ${listedCount} domain blacklist(s).`);
    } else {
      passed.push('Domain name is clean across verified domain reputation lists (DBL, SURBL).');
    }
  }
  // CASE 2: ACTIVELY BLACKLISTED (Domain or Mailserver IP is on a blacklist)
  else if (listedCount > 0) {
    healthStatus = 'CRITICAL_BLACKLISTED';
    statusLabel = 'Blacklist Alert Detected';
    statusDescription = `Domain or mailserver IP is actively listed on ${listedCount} spam blacklist(s). Outbound emails are at high risk of spam folder placement.`;
    score = Math.max(10, 100 - listedCount * 40);
    critical.push(`Domain or sending IP is actively flagged on ${listedCount} blacklist authority(ies).`);
  }
  // CASE 3: CONFIGURATION ERROR (SPF PermError > 10 lookups or syntax breakage)
  else if (spfLookupCount > 10) {
    healthStatus = 'CONFIGURATION_ERROR';
    statusLabel = 'SPF PermError (Exceeds Limit)';
    statusDescription = `SPF record requires ${spfLookupCount} DNS lookups, exceeding the RFC 7208 hard limit of 10. Major providers reject these messages.`;
    score = 45;
    critical.push(`SPF PermError: ${spfLookupCount}/10 DNS lookups exceeds RFC 7208 ceiling.`);
  }
  // CASE 4: AT RISK (Missing SPF, Missing DMARC, or weak qualifier on an active mail domain)
  else if (!isSpfInstalled || dmarcPolicy === 'missing' || dmarcPolicy === 'none' || spfLookupCount > 7) {
    healthStatus = 'AT_RISK';
    statusLabel = 'At Risk: Incomplete Authentication';
    statusDescription = 'Domain has active mailservers, but authentication records are incomplete or unaligned.';
    score = 75;

    if (!isSpfInstalled) {
      score -= 20;
      critical.push('Missing SPF record. Outbound emails will fail sender authorization.');
    } else if (spfLookupCount > 7) {
      warnings.push(`SPF lookup count is high (${spfLookupCount}/10). Adding additional tools may trigger PermError.`);
    }

    if (dmarcPolicy === 'missing') {
      score -= 20;
      warnings.push('Missing DMARC record. Bulk email to Google and Yahoo requires a DMARC policy.');
    } else if (dmarcPolicy === 'none') {
      warnings.push('DMARC is in monitoring mode (p=none). Advance to quarantine or reject as alignment matures.');
    }
  }
  // CASE 5: OPTIMAL
  else {
    healthStatus = 'OPTIMAL';
    statusLabel = 'Optimal Deliverability';
    statusDescription = 'Domain records, SPF, DMARC, and mailserver IP reputation are fully aligned.';
    score = 100;
    passed.push(`Mailserver verified (${emailProvider} • ${mxRecords[0].exchange})`);
    passed.push(`Valid SPF record (${spfLookupCount}/10 DNS lookups consumed)`);
    passed.push(`Enforced DMARC policy (p=${dmarcPolicy})`);
    passed.push(`Clean across all ${blacklistResults.length} domain and mailserver blacklist checks`);
  }

  const responseTimeMs = Date.now() - startTime;

  return {
    domain,
    scannedAt: new Date().toISOString(),
    responseTimeMs,
    healthScore: score,
    healthStatus,
    statusLabel,
    statusDescription,
    estimatedLostPipelineUsd: 0,
    emailProvider,
    mx: {
      installed: mxRecords.length > 0,
      records: mxRecords,
    },
    spf: {
      installed: isSpfInstalled,
      status: spfStatus,
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
      isCompliantGoogleYahoo2024,
      recommendedRecord: recommendedDmarcRecord,
      rolloutPhase: 'Phase 1: Monitoring (p=none) -> Phase 2: Quarantine -> Phase 3: Reject',
      issues: dmarcIssues,
    },
    dkim: {
      detected: dkimDetected,
      testedSelector: dkimSelector,
      rawRecord: dkimRaw,
    },
    blacklists: {
      totalChecked: blacklistResults.length,
      listedCount,
      cleanCount: blacklistResults.length - listedCount,
      openResolverWarnings,
      results: blacklistResults,
    },
    summary: {
      passed,
      warnings,
      critical,
    },
  };
}
