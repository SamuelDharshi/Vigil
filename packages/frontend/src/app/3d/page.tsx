import { redirect } from "next/navigation";

// Legacy route — dashboard is now at /dashboard
export default function OldThreeDView() {
  redirect("/dashboard");
}
