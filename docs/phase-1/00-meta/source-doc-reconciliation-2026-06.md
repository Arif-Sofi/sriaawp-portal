# Source-Document Reconciliation — 2026-06 Re-Baseline

> Memo of edits to apply to the OneDrive Word source documents (SRS + thesis) so they reflect the 2026-06-20 stakeholder re-baseline. This is the authoritative change list; it drives the manual Word edits.

## Why this exists

On 2026-06-20 the school champion (Puan Izzah) directed four changes to the system (recorded in the log-book entry of that date and as ADR-018 through ADR-022):

1. **Authentication** moves from Auth.js v5 to Supabase native Auth (ADR-018, ADR-019).
2. **The AI assistant** becomes agentic with three grounded modes, of which retrieval-augmented generation over a how-to manual is only one (ADR-020).
3. **Facebook Page integration** is requested — portal news mirrored outbound to the school's public Page (ADR-022).
4. **News engagement** — likes and a parent-question / teacher-answer comment thread on news items, replacing the Telegram Q&A loop (ADR-021).

The first change *realigns* the build toward the source documents (the thesis and SRS already specify Supabase Auth + RLS, and the SRS already lists "Login with Google"); the Auth.js choice had quietly diverged from them. The other three *extend* the source documents with capabilities they do not yet describe. Either way, the SRS and thesis must be brought back into agreement with the design baseline before FYP1 submission.

The markdown mirrors under `docs/source-docs/` (`srs.md`, `thesis.md`) are **read-only, generated** snapshots produced by `scripts/sync-source-docs.py` from the OneDrive Word documents; they carry a "Do not edit by hand" banner and are overwritten on every sync. **Do not edit the mirrors.** Apply each edit below in the Word document, then re-run `python scripts/sync-source-docs.py` and commit the regenerated `*.md` so the repository reflects the corrected source.

Every edit below is written as a concrete before-to-after instruction keyed to the section or use-case it touches. ADRs are referenced by plain identifier (e.g. ADR-018); the running entries live in `decision-log.md`. New requirement identifiers must subsequently gain rows in the Requirements Traceability Matrix (RTM) — see the Traceability note at the end.

---

## SRS edits

The SRS is use-case driven. The edits below touch the affected use cases, add four new ones, and adjust the design-constraint and non-functional-requirement prose.

### UC01 — Register/Login Account (revise)

**Context.** The SRS already states the desired end state ("Login with Google" in AF1; the Security Design Constraint that the system "uses Supabase to hash and secure" credentials). With Supabase Auth now adopted, that prose is no longer aspirational — it is accurate. The edits make the authentication provider explicit rather than implied.

- **Description / Normal Flow.** Add a sentence naming the provider: authentication is performed by **Supabase Auth** via the `@supabase/ssr` integration; the system does not implement its own credential store. Credentials are validated against Supabase's managed `auth.users`.
- **AF1 — Social Login.** Keep as written ("Login with Google"). It is already correct; confirm it reads as a Supabase OAuth provider rather than a bespoke OAuth integration.
- **Normal Flow (passwordless).** Add an alternative entry point: users may request a **magic link / one-time passcode (OTP)** issued by Supabase Auth, in addition to email-and-password. This is the project's primary login path.
- **Cross-reference.** Add a one-line note: "Role and permission resolution after authentication is handled by the application layer, not by Supabase — see UC04 and the RBAC design." This pre-empts the (incorrect) assumption that Supabase Auth supplies the role matrix.

### UC02 — Reset Password (revise)

- **Normal Flow.** Replace the generic "System sends a reset link" with the Supabase-native flow: the **Supabase Auth password-recovery email** is dispatched and the new password is set through the Supabase recovery session.
- **EF2 — Expired Link.** Keep the expiry behaviour but note that link lifetime is governed by Supabase Auth configuration rather than an application-managed token table.

### UC03 — Verify Registration (revise)

- **Normal Flow.** Replace "System sends verification email" with the **Supabase Auth email-confirmation** flow. Account activation is the Supabase email-confirmation state.
- **Post-condition.** The application `profiles` row is provisioned by an `on auth.users insert` trigger (ADR-018); note that the verified state lives in Supabase `auth.users` and is mirrored into the application profile, not stored only in an application table.

### UC08 — Index Document for AI (narrow)

**Context.** Under the agentic redesign (ADR-020), school documents are **not** embedded in v1. Only a single how-to-use-the-system manual is embedded for retrieval; news is reached through a function call, not through indexing.

