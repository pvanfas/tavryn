import assert from "node:assert/strict";
import test from "node:test";

import {
  ARC_CONFIG,
  calculateIdleTreasuryUsycYield,
  getArcUsdcBalance,
  getCircleClient,
  getCircleGatewayUnifiedBalance,
  getOnChainUSDCBalance,
  getTreasuryUSDCBalance,
  isCircleConfigured,
} from "../lib/circle";

test("ARC_CONFIG contains verified Arc testnet parameters", () => {
  assert.equal(ARC_CONFIG.blockchain, "ARC-TESTNET");
  assert.equal(ARC_CONFIG.chainId, 5042002);
  assert.equal(ARC_CONFIG.rpcUrl, "https://rpc.testnet.arc.network");
  assert.equal(
    ARC_CONFIG.usdcContractAddress.toLowerCase(),
    "0x3600000000000000000000000000000000000000",
  );
  assert.equal(ARC_CONFIG.faucetUrl, "https://faucet.circle.com");
  assert.equal(ARC_CONFIG.explorerUrl, "https://testnet.arcscan.app");
});

test("getOnChainUSDCBalance rejects invalid or malformed EVM addresses", async () => {
  await assert.rejects(
    async () => {
      await getOnChainUSDCBalance("not-an-address");
    },
    {
      name: "Error",
      message: /Invalid EVM wallet address/,
    },
  );

  await assert.rejects(
    async () => {
      await getOnChainUSDCBalance("");
    },
    {
      name: "Error",
      message: /Invalid EVM wallet address/,
    },
  );
});

test("getOnChainUSDCBalance queries live Arc Testnet JSON-RPC and returns valid numeric balance", async () => {
  // Query zero address on Arc Testnet
  const balance = await getOnChainUSDCBalance(
    "0x0000000000000000000000000000000000000000",
  );
  assert.equal(typeof balance, "number");
  assert.ok(Number.isFinite(balance));
  assert.ok(balance >= 0);
});

test("getTreasuryUSDCBalance resolves directly via chain_rpc for on-chain address", async () => {
  const result = await getTreasuryUSDCBalance({
    walletAddress: "0x0000000000000000000000000000000000000000",
  });

  assert.equal(result.source, "chain_rpc");
  assert.equal(result.address, "0x0000000000000000000000000000000000000000");
  assert.equal(typeof result.balance, "number");
  assert.ok(result.balance >= 0);
});

test("getCircleClient requires CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET when unconfigured", () => {
  if (!isCircleConfigured()) {
    assert.throws(
      () => {
        getCircleClient();
      },
      {
        name: "Error",
        message: /Missing required Circle credentials/,
      },
    );
  } else {
    const client = getCircleClient();
    assert.ok(client);
    assert.equal(typeof client.createWallets, "function");
  }
});

test("getArcUsdcBalance safely returns 0 for invalid addresses without throwing", async () => {
  const invalidResult = await getArcUsdcBalance("invalid-address");
  assert.equal(invalidResult, 0);

  const emptyResult = await getArcUsdcBalance("");
  assert.equal(emptyResult, 0);
});

test("getArcUsdcBalance queries live Arc Testnet JSON-RPC and returns valid numeric balance", async () => {
  const balance = await getArcUsdcBalance(
    "0x0000000000000000000000000000000000000000",
  );
  assert.equal(typeof balance, "number");
  assert.ok(Number.isFinite(balance));
  assert.ok(balance >= 0);
});

test("calculateIdleTreasuryUsycYield computes operational reserve and surplus allocation", () => {
  const yieldResult = calculateIdleTreasuryUsycYield({
    treasuryBalance: 50000,
    upcomingObligations30d: 10000,
  });

  // 1.5x of 10000 = 15000 operational reserve
  assert.equal(yieldResult.activeOperationalLiquidity, 15000);
  assert.equal(yieldResult.idleReserveYieldPrincipal, 35000);
  assert.equal(yieldResult.usycApyPct, 5.12);
  assert.equal(yieldResult.status, "yielding");
  assert.equal(
    yieldResult.estimatedAnnualYield,
    Math.round(35000 * (5.12 / 100)),
  );
});

test("calculateIdleTreasuryUsycYield shifts status to rebalancing when obligations match or exceed treasury", () => {
  const tightYield = calculateIdleTreasuryUsycYield({
    treasuryBalance: 6000,
    upcomingObligations30d: 5000,
  });

  assert.equal(tightYield.idleReserveYieldPrincipal, 0);
  assert.equal(tightYield.status, "rebalancing");
  assert.equal(tightYield.estimatedAnnualYield, 0);
});

test("getCircleGatewayUnifiedBalance aggregates cross-chain liquidity across 4 supported networks", async () => {
  const unified = await getCircleGatewayUnifiedBalance(
    "0x0000000000000000000000000000000000000000",
    40000,
  );

  assert.equal(unified.chains.length, 4);
  assert.equal(
    unified.architecture,
    "Circle Gateway Permissionless Multichain Unified Balance Pool",
  );
  assert.ok(unified.gatewayMinterAddress.startsWith("0x"));

  const sumChains = unified.chains.reduce((acc, c) => acc + c.balance, 0);
  assert.equal(unified.totalUnifiedUsdc, sumChains);
});
