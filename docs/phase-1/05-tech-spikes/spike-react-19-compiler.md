# Spike — React 19.2 + React Compiler 1.0

**Status.** Done.
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-05-05 / 2026-05-05.
**Effort.** ~0.25 day.

## Goal

Decide whether to keep `babel-plugin-react-compiler@1.0.0` enabled via `next.config.ts`'s `reactCompiler: true`, or whether to disable it for FYP2 to keep build times tight. Capture the auto-memoisation behaviour so component authors know what manual `useMemo` / `useCallback` they no longer need.

## Versions pinned

- `react@19.2.4`
- `react-dom@19.2.4`
- `babel-plugin-react-compiler@1.0.0` (devDependency)
- `next@16.2.4` with `reactCompiler: true` in `next.config.ts`

## Docs read

- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md` — Next.js' opt-in flag and `compilationMode: "annotation"` mode.
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (§ "React Compiler Support" + "React 19.2") — compiler is **stable** in v16; flag is promoted from `experimental` to top-level. Default is **off**, "as we continue gathering build performance data."
- https://react.dev/learn/react-compiler/introduction — official React Compiler intro, semantics, and "rules of React" prerequisites.
- https://react.dev/blog/2025/10/01/react-19-2 — React 19.2 release announcement (View Transitions, `useEffectEvent`, `<Activity>`).

## Hello-world reproduced

The repo's `next.config.ts` already enables the compiler:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
```

`babel-plugin-react-compiler@1.0.0` is in `devDependencies`. With this flag, `npm run build` succeeds for the route-group scaffold (six static routes), and `npm run dev` boots without warnings. The placeholder pages contain no `useMemo` / `useCallback` — the compiler's contribution is implicit (the auto-memoised RSC/Client outputs aren't visible at this scale yet) but the **build pipeline integrates cleanly**, which is the only fact this spike needs.

## Pitfalls encountered

1. **Babel plugin slows builds.** Per the upgrade-to-v16 doc: _"Expect compile times in development and during builds to be higher when enabling this option as the React Compiler relies on Babel."_ Next.js ships a custom SWC analyser that limits the Babel plugin to files with JSX/Hooks, so the slowdown is bounded; but it is not zero. At our scale (one school portal, expected ~80 components) the cost is negligible. Re-evaluate if `next build` exceeds 60 s.
2. **Default is `compilationMode: 'infer'`.** With the simple `reactCompiler: true` config, the compiler auto-decides which components to memoise. The opposite mode is `compilationMode: 'annotation'`, where only components with a `'use memo'` directive opt in. We're keeping the default; no annotations needed.
3. **"Rules of React" violations break compilation.** The compiler relies on rules like _"don't mutate props,"_ _"hooks at top level,"_ _"don't read refs during render."_ Code that violates them silently de-optimises (the compiler skips that component). The `eslint-plugin-react-compiler` rule set is bundled with `eslint-config-next` and will flag violations during CI lint — a free safety net.
4. **Server Components are out of scope.** The compiler memoises client-component renders. RSC ('use server' files and async server components) are not affected. Most of the SRIAAWP Portal is RSC-first; this is fine — the compiler still pays off for interactive client islands (Composer, ConflictModal, FileTable, ChatBubble).
5. **`useMemo` / `useCallback` are still allowed.** The compiler doesn't error on them; it just makes most of them redundant. New code in FYP2 should _not_ pre-emptively add manual memoisation; if a profile shows a render hotspot the compiler missed (e.g. annotation-mode opt-in, or a deliberate de-optimisation), then add manual memoisation deliberately.
6. **`'use no memo'` is the escape hatch.** Documented in the `reactCompiler.md` reference. Use when the compiler is causing observable bugs (rare; mostly relevant in libraries that rely on referential identity changing on every render).

## Decision

**Keep `reactCompiler: true`.** The compiler is stable as of React 1.0 / Next.js 16, the build cost is minimal at our scale, and the win is _no `useMemo`/`useCallback` boilerplate in client islands_ — which the conflict-modal, chat-composer, and file-table components would otherwise be saturated with. ESLint enforcement of "rules of React" via `eslint-config-next` keeps it honest. No project-level ADR needed; this is a default-on configuration captured here. Re-evaluate if (a) `next build` exceeds 60 s on CI, (b) a client component shows wrong behaviour traceable to compiler mis-memoisation, or (c) a future Next.js minor flips the default.

## Code patterns to copy in FYP2

```tsx
// Pattern 1 — no manual memoisation in client components
// src/components/conflict/ConflictModal.tsx
"use client";

import { useState } from "react";

export function ConflictModal({ blocks }: { blocks: ConflictBlock[] }) {
  const [override, setOverride] = useState(false);
  // No useMemo for `groupedByKind`. The compiler handles it.
  const groupedByKind = blocks.reduce<Record<string, ConflictBlock[]>>((acc, b) => {
    (acc[b.kind] ??= []).push(b);
    return acc;
  }, {});
  // No useCallback for `handleOverride`. The compiler handles it.
  const handleOverride = () => setOverride(true);
  return <ConflictModalView grouped={groupedByKind} onOverride={handleOverride} />;
}
```

```tsx
// Pattern 2 — explicit opt-out when needed
// src/components/.../HotPath.tsx
"use client";

export function HotPath() {
  "use no memo";
  // ... a component that intentionally re-renders on every parent render ...
}
```

## Open questions / follow-up

- Confirm `eslint-plugin-react-compiler` rules are active in `eslint-config-next` once we run `npm run lint` on a real component with intentional rule violations. Today's scaffold has no such cases.
- Measure cold-build time on CI once the codebase has ~30 components. Target: `next build` < 60 s on `ubuntu-latest`. Threshold for re-evaluation.
- Re-check the React 19.2 features (View Transitions, `useEffectEvent`, `<Activity>`) when the wireframes for AI Chat and Event Create are implemented — `<Activity>` is interesting for keeping conflict-modal state warm across navigations, and View Transitions may simplify the citation-drawer animation.

## References

- [`../../AGENTS.md`](../../AGENTS.md)
- [`../00-master-plan.md`](../00-master-plan.md) §5 WS-E.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md`
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (§ React Compiler Support, § React 19.2)
- https://react.dev/learn/react-compiler/introduction
- https://react.dev/blog/2025/10/01/react-19-2
