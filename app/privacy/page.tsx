import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | InboxSentinel',
  description: 'Zero-PII retention and public DNS observability privacy policy for InboxSentinel.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-telemetry text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to InboxSentinel</span>
        </Link>

        <header className="space-y-3 border-b border-[var(--border-subtle)] pb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[10px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
            <Shield className="h-3 w-3 text-emerald-500" />
            <span>Zero-PII Architecture · Last Updated November 2026</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            InboxSentinel is built around a foundational Zero-Access guarantee: we never access your email content, inbox databases, or credentials.
          </p>
        </header>

        <section className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <strong className="block text-xs font-semibold mb-1">Zero Personally Identifiable Information (PII) Guarantee</strong>
            InboxSentinel is an infrastructure observability service. We never collect, inspect, process, or store email messages, prospect databases, or mailbox passwords.
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">1. What We Collect</h2>
            <p>
              We store only customer-provided domain names, optional campaign labels, alert dispatch webhook endpoints, and public DNS telemetry logs resulting from diagnostic sweeps.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">2. How Data is Gathered</h2>
            <p>
              All domain diagnostic scans execute read-only queries against global public internet root servers (DNS RFC 1035, SPF RFC 7208, DMARC RFC 7489). These records are public internet data and not subject to private data ownership laws.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">3. GDPR, CCPA & CAN-SPAM Status</h2>
            <p>
              Because InboxSentinel operates strictly with non-personal public technical infrastructure records, customer use is fully GDPR and CCPA compliant by design. We do not transmit commercial electronic marketing messages on behalf of any user.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">4. Zero Data Monetization</h2>
            <p>
              We never sell, lease, rent, or trade customer domain lists, telemetry logs, or webhook endpoints to third parties or advertising networks.
            </p>
          </div>
        </section>

        <footer className="pt-8 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center justify-between">
          <span>InboxSentinel Privacy & Security</span>
          <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline">
            View Terms of Service →
          </Link>
        </footer>
      </div>
    </main>
  );
}
