// lib/payments.ts
// Unified Payment Architecture supporting Stripe, Lemon Squeezy, or Custom MoR

export interface PaymentPlanConfig {
  id: 'free' | 'watchdog' | 'agency' | 'enterprise';
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  monthlyCheckoutUrl?: string;
  annualCheckoutUrl?: string;
  domainLimit: number;
  checkFrequencyMinutes: number;
  features: string[];
}

export const PAYMENT_PLANS: Record<string, PaymentPlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Inspector',
    monthlyPrice: 0,
    annualPrice: 0,
    domainLimit: 1,
    checkFrequencyMinutes: 0, // on-demand
    features: [
      'Unlimited manual DNS & blacklist audits',
      'Spamhaus, Barracuda, and SpamCop reputation checks',
      'DMARC & SPF 10-lookup PermError diagnostics',
      '1-click copyable DMARC TXT repair record',
    ],
  },
  watchdog: {
    id: 'watchdog',
    name: 'Outbound Watchdog',
    monthlyPrice: 49,
    annualPrice: 39,
    monthlyCheckoutUrl: process.env.NEXT_PUBLIC_STRIPE_WATCHDOG_MONTHLY_URL || '',
    annualCheckoutUrl: process.env.NEXT_PUBLIC_STRIPE_WATCHDOG_ANNUAL_URL || '',
    domainLimit: 5,
    checkFrequencyMinutes: 15,
    features: [
      'Up to 5 active sending domains',
      'Automated background checks every 15 minutes',
      'Instant Slack & Discord webhook siren alarms',
      'SPF 10-lookup PermError alerts',
      'Real-time DNSBL query latency telemetry',
      'Zero mailbox access • 100% passive DNS queries',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency Fleet',
    monthlyPrice: 149,
    annualPrice: 119,
    monthlyCheckoutUrl: process.env.NEXT_PUBLIC_STRIPE_AGENCY_MONTHLY_URL || '',
    annualCheckoutUrl: process.env.NEXT_PUBLIC_STRIPE_AGENCY_ANNUAL_URL || '',
    domainLimit: 30,
    checkFrequencyMinutes: 15,
    features: [
      'Up to 30 active client sending domains',
      'Automated 15-minute background sweeps',
      'Slack, Discord & Telegram channel sirens',
      'Custom HTTP JSON webhook endpoints',
      'Priority parallel DNS resolvers',
      'Exportable client deliverability audit reports',
    ],
  },
};

export function getCheckoutUrl(planId: 'watchdog' | 'agency', billingCycle: 'monthly' | 'annual'): string {
  const plan = PAYMENT_PLANS[planId];
  if (!plan) return '';
  return billingCycle === 'annual'
    ? (plan.annualCheckoutUrl || '')
    : (plan.monthlyCheckoutUrl || '');
}
