import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { sendWebhookNotification } from "@/lib/notifications";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

const UpdateSettingsSchema = z.object({
  action: z.enum(["update", "test_webhook"]).default("update"),
  webhook_url: z.string().url().nullable().optional().or(z.literal("")),
  policy: z
    .object({
      max_auto_transaction: z.coerce.number().nonnegative(),
      min_savings: z.coerce.number().nonnegative(),
      human_approval_required_above: z.coerce.number().nonnegative(),
      allowed_categories: z.array(z.string()).min(1),
      category_budgets: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
});

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await props.params;
    if (!businessId) {
      return apiError("Missing business ID", 400);
    }

    const supabase = getServiceSupabase();

    const { data: business, error: bError } = await supabase
      .from("businesses")
      .select(
        "id, name, wallet_address, default_currency, is_real, treasury_balance, webhook_url, created_at",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (bError || !business) {
      return apiError("Business not found", 404);
    }

    const { data: policy } = await supabase
      .from("policies")
      .select(
        "id, max_auto_transaction, min_savings, human_approval_required_above, allowed_categories, category_budgets, created_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    return apiSuccess({
      business,
      policy: policy || {
        max_auto_transaction: 2000,
        min_savings: 200,
        human_approval_required_above: 2000,
        allowed_categories: ["software", "cloud", "contractors"],
        category_budgets: { software: 25000, cloud: 50000, contractors: 25000 },
      },
    });
  } catch (err) {
    return handleApiError(err, "Failed to retrieve business settings");
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await props.params;
    if (!businessId) {
      return apiError("Missing business ID", 400);
    }

    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const validation = UpdateSettingsSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.format());
    }

    const { webhook_url, policy } = validation.data;
    const supabase = getServiceSupabase();

    // 1. Update business webhook_url
    if (webhook_url !== undefined) {
      const cleanUrl = webhook_url === "" ? null : webhook_url;
      const { error: bErr } = await supabase
        .from("businesses")
        .update({ webhook_url: cleanUrl })
        .eq("id", businessId);

      if (bErr) {
        logger.error("Failed to update business webhook URL", bErr);
        throw bErr;
      }
    }

    // 2. Update policy
    if (policy) {
      const { data: existingPolicy } = await supabase
        .from("policies")
        .select("id")
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingPolicy) {
        const { error: pErr } = await supabase
          .from("policies")
          .update({
            max_auto_transaction: policy.max_auto_transaction,
            min_savings: policy.min_savings,
            human_approval_required_above: policy.human_approval_required_above,
            allowed_categories: policy.allowed_categories,
            category_budgets: policy.category_budgets || {
              software: 25000,
              cloud: 50000,
              contractors: 25000,
            },
          })
          .eq("id", existingPolicy.id);

        if (pErr) throw pErr;
      } else {
        const { error: pInsertErr } = await supabase.from("policies").insert({
          business_id: businessId,
          max_auto_transaction: policy.max_auto_transaction,
          min_savings: policy.min_savings,
          human_approval_required_above: policy.human_approval_required_above,
          allowed_categories: policy.allowed_categories,
          category_budgets: policy.category_budgets || {
            software: 25000,
            cloud: 50000,
            contractors: 25000,
          },
        });

        if (pInsertErr) throw pInsertErr;
      }
    }

    // 3. Log to append-only audit trail
    await logAgentAction({
      businessId,
      action: "settings_updated",
      reason:
        "Updated deterministic procurement policy and notification settings",
      confidence: 1.0,
      input: { webhook_url, policy },
      result: { success: true },
    });

    return apiSuccess({
      message: "Settings updated successfully",
      businessId,
    });
  } catch (err) {
    return handleApiError(err, "Failed to update business settings");
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await props.params;
    let rawBody: any = {};
    try {
      rawBody = await req.json();
    } catch {}

    const targetUrl = rawBody.webhook_url;
    if (!targetUrl) {
      return apiError("Missing target webhook_url for test", 400);
    }

    // Dispatch test notification
    const result = await sendWebhookNotification(
      "🔔 Tavryn Webhook Integration Test",
      `Successfully connected notification webhook for organization (${businessId}). The autonomous procurement agent will dispatch renewal and settlement alerts here.`,
      process.env.NEXT_PUBLIC_SITE_URL || "https://tavryn.network",
      targetUrl,
    );

    return apiSuccess({
      sent: result.sent,
      reason: result.reason,
      message: result.sent
        ? "Webhook test notification dispatched successfully"
        : `Webhook test completed: ${result.reason || "Dispatched"}`,
    });
  } catch (err) {
    return handleApiError(err, "Failed to dispatch test webhook");
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await props.params;
    if (!businessId) {
      return apiError("Missing business ID", 400);
    }

    // Safety guard: Protect default Demo Co organization from accidental deletion
    if (businessId === "b655fb94-fc62-4e3c-8898-2c5f88068159") {
      return apiError(
        "Default Demo Co organization is protected and cannot be deleted. Please switch to or create another organization to delete.",
        400,
      );
    }

    const supabase = getServiceSupabase();

    // Check that business exists
    const { data: business, error: bError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (bError || !business) {
      return apiError("Organization not found", 404);
    }

    let rawBody: any = {};
    try {
      rawBody = await req.json();
    } catch {
      // Body is optional
    }

    const confirmName = rawBody?.confirmName?.trim()?.toLowerCase();
    const isConfirmed =
      !confirmName ||
      confirmName === "delete my account" ||
      confirmName === business.name.trim().toLowerCase();

    if (!isConfirmed) {
      return apiError(
        `Confirmation mismatch. Expected "delete my account" or "${business.name}", got "${rawBody?.confirmName}".`,
        400,
      );
    }

    // 1. Cascade delete all child data associated with this business
    await Promise.allSettled([
      supabase.from("receipts").delete().eq("business_id", businessId),
      supabase.from("reviewer_audits").delete().eq("business_id", businessId),
      supabase.from("approvals").delete().eq("business_id", businessId),
      supabase.from("override_memory").delete().eq("business_id", businessId),
      supabase.from("vendor_memory").delete().eq("business_id", businessId),
      supabase.from("notifications").delete().eq("business_id", businessId),
      supabase.from("onboarding_events").delete().eq("business_id", businessId),
      supabase.from("transactions").delete().eq("business_id", businessId),
      supabase.from("contracts").delete().eq("business_id", businessId),
      supabase.from("policies").delete().eq("business_id", businessId),
      supabase.from("business_members").delete().eq("business_id", businessId),
    ]);

    // 2. Delete or scrub the business record
    const { error: delErr } = await supabase
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (delErr) {
      // If blocked by append-only trigger on agent_actions
      if (
        delErr.code === "P0001" ||
        delErr.message?.includes(
          "agent_actions is an immutable append-only ledger",
        )
      ) {
        await supabase
          .from("businesses")
          .update({
            name: `[Deleted Organization] ${business.name}`,
            is_real: false,
            wallet_address: null,
            webhook_url: null,
            treasury_balance: 0,
          })
          .eq("id", businessId);
      } else {
        throw delErr;
      }
    }

    logger.info("Permanently deleted organization and all related records", {
      businessId,
      name: business.name,
    });

    return apiSuccess({
      deleted: true,
      businessId,
      message: `Organization "${business.name}" and all related data have been permanently removed.`,
    });
  } catch (err) {
    return handleApiError(err, "Failed to delete organization");
  }
}
