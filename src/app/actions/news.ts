"use server";

import { eq } from "drizzle-orm";

import { news } from "@/db/schema";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/pdpa/audit";
import { requirePermission } from "@/lib/rbac";
import { fail, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

type NewsInput = {
  title: string;
  body: string;
  slug?: string;
  excerpt?: string;
  visibility?: "public" | "internal" | "role_list";
  visibilityRoles?: string[];
  deptId?: string;
};

type NewsRow = typeof news.$inferSelect;

export async function createNews(input: NewsInput): Promise<ActionResult<NewsRow>> {
  const user = await requirePermission("news:author");

  if (!input.title.trim()) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }
  if (!input.body.trim()) {
    return fail("Body is required", { fieldErrors: { body: "Body is required" } });
  }

  const slug = input.slug?.trim() || slugify(input.title);

  try {
    const [row] = await db
      .insert(news)
      .values({
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt?.trim() ?? null,
        body: input.body.trim(),
        visibility: input.visibility ?? "public",
        visibilityRoles: input.visibilityRoles ?? null,
        deptId: input.deptId ?? null,
        authorUserId: user.id,
      })
      .returning();

    await writeAudit({
      actorUserId: user.id,
      action: "news.create",
      resourceType: "news",
      resourceId: row.id,
    });

    return ok(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("A post with this slug already exists", {
        fieldErrors: { slug: "Slug already in use" },
      });
    }
    throw error;
  }
}

export async function updateNews(
  id: string,
  input: Partial<NewsInput>,
): Promise<ActionResult<NewsRow>> {
  const user = await requirePermission("news:author");

  if (input.title !== undefined && !input.title.trim()) {
    return fail("Title is required", { fieldErrors: { title: "Title is required" } });
  }
  if (input.body !== undefined && !input.body.trim()) {
    return fail("Body is required", { fieldErrors: { body: "Body is required" } });
  }

  const updates: Partial<typeof news.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.body !== undefined) updates.body = input.body.trim();
  if (input.slug !== undefined) updates.slug = input.slug.trim();
  if (input.excerpt !== undefined) updates.excerpt = input.excerpt.trim();
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.visibilityRoles !== undefined) updates.visibilityRoles = input.visibilityRoles;
  if (input.deptId !== undefined) updates.deptId = input.deptId;
  updates.updatedAt = new Date();

  try {
    const [row] = await db.update(news).set(updates).where(eq(news.id, id)).returning();
    if (!row) return fail("News post not found", { code: "NOT_FOUND" });

    await writeAudit({
      actorUserId: user.id,
      action: "news.update",
      resourceType: "news",
      resourceId: id,
    });

    return ok(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("A post with this slug already exists", {
        fieldErrors: { slug: "Slug already in use" },
      });
    }
    throw error;
  }
}

export async function publishNews(id: string): Promise<ActionResult<NewsRow>> {
  const user = await requirePermission("news:author");

  const [row] = await db
    .update(news)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(news.id, id))
    .returning();
  if (!row) return fail("News post not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "news.publish",
    resourceType: "news",
    resourceId: id,
  });

  return ok(row);
}

export async function deleteNews(id: string): Promise<ActionResult<void>> {
  const user = await requirePermission("news:author");

  const [row] = await db.delete(news).where(eq(news.id, id)).returning({ id: news.id });
  if (!row) return fail("News post not found", { code: "NOT_FOUND" });

  await writeAudit({
    actorUserId: user.id,
    action: "news.delete",
    resourceType: "news",
    resourceId: id,
  });

  return ok(undefined);
}
