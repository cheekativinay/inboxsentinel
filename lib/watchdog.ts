import { auditDomainDeliverability } from './dns-engine';
import {
  MonitoredDomain,
  CheckLog,
  getMonitoredDomains,
  saveMonitoredDomains,
  appendCheckLog,
} from './store';

export async function executeDomainCheck(item: MonitoredDomain): Promise<{
  domain: MonitoredDomain;
  log: CheckLog;
}> {
  const audit = await auditDomainDeliverability(item.domain);

  let newStatus: MonitoredDomain['status'] = 'optimal';
  const issues: string[] = [];

  if (audit.healthStatus === 'UNCONFIGURED') {
    newStatus = 'unconfigured';
    issues.push(...audit.summary.critical);
  } else if (audit.healthStatus === 'CRITICAL_BLACKLISTED') {
    newStatus = 'critical';
    issues.push(...audit.summary.critical);
  } else if (audit.healthStatus === 'CONFIGURATION_ERROR') {
    newStatus = 'error';
    issues.push(...audit.summary.critical);
  } else if (audit.healthStatus === 'AT_RISK') {
    newStatus = 'at_risk';
    issues.push(...audit.summary.warnings);
  } else {
    newStatus = 'optimal';
  }

  const blacklistedNames = audit.blacklists.results
    .filter((b) => b.listed)
    .map((b) => b.name);

  let alertDispatched = false;

  // Only dispatch siren if actually blacklisted or experiencing fatal configuration error
  if ((newStatus === 'critical' || newStatus === 'error') && item.webhookUrl) {
    try {
      let payload: Record<string, unknown> = {};

      if (item.channel === 'slack') {
        payload = {
          text: `[InboxSentinel ALARM] Outbound deliverability dropped on ${item.domain}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚨 InboxSentinel: Outbound Blacklist Alert',
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Domain:*\n\`${item.domain}\`` },
                { type: 'mrkdwn', text: `*Status:*\n${newStatus.toUpperCase()}` },
                {
                  type: 'mrkdwn',
                  text: `*Blacklists Flagged:*\n${blacklistedNames.length > 0 ? blacklistedNames.join(', ') : 'None'}`,
                },
                { type: 'mrkdwn', text: `*DMARC:*\n${audit.dmarc.policy}` },
              ],
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Issues: ${issues.join(' • ')} | Timestamp: ${new Date().toLocaleTimeString()}`,
                },
              ],
            },
          ],
        };
      } else {
        // Discord / Generic Webhook
        payload = {
          source: 'InboxSentinel',
          domain: item.domain,
          status: newStatus.toUpperCase(),
          issues,
          blacklistedOn: blacklistedNames,
          timestamp: new Date().toISOString(),
        };
      }

      const res = await fetch(item.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alertDispatched = true;
      }
    } catch (err) {
      console.error(`Failed to dispatch alert for ${item.domain}:`, err);
    }
  }

  const updatedDomain: MonitoredDomain = {
    ...item,
    status: newStatus,
    lastCheckedAt: new Date().toISOString(),
    lastResponseTimeMs: audit.responseTimeMs,
    dmarcPolicy: audit.dmarc.policy,
    spfLookupCount: audit.spf.lookupCount,
    blacklistedOn: blacklistedNames,
    issues,
  };

  const newLog: CheckLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    domain: item.domain,
    checkedAt: new Date().toISOString(),
    status: newStatus,
    responseTimeMs: audit.responseTimeMs,
    blacklistedCount: blacklistedNames.length,
    dmarcPolicy: audit.dmarc.policy,
    issues,
    alertDispatched,
    channel: item.channel,
  };

  appendCheckLog(newLog);

  return { domain: updatedDomain, log: newLog };
}

export async function runAllDomainChecks(): Promise<{
  totalChecked: number;
  criticalCount: number;
  atRiskCount: number;
  optimalCount: number;
  unconfiguredCount: number;
  domains: MonitoredDomain[];
}> {
  const domains = getMonitoredDomains();
  const updatedList: MonitoredDomain[] = [];

  let criticalCount = 0;
  let atRiskCount = 0;
  let optimalCount = 0;
  let unconfiguredCount = 0;

  for (const item of domains) {
    const { domain: updated } = await executeDomainCheck(item);
    updatedList.push(updated);

    if (updated.status === 'critical' || updated.status === 'error') criticalCount++;
    else if (updated.status === 'at_risk') atRiskCount++;
    else if (updated.status === 'unconfigured') unconfiguredCount++;
    else optimalCount++;
  }

  saveMonitoredDomains(updatedList);

  return {
    totalChecked: updatedList.length,
    criticalCount,
    atRiskCount,
    optimalCount,
    unconfiguredCount,
    domains: updatedList,
  };
}
