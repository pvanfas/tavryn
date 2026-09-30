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

/** Default localhost fallback URL used when NEXT_PUBLIC_SITE_URL is unset */
export const DEFAULT_SITE_URL = "http://localhost:3000";

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
