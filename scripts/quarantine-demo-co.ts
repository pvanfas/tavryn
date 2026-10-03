import { getServiceSupabase } from "../lib/supabase";

const DEMO_CO_ID = "b655fb94-fc62-4e3c-8898-2c5f88068159";

async function main() {
  const supabase = getServiceSupabase();

  console.log("Fetching all organizations to identify non-demo businesses...");
  const { data: allBusinesses, error: listErr } = await supabase
    .from("businesses")
    .select("id, name, is_real");

  if (listErr) {
    console.error("Failed to list businesses:", listErr);
    process.exit(1);
  }

  const toDelete = (allBusinesses || []).filter((b) => b.id !== DEMO_CO_ID);
  console.log(`Found ${toDelete.length} organizations to delete. Keeping Demo Co (${DEMO_CO_ID}).`);

  for (const b of toDelete) {
    console.log(`Deleting organization "${b.name}" (${b.id})...`);
    // Delete child records
    await Promise.allSettled([
      supabase.from("receipts").delete().eq("business_id", b.id),
      supabase.from("reviewer_audits").delete().eq("business_id", b.id),
      supabase.from("approvals").delete().eq("business_id", b.id),
      supabase.from("override_memory").delete().eq("business_id", b.id),
      supabase.from("vendor_memory").delete().eq("business_id", b.id),
      supabase.from("notifications").delete().eq("business_id", b.id),
      supabase.from("onboarding_events").delete().eq("business_id", b.id),
      supabase.from("transactions").delete().eq("business_id", b.id),
      supabase.from("contracts").delete().eq("business_id", b.id),
      supabase.from("policies").delete().eq("business_id", b.id),
      supabase.from("business_members").delete().eq("business_id", b.id),
    ]);

    const { error: delErr } = await supabase
      .from("businesses")
      .delete()
      .eq("id", b.id);

    if (delErr) {
      console.warn(`Could not hard-delete "${b.name}": ${delErr.message}. Scrubbing...`);
      await supabase
        .from("businesses")
        .update({
          name: `[Deleted Organization] ${b.name}`,
          is_real: false,
          wallet_address: null,
          webhook_url: null,
          treasury_balance: 0,
        })
        .eq("id", b.id);
    }
  }

  // Ensure Demo Co exists and is set properly
  const { data: demoCo } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", DEMO_CO_ID)
    .maybeSingle();

  if (!demoCo) {
    console.log("Demo Co not found; inserting fresh Demo Co record...");
    await supabase.from("businesses").insert({
      id: DEMO_CO_ID,
      name: "Demo Co",
      is_real: false,
      treasury_balance: 50000,
      default_currency: "USDC",
    });
  } else {
    console.log("Ensuring Demo Co is marked as demo organization (is_real = false)...");
    await supabase
      .from("businesses")
      .update({
        name: "Demo Co",
        is_real: false,
      })
      .eq("id", DEMO_CO_ID);
  }

  // Final check
  const { data: remaining } = await supabase
    .from("businesses")
    .select("id, name, is_real");

  console.log("Remaining businesses in database:", remaining);
}

main().catch(console.error);
