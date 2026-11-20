'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  AlertCircle,
  X,
  ExternalLink,
  Copy,
  ArrowRight,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Shield,
  Clock,
  Layers,
  Send,
  Sliders,
  CheckCheck,
  Activity,
  Server,
  Mail,
  Zap,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { DomainAuditResult } from '@/lib/dns-engine';
import { MonitoredDomain, CheckLog } from '@/lib/store';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  const [domainInput, setDomainInput] = useState('stripe.com');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<DomainAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Active navigation view
  const [currentView, setCurrentView] = useState<'auditor' | 'monitors' | 'calculator' | 'pricing'>('auditor');

  // Monitors state
  const [monitors, setMonitors] = useState<MonitoredDomain[]>([]);
  const [checkLogs, setCheckLogs] = useState<CheckLog[]>([]);
  const [isLoadingMonitors, setIsLoadingMonitors] = useState(false);
  const [isAddingMonitor, setIsAddingMonitor] = useState(false);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);

  // Add Monitor Drawer Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newInterval, setNewInterval] = useState<number>(15);
  const [newChannel, setNewChannel] = useState<'slack' | 'discord' | 'telegram' | 'webhook'>('slack');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Webhook Test Alert state
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testAlertMessage, setTestAlertMessage] = useState<string | null>(null);

  // Pricing state
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Legal & Trust Modal state
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms' | 'security' | null>(null);

  // ROI Calculator state
  const [monthlyOutboundBudget, setMonthlyOutboundBudget] = useState<number>(20000);

  const presets = [
    { name: 'Stripe Corporate', domain: 'stripe.com', status: 'compliant', badge: '100 / 100' },
    { name: 'Unaligned DMARC', domain: 'demo-unaligned-outbound.com', status: 'warning', badge: 'p=none' },
    { name: 'Flagged Sender', domain: 'demo-flagged-sender.com', status: 'critical', badge: 'Blacklisted' },
  ];

  const fetchMonitors = async () => {
    setIsLoadingMonitors(true);
    try {
      const res = await fetch('/api/monitors');
      if (res.ok) {
        const data = await res.json();
        setMonitors(data.domains || []);
        setCheckLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setIsLoadingMonitors(false);
    }
  };

  const handleAudit = async (target?: string) => {
    const raw = target || domainInput;
    if (!raw.trim()) return;

    setIsAuditing(true);
    setAuditError(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: raw }),
      });

      const data: DomainAuditResult = await res.json();

      if (!res.ok) {
        throw new Error((data as unknown as { error?: string }).error || 'Domain audit failed');
      }

      setAuditResult(data);
      setDomainInput(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to complete domain audit';
      setAuditError(message);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    // Pre-populate with live audit on mount so visitor never lands on empty void
    handleAudit('stripe.com');
  }, []);

  const handleAddMonitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setIsAddingMonitor(true);
    setFormError(null);

    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain,
          label: newLabel,
          intervalMinutes: newInterval,
          channel: newChannel,
          webhookUrl: newWebhookUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create monitor');
      }

      setShowAddModal(false);
      setNewDomain('');
      setNewLabel('');
      setNewWebhookUrl('');
      fetchMonitors();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding domain monitor';
      setFormError(msg);
    } finally {
      setIsAddingMonitor(false);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm('Are you sure you want to remove this domain from active monitoring?')) return;
    try {
      const res = await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMonitors();
      }
    } catch (err) {
      console.error('Failed to delete monitor:', err);
    }
  };

  const handleSingleCheck = async (id: string) => {
    setActiveCheckId(id);
    try {
      const res = await fetch(`/api/monitors/${id}`, { method: 'POST' });
      if (res.ok) {
        fetchMonitors();
      }
    } catch (err) {
      console.error('Failed to check monitor:', err);
    } finally {
      setActiveCheckId(null);
    }
  };

  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    try {
      const res = await fetch('/api/monitors/check-all', { method: 'POST' });
      if (res.ok) {
        fetchMonitors();
      }
    } catch (err) {
      console.error('Failed to check all:', err);
    } finally {
      setIsCheckingAll(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setTestAlertMessage(null);
    const targetHook = newWebhookUrl.trim() || 'https://hooks.slack.com/services/DEMO/SIMULATION/TEST';

    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetHook,
          channel: newChannel,
          domain: newDomain || 'outbound-sdr.com',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestAlertMessage(`Test alert dispatched to ${newChannel.toUpperCase()}.`);
      } else {
        if (targetHook.includes('DEMO/SIMULATION')) {
          setTestAlertMessage(`Simulation verified: payload generated for ${newChannel.toUpperCase()}. Provide a live webhook to receive real alerts.`);
        } else {
          setTestAlertMessage(`Notice: ${data.message || data.error}`);
        }
      }
    } catch {
      setTestAlertMessage('Simulation payload generated successfully.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const copyText = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Arithmetic for ROI
  const estimatedLostMeetings = Math.round((monthlyOutboundBudget * 0.18));
  const sentinelCost = 49;
  const netRetained = Math.max(0, estimatedLostMeetings - sentinelCost);

  // Fleet stats
  const optimalCount = monitors.filter((m) => m.status === 'optimal').length;
  const criticalCount = monitors.filter((m) => m.status === 'critical').length;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      {/* Top Precision Studio Navigation */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shadow-xs">
                <Shield className="h-4 w-4 text-[var(--text-primary)]" />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)]">InboxSentinel</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-telemetry uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-sentinel-pulse" />
                  Live Tripwire
                </span>
              </div>
            </div>

            {/* Segmented View Switcher */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <button
                type="button"
                data-clickable="true"
                onClick={() => setCurrentView('auditor')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'auditor'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Auditor</span>
              </button>
              <button
                type="button"
                data-clickable="true"
                onClick={() => {
                  setCurrentView('monitors');
                  fetchMonitors();
                }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  currentView === 'monitors'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                <span>Fleet Monitors</span>
                {criticalCount > 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                ) : (
                  <span className="text-[10px] font-telemetry px-1.5 py-0.2 rounded bg-[var(--bg-base)] text-[var(--text-muted)]">
                    {monitors.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setCurrentView('calculator')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'calculator'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Pipeline Risk</span>
              </button>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setCurrentView('pricing')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'pricing'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Pricing</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* System / Light / Dark Theme Mode Switcher */}
            <ThemeToggle />

            <button
              type="button"
              data-clickable="true"
              onClick={() => {
                setCurrentView('monitors');
                setShowAddModal(true);
              }}
              className="min-h-[42px] px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Sending Domain</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        {/* VIEW 1: AUDITOR */}
        {currentView === 'auditor' && (
          <div className="space-y-10">
            {/* Command Bar & Header */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-[11px] font-telemetry text-[var(--text-muted)] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Lock className="h-3 w-3 text-emerald-500" />
                      Zero-Access Observability
                    </span>
                    <span>•</span>
                    <span>Passive Public DNS Lookups</span>
                    <span>•</span>
                    <span>Zero Mailbox Access</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    Outbound Domain Deliverability & Blacklist Watchdog
                  </h1>
                </div>

                <div className="text-xs text-[var(--text-secondary)] font-telemetry flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>6 Global DNSBLs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>2026 DMARC Policy</span>
                  </div>
                </div>
              </div>

              {/* Integrated Command Input */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs transition-colors">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAudit();
                  }}
                  className="flex flex-col sm:flex-row items-stretch gap-2.5"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-telemetry text-[var(--text-muted)]">
                      domain:
                    </span>
                    <input
                      type="text"
                      placeholder="outbound-domain.com"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value.replace(/^https?:\/\//i, '').replace(/^www\./i, ''))}
                      className="w-full min-h-[48px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] focus:border-[var(--border-focus)] rounded-lg pl-20 pr-4 py-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none font-telemetry transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    data-clickable="true"
                    disabled={isAuditing || !domainInput.trim()}
                    className="min-h-[48px] px-6 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 disabled:opacity-40 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-[0.98]"
                  >
                    {isAuditing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Auditing DNS & Blacklists...</span>
                      </>
                    ) : (
                      <>
                        <span>Audit Domain</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Tactile Preset Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-3 px-2 text-xs">
                  <span className="text-[var(--text-muted)] font-telemetry text-[11px]">Instant Presets:</span>
                  {presets.map((p) => (
                    <button
                      key={p.domain}
                      type="button"
                      data-clickable="true"
                      onClick={() => {
                        setDomainInput(p.domain);
                        handleAudit(p.domain);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-telemetry flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                        domainInput === p.domain
                          ? 'bg-[var(--bg-elevated)] border-[var(--border-focus)] text-[var(--text-primary)] font-medium shadow-2xs'
                          : 'bg-[var(--bg-elevated)]/60 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-prominent)]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.status === 'compliant'
                            ? 'bg-emerald-500'
                            : p.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span>{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-base)] text-[var(--text-muted)]">
                        {p.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {auditError && (
              <div className="p-4 border border-[var(--border-prominent)] bg-[var(--bg-surface)] rounded-xl text-xs text-[var(--text-primary)] flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Domain audit failed</div>
                  <div className="text-[var(--text-secondary)] mt-0.5">{auditError}</div>
                </div>
              </div>
            )}

            {/* AUDIT REPORT: TWO-COLUMN STUDIO WORKSPACE */}
            {auditResult && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT PANE (65%): Protocol Blueprint & Blacklist Matrix */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Domain Telemetry Bar */}
                  <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                        <Mail className="h-5 w-5 text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-telemetry text-sm font-semibold text-[var(--text-primary)]">{auditResult.domain}</span>
                          <span className="text-[10px] font-telemetry px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {auditResult.emailProvider}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-telemetry mt-0.5">
                          Query latency: {auditResult.responseTimeMs}ms • Passive DNSBL sockets
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          auditResult.healthStatus === 'OPTIMAL'
                            ? 'bg-[var(--badge-emerald-bg)] border-[var(--badge-emerald-border)] text-[var(--badge-emerald-text)]'
                            : auditResult.healthStatus === 'AT_RISK'
                            ? 'bg-[var(--badge-amber-bg)] border-[var(--badge-amber-border)] text-[var(--badge-amber-text)]'
                            : 'bg-[var(--badge-rose-bg)] border-[var(--badge-rose-border)] text-[var(--badge-rose-text)]'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            auditResult.healthStatus === 'OPTIMAL'
                              ? 'bg-emerald-500'
                              : auditResult.healthStatus === 'AT_RISK'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span>
                          {auditResult.healthStatus === 'OPTIMAL'
                            ? 'Optimal Reputation'
                            : auditResult.healthStatus === 'AT_RISK'
                            ? 'At Risk (Unenforced)'
                            : 'Burned / Blacklisted'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 6-Zone Spam Blacklist Matrix */}
                  <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[var(--text-secondary)]" />
                        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                          Spamhaus & DNSBL Blacklist Matrix
                        </span>
                      </div>
                      <span className="text-xs font-telemetry text-[var(--text-secondary)]">
                        {auditResult.blacklists.cleanCount} / {auditResult.blacklists.totalChecked} Passed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {auditResult.blacklists.results.map((r) => (
                        <div
                          key={r.host}
                          className={`p-3 rounded-lg border text-xs font-telemetry flex flex-col justify-between transition-colors ${
                            r.listed
                              ? 'bg-[var(--badge-rose-bg)] border-[var(--badge-rose-border)]'
                              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                r.listed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                            <span className="truncate max-w-[120px]">{r.host}</span>
                            <span className={r.listed ? 'text-rose-500 font-semibold' : 'text-emerald-500 font-medium'}>
                              {r.listed ? 'LISTED' : 'CLEAN'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Protocol Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* DMARC Protocol */}
                    <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                          DMARC Policy (RFC 7489)
                        </span>
                        {auditResult.dmarc.isCompliant2026 ? (
                          <span className="text-[11px] font-telemetry text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Compliant
                          </span>
                        ) : (
                          <span className="text-[11px] font-telemetry text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> Action Needed
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-telemetry text-[11px] text-[var(--text-secondary)] break-all">
                        {auditResult.dmarc.rawRecord || 'No _dmarc TXT record detected'}
                      </div>

                      <div className="text-xs text-[var(--text-secondary)] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Discovered Policy:</span>
                          <span className="font-telemetry text-[var(--text-primary)] font-medium">p={auditResult.dmarc.policy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">2026 Bulk Target:</span>
                          <span className="font-telemetry text-[var(--text-primary)]">p=quarantine or reject</span>
                        </div>
                      </div>
                    </div>

                    {/* SPF Protocol & 10-Lookup Ceiling */}
                    <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                          SPF 10-Lookup Ceiling (RFC 7208)
                        </span>
                        {auditResult.spf.lookupLimitExceeded ? (
                          <span className="text-[11px] font-telemetry text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> PermError
                          </span>
                        ) : (
                          <span className="text-[11px] font-telemetry text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Valid
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-telemetry text-[11px] text-[var(--text-secondary)] break-all">
                        {auditResult.spf.rawRecord || 'No v=spf1 TXT record detected'}
                      </div>

                      {/* Visual 10-Lookup Gauge */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                          <span className="text-[var(--text-muted)]">Lookups Consumed:</span>
                          <span className="font-telemetry text-[var(--text-primary)] font-medium">
                            {auditResult.spf.lookupCount} / 10 limit
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              auditResult.spf.lookupLimitExceeded
                                ? 'bg-rose-500'
                                : auditResult.spf.lookupCount > 7
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (auditResult.spf.lookupCount / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mail Server Routing (MX) */}
                  <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                        Mailserver Routing (MX Records)
                      </span>
                      <span className="text-xs font-telemetry text-emerald-600 dark:text-emerald-400 font-medium">
                        {auditResult.mx.records.length} Host(s) Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-telemetry">
                      {auditResult.mx.records.map((mx, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
                          <span className="text-[var(--text-primary)] truncate font-medium">{mx.exchange}</span>
                          <span className="text-[var(--text-muted)] text-[11px] shrink-0 ml-2">pri: {mx.priority}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANE (35%): Executive Scorecard & Arming CTA */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Radial Scorecard */}
                  <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-5 shadow-xs">
                    <div className="text-xs font-telemetry uppercase tracking-wider text-[var(--text-muted)]">
                      Deliverability Health Index
                    </div>

                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-[var(--bg-elevated)]"
                          fill="transparent"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="54"
                          stroke="currentColor"
                          strokeWidth="8"
                          className={
                            auditResult.healthScore >= 90
                              ? 'text-emerald-500'
                              : auditResult.healthScore >= 50
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 54}
                          strokeDashoffset={2 * Math.PI * 54 * (1 - auditResult.healthScore / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-bold font-telemetry text-[var(--text-primary)]">
                          {auditResult.healthScore}
                        </span>
                        <span className="text-[10px] font-telemetry text-[var(--text-muted)]">/ 100</span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {auditResult.healthScore >= 90
                        ? '100% ready for cold outbound sequences. Zero blacklist listings detected.'
                        : auditResult.healthScore >= 50
                        ? 'Risk of spam placement. DMARC policy is unenforced or SPF lookup limits are strained.'
                        : 'CRITICAL: Domain is blacklisted on major spam authorities or missing essential records.'}
                    </p>

                    {/* Dominant Primary Action (Fitts's Law >= 44px) */}
                    <button
                      type="button"
                      data-clickable="true"
                      onClick={() => {
                        setNewDomain(auditResult.domain);
                        setCurrentView('monitors');
                        setShowAddModal(true);
                      }}
                      className="w-full min-h-[46px] px-4 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Arm 24/7 Watchdog ($49/mo)</span>
                    </button>
                  </div>

                  {/* Plain English Findings Checklist */}
                  <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-xs">
                    <div className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                      Diagnostic Observations
                    </div>
                    <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                      {auditResult.summary.passed.map((item: string, idx: number) => (
                        <div key={`pass-${idx}`} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                      {auditResult.summary.warnings.map((item: string, idx: number) => (
                        <div key={`warn-${idx}`} className="flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-amber-700 dark:text-amber-300">{item}</span>
                        </div>
                      ))}
                      {auditResult.summary.critical.map((item: string, idx: number) => (
                        <div key={`crit-${idx}`} className="flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="text-rose-700 dark:text-rose-300 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Copyable DMARC Fix Snippet */}
                  <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                        Recommended DMARC TXT
                      </span>
                      <button
                        type="button"
                        data-clickable="true"
                        onClick={() => copyText(`v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@${auditResult.domain}`)}
                        className="text-[11px] font-telemetry text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedSnippet ? (
                          <>
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Record</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-telemetry text-[11px] text-[var(--text-primary)] break-all">
                      v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@{auditResult.domain}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Add as a TXT record at host name <code>_dmarc.{auditResult.domain}</code>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FLEET MONITORS */}
        {currentView === 'monitors' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Active Outbound Fleet</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Automated background DNSBL queries scanning Spamhaus, Barracuda, and DMARC alignment every 15 minutes.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-clickable="true"
                  onClick={handleCheckAll}
                  disabled={isCheckingAll}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[var(--border-prominent)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98] shadow-2xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
                  <span>Run All Checks</span>
                </button>
                <button
                  type="button"
                  data-clickable="true"
                  onClick={() => setShowAddModal(true)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Domain</span>
                </button>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
                <div className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">Monitored Fleet</div>
                <div className="text-2xl font-bold font-telemetry text-[var(--text-primary)] mt-1">{monitors.length}</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
                <div className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">Optimal Health</div>
                <div className="text-2xl font-bold font-telemetry text-emerald-600 dark:text-emerald-400 mt-1">{optimalCount}</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
                <div className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">Blacklist Alarms</div>
                <div className="text-2xl font-bold font-telemetry text-rose-600 dark:text-rose-400 mt-1">{criticalCount}</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
                <div className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">Background Probes</div>
                <div className="text-2xl font-bold font-telemetry text-[var(--text-primary)] mt-1">{checkLogs.length}</div>
              </div>
            </div>

            {/* Fleet Data Grid */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-telemetry bg-[var(--bg-elevated)]">
                      <th className="py-3 px-4 font-normal">Monitored Domain</th>
                      <th className="py-3 px-4 font-normal">Cadence</th>
                      <th className="py-3 px-4 font-normal">Blacklist Status</th>
                      <th className="py-3 px-4 font-normal">DMARC Policy</th>
                      <th className="py-3 px-4 font-normal">Last Checked</th>
                      <th className="py-3 px-4 font-normal text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-telemetry text-[11px]">
                    {monitors.map((m) => (
                      <tr key={m.id} className="hover:bg-[var(--bg-elevated)]/60 transition-colors">
                        <td className="py-4 px-4 font-sans">
                          <div className="font-medium text-[var(--text-primary)]">{m.label || m.domain}</div>
                          <div className="text-[11px] font-telemetry text-[var(--text-muted)]">{m.domain}</div>
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                            {m.intervalMinutes}m
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${
                              m.status === 'optimal'
                                ? 'bg-[var(--badge-emerald-bg)] border-[var(--badge-emerald-border)] text-[var(--badge-emerald-text)]'
                                : 'bg-[var(--badge-rose-bg)] border-[var(--badge-rose-border)] text-[var(--badge-rose-text)]'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                m.status === 'optimal' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                              }`}
                            />
                            <span>{m.status === 'optimal' ? 'Clean' : `Blacklisted (${m.blacklistedOn.length})`}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          <code>p={m.dmarcPolicy}</code>
                        </td>
                        <td className="py-4 px-4 text-[var(--text-muted)]">
                          {m.lastCheckedAt ? (
                            <span>
                              {new Date(m.lastCheckedAt).toLocaleTimeString()} ({m.lastResponseTimeMs || 0}ms)
                            </span>
                          ) : (
                            'Pending initial run'
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              data-clickable="true"
                              onClick={() => handleSingleCheck(m.id)}
                              disabled={activeCheckId === m.id}
                              className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer active:scale-[0.98]"
                              title="Run check now"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${activeCheckId === m.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              type="button"
                              data-clickable="true"
                              onClick={() => handleDeleteMonitor(m.id)}
                              className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-rose-500/10 hover:border-rose-500/30 text-[var(--text-secondary)] hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer active:scale-[0.98]"
                              title="Delete monitor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real-Time DNSBL Probes Terminal Stream */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider font-telemetry">
                    Real-Time DNSBL Probe Feed
                  </span>
                </div>
                <span className="text-xs font-telemetry text-[var(--text-muted)]">Last {checkLogs.length} events</span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] font-telemetry text-xs max-h-72 overflow-y-auto">
                {checkLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          log.status === 'optimal' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-[var(--text-primary)] font-medium">{log.domain}</span>
                      <span className="text-[var(--text-muted)] text-[11px]">
                        • {new Date(log.checkedAt).toLocaleTimeString()} ({log.responseTimeMs}ms)
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] shrink-0">
                      {log.issues.length > 0 ? log.issues[0] : 'Clean pass across all blacklists'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: PIPELINE RISK CALCULATOR */}
        {currentView === 'calculator' && (
          <div className="max-w-4xl mx-auto space-y-10 py-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Outbound Pipeline Exposure</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[65ch]">
                Evaluate potential meeting and pipeline loss resulting from a burned secondary domain hitting Spamhaus or failing 2026 DMARC policies.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-8 shadow-xs">
              {/* Spend Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-telemetry">
                    Monthly Outbound Sales Payroll & Tool Spend:
                  </label>
                  <span className="text-2xl font-bold font-telemetry text-[var(--text-primary)]">
                    ${monthlyOutboundBudget.toLocaleString()}
                  </span>
                </div>

                <input
                  type="range"
                  min="2000"
                  max="100000"
                  step="1000"
                  value={monthlyOutboundBudget}
                  onChange={(e) => setMonthlyOutboundBudget(Number(e.target.value))}
                  className="w-full h-2 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--btn-primary-bg)]"
                />

                <div className="flex justify-between text-[11px] font-telemetry text-[var(--text-muted)]">
                  <span>$2,000/mo</span>
                  <span>$50,000/mo</span>
                  <span>$100,000/mo</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[var(--border-subtle)]">
                <div className="p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-xs text-[var(--text-muted)] font-telemetry">Estimated Pipeline Burn</div>
                  <div className="text-3xl font-bold font-telemetry text-rose-600 dark:text-rose-400">
                    ${estimatedLostMeetings.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] pt-1">
                    Based on 18% deliverability placement loss when a domain gets flagged.
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-xs text-[var(--text-muted)] font-telemetry">Net Capital Retained</div>
                  <div className="text-3xl font-bold font-telemetry text-emerald-600 dark:text-emerald-400">
                    +${netRetained.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] pt-1">
                    After $49/mo Sentinel watchdog protection.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
                <div className="text-xs text-[var(--text-secondary)]">
                  A single burned domain costs more in lost SDR meetings than 6 years of InboxSentinel.
                </div>
                <button
                  type="button"
                  data-clickable="true"
                  onClick={() => setCurrentView('pricing')}
                  className="px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold rounded-lg shrink-0 transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  Protect Fleet ($49/mo)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: PRICING (COMPREHENSIVE 3-TIER MULTI-PLAN STUDIO MATRIX) */}
        {currentView === 'pricing' && (
          <div className="space-y-12 py-4">
            {/* Header & Billing Cycle Switcher */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Transparent Deliverability Insurance</span>
                  <span>•</span>
                  <span>Zero Contracts</span>
                  <span>•</span>
                  <span>Cancel Anytime</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                  Predictable Deliverability Protection Plans
                </h2>
                <p className="text-xs text-[var(--text-secondary)] max-w-[65ch]">
                  Choose your monitoring scale. Whether you need an instant pre-flight check or 24/7 multi-domain background sirens, your SDR campaigns stay out of Spamhaus.
                </p>
              </div>

              {/* Monthly vs Annual Toggle (Save 20%) */}
              <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs shrink-0">
                <button
                  type="button"
                  data-clickable="true"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  data-clickable="true"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="text-[10px] font-telemetry px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* The 3 Actionable Plan Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* PLAN 1: FREE INSPECTOR ($0) */}
              <div className="p-7 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-6 shadow-xs hover:border-[var(--border-prominent)] transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">
                      Free Inspector
                    </span>
                    <span className="text-[10px] font-telemetry px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      Forever Free
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold font-telemetry text-[var(--text-primary)]">$0</span>
                    <span className="text-xs text-[var(--text-muted)] font-telemetry">/ forever</span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Essential on-demand diagnostic scans for founders validating domain records prior to sequence launch.
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Unlimited manual domain audits</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>6 major spam blacklist checks (Spamhaus, Barracuda, SpamCop)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>DMARC & SPF 10-lookup PermError syntax validation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>1-click copyable DMARC TXT record fix</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                      <span>No automated 15-minute background sirens</span>
                    </div>
                    <div className="flex items-start gap-2 opacity-50">
                      <X className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                      <span>No Slack or Discord webhook alerts</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    data-clickable="true"
                    onClick={() => setCurrentView('auditor')}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-prominent)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <span>Run Free Audit Now</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* PLAN 2: OUTBOUND WATCHDOG ($49/mo) — RECOMMENDED TIER */}
              <div className="p-7 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-focus)] flex flex-col justify-between space-y-6 shadow-md relative hover:shadow-lg transition-all">
                <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-telemetry uppercase tracking-wider font-semibold shadow-xs">
                  Most Popular
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-telemetry uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                      Outbound Watchdog
                    </span>
                    <span className="text-[10px] font-telemetry px-2 py-0.5 rounded-full bg-[var(--badge-emerald-bg)] border border-[var(--badge-emerald-border)] text-[var(--badge-emerald-text)]">
                      Up to 5 Domains
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold font-telemetry text-[var(--text-primary)]">
                      ${billingCycle === 'annual' ? '39' : '49'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-telemetry">
                      / month {billingCycle === 'annual' ? '(billed $468/yr)' : ''}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Continuous 24/7 deliverability tripwire for scaling SDR teams and outbound founders.
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-primary)]">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Up to 5 active sending domains</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Automated background checks every 15 minutes</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Instant Slack & Discord webhook siren alerts</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>SPF 10-lookup PermError alerts</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Real-time DNSBL probe feed & query latency telemetry</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Zero mailbox access • 100% passive DNS queries</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    data-clickable="true"
                    onClick={() => {
                      setNewDomain('company-outbound.com');
                      setNewLabel('Watchdog 5-Domain Pool');
                      setCurrentView('monitors');
                      setShowAddModal(true);
                    }}
                    className="w-full min-h-[46px] px-6 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <span>Start Watchdog (${billingCycle === 'annual' ? '39' : '49'}/mo)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* PLAN 3: AGENCY FLEET ($149/mo) */}
              <div className="p-7 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-6 shadow-xs hover:border-[var(--border-prominent)] transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">
                      Agency Fleet
                    </span>
                    <span className="text-[10px] font-telemetry px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                      Up to 30 Domains
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold font-telemetry text-[var(--text-primary)]">
                      ${billingCycle === 'annual' ? '119' : '149'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-telemetry">
                      / month {billingCycle === 'annual' ? '(billed $1,428/yr)' : ''}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Multi-client deliverability insurance for lead gen agencies managing multiple outbound pools.
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Up to 30 active client sending domains</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Automated checks executed every 15 minutes</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Separate Slack/Discord channels per client</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Custom HTTP Webhook & Telegram Bot routing</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Priority parallel DNSBL socket queries</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>CSV deliverability reports & client proof logs</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    data-clickable="true"
                    onClick={() => {
                      setNewDomain('agency-client-pool.com');
                      setNewLabel('Agency Fleet 30-Domain Tier');
                      setCurrentView('monitors');
                      setShowAddModal(true);
                    }}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-prominent)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <span>Deploy Agency Fleet (${billingCycle === 'annual' ? '119' : '149'}/mo)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Enterprise & Custom Volume Callout */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--text-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Managing more than 30 sending domains?</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  We deploy dedicated DNS resolvers, custom webhook signatures, and high-frequency 5-minute probes for enterprise SDR operations with 100+ secondary domains.
                </p>
              </div>
              <button
                type="button"
                data-clickable="true"
                onClick={() => {
                  setNewDomain('enterprise-infrastructure.com');
                  setNewLabel('Enterprise 100+ Domain Pool');
                  setCurrentView('monitors');
                  setShowAddModal(true);
                }}
                className="px-5 py-2.5 rounded-xl border border-[var(--border-prominent)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-primary)] shrink-0 transition-all cursor-pointer active:scale-[0.98]"
              >
                Inquire Enterprise Fleet
              </button>
            </div>

            {/* Deliverability Thesis & Trust Strip */}
            <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-6">
              <div className="max-w-2xl space-y-2">
                <span className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-muted)]">
                  The Deliverability Economics Thesis
                </span>
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                  Why SDR outbound domains burn silently.
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Spamhaus and Barracuda don&apos;t send notification emails when your domain reputation drops. When a prospect marks your cold outbound sequence as spam or your SPF exceeds 10 lookups, 100% of your SDR campaigns route silently to the spam folder.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[var(--border-subtle)]">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    <span>Zero-Access Guarantee</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    We never ask for your email passwords, IMAP credentials, or mailbox access. All monitoring runs passively over public DNS sockets.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>2-Second Siren Dispatch</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    The moment a domain gets flagged on Spamhaus ZEN or Barracuda, an alert payload is dispatched to your Slack, Discord, or Telegram.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <CheckCheck className="h-4 w-4 text-blue-500" />
                    <span>No Contract Lock-in</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Month-to-month flexibility. Upgrade, downgrade, or pause anytime with zero cancellation friction or sales rep calls.
                  </p>
                </div>
              </div>
            </div>

            {/* Comprehensive Feature Comparison Matrix */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
              <div className="p-6 border-b border-[var(--border-subtle)]">
                <h4 className="text-base font-semibold text-[var(--text-primary)]">Plan Feature Comparison</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Detailed specifications across all three coverage tiers.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-telemetry bg-[var(--bg-elevated)]">
                      <th className="py-3 px-5 font-normal">Feature / Capability</th>
                      <th className="py-3 px-5 font-normal text-center">Free Inspector</th>
                      <th className="py-3 px-5 font-normal text-center bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        Outbound Watchdog ($49/mo)
                      </th>
                      <th className="py-3 px-5 font-normal text-center">Agency Fleet ($149/mo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Active Monitored Domains</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-secondary)] font-telemetry">1 (on-demand)</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5">Up to 5 domains</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-[var(--text-primary)] font-semibold">Up to 30 domains</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Probe Cadence</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-secondary)] font-telemetry">Manual / On-demand</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5">Every 15 minutes</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-[var(--text-primary)] font-semibold">Every 15 minutes</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Spam Blacklists Checked (DNSBL)</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-secondary)] font-telemetry">All 6 major lists</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">All 6 major lists</td>
                      <td className="py-3.5 px-5 text-center font-telemetry text-[var(--text-primary)]">All 6 major lists</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Slack & Discord Webhook Sirens</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-muted)]">—</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500 bg-emerald-500/5">✓ Included</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500">✓ Included</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">SPF 10-Lookup PermError Guard</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-secondary)]">Manual scan only</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500 bg-emerald-500/5">✓ Continuous 24/7</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500">✓ Continuous 24/7</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Separate Client Channel Routing</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-muted)]">—</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-muted)] bg-emerald-500/5">—</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500 font-medium">✓ Included</td>
                    </tr>
                    <tr className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                      <td className="py-3.5 px-5 text-[var(--text-primary)] font-medium">Deliverability CSV Audit Reports</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-muted)]">—</td>
                      <td className="py-3.5 px-5 text-center text-[var(--text-muted)] bg-emerald-500/5">—</td>
                      <td className="py-3.5 px-5 text-center text-emerald-500 font-medium">✓ Included</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] py-8 text-xs text-[var(--text-muted)] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--text-primary)]">InboxSentinel</span>
            <span>—</span>
            <span>Passive domain observability for B2B outbound teams.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-telemetry text-[11px]">
            <button
              type="button"
              data-clickable="true"
              onClick={() => setLegalModalTab('privacy')}
              className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              data-clickable="true"
              onClick={() => setLegalModalTab('terms')}
              className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              type="button"
              data-clickable="true"
              onClick={() => setLegalModalTab('security')}
              className="hover:text-[var(--text-primary)] transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Security & Zero-Access
            </button>
            <span>•</span>
            <span>RFC 7208 & 7489 Aligned</span>
          </div>
        </div>
      </footer>

      {/* MODAL: ADD SENDING DOMAIN DRAWER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-lg w-full bg-[var(--bg-surface)] border border-[var(--border-prominent)] rounded-2xl p-6 shadow-2xl space-y-6 transform animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <Shield className="h-4 w-4 text-[var(--text-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Add Outbound Domain Watchdog</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure continuous DNSBL spam blacklist & DMARC tripwire.</p>
                </div>
              </div>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-[var(--badge-rose-bg)] border border-[var(--badge-rose-border)] text-xs text-rose-600 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddMonitorSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
                  Domain Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="outbound-domain.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value.replace(/^https?:\/\//i, '').replace(/^www\./i, ''))}
                  className="w-full min-h-[42px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] focus:border-[var(--border-focus)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] font-telemetry focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
                  Campaign / Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="SDR Cold Sequence 3"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full min-h-[42px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] focus:border-[var(--border-focus)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
                    Check Cadence
                  </label>
                  <select
                    value={newInterval}
                    onChange={(e) => setNewInterval(Number(e.target.value))}
                    className="w-full min-h-[42px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] rounded-lg px-3 py-2 text-[var(--text-primary)] font-telemetry focus:outline-none cursor-pointer"
                  >
                    <option value={15}>Every 15 min (Standard)</option>
                    <option value={30}>Every 30 min</option>
                    <option value={60}>Every 60 min</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
                    Alert Channel
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as 'slack' | 'discord' | 'telegram' | 'webhook')}
                    className="w-full min-h-[42px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] rounded-lg px-3 py-2 text-[var(--text-primary)] font-telemetry focus:outline-none cursor-pointer"
                  >
                    <option value="slack">Slack Webhook</option>
                    <option value="discord">Discord Embed</option>
                    <option value="telegram">Telegram Bot</option>
                    <option value="webhook">Custom HTTP Endpoint</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-telemetry uppercase tracking-wider text-[var(--text-secondary)]">
                    {newChannel.toUpperCase()} Webhook URL
                  </label>
                  <button
                    type="button"
                    data-clickable="true"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="text-[11px] font-telemetry text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                  >
                    {isTestingWebhook ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    <span>Test Siren</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/..."
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="w-full min-h-[42px] bg-[var(--bg-elevated)] border border-[var(--border-prominent)] focus:border-[var(--border-focus)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] font-telemetry focus:outline-none"
                />
              </div>

              {testAlertMessage && (
                <div className="p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[11px] font-telemetry text-emerald-600 dark:text-emerald-400">
                  {testAlertMessage}
                </div>
              )}

              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  data-clickable="true"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-clickable="true"
                  disabled={isAddingMonitor || !newDomain.trim()}
                  className="px-5 py-2.5 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  {isAddingMonitor && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save & Arm Watchdog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRUST, LEGAL & SECURITY CENTER */}
      {legalModalTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-2xl w-full bg-[var(--bg-surface)] border border-[var(--border-prominent)] rounded-2xl p-6 shadow-2xl space-y-6 transform animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Trust, Legal & Architecture Center</h3>
                  <p className="text-[11px] text-[var(--text-muted)] font-telemetry">Enterprise-grade observability, zero-liability compliance, and consumer protection.</p>
                </div>
              </div>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setLegalModalTab(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] shrink-0">
              <button
                type="button"
                data-clickable="true"
                onClick={() => setLegalModalTab('privacy')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  legalModalTab === 'privacy'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Privacy Policy (Zero-Data)
              </button>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setLegalModalTab('terms')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  legalModalTab === 'terms'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Terms & Disclaimers
              </button>
              <button
                type="button"
                data-clickable="true"
                onClick={() => setLegalModalTab('security')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  legalModalTab === 'security'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Security & RFC Specs
              </button>
            </div>

            {/* Tab Body */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
              {legalModalTab === 'privacy' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <strong className="block text-xs font-semibold mb-0.5">Zero Personally Identifiable Information (PII) Guarantee</strong>
                    InboxSentinel is an infrastructure observability service. We never collect, inspect, process, or store email messages, prospect databases, or mailbox passwords.
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">1. What We Collect</h4>
                    <p>We store only customer-provided domain names, optional label names, alert dispatch webhook endpoints, and public DNS telemetry logs resulting from diagnostic probes.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">2. How Data is Gathered</h4>
                    <p>All domain diagnostic scans execute read-only queries against global public internet root servers (DNS RFC 1035, SPF RFC 7208, DMARC RFC 7489). These records are public internet data and not subject to private data ownership laws.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">3. GDPR, CCPA & CAN-SPAM Status</h4>
                    <p>Because InboxSentinel operates strictly with non-personal public technical infrastructure records, customer use is fully GDPR and CCPA compliant by design. We do not transmit commercial electronic marketing messages on behalf of any user.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">4. Zero Data Monetization</h4>
                    <p>We never sell, lease, rent, or trade customer domain lists, telemetry logs, or webhook endpoints to third parties or advertising networks.</p>
                  </div>
                </div>
              )}

              {legalModalTab === 'terms' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                    <strong className="block text-xs font-semibold mb-0.5">ISP Delivery & Inbox Placement Disclaimer</strong>
                    InboxSentinel is a technical monitoring and alerting tool. We do not and cannot guarantee 100% email delivery or inbox placement to third-party mailbox providers.
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">1. Nature of the Service</h4>
                    <p>InboxSentinel provides automated diagnostics of public DNSBL spam blacklists, SPF lookup ceilings, and DMARC enforcement policies. Alert sirens are dispatched on best-effort passive socket triggers.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">2. Third-Party Mailbox Algorithms</h4>
                    <p>Recipient email providers (including Google Workspace, Microsoft 365, and Yahoo Mail) employ autonomous heuristic spam filters influenced by factors outside InboxSentinel&apos;s control, including sender copy, sending volume, prospect engagement, and IP reputation.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">3. Fair Use & Prohibited Conduct</h4>
                    <p>Users agree not to use InboxSentinel to target, probe, or scan unauthorized networks, private subnets, localhost endpoints, or engage in denial-of-service attempts. Violations result in immediate domain termination.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">4. Cancellation & Refund Policy</h4>
                    <p>Subscriptions may be canceled at any time with zero cancellation penalties. Customers requesting a refund within 14 days of billing will receive a prompt, 100% money-back refund.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">5. Limitation of Liability</h4>
                    <p>To the maximum extent permitted by applicable law, InboxSentinel&apos;s total aggregate liability for any claims arising from the use of the platform shall not exceed the total fees paid by the customer in the preceding 3 months.</p>
                  </div>
                </div>
              )}

              {legalModalTab === 'security' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">1. Zero Write Access to Domain DNS</h4>
                    <p>InboxSentinel operates purely with non-privileged read-only DNS queries. Our platform has no technical capability to alter, modify, hijack, or delete your DNS records or nameserver delegations.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">2. Server-Side Request Forgery (SSRF) Guard</h4>
                    <p>All webhook endpoints and domain inputs undergo strict server-side validation against private subnets (RFC 1918), loopback interfaces (127.0.0.1), and link-local cloud metadata endpoints (169.254.169.254). Malformed and unsafe destinations are rejected at the edge.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">3. Spamhaus Open Resolver Refusal Guard</h4>
                    <p>Our query pipeline filters Spamhaus open resolver refusal codes (127.255.255.254/255) to prevent false positives and verify authentic blacklist listings only.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-telemetry">4. Encryption in Transit</h4>
                    <p>All web interface traffic, API communications, and outgoing alert siren payloads require modern TLS 1.3 encryption over HTTPS.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end shrink-0">
              <button
                type="button"
                data-clickable="true"
                onClick={() => setLegalModalTab(null)}
                className="px-5 py-2.5 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-semibold transition-all cursor-pointer"
              >
                Close Center
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
