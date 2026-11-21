import fs from 'fs';
import path from 'path';

export interface MonitoredDomain {
  id: string;
  domain: string;
  label: string;
  intervalMinutes: number; // 15, 30, 60
  channel: 'slack' | 'discord' | 'telegram' | 'webhook';
  webhookUrl: string;
  status: 'optimal' | 'at_risk' | 'critical' | 'unconfigured' | 'error';
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
  status: 'optimal' | 'at_risk' | 'critical' | 'unconfigured' | 'error';
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
    label: 'Primary Sending Domain',
    intervalMinutes: 15,
    channel: 'slack',
    webhookUrl: '',
    status: 'optimal',
    lastCheckedAt: null,
    lastResponseTimeMs: null,
    dmarcPolicy: 'reject',
    spfLookupCount: 3,
    blacklistedOn: [],
    issues: [],
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_LOGS: CheckLog[] = [];

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
