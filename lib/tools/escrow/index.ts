import { ToolContext } from "../types";
import { buildCreateEscrowTool } from "./create";
import { buildDisputeEscrowTool } from "./dispute";
import { buildRefundEscrowTool } from "./refund";
import { buildReleaseEscrowTool } from "./release";

export * from "./create";
export * from "./dispute";
export * from "./idempotency";
export * from "./refund";
export * from "./release";

export function buildEscrowTools(ctx: ToolContext) {
  return {
    create_escrow: buildCreateEscrowTool(ctx),
    release_escrow: buildReleaseEscrowTool(ctx),
    dispute_escrow: buildDisputeEscrowTool(ctx),
    refund_escrow: buildRefundEscrowTool(ctx),
  };
}