- **Description.** Change from "The system reads uploaded documents and extracts text to be used by the RAG-based AI assistant" to: "The system embeds the **how-to-use-the-system manual** into the vector store so the assistant can answer questions about operating the portal. General school documents are **not** indexed in v1."
- **Pre-condition / Normal Flow.** Re-scope the trigger: indexing runs over the **manual** content (and its associated images), not over every uploaded document. Remove the implication that each UC05 upload triggers indexing.
- **EF1 — OCR Failure.** Retain, scoped to the manual ingestion.
- **Post-condition.** Change "Document content is searchable via AI Query (UC16)" to "Manual content is retrievable by the assistant's RAG mode (UC16, mode 3)."
- **Note for the use-case diagram.** UC08 no longer follows from UC05 (Upload Document). Update the `<<include>>` / trigger relationship in Figure 1.0 accordingly.

### UC16 — Query AI Assistant (rewrite)

**Context.** The single document-RAG description is replaced by the three-mode agentic design (ADR-020). The "All Users" actor also needs the under-13 guard caveat.

- **Description.** Replace "Users ask natural language questions to find information stored in indexed documents" with: "Users ask natural-language questions; the assistant answers using one of **three grounded modes** — (1) **in-article context**: when the user is reading a specific news or memo item, that item's text is supplied as context; (2) **`get_news` function-calling**: the assistant calls a tool to fetch news the caller is permitted to see and answers from it; (3) **manual RAG**: retrieval over the embedded how-to manual, returning the answer together with any relevant **image links** from the manual."
- **Normal Flow.** Replace the single "AI retrieves relevant chunks from indexed documents (RAG)" step with a mode-selection step: the assistant chooses in-article context, the `get_news` tool, or manual RAG depending on the question, then composes a grounded answer.
- **Actor — "All Users".** Add the under-13 guard caveat (ADR-020): in v1 the assistant is initiated by **authenticated non-Student users** (Admin, Teacher/Staff, Parent). Unauthenticated visitors and Student accounts (who are minors, typically under 13) do not initiate AI chat in v1, pending the minor-safety / consent ruling. State this as a v1 scope boundary, not a permanent restriction.
- **EF1 — No Source Material.** Keep the no-hallucination guard, but generalise it: the assistant declines when none of the three modes yields grounded material, rather than only "not found in school documents."
- **Pre-condition.** Change "User has access to portal" to "User is authenticated (v1)" to match the actor caveat above.

### New use case — React/Comment on News (add)

Add a new use case under the Information Dashboard module (renumber subsequent IDs or append at the end of the table; record the chosen numbering in the RTM). Proposed identifier: **UCxx — React/Comment on News** (ADR-021).

- **Description.** Parents react to and ask questions on a news item; teachers/staff answer in a comment thread. Replaces the Telegram Q&A loop described in the thesis Problem Background.
- **Actor(s).** Parent (reacts, asks); Teacher/Staff, Administrator (answers, moderates).
- **Pre-condition.** User is authenticated; the news item is published and permits engagement.
- **Normal Flow.** Parent opens a published news item; parent adds a reaction (like) and/or posts a question comment; a teacher/staff member replies in-thread; the parent is notified of the reply.
- **Alternative Flow.** AF1 — Moderation: a teacher/staff or admin hides or removes an inappropriate comment (minor-UGC safeguard).
- **Exception Flow.** EF1 — Engagement disabled: the news item has comments turned off; the system shows the item read-only.
- **Post-condition.** Reaction count and comment thread are updated; participants are notified.

### New use case — Publish/Sync to Facebook Page (add)

Add a new use case under the Information Dashboard module. Proposed identifier: **UCxx — Publish/Sync to Facebook Page** (ADR-022).

- **Description.** When an administrator publishes a news item, the system mirrors it (outbound, public content only) to the school's public Facebook Page.
- **Actor(s).** Administrator (system performs the outbound post).
- **Scope note.** v1 is **outbound, public-only**: only already-public portal news is pushed to Facebook. Inbound pull of Facebook posts into the portal and any bidirectional sync are **not committed** and are out of scope for v1 (ADR-022). State this explicitly so examiners do not read "sync" as bidirectional.
- **Pre-condition.** Administrator is authenticated; a news item is published with public visibility; the Meta app and Page-admin grant are configured.
- **Normal Flow.** Admin publishes a public news item; the system posts the item to the Facebook Page and records the resulting Facebook post reference against the news item.
- **Exception Flow.** EF1 — Page credential missing/expired: the system records the publish locally and flags the Facebook mirror as not sent.
- **Post-condition.** The public news item appears on the school's Facebook Page; the portal stores the link back to the Facebook post.
- **Dependency flag.** This use case is **blocked** until the school confirms ownership of the Meta app and the Page-admin grant (open action in the 2026-06-20 log-book entry). Note this dependency in the use-case description.

### Use-case description table (Table 2.0) — additions

