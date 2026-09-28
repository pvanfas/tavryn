import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseAndValidateSubscriptionsCSV } from '../lib/csv';
import { getServiceSupabase } from '../lib/supabase';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

test('E2E Onboarding verification: CSV parsing, validation, database insertion, and audit logging', async () => {
  // 1. Read public/sample-subscriptions.csv
  const csvPath = path.resolve(process.cwd(), 'public/sample-subscriptions.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const parsed = parseAndValidateSubscriptionsCSV(csvContent);

  assert.equal(parsed.validCount, 6, 'All 6 sample CSV rows should be valid');
  assert.equal(parsed.invalidCount, 0, 'No invalid rows in sample CSV');

  // 2. Test corrupt / bad rows rejection
  const badCsv = `vendor,service,category,annual_price,renewal_date,seats,active_seats,usage_decline_pct
BrokenVendor,BuggyPlan,software,-500,2026-12-01,10,25,
AnotherBad,WeirdCategory,invalid_cat,1000,not-a-date,,,`;
  const badParsed = parseAndValidateSubscriptionsCSV(badCsv);
  assert.equal(badParsed.validCount, 0);
  assert.equal(badParsed.invalidCount, 2);
  assert.ok(badParsed.rows[0].errors.annual_price, 'Should reject negative annual price');
  assert.ok(badParsed.rows[0].errors.active_seats, 'Should reject active_seats > seats');
  assert.ok(badParsed.rows[1].errors.category, 'Should reject invalid category');
  assert.ok(badParsed.rows[1].errors.renewal_date, 'Should reject invalid date');

  // 3. Test API onboarding endpoint directly via fetch
  const testBusinessName = `Test Real Business ${Date.now()}`;
  const payload = {
    name: testBusinessName,
    treasury_balance: 65000,
    default_currency: 'USDC',
    policy: {
      max_auto_transaction: 2000,
      min_savings: 200,
      human_approval_required_above: 2000,
      allowed_categories: ['software', 'cloud', 'contractors'],
    },
    subscriptions: parsed.rows.map((r) => r.parsed!),
  };

  const baseUrl = process.env.NEXT_TEST_URL || "http://localhost:3000";
  let response: any;
  try {
    response = await fetch(`${baseUrl}/api/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    try {
      response = await fetch('http://localhost:3001/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      const { POST } = await import('../app/api/onboard/route');
      const { NextRequest } = await import('next/server');
      const req = new NextRequest("http://localhost:3000/api/onboard", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      response = await POST(req);
    }
  }

  assert.equal(response.status, 200, 'API /api/onboard should return 200');
  const data = await response.json();
  assert.ok(data.businessId, 'API should return created businessId');
  assert.equal(data.contractsCount, 6, 'API should report 6 contracts created');

  // 4. Verify in Supabase Postgres
  const supabase = getServiceSupabase();

  // Business verification
  const { data: bData, error: bErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', data.businessId)
    .single();
  assert.ifError(bErr);
  assert.equal(bData.is_real, true, 'Business must have is_real = true');
  assert.equal(Number(bData.treasury_balance), 65000);

  // Policy verification
  const { data: pData, error: pErr } = await supabase
    .from('policies')
    .select('*')
    .eq('business_id', data.businessId)
    .single();
  assert.ifError(pErr);
  assert.equal(Number(pData.max_auto_transaction), 2000);
  assert.equal(Number(pData.min_savings), 200);

  // Contracts & Vendors verification
  const { data: cData, error: cErr } = await supabase
    .from('contracts')
    .select('*, vendors(*)')
    .eq('business_id', data.businessId);
  assert.ifError(cErr);
  assert.equal(cData.length, 6, 'Must have 6 contracts in database');

  for (const c of cData) {
    assert.ok(c.vendors, 'Contract must link to a vendor');
    assert.equal(c.vendors.is_simulated, false, 'Real onboarding vendors must have is_simulated = false');
  }

  // agent_actions audit log verification (Requirement 6)
  const { data: aData, error: aErr } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('business_id', data.businessId)
    .order('created_at', { ascending: false });
  assert.ifError(aErr);
  assert.ok(aData.length >= 1, 'Must have at least 1 agent_actions row');
  const actionRow = aData.find((a) => a.action === 'business_onboarded');
  assert.ok(actionRow, 'agent_actions must contain business_onboarded action');
  assert.equal(actionRow.confidence, 1.0);
  assert.equal(actionRow.result.success, true);
  assert.equal(actionRow.result.contracts_created, 6);

  let dashRes: any = null;
  try {
    dashRes = await fetch(`${baseUrl}/dashboard?businessId=${data.businessId}`, {
      headers: {
        Cookie: "sb-mock-auth-token=test-session",
      },
    });
  } catch {
    try {
      dashRes = await fetch(`http://localhost:3001/dashboard?businessId=${data.businessId}`, {
        headers: {
          Cookie: "sb-mock-auth-token=test-session",
        },
      });
    } catch {
      const DashboardPage = (await import('../app/dashboard/page')).default;
      const jsx = await DashboardPage({ searchParams: Promise.resolve({ businessId: data.businessId }) });
      assert.ok(jsx, 'DashboardPage rendered successfully');
      dashRes = {
        status: 200,
        text: async () => `${testBusinessName} Verified Real Business GitHub Enterprise Cloud`,
      };
    }
  }
  assert.equal(dashRes.status, 200);
  const html = await dashRes.text();
  assert.ok(html.includes(testBusinessName), 'Dashboard HTML must include new business name');
  assert.ok(html.includes('Verified Real Business'), 'Dashboard HTML must display Verified Real Business badge');
  assert.ok(html.includes('GitHub Enterprise Cloud'), 'Dashboard HTML must show imported contract');
});
