/**
 * FacebookClient — the portal's own abstraction over the Meta Graph API for the
 * one-way OUTBOUND news -> Facebook Page sync (ADR-022).
 *
 * This interface is the reversibility boundary: the real Graph API request/response
 * shapes (the `POST /{page-id}/feed` body, the `{ id }` payload, error envelopes,
 * token plumbing) must NEVER leak past this module. Callers (the #85 outbound worker)
 * depend only on these methods, so the real adapter can be swapped in behind the
 * FACEBOOK_CLIENT env flag without touching a single call site.
 *
 * v1 scope is one-way outbound only — a public news record published to the school's
 * Page. Inbound is a deferred Could (poll -> Admin-moderated draft) and is NOT part of
 * this interface.
 */

export type PublishPostInput = {
  message: string;
  link: string;
  imageUrl?: string;
};

/**
 * The portal-facing result of an outbound publish. `objectId` is the Facebook post id
 * the worker persists as `fb_object_id` in `fb_sync_link` for idempotency and
 * loop-prevention (ADR-022).
 */
export type PublishPostResult = {
  objectId: string;
};

export type FacebookPost = {
  objectId: string;
  message: string;
  link: string;
  imageUrl: string | null;
};

export type FacebookClientHealth = {
  ok: boolean;
  client: "mock" | "real";
};

export interface FacebookClient {
  publishPost(input: PublishPostInput): Promise<PublishPostResult>;
  getPost(objectId: string): Promise<FacebookPost | null>;
  health(): Promise<FacebookClientHealth>;
}
