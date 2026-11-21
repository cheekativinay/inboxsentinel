// lib/security.ts
// Comprehensive Security Shield: SSRF Defense, Rate Limiting, Input Sanitization & Webhook Guards

import dns from 'dns/promises';

/**
 * Checks whether an IPv4 address falls within private, loopback, link-local,
 * carrier-grade NAT, or cloud metadata IP ranges.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 100.64.0.0/10 (Shared / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure/Vercel metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is loopback, unique local (private), or link-local.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local fc00::/7
  if (normalized.startsWith('fe80:')) return true; // Link-local fe80::/10
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    const ipv4 = normalized.replace('::ffff:', '');
    return isPrivateOrReservedIPv4(ipv4);
  }
  return false;
}

/**
 * Strict SSRF Pre-flight Validation for Webhook URLs.
 * Validates protocol, hostname, credentials, and performs DNS resolution to block DNS rebinding to internal infrastructure.
 */
export async function validateSafeWebhookUrl(rawUrl: string): Promise<{ valid: boolean; error?: string }> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Webhook URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Webhook URL exceeds maximum length (2048 chars).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed webhook URL syntax.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Webhooks must use the secure HTTPS protocol.' };
  }

  // Disallow non-standard ports to prevent internal port scanning
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: 'Webhooks are restricted to standard HTTPS port 443.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Basic authentication credentials in webhook URLs are prohibited.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Fast-path string checks
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home.arpa')
  ) {
    return { valid: false, error: 'Local, internal, and link-local destinations are rejected.' };
  }

  // Check if hostname is a raw IP literal
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return { valid: false, error: 'Private and reserved IP addresses are prohibited.' };
    }
  }

  // Deep DNS resolution check to prevent DNS rebinding attacks
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: 'Webhook host could not be resolved.' };
    }

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateOrReservedIPv4(addr.address)) {
        return {
          valid: false,
          error: `Security violation: Webhook hostname resolves to restricted IP (${addr.address}).`,
        };
      }
      if (addr.family === 6 && isPrivateOrReservedIPv6(addr.address)) {
        return {
          valid: false,
          error: `Security violation: Webhook hostname resolves to restricted IPv6 (${addr.address}).`,
        };
      }
    }
  } catch {
    return { valid: false, error: 'DNS resolution failed for webhook host.' };
  }

  return { valid: true };
}

/**
 * In-Memory Sliding-Window Rate Limiter
 * Provides DDoS, brute-force, and socket-exhaustion defense with automatic TTL cleanup.
 */
interface RateLimitBucket {
  timestamps: number[];
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Automatically clean up stale keys every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitBuckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < 120000);
      if (bucket.timestamps.length === 0) {
        rateLimitBuckets.delete(key);
      }
    }
  }, 300000).unref?.();
}

export function checkRateLimit(
  clientIdentifier: string,
  maxRequests: number = 20,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTimeMs: number } {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(clientIdentifier);

  if (!bucket) {
    bucket = { timestamps: [] };
    rateLimitBuckets.set(clientIdentifier, bucket);
  }

  // Prune expired timestamps outside current sliding window
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0];
    const resetTimeMs = windowMs - (now - oldest);
    return {
      allowed: false,
      remaining: 0,
      resetTimeMs: Math.max(resetTimeMs, 1000),
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - bucket.timestamps.length,
    resetTimeMs: windowMs,
  };
}

/**
 * Extract Client IP from Request Headers (supporting proxies like Vercel, Cloudflare, Netlify).
 */
export function getClientIp(headers: Headers): string {
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return first;
  }
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();
  return '127.0.0.1';
}

/**
 * Secure Webhook Dispatcher
 * Pre-checks SSRF, enforces a 4-second timeout, limits payload size, and catches network failures.
 */
export async function dispatchSecureWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const validation = await validateSafeWebhookUrl(webhookUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const jsonPayload = JSON.stringify(payload);
  if (jsonPayload.length > 32768) {
    return { success: false, error: 'Payload exceeds maximum webhook size limit (32KB).' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'InboxSentinel-Watchdog/1.0 (+https://inboxsentinel.vercel.app)',
      },
      body: jsonPayload,
      redirect: 'error', // Block redirect SSRF attacks (CWE-918)
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `Webhook server responded with HTTP status ${response.status}`,
      };
    }

    return { success: true, statusCode: response.status };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Webhook request timed out (4000ms limit exceeded).' };
    }
    const msg = err instanceof Error ? err.message : 'Webhook dispatch error';
    return { success: false, error: msg };
  }
}
