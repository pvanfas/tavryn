# USYC Integration Status — Blocker Report

_Oct 03, 2026 · Assessed feasibility of live USYC mint/redeem integration for Tavryn treasury idle yield._

---

## What USYC Is

USYC is Circle's tokenized money market fund (Hashnote International Short Duration Yield Fund Ltd.), deployed on Arc and other chains. It provides yield-bearing exposure to short-term US Treasury bills and reverse repos.

**Contract addresses on Arc Testnet** (confirmed via Circle developer docs):
| Contract | Address |
|----------|---------|
| USYC Token | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| Teller (USDC ↔ USYC) | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` |

---

## What's Blocking Live Integration

### 1. Permissioned Allowlisting (Showstopper)

USYC is a **regulated, permissioned asset**. The Teller contract enforces an on-chain allowlist managed by Circle's Entitlements contract. To call `deposit()` (mint USYC from USDC) or `redeem()` (burn USYC back to USDC), the calling wallet address must be **explicitly allowlisted** by Circle through their institutional onboarding process.

Our developer-controlled wallet on Arc Testnet (`ARC_WALLET_ADDRESS`) is **not allowlisted** for USYC. Calling the Teller contract will revert with an entitlements check failure.

### 2. Institutional Eligibility Requirements

USYC access requires:
- **Non-U.S. person** or qualified institutional investor
- **Minimum $100,000 USD** investment (typical)
- **KYC/accreditation** through Circle's compliance pipeline
- **Signed subscription agreement** for the Hashnote fund

These requirements cannot be fulfilled during a hackathon, even on testnet. Circle has not published a self-service testnet allowlisting flow for USYC as of this assessment.

### 3. No Public Testnet Faucet

Unlike USDC (which has a testnet faucet on Arc), there is no USYC testnet faucet or self-service minting mechanism. The only path to testnet USYC is through Circle's institutional onboarding.

---

## What We Have Today

`lib/circle/balances.ts` exports `calculateIdleTreasuryUsycYield()` — a **deterministic analytical model** that:
- Calculates 30-day operational reserve (1.5× upcoming obligations)
- Identifies surplus idle capital beyond the operational buffer
- Projects yield at 5.12% APY (current USYC rate) over 30/365-day horizons
- Triggers a 45-day cliff redemption lookahead to ensure liquidity ahead of renewal dates

This model is fully functional and used in the dashboard treasury view. It accurately forecasts what USYC yield *would* produce — it just doesn't execute real on-chain mint/redeem transactions.

---

## What Would Be Needed to Unblock

1. **Circle allowlists our Arc Testnet wallet** for USYC Teller interactions
2. **Circle provides testnet USYC** via a faucet or manual allocation
3. We implement:
   - `mintUsyc(amount)` → calls `Teller.deposit(usdc, amount)` after USDC approval
   - `redeemUsyc(amount)` → calls `Teller.redeem(amount)` when cron forecasts cash need
   - Price-band circuit breaker: if USYC oracle price deviates >0.5% from $1.00, halt all automated mint/redeem and escalate to human

---

## Honest Assessment

This is a **regulatory/access blocker**, not a technical one. The smart contract integration code would be straightforward (~100 lines: approve USDC → deposit → handle redemption events). But without allowlisting, any attempt to call the Teller contract will revert.

For the hackathon submission, the analytical yield model in `calculateIdleTreasuryUsycYield()` demonstrates the treasury management strategy and correctly forecasts yield. A production deployment would need to go through Circle's institutional onboarding to access USYC.

**Recommendation**: Ship with the analytical model, document the integration path, and note USYC as a post-hackathon milestone contingent on Circle allowlisting.
