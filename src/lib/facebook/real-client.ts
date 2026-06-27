import type {
  FacebookClient,
  FacebookClientHealth,
  FacebookPost,
  PublishPostInput,
  PublishPostResult,
} from "./client";

/**
 * RealFacebookClient — the production turn-on slot for the Meta Graph API (ADR-022).
 *
 * Deliberately a throwing stub this phase: there is no Meta account, no App Review, and
 * no school Business Verification yet (the dominant feasibility risk R-13). Building the
 * real adapter is a production turn-on step gated behind FACEBOOK_CLIENT=real, which must
 * not be set until the school owns the Meta app and the spike's go-with-conditions are met.
 *
 * TURN-ON wiring (do NOT enable until ADR-022's external dependencies are satisfied):
 *   - Read the long-lived PAGE access token, decrypted from the pgcrypto-encrypted column
 *     (ADR-008/ADR-016) — never plaintext .env.
 *   - publishPost issues, against the school's Page id:
 *
 *       POST https://graph.facebook.com/v23.0/{page-id}/feed
 *       Authorization: Bearer {page-access-token}
 *       body: message={input.message}, link={input.link}
 *             (image: POST /{page-id}/photos with url={input.imageUrl}, then attach)
 *       -> 200 { "id": "{page-id}_{post-id}" }   // persisted as fb_object_id in fb_sync_link
 *
 *   - Map the Graph `{ id }` to PublishPostResult.objectId here so the Graph shape never
 *     leaks past the FacebookClient interface (reversibility).
 */

const TURN_ON_MESSAGE =
  "Real Facebook Graph API adapter is a production turn-on step (ADR-022); set FACEBOOK_CLIENT=mock for development";

export class RealFacebookClient implements FacebookClient {
  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    void input;
    throw new Error(TURN_ON_MESSAGE);
  }

  async getPost(objectId: string): Promise<FacebookPost | null> {
    void objectId;
    throw new Error(TURN_ON_MESSAGE);
  }

  async health(): Promise<FacebookClientHealth> {
    return { ok: false, client: "real" };
  }
}
