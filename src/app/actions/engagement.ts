"use server";

import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { appSetting, news, newsComment, newsReaction, notification } from "@/db/schema";
import { getVisibleNewsById } from "@/lib/content/queries";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";
import { hasPermission, requirePermission } from "@/lib/rbac";
import type { AuthedUser } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

const STUDENT_ROLE = "student" as const;
const COMMENT_RATE_LIMIT_SECONDS = 15;
const MAX_COMMENT_LENGTH = 4000;

type VisibleNews = NonNullable<Awaited<ReturnType<typeof getVisibleNewsById>>>;

function revalidateNews(slug: string): void {
  revalidatePath(`/news/${slug}`);
}

function isStudent(user: Pick<AuthedUser, "roles">): boolean {
  return user.roles.includes(STUDENT_ROLE);
}

// A PENDING_VERIFICATION parent HOLDS the engagement permissions (ADR-011) but cannot exercise
// them. This is an account-status precondition at the call site, not a separate permission code.
function requireActive(user: Pick<AuthedUser, "status">): ActionResult<never> | null {
  if (user.status !== "ACTIVE") {
    return fail("Your account is pending verification and cannot post or react", {
      code: "NOT_ACTIVE",
    });
  }
  return null;
}

async function studentCommentsAllowed(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, "allow_student_comments"))
    .limit(1);
  return row?.value === true;
}

// Students may write ONLY when the admin toggle is on (resolved #87). Default OFF.
async function requireStudentToggle(
  user: Pick<AuthedUser, "roles">,
): Promise<ActionResult<never> | null> {
  if (!isStudent(user)) return null;
  const allowed = await studentCommentsAllowed();
  if (allowed) return null;
  return fail("Student commenting is not enabled", { code: "STUDENT_DISABLED" });
}

// Resolves the parent news through the SAME visibility predicate the read path uses, so a caller
// who cannot see the news can neither react nor comment on it.
async function loadVisibleNews(
  newsId: string,
  user: AuthedUser,
): Promise<VisibleNews | ActionResult<never>> {
  const article = await getVisibleNewsById(newsId, user);
  if (!article) return fail("News post not found", { code: "NOT_FOUND" });
  return article;
}

function isActionResult(value: unknown): value is ActionResult<never> {
  return typeof value === "object" && value !== null && "ok" in value;
}

async function enforceWritePreconditions(user: AuthedUser): Promise<ActionResult<never> | null> {
  const active = requireActive(user);
  if (active) return active;
  const studentGate = await requireStudentToggle(user);
  if (studentGate) return studentGate;
  return null;
}

async function withinRateLimit(authorUserId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - COMMENT_RATE_LIMIT_SECONDS * 1000);
  const [recent] = await db
    .select({ id: newsComment.id })
    .from(newsComment)
    .where(and(eq(newsComment.authorUserId, authorUserId), gt(newsComment.createdAt, cutoff)))
    .limit(1);
  return !recent;
}

