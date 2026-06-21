import { notFound } from "next/navigation";

import { ArticleAssistant } from "@/components/ai/article-assistant";
import { getVisibleNewsBySlug } from "@/lib/content/queries";
import {
  getReactionState,
  listCommentsForNews,
  studentCommentsAllowed,
} from "@/lib/engagement/queries";
import { auth } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { hasPermission, type AuthedUser } from "@/lib/rbac";

import { NewsEngagement, type EngagementViewer } from "./_components/news-engagement";

const STUDENT_ROLE = "student" as const;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const session = await auth();
  const user = session?.user ?? null;

  const article = await getVisibleNewsBySlug(slug, user);
  if (!article) notFound();

  const canAskAssistant = Boolean(user) && !user!.roles.every((role) => role === STUDENT_ROLE);

  const [reaction, comments] = await Promise.all([
    getReactionState(article.id, user),
    listCommentsForNews(article.id, user),
  ]);

  const viewer = await resolveViewer(user, article.deptId);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">{article.title}</h1>
      {article.publishedAt ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(article.publishedAt).toLocaleDateString(locale === "ms" ? "ms-MY" : "en-GB")}
        </p>
      ) : null}
      <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-foreground">
        {article.body}
      </div>
      {canAskAssistant ? (
        <div className="mt-10">
          <ArticleAssistant newsId={article.id} locale={locale} />
        </div>
      ) : null}

      <NewsEngagement
        newsId={article.id}
        locale={locale}
        reaction={reaction ?? { count: 0, reactedByCaller: false }}
        comments={comments}
        viewer={viewer}
      />
    </article>
  );
}

async function resolveViewer(
  user: AuthedUser | null,
  deptId: string | null,
): Promise<EngagementViewer> {
  if (!user) {
    return {
      canReact: false,
      canComment: false,
      canModerate: false,
      canReport: false,
      userId: null,
      pendingNotice: false,
    };
  }

  const isStudent = user.roles.includes(STUDENT_ROLE);
  const isActive = user.status === "ACTIVE";
  const studentAllowed = isStudent ? await studentCommentsAllowed() : true;
  const canWrite = isActive && studentAllowed;

  const canModerate =
    deptId === null
      ? hasPermission(user, "news:comment:moderate")
      : hasPermission(user, "news:comment:moderate", { deptId });

  return {
    canReact: canWrite && hasPermission(user, "news:react"),
    canComment: canWrite && hasPermission(user, "news:comment"),
    canModerate,
    canReport: isActive && hasPermission(user, "news:comment:report"),
    userId: user.id,
    pendingNotice: !isActive,
  };
}
