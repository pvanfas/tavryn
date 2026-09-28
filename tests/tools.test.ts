import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate_savings,
  release_escrow,
  createAgentTools,
} from '../lib/tools';
import { getServiceSupabase } from '../lib/supabase';

test('calculate_savings computes exact differences and percentage correctly', async () => {
  const executeCalc = (calculate_savings as any).execute;
  const result = await executeCalc(
    {
      oldPrice: 10000,
      newPrice: 7500,
      months: 12,
    },
    { messages: [], toolCallId: 'test-calc' }
  );

  assert.equal(result.absoluteSavings, 2500);
  assert.equal(result.percentageSavings, 25);
  assert.equal(result.monthlySavings, 208.33);
});

test('release_escrow refuses when verificationPassed is false', async () => {
  await assert.rejects(
    async () => {
      await (release_escrow as any).execute(
        { contractId: '00000000-0000-0000-0000-000000000000', verificationPassed: false },
        { messages: [], toolCallId: 't3' }
      );
    },
    /vendor confirmation verification has not passed/
  );
});

test('send_vendor_message and get_negotiation_status persist rounds and conversation to database', async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from('contracts')
    .select('id, business_id, current_price')
    .eq('service', 'Slack')
    .single();

  assert.ok(slackContract, 'Seeded Slack contract must exist');

  const tools = createAgentTools({ businessId: slackContract.business_id });

  // Execute round 1 via send_vendor_message
  const response = await (tools.send_vendor_message as any).execute({
    contractId: slackContract.id,
    offer: 7000,
    message: 'Testing round 1 offer via tool',
    round: 1,
  });

  assert.ok(response.counter_offer > 0);
  assert.equal(typeof response.accepted, 'boolean');
  assert.ok(response.message.length > 0);

  // Inspect status via get_negotiation_status
  const status = await (tools.get_negotiation_status as any).execute({
    contractId: slackContract.id,
  });

  assert.equal(status.exists, true);
  assert.equal(status.negotiation.contract_id, slackContract.id);
  assert.ok(status.negotiation.rounds >= 1);
  assert.ok(Array.isArray(status.negotiation.conversation));
  assert.ok(status.negotiation.conversation.length >= 2); // Agent offer + vendor counter
});

test('get_contract and get_usage run deterministically on seeded Slack contract and log agent_actions', async () => {
  const supabase = getServiceSupabase();
  const { data: slackContract } = await supabase
    .from('contracts')
    .select('id, business_id')
    .eq('service', 'Slack')
    .single();

  assert.ok(slackContract, 'Seeded Slack contract must exist');

  const tools = createAgentTools({ businessId: slackContract.business_id });

  // 1. get_contract
  const contractResult = await (tools.get_contract as any).execute(
    { contractId: slackContract.id },
    { messages: [], toolCallId: 't-contract' }
  );
  assert.equal(contractResult.service, 'Slack');
  assert.equal(contractResult.seat_count, 25);
  assert.equal(contractResult.active_seats, 18);

  // 2. get_usage
  const usageResult = await (tools.get_usage as any).execute(
    { contractId: slackContract.id },
    { messages: [], toolCallId: 't-usage' }
  );
  assert.equal(usageResult.unused_seats, 7);
  assert.equal(usageResult.utilization_pct, 72);
  assert.ok(usageResult.signals[0].includes('7 unallocated / idle seats detected'));

  // 3. check_policy
  const policyResult = await (tools.check_policy as any).execute(
    {
      action: 'downsize_seats',
      amount: 6912,
      savings: 2688,
      category: 'software',
    },
    { messages: [], toolCallId: 't-policy' }
  );
  assert.equal(typeof policyResult.approved, 'boolean');

  // 4. Verify agent_actions were logged in Postgres
  const { data: actions, error: actErr } = await supabase
    .from('agent_actions')
    .select('action, business_id')
    .eq('business_id', slackContract.business_id)
    .order('created_at', { ascending: false })
    .limit(10);

  assert.ifError(actErr);
  const actionNames = actions.map((a: any) => a.action);
  assert.ok(actionNames.includes('get_contract'), 'get_contract must be logged in agent_actions');
  assert.ok(actionNames.includes('get_usage'), 'get_usage must be logged in agent_actions');
  assert.ok(actionNames.includes('check_policy'), 'check_policy must be logged in agent_actions');
});
