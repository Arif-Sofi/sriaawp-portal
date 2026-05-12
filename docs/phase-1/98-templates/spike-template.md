# Tech Spike report template

Spikes in [`../05-tech-spikes/`](../05-tech-spikes/) retire a single piece of unfamiliar tech before it can derail FYP2. Each spike is a short investigation that produces an opinionated, copy-pastable answer.

Per [`../../AGENTS.md`](../../AGENTS.md): every spike must consult the **locally installed** docs (e.g. `node_modules/next/dist/docs/`) — not training-data assumptions about Next.js / React / Auth.js / Tailwind / Vercel AI SDK.

---

## Template

```
# Spike — <Tech name + version>

**Status.** <In progress | Done | Blocked>
**Author.** <name>
**Started / Completed.** <YYYY-MM-DD / YYYY-MM-DD>
**Effort.** <hours / days>

## Goal

<One sentence: what question this spike must answer.>

## Versions pinned

- <package-name>@<exact version> (from `package.json`)
- <other relevant tool / extension>

## Docs read

- <local path | URL> — <what it covered>
- <local path | URL> — ...

(Include `node_modules/<pkg>/dist/docs/` paths verbatim where they exist; that is the canonical doc per the repo's AGENTS.md note.)

## Hello-world reproduced

<Working code — link to a folder under `../../experiments/<spike>/` if non-trivial, or paste a minimal snippet here. The key is that it actually ran successfully.>

## Pitfalls encountered

- <thing that broke; root cause; fix>
- <subtle behavior; how it differs from training-data assumptions>

## Decision

<The opinionated answer to the spike's Goal, in one paragraph. Reference an ADR id if this decision is significant.>

## Code patterns to copy in FYP2

```ts
// Pattern 1 — <name>
<actual snippet>
```

```ts
// Pattern 2 — <name>
<actual snippet>
```

## Open questions / follow-up

- <items that this spike could not answer>
- <related spikes triggered>

## References

- <issues, blog posts, ADRs, FRs, NFRs touched>
```

---

## Worked example (skeleton — fill in during the actual spike)

```
# Spike — Next.js 16.2.4

**Status.** In progress
**Author.** Muhammad Arif Hakimi
**Started.** 2026-05-12
**Effort.** ~2 days

## Goal

Confirm Next.js 16 App Router behaviors we depend on (Server Actions, route groups, caching defaults, middleware) before locking the folder structure spec.

## Versions pinned

- next@16.2.4
- react@19.2.4
- react-dom@19.2.4
- typescript@5.x
- @tailwindcss/postcss@4.x

## Docs read

- node_modules/next/dist/docs/... (TBD on first read; AGENTS.md mandate)
- https://nextjs.org/docs ... (cross-check after local docs)

## Hello-world reproduced

(see ../../experiments/spike-nextjs-16/)

## Pitfalls encountered

- TBD

## Decision

TBD — feeds ADR for folder-structure-spec.md.

## Code patterns to copy in FYP2

TBD

## Open questions / follow-up

- TBD

## References

- ../03-design/folder-structure-spec.md
- ../00-meta/decision-log.md
```

---

## Authoring rules

1. **Spike ≠ feature.** A spike is throwaway investigation. The output is the report, not production code.
2. **Time-box.** If a spike isn't producing an answer in 2 days, escalate — the question is probably ill-formed.
3. **Always reproduce a hello-world.** "I read the docs" is not a spike. Code must run.
4. **Pin exact versions.** A spike against `next@16.2.4` does not generalise to `next@16.3`.
5. **The Decision section is the deliverable.** Everything else supports it. If the Decision can't be written in one paragraph, the spike isn't done.
6. **Significant decisions become ADRs.** Cross-link.
