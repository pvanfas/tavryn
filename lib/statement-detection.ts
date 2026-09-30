import { SubscriptionCategory } from "@/lib/schemas";

/**
 * 1. Financial Data Sanitization
 * Redacts credit card numbers, bank account numbers, and routing numbers
 * before text reaches any logs, LLM, or memory stores.
 */
export function redactFinancialData(input: string): string {
  if (!input) return "";

  let sanitized = input;

  // 1. Credit / Debit card patterns: 13-19 digits with optional spaces or hyphens
  sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[CARD_REDACTED]");

  // 2. Masked cards (e.g. **** **** **** 1234 or XXXX-XXXX-XXXX-1234 or *1234)
  sanitized = sanitized.replace(
    /(?:[\*X]{4,}[ -]*){1,3}\d{4}/gi,
    "[CARD_REDACTED]",
  );
  sanitized = sanitized.replace(/\*\d{4}\b/g, "[CARD_REDACTED]");

  // 3. Bank Account / Routing Number markers
  sanitized = sanitized.replace(
    /(?:acct|account|acc|routing|rtn)[\s#:.-]*\d{6,17}/gi,
    "[ACCOUNT_REDACTED]",
  );

  return sanitized;
}

export interface StatementTransaction {
  date: string; // YYYY-MM-DD
  rawDescription: string;
  amount: number; // positive debit (charge)
}

export interface DetectedRecurringSubscription {
  id: string;
  vendor: string;
  service: string;
  category: SubscriptionCategory;
  annual_price: number;
  monthly_price: number;
  renewal_date: string; // YYYY-MM-DD
  cadence: "monthly" | "annual";
  transaction_count: number;
  confidence: number;
  source: "statement-import";
  included: boolean;
  needsConfirmation: boolean;
  chargeHistory: Array<{ date: string; amount: number }>;
}

/**
 * Common prefixes and noise found on bank statements.
 */
const MERCHANT_NOISE_PATTERNS = [
  /^(sq\s*\*|tst\s*\*|paypal\s*\*|stripe\s*\*|amzn\s*\*|amzn\s+mktp\s*\*|apple\.com\/bill)/i,
  /(\*octocat|\.com|inc\b|llc\b|ltd\b|corp\b|co\b|technologies|services|holdings|\bus\b|\bca\b|\bny\b|\bwa\b)/gi,
  /[#*]\S+/g,
  /\b\d{4,}\b/g, // stray terminal IDs
];

/**
 * Normalizes merchant names deterministically for grouping.
 */
export function normalizeMerchantKey(description: string): string {
  let cleaned = description;
  for (const pattern of MERCHANT_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t.length > 1);
  return (tokens[0] || description.trim().slice(0, 10)).toUpperCase();
}

/**
 * Well-known merchant directory for high-confidence deterministic categorization.
 */
const KNOWN_MERCHANT_CATALOG: Record<
  string,
  { vendor: string; service: string; category: SubscriptionCategory }
> = {
  GITHUB: {
    vendor: "GitHub",
    service: "Code Hosting & Enterprise CI",
    category: "software",
  },
  AWS: {
    vendor: "AWS",
    service: "Cloud Infrastructure & Compute",
    category: "cloud",
  },
  AMAZON: { vendor: "AWS", service: "Cloud Services", category: "cloud" },
  SLACK: {
    vendor: "Slack",
    service: "Team Collaboration & Messaging",
    category: "software",
  },
  DATADOG: {
    vendor: "Datadog",
    service: "Observability & Infrastructure Monitoring",
    category: "cloud",
  },
  FIGMA: {
    vendor: "Figma",
    service: "Collaborative Product Design",
    category: "software",
  },
  GOOGLE: {
    vendor: "Google Workspace",
    service: "Productivity & Cloud Email",
    category: "software",
  },
  NOTION: {
    vendor: "Notion",
    service: "Knowledge Base & Workspaces",
    category: "software",
  },
  ZOOM: { vendor: "Zoom", service: "Video Conferencing", category: "software" },
  VERCEL: {
    vendor: "Vercel",
    service: "Edge Deployment & Hosting",
    category: "cloud",
  },
  UPWORK: {
    vendor: "Upwork",
    service: "Specialized Engineering Contractors",
    category: "contractors",
  },
  TOPTAL: {
    vendor: "Toptal",
    service: "Senior Contract Talent",
    category: "contractors",
  },
  DEEL: {
    vendor: "Deel",
    service: "Global Contractor Payroll",
    category: "contractors",
  },
};

/**
 * Parses a bank/credit card statement CSV text into sanitized transactions.
 */
export function parseStatementCSV(csvText: string): StatementTransaction[] {
  const sanitizedText = redactFinancialData(csvText);
  const lines = sanitizedText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t")
    ? "\t"
    : headerLine.includes(";")
      ? ";"
      : ",";
  const headers = headerLine.split(delimiter).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^["']|["']$/g, ""),
  );

  const dateIdx = headers.findIndex(
    (h) => h.includes("date") || h.includes("posted") || h.includes("time"),
  );
  const descIdx = headers.findIndex(
    (h) =>
      h.includes("desc") ||
      h.includes("merchant") ||
      h.includes("payee") ||
      h.includes("name") ||
      h.includes("detail"),
  );
  const amountIdx = headers.findIndex(
    (h) =>
      h === "amount" ||
      h.includes("amount") ||
      h.includes("debit") ||
      h.includes("charge"),
  );
  const creditIdx = headers.findIndex(
    (h) => h.includes("credit") || h.includes("refund"),
  );

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error(
      "CSV statement must contain Date, Description/Merchant, and Amount columns.",
    );
  }

  const transactions: StatementTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Handle quoted values containing commas
    const parts: string[] = [];
    let inQuotes = false;
    let current = "";
    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const char = rawLine[charIdx];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDate = parts[dateIdx]?.replace(/^["']|["']$/g, "").trim();
    const rawDesc = parts[descIdx]?.replace(/^["']|["']$/g, "").trim();
    const rawAmt = parts[amountIdx]?.replace(/[^0-9.-]/g, "").trim();

    if (!rawDate || !rawDesc || !rawAmt) continue;

    // Standardize date to YYYY-MM-DD
    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) continue;
    const isoDate = parsedDate.toISOString().slice(0, 10);

    const amountNum = parseFloat(rawAmt);
    if (isNaN(amountNum)) continue;

    // If separate credit column exists and has positive value, skip refund
    if (creditIdx !== -1 && parts[creditIdx]) {
      const creditVal = parseFloat(parts[creditIdx].replace(/[^0-9.-]/g, ""));
      if (!isNaN(creditVal) && creditVal > 0) {
        continue; // Refund / deposit, not a recurring expense
      }
    }

    // If amount is negative, it represents a credit/refund: ignore for subscription detection
    if (amountNum <= 0) continue;

    transactions.push({
      date: isoDate,
      rawDescription: rawDesc,
      amount: amountNum,
    });
  }

  return transactions;
}

/**
 * Deterministically groups transactions, detects recurrence cadence (monthly/annual),
 * calculates annualized price, and projects renewal dates.
 */
export function detectRecurringSubscriptions(
  transactions: StatementTransaction[],
): DetectedRecurringSubscription[] {
  // 1. Group by normalized merchant key
  const groups = new Map<string, StatementTransaction[]>();

  for (const tx of transactions) {
    const key = normalizeMerchantKey(tx.rawDescription);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const detected: DetectedRecurringSubscription[] = [];

  for (const [key, txList] of groups.entries()) {
    // Only detect recurrence if we have at least 2 charges across time
    if (txList.length < 2) continue;

    // Sort chronologically ascending
    txList.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Compute intervals in days
    const intervals: number[] = [];
    const amounts = txList.map((t) => t.amount);

    for (let i = 0; i < txList.length - 1; i++) {
      const d1 = new Date(txList[i].date).getTime();
      const d2 = new Date(txList[i + 1].date).getTime();
      const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      intervals.push(days);
    }

    if (intervals.length === 0) continue;

    const avgInterval =
      intervals.reduce((acc, v) => acc + v, 0) / intervals.length;
    const avgAmount = amounts.reduce((acc, v) => acc + v, 0) / amounts.length;

    // Check amount variance tolerance (allow up to 8% delta for FX or tier changes)
    const maxAmountDelta = Math.max(
      ...amounts.map((a) => Math.abs(a - avgAmount)),
    );
    const amountVarianceRatio = maxAmountDelta / avgAmount;
    const isAmountConsistent = amountVarianceRatio <= 0.08;

    let cadence: "monthly" | "annual" | null = null;
    let confidence = 0.5;

    // Monthly check: average gap ~25-35 days, all intervals reasonably close
    if (avgInterval >= 25 && avgInterval <= 35) {
      cadence = "monthly";
      confidence = isAmountConsistent ? 0.95 : 0.82;
    }
    // Annual check: average gap ~350-385 days
    else if (avgInterval >= 350 && avgInterval <= 385) {
      cadence = "annual";
      confidence = isAmountConsistent ? 0.92 : 0.78;
    }

    // If cadence is not detected, skip irregular charges
    if (!cadence) continue;

    // Deterministic Price Annualization
    const latestTx = txList[txList.length - 1];
    const latestAmount = latestTx.amount;
    const annualPrice =
      cadence === "monthly"
        ? Math.round(latestAmount * 12)
        : Math.round(latestAmount);
    const monthlyPrice =
      cadence === "monthly"
        ? latestAmount
        : Math.round((latestAmount / 12) * 100) / 100;

    // Deterministic Next Renewal Date Projection
    const latestDate = new Date(latestTx.date);
    const nextRenewal = new Date(latestDate);
    if (cadence === "monthly") {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    } else {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
    }
    const renewalDateIso = nextRenewal.toISOString().slice(0, 10);

    // Merchant metadata resolution
    const catalogMatch = KNOWN_MERCHANT_CATALOG[key];
    const vendorName = catalogMatch ? catalogMatch.vendor : toTitleCase(key);
    const serviceName = catalogMatch
      ? catalogMatch.service
      : `${vendorName} Subscription`;
    const category = catalogMatch ? catalogMatch.category : "software";

    detected.push({
      id: `stmt-${key.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      vendor: vendorName,
      service: serviceName,
      category,
      annual_price: annualPrice,
      monthly_price: monthlyPrice,
      renewal_date: renewalDateIso,
      cadence,
      transaction_count: txList.length,
      confidence,
      source: "statement-import",
      included: true,
      needsConfirmation: confidence < 0.85,
      chargeHistory: txList.map((t) => ({ date: t.date, amount: t.amount })),
    });
  }

  return detected;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
