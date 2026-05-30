import Link from "next/link";
import { forbidden, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PortalSection } from "@/components/portal/portal-section";
import { listChildrenForParent } from "@/lib/family/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requireUser } from "@/lib/rbac";

export default async function ParentChildrenPage() {
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") redirect("/parent/dashboard");
  if (!hasPermission(user, "user:read:self")) forbidden();

  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const children = await listChildrenForParent(user.id);

  return (
    <div className="py-6">
      <PortalSection title={t("parent.childrenTitle")}>
        {children.length === 0 ? (
          <EmptyState
            title={t("parent.emptyChildren")}
            description={t("parent.emptyChildrenDesc")}
          />
        ) : (
          <ul className="divide-y divide-border">
            {children.map((child) => (
              <li key={child.studentUserId} className="py-4">
                <Link
                  href={`/parent/children/${child.studentUserId}`}
                  className="flex items-center justify-between gap-4 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {child.name ?? child.studentNo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("parent.childStudentNo")}: {child.studentNo}
                    </p>
                    {child.classLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {t("parent.childClass")}: {child.classLabel}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="neutral">{child.relationship}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
}
