# Tavryn Documentation Hub

Welcome to the **Tavryn** documentation portal. Tavryn is an autonomous B2B procurement protocol and treasury execution engine built for businesses to monitor, negotiate, and settle vendor contracts in Circle USDC on the Arc Layer-1 blockchain.

---

## 🧭 Navigation by Role

| If you are a...                  | Recommended Starting Point                                                                                                                               |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finance Officer / Operator**   | Read the **[Application Usage Guide](guides/app-usage.md)** to understand how renewals, policy limits, and approval workflows function.                  |
| **Software Engineer**            | Read the **[System Architecture Overview](architecture/overview.md)** and review our **[Architecture Decision Records](architecture/decisions.md)**.     |
| **Security Auditor**             | Review our **[Security Model & Threat Matrix](architecture/security-model.md)** and the **[ArcEscrow Contract Specification](contracts/arc-escrow.md)**. |
| **Protocol / Web3 Integrator**   | Inspect our **[Arc & Circle Integration Notes](architecture/arc-integration.md)** for EVM network parameters and wallet adapters.                        |
| **Designer / Frontend Engineer** | Check the **[Typography & Design Guide](design/typography.md)** for design tokens, typography rules, and UI hierarchy.                                   |

---

## 📁 Documentation Map

```
docs/
├── README.md                      # Documentation Hub & Sitemap (You are here)
│
├── architecture/                  # Core Engineering & Architecture
│   ├── overview.md                # System Topology, Execution Boundaries & Procurement Lifecycle
│   ├── arc-integration.md         # Arc Testnet Parameters & Circle DCW Wallet Integration
│   ├── security-model.md          # 11-Threat Matrix, Mitigations & Cryptographic Audit Ledger
│   └── decisions.md               # Architecture Decision Records (ADRs 001–005)
│
├── contracts/                     # Smart Contract Protocols & On-Chain Economics
│   └── arc-escrow.md              # ArcEscrow.sol Specification, RBAC, State Machine & Threat Model
│
├── guides/                        # Operational & User Manuals
│   ├── README.md                  # Guides Catalog & Authoring Rules
│   └── app-usage.md               # Comprehensive Application Usage Guide
│
├── design/                        # UI/UX Design System
│   └── typography.md              # Typography Scales, Fonts, and Text Layout Standards
│
└── updates/                       # Stage Build Logs & Changelogs
    ├── INDEX.md                   # Chronological Directory of Stages 0000–0011
    └── 0000-genesis.md ...        # Individual Stage Engineering Reports
```

---

## 🛡 Architectural Invariants at a Glance

Tavryn enforces four strict invariants across every layer of the system:

1. **Autonomous Planning, Deterministic Execution:** The LLM negotiates and drafts recommendations, but cannot execute database mutations or sign transactions directly.
2. **Server-Side Policy Hardening:** Financial limits and category caps run in pure TypeScript outside the model context. All mutations verify policy twice.
3. **Dual-Role Escrow Release:** The agent wallet may fund escrow agreements, but is cryptographically prevented (`msg.sender != agent`) from releasing funds. Milestone release strictly requires an independent verifier.
4. **Append-Only Hash Chaining:** Every agent event is permanently recorded in PostgreSQL with SHA-256 hash chaining back to genesis. Engine-level triggers prevent `UPDATE` or `DELETE` operations.

---

## ⚡ Network & Environment Quick Reference

| Resource                | Value / Link                                                 |
| :---------------------- | :----------------------------------------------------------- |
| **Blockchain**          | Arc Layer-1 Testnet (Chain ID: `5042002` / `0x4cef52`)       |
| **Native Gas Currency** | USDC (6 Decimals)                                            |
| **USDC Precompile**     | `0x3600000000000000000000000000000000000000`                 |
| **Public RPC**          | `https://rpc.testnet.arc.network`                            |
| **Block Explorer**      | [ArcScan (testnet.arcscan.app)](https://testnet.arcscan.app) |
| **Circle Faucet**       | [faucet.circle.com](https://faucet.circle.com)               |
| **Smart Contract**      | `contracts/contracts/ArcEscrow.sol`                          |

---

## 🤝 Contributing & Documentation Standards

- Propose architectural or security changes via pull request with an updated **[Architecture Decision Record](architecture/decisions.md)**.
- If you discover a security vulnerability, follow our responsible disclosure instructions in [SECURITY.md](../SECURITY.md).
- To view historical release logs, browse the [Build Updates Index](updates/INDEX.md).
