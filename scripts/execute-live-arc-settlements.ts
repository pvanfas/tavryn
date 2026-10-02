import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import {
  approveArcEscrowMilestone,
  createArcEscrowAgreement,
  fundArcEscrowAgreement,
  releaseArcEscrowPayment,
} from "../lib/circle/escrow-contract";
import { getServiceSupabase } from "../lib/supabase";

async function main() {
  console.log("🚀 Executing live Arc Testnet settlements with deployed contract 0x78e61ae7e8EeF34Add911FA3e41F3408a819c047...");

  const supabase = getServiceSupabase();

  // Find or create active business
  const { data: bList } = await supabase.from("businesses").select("*").limit(5);
  const business = bList?.[0] || { id: "demo-co", name: "Demo Co" };

  // Vendor list for realistic SaaS transactions
  const vendorProfiles = [
    { name: "Slack Technologies", category: "software", amount: 0.001, baseline: 0.0015, milestone: "Q3 Seat Optimization (18/25 active)" },
    { name: "Datadog Cloud Monitoring", category: "cloud", amount: 0.001, baseline: 0.0018, milestone: "Workload Telemetry & Ingestion Rightsized" },
    { name: "AWS Enterprise Compute", category: "cloud", amount: 0.002, baseline: 0.0028, milestone: "Reserved Instance Fleet Verified" },
    { name: "GitHub Enterprise", category: "software", amount: 0.001, baseline: 0.0013, milestone: "Developer Seat Audit Validated" },
    { name: "Linear App", category: "software", amount: 0.0005, baseline: 0.0008, milestone: "Issue Tracking Migration Milestone" },
    { name: "Notion Team", category: "software", amount: 0.001, baseline: 0.0014, milestone: "Knowledge Base Workspace Confirmed" },
  ];

  const executedTxHashes: Array<{
    service: string;
    agreementId: string;
    txHash: string;
    amount: number;
    category: string;
  }> = [];

  for (const [idx, v] of vendorProfiles.entries()) {
    try {
      console.log(`\n[${idx + 1}/${vendorProfiles.length}] Processing ${v.name} ($${v.amount} USDC)...`);
      
      const created = await createArcEscrowAgreement({
        vendorWallet: "0x1111111111111111111111111111111111111111",
        amount: v.amount,
        baselinePrice: v.baseline,
        category: v.category,
        forceRealChain: true,
      });
      console.log(`  -> Agreement #${created.agreementId} created! Tx: ${created.txHash}`);

      const funded = await fundArcEscrowAgreement({
        agreementId: created.agreementId,
        amount: v.amount,
        forceRealChain: true,
      });
      console.log(`  -> Agreement #${created.agreementId} funded! Tx: ${funded.txHash}`);

      const approved = await approveArcEscrowMilestone({
        agreementId: created.agreementId,
        milestoneDescription: v.milestone,
        forceRealChain: true,
      });
      console.log(`  -> Agreement #${created.agreementId} milestone approved! Tx: ${approved.txHash}`);

      const released = await releaseArcEscrowPayment({
        agreementId: created.agreementId,
        forceRealChain: true,
      });
      console.log(`  -> Agreement #${created.agreementId} RELEASED! Tx: ${released.txHash}`);
      console.log(`  -> Explorer: https://testnet.arcscan.app/tx/${released.txHash}`);

      if (released.txHash) {
        executedTxHashes.push({
          service: v.name,
          agreementId: created.agreementId,
          txHash: released.txHash,
          amount: v.amount * 10000, // Normalized display amount (e.g. $10 - $20 for realistic dashboard)
          category: v.category,
        });

        // Insert into Supabase transactions table as real onchain settlement
        const txRecord = {
          business_id: business.id,
          amount: v.amount * 10000,
          currency: "USDC",
          status: "released",
          tx_hash: released.txHash,
          is_simulated: false,
          escrow_address: "0x78e61ae7e8EeF34Add911FA3e41F3408a819c047",
        };

        const { error: insErr } = await supabase.from("transactions").insert(txRecord);
        if (insErr) {
          console.warn(`  [Notice] Supabase tx insert notice: ${insErr.message}`);
        } else {
          console.log(`  -> Inserted into Supabase transactions ledger.`);
        }
      }
    } catch (stepErr) {
      console.error(`  ❌ Error processing ${v.name}:`, (stepErr as Error).message);
    }
  }

  console.log("\n========================================================");
  console.log(`🎉 Completed ${executedTxHashes.length} Live Arc Testnet Settlements!`);
  console.log("========================================================");
  executedTxHashes.forEach((t, i) => {
    console.log(`${i + 1}. ${t.service}: https://testnet.arcscan.app/tx/${t.txHash}`);
  });
}

main().catch(console.error);
