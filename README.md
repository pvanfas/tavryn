# Tavryn

**An AI agent that finds the waste in a business's software spend, negotiates it away, and executes the resulting payment in USDC on Arc.**

Built for the [Tameion Agents Hackathon](https://tameion.thecanteenapp.com/) (Canteen x Circle), settled on Arc.

## The problem

SaaS and cloud contracts renew whether or not anyone opened the tool. Seats go unused, usage drops, and prices stay the same, because nobody has time to watch every contract, ask for a discount, and check that the vendor actually delivered the new terms. Software that only reports where money is being wasted still leaves a person to do the negotiating and paying.

## What it does

The agent runs one complete loop, without a person starting it:

```text
Detect renewal → Analyze usage vs contract → Find savings → Negotiate with vendor
      → Policy check → Escrow USDC → Verify vendor confirmation → Release payment → Record and learn
```

Example (seed data): Slack, 25 seats at $9,600/year, 18 active. The agent identifies 7 unused seats, negotiates over several rounds, the policy engine approves the result, the payment is escrowed on Arc, the vendor's confirmation is checked field by field, and funds are released only if everything matches.

**Bounded autonomy.** The agent decides, but it cannot exceed its authority:

- A deterministic policy engine (no LLM) approves or escalates every action.
- Spending caps and category budgets are also enforced inside the escrow contract, so the agent cannot talk its way past them.
- Anything outside policy goes to a human approval inbox.
- Every action is written to an append-only, hash-chained audit trail.

**Design principle:** the LLM is the decision-maker, and deterministic code performs every action. The model calls explicit tools. It never writes to the database or signs a transaction directly, and it cannot approve its own spending.

### Agent loop

| Stage     | What happens                                                        |
| --------- | ------------------------------------------------------------------- |
| Observe   | Daily job finds contracts renewing soon and refreshes usage         |
| Analyze   | Compares usage to contract terms, ranks opportunities by savings    |
| Negotiate | Multi-round negotiation with a vendor, using past deals from memory |
| Decide    | Policy engine returns approved, needs human, or rejected            |
| Execute   | Creates escrow, verifies vendor confirmation, releases payment      |
| Learn     | Records outcome and updates vendor memory and reputation            |

### Tech stack

- **App:** Next.js (App Router), TypeScript, Tailwind
- **Database:** Supabase (Postgres, Auth, RLS)
- **Agent:** LLM with tool calling via the Vercel AI SDK ([TODO: model used])
- **Settlement:** Arc testnet, USDC
- **Wallets:** Circle developer-controlled wallets
- **Contracts:** Solidity escrow ([TODO: Foundry or Hardhat]), adapted from `circlefin/arc-escrow`
- **Scheduling:** Vercel Cron, plus a "Run agent now" button
- **Testing:** Vitest, contract tests, Playwright

## Hackathon mapping

Primarily **RFB 04: Autonomous Business Operator**, with elements of RFB 03 (milestone escrow and vendor reputation) and the "agoranomoi" prior-art idea: meter what you actually use, compare it to what you are billed, and act on the difference.

## Acknowledgements

Built on [Circle](https://www.circle.com) and [Arc](https://www.arc.network). Escrow design adapted from [`circlefin/arc-escrow`](https://github.com/circlefin/arc-escrow). Hackathon hosted by [Canteen](https://thecanteenapp.com).
