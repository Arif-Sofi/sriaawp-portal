import { departments as departmentsTable } from "@/db/schema";
import { ROLES } from "@/db/seed/catalogue";
import { db } from "@/lib/db";
import { listRooms } from "@/lib/calendar/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { EventForm } from "../_components/event-form";

export default async function NewEventPage() {
  const [user, locale] = await Promise.all([requirePermission("event:create"), getLocale()]);

  const [rooms, deptRows] = await Promise.all([
    listRooms(),
    db
      .select({ id: departmentsTable.id, name: departmentsTable.name, code: departmentsTable.code })
      .from(departmentsTable),
  ]);

  const canOverride = hasPermission(user, "event:override_conflict");
  const roleOptions = ROLES.map((r) => r.code);
  const t = (key: string) => translate(ui, key, locale);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-foreground">{t("event.createNew")}</h1>
      <EventForm
        callerId={user.id}
        callerDeptIds={user.deptIds}
        canOverride={canOverride}
        locale={locale}
        rooms={rooms}
        roles={roleOptions}
        departments={deptRows}
      />
    </main>
  );
}
