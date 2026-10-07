import { redirect } from "next/navigation";

export default function OnboardRedirectPage() {
  redirect("/import-bills");
}
