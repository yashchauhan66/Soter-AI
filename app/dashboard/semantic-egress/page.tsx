import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SemanticEgressPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  return <div>Semantic Egress Dashboard</div>;
}
