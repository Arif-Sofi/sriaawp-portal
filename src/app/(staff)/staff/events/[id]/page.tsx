import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { getEventForEdit, listRooms } from "@/lib/calendar/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { EventEditForm } from "./_components/event-edit-form";
import { PublishEventButton } from "./_components/publish-event-button";

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

export default async function StaffEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, locale] = await Promise.all([requirePermission("event:create"), getLocale()]);
  const t = (key: string) => translate(ui, key, locale);

  const ev = await getEventForEdit(id);
  if (!ev) notFound();

  const canView =
    user.roles.includes("admin") ||
    ev.organizerUserId === user.id ||
    (ev.deptId !== null && user.deptIds.includes(ev.deptId));
  if (!canView) notFound();

  const rooms = await listRooms();
  const roomName = ev.roomId ? (rooms.find((r) => r.id === ev.roomId)?.name ?? null) : null;

  const canPublish =
    ev.status === "pending_review" && hasPermission(user, "event:override_conflict");
  const canEdit = hasPermission(user, "event:edit");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/staff/events" className={buttonClasses({ variant: "ghost", size: "sm" })}>
        {t("event.backToEvents")}
      </Link>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{ev.title}</h1>
        <Badge variant={STATUS_VARIANTS[ev.status]}>{t(STATUS_KEYS[ev.status])}</Badge>
      </div>

      <dl className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.dateTime")}</dt>
          <dd className="text-card-foreground">
            {formatDateTime(ev.startAt, locale)}
            {" — "}
            {formatDateTime(ev.endAt, locale)}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.room")}</dt>
          <dd className="text-card-foreground">{roomName ?? t("event.noRoom")}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.priority")}</dt>
          <dd className="text-card-foreground">
            {ev.priority === "exam" ? t("event.priorityExam") : t("event.priorityNormal")}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.recurrence")}</dt>
          <dd className="text-card-foreground">{ev.rrule ?? t("event.recurrenceNone")}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.audience")}</dt>
          <dd className="text-card-foreground">
            {ev.audiences.length === 0
              ? "—"
              : ev.audiences
                  .map((a) => (a.type === "public" ? t("event.audiencePublic") : a.ref))
                  .join(", ")}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="font-medium text-muted-foreground">{t("event.description")}</dt>
          <dd className="text-card-foreground">{ev.description ?? t("event.noDescription")}</dd>
        </div>
      </dl>

      {canPublish ? (
        <section className="mt-8">
          <p className="mb-3 text-sm text-muted-foreground">{t("event.publishHint")}</p>
          <PublishEventButton id={ev.id} locale={locale} />
        </section>
      ) : null}

      {canEdit ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">{t("event.editDetails")}</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("event.editHint")}</p>
          <EventEditForm id={ev.id} title={ev.title} description={ev.description} locale={locale} />
        </section>
      ) : null}
    </main>
  );
}
