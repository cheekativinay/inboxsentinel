import fs from 'fs';
import path from 'path';

export interface MonitoredDomain {
  id: string;
  domain: string;
  label: string;
  intervalMinutes: number; // 15, 30, 60
  channel: 'slack' | 'discord' | 'telegram' | 'webhook';
  webhookUrl: string;
  status: 'optimal' | 'at_risk' | 'critical';
  lastCheckedAt: string | null;
  lastResponseTimeMs: number | null;
  dmarcPolicy: string;
  spfLookupCount: number;
  blacklistedOn: string[];
  issues: string[];
  createdAt: string;
}

export interface CheckLog {
  id: string;
  domain: string;
  checkedAt: string;
  status: 'optimal' | 'at_risk' | 'critical';
  responseTimeMs: number;
  blacklistedCount: number;
  dmarcPolicy: string;
  issues: string[];
  alertDispatched: boolean;
  channel?: string;
}

function getDataDir(): string {
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'inboxsentinel_data');
  }
  return path.join(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();
const MONITORS_FILE = path.join(DATA_DIR, 'monitors.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

const DEFAULT_DOMAINS: MonitoredDomain[] = [
  {
    id: 'dom_stripe',
    domain: 'stripe.com',
    label: 'Stripe Corporate Outbound',
    intervalMinutes: 15,
    channel: 'slack',
    webhookUrl: '',
    status: 'optimal',
    lastCheckedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    lastResponseTimeMs: 480,
    dmarcPolicy: 'reject',
    spfLookupCount: 3,
    blacklistedOn: [],
    issues: [],
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'dom_unaligned',
    domain: 'demo-unaligned-outbound.com',
    label: 'Client Outbound Pool 2',
    intervalMinutes: 15,
    channel: 'slack',
    webhookUrl: '',
    status: 'at_risk',
    lastCheckedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    lastResponseTimeMs: 510,
    dmarcPolicy: 'none',
    spfLookupCount: 9,
    blacklistedOn: [],
    issues: ['DMARC policy set to p=none (Fails Google 2026 bulk sender rule).'],
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'dom_blacklisted_demo',
    domain: 'demo-flagged-sender.com',
    label: 'Secondary Cold SDR Domain',
    intervalMinutes: 15,
    channel: 'discord',
    webhookUrl: '',
    status: 'critical',
    lastCheckedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    lastResponseTimeMs: 420,
    dmarcPolicy: 'missing',
    spfLookupCount: 12,
    blacklistedOn: ['Spamhaus ZEN', 'Barracuda Rep'],
    issues: ['Actively listed on Spamhaus ZEN', 'SPF PermError: 12 lookups exceeds RFC limit of 10'],
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
];

const DEFAULT_LOGS: CheckLog[] = [
  {
    id: 'log_1',
    domain: 'demo-flagged-sender.com',
    checkedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    status: 'critical',
    responseTimeMs: 420,
    blacklistedCount: 2,
    dmarcPolicy: 'missing',
    issues: ['Actively listed on Spamhaus ZEN', 'SPF PermError: 12 lookups exceeds RFC limit of 10'],
    alertDispatched: true,
    channel: 'discord',
  },
  {
    id: 'log_2',
    domain: 'stripe.com',
    checkedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    status: 'optimal',
    responseTimeMs: 480,
    blacklistedCount: 0,
    dmarcPolicy: 'reject',
    issues: [],
    alertDispatched: false,
  },
  {
    id: 'log_3',
    domain: 'demo-unaligned-outbound.com',
    checkedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    status: 'at_risk',
    responseTimeMs: 510,
    blacklistedCount: 0,
    dmarcPolicy: 'none',
    issues: ['DMARC policy set to p=none'],
    alertDispatched: false,
  },
];

// In-memory fallback in case filesystem is restricted
let inMemoryDomains: MonitoredDomain[] = [...DEFAULT_DOMAINS];
let inMemoryLogs: CheckLog[] = [...DEFAULT_LOGS];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getMonitoredDomains(): MonitoredDomain[] {
  try {
    ensureDir();
    if (!fs.existsSync(MONITORS_FILE)) {
      fs.writeFileSync(MONITORS_FILE, JSON.stringify(DEFAULT_DOMAINS, null, 2), 'utf-8');
      inMemoryDomains = [...DEFAULT_DOMAINS];
      return DEFAULT_DOMAINS;
    }
    const raw = fs.readFileSync(MONITORS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryDomains = parsed;
    return parsed;
  } catch {
    return inMemoryDomains;
  }
}

export function saveMonitoredDomains(domains: MonitoredDomain[]) {
  inMemoryDomains = [...domains];
  try {
    ensureDir();
    fs.writeFileSync(MONITORS_FILE, JSON.stringify(domains, null, 2), 'utf-8');
  } catch (err) {
    console.error('Filesystem write notice (using in-memory cache):', err);
  }
}

export function getCheckLogs(): CheckLog[] {
  try {
    ensureDir();
    if (!fs.existsSync(LOGS_FILE)) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(DEFAULT_LOGS, null, 2), 'utf-8');
      inMemoryLogs = [...DEFAULT_LOGS];
      return DEFAULT_LOGS;
    }
    const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryLogs = parsed;
    return parsed;
  } catch {
    return inMemoryLogs;
  }
}

export function appendCheckLog(log: CheckLog) {
  inMemoryLogs.unshift(log);
  inMemoryLogs = inMemoryLogs.slice(0, 50);
  try {
    const logs = getCheckLogs();
    logs.unshift(log);
    const trimmed = logs.slice(0, 50);
    ensureDir();
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Filesystem log notice (using in-memory cache):', err);
  }
}
