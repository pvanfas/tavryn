/**
 * Vendor Negotiation Simulator (/lib/vendor-simulator.ts)
 *
 * Simulates enterprise SaaS account managers with realistic concession dynamics,
 * hidden reservation prices (floors), and seeded repeatability.
 *
 * Strict architectural rule: The reservation floor is strictly internal and
 * NEVER leaked or returned in any API response or database client payload.
 */

export type ConcessionStyle = "stubborn" | "moderate" | "flexible";

export interface VendorSimulatorConfig {
  vendorId: string;
  vendorName: string;
  category: string;
  style: ConcessionStyle;
  // Floor is private to simulator logic only
  floorPercentage: number;
  concessionRate: number;
}

export interface NegotiateRequest {
  contract_id: string;
  offer: number;
  commitment_months?: number;
  round: number;
  original_price: number;
  previous_counter?: number;
}

export interface NegotiateResponse {
  counter_offer: number;
  message: string;
  accepted: boolean;
}

/**
 * Seeded PRNG (Mulberry32) for 100% reproducible vendor responses
 */
export function createSeededRng(seedStr: string): () => number {
  let hash = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(hash ^ seedStr.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return function () {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Resolves or derives the simulator configuration for a vendor
 */
export function getVendorSimulatorConfig(
  vendorId: string,
  vendorName: string,
  category: string,
): VendorSimulatorConfig {
  const normName = vendorName.toLowerCase();
  const rng = createSeededRng(`vendor-cfg-${vendorId}-${vendorName}`);

  let style: ConcessionStyle = "moderate";
  let floorPercentage = 0.78;
  let concessionRate = 0.35;

  if (
    normName.includes("platform a") ||
    normName.includes("support platform a") ||
    normName.includes("stubborn")
  ) {
    style = "stubborn";
    floorPercentage = 0.88;
    concessionRate = 0.18;
  } else if (
    normName.includes("platform b") ||
    normName.includes("support platform b") ||
    normName.includes("moderate")
  ) {
    style = "moderate";
    floorPercentage = 0.78;
    concessionRate = 0.35;
  } else if (
    normName.includes("platform c") ||
    normName.includes("support platform c") ||
    normName.includes("flexible")
  ) {
    style = "flexible";
    floorPercentage = 0.68;
    concessionRate = 0.55;
  } else {
    // Derive deterministically from seeded RNG
    const roll = rng();
    if (roll < 0.33) {
      style = "stubborn";
      floorPercentage = 0.85 + rng() * 0.05;
      concessionRate = 0.15 + rng() * 0.05;
    } else if (roll < 0.67) {
      style = "moderate";
      floorPercentage = 0.75 + rng() * 0.05;
      concessionRate = 0.3 + rng() * 0.08;
    } else {
      style = "flexible";
      floorPercentage = 0.65 + rng() * 0.05;
      concessionRate = 0.5 + rng() * 0.1;
    }
  }

  return {
    vendorId,
    vendorName,
    category,
    style,
    floorPercentage,
    concessionRate,
  };
}

/**
 * Generates contextual, realistic account manager dialogue
 */
function generateAccountManagerMessage(
  config: VendorSimulatorConfig,
  round: number,
  accepted: boolean,
  offer: number,
  counterOffer: number,
  commitmentMonths: number,
  rng: () => number,
): string {
  const name = config.vendorName;

  if (accepted) {
    const acceptedTemplates = [
      `Thanks for working with us on this renewal. We are pleased to accept your offer of $${offer.toLocaleString()} for the ${commitmentMonths}-month term. We have updated your contract agreement and look forward to our continued partnership.`,
      `We appreciate your business and partnership with ${name}. Your proposed terms of $${offer.toLocaleString()} have been approved by our finance desk. We'll lock this rate in effective immediately.`,
      `Glad we could reach a mutual agreement! We accept the $${offer.toLocaleString()} rate. I've notified our billing team to prepare the updated order form.`,
    ];
    return acceptedTemplates[Math.floor(rng() * acceptedTemplates.length)];
  }

  // Counter templates based on personality style
  if (config.style === "stubborn") {
    if (round === 1) {
      return `Thank you for reaching out regarding your renewal. An initial offer of $${offer.toLocaleString()} is significantly below our standard enterprise tier pricing. Given our recent product investments and SLA guarantees, the best we can offer is $${counterOffer.toLocaleString()}.`;
    }
    if (round >= 4) {
      return `Our pricing committee has reviewed your revised request. We cannot approve rates below $${counterOffer.toLocaleString()} without sacrificing dedicated premium support tiers. This is our final best offer.`;
    }
    return `We have limited flexibility on this contract line. I was able to get internal approval to step down slightly to $${counterOffer.toLocaleString()} for a ${commitmentMonths}-month renewal, but we cannot meet your figure of $${offer.toLocaleString()}.`;
  }

  if (config.style === "flexible") {
    if (round === 1) {
      return `Thanks for sharing your target budget! We really value your team's usage of ${name} and want to make the numbers work. While $${offer.toLocaleString()} is a bit steep for round one, I can immediately counter at $${counterOffer.toLocaleString()} to show our goodwill.`;
    }
    if (round >= 3) {
      return `I spoke directly with my regional VP to secure an end-of-quarter volume credit for you. We can bring the annual commitment down to $${counterOffer.toLocaleString()} if you can sign before month-end.`;
    }
    return `We want to keep your business. I've trimmed our margin down to $${counterOffer.toLocaleString()}. Can we close this at that number?`;
  }

  // Moderate style (default consultative)
  if (round === 1) {
    return `Thanks for the renewal proposal. While your proposed $${offer.toLocaleString()} is below our standard enterprise schedule, I understand budget constraints. We can meet you partway at $${counterOffer.toLocaleString()} for a ${commitmentMonths}-month commitment.`;
  }
  if (round >= 4) {
    return `We've made several concessions across our discussions. At $${counterOffer.toLocaleString()}, we are providing enterprise discounts well above our average cohort. We hope you'll agree this represents strong value.`;
  }
  return `I reviewed our usage telemetry and seat allocation with finance. We can offer a revised rate of $${counterOffer.toLocaleString()}, which bridges our gap while preserving all enterprise integrations.`;
}

/**
 * Core deterministic negotiation simulator step
 */
export function simulateVendorNegotiation(
  req: NegotiateRequest,
  vendorConfig: VendorSimulatorConfig,
): NegotiateResponse {
  const rng = createSeededRng(
    `round-${req.contract_id}-${vendorConfig.vendorId}-${req.round}`,
  );

  const originalPrice = req.original_price;
  const currentCounter = req.previous_counter ?? originalPrice;
  const offer = req.offer;
  const commitmentMonths = req.commitment_months || 12;

  // Calculate hidden floor (strictly private to this calculation)
  const hiddenFloor = Math.round(originalPrice * vendorConfig.floorPercentage);

  // 1. Immediate acceptance check: offer is at or above current vendor counter
  if (offer >= currentCounter) {
    return {
      counter_offer: offer,
      message: generateAccountManagerMessage(
        vendorConfig,
        req.round,
        true,
        offer,
        offer,
        commitmentMonths,
        rng,
      ),
      accepted: true,
    };
  }

  // 2. Late round close: if round >= 3 and offer is at or above hidden floor and within 4% of counter
  if (
    req.round >= 3 &&
    offer >= hiddenFloor &&
    (currentCounter - offer) / currentCounter <= 0.04
  ) {
    return {
      counter_offer: offer,
      message: generateAccountManagerMessage(
        vendorConfig,
        req.round,
        true,
        offer,
        offer,
        commitmentMonths,
        rng,
      ),
      accepted: true,
    };
  }

  // 3. Concession step calculation
  // Gap between current counter and the highest of (offer, hiddenFloor)
  const targetFloor = Math.max(offer, hiddenFloor);
  const gap = currentCounter - targetFloor;

  let concessionStep = 0;
  if (gap > 0) {
    // Add small random variance (+/- 10%) around base concession rate
    const variance = (rng() - 0.5) * 0.1;
    const effectiveRate = Math.min(
      0.9,
      Math.max(0.08, vendorConfig.concessionRate + variance),
    );
    concessionStep = Math.round(gap * effectiveRate);
  }

  // Ensure next counter is strictly decreasing and never below hiddenFloor
  let nextCounter = Math.max(hiddenFloor, currentCounter - concessionStep);

  // If calculation hit or went below offer and offer >= floor, accept!
  if (nextCounter <= offer && offer >= hiddenFloor) {
    return {
      counter_offer: offer,
      message: generateAccountManagerMessage(
        vendorConfig,
        req.round,
        true,
        offer,
        offer,
        commitmentMonths,
        rng,
      ),
      accepted: true,
    };
  }

  // Otherwise, produce counter-offer
  nextCounter = Math.round(nextCounter);

  return {
    counter_offer: nextCounter,
    message: generateAccountManagerMessage(
      vendorConfig,
      req.round,
      false,
      offer,
      nextCounter,
      commitmentMonths,
      rng,
    ),
    accepted: false,
  };
}
