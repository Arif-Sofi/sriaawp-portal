# Spike — Next.js 16.2.4

**Status.** Done.
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-05-05 / 2026-05-05.
**Effort.** ~0.5 day.

## Goal

Confirm the Next.js 16 App Router behaviours we depend on (Server Actions, Route Handlers, route groups, caching defaults, request-time API breakage, middleware-to-proxy rename, Turbopack-by-default) before locking the folder structure spec and the API spec.

## Versions pinned

- `next@16.2.4`
- `react@19.2.4`
- `react-dom@19.2.4`
- `eslint-config-next@16.2.4`
- `babel-plugin-react-compiler@1.0.0`
- `typescript@^5`

## Docs read

Per [`AGENTS.md`](../../../AGENTS.md), the locally bundled docs at `node_modules/next/dist/docs/` are the canonical source. They exist for `next@16.2.4` and were read in preference to web docs:

- `node_modules/next/dist/docs/index.md` — entry point.
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — layouts/pages, dynamic segments, `PageProps`/`LayoutProps` typed helpers.
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Functions vs Server Actions; reachable as direct `POST` requests so auth must live inside every Server Function.
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — Cache Components model, `'use cache'` directive, `cacheLife`, `cacheTag`, PPR rendering.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Route Handlers conventions, caching opt-in, `RouteContext` helper.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — full v15→v16 breaking-change inventory.
- `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md` — confirms the AGENTS.md mandate.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — `(group)` parenthesis convention; **routes in different groups must not resolve to the same URL path**.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — formerly `middleware`, now `proxy`. Edge runtime no longer supported in `proxy`; defaults to Node.js.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md` — opt-in flag, requires `babel-plugin-react-compiler`.

## Hello-world reproduced

The repo itself is the hello-world. Five route groups under `src/app/`:

- `src/app/(public)/page.tsx` → `/`
- `src/app/(auth)/login/page.tsx` → `/login`
- `src/app/(parent)/parent/dashboard/page.tsx` → `/parent/dashboard`
- `src/app/(staff)/staff/dashboard/page.tsx` → `/staff/dashboard`
- `src/app/(admin)/admin/dashboard/page.tsx` → `/admin/dashboard`

`npm run build` succeeds with all six routes (incl. `/_not-found`) prerendered as static. `npm run dev` boots; `curl http://localhost:3000/` returns HTTP 200 and the public landing HTML.

## Pitfalls encountered

