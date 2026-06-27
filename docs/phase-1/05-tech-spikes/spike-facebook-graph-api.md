# Spike — Facebook Graph API (Page publish, App Review, token lifecycle)

**Status.** Done.
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-06-21 / 2026-06-21.
**Effort.** ~1 day.

## Goal

Validate that the ADR-022 one-way OUTBOUND path (portal `visibility = public` news -> the school's Facebook Page, behind an Admin toggle) is achievable within FYP timelines, and surface the dominant blockers early, so that no `FR-FB-*` work is committed against an unbounded or infeasible dependency.

## Validation posture (read first)

This spike is **documented from Meta's PUBLISHED Graph API reference; it is NOT validated against a live Meta app**. There is no Meta account, no created app, no Business Verification, and no Page-admin grant this phase — by the mock-first decision below, none of those are stood up until a production turn-on step. Every endpoint, permission, and timeline figure below is read from Meta's public documentation, not observed against a live call. Each such claim is marked **[documented, not live-validated]**.

What IS proven runnable this phase is the **mock-first client foundation** (`src/lib/facebook/`): the `FacebookClient` interface, a deterministic `MockFacebookClient`, a throwing `RealFacebookClient` turn-on stub, the env-selected factory, and a passing unit test. That code retires the *tech* risk now (the #85 outbound worker has a real interface + mock to build against) and isolates the *external-dependency* risk behind the `FACEBOOK_CLIENT` env flag — so a stalled Meta review cannot block FYP2 development.

## Versions / surfaces pinned

- Graph API version **v23.0** (the version string the real adapter pins; documented surface). **[documented, not live-validated]**
- Mock-first client foundation in this repo:
  - `src/lib/facebook/client.ts` — the `FacebookClient` interface (portal's own abstraction).
  - `src/lib/facebook/mock-client.ts` — `MockFacebookClient` (deterministic, network-free).
  - `src/lib/facebook/real-client.ts` — `RealFacebookClient` throwing turn-on stub.
  - `src/lib/facebook/index.ts` — `getFacebookClient()` env-selected factory (`FACEBOOK_CLIENT`, default `mock`).
  - `tests/facebook/mock-client.test.ts` — determinism + factory selection.

## Docs read

Meta's public Graph API reference, by area (the canonical source for an external API; there is no locally bundled doc as AGENTS.md mandates for Next.js/React):

- Graph API reference — **Page `feed` edge** (`POST /{page-id}/feed`): publish a post to a Page; `message`, `link` fields; `{ id }` response.
- Graph API reference — **Page `photos` edge** (`POST /{page-id}/photos`): publish a post with an image via `url`.
- Permissions reference — **`pages_manage_posts`** (publish/edit/delete Page posts) and **`pages_read_engagement`**; both require App Review.
- **Access tokens** guide — short-lived user token -> long-lived user token -> long-lived Page access token exchange; expiry behaviour.
- **App Review** + **Business Verification** guides — submission flow, evidence, screencast, reviewer turnaround.
- **Webhooks for Pages** guide — real-time inbound via a public callback with `X-Hub-Signature-256` verification.

All of the above are **[documented, not live-validated]**.

## Findings

### 1. Page publish call (the `fb_object_id` we persist)

- Endpoint: `POST https://graph.facebook.com/v23.0/{page-id}/feed`, authorised with a **Page access token** (`Authorization: Bearer {page-access-token}`) and the **`pages_manage_posts`** permission. **[documented, not live-validated]**
- Required/used fields for the ADR-022 outbound subset: `message` (the composed text) and `link` (the canonical portal URL). A primary image is published instead via `POST /{page-id}/photos` with `url={imageUrl}` (a photo post carries its own caption). **[documented]**
- Response shape: `200 { "id": "{page-id}_{post-id}" }`. That `id` is the value the #85 worker persists as **`fb_object_id`** in `fb_sync_link` for idempotency and loop-prevention (ADR-022). **[documented]**
- Reversibility: this Graph request/response shape lives ONLY inside `RealFacebookClient` (the turn-on comment records the exact call). Callers see `publishPost(input) -> { objectId }`; the Graph `{ id }` never leaks past the `FacebookClient` interface.

### 2. App Review + Business Verification path (the dominant risk, R-13)

The concrete steps, evidence, and realistic timeline — and what the **school** (not the student) must supply:

- **Create a Meta app** (type Business) under the **school's** Meta Business account. *(School)*
- **Business Verification.** The school's organisation is verified against legal documents (business/registration evidence, address, an authorised representative). This is the slow, school-owned gate. **[documented]** Realistic turnaround is **days to multiple weeks**, dependent on document quality and Meta's queue — and it runs entirely outside the student's control. **[documented, not live-validated]**
- **App Review for `pages_manage_posts`.** Submit a use-case description plus a **screencast** demonstrating the permission in context, with the app in a reviewable state. Reviewer turnaround is typically **a few business days but can extend**, with back-and-forth on rejections. **[documented, not live-validated]**
- **Page-admin grant.** The school (Page owner) grants the app the Page role / connects the Page so a Page access token can be minted. *(School)*

What the **school must supply**: the Meta Business account, legal verification documents, the authorised representative, the Page-admin grant, and the willingness to maintain the app long-term. The **critical path runs partly outside the student's control** (Meta's two review queues + the school's verification effort), which is exactly why outbound MVP is scoped to a single Page-post call (minimal review surface) and gated on this spike. This is **R-13** and it is the project's dominant Facebook feasibility risk.

### 3. Long-lived Page-token lifecycle + encrypted storage

- Exchange chain: **short-lived user token -> long-lived user token -> long-lived PAGE access token**. The long-lived user token is obtained from the short-lived one (`grant_type=fb_exchange_token`); querying `/{user-id}/accounts` (or `/me/accounts`) with the long-lived USER token then yields a **Page access token that does not expire** as long as the issuing user token is valid and permissions are unchanged. **[documented, not live-validated]**
- Expiry/refresh story: the long-lived user token is finite (documented ~60 days). The Page token derived from a long-lived user token is effectively long-lived but is invalidated by password change, permission revocation, or the user losing the Page role. **Re-issue** = re-run the exchange chain; there is no silent auto-refresh of a revoked token. **[documented]**
- Storage: the Page token is a high-value credential and is stored **pgcrypto column-encrypted** (the IC-encryption pattern, ADR-008/ADR-016) — **NOT** plaintext `.env`. The `.env` only carries the symmetric key (as `IC_ENCRYPTION_KEY` does today). **Rotation is a re-encryption job**, mirroring the IC-number rotation note in ADR-016. The `FACEBOOK_CLIENT` env var selects the client; it never carries the token.

### 4. Webhook vs polling for the (deferred) inbound path

Confirms ADR-022's correction of the stakeholder's "poll for posts" framing:

- **Real-time inbound is Meta's WEBHOOK path**, not polling: a public callback URL with subscription, plus **`X-Hub-Signature-256`** HMAC verification of every payload, plus its own App Review. **[documented]**
- The **deferred inbound Could** (ADR-022) deliberately uses **POLLING** (Vercel cron / Supabase scheduled function) reading the Page feed and ingesting as an **Admin-moderated DRAFT** — never auto-published. Polling is chosen for the Could because it needs no public callback and no webhook App Review, so it is FYP-sized; webhooks are not.
- **Effort delta:** webhooks add a public Route Handler (ADR-004 third class) + signature verification + a second App Review + subscription management; polling adds a cron + a feed read + the draft-ingest path. Polling is materially cheaper, which is why the deferred Could is poll-only. **Inbound is NOT built in this spike or #85.**

### 5. School-owned-app feasibility

The realistic likelihood of the school completing its part (app ownership, Business Verification, Page-admin grant) is the binding constraint on whether the Could ships at all. Assessment: Business Verification is a real organisational task requiring legal documents and an authorised representative; it is **plausible but not guaranteed within FYP2**, and it is **not** something the student can drive to completion. Therefore the realistic FYP outcome is: **build the integration mock-first now, demonstrate it against the mock, and gate the real adapter behind `FACEBOOK_CLIENT=real`** so the deliverable is complete and demonstrable even if the school's verification does not land in time. This is the correct FYP failure mode (ADR-022 consequences).

### 6. Content-model mapping (R-15)

The outbound subset that maps cleanly to a Facebook post:

| Portal field | Facebook mapping |
|---|---|
| news title | first line of the post `message` |
| body excerpt | post `message` body (truncated excerpt, not full body) |
| canonical portal link | `link` field (drives readers back to the authoritative portal) |
| primary image | `POST /{page-id}/photos` `url` |

Rich portal-only fields are **NEVER serialised outbound**: `visibility`, role lists (`role_list`), attachments, and any `internal`/`role_list` content. Only `visibility = public` news is eligible at the outbound boundary (a positive allow-list, ADR-022), enforced before the client is ever called. The `content_hash` covers only this synced subset, so an edit to a portal-only field does not trigger a re-push.

## Decision — GO WITH CONDITIONS (mock-first now)

**Recommendation: go-with-conditions.** Build the outbound integration **mock-first now** (the `FacebookClient` interface + `MockFacebookClient`, this spike's runnable deliverable; the #85 worker consumes it). **Gate the real adapter** behind `FACEBOOK_CLIENT=real`, which is turned on only once the **school owns the Meta app and completes App Review (`pages_manage_posts`) + Business Verification** and grants Page-admin rights.

This split is the point of the spike: the mock-first approach **retires the TECH risk now** (R-14 loop/dedup and R-15 content-mapping mitigations are code-proven against the mock; the publish call shape, objectId persistence, and retry/outbox path are all exercisable without Meta) and **isolates the EXTERNAL-dependency risk** (R-13 review queue, R-16 scope) behind the env flag — so a stalled Meta review or an incomplete school verification **cannot block FYP2 development**. The dominant residual risk is **R-13**: the school's Business Verification + Meta's App Review critical path, which runs partly outside the student's control. Facebook stays a **Could** (ADR-023) so that critical path never blocks the core deliverable.

## Code patterns to copy in FYP2

```ts
// Pattern 1 — outbound publish goes through the portal's own abstraction (reversibility)
import { getFacebookClient } from "@/lib/facebook";

const client = getFacebookClient(); // mock by default; real only when FACEBOOK_CLIENT=real
const { objectId } = await client.publishPost({ message, link, imageUrl });
// persist objectId as fb_object_id in fb_sync_link (idempotency / loop prevention)
```

```ts
// Pattern 2 — the real adapter's turn-on call (lives ONLY in real-client.ts)
// POST https://graph.facebook.com/v23.0/{page-id}/feed
//   Authorization: Bearer {decrypted page access token}   // pgcrypto, not .env
//   body: message=..., link=...                            // image via /{page-id}/photos
//   -> 200 { "id": "{page-id}_{post-id}" }
```

## Open questions / follow-up

- **P0-Q16** (Facebook scope/ownership): this spike supplies the inputs — the school must commit to owning the Meta app + Business Verification before the school-side critical path can start. Q16 can now move toward a decision.
- The consent template + DPIA for outbound disclosure of pupil data to Meta (cross-border to a US processor) remain deferred to the empty `08-compliance/` work (ADR-022; non-blocking under the synthetic-data posture).
- #85 builds the full outbound worker (publish + `fb_sync_link` + `outbox` delivery + retry) against `MockFacebookClient`.

## References

- [ADR-022](../00-meta/decision-log.md#adr-022--facebook-page-integration-direction-scope-and-public-only-constraint) — bounded outbound scope + the spike requirements.
- [ADR-008](../00-meta/decision-log.md#adr-008--pdpa-2010-aligned-design-from-day-1) / [ADR-016](../00-meta/decision-log.md#adr-016--drizzle-orm-as-the-schema-source-of-truth-drizzle-kit-for-generation-manual-sql-for-rls) — pgcrypto column-encryption + rotation pattern for the Page token.
- [ADR-023](../00-meta/decision-log.md#adr-023--revised-moscow-scope-baseline-after-the-2026-06-20-stakeholder-meeting) — Facebook is a Could.
- [risk-register.md](../00-meta/risk-register.md) — R-13..R-16 re-rated with this spike's mock-first finding; R-07 cross-link.
- [p0-decisions-to-lock.md](../01-overview/p0-decisions-to-lock.md) — Q16 (Facebook scope/ownership).
- `src/lib/facebook/` — the runnable mock-first client foundation this spike delivered.
- Meta Graph API public reference (Page `feed`/`photos` edges, `pages_manage_posts`, access tokens, App Review, Business Verification, Webhooks for Pages) — **[documented, not validated against a live Meta app]**.
