import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Newsreader, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://inboxsentinel.vercel.app'),
  title: 'InboxSentinel | B2B Outbound Deliverability Watchdog',
  description:
    'Continuous diagnostic monitoring for B2B cold outbound domains. Real-time Spamhaus blacklists, DMARC alignment, and SPF 10-lookup PermError detection.',
  keywords: [
    'email deliverability',
    'domain watchdog',
    'Spamhaus blacklist check',
    'cold email deliverability',
    'DMARC compliance 2026',
    'SPF lookup permError',
    'SDR outbound monitoring',
  ],
  authors: [{ name: 'InboxSentinel' }],
  openGraph: {
    title: 'InboxSentinel | B2B Outbound Deliverability Watchdog',
    description:
      'Zero-access passive public DNS tripwires and blacklist alarms for B2B cold outbound domains. Instant sirens to Slack and Discord.',
    url: 'https://inboxsentinel.vercel.app',
    siteName: 'InboxSentinel',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InboxSentinel | B2B Outbound Deliverability Watchdog',
    description:
      'Zero-access passive public DNS tripwires and blacklist alarms for B2B cold outbound domains.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
