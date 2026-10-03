# Stage 0014: On-Chain Decision Hash & Defense-in-Depth Cap

_Oct 03, 2026 · Added cryptographic decision-hash replay protection to `ArcEscrow.sol`, a canonical keccak256 encoding in TypeScript, and two new Hardhat + node:test suites proving on-chain idempotency. Inspired by STEWARD's `AllowanceManager.usedDecision` pattern._

---

## What Tavryn can do now that it couldn't last time

The agent's payment pipeline now has an on-chain defense-in-depth layer that prevents any single point of compromise from replaying a decision:

1. **On-chain `usedDecisions` mapping**: `ArcEscrow.sol` now records a `bytes32 decisionHash` inside every `Agreement` struct. Before an agreement is created via `createAgreementWithSavings`, the contract checks `usedDecisions[decisionHash]` and reverts with a descriptive error if the hash has already been consumed. This mapping is permanent and cannot be reset — even by the owner. The hash is also emitted in the `AgreementCreated` event for off-chain indexing.

2. **Canonical decision encoding in TypeScript** (`lib/policy/decision-hash.ts`): A pure deterministic module serializes 9 decision fields (businessId, contractId, negotiationId, vendorWallet, amount, baselinePrice, category, policyDecision, reviewerVerdict) into byte-exact canonical JSON with alphabetically sorted keys, 6-decimal USDC precision, and lowercase address normalization. The keccak256 of this canonical JSON produces the `decisionHash` that gets committed on-chain.

3. **Contract interface alignment**: `lib/contracts/arc-escrow.ts` and `lib/circle/escrow-contract.ts` were updated with the `decisionHash` parameter in ABI definitions and contract call logic. The escrow creation tool (`lib/tools/escrow/create.ts`) now computes and passes `decisionHash` through the entire pipeline.

4. **14 Hardhat tests passing**: Two new tests verify: (a) that an agreement records `decisionHash` and emits it in `AgreementCreated`, and (b) that replaying the same `decisionHash` strictly reverts on-chain — even when called by the owner.

5. **4 node:test canonical hash tests passing**: Verify byte-exact determinism regardless of key order, address casing normalization, $0.01 tamper detection, and 6-decimal USDC precision pinning.

## Trade-offs & honest caveats

- The canonical encoding is JSON-based (not `abi.encode`-based). This means the on-chain `computeDecisionHash` function would need to replicate the same JSON serialization in Solidity if we wanted fully on-chain verification. For the hackathon MVP, the hash is computed off-chain and committed on-chain, which is a weaker guarantee than STEWARD's approach (which uses `abi.encode` for both sides). The hash still prevents replay, but a compromised server could theoretically compute a hash for a fraudulent decision. The `maxPerAgreement` cap limits blast radius.
- `maxPerAgreement` was already present from earlier stages — this stage didn't add a new `maxSingleEscrowCap` because the existing cap serves the same purpose. We chose not to add redundant storage.

## Files changed

| File                                 | What                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/contracts/ArcEscrow.sol`  | `usedDecisions` mapping, `decisionHash` in Agreement struct and `AgreementCreated` event, replay rejection in `_createAgreementInternal` |
| `contracts/test/ArcEscrow.test.js`   | Tests 13–14: decision hash recording and replay rejection                                                                                |
| `lib/policy/decision-hash.ts`        | New module: `canonicalizeDecisionPayload`, `computeEscrowDecisionHash`                                                                   |
| `lib/contracts/arc-escrow.ts`        | Updated ABI with `decisionHash` parameter                                                                                                |
| `lib/circle/escrow-contract.ts`      | Passes `decisionHash` through contract call                                                                                              |
| `lib/tools/escrow/create.ts`         | Computes and logs `decisionHash` in pipeline                                                                                             |
| `tests/decision-hash.test.ts`        | 4 canonical hash determinism tests                                                                                                       |
| `tests/unlinked-idempotency.test.ts` | Isolated fixture for policy authorization testing                                                                                        |

## Verification

```
# Hardhat: 14 passing (including decision hash tests 13-14)
cd contracts && npx hardhat test

# Node:test: 5 passing (canonical hash suite)
npx tsx --test tests/decision-hash.test.ts
```