export async function toggleReaction(newsId: string): Promise<ActionResult<{ reacted: boolean }>> {
  const user = await requirePermission("news:react");
  const precondition = await enforceWritePreconditions(user);
  if (precondition) return precondition;

  const article = await loadVisibleNews(newsId, user);
  if (isActionResult(article)) return article;

  const [existing] = await db
    .select({ id: newsReaction.id })
    .from(newsReaction)
    .where(
      and(
        eq(newsReaction.newsId, newsId),
        eq(newsReaction.userId, user.id),
        eq(newsReaction.reactionType, "like"),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(newsReaction).where(eq(newsReaction.id, existing.id));
    await writeAudit({
      actorUserId: user.id,
      action: "news_reaction.unreact",
      resourceType: "news_reaction",
      resourceId: existing.id,
      metadata: { newsId },
    });
    revalidateNews(article.slug);
    return ok({ reacted: false });
  }

  const [row] = await db
    .insert(newsReaction)
    .values({ newsId, userId: user.id, reactionType: "like" })
    .onConflictDoNothing()
    .returning({ id: newsReaction.id });

  await writeAudit({
    actorUserId: user.id,
    action: "news_reaction.react",
    resourceType: "news_reaction",
    resourceId: row?.id ?? null,
    metadata: { newsId },
  });
  revalidateNews(article.slug);
  return ok({ reacted: true });
}

export async function postComment(
  newsId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment");
  const precondition = await enforceWritePreconditions(user);
  if (precondition) return precondition;

  const trimmed = body.trim();
  if (!trimmed) return fail("Comment cannot be empty", { fieldErrors: { body: "Required" } });
  if (trimmed.length > MAX_COMMENT_LENGTH) return fail("Comment is too long");

  const article = await loadVisibleNews(newsId, user);
  if (isActionResult(article)) return article;

  if (!(await withinRateLimit(user.id))) {
    return fail("You are commenting too quickly. Please wait a moment.", {
      code: "RATE_LIMITED",
    });
  }

  const [row] = await db
    .insert(newsComment)
    .values({ newsId, parentCommentId: null, authorUserId: user.id, body: trimmed })
    .returning({ id: newsComment.id });

  await writeAudit({
    actorUserId: user.id,
    action: "news_comment.create",
    resourceType: "news_comment",
    resourceId: row.id,
    metadata: { newsId },
  });

  await notifyAuthorOfQuestion(article, row.id, user.id);
  revalidateNews(article.slug);
  return ok({ id: row.id });
}

export async function replyComment(
  newsId: string,
  parentCommentId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment");
  const precondition = await enforceWritePreconditions(user);
  if (precondition) return precondition;

  const trimmed = body.trim();
  if (!trimmed) return fail("Reply cannot be empty", { fieldErrors: { body: "Required" } });
  if (trimmed.length > MAX_COMMENT_LENGTH) return fail("Reply is too long");

  const article = await loadVisibleNews(newsId, user);
  if (isActionResult(article)) return article;

  const [parent] = await db
    .select({
      id: newsComment.id,
      authorUserId: newsComment.authorUserId,
      newsId: newsComment.newsId,
    })
    .from(newsComment)
    .where(eq(newsComment.id, parentCommentId))
    .limit(1);
  if (!parent || parent.newsId !== newsId) {
    return fail("Parent comment not found", { code: "NOT_FOUND" });
  }

  if (!(await withinRateLimit(user.id))) {
    return fail("You are commenting too quickly. Please wait a moment.", {
      code: "RATE_LIMITED",
    });
  }

  try {
    const [row] = await db
      .insert(newsComment)
      .values({ newsId, parentCommentId, authorUserId: user.id, body: trimmed })
      .returning({ id: newsComment.id });

    await writeAudit({
      actorUserId: user.id,
      action: "news_comment.reply",
      resourceType: "news_comment",
      resourceId: row.id,
      metadata: { newsId, parentCommentId },
    });

    await notifyParentOfAnswer(parent.authorUserId, row.id, user.id);
    revalidateNews(article.slug);
    return ok({ id: row.id });
  } catch (error) {
    if (isOneLevelViolation(error)) {
      return fail("Replies can only be one level deep", { code: "NESTING" });
    }
    throw error;
  }
}

export async function editOwnComment(
  commentId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment:edit_own");

  const trimmed = body.trim();
  if (!trimmed) return fail("Comment cannot be empty", { fieldErrors: { body: "Required" } });
  if (trimmed.length > MAX_COMMENT_LENGTH) return fail("Comment is too long");

  const comment = await loadOwnedComment(commentId, user);
  if (isActionResult(comment)) return comment;

  await db
    .update(newsComment)
    .set({ body: trimmed, updatedAt: new Date() })
    .where(eq(newsComment.id, commentId));

  await writeAudit({
    actorUserId: user.id,
    action: "news_comment.edit",
    resourceType: "news_comment",
    resourceId: commentId,
    metadata: { newsId: comment.newsId },
  });
  revalidateNews(comment.slug);
  return ok({ id: commentId });
}

export async function softDeleteOwnComment(
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment:delete_own");

  const comment = await loadOwnedComment(commentId, user);
  if (isActionResult(comment)) return comment;

  await db
    .update(newsComment)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(newsComment.id, commentId));

  await writeAudit({
    actorUserId: user.id,
    action: "news_comment.soft_delete",
    resourceType: "news_comment",
    resourceId: commentId,
    metadata: { newsId: comment.newsId },
  });
  revalidateNews(comment.slug);
  return ok({ id: commentId });
}

