import { EmptyState } from "@/components/ui/empty-state";
import { PortalSection } from "@/components/portal/portal-section";
import { translate } from "@/lib/i18n";
import { ui } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";

export default async function TakwimPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(ui, key, locale);

  return (
    <div className="py-6">
      <PortalSection title={t("section.takwim")}>
        <EmptyState title={t("empty.comingSoon")} description={t("empty.comingSoonDesc")} />
      </PortalSection>
    </div>
  );
}
