/**
 * Centralized Application Constants
 *
 * All business-logic magic numbers, dev/fallback addresses, and configurable
 * defaults live here so they can be managed (and eventually overridden) in one place.
 */

// ---------------------------------------------------------------------------
// Development / Fallback Wallet
// ---------------------------------------------------------------------------

/**
 * Hardhat Account #1 — used ONLY as a fallback in development or when Circle
 * wallet creation is unavailable.  NEVER use this address on mainnet.
 *
 * Well-known private key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
 */
export const DEV_TREASURY_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export const DEMO_BUSINESS_ID = "b655fb94-fc62-4e3c-8898-2c5f88068159";

/**
 * Deterministic placeholder wallet used for simulated (non-real) vendors
 * that have no on-chain wallet configured.
 */
export const SIMULATED_VENDOR_WALLET =
  "0x1111111111111111111111111111111111111111";

// ---------------------------------------------------------------------------
// Reputation Scoring
// ---------------------------------------------------------------------------

/** Points awarded for a successful negotiation closed in ≤ 2 rounds */
export const REPUTATION_DELTA_FAST_CLOSE = 12;

/** Points awarded for a successful negotiation closed in 3–4 rounds */
export const REPUTATION_DELTA_MODERATE_CLOSE = 8;

/** Points awarded for a successful negotiation closed in ≥ 5 rounds */
export const REPUTATION_DELTA_SLOW_CLOSE = 5;

/** Points deducted when a vendor walks away / refuses concession */
export const REPUTATION_DELTA_WALKED_AWAY = -5;

/** Points deducted when a delivery dispute is raised */
export const REPUTATION_DELTA_DISPUTED = -15;

/** Default starting reputation score for new vendors */
export const REPUTATION_DEFAULT_SCORE = 50;

/** Lower bound for reputation scores */
export const REPUTATION_MIN = 10;

/** Upper bound for reputation scores */
export const REPUTATION_MAX = 100;

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to (price × decline_pct) when estimating savings
 * from a usage-decline pattern.  0.7 = conservative 70% recapture assumption.
 */
export const USAGE_DECLINE_SAVINGS_MULTIPLIER = 0.7;

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

/** Interval (ms) between in-memory rate-limit store cleanup sweeps */
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

/** Entries older than this (ms) are considered stale and evicted */
export const RATE_LIMIT_STALE_THRESHOLD_MS = 3_600_000; // 1 hour

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Auth cookie max-age in seconds (7 days) */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 604800;

/** Production canonical domain URL */
export const PRODUCTION_SITE_URL = "https://tavryn.space";

/** Default localhost fallback URL used when NEXT_PUBLIC_SITE_URL is unset */
export const DEFAULT_SITE_URL = "http://localhost:3000";

/** Default canonical dashboard URL */
export const DEFAULT_DASHBOARD_URL = "http://localhost:3000/dashboard";

// ---------------------------------------------------------------------------
// Cron / Proactive Agent
// ---------------------------------------------------------------------------

/** Default renewal look-ahead window in days */
export const DEFAULT_RENEWAL_WINDOW_DAYS = 45;

/** Default idempotency de-duplication window in days */
export const DEFAULT_IDEMPOTENCY_WINDOW_DAYS = 14;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Default max notifications returned per query */
export const DEFAULT_NOTIFICATION_LIMIT = 40;

/** Webhook HTTP request timeout in milliseconds */
export const WEBHOOK_TIMEOUT_MS = 3500;

// ---------------------------------------------------------------------------
// Arc Network & Smart Contract Defaults
// ---------------------------------------------------------------------------

/** Arc Layer-1 Testnet Chain ID */
export const DEFAULT_ARC_CHAIN_ID = 5042002;

/** Public JSON-RPC endpoint for Arc Testnet */
export const DEFAULT_ARC_RPC_URL = "https://rpc.testnet.arc.network";

/** Public ArcScan block explorer URL */
export const DEFAULT_ARC_EXPLORER_URL = "https://testnet.arcscan.app";

/** Circle testnet faucet URL for funding USDC */
export const DEFAULT_ARC_FAUCET_URL = "https://faucet.circle.com";

