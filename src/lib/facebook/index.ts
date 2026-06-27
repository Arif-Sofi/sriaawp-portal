import type { FacebookClient } from "./client";
import { MockFacebookClient } from "./mock-client";
import { RealFacebookClient } from "./real-client";

export type {
  FacebookClient,
  FacebookClientHealth,
  FacebookPost,
  PublishPostInput,
  PublishPostResult,
} from "./client";
export { MockFacebookClient } from "./mock-client";
export { RealFacebookClient } from "./real-client";

/**
 * DEFERRED — inbound (Facebook -> portal) is NOT implemented in #85 (ADR-022). If it is ever built,
 * it ingests as an Admin-moderated DRAFT (never auto-publish) via polling, not webhooks, and writes
 * under a synthetic `facebook-sync` SERVICE PRINCIPAL holding a single narrow `news:ingest_draft`
 * permission. That principal is subject to app-layer permission checks like any other principal and
 * does NOT bypass the app layer (ADR-002). Documented here so the principal model is not reinvented;
 * no inbound code path, `facebook-sync` user, or `news:ingest_draft` permission exists yet.
 */

/**
 * getFacebookClient selects the implementation by the FACEBOOK_CLIENT env var.
 * Default is "mock" (mock-first per ADR-022): development and CI never call the real
 * Graph API, and "real" is a production turn-on step that fails loudly until the
 * RealFacebookClient stub is fleshed out behind the school's owned Meta app.
 */
export const getFacebookClient = (): FacebookClient => {
  const selected = process.env.FACEBOOK_CLIENT ?? "mock";
  if (selected === "real") return new RealFacebookClient();
  return new MockFacebookClient();
};
