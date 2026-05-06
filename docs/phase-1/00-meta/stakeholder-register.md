# Stakeholder Register

> Single source of truth for the project's human stakeholders, contact points, and influence/interest classification. Drives [`stakeholder-communication-plan.md`](./stakeholder-communication-plan.md). Names taken from [`PP.md`](../PP.md) §B and [`PS.md`](../PS.md) Slide 30.
>
> **Influence** = ability to block or unblock the project. **Interest** = how directly the outcome affects them. Scale: `L` low, `M` medium, `H` high.

| Name | Role | Contact | Influence | Interest | Communication channel |
|---|---|---|---|---|---|
| Dr Zatul Alwani Binti Shaffiei | Supervisor (UTM, MJIIT, ESE). Sign-off authority on requirements + design | zatulalwani.kl@utm.my | H | H | Weekly meeting (Mondays); email; project Git repo for written artefacts; PSM1 log book countersignature |
| Mohamad Faiz Azizan | SRIAAWP school champion — day-to-day stakeholder contact for interviews | via SRIAAWP school office (introduced [PS](../PS.md) Slide 30) | M | H | Bi-weekly meeting; WhatsApp for short-cycle questions; in-person on-site interviews |
| Izzatul Izyan Abd Hamid | SRIAAWP school champion — co-contact for interviews | via SRIAAWP school office (introduced [PS](../PS.md) Slide 30) | M | H | Bi-weekly meeting; WhatsApp for short-cycle questions; in-person on-site interviews |
| SRIAAWP — *Sekolah Rendah Islam Al-Amin Wilayah Persekutuan* | Primary stakeholder organisation. Signs *Surat Kebenaran*; assumes production cost ownership | Via Pengetua office, Sri Rampai KL (school address per [PS](../PS.md) Slide 4) | H | H | Surat Kebenaran process; quarterly sign-off; on-site UAT |
| End user — Admin persona | School administrators (~2–3 users) | Recruited via school champion | M | H | UAT round (Week 11–12 PSM2); 1:1 interviews during Round-1 elicitation |
| End user — Teacher persona | Class teachers + co-curricular teachers (~30–40 users) | Recruited via school champion | M | H | UAT round; 1:1 interviews; UEQ + SUS forms |
| End user — Parent persona | Parents of SRIAAWP students (~150–250 users) | Recruited via school champion | L | H | UAT round; UEQ + SUS forms; PDP Notice + parental consent flow |
| End user — Student persona | SRIAAWP students Tahun 1–6 (under-13) | Indirect — observation only; LLM access denied in v1 ([ADR-009](./decision-log.md)) | L | M | Observed UAT (with parental consent) for non-AI screens only |
| Muhammad Arif Hakimi | Student / developer / author of all artefacts (UTM matric A23MJ5008) | muhammadarifhakimi@graduate.utm.my | H | H | Owns all artefacts in this repo |
| UTM PSM1 examiner panel | 2 evaluators; defense Q&A (20 min present + 10 min Q&A) | Assigned by FoC at end of PSM1 | H | M | Defense slide deck; thesis chapters; poster; in-person panel |
| UTM SECJH track coordinator | Optional short-paper / track-specific requirements | Confirm with supervisor (open question — see [Master plan](../00-master-plan.md) §14) | M | L | Email through supervisor |

---

## Notes

- **R-08** in the [risk register](./risk-register.md) tracks stakeholder availability against school holidays / Hari Raya.
- The school champion contact (Faiz / Izyan) is mediated through the supervisor and the school office for the Phase-1 elicitation rounds; direct WhatsApp is established only after the first in-person meeting and with the school's consent.
- **Pengetua** sign-off on the *Surat Kebenaran* is what activates the production-data path — see [ADR-008](./decision-log.md) and [Master plan](../00-master-plan.md) §2.1.
- End-user personas are listed as collective rows here; per-persona goals/frustrations live in [`../02-requirements/user-personas.md`](../02-requirements/user-personas.md) once authored.
