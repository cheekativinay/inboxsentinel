import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | InboxSentinel',
  description: 'Terms of service, zero-liability disclaimers, and fair use policies for InboxSentinel domain monitoring.',
};

export default function TermsPage() {
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
            <span>Legal Specification · Last Updated November 2026</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Please read these terms carefully before utilizing InboxSentinel observability services and automated DNSBL tripwires.
          </p>
        </header>

        <section className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300">
            <strong className="block text-xs font-semibold mb-1">ISP Delivery & Inbox Placement Disclaimer</strong>
            InboxSentinel is a technical monitoring and alerting tool. We do not and cannot guarantee 100% email delivery or inbox placement to third-party mailbox providers.
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">1. Nature of the Service</h2>
            <p>
              InboxSentinel provides automated diagnostics of public DNSBL spam blacklists, SPF lookup ceilings, and DMARC enforcement policies. Alert sirens are dispatched on best-effort passive socket triggers.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">2. Third-Party Mailbox Algorithms</h2>
            <p>
              Recipient email providers (including Google Workspace, Microsoft 365, and Yahoo Mail) employ autonomous heuristic spam filters influenced by factors outside InboxSentinel&apos;s control, including sender copy, sending volume, prospect engagement, and IP reputation.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">3. Fair Use & Prohibited Conduct</h2>
            <p>
              Users agree not to use InboxSentinel to target, probe, or scan unauthorized networks, private subnets, localhost endpoints, or engage in denial-of-service attempts. Violations result in immediate domain termination.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">4. Non-Affiliation Notice</h2>
            <p>
              Spamhaus, Barracuda Networks, SpamCop, Invaluement, Google Workspace, and Microsoft are independent trademarks of their respective entities. InboxSentinel is an independent observability tool not sponsored or endorsed by these organizations.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">5. Limitation of Liability</h2>
            <p>
              InboxSentinel is provided on an &ldquo;AS-IS&rdquo; basis. Under no circumstances shall InboxSentinel or its operators be liable for lost sales pipeline, lost revenue, missed email deliveries, or domain blacklisting damages.
            </p>
          </div>
        </section>

        <footer className="pt-8 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center justify-between">
          <span>InboxSentinel Legal Center</span>
          <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline">
            View Privacy Policy →
          </Link>
        </footer>
      </div>
    </main>
  );
}
