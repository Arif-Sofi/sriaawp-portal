# Revision History

> Per-section bump log for the Phase 1 documentation tree. Append-only. When a file's *meaning* changes (not just formatting), add a row.
>
> Old versions move to `docs/phase-1/99-archive/<file>-vN.md` rather than relying on `git log` archaeology — see [Master plan §12](../00-master-plan.md). Untouched files are not listed; their version is implicitly v1.

---

| Date | Version | File / Section | Author | Change |
|---|---|---|---|---|
| 2026-05-05 | v1 | `00-master-plan.md` | Author | Initial canonical Phase 1 plan (master plan + workstreams + risk seed + 11 cross-cutting deliverables). |
| 2026-05-05 | v1 | `00-meta/decision-log.md` ADR-001..005 | Author | Initial five ADRs proposed (module decomposition, RBAC source of truth, DB sessions, Server Actions vs Route Handlers, pgvector). |
| 2026-05-05 | v2 | `00-meta/decision-log.md` ADR-006..011 | Author | Six P0/P1 decisions accepted (Gemini embedding, Gemini Flash LLM + cost, PDPA stance, RAG audience, visibility taxonomy, parent-student linking). |
| 2026-05-05 | v3 | `00-meta/decision-log.md` ADR-012..015 | Author | Foundation-spike-driven ADRs accepted (proxy rename, role-named segment nesting, Cache Components opt-in policy, React Compiler stays enabled). |
| 2026-05-05 | v1 | `00-meta/glossary.md` | Author | Initial BM/EN domain + technical glossary (~70 entries). |
| 2026-05-05 | v1 | `00-meta/risk-register.md` | Author | Risk register seeded from master plan §8 (R-01..R-12) with Owner + Last reviewed columns. |
| 2026-05-05 | v1 | `00-meta/stakeholder-register.md` | Author | Stakeholder register from PP §B + PS Slide 30. |
| 2026-05-05 | v1 | `00-meta/stakeholder-communication-plan.md` | Author | Cadence + evidence rules + sign-off gates G1..G5. |
| 2026-05-05 | v1 | `00-meta/log-book.md` | Author | Template + first entry (2026-05-05 P0 decisions lock-in). |
| 2026-05-05 | v1 | `00-meta/references.bib` | Author | Literature review starter set seeded from master plan §11.4 (16 entries). |
| 2026-05-05 | v1 | `00-meta/pr-stack.md` | Author | Initial PR stack tracker covering #3, #22, this PR. |
| 2026-05-05 | v1 | `01-overview/p0-decisions-to-lock.md` | Author | 11 of 15 decisions locked; 4 deferred / tentative. |
| 2026-05-05 | v1 | `05-tech-spikes/spike-nextjs-16.md` | Author | Foundation spike report on Next.js 16.2.4 — pitfalls 1..9 + decisions feeding ADR-012..014. |
| 2026-05-05 | v1 | `05-tech-spikes/spike-react-19-compiler.md` | Author | Foundation spike report on React 19.2 + React Compiler 1.0 — decision feeds ADR-015. |
| 2026-05-05 | v1 | `05-tech-spikes/spike-tailwind-v4.md` | Author | Foundation spike report on Tailwind v4 — `@theme` tokens + PostCSS pipeline. |
| 2026-05-05 | v1 | `03-design/folder-structure-spec.md` | Author | Target `src/` tree for FYP2; locks role-named segment nesting + `proxy.ts` location. |
| 2026-05-05 | v1 | `98-templates/*` | Author | Reusable doc templates (FR, use case, NFR, ADR, spike, test case). |

---

## Conventions

- **One row per logical bump**, not per commit. A renaming + content change = one row.
- **Version numbers** are per-file (not project-wide). v1 is the first commit of the file. Bump on **content** changes, not formatting-only edits.
- **Archive on major bumps.** When a file's structure changes such that the old version is no longer comprehensible alongside the new one, copy the old to `99-archive/<file>-v<old>.md` before editing.
- **Cross-link.** ADR-driven changes name the ADR id in the Change cell.
