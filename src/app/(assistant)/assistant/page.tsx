import { forbidden } from "next/navigation";

import { AssistantChat } from "@/components/ai/assistant-chat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/rbac";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";

const STUDENT_ROLE = "student" as const;

export default async function AssistantPage() {
  const user = await requireUser();
  if (user.roles.every((role) => role === STUDENT_ROLE)) forbidden();

  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{t("assistant.title")}</CardTitle>
          <CardDescription>{t("assistant.newsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssistantChat mode="get_news" locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
