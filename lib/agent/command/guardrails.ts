// ─── PROMPT INJECTION GUARDRAILS ──────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?(your\s+)?(rules|instructions|constraints)/i,
  /disregard\s+(all\s+)?(previous\s+)?(your\s+)?(rules|instructions)/i,
  /bypass\s+(all\s+)?(policy|approval|checks|spending\s+limits)/i,
  /pay\s+vendor\s+/i,
  /transfer\s+(\d+|\w+)\s+(usdc|funds|dollars)/i,
  /send\s+(funds|money|usdc|crypto)\s+to/i,
  /override\s+policy/i,
  /make\s+spending\s+limit\s+infinite/i,
  /set\s+spending\s+limit/i,
  /change\s+policy/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /alter\s+permissions/i,
];

export function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

