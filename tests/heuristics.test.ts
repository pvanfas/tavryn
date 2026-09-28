import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSeatSavings,
  calculateUsageDeclineSavings,
  evaluateContractOpportunity
} from '../lib/heuristics';

test('calculateSeatSavings calculates exact unused seat proportion', () => {
  // Slack contract: $9,600, 25 seats, 18 active (7 unused)
  // 9600 * 7 / 25 = 2688
  const savings = calculateSeatSavings(9600, 25, 18);
  assert.equal(savings, 2688);
});

test('calculateSeatSavings returns 0 when all seats active or over-utilized', () => {
  assert.equal(calculateSeatSavings(10000, 20, 20), 0);
  assert.equal(calculateSeatSavings(10000, 20, 25), 0);
  assert.equal(calculateSeatSavings(10000, 0, 0), 0);
});

test('calculateUsageDeclineSavings computes 70% of percentage decline', () => {
  // Datadog: $37,200 with 31% decline
  // 37200 * 0.31 * 0.7 = 8072.4
  const ddSavings = calculateUsageDeclineSavings(37200, 31);
  assert.equal(ddSavings, 8072.4);

  // AWS: $24,000 with 12% decline
  // 24000 * 0.12 * 0.7 = 2016
  const awsSavings = calculateUsageDeclineSavings(24000, 12);
  assert.equal(awsSavings, 2016);
});

test('evaluateContractOpportunity correctly routes seat-based vs usage-decline heuristics', () => {
  const slackContract = {
    service: 'Slack',
    category: 'software',
    current_price: 9600,
    renewal_date: new Date().toISOString(),
    seat_count: 25,
    active_seats: 18,
    status: 'active'
  };
  const slackEval = evaluateContractOpportunity(slackContract);
  assert.equal(slackEval.saving, 2688);
  assert.equal(slackEval.heuristicType, 'seat_optimization');

  const datadogContract = {
    service: 'Datadog',
    category: 'cloud',
    current_price: 37200,
    renewal_date: new Date().toISOString(),
    usage_metric: { type: 'usage_decline', decline_pct: 31 },
    status: 'active'
  };
  const ddEval = evaluateContractOpportunity(datadogContract);
  assert.equal(ddEval.saving, 8072.4);
  assert.equal(ddEval.heuristicType, 'usage_decline');
});