In the "Description of Module and Functions" table, add rows for the two new use cases under **Information Dashboard**:

- "UCxx — React/Comment on News — Allows parents to react to and ask questions on news items, with teachers/staff answering in a comment thread."
- "UCxx — Publish/Sync to Facebook Page — Mirrors published public news to the school's Facebook Page (outbound, public-only)."

Also amend the existing rows:

- **UC08** description: change "read by the AI to extract the information" to "embeds the how-to manual for the AI assistant (general documents are not indexed in v1)."
- **UC16** description: change "query the AI assistant to retrieve informations" to "query the agentic AI assistant (in-article context, news function-calling, or manual RAG)."

### Functional-requirement set (align with the thesis FR table)

The SRS is use-case driven and does not carry its own FR table, but the thesis Table 4.1 uses FR01..FR13 and the two documents must agree. The SRS should reference the same FR identifiers where it cites requirements. Apply the FR changes listed under "Thesis edits" below, and ensure any FR citation in the SRS uses the revised numbering (FR09 split into FR09a/FR09b/FR09c; new FR14 engagement; new FR15 Facebook).

### Non-functional requirement — Security row (revise)

- **Security (Other Requirements).** Augment the existing RBAC sentence: "The system authenticates users through **Supabase Auth** and enforces Role-Based Access Control (RBAC) at the **application layer** as the source of truth, with Supabase Row-Level Security (RLS) as a defense-in-depth net (ADR-002, ADR-019)." Note that Supabase Auth provides authentication and JWT issuance only; the RBAC matrix and permission catalogue are application-owned.
- **Add a revocation-latency clause.** "A role or permission change takes effect within the access-token lifetime (target 5–15 minutes) for any claim-based check, and effectively immediately for application-layer-gated routes, which re-resolve permissions on every request (ADR-019)." This replaces the previous implicit "instant" expectation carried over from the database-session design.

### Design Constraints — Security constraint (confirm accuracy)

- The existing constraint — "should not store passwords using plain texts and should uses Supabase to hash and secure them" — is now **fully accurate** under ADR-018. No wording change is required; optionally tighten "uses Supabase to hash" to "delegates credential hashing and storage to Supabase Auth" for precision.

### Design Constraints — add a PDPA / minor-data dependency note

Record (do not expand into a full compliance section) a single design-constraint sentence: personal-data handling and minor (under-13) consent obligations under PDPA-2010 (ADR-008) remain a binding design constraint; FYP1 and FYP2 development use **synthetic data only**, so no live obligation is breached during the build, and the consent/privacy artefacts are deferred but tracked. This frames PDPA as a constraint and dependency, not a blocker, and does not require authoring compliance documents.

---

## Thesis edits

### Chapter 1 — Introduction (Project Scope)

The current scope (Project Scope; also echoed in the SRS Scope paragraph) describes only "an administrative hub integrating an AI assistant chatbot for querying school documents and an automated conflict checker for event scheduling." Extend it:

- **Add news engagement.** State that the portal supports **parent–teacher interaction on news items** (likes and a parent-question / teacher-answer comment thread), positioned as the structured replacement for the current Telegram Q&A loop named in the Problem Background.
- **Add bounded Facebook integration.** State that the portal **mirrors published public news to the school's Facebook Page** (outbound, public content only); make clear this is a bounded one-way mirror, not a full social-media management feature.
- **Re-frame the AI.** Keep the RAG framing but note the assistant is now **agentic**: it grounds answers through three modes (in-article context, news function-calling, and RAG over a how-to manual), with RAG being one of the three rather than the whole mechanism. Querying general school documents is no longer claimed for v1.

Apply the equivalent edits to the SRS Scope paragraph so the two documents' scope statements match.

### Chapter 2 — Literature Review

- **Add a sub-area on social-media integration / school communication.** Introduce a short literature sub-section motivating the Facebook Page mirror: the role of social platforms in school-to-community communication and the limits of unstructured channels (the Telegram problem the system replaces). This also gives the Facebook feature an academic grounding the current draft lacks.
- **Add a sub-area on UGC moderation for minors.** Introduce a sub-section on user-generated-content moderation and child-safety considerations, motivating the comment-thread moderation controls and the v1 under-13 AI guard.
- **Re-frame the AI sub-area.** Recast the existing AI/RAG technology discussion as **"agentic AI (grounded context + tool-calling) versus plain RAG"**: explain function-calling / tool-use and context-grounding as the broader paradigm, with RAG as one grounding strategy. The current text treats RAG as the entire AI approach; update it to match the three-mode design.
- **FR09 split.** Where the literature or analysis narrates the AI capability as a single requirement (FR09), reflect that it now splits into three AI capabilities (in-article context, news function-calling, manual RAG) — see the FR-table edit below.

