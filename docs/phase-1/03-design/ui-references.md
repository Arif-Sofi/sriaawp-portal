# UI references — visual inspirations for SRIAAWP screens

This file collects external visual references that inform the SRIAAWP portal's UI. Each reference notes which SRIAAWP screens or patterns it informs. Treat these as inspiration; one-to-one cloning is not required and would conflict with the school's own brand identity (logo, vision/mission text, BM-first content).

## Reference 1 — UTM My Portal (home/dashboard)

- **Source file**: [`../../screencapture-my-utm-my-home-2026-05-05-12_17_36.webp`](../../screencapture-my-utm-my-home-2026-05-05-12_17_36.webp) (committed alongside this doc).
- **Captured**: 2026-05-05.
- **What it is**: the authenticated home page of the UTM My Portal — the university's own one-stop launcher for students/staff.

### Layout patterns to borrow

The screenshot shows a three-column layout with a top nav and a hero banner of quick-access app icons:

- **Top app bar**: the university logo (left) + a horizontal row of large icon-cards for high-traffic apps (Student Centre, eThesis, e-Learning, Course Registration, ePayment, Library, etc.). Each card has a subtle icon and a one-word label.
- **Left sidebar**: a tall, scrollable list of grouped quick links (e.g. *Systems & Apps* → Academic, Course Registration, etc.; *Quick Links* → Contact, etc.). Section labels are bold; entries are flat anchor links with no decoration.
- **Centre column**: stacked content panels — *News*, *Events*, *Academic & Circular*, *Forms*, *Finance*. Each panel has a title bar, a list of recent items with a date and a one-line headline, and a footer link to the full archive. Mostly text-and-link, occasional thumbnail.
- **Right rail**: card-shaped promo / feature blocks (timetable widget, charity drive, "ctrl+alt+del" featured campaign, large "Pemarafan Bintang Fasa 2/2026" banner). These are visually heavier than the centre column and rotate with school events.

### How this informs SRIAAWP screens

| SRIAAWP screen | Pattern borrowed | Adaptation |
|---|---|---|
| Public landing (`(public)/page.tsx`) | Top app icon row → quick links; centre column → news + memos; right rail → school announcements / Takwim summary | Fewer icons (this is a primary school, not a university). Big "Lihat Takwim" / "View Calendar" CTA prominent. Bilingual (BM-first). |
| Public Takwim (`(public)/takwim/page.tsx`) | Centre column for upcoming events; right rail for static info (school address, prayer times) | Use a real calendar grid, not just a list — Takwim is the centrepiece. |
| Parent dashboard (`(parent)/parent/dashboard/page.tsx`) | Top icon row → "My Children", "Acknowledge Memos", "Co-curricular Achievements", "Chat (RAG)" | Children selector top-left; per-child stats card centre; pending memos right rail. |
| Staff dashboard (`(staff)/staff/dashboard/page.tsx`) | Top icon row → "My Department", "Documents", "Events", "Co-curricular", "Chat (RAG)" | Centre column = today's events + pending approvals; right rail = department news. |
| Admin dashboard (`(admin)/admin/dashboard/page.tsx`) | Top icon row → "User Management", "Verify Parents", "Departments", "RBAC", "Audit Log" | Centre column = pending parent verifications, recent audit-log highlights; right rail = system health. |

### Style cues

- **Colour**: UTM uses dark navy + bright accents (red/yellow). SRIAAWP's brand is teal/turquoise + yellow (per [`../PS.md`](../PS.md) Slide 4 logo + façade). Apply that palette via Tailwind v4 `@theme` tokens (locked when the design-system spike runs).
- **Typography**: clean sans-serif, varied weights for hierarchy. Default to Inter or the system stack — confirm during `ui-design-system.md` work.
- **Density**: information-dense but not crowded. Cards have generous padding; lists have tight line-height. Mobile-first responsive: collapse left sidebar into a hamburger; right rail moves below centre column.
- **i18n**: UTM's portal mixes BM and EN freely (e.g. *Pemarafan Bintang* alongside English headlines). SRIAAWP should do the same — primary content in BM, English fallback, no forced toggle on first paint.

### What NOT to borrow

- The portal-card jungle is overwhelming for a primary school audience. SRIAAWP must keep the visual surface narrower — at most 5–6 top icons per role.
- UTM's portal assumes desktop-first usage. SRIAAWP parents will overwhelmingly use mobile. The right rail must not block the primary CTA on small viewports.
- The promo banner pattern is fine but should not dominate; school news is the real content.

### Open follow-ups

- Confirm the SRIAAWP brand colour values from school marketing materials (logo PNG, façade banner) — needed before locking Tailwind tokens.
- Source the school logo as an SVG/PNG at adequate resolution from the school stakeholder.
- Decide whether the Takwim renders with `react-day-picker`, `@fullcalendar/react`, or a hand-rolled grid (depends on conflict-modal interaction needs — see `conflict-checker-design.md`).