/** Arc native USDC ERC-20 precompile contract address (6 decimals) */
export const DEFAULT_ARC_USDC_CONTRACT =
  "0x3600000000000000000000000000000000000000";

/** Deployed ArcEscrow.sol smart contract address on Arc Testnet */
export const DEFAULT_ARC_ESCROW_CONTRACT =
  "0x78e61ae7e8EeF34Add911FA3e41F3408a819c047";

/** Circle Developer-Controlled Wallets blockchain identifier */
export const DEFAULT_CIRCLE_BLOCKCHAIN = "ARC-TESTNET";

// ---------------------------------------------------------------------------
// Verification & Proof Sample Values (Stage 0010 Honest Labeling)
// ---------------------------------------------------------------------------

/** Confirmed on-chain transaction hash used for visual proofs and verification */
export const VERIFICATION_SAMPLE_REAL_TX_HASH =
  "0xda45a52663ed21a83ed69800770b826e9dd123f5e09c0783b189acc1907e375a";

/** Representative simulated transaction hash (non-chain mock) for visual proofs */
export const VERIFICATION_SAMPLE_SIM_TX_HASH =
  "0xsimulated_8f7b2c1e4d0a9b8c7d6e5f4a3b2c1d0e";

/** Sample public receipt token for live on-chain transaction proof */
export const VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN =
  "5e00674ab8e2b86cdfedb78214f38672";

/** Sample public receipt token for simulated mock transaction proof */
export const VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN =
  "5af64a561a009ece45b8895f7a44ebdf";

// ---------------------------------------------------------------------------
// Sanctions & Compliance Screening
// ---------------------------------------------------------------------------

/** Known sanctions/OFAC test vector addresses flagged during screening */
export const SANCTIONS_BLOCKLIST_ADDRESSES = [
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", // Tornado Cash Router
  "0x8589427373d6d84e98730d7795d8f6f8731fda16", // Flagged OFAC Vector
  "0x7f367cc41522ce07553e823bf3be79a889debe1b", // High-risk test address
] as const;

// ---------------------------------------------------------------------------
// LLM Provider & Mock Benchmarks
// ---------------------------------------------------------------------------

/** Default OpenAI model identifier */
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

/** Default Anthropic model identifier */
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

/** Default Vercel AI Gateway model identifier (negotiation messaging, extraction) */
export const DEFAULT_GATEWAY_MODEL = "google/gemini-2.5-flash";

/** Default Vercel AI Gateway reviewer model identifier (high-stakes auditor verdicts) */
export const DEFAULT_GATEWAY_REVIEWER_MODEL = "google/gemini-2.5-pro";

/** Mock Language Model provider name */
export const DEFAULT_MOCK_PROVIDER = "tavryn-mock-provider";

/** Mock Language Model model identifier */
export const DEFAULT_MOCK_MODEL_ID = "mock-analyzer-v1";

/** LocalStorage theme key */
export const THEME_STORAGE_KEY = "tavryn-theme";

/** Mock agent baseline vendor benchmarks */
export const MOCK_VENDOR_BENCHMARKS = {
  default: {
    currentPrice: 10000,
    targetPrice: 7500,
    savings: 2500,
    recommendation: "negotiate",
    rationale: "Identified idle capacity and benchmarked competitor pricing.",
  },
  slack: {
    serviceName: "Slack",
    currentPrice: 9600,
    targetPrice: 6912,
    savings: 2688,
    recommendation: "downsize_seats",
    rationale:
      "Audit detected 7 idle licenses (28% waste). Recommend reducing seats from 25 to 18 to save $2,688/yr.",
  },
  datadog: {
    serviceName: "Datadog",
    currentPrice: 37200,
    targetPrice: 29127.6,
    savings: 8072.4,
    recommendation: "negotiate",
    rationale:
      "Telemetry indicates a 31% volume decline in active workloads. Recommend renegotiating lower tier to save $8,072.40/yr.",
  },
  aws: {
    serviceName: "AWS",
    currentPrice: 24000,
    targetPrice: 21984,
    savings: 2016,
    recommendation: "negotiate",
    rationale:
      "Telemetry indicates compute reservation renewal approaching. Recommend renegotiating tiered commitment to save $2,016/yr.",
  },
} as const;
