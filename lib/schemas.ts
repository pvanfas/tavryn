import { z } from "zod";

export const SubscriptionCategoryEnum = z.enum(["software", "cloud", "contractors"]);
export type SubscriptionCategory = z.infer<typeof SubscriptionCategoryEnum>;

/**
 * Schema for a single subscription row (from CSV or manual form)
 */
export const SubscriptionRowSchema = z
  .object({
    vendor: z.string().trim().min(1, "Vendor name is required"),
    service: z.string().trim().min(1, "Service name is required"),
    category: SubscriptionCategoryEnum,
    annual_price: z.coerce
      .number()
      .positive("Annual price must be greater than $0"),
    renewal_date: z
      .string()
      .trim()
      .min(1, "Renewal date is required")
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid renewal date format (use YYYY-MM-DD or ISO)",
      }),
    seats: z.coerce
      .number()
      .int("Seats must be a whole number")
      .nonnegative("Seats cannot be negative")
      .nullish(),
    active_seats: z.coerce
      .number()
      .int("Active seats must be a whole number")
      .nonnegative("Active seats cannot be negative")
      .nullish(),
    usage_decline_pct: z.coerce
      .number()
      .min(0, "Decline cannot be negative")
      .max(100, "Decline cannot exceed 100%")
      .nullish(),
  })
  .refine(
    (data) => {
      if (
        data.seats != null &&
        data.active_seats != null &&
        data.seats > 0 &&
        data.active_seats > data.seats
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Active seats cannot exceed total seat count",
      path: ["active_seats"],
    }
  );

export type SubscriptionRow = z.infer<typeof SubscriptionRowSchema>;

/**
 * Raw parsed row with preview status and error messages
 */
export interface ValidatedSubscriptionRow {
  id: string; // unique key for preview table rendering
  raw: Record<string, string>;
  parsed?: SubscriptionRow;
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Deterministic spending policy schema
 */
export const PolicyConfigSchema = z.object({
  max_auto_transaction: z.coerce
    .number()
    .nonnegative("Maximum auto transaction must be 0 or greater"),
  min_savings: z.coerce
    .number()
    .nonnegative("Minimum savings threshold must be 0 or greater"),
  human_approval_required_above: z.coerce
    .number()
    .nonnegative("Human approval threshold must be 0 or greater"),
  allowed_categories: z
    .array(SubscriptionCategoryEnum)
    .min(1, "At least one category must be allowed"),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  max_auto_transaction: 2000,
  min_savings: 200,
  human_approval_required_above: 2000,
  allowed_categories: ["software", "cloud", "contractors"],
};

/**
 * Full payload for committing onboarding
 */
export const OnboardBusinessPayloadSchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters"),
  treasury_balance: z.coerce.number().nonnegative("Treasury balance must be >= 0").default(50000),
  default_currency: z.string().default("USDC"),
  userId: z.string().uuid().optional(),
  webhook_url: z.string().url().optional().or(z.literal("")),
  policy: PolicyConfigSchema,
  subscriptions: z
    .array(SubscriptionRowSchema)
    .min(1, "At least one valid subscription contract is required"),
});

export type OnboardBusinessPayload = z.infer<typeof OnboardBusinessPayloadSchema>;
