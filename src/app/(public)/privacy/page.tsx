import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";

const SECTIONS = [
  { titleKey: "privacy.collectTitle", bodyKey: "privacy.collectBody" },
  { titleKey: "privacy.consentTitle", bodyKey: "privacy.consentBody" },
  { titleKey: "privacy.retentionTitle", bodyKey: "privacy.retentionBody" },
  { titleKey: "privacy.contactTitle", bodyKey: "privacy.contactBody" },
] as const;

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="mb-6 rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
        {locale === "ms" ? "Draf — belum muktamad." : "Draft — not yet finalised."}
      </p>

      <h1 className="mb-2 text-2xl font-semibold">{t("privacy.title")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t("privacy.intro")}</p>

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section) => (
          <Card key={section.titleKey}>
            <CardHeader>
              <CardTitle className="text-base">{t(section.titleKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t(section.bodyKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
