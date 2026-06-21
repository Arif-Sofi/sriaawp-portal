import { and, arrayOverlaps, desc, eq, isNotNull, or } from "drizzle-orm";

import { memo, news } from "@/db/schema";
import { db } from "@/lib/db";
import type { AuthedUser } from "@/lib/rbac";

export async function listPublishedPublicNews() {
  return db
    .select()
    .from(news)
    .where(and(eq(news.visibility, "public"), isNotNull(news.publishedAt)))
    .orderBy(desc(news.publishedAt));
}

export async function listVisibleNews(user: Pick<AuthedUser, "roles">) {
  return db
    .select()
    .from(news)
    .where(
      and(
        isNotNull(news.publishedAt),
        or(
          eq(news.visibility, "public"),
          eq(news.visibility, "internal"),
          and(eq(news.visibility, "role_list"), arrayOverlaps(news.visibilityRoles, user.roles)),
        ),
      ),
    )
    .orderBy(desc(news.publishedAt));
}

export async function getVisibleNewsBySlug(slug: string, user: Pick<AuthedUser, "roles"> | null) {
  const [row] = await db.select().from(news).where(eq(news.slug, slug)).limit(1);
  if (!row) return null;
  if (!row.publishedAt) return null;

  if (row.visibility === "public") return row;
  if (!user) return null;

  if (row.visibility === "internal") return row;

  const hasMatchingRole = row.visibilityRoles?.some((r) => (user.roles as string[]).includes(r));
  return hasMatchingRole ? row : null;
}

export async function getVisibleNewsById(id: string, user: Pick<AuthedUser, "roles"> | null) {
  const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
  if (!row) return null;
  if (!row.publishedAt) return null;

  if (row.visibility === "public") return row;
  if (!user) return null;

  if (row.visibility === "internal") return row;

  const hasMatchingRole = row.visibilityRoles?.some((r) => (user.roles as string[]).includes(r));
  return hasMatchingRole ? row : null;
}

export async function listAllNews() {
  return db.select().from(news).orderBy(desc(news.updatedAt));
}

export async function listVisibleMemos(user: Pick<AuthedUser, "roles">) {
  return db
    .select()
    .from(memo)
    .where(
      and(
        isNotNull(memo.publishedAt),
        or(
          eq(memo.visibility, "internal"),
          and(eq(memo.visibility, "role_list"), arrayOverlaps(memo.visibilityRoles, user.roles)),
        ),
      ),
    )
    .orderBy(desc(memo.pinned), desc(memo.publishedAt));
}

export async function listAllMemos() {
  return db.select().from(memo).orderBy(desc(memo.updatedAt));
}
