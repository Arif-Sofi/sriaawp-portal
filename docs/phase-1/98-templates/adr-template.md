# Architectural Decision Record template

Append new ADRs to [`../00-meta/decision-log.md`](../00-meta/decision-log.md) using this shape. Numbering is sequential; never reused after deprecation.

Status values: `Proposed` → `Accepted` → (later) `Superseded by ADR-NNN` or `Deprecated`. **Do not edit Accepted ADRs in place** — write a new ADR that supersedes the old one.

---

## Template

```
## ADR-NNN — <short title in present-tense decision form>

**Status.** <Proposed | Accepted | Superseded by ADR-MMM | Deprecated>

**Date.** YYYY-MM-DD.

**Context.**
<One paragraph: what's the situation, what forces are at play, what made us notice this decision needed making.>

**Options.**
1. <Option A — concise label>. <one or two lines explaining it.>
2. <Option B>. ...
3. <Option C>. ...

**Decision.**
<Chosen option, in one sentence. Reference the option number.>

**Consequences.**
- <positive consequence>
- <negative consequence we accept>
- <follow-up actions or files affected>

**References.**
- <links to source PP/PS sections, spike reports, FRs, or external docs that informed the decision>
```

---

## Authoring rules

1. **One decision per ADR.** If the topic feels like two decisions, write two ADRs.
2. **Title is the decision in present tense**, e.g. "Use database sessions, not JWT" — not "Choose session strategy".
3. **Options must include the rejected ones with brief rationale.** A reader six months later needs to see why obvious-looking alternatives were dismissed.
4. **Consequences include the negative ones we accept.** Honest trade-offs build trust.
5. **Cite sources.** Every ADR links to either a stakeholder requirement, a spike, or a regulatory constraint.
6. **Once Accepted, immutable.** Edits go in a superseding ADR.
7. **Link from the affected artefacts back to the ADR.** Schema files, design docs, FRs that hinge on the decision should mention the ADR id.
