# `docs/phase-1/` — FYP1 Documentation Hub

This folder is the **single source of truth** for Phase 1 (FYP1, Waterfall) of the SRIAAWP Portal project. By the time FYP2 (Agile, implementation) starts, every requirement and design decision in this folder must be locked, signed off, and stable.

## Read order for a fresh reader

1. [`00-master-plan.md`](./00-master-plan.md) — the master plan. Start here. Explains the mission, definition-of-done, folder structure, workstreams, decision triggers, sequencing, timeline, risks, and quality bar.
2. [`PP.md`](./PP.md) — UTM PSM1.PF.05 official proposal & supervision-consent form (transcribed from the signed PDF; supervisor signed 16.4.26).
3. [`PS.md`](./PS.md) — 30-slide proposal deck (transcribed from the source PDF).
4. [`01-overview/p0-decisions-to-lock.md`](./01-overview/p0-decisions-to-lock.md) — the 6+10 schema-blocking and UI-blocking decisions that need stakeholder/supervisor sign-off before requirements and design can proceed.
5. [`00-meta/decision-log.md`](./00-meta/decision-log.md) — running ADR log; every architectural decision lands here.

After that, work top-to-bottom through the numbered subfolders:

```
00-meta/          project-management connective tissue (glossary, ADRs, risks, log book)
01-overview/      charter, scope, success criteria, P0 decisions
02-requirements/  要件定義: FRs, NFRs, RBAC, use cases, RTM
03-design/        基本設計 + 詳細設計: architecture, ERD, schema, API, RAG, conflict, UI
04-methodology/   waterfall+agile rationale, Gantt, tools/env
05-tech-spikes/   technical risk retirement (NextJS 16, AuthJS v5, pgvector, AI SDK, ...)
06-testing/       UAT/UEQ/RAGAS/heuristic plans + test cases
07-thesis/        UTM PSM thesis Ch1-5
08-compliance/    PDPA-2010 + minor consent design
09-stakeholder/   Surat Kebenaran + interview consent + transcripts
10-presentation/  defense slides, poster, short paper outlines
11-forms/         official UTM PSM1 forms
98-templates/     reusable doc shapes (FR, use case, NFR, ADR, spike, test case)
99-archive/       superseded versions
```

## Source artefacts (already on disk)

- [`PP.md`](./PP.md) + [`source/PP/`](./source/PP/) — proposal form text + page PNGs.
- [`PS.md`](./PS.md) + [`source/PS/`](./source/PS/) — slide deck text + page PNGs.
- [`_scripts/pdf_to_png.py`](./_scripts/pdf_to_png.py) — PyMuPDF renderer; re-run with `python docs/phase-1/_scripts/pdf_to_png.py` if the source PDFs change.

## Conventions

- No emojis. UTM-thesis-grade prose. Per-project rules in `CLAUDE.md` / `AGENTS.md` apply.
- Diagrams in Mermaid where possible (so they live in Markdown, can't drift, render on GitHub).
- File naming: kebab-case lowercase. `.sql.md` for DDL prose.
- Citations: `[author, year]` inline; full entries in [`00-meta/references.bib`](./00-meta/references.bib).
- Every significant decision → ADR in [`00-meta/decision-log.md`](./00-meta/decision-log.md).

## Status

| Item | State |
|---|---|
| Source PP / PS transcribed | done |
| Master plan | done — see [`00-master-plan.md`](./00-master-plan.md) |
| P0 decisions Q1–Q3, Q5–Q10, Q13, Q14 | **LOCKED** 2026-05-05 |
| P0 decision Q4 (document ACL) | tentative — confirm against real document samples |
| P0 decisions Q11, Q12, Q15 | deferred to next scrum |
| ADR log | 11 ADRs accepted (architecture + P0 lock-ins) |
| Templates | done (FR, use case, NFR, ADR, spike, test case) |
| Folder scaffolding (`02-` … `11-`) | being filled per master plan |
| Surat Kebenaran from SRIAAWP | **PENDING** (Slide 30 "Letter in progress" — chase weekly) |
