import { redirect } from "next/navigation";
import React from "react";

import { OnboardingFlow } from "@/components/OnboardingFlow";
import { getActiveBusiness } from "@/lib/active-business";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const active = await getActiveBusiness();

  // If the user already owns or belongs to a real organization, proceed straight to their dashboard
  if (active && active.is_real) {
    redirect("/dashboard");
  }

  return <OnboardingFlow />;
}
