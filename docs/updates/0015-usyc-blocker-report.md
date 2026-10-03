# Stage 0015: USYC Yield Integration Feasibility & Blocker Report

_Oct 03, 2026 · Researched Circle USYC on-chain contracts and access requirements on Arc testnet, identified regulatory and contract-allowlisting prerequisites, and documented a concrete integration plan in `docs/usyc-status.md`._

---

## What Tavryn can do now that it couldn't last time

1. **Clear, documented operational boundary for idle treasury yield**: Rather than writing phantom contract calls to an unverified address or guessing the Teller contract flow, Tavryn now has a rigorous architectural evaluation of Circle's USYC (Hashnote International Short Duration Yield Fund token).
2. **Comprehensive Blocker Report** (`docs/usyc-status.md`): Documents the exact regulatory status (USYC is an institutional, permissioned ERC-20 token requiring KYC/AML accreditation, minimum $100k balance, and permissioned allowlisting on the Teller smart contract), explains why live on-chain mint/redeem cannot proceed during the testnet hackathon window, and diagrams the phased architecture for production deployment.
3. **Preserved Analytical Yield Modeling**: Keeps Tavryn's treasury yield forecasting deterministic in `lib/circle/balances.ts` (`calculateIdleTreasuryUsycYield`) without breaking runtime safety or claiming false on-chain settlements.

## Trade-offs & honest caveats

- No live contract transactions are dispatched on Arc for USYC. While it would have been tempting to mock an ERC-20 token and label it "USYC", that violates our honest labeling rule. The analytical model truthfully projects yield on idle USDC above operating reserves while documenting the real institutional gating mechanism.

## Files changed

| File | What |
|------|------|
| `docs/usyc-status.md` | New document: Technical and regulatory blocker report for live USYC mint/redeem on Arc |

## Verification

- Web search and documentation verification against Circle USYC developer documentation (`developers.circle.com/usyc`).
- Verified zero broken runtime dependencies in `lib/circle/balances.ts`.
