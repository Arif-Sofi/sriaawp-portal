import { forbidden, notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { viewChildForParent } from "@/lib/family/queries";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, requireUser } from "@/lib/rbac";

import { RecordView } from "./_components/record-view";

type Props = {
  params: Promise<{ studentId: string }>;
};

export default async function ChildDetailPage({ params }: Props) {
  const { studentId } = await params;
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") redirect("/parent/dashboard");
  if (!hasPermission(user, "user:read:self")) forbidden();

  const child = await viewChildForParent({ parentUserId: user.id, studentUserId: studentId });
  if (!child) notFound();

  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  const dateLabel = child.dob
    ? new Date(child.dob).toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB")
    : null;

  return (
    <div className="py-6">
      <RecordView studentUserId={studentId} />
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold text-card-foreground">
              {child.name ?? child.studentNo}
            </h1>
            <Badge variant="neutral">{child.relationship}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("parent.childStudentNo")}</dt>
              <dd className="font-medium text-foreground">{child.studentNo}</dd>
            </div>
            {child.classLabel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("parent.childClass")}</dt>
                <dd className="font-medium text-foreground">{child.classLabel}</dd>
              </div>
            ) : null}
            {child.yearOfEntry ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("parent.childYearOfEntry")}</dt>
                <dd className="font-medium text-foreground">{child.yearOfEntry}</dd>
              </div>
            ) : null}
            {dateLabel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("parent.childDob")}</dt>
                <dd className="font-medium text-foreground">{dateLabel}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("parent.childRelationship")}</dt>
              <dd className="font-medium text-foreground">{child.relationship}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
