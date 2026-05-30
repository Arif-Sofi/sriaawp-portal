import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listManageableEvents } from "@/lib/calendar/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/rbac";

const STATUS_VARIANTS = {
  draft: "neutral",
  published: "success",
  pending_review: "warning",
  cancelled: "neutral",
} as const satisfies Record<
  string,
  "neutral" | "success" | "warning" | "destructive" | "primary" | "info"
>;

const STATUS_KEYS = {
  draft: "event.statusDraft",
  published: "event.statusPublished",
  pending_review: "event.statusPendingReview",
  cancelled: "event.statusCancelled",
} as const;

export default async function StaffEventsPage() {
  const [user, locale] = await Promise.all([requirePermission("event:create"), getLocale()]);
  const events = await listManageableEvents({ id: user.id, deptIds: user.deptIds });
  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{t("event.pageTitle")}</h1>
        <Link
          href="/staff/events/new"
          className={buttonClasses({ variant: "primary", size: "md" })}
        >
          {t("event.createNew")}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("event.noEvents")} description={t("event.noEventsDesc")} />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-card-foreground">{ev.title}</span>
                <span className="text-xs text-muted-foreground">
                  {ev.startAt.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}
                  {ev.occurrenceCount > 1
                    ? ` · ${ev.occurrenceCount} ${t("event.occurrences")}`
                    : null}
                  {ev.roomName ? ` · ${ev.roomName}` : null}
                </span>
              </div>
              <Badge variant={STATUS_VARIANTS[ev.status]}>{t(STATUS_KEYS[ev.status])}</Badge>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
