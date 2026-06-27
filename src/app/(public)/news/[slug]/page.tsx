import { notFound } from "next/navigation";

import { ArticleAssistant } from "@/components/ai/article-assistant";
import { getVisibleNewsBySlug } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/rbac";
import { getLocale } from "@/lib/i18n/server";

const STUDENT_ROLE = "student" as const;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const user = await getCurrentUser();

  const article = await getVisibleNewsBySlug(slug, user);
  if (!article) notFound();

  const canAskAssistant = Boolean(user) && !user!.roles.every((role) => role === STUDENT_ROLE);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">{article.title}</h1>
      {article.publishedAt ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(article.publishedAt).toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB")}
        </p>
      ) : null}
      <div className="mt-8 prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
        {article.body}
      </div>
      {canAskAssistant ? (
        <div className="mt-10">
          <ArticleAssistant newsId={article.id} locale={locale} />
        </div>
      ) : null}
    </article>
  );
}
