import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

import { DEFAULT_ARC_ESCROW_CONTRACT } from "../lib/constants";

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

const DEMO_CO_ID = "b655fb94-fc62-4e3c-8898-2c5f88068159";

async function seed() {
  console.log("🌱 Starting realistic Demo Co showcase database seed...");

  // 1. Business: Demo Co
  console.log("--> 1. Seeding Demo Co...");
  const { data: existingBusiness } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", DEMO_CO_ID)
    .maybeSingle();

  const businessPayload = {
    id: DEMO_CO_ID,
    name: "Demo Co",
    is_real: false,
    default_currency: "USDC",
    treasury_balance: 125000,
    wallet_address: "0x535a2d04a60210214c77eaedebc3ffba01bbdb22",
  };

  if (existingBusiness) {
    await supabase
      .from("businesses")
      .update(businessPayload)
      .eq("id", DEMO_CO_ID);
    console.log(`    Updated Demo Co (${DEMO_CO_ID})`);
  } else {
    const { error: bErr } = await supabase
      .from("businesses")
      .insert(businessPayload);
    if (bErr) throw new Error(`Failed to insert Demo Co: ${bErr.message}`);
    console.log(`    Created Demo Co (${DEMO_CO_ID})`);
  }

  // 2. Policy for Demo Co
  console.log("--> 2. Seeding Policy...");
  const policyPayload = {
    business_id: DEMO_CO_ID,
    max_auto_transaction: 10000,
    min_savings: 500,
    human_approval_required_above: 10000,
    allowed_categories: ["software", "cloud", "contractors"],
    category_budgets: {
      software: 75000,
      cloud: 125000,
      contractors: 45000,
    },
  };

  const { data: existingPolicy } = await supabase
    .from("policies")
    .select("id")
    .eq("business_id", DEMO_CO_ID)
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
  console.log("--> 3. Seeding Vendors...");
  const vendorsToSeed = [
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
    {
      name: "GitHub",
      category: "software",
      contact: "procurement@github.com",
      reputation_score: 4.9,
      is_simulated: false,
      wallet_address: "0x7777777777777777777777777777777777777777",
    },
    {
      name: "Figma",
      category: "software",
      contact: "procurement@figma.com",
      reputation_score: 4.6,
      is_simulated: false,
      wallet_address: "0x8888888888888888888888888888888888888888",
    },
    {
      name: "Snowflake",
      category: "cloud",
      contact: "procurement@snowflake.com",
      reputation_score: 4.8,
      is_simulated: false,
      wallet_address: "0x9999999999999999999999999999999999999999",
    },
    {
      name: "Salesforce",
      category: "software",
      contact: "procurement@salesforce.com",
      reputation_score: 4.5,
      is_simulated: false,
      wallet_address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
    {
      name: "DevScale",
      category: "contractors",
      contact: "procurement@devscale.com",
      reputation_score: 4.7,
      is_simulated: false,
      wallet_address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
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

  // 4. Clean up previous Demo Co downstream records to prevent duplicates
  console.log("--> 4. Clearing prior Demo Co records (preserving audit log)...");
  await supabase.from("receipts").delete().eq("business_id", DEMO_CO_ID);
  await supabase.from("transactions").delete().eq("business_id", DEMO_CO_ID);
  await supabase.from("approvals").delete().eq("business_id", DEMO_CO_ID);
  await supabase.from("notifications").delete().eq("business_id", DEMO_CO_ID);
  
  // Clean negotiations for Demo Co contracts
  const { data: oldContracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("business_id", DEMO_CO_ID);

  if (oldContracts && oldContracts.length > 0) {
    const oldIds = oldContracts.map((c) => c.id);
    await supabase.from("negotiations").delete().in("contract_id", oldIds);
  }

  // 5. Contracts for Demo Co (Diverse 8-contract portfolio)
  console.log("--> 5. Seeding 8 Contracts for Demo Co...");
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
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("Slack") || null,
      service: "Slack",
      category: "software",
      current_price: 18000,
      renewal_date: new Date(now + 24 * dayMs).toISOString(),
      seat_count: 120,
      active_seats: 92,
      usage_metric: null,
      status: "active",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("Datadog") || null,
      service: "Datadog",
      category: "cloud",
      current_price: 34800,
      renewal_date: new Date(now + 14 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: { type: "usage_decline", decline_pct: 28 },
      status: "negotiating",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("Figma") || null,
      service: "Figma",
      category: "software",
      current_price: 12000,
      renewal_date: new Date(now + 11 * dayMs).toISOString(),
      seat_count: 40,
      active_seats: 24,
      usage_metric: null,
      status: "negotiating",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("AWS") || null,
      service: "AWS",
      category: "cloud",
      current_price: 54000,
      renewal_date: new Date(now + 45 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: { type: "usage_decline", decline_pct: 14 },
      status: "active",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("GitHub") || null,
      service: "GitHub",
      category: "software",
      current_price: 14400,
      renewal_date: new Date(now + 60 * dayMs).toISOString(),
      seat_count: 80,
      active_seats: 62,
      usage_metric: null,
      status: "active",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("Snowflake") || null,
      service: "Snowflake",
      category: "cloud",
      current_price: 26000,
      renewal_date: new Date(now + 90 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: { type: "usage_decline", decline_pct: 19 },
      status: "active",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("Salesforce") || null,
      service: "Salesforce",
      category: "software",
      current_price: 30000,
      renewal_date: new Date(now + 120 * dayMs).toISOString(),
      seat_count: 25,
      active_seats: 19,
      usage_metric: null,
      status: "active",
    },
    {
      business_id: DEMO_CO_ID,
      vendor_id: vendorMap.get("DevScale") || null,
      service: "DevScale",
      category: "contractors",
      current_price: 36000,
      renewal_date: new Date(now + 180 * dayMs).toISOString(),
      seat_count: null,
      active_seats: null,
      usage_metric: null,
      status: "active",
    },
  ];

  const contractMap = new Map<string, string>();

  for (const c of contractsToSeed) {
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", DEMO_CO_ID)
      .eq("service", c.service)
      .maybeSingle();

    if (existingContract) {
      await supabase.from("contracts").update(c).eq("id", existingContract.id);
      contractMap.set(c.service, existingContract.id);
      console.log(`    Updated contract for ${c.service}`);
    } else {
      const { data: newContract, error } = await supabase
        .from("contracts")
        .insert(c)
        .select("id")
        .single();
      if (error || !newContract)
        throw new Error(
          `Failed to insert contract for ${c.service}: ${error?.message}`,
        );
      contractMap.set(c.service, newContract.id);
      console.log(`    Created contract for ${c.service}`);
    }
  }

  // 6. Negotiations with realistic multi-round dialogs
  console.log("--> 6. Seeding Negotiations...");

  // Slack: Completed negotiation ($18,000 -> $14,040, $3,960 saved)
  const slackId = contractMap.get("Slack")!;
  const { data: slackNeg, error: slackNegErr } = await supabase
    .from("negotiations")
    .insert({
      contract_id: slackId,
      original_price: 18000,
      target_price: 13800,
      current_offer: 14040,
      final_price: 14040,
      savings: 3960,
      rounds: 3,
      status: "agreed",
      conversation: [
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 13800,
          round: 1,
          message:
            "Hello Slack renewals team. Over the last 90 days, Demo Co active users averaged 92 out of 120 provisioned licenses (23.3% idle seats). Under company spending policy, we are proposing right-sizing to 95 seats at $13,800/yr for the upcoming term.",
          timestamp: new Date(now - 3 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Slack Enterprise Sales",
          amount: 15400,
          round: 1,
          message:
            "Thank you for reaching out. We can offer a tier retention discount if Demo Co commits to keeping 110 enterprise seats, bringing the total to $15,400.",
          timestamp: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 14040,
          round: 2,
          message:
            "We cannot carry unassigned seats under our governance policy. However, we are authorized to execute immediate full-term settlement in USDC via Arc testnet escrow today if we can close at $14,040 for 100 enterprise licenses.",
          timestamp: new Date(now - 1.5 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Slack Enterprise Sales",
          amount: 14040,
          round: 2,
          accepted: true,
          message:
            "Agreement reached. Concession approved at $14,040 annual rate for 100 licenses with immediate settlement.",
          timestamp: new Date(now - 1 * dayMs).toISOString(),
        },
      ],
    })
    .select("id")
    .single();

  if (slackNegErr) throw new Error(`Slack negotiation failed: ${slackNegErr.message}`);

  // Datadog: Agreed negotiation awaiting executive approval ($34,800 -> $27,840, $6,960 saved)
  const datadogId = contractMap.get("Datadog")!;
  const { data: datadogNeg, error: datadogNegErr } = await supabase
    .from("negotiations")
    .insert({
      contract_id: datadogId,
      original_price: 34800,
      target_price: 26000,
      current_offer: 27840,
      final_price: 27840,
      savings: 6960,
      rounds: 3,
      status: "agreed",
      conversation: [
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 26000,
          round: 1,
          message:
            "Hello Datadog account team. Ingest telemetry demonstrates a 28% decrease in custom metrics and host count over Q2-Q3. We request realigning our annual commitment to $26,000.",
          timestamp: new Date(now - 4 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Datadog Renewals",
          amount: 30500,
          round: 1,
          message:
            "We can offer a revised rate of $30,500 if an additional 12-month commitment is agreed to before end of week.",
          timestamp: new Date(now - 3 * dayMs).toISOString(),
        },
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 27840,
          round: 2,
          message:
            "Our data indicates peer cloud offerings at $25,500 for equivalent volume. We are prepared to settle at $27,840.",
          timestamp: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Datadog Renewals",
          amount: 27840,
          round: 2,
          accepted: true,
          message:
            "Counter-offer of $27,840 accepted. Contract sent for human authorization and escrow fund lock.",
          timestamp: new Date(now - 1.2 * dayMs).toISOString(),
        },
      ],
    })
    .select("id")
    .single();

  if (datadogNegErr) throw new Error(`Datadog negotiation failed: ${datadogNegErr.message}`);

  // Figma: Active negotiation (round 2, original $12,000, current offer $10,200)
  const figmaId = contractMap.get("Figma")!;
  const { data: figmaNeg, error: figmaNegErr } = await supabase
    .from("negotiations")
    .insert({
      contract_id: figmaId,
      original_price: 12000,
      target_price: 9000,
      current_offer: 10200,
      final_price: null,
      savings: 1800,
      rounds: 2,
      status: "countered",
      conversation: [
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 9000,
          round: 1,
          message:
            "Hello Figma procurement. We have 16 unassigned editor seats out of 40 (40% inactivity) ahead of our renewal cliff in 11 days. We propose downsizing to 25 seats at $9,000.",
          timestamp: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Figma Renewals",
          amount: 10200,
          round: 1,
          message:
            "We can offer 30 editor seats with unlimited figjam at $10,200. Please confirm if this works.",
          timestamp: new Date(now - 1 * dayMs).toISOString(),
        },
      ],
    })
    .select("id")
    .single();

  if (figmaNegErr) throw new Error(`Figma negotiation failed: ${figmaNegErr.message}`);

  // Snowflake: Historical settled negotiation ($31,000 -> $26,000, $5,000 saved)
  const snowflakeId = contractMap.get("Snowflake")!;
  const { data: snowflakeNeg, error: snowflakeNegErr } = await supabase
    .from("negotiations")
    .insert({
      contract_id: snowflakeId,
      original_price: 31000,
      target_price: 25000,
      current_offer: 26000,
      final_price: 26000,
      savings: 5000,
      rounds: 2,
      status: "agreed",
      conversation: [
        {
          role: "agent",
          speaker: "Tavryn Agent",
          amount: 25000,
          round: 1,
          message:
            "Compute credit burn decreased 19% after warehouse optimization. Requesting adjusted credit commitment to $25,000.",
          timestamp: new Date(now - 15 * dayMs).toISOString(),
        },
        {
          role: "vendor",
          speaker: "Snowflake Sales",
          amount: 26000,
          round: 1,
          accepted: true,
          message:
            "Approved at $26,000 credit package with rollover guarantees.",
          timestamp: new Date(now - 14 * dayMs).toISOString(),
        },
      ],
    })
    .select("id")
    .single();

  if (snowflakeNegErr) throw new Error(`Snowflake negotiation failed: ${snowflakeNegErr.message}`);

  // 7. Approvals: Datadog Pending Approval & Slack Approved
  console.log("--> 7. Seeding Approvals...");
  await supabase.from("approvals").insert([
    {
      business_id: DEMO_CO_ID,
      negotiation_id: datadogNeg.id,
      status: "pending",
      reason:
        "Renewal rate $27,840 exceeds auto-execution policy limit ($10,000). Second-opinion reviewer agent audited counter-proposal ($6,960 saved, 20% concession) and recommends human executive approval.",
      created_at: new Date(now - 1.1 * dayMs).toISOString(),
    },
    {
      business_id: DEMO_CO_ID,
      negotiation_id: slackNeg.id,
      status: "approved",
      reason:
        "Within policy parameters and auto-approved by deterministic rules engine ($3,960 saved).",
      decided_at: new Date(now - 0.9 * dayMs).toISOString(),
      created_at: new Date(now - 1.2 * dayMs).toISOString(),
    },
  ]);

  // 8. Transactions (Settlements on Arc Testnet)
  console.log("--> 8. Seeding Transactions...");
  const { data: slackTx, error: slackTxErr } = await supabase
    .from("transactions")
    .insert({
      business_id: DEMO_CO_ID,
      contract_id: slackId,
      negotiation_id: slackNeg.id,
      vendor_id: vendorMap.get("Slack"),
      amount: 14040,
      currency: "USDC",
      status: "completed",
      tx_hash:
        "0x3a4f89d71c6e12bb94a28f110c73e91d55e098cb15d2a71bf5a9e334418f7c9a",
      escrow_address: DEFAULT_ARC_ESCROW_CONTRACT,
      idempotency_key: "idemp-slack-annual-renewal-demo-co-2026",
      is_simulated: false,
      created_at: new Date(now - 0.8 * dayMs).toISOString(),
    })
    .select("id")
    .single();

  if (slackTxErr) throw new Error(`Slack transaction failed: ${slackTxErr.message}`);

  await supabase.from("transactions").insert({
    business_id: DEMO_CO_ID,
    contract_id: snowflakeId,
    negotiation_id: snowflakeNeg.id,
    vendor_id: vendorMap.get("Snowflake"),
    amount: 26000,
    currency: "USDC",
    status: "completed",
    tx_hash:
      "0x81b7a2d488f01c34bb6199a501e7456cc180dbca741e93fe01b63991ad34f18b",
    escrow_address: DEFAULT_ARC_ESCROW_CONTRACT,
    idempotency_key: "idemp-snowflake-annual-renewal-demo-co-2026",
    is_simulated: false,
    created_at: new Date(now - 14 * dayMs).toISOString(),
  });

  // 9. Receipts: Public Cryptographic Savings Receipt for Slack
  console.log("--> 9. Seeding Cryptographic Savings Receipt...");
  await supabase.from("receipts").insert({
    transaction_id: slackTx.id,
    business_id: DEMO_CO_ID,
    token: "d3f9a710bc42e88a099f66c1b34e567a",
    created_by: "Tavryn Autonomous Agent",
    show_business_name: true,
    show_vendor_name: true,
    created_at: new Date(now - 0.7 * dayMs).toISOString(),
  });

  // 10. Notifications
  console.log("--> 10. Seeding Notifications...");
  await supabase.from("notifications").insert([
    {
      business_id: DEMO_CO_ID,
      contract_id: figmaId,
      negotiation_id: figmaNeg.id,
      category: "renewal",
      title: "Figma Renewal in 11 Days",
      message:
        "Figma Enterprise renews on Oct 19. Tavryn is actively negotiating concessions on 16 unassigned seats.",
      read: false,
      link: "/negotiations",
      link_label: "View Negotiation",
      created_at: new Date(now - 0.5 * dayMs).toISOString(),
    },
    {
      business_id: DEMO_CO_ID,
      contract_id: datadogId,
      negotiation_id: datadogNeg.id,
      category: "policy",
      title: "Action Required: Datadog Approval ($27,840 USDC)",
      message:
        "Negotiated rate of $27,840 saves $6,960 (20%) but exceeds auto-approval ceiling of $10,000. Reviewer agent recommends approval.",
      read: false,
      link: "/approvals",
      link_label: "Review Approval",
      created_at: new Date(now - 1.1 * dayMs).toISOString(),
    },
    {
      business_id: DEMO_CO_ID,
      contract_id: slackId,
      negotiation_id: slackNeg.id,
      category: "negotiation",
      title: "Savings Secured: Slack ($3,960 USDC saved)",
      message:
        "Successfully renegotiated Slack from $18,000 to $14,040 and settled on Arc testnet. Public proof generated.",
      read: true,
      link: "/r/d3f9a710bc42e88a099f66c1b34e567a",
      link_label: "View Cryptographic Receipt",
      created_at: new Date(now - 0.7 * dayMs).toISOString(),
    },
  ]);

  // 11. Verification Counts
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
  const { count: nCount } = await supabase
    .from("negotiations")
    .select("*", { count: "exact", head: true });
  const { count: aCount } = await supabase
    .from("approvals")
    .select("*", { count: "exact", head: true });
  const { count: tCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });
  const { count: rCount } = await supabase
    .from("receipts")
    .select("*", { count: "exact", head: true });
  const { count: notifCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true });
  const { count: actionsCount } = await supabase
    .from("agent_actions")
    .select("*", { count: "exact", head: true });

  console.log("\n📊 Database Row Verification:");
  console.log(`- businesses:    ${bCount} (strictly Demo Co)`);
  console.log(`- policies:      ${pCount}`);
  console.log(`- vendors:       ${vCount}`);
  console.log(`- contracts:     ${cCount}`);
  console.log(`- negotiations:  ${nCount}`);
  console.log(`- approvals:     ${aCount}`);
  console.log(`- transactions:  ${tCount}`);
  console.log(`- receipts:      ${rCount}`);
  console.log(`- notifications: ${notifCount}`);
  console.log(`- agent_actions: ${actionsCount} (intact audit trail)`);
  console.log("✅ Demo Co showcase seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
