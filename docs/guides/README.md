# Tavryn Operational & User Guides

This directory contains practical, operator-facing and developer-facing guides for working with Tavryn.

---

## Available Guides

| Guide                                         | Description                                                                                                                                                    | Target Audience             | Status         |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- | :------------- |
| **[Application Usage Guide](./app-usage.md)** | Comprehensive end-to-end walk-through of Tavryn: onboarding, contract ingestion, policy ceilings, automated negotiation, approvals, and Arc escrow settlement. | Finance, Operations, Admins | Ready / Active |

---

## Planned Guides

The following guides are planned for upcoming releases:

- **Statement & Invoice CSV Ingestion:** How to format and bulk-import historical vendor credit card statements and PDF invoices.
- **Out-of-Band Webhook Integrations:** Configuring Slack, email, and Discord notifications for HMAC supervisor approval links.
- **Custom Policy Rules & Dynamic Formulas:** Advanced policy rule authoring for complex enterprise procurement structures.

---

## Authoring Guidelines for Guides

When adding new guides to `docs/guides/`:

1. **Focus on Workflows:** Explain how to achieve a concrete business or technical outcome from start to finish.
2. **Use Clear Visual Hierarchy:** Include step-by-step instructions, callouts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`), and screenshots/code snippets where appropriate.
3. **Include Error Recovery:** Document common pitfalls, error states, and how human supervisors can override or recover.
4. **Register in Index:** Add new entries to this `README.md` and the master [docs/README.md](../README.md).