### Chapter 4 — Requirement Analysis and Design

- **ERD / Supabase-Auth prose is already correct — call it out as a consistency win.** The Database Design narrative already reads "PROFILES connected to Supabase Auth's auth_users," and Chapter 3 already states Supabase Auth + RLS provide end-to-end security. Under ADR-018/019 this prose now **matches the implementation** rather than describing an unbuilt intent. Add a sentence noting that authentication is delegated to Supabase Auth while RBAC is resolved at the application layer (the source of truth), with RLS as defense-in-depth — so the chapter does not imply Supabase supplies the role matrix.

- **Functional-requirements table (Table 4.1) — edits.**
  - **Split FR09** ("All users shall be able to query the AI assistant to find specific information in the system") into three:
    - **FR09a** — The assistant shall answer questions about the news/memo item the user is currently viewing using that item as context.
    - **FR09b** — The assistant shall answer questions about school news by calling a tool that fetches news the caller is permitted to see.
    - **FR09c** — The assistant shall answer questions about how to use the portal via retrieval over an embedded how-to manual, returning relevant image links.
    - Reflect the v1 actor scope: AI chat is initiated by authenticated non-Student users in v1 (under-13 guard, ADR-020).
  - **Add FR14** — Parents shall be able to react to and comment (ask questions) on news items, and teachers/staff shall be able to answer and moderate those comments (ADR-021).
  - **Add FR15** — Administrators (via the system) shall mirror published public news to the school's Facebook Page (outbound, public-only) (ADR-022).

- **Use-case diagram (Figure 4.2).** Add the two new use cases (React/Comment on News; Publish/Sync to Facebook Page) under the Information Dashboard module, with the correct actors (Parent reacts/asks; Teacher/Staff answers/moderates; Administrator for the Facebook mirror). Adjust UC08's relationship so it no longer reads as triggered by every document upload.

- **ERD entity list.** Add the new entities introduced by the four changes:
  - **news_comment** and **news_reaction** (engagement; FK to the news/news-item entity and to profiles).
  - **notification** (reply / outcome notifications referenced by UC19 and the engagement flow).
  - **fb_sync_link** (records the Facebook post reference against a mirrored news item).
  - **manual** and **manual_image** (the embedded how-to manual and its images, supporting FR09c / UC08 narrowed scope).
  Note in the prose that PROFILES remains FK'd 1:1 to Supabase `auth.users` (uuid reused), consistent with ADR-018.

### Cleanup flag (separate from the four changes)

These are **template leftovers unrelated to the re-baseline**, but they must be fixed before submission and are recorded here so they are not lost:

- **List of Abbreviations.** The current entries (ANN — Artificial Neural Network, GA — Genetic Algorithm, PSO — Particle Swarm Optimization, MTS/MD/TM — Mahalanobis-Taguchi System / Distance / Taguchi Method) are carried over from an unrelated machine-learning fault-detection thesis template. Replace them with this project's real abbreviations (e.g. RAG, RBAC, RLS, BaaS, SDLC, UAT, UEQ, SRS, SDD/SDS, STD, OTP, UGC, ERD, FR/NFR), aligned with the SRS Definitions/Acronyms table.
- **References section.** The entire REFERENCES list (Mahalanobis-Taguchi, particle-swarm, credit-scoring, fault-detection papers) is template debris from the same source thesis and is **not cited anywhere** in this project's chapters. Replace it wholesale with the references actually cited in Chapters 1–4 (and keep it in sync with `references.bib`). Likewise review the List of Symbols (δ, diameter, Reynolds number, etc.) and the placeholder Appendix bodies ("Video provides a powerful way to help you prove your point...") and remove or replace them.

---

## Traceability

Every new functional requirement introduced by this re-baseline must gain a row in the Requirements Traceability Matrix (a G2 deliverable) linking the FR to its use case(s), source ADR, and eventual test case:

- **FR09a / FR09b / FR09c** (three AI modes) — UC16; ADR-020.
- **FR14** (news engagement — react/comment) — new UCxx React/Comment on News; ADR-021.
- **FR15** (Facebook Page mirror) — new UCxx Publish/Sync to Facebook Page; ADR-022.

The authentication change (ADR-018/019) does not add an FR but revises the realisation of **FR01** (account creation/login) and the **Security** NFR; both rows must be re-pointed to Supabase Auth + application-layer RBAC in the RTM. The narrowing of **UC08 / FR-AI indexing scope** (manual-only embedding) must also be reflected so the RTM does not claim general-document RAG for v1.

When the new use-case identifiers are finalised (renumbered into the Information Dashboard module versus appended), record the chosen numbers here and in the RTM so the SRS, thesis, and matrix stay in agreement.