1. **Route group URL collision.** First scaffold put `dashboard/page.tsx` directly under each role group (`(parent)/dashboard`, `(staff)/dashboard`, `(admin)/dashboard`). All three resolved to `/dashboard`, which is a build-time error: _"You cannot have two parallel pages that resolve to the same path."_ Per the route-groups doc: groups are **organisational only**; URL segments must still be distinct. Fix: nest each role's pages under a role-named segment inside the group, e.g. `(parent)/parent/dashboard/page.tsx` → `/parent/dashboard`. This is now the documented folder pattern for the auth-required role groups.
2. **`middleware` is renamed to `proxy`.** v16 deprecates `middleware.ts`. The new file is `proxy.ts` (or `.js`) and the function name is `proxy(request)`. Critically, `proxy` only runs on the Node.js runtime — Edge runtime is **NOT** supported (codepath dropped in v16). For Auth.js v5 + Supabase, this is fine because we're on `nodejs` anyway, but any planned Edge-only logic must move into a Route Handler. The `skipMiddlewareUrlNormalize` flag is renamed `skipProxyUrlNormalize`.
3. **Sync request-time APIs are gone.** `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are now async-only. v15's temporary sync compatibility is removed. Pattern is `const cookieStore = await cookies()` and `const { slug } = await params`. The repo is on a clean v16 install so no migration was needed, but every Server Action and page that touches these has to be `async`.
4. **`next lint` is removed.** `next build` no longer runs ESLint. CI must run ESLint directly. The CI workflow added in this PR (`.github/workflows/ci.yml`) does so.
5. **PPR / `experimental_ppr` is removed.** v16 replaces it with `cacheComponents: true` in `next.config.ts`. The two are not the same — `cacheComponents` requires the `'use cache'` directive and the new `cacheLife`/`cacheTag` (no `unstable_` prefix). Decision: do **not** enable `cacheComponents` in this PR. Leave it default-off. Re-evaluate during the public Takwim spike when we know exactly which routes need PPR.
6. **Turbopack is default.** v16 ships Turbopack as the default for `next dev` and `next build`; the `--turbopack` flag is no longer needed. If a future webpack-only plugin is required, `next build --webpack` is the escape hatch. Build output no longer reports `size` / `First Load JS` (deemed inaccurate for RSC apps).
7. **Workspace-root inference warning.** During `npm run build` from inside a git worktree, Next.js detected two lockfiles (parent repo + worktree) and warned that the inferred workspace root may be wrong. Harmless in this PR (build succeeds), self-resolves once the branch merges to `main` because there will only be one lockfile. If it ever blocks, set `turbopack.root` in `next.config.ts`.
8. **Server Functions are reachable via direct `POST`.** The mutating-data doc explicitly warns: "Server Functions are reachable via direct POST requests, not just through your application's UI." Auth + RBAC must be enforced inside every Server Function — the proxy/middleware can't be relied on, and a refactor that moves a Server Function to a different path can silently lose proxy coverage. This locks ADR-002 (app-layer is source of truth) more tightly and is a load-bearing constraint for [`api-spec.md`](../03-design/api-spec.md).
9. **Parallel routes need explicit `default.js`.** Builds will now fail without them. We don't use parallel slots in this PR, but flagging here so the wireframes for Conflict Modal and Citation Drawer (both candidates for parallel routes) remember the requirement.

## Decision

Adopt Next.js 16.2.4 as locked in `package.json`. **Server Actions for mutations + Route Handlers for streaming and public-cached endpoints** (already in [ADR-004](../00-meta/decision-log.md)); confirmed the runtime semantics match. **`proxy` (not `middleware`)** is the file convention going forward — note this in [`auth-and-session-design.md`](../03-design/auth-and-session-design.md). **Cache Components stays opt-out for v1**: enable selectively for `(public)/takwim` and similar read-heavy public routes once the data shape is known. **Route group folder structure**: each non-public group nests pages under a role-named segment inside the group (`(parent)/parent/...`), per pitfall 1. This needs to land in [`folder-structure-spec.md`](../03-design/folder-structure-spec.md).

## Code patterns to copy in FYP2

```tsx
// Pattern 1 — Server Action with auth + RBAC + revalidation
// app/actions/events.ts
"use server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user, "event:create")) {
    throw new Error("Forbidden");
  }
  // ... mutate, conflict-check, persist ...
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
```

```tsx
// Pattern 2 — async page with typed params
// app/(staff)/staff/events/[id]/page.tsx
export default async function EventPage(props: PageProps<"/staff/events/[id]">) {
  const { id } = await props.params;
  // ... fetch event, render ...
}
```

```ts
// Pattern 3 — streaming Route Handler for RAG (ADR-004)
// app/api/rag/ask/route.ts
import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  // ... validate body, build context, stream LLM response ...
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

```ts
// Pattern 4 — proxy (formerly middleware) for session refresh + auth gating
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // ... read session cookie, refresh if needed, redirect anonymous users ...
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## Open questions / follow-up

- Decide per-route which to enable `cacheComponents` on (Takwim, public news). Track in the public-Takwim spike when we get there.
- Confirm Auth.js v5 beta API surface integrates cleanly with `proxy.ts` (Edge runtime gone) — covered by `spike-authjs-v5-app-router.md` (next stacked PR).
- `next typegen` produces `PageProps`/`LayoutProps`/`RouteContext` global types — adopt in `tsconfig.json` once the dev server has run once and emitted them; today we rely on `next build`'s typegen pass.

## References

- [`../../AGENTS.md`](../../AGENTS.md) — repo-level Next.js doc-reading mandate.
- [`../00-master-plan.md`](../00-master-plan.md) §11 — locked design decisions.
- [`../00-meta/decision-log.md`](../00-meta/decision-log.md) — ADR-002, ADR-003, ADR-004.
- [`../01-overview/p0-decisions-to-lock.md`](../01-overview/p0-decisions-to-lock.md) — Q6 (session strategy).
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
