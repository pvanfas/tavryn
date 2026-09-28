import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  ARC_CONFIG, 
  getOnChainUSDCBalance, 
  isCircleConfigured, 
  getCircleClient, 
  getTreasuryUSDCBalance 
} from '../lib/circle';

test('ARC_CONFIG contains verified Arc testnet parameters', () => {
  assert.equal(ARC_CONFIG.blockchain, 'ARC-TESTNET');
  assert.equal(ARC_CONFIG.chainId, 5042002);
  assert.equal(ARC_CONFIG.rpcUrl, 'https://rpc.testnet.arc.network');
  assert.equal(ARC_CONFIG.usdcContractAddress.toLowerCase(), '0x3600000000000000000000000000000000000000');
  assert.equal(ARC_CONFIG.faucetUrl, 'https://faucet.circle.com');
  assert.equal(ARC_CONFIG.explorerUrl, 'https://testnet.arcscan.app');
});

test('getOnChainUSDCBalance rejects invalid or malformed EVM addresses', async () => {
  await assert.rejects(
    async () => {
      await getOnChainUSDCBalance('not-an-address');
    },
    {
      name: 'Error',
      message: /Invalid EVM wallet address/,
    }
  );

  await assert.rejects(
    async () => {
      await getOnChainUSDCBalance('');
    },
    {
      name: 'Error',
      message: /Invalid EVM wallet address/,
    }
  );
});

test('getOnChainUSDCBalance queries live Arc Testnet JSON-RPC and returns valid numeric balance', async () => {
  // Query zero address on Arc Testnet
  const balance = await getOnChainUSDCBalance('0x0000000000000000000000000000000000000000');
  assert.equal(typeof balance, 'number');
  assert.ok(Number.isFinite(balance));
  assert.ok(balance >= 0);
});

test('getTreasuryUSDCBalance resolves directly via chain_rpc for on-chain address', async () => {
  const result = await getTreasuryUSDCBalance({
    walletAddress: '0x0000000000000000000000000000000000000000',
  });

  assert.equal(result.source, 'chain_rpc');
  assert.equal(result.address, '0x0000000000000000000000000000000000000000');
  assert.equal(typeof result.balance, 'number');
  assert.ok(result.balance >= 0);
});

test('getCircleClient requires CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET when unconfigured', () => {
  if (!isCircleConfigured()) {
    assert.throws(
      () => {
        getCircleClient();
      },
      {
        name: 'Error',
        message: /Missing required Circle credentials/,
      }
    );
  } else {
    const client = getCircleClient();
    assert.ok(client);
    assert.equal(typeof client.createWallets, 'function');
  }
});
