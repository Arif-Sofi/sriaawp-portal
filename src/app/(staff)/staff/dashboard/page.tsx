import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { AppShortcuts } from "@/components/portal/app-shortcuts";
import { PortalSection } from "@/components/portal/portal-section";
import { listManageableEvents } from "@/lib/calendar/queries";
import { listVisibleOccurrences } from "@/lib/calendar/queries";
import { listVisibleMemos } from "@/lib/content/queries";
import { listDepartments } from "@/lib/admin/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/rbac";

const EVENT_STATUS_VARIANT = {
  draft: "neutral",
  published: "success",
  pending_review: "warning",
  cancelled: "destructive",
} as const;

const EVENT_STATUS_KEY = {
  draft: "event.statusDraft",
  published: "event.statusPublished",
  pending_review: "event.statusPendingReview",
  cancelled: "event.statusCancelled",
} as const;

function monthRangeISO(date: Date): { fromISO: string; toISO: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fromISO = new Date(year, month, 1).toISOString();
  const toISO = new Date(year, month + 1, 1).toISOString();
  return { fromISO, toISO };
}

function formatMYDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export default async function StaffDashboardPage() {
  const user = await requirePermission("staff:dashboard:read");
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const now = new Date();
  const { fromISO, toISO } = monthRangeISO(now);

  const [allEvents, allMemos, allOccurrences, allDepts] = await Promise.all([
    listManageableEvents(user),
    listVisibleMemos(user),
    listVisibleOccurrences({ fromISO, toISO, user }),
    listDepartments(),
  ]);

  const userDepts = allDepts.filter((d) => user.deptIds.includes(d.id));
  const topEvents = allEvents.slice(0, 5);
  const topMemos = allMemos.slice(0, 5);
  const topOccurrences = allOccurrences.slice(0, 5);

  const shortcuts = [
    {
      href: "/staff/events/new",
      label: t("staff.shortcutCreateEvent"),
      icon: <Icon name="calendar" />,
    },
    {
      href: "/staff/events",
      label: t("staff.shortcutMyEvents"),
      icon: <Icon name="file" />,
    },
    {
      href: "/staff/documents",
      label: t("nav.documents"),
      icon: <Icon name="file" />,
    },
    {
      href: "/takwim",
      label: t("staff.shortcutTakwim"),
      icon: <Icon name="calendar" />,
    },
    {
      href: "/news",
      label: t("staff.shortcutNews"),
      icon: <Icon name="news" />,
    },
  ];

  return (
    <>
      <AppShortcuts items={shortcuts} />

      <div className="space-y-6 py-6">
        {userDepts.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("staff.department")}:{" "}
            <span className="font-medium text-foreground">
              {userDepts.map((d) => d.name).join(", ")}
            </span>
          </p>
        ) : null}

        <PortalSection
          title={t("staff.departmentEvents")}
          action={
            <Link href="/staff/events" className="hover:underline">
              {t("section.seeAll")}
            </Link>
          }
        >
          {topEvents.length === 0 ? (
            <EmptyState
              title={t("staff.emptyEvents")}
              description={t("staff.emptyEventsDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {topEvents.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{ev.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatMYDate(ev.startAt, locale)}
                    </p>
                  </div>
                  <Badge variant={EVENT_STATUS_VARIANT[ev.status]}>
                    {t(EVENT_STATUS_KEY[ev.status])}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>

        <PortalSection title={t("staff.memos")}>
          {topMemos.length === 0 ? (
            <EmptyState
              title={t("staff.emptyMemos")}
              description={t("staff.emptyMemosDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {topMemos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                  {m.pinned ? <Badge variant="info">{t("staff.pinned")}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </PortalSection>

        <PortalSection
          title={t("staff.takwim")}
          action={
            <Link href="/takwim" className="hover:underline">
              {t("section.seeAll")}
            </Link>
          }
        >
          {topOccurrences.length === 0 ? (
            <EmptyState
              title={t("staff.emptyTakwim")}
              description={t("staff.emptyTakwimDesc")}
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {topOccurrences.map((o) => (
                <li key={o.occurrenceId} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{o.title}</span>
                    {o.priority === "exam" ? (
                      <Badge variant="destructive">{t("takwim.exam")}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatMYDate(o.startAt, locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </PortalSection>
      </div>
    </>
  );
}
