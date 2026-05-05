# Non-Functional Requirement template

NFRs in [`../02-requirements/non-functional-requirements.md`](../02-requirements/non-functional-requirements.md) follow the IPA 非機能要求グレード six-category spine. Every NFR must have a quantified target and a measurement method — "should be fast" is not an NFR.

| Prefix | Category (JP) | Category (EN) |
|---|---|---|
| `NFR-AVAIL-NN` | 可用性 | Availability |
| `NFR-PERF-NN`  | 性能・拡張性 | Performance / Scalability |
| `NFR-OPS-NN`   | 運用・保守性 | Operations / Maintainability |
| `NFR-MIG-NN`   | 移行性 | Migration |
| `NFR-SEC-NN`   | セキュリティ | Security |
| `NFR-ENV-NN`   | システム環境 | System environment / Eco |

---

## Template

```
NFR-XX-NN — <short title>

Category:        <one of the six above>
Target:          <quantified value with unit>
Measurement:     <how the target is measured, including tooling>
Source:          <NFR target table in 00-master-plan §11.3 | stakeholder interview | regulatory>
Rationale:       <one sentence on why this target>

Verification plan:
  - Method: <load test | unit assertion | manual check | log analysis | ...>
  - Tooling: <k6 | Vitest | Playwright | Sentry | ...>
  - Owner:   <author>
  - Test case ref: <TC-NN>

Linked FRs: <FRs whose acceptance depends on this NFR>
Open questions: <P0 / P1 / P2 references>
```

---

## Worked examples

```
NFR-PERF-02 — Conflict-check p95 latency

Category:    Performance / Scalability
Target:      p95 < 500 ms; p99 < 1000 ms; timeout fail-closed at 1500 ms.
Measurement: Synthetic load test of 100 RPS sustained for 5 min against the staging DB seeded with 12 months of representative events. Latency captured via Vercel Analytics + DB pg_stat_statements.
Source:      00-master-plan.md §11.3.
Rationale:   Conflict check runs synchronously before save; > 500 ms makes the form feel broken on mobile.

Verification plan:
  - Method: k6 load test against /api/events with synthetic seed.
  - Tooling: k6 + Grafana Cloud free tier.
  - Owner:   Author.
  - Test case ref: TC-PERF-02.

Linked FRs: FR-IC-01, FR-IC-04, FR-IC-08.
Open questions: -
```

```
NFR-SEC-03 — RBAC enforcement source of truth

Category:    Security
Target:      Every privileged action is gated by an explicit application-layer permission check; Supabase RLS mirrors as defense-in-depth. Cross-tenant attack tests pass on every CI run.
Measurement: Integration tests in tests/security/cross-tenant.spec.ts must (a) confirm app-layer rejects unauthorized action with 403 and (b) confirm RLS blocks the same call with the app layer disabled.
Source:      ADR-002 (00-meta/decision-log.md).
Rationale:   Policy drift between app and DB is a known leak vector.

Verification plan:
  - Method: integration test suite, gate on PR.
  - Tooling: Vitest + Supabase test container.
  - Owner:   Author.
  - Test case ref: TC-SEC-03-*.

Linked FRs: every privileged FR (~50 across modules).
Open questions: -
```

```
NFR-SEC-05 — RAG cross-department leakage prevention

Category:    Security
Target:      No chunk outside the requesting user's ACL set is ever scored against their query (pre-filter, not post-filter). Verified by red-team test set of 25 queries crafted to be most-similar to forbidden chunks.
Measurement: Test runs the 25-query set; must return zero forbidden chunk_ids in any retrieval_log row.
Source:      00-master-plan.md §11.5; ADR-005.
Rationale:   Post-filtering leaks via timing and via incidental retrieval logging.

Verification plan:
  - Method: integration test, gate on PR.
  - Tooling: Vitest + seeded Supabase + bge-m3 embeddings.
  - Owner:   Author.
  - Test case ref: TC-SEC-05.

Linked FRs: FR-AI-01, FR-AI-02, FR-AI-03.
Open questions: P0-Q3 (RAG audience).
```

---

## Authoring rules

1. Quantify or do not write the NFR. "Fast", "secure", "easy" are not NFRs.
2. Measurement method must be reproducible — name the tool and command.
3. Every NFR has at least one TC; at least one FR linked unless the NFR is system-wide (e.g. uptime).
4. PDPA-2010 / regulatory NFRs cite the law section, not just the act number.
