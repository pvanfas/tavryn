import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("=== 1. Testing Statement CSV Upload (/api/import/file) ===");
  const statementPath = path.resolve(
    process.cwd(),
    "public/samples/statement.csv",
  );
  const statementBuffer = fs.readFileSync(statementPath);
  const statementBlob = new Blob([statementBuffer], { type: "text/csv" });

  const formData1 = new FormData();
  formData1.append("file", statementBlob, "statement.csv");

  const res1 = await fetch("http://localhost:3000/api/import/file", {
    method: "POST",
    body: formData1,
  });

  if (!res1.ok) {
    const err = await res1.text();
    throw new Error(`Statement import failed: ${res1.status} - ${err}`);
  }

  const data1 = await res1.json();
  const detected1 = data1.detected || [];
  console.log("Statement import success:", {
    source: data1.source,
    rowCount: detected1.length,
    vendors: detected1.map(
      (r: any) =>
        `${r.vendor} ($${r.annual_price}/yr, ${Math.round(r.confidence * 100)}% conf)`,
    ),
  });

  if (detected1.length !== 6) {
    throw new Error(`Expected 6 detected vendors, got ${detected1.length}`);
  }

  // Verify sensitive card number is not in the extracted descriptions
  const rawDump1 = JSON.stringify(data1);
  if (rawDump1.includes("*4920") || rawDump1.includes("4111")) {
    throw new Error(
      "FAILED: Card digits were not redacted in statement output!",
    );
  }
  console.log(
    "✓ Privacy verified: No card digits or PANs found in response payload.",
  );

  console.log("\n=== 2. Testing Invoice PDF Upload (/api/import/file) ===");
  const invoicePath = path.resolve(process.cwd(), "public/samples/invoice.pdf");
  const invoiceBuffer = fs.readFileSync(invoicePath);
  const invoiceBlob = new Blob([invoiceBuffer], { type: "application/pdf" });

  const formData2 = new FormData();
  formData2.append("file", invoiceBlob, "invoice.pdf");

  const res2 = await fetch("http://localhost:3000/api/import/file", {
    method: "POST",
    body: formData2,
  });

  if (!res2.ok) {
    const err = await res2.text();
    throw new Error(`Invoice import failed: ${res2.status} - ${err}`);
  }

  const data2 = await res2.json();
  const detected2 = data2.detected || [];
  console.log("Invoice import success:", {
    source: data2.source,
    vendor: detected2[0]?.vendor,
    service: detected2[0]?.service,
    amount: detected2[0]?.annual_price,
    confidence: detected2[0]?.confidence,
    needsConfirmation: detected2[0]?.needsConfirmation,
  });

  if (detected2.length === 0) {
    throw new Error(
      "Expected at least 1 extracted subscription from invoice PDF",
    );
  }

  console.log("\n=== 3. Testing Single Commit Path to /api/onboard ===");
  const testBusinessName = "Acme Streamlines " + Date.now();
  const onboardPayload = {
    name: testBusinessName,
    treasury_balance: 50000,
    policy: {
      max_auto_transaction: 2000,
      min_savings: 200,
      human_approval_required_above: 2000,
      allowed_categories: ["software", "cloud", "contractors"],
    },
    subscriptions: detected1.map((item: any) => ({
      vendor: item.vendor,
      service: item.service,
      category: item.category,
      annual_price: item.annual_price,
      renewal_date: item.renewal_date,
      seats: 50,
      active_seats: 42,
    })),
  };

  const res3 = await fetch("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(onboardPayload),
  });

  if (!res3.ok) {
    const err = await res3.text();
    throw new Error(`Onboard commit failed: ${res3.status} - ${err}`);
  }

  const resData3 = await res3.json();
  const data3 = resData3.data || resData3;
  console.log("Onboard commit success:", {
    businessId: data3.businessId,
    businessName: data3.businessName,
    contractsCount: data3.contractsCount,
    walletAddress: data3.walletAddress,
  });

  if (data3.contractsCount !== 6) {
    throw new Error(
      `Expected 6 contracts inserted, got ${data3.contractsCount}`,
    );
  }

  console.log("\n✓ ALL VERIFICATIONS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
