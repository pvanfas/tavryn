import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function seed() {
  console.log("🌱 Starting idempotent database seed...");

  // 1. Business: Demo Co
  console.log("--> Seeding Demo Co...");
  const { data: existingBusiness } = await supabase
    .from("businesses")
    .select("id")
    .eq("name", "Demo Co")
    .maybeSingle();

  let businessId: string;

  if (existingBusiness) {
    businessId = existingBusiness.id;
    await supabase
      .from("businesses")
      .update({
        is_real: false,
        default_currency: "USDC",
        treasury_balance: 42850,
      })
      .eq("id", businessId);
    console.log(`    Updated Demo Co (${businessId})`);
  } else {
    const { data: newBusiness, error } = await supabase
      .from("businesses")
      .insert({
        name: "Demo Co",
        is_real: false,
        default_currency: "USDC",
        treasury_balance: 42850,
      })
      .select("id")
      .single();

    if (error || !newBusiness) {
      throw new Error(`Failed to insert Demo Co: ${error?.message}`);
    }
    businessId = newBusiness.id;
    console.log(`    Created Demo Co (${businessId})`);
  }

  // 2. Policy for Demo Co
  console.log("--> Seeding Policy...");
  const policyPayload = {
    business_id: businessId,
    max_auto_transaction: 10000,
    min_savings: 500,
    human_approval_required_above: 10000,
    allowed_categories: ["software", "cloud", "contractors"],
    category_budgets: {
      software: 50000,
      cloud: 100000,
      contractors: 30000,
    },
  };

  const { data: existingPolicy } = await supabase
    .from("policies")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingPolicy) {
    await supabase
      .from("policies")
      .update(policyPayload)
      .eq("id", existingPolicy.id);
    console.log("    Updated Policy for Demo Co");
  } else {
    const { error: policyError } = await supabase
      .from("policies")
      .insert(policyPayload);
    if (policyError)
      throw new Error(`Failed to insert Policy: ${policyError.message}`);
    console.log("    Created Policy for Demo Co");
  }

  // 3. Vendors
  console.log("--> Seeding Vendors...");
  const vendorsToSeed = [
    {
      name: "Support Platform A",
      category: "software",
      contact: "sales@supportplatform-a.sim",
      reputation_score: 4.5,
      is_simulated: true,
      wallet_address: "0x1111111111111111111111111111111111111111",
    },
    {
      name: "Support Platform B",
      category: "software",
      contact: "sales@supportplatform-b.sim",
      reputation_score: 4.2,
      is_simulated: true,
      wallet_address: "0x2222222222222222222222222222222222222222",
    },
    {
      name: "Support Platform C",
      category: "software",
      contact: "sales@supportplatform-c.sim",
      reputation_score: 4.0,
      is_simulated: true,
      wallet_address: "0x3333333333333333333333333333333333333333",
    },
    {
      name: "Slack",
      category: "software",
      contact: "billing@slack.com",
      reputation_score: 4.8,
      is_simulated: false,
      wallet_address: "0x4444444444444444444444444444444444444444",
    },
    {
      name: "Datadog",
      category: "cloud",
      contact: "renewals@datadoghq.com",
      reputation_score: 4.7,
      is_simulated: false,
      wallet_address: "0x5555555555555555555555555555555555555555",
    },
    {
      name: "AWS",
      category: "cloud",
      contact: "aws-sales@amazon.com",
      reputation_score: 4.9,
      is_simulated: false,
      wallet_address: "0x6666666666666666666666666666666666666666",
    },
  ];

  const vendorMap = new Map<string, string>();

  for (const v of vendorsToSeed) {
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("name", v.name)
      .maybeSingle();

    if (existingVendor) {
      await supabase.from("vendors").update(v).eq("id", existingVendor.id);
      vendorMap.set(v.name, existingVendor.id);
      console.log(`    Updated vendor ${v.name}`);
    } else {
      const { data: newVendor, error } = await supabase
        .from("vendors")
        .insert(v)
        .select("id")
        .single();
      if (error || !newVendor)
        throw new Error(`Failed to insert vendor ${v.name}: ${error?.message}`);
      vendorMap.set(v.name, newVendor.id);
      console.log(`    Created vendor ${v.name}`);
    }
  }

  // 4. Contracts for Demo Co
  console.log("--> Seeding Contracts...");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  interface ContractSeed {
    business_id: string;
    vendor_id: string | null;
    service: string;
    category: string;
    current_price: number;
    renewal_date: string;
    seat_count: number | null;
    active_seats: number | null;
    usage_metric: Record<string, unknown> | null;
    status: string;
  }

  const contractsToSeed: ContractSeed[] = [
    {
      business_id: businessId,
      vendor_id: vendorMap.get("Slack") || null,
      service: "Slack",
      category: "software",
      current_price: 9600,
      renewal_date: new Date(now + 21 * dayMs).toISOString(),
      seat_count: 25,
      active_seats: 18,
      usage_metric: null,
      status: "active",
    },
    {
      business_id: businessId,
      vendor_id: vendorMap.get("Datadog") || null,
      service: "Datadog",
      category: "cloud",
      current_price: 37200,
      renewal_date: new Date(now + 14 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: { type: "usage_decline", decline_pct: 31 },
      status: "active",
    },
    {
      business_id: businessId,
      vendor_id: vendorMap.get("AWS") || null,
      service: "AWS",
      category: "cloud",
      current_price: 24000,
      renewal_date: new Date(now + 40 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: { type: "usage_decline", decline_pct: 12 },
      status: "active",
    },
  ];

  for (const c of contractsToSeed) {
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", businessId)
      .eq("service", c.service)
      .maybeSingle();

    if (existingContract) {
      await supabase.from("contracts").update(c).eq("id", existingContract.id);
      console.log(`    Updated contract for ${c.service}`);
    } else {
      const { error } = await supabase.from("contracts").insert(c);
      if (error)
        throw new Error(
          `Failed to insert contract for ${c.service}: ${error.message}`,
        );
      console.log(`    Created contract for ${c.service}`);
    }
  }

  // 5. Verification Counts
  const { count: bCount } = await supabase
    .from("businesses")
    .select("*", { count: "exact", head: true });
  const { count: pCount } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true });
  const { count: vCount } = await supabase
    .from("vendors")
    .select("*", { count: "exact", head: true });
  const { count: cCount } = await supabase
    .from("contracts")
    .select("*", { count: "exact", head: true });

  console.log("\n📊 Database Row Verification:");
  console.log(`- businesses: ${bCount}`);
  console.log(`- policies:   ${pCount}`);
  console.log(`- vendors:    ${vCount}`);
  console.log(`- contracts:  ${cCount}`);
  console.log("✅ Seeding complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
