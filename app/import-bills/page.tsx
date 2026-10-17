import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActiveBusiness } from "@/lib/active-business";

import { ImportBillsClient } from "./ImportBillsClient";

export const metadata: Metadata = {
  title: "Import Bills & Subscriptions | Tavryn",
  description:
    "Upload statements (CSV) or invoices (PDF, PNG, JPG) to automatically detect subscriptions and find savings.",
};

export const revalidate = 0;

interface ImportBillsPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function ImportBillsPage({
  searchParams,
}: ImportBillsPageProps) {
  const { businessId } = await searchParams;

  // Resolve Active Business for the authenticated session
  const business = await getActiveBusiness(businessId);
  if (!business) {
    redirect("/onboard");
  }

  const businesses = [business];

  return <ImportBillsClient business={business} businesses={businesses} />;
}
