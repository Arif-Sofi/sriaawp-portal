import { EmptyState } from "@/components/ui/empty-state";
import { listNotifications } from "@/lib/engagement/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/rbac";

import { NotificationItem } from "./notification-item";

export default async function NotificationsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const notifications = await listNotifications(user);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">{t("engagement.notifications")}</h1>

      {notifications.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("engagement.noNotifications")}
            description={t("engagement.noNotificationsDesc")}
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border">
          {notifications.map((item) => (
            <NotificationItem key={item.id} notification={item} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}
