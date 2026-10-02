# Reference Architecture Notes: circlefin/arc-escrow

Analysis of the reference repository `circlefin/arc-escrow` (Workflow Escrow Refund Protocol on Arc Testnet with Circle Developer-Controlled Wallets).

## 1. System Overview

The reference repository demonstrates an end-to-end freelance escrow protocol built with Next.js, Supabase, Circle Developer-Controlled Wallets, and smart contracts deployed on the Arc testnet.

Key components:

1. **Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`)**:
   - Manages programmatic server-side Smart Contract Account (SCA) wallets for agents and participants.
   - Signs and submits transactions without requiring browser extensions or private key custody on the application server.
2. **Arc Testnet Connectivity**:
   - Arc is an EVM Layer-1 blockchain where **USDC is the native gas currency** (6 decimals).
   - Chain ID: `5042002` (`0x4cef52`).
   - Native RPC: `https://rpc.testnet.arc.network`.
   - ERC-20 Interface Address for USDC on Arc: `0x3600000000000000000000000000000000000000`.
   - Block Explorer: `https://testnet.arcscan.app`.
   - Circle Faucet: `https://faucet.circle.com`.
3. **Escrow Smart Contract (`RefundProtocol.sol`)**:
   - EIP-712 backed refund and deposit protocol.
   - Deployed and interacted with using Circle's Developer-Controlled Wallets via `createContractExecutionTransaction`.

---

## 2. Environment Variables & Credentials

From `.env.example`:

| Variable                            | Scope         | Purpose                                                                                         |
| ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `CIRCLE_API_KEY`                    | Server        | Circle API key generated from Circle Developer Console (`console.circle.com`).                  |
| `CIRCLE_ENTITY_SECRET`              | Server        | 32-byte hex entity secret registered with Circle for signing Developer-Controlled transactions. |
| `CIRCLE_BLOCKCHAIN`                 | Server        | Set to `"ARC-TESTNET"` for Arc testnet operations.                                              |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | Public/Server | `0x3600000000000000000000000000000000000000` (precompile/ERC20 contract on Arc testnet).        |
| `NEXT_PUBLIC_AGENT_WALLET_ID`       | Public/Server | Circle Wallet UUID for the system treasury/escrow agent.                                        |
| `NEXT_PUBLIC_AGENT_WALLET_ADDRESS`  | Public/Server | On-chain EVM address (`0x...`) corresponding to the agent wallet.                               |
| `NEXT_PUBLIC_SUPABASE_URL`          | Public        | Supabase URL.                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Public        | Supabase anonymous key.                                                                         |

---

## 3. Reusable Architecture & Code Patterns

### A. Circle Client Initialization

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

### B. Wallet Generation (from `generate-wallet.mjs`)

1. Create a Wallet Set:
   ```typescript
   const walletSetResponse = await circleDeveloperSdk.createWalletSet({
     name: "Tavryn Treasury Wallets",
   });
   const walletSetId = walletSetResponse.data.walletSet.id;
   ```
2. Create an SCA Wallet on Arc Testnet:
   ```typescript
   const createdWalletResponse = await circleDeveloperSdk.createWallets({
     accountType: "SCA",
     blockchains: ["ARC-TESTNET"],
     walletSetId,
   });
   const [wallet] = createdWalletResponse.data.wallets;
   // wallet.id: Circle wallet UUID
   // wallet.address: On-chain address (0x...)
   ```

### C. Reading USDC Balance (from `api/wallet/balance/route.ts`)

```typescript
const response = await circleDeveloperSdk.getWalletTokenBalance({
  id: walletId,
  includeAll: true,
});

const usdcBalance =
  response.data?.tokenBalances?.find(({ token }) => token.symbol === "USDC")
    ?.amount || "0";
```

_Note_: Because Arc testnet uses USDC as the native gas asset, we can also query on-chain balance directly via standard EVM JSON-RPC `eth_getBalance(address, "latest")` or `balanceOf(address)` on `0x3600000000000000000000000000000000000000`. This gives Tavryn double redundancy: querying Circle API when available, and verifying on-chain via Arc RPC.

### D. Transferring USDC

Using the Developer-Controlled Wallets transfer API:

```typescript
const transferResponse = await circleDeveloperSdk.createTransaction({
  walletId,
  tokenId, // or destinationAddress + amounts
  destinationAddress,
  amounts: [amountString],
  fee: {
    type: "level",
    config: {
      feeLevel: "MEDIUM",
    },
  },
});
```

---

## 4. Adaptations for Tavryn

1. **Treasury Management**:
   - In Tavryn, each business can have a developer-controlled treasury wallet.
   - Demo Co and newly onboarded businesses receive an Arc Testnet SCA wallet.
   - The on-chain address is stored in `businesses.wallet_address`.
2. **Dashboard Live Chain Display**:
   - The dashboard dynamically queries the live on-chain balance from Arc testnet.
   - If the chain query fails (e.g. rate limit, offline network, or missing credentials), it falls back to the database `treasury_balance` and visually labels it with an offline fallback badge.
3. **Deterministic Safety & Idempotency**:
   - All financial actions remain strictly bound by the policy engine (`/lib/policy.ts`).
   - Every transaction carries an idempotency key to prevent double spending.
