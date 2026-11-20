import { auditDomainDeliverability } from '../lib/dns-engine';

async function runTests() {
  console.log('🧪 Starting InboxSentinel DNS Engine Verification...\n');

  // Test 1: Scan a verified production outbound domain (e.g. google.com or stripe.com)
  console.log('Test 1: Auditing live enterprise domain (stripe.com)...');
  const result = await auditDomainDeliverability('stripe.com');
  console.log(`✓ Audit completed in ${result.responseTimeMs}ms`);
  console.log(`  - Mail Provider: ${result.emailProvider}`);
  console.log(`  - MX Records: ${result.mx.records.length} found`);
  console.log(`  - SPF Record: ${result.spf.rawRecord}`);
  console.log(`  - SPF Lookups: ${result.spf.lookupCount}/10 (Limit exceeded: ${result.spf.lookupLimitExceeded})`);
  console.log(`  - DMARC Policy: ${result.dmarc.policy} (Compliant: ${result.dmarc.isCompliant2026})`);
  console.log(`  - Blacklists Checked: ${result.blacklists.totalChecked} (Listed: ${result.blacklists.listedCount})`);
  console.log(`  - Score: ${result.healthScore}/100 [${result.healthStatus}]`);

  if (!result.mx.installed || !result.spf.installed || !result.dmarc.installed) {
    throw new Error('Stripe.com failed to resolve primary DNS email records');
  }
  console.log('✅ Test 1 Passed: Enterprise domain successfully resolved and parsed.\n');

  // Test 2: Scan domain without protocol prefix
  console.log('Test 2: Testing raw input normalization with subdomains...');
  const res2 = await auditDomainDeliverability('https://www.github.com/some/path');
  console.log(`✓ Normalized target domain: ${res2.domain}`);
  if (res2.domain !== 'github.com') {
    throw new Error(`Normalization failed: expected github.com, got ${res2.domain}`);
  }
  console.log('✅ Test 2 Passed: Domain normalization succeeded.\n');

  console.log('🎉 ALL DNS ENGINE TESTS PASSED!');
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
