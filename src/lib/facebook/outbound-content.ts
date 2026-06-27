import { createHash } from "node:crypto";

// The defined outbound subset (ADR-022 / R-15): title, body excerpt, the canonical portal link,
// and the primary image. Rich portal-only fields (visibility, role lists, attachments) are NEVER
// serialised outbound, so they cannot leak to a public Page and do not perturb the hash.
export type OutboundNews = {
  title: string;
  excerpt: string | null;
  body: string;
  slug: string;
  imageUrl?: string | null;
};

const MAX_MESSAGE_LENGTH = 600;

export const canonicalNewsLink = (slug: string): string => `/news/${slug}`;

const outboundMessage = (article: OutboundNews): string => {
  const summary = article.excerpt?.trim() ? article.excerpt.trim() : article.body.trim();
  const truncated =
    summary.length > MAX_MESSAGE_LENGTH ? `${summary.slice(0, MAX_MESSAGE_LENGTH)}...` : summary;
  return `${article.title.trim()}\n\n${truncated}`;
};

// The mapped payload the FacebookClient publishes. Keeping this separate from the hash keeps the
// "what crosses" decision in one place (mapping) and the "did it change" decision in another (hash).
export const mapOutboundPost = (
  article: OutboundNews,
): { message: string; link: string; imageUrl?: string } => {
  const imageUrl = article.imageUrl?.trim();
  return {
    message: outboundMessage(article),
    link: canonicalNewsLink(article.slug),
    ...(imageUrl ? { imageUrl } : {}),
  };
};

// content_hash drives dedup + edit-detection (ADR-022): re-enqueue only re-pushes when the hash
// changes, and it is the idempotency key so a retry of the SAME content never double-posts. It is
// computed over the mapped outbound subset, so a portal-only edit (e.g. visibility) does not churn.
export const computeContentHash = (article: OutboundNews): string => {
  const post = mapOutboundPost(article);
  const canonical = JSON.stringify({
    message: post.message,
    link: post.link,
    imageUrl: post.imageUrl ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
};
