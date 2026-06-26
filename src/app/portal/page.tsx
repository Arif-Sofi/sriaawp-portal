import { redirect } from "next/navigation";

import { dashboardPathForRoles } from "@/lib/navigation";
import { requireUser } from "@/lib/rbac";

export default async function PortalPage() {
  const user = await requireUser();
  redirect(dashboardPathForRoles(user.roles));
}
