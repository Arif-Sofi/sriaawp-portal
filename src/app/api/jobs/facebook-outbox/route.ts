import { dispatchFacebookOutbox } from "@/lib/facebook/outbox-worker";
import { getCurrentUser, hasPermission } from "@/lib/rbac";

// Trigger surface for the outbound background job (ADR-004/ADR-022): a Vercel cron or a manual admin
// drains the outbox here. Two accepted authorisations:
//   * Authorization: Bearer <CRON_SECRET>  — the scheduled, unattended path.
//   * an authenticated admin holding news:sync_facebook — the manual trigger.
// Neither path bypasses the kill-switch: dispatchFacebookOutbox no-ops when sync is disabled.
const carriesCronSecret = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
};

const adminTriggered = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasPermission(user, "news:sync_facebook");
};

export async function POST(request: Request): Promise<Response> {
  const authorised = carriesCronSecret(request) || (await adminTriggered());
  if (!authorised) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await dispatchFacebookOutbox();
  return Response.json(result);
}
