import { NextRequest } from "next/server";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const dynamic = "force-dynamic";

/**
 * Circle Developer-Controlled Wallets Webhook Handler
 * Listens for transaction lifecycle notifications and synchronizes database state.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return apiError("Invalid JSON payload", 400);
    }

    // 1. Subscription Confirmation Challenge Handshake
    if (payload.Type === "SubscriptionConfirmation" || payload.notificationType === "subscription.confirmation") {
      const subscribeUrl = payload.SubscribeURL || payload.subscribeUrl;
      if (subscribeUrl) {
        try {
          await fetch(subscribeUrl);
        } catch (fetchErr) {
          console.warn("[CircleWebhook] Failed to confirm subscription URL:", fetchErr);
        }
      }
      return apiSuccess({ confirmed: true, message: "Subscription confirmed" });
    }

    // 2. Extract Event and Transaction Details
    const notificationType = payload.notificationType || payload.type || payload.NotificationType || "unknown";
    const txData = payload.transaction || payload.data?.transaction || payload.data || {};
    const circleTxId = txData.id || txData.transactionId;
    const txHash = txData.txHash || txData.transactionHash;
    const state = (txData.state || txData.status || "").toUpperCase();

    const supabase = getServiceSupabase();

    // 3. Match transaction in Supabase
    let matchedTx: any = null;
    if (circleTxId) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("circle_tx_id", circleTxId)
        .maybeSingle();
      matchedTx = data;
    }

    if (!matchedTx && txHash) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("tx_hash", txHash)
        .maybeSingle();
      matchedTx = data;
    }

    // 4. Update status based on Circle state
    if (matchedTx) {
      let targetStatus: string | null = null;
      if (state === "CONFIRMED" || state === "COMPLETE" || state === "SUCCESS") {
        // If it was pending, mark funded or completed
        targetStatus = matchedTx.status === "pending" ? "funded" : "completed";
      } else if (state === "FAILED" || state === "CANCELLED" || state === "REJECTED") {
        targetStatus = "failed";
      }

      if (targetStatus && targetStatus !== matchedTx.status) {
        await supabase
          .from("transactions")
          .update({
            status: targetStatus,
            tx_hash: txHash || matchedTx.tx_hash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchedTx.id);

        if (matchedTx.business_id) {
          await logAgentAction({
            businessId: matchedTx.business_id,
            action: "circle_webhook_synced",
            reason: `Circle Webhook (${notificationType}): Updated transaction ${matchedTx.id} status to ${targetStatus}`,
            confidence: 1.0,
            input: {
              notificationType,
              circleTxId,
              txHash,
              state,
            },
            result: {
              transactionId: matchedTx.id,
              previousStatus: matchedTx.status,
              newStatus: targetStatus,
            },
          });
        }
      }
    }

    return apiSuccess({
      received: true,
      notificationType,
      matched: Boolean(matchedTx),
      transactionId: matchedTx?.id,
    });
  } catch (err) {
    return handleApiError(err, "Failed to process Circle webhook");
  }
}
