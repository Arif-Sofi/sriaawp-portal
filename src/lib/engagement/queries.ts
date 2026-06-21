import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { appSetting, newsComment, newsReaction, notification, users } from "@/db/schema";
import { getVisibleNewsById } from "@/lib/content/queries";
import { db } from "@/lib/db";
import type { AuthedUser } from "@/lib/rbac";

type VisibilityUser = Pick<AuthedUser, "roles"> | null;

export type CommentReply = {
  id: string;
  body: string;
  status: "visible" | "hidden" | "deleted";
  authorUserId: string | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentThread = CommentReply & {
  replies: CommentReply[];
};

export type ReactionState = {
  count: number;
  reactedByCaller: boolean;
};

function toReply(row: {
  id: string;
  body: string;
  status: "visible" | "hidden" | "deleted";
  authorUserId: string | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommentReply {
  return {
    id: row.id,
    body: row.body,
    status: row.status,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Read access INHERITS the parent news item's visibility (ADR-021 / ADR-010): a caller who
// cannot see the news must see neither its comments nor its reaction counts. We resolve that
// bound by delegating to getVisibleNewsById rather than re-deriving the predicate here.
export async function listCommentsForNews(
  newsId: string,
  user: VisibilityUser,
): Promise<CommentThread[]> {
  const article = await getVisibleNewsById(newsId, user);
  if (!article) return [];

  const rows = await db
    .select({
      id: newsComment.id,
      parentCommentId: newsComment.parentCommentId,
      body: newsComment.body,
      status: newsComment.status,
      authorUserId: newsComment.authorUserId,
      authorName: users.name,
      createdAt: newsComment.createdAt,
      updatedAt: newsComment.updatedAt,
    })
    .from(newsComment)
    .leftJoin(users, eq(users.id, newsComment.authorUserId))
    .where(eq(newsComment.newsId, newsId))
    .orderBy(asc(newsComment.createdAt));

  const topLevel = rows.filter((row) => row.parentCommentId === null);
  const repliesByParent = new Map<string, CommentReply[]>();
  for (const row of rows) {
    if (row.parentCommentId === null) continue;
    const existing = repliesByParent.get(row.parentCommentId) ?? [];
    repliesByParent.set(row.parentCommentId, [...existing, toReply(row)]);
  }

  return topLevel.map((row) => ({
    ...toReply(row),
    replies: repliesByParent.get(row.id) ?? [],
  }));
}

export async function getReactionState(
  newsId: string,
  user: VisibilityUser,
): Promise<ReactionState | null> {
  const article = await getVisibleNewsById(newsId, user);
  if (!article) return null;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(newsReaction)
    .where(eq(newsReaction.newsId, newsId));

  const callerId = (user as { id?: string } | null)?.id ?? null;
  const reactedByCaller = callerId === null ? false : await callerHasReacted(newsId, callerId);

  return { count: Number(total), reactedByCaller };
}

async function callerHasReacted(newsId: string, callerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: newsReaction.id })
    .from(newsReaction)
    .where(
      and(
        eq(newsReaction.newsId, newsId),
        eq(newsReaction.userId, callerId),
        eq(newsReaction.reactionType, "like"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function studentCommentsAllowed(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSetting.value })
    .from(appSetting)
    .where(eq(appSetting.key, "allow_student_comments"))
    .limit(1);
  return row?.value === true;
}

export type NotificationRow = {
  id: string;
  type: "news_comment_received" | "news_comment_answered";
  resourceType: string;
  resourceId: string;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(user: Pick<AuthedUser, "id">): Promise<NotificationRow[]> {
  return db
    .select({
      id: notification.id,
      type: notification.type,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .where(eq(notification.recipientUserId, user.id))
    .orderBy(desc(notification.createdAt));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.recipientUserId, userId), isNull(notification.readAt)));
  return Number(value);
}
