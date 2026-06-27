import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PortalSection } from "@/components/portal/portal-section";
import { getCurrentUser } from "@/lib/rbac";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import {
  listBlackouts,
  listPublicOccurrences,
  listVisibleOccurrences,
} from "@/lib/calendar/queries";

export const dynamic = "force-dynamic";

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthRangeISO(date: Date): { fromISO: string; toISO: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fromISO = new Date(year, month, 1).toISOString();
  const toISO = new Date(year, month + 1, 1).toISOString();
  return { fromISO, toISO };
}

function formatDateTime(date: Date, locale: string): string {
  return date.toLocaleString(locale === "en" ? "en-MY" : "ms-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TakwimPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);
  const user = await getCurrentUser();

  const now = new Date();
  const monthStart = firstOfMonth(now);
  const { fromISO, toISO } = monthRangeISO(now);

  const occurrences = user
    ? await listVisibleOccurrences({
        fromISO,
        toISO,
        user: {
          roles: user.roles ?? [],
          deptIds: user.deptIds ?? [],
        },
      })
    : await listPublicOccurrences({ fromISO, toISO });

  const blackouts = await listBlackouts({ fromISO, toISO });

  const calendarEvents = occurrences.map((o) => ({
    dateISO: o.startAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }),
    label: o.title,
  }));

  return (
    <div className="space-y-6 py-6">
      <PortalSection title={t("takwim.title")}>
        <Calendar month={monthStart} events={calendarEvents} />
      </PortalSection>

      <PortalSection title={t("takwim.upcoming")}>
        {occurrences.length === 0 ? (
          <EmptyState title={t("takwim.empty")} description={t("takwim.emptyDesc")} />
        ) : (
          <ul className="divide-y divide-border">
            {occurrences.map((o) => (
              <li key={o.occurrenceId} className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{o.title}</span>
                  {o.priority === "exam" ? (
                    <Badge variant="destructive">{t("takwim.exam")}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(o.startAt, locale)}
                  {" — "}
                  {formatDateTime(o.endAt, locale)}
                </p>
                {o.roomName ? (
                  <p className="text-xs text-muted-foreground">
                    {t("takwim.room")}: {o.roomName}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      {blackouts.length > 0 ? (
        <PortalSection title={t("takwim.blackouts")}>
          <ul className="divide-y divide-border">
            {blackouts.map((b) => (
              <li key={b.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{b.title}</span>
                  <Badge variant={b.isHard ? "destructive" : "warning"}>
                    {b.isHard ? t("takwim.blackoutHard") : t("takwim.blackoutSoft")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(b.startAt, locale)} — {formatDateTime(b.endAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        </PortalSection>
      ) : null}
    </div>
  );
}