export async function reportComment(commentId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment:report");

  const comment = await loadCommentWithNews(commentId, user);
  if (isActionResult(comment)) return comment;

  await writeAudit({
    actorUserId: user.id,
    action: "news_comment.report",
    resourceType: "news_comment",
    resourceId: commentId,
    metadata: { newsId: comment.newsId },
  });
  revalidateNews(comment.slug);
  return ok({ id: commentId });
}

export async function moderateComment(
  commentId: string,
  status: "hidden" | "deleted",
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("news:comment:moderate");

  const comment = await loadCommentWithNews(commentId, user);
  if (isActionResult(comment)) return comment;

  // Teacher moderation is DEPARTMENT-SCOPED: a teacher may moderate only where their dept covers
  // the news item's authoring department. Admin (no dept scope) passes the global check above.
  const deptId = comment.deptId;
  const scopedAllowed =
    deptId === null
      ? hasPermission(user, "news:comment:moderate")
      : hasPermission(user, "news:comment:moderate", { deptId });
  if (!scopedAllowed) {
    return fail("You can only moderate comments in your department", { code: "FORBIDDEN" });
  }

  await db
    .update(newsComment)
    .set({ status, updatedAt: new Date() })
    .where(eq(newsComment.id, commentId));

  await writeAudit({
    actorUserId: user.id,
    action: "news_comment.moderate",
    resourceType: "news_comment",
    resourceId: commentId,
    metadata: { newsId: comment.newsId, status },
  });
  revalidateNews(comment.slug);
  return ok({ id: commentId });
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("user:read:self");

  const [row] = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, notificationId), eq(notification.recipientUserId, user.id)))
    .returning({ id: notification.id });
  if (!row) return fail("Notification not found", { code: "NOT_FOUND" });

  revalidatePath("/notifications");
  return ok({ id: row.id });
}

type CommentWithNews = { id: string; newsId: string; slug: string; deptId: string | null };
type OwnedComment = CommentWithNews;

async function loadCommentWithNews(
  commentId: string,
  user: AuthedUser,
): Promise<CommentWithNews | ActionResult<never>> {
  const [row] = await db
    .select({
      id: newsComment.id,
      newsId: newsComment.newsId,
      slug: news.slug,
      deptId: news.deptId,
    })
    .from(newsComment)
    .innerJoin(news, eq(news.id, newsComment.newsId))
    .where(eq(newsComment.id, commentId))
    .limit(1);
  if (!row) return fail("Comment not found", { code: "NOT_FOUND" });

  const visible = await getVisibleNewsById(row.newsId, user);
  if (!visible) return fail("Comment not found", { code: "NOT_FOUND" });
  return row;
}

async function loadOwnedComment(
  commentId: string,
  user: AuthedUser,
): Promise<OwnedComment | ActionResult<never>> {
  const [row] = await db
    .select({
      id: newsComment.id,
      newsId: newsComment.newsId,
      slug: news.slug,
      deptId: news.deptId,
      authorUserId: newsComment.authorUserId,
    })
    .from(newsComment)
    .innerJoin(news, eq(news.id, newsComment.newsId))
    .where(eq(newsComment.id, commentId))
    .limit(1);
  if (!row) return fail("Comment not found", { code: "NOT_FOUND" });
  if (row.authorUserId !== user.id) {
    return fail("You can only modify your own comment", { code: "FORBIDDEN" });
  }
  return row;
}

async function notifyAuthorOfQuestion(
  article: VisibleNews,
  commentId: string,
  askerUserId: string,
): Promise<void> {
  if (article.authorUserId === askerUserId) return;
  await db.insert(notification).values({
    recipientUserId: article.authorUserId,
    type: "news_comment_received",
    resourceType: "news_comment",
    resourceId: commentId,
  });
}

async function notifyParentOfAnswer(
  parentAuthorUserId: string | null,
  commentId: string,
  answererUserId: string,
): Promise<void> {
  if (!parentAuthorUserId) return;
  if (parentAuthorUserId === answererUserId) return;
  await db.insert(notification).values({
    recipientUserId: parentAuthorUserId,
    type: "news_comment_answered",
    resourceType: "news_comment",
    resourceId: commentId,
  });
}

// The one-level trigger (migration 0009) raises with ERRCODE check_violation (23514) and a
// message naming the reply-level rule; surface it as a clean fail rather than a 500.
function isOneLevelViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return code === "23514" && message.toLowerCase().includes("one reply level");
}
