import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateSwitchingCosts,
  evaluateSwitchingMatrix,
  SwitchingInput,
} from "../lib/switching";

test("Switching Engine: calculateSwitchingCosts computes realistic category-specific friction", () => {
  const cloudFriction = calculateSwitchingCosts("cloud", 50000, 100);
  assert.equal(cloudFriction.migrationEffort, 2500 + 50000 * 0.08); // 6500
  assert.equal(cloudFriction.downtimeRisk, 1500 + 50000 * 0.04); // 3500
  assert.equal(cloudFriction.retrainingCost, 1000);
  assert.equal(cloudFriction.totalSwitchingCost, 11000);

  const saasFriction = calculateSwitchingCosts("software", 12000, 50);
  assert.equal(saasFriction.migrationEffort, 800 + 50 * 35); // 2550
  assert.equal(saasFriction.downtimeRisk, 500 + 50 * 15); // 1250
  assert.equal(saasFriction.retrainingCost, 50 * 40); // 2000
  assert.equal(saasFriction.totalSwitchingCost, 5800);

  const contractorFriction = calculateSwitchingCosts("contractors", 30000, 5);
  assert.equal(contractorFriction.migrationEffort, 1200);
  assert.equal(contractorFriction.downtimeRisk, 600);
  assert.equal(contractorFriction.retrainingCost, 800);
  assert.equal(contractorFriction.totalSwitchingCost, 2600);
});

test("Switching Engine: recommends 'stay_and_renegotiate' when incumbent discount is solid", () => {
  const input: SwitchingInput = {
    contractId: "contract-1",
    service: "Slack Pro",
    category: "software",
    currentBaseline: 10000,
    renegotiatedPrice: 8000, // $2,000 annual savings with incumbent
    seatCount: 20,
    competitors: [
      {
        id: "c-1",
        name: "Discord Enterprise",
        category: "software",
        reputationScore: 4.4,
        estimatedPrice: 7500, // $2,500 sticker savings, but switching cost is ~$2,300
      },
      {
        id: "c-2",
        name: "Mattermost",
        category: "software",
        reputationScore: 4.1,
        estimatedPrice: 7800,
      },
    ],
  };

  const matrix = evaluateSwitchingMatrix(input);
  assert.equal(matrix.recommendation.action, "stay_and_renegotiate");
  assert.match(
    matrix.recommendation.rationale,
    /outperforms market migration alternatives|renegotiating with incumbent/i,
  );
  assert.equal(matrix.recommendation.requiresHumanApproval, true);
});

test("Switching Engine: recommends 'switch_to_competitor' when competitor offers massive 2-year yield and fast payback", () => {
  const input: SwitchingInput = {
    contractId: "contract-2",
    service: "Legacy Cloud Hosting",
    category: "cloud",
    currentBaseline: 60000,
    renegotiatedPrice: 56000, // Incumbent only gave $4,000 savings ($8,000 over 2 yrs)
    seatCount: 10,
    competitors: [
      {
        id: "c-aws",
        name: "AWS Enterprise",
        category: "cloud",
        reputationScore: 4.8,
        estimatedPrice: 38000, // $22,000 annual savings!
      },
    ],
  };

  const matrix = evaluateSwitchingMatrix(input);
  assert.equal(matrix.recommendation.action, "switch_to_competitor");
  assert.equal(matrix.recommendation.targetVendor, "AWS Enterprise");
  assert.ok(matrix.recommendation.netAdvantage > 15000);
  assert.equal(matrix.recommendation.requiresHumanApproval, true); // Strict policy invariant
});

test("Switching Engine: Invariant - requiresHumanApproval is always true", () => {
  const input: SwitchingInput = {
    contractId: "contract-3",
    service: "Design Tool",
    category: "software",
    currentBaseline: 5000,
    renegotiatedPrice: 4000,
    competitors: [],
  };

  const matrix = evaluateSwitchingMatrix(input);
  assert.equal(matrix.recommendation.requiresHumanApproval, true);
});
