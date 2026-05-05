# Spike — Tailwind CSS v4 (4.2.2)

**Status.** Done.
**Author.** Muhammad Arif Hakimi.
**Started / Completed.** 2026-05-05 / 2026-05-05.
**Effort.** ~0.25 day.

## Goal

Confirm that Tailwind v4's config-less, CSS-first pipeline works under Next.js 16 + Turbopack-by-default, and lock the design-token entry point so [`ui-design-system.md`](../03-design/ui-design-system.md) can build on a known surface.

## Versions pinned

- `tailwindcss@4.2.2` (declared as `^4`, resolved via `npm install`)
- `@tailwindcss/postcss@4.2.2`

## Docs read

- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — App Router Tailwind setup; the v4 path uses only `tailwindcss` + `@tailwindcss/postcss` (no `autoprefixer`, no `init`, no `tailwind.config.js`).
- `node_modules/next/dist/docs/01-app/02-guides/tailwind-v3-css.md` — kept for reference; explicitly redirects to the v4 setup in `11-css.md`.
- https://tailwindcss.com/docs/installation/using-postcss — v4 install reference, cross-checked.
- https://tailwindcss.com/docs/theme — `@theme` and CSS-variable-based design tokens.

## Hello-world reproduced

The repo's `src/app/globals.css` already uses the v4 config-less pattern (committed in the initial scaffold):

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

The `postcss.config.mjs` only registers `@tailwindcss/postcss`. The new placeholder pages (e.g. `(parent)/parent/dashboard/page.tsx`) use stock utilities (`mx-auto`, `max-w-5xl`, `px-6`, `py-16`, `text-2xl`, `font-semibold`, `text-zinc-600`); `npm run build` produces the correct CSS bundle and `curl http://localhost:3000/` returns markup using those classes.

## Pitfalls encountered

1. **No `tailwind.config.js`.** v4's primary surface is CSS, not JavaScript. Theme extensions live inside the `@theme` (or `@theme inline`) block in `globals.css`, not in a config file. The 7 minutes I almost spent looking for `tailwind.config.ts` were wasted because v4 doesn't generate one and doesn't need one. Customisation is via CSS variables.
2. **`autoprefixer` is unnecessary.** v4's PostCSS plugin handles vendor prefixes itself. The v3 install instructions in `tailwind-v3-css.md` still list it; **don't** copy that into a v4 project — it'll work but adds a redundant dependency.
3. **Content scanning is automatic.** v3 required a `content: [...]` glob in `tailwind.config.js`. v4 auto-detects template files (anything imported into the build graph that contains class strings). No glob to maintain.
4. **No `@tailwind base; @tailwind components; @tailwind utilities;` directives.** v4 replaces the three `@tailwind` directives with a single `@import "tailwindcss";`. Old habit; the upgrade docs flagged this explicitly.
5. **`@theme inline` vs `@theme`.** `@theme inline` exposes the variables to utility classes _without_ also emitting them as `:root` custom properties. The scaffold uses `@theme inline` plus a separate `:root { --background: ...; }` block so the variable name is reusable in component CSS while the utility classes (`bg-background`, `text-foreground`) get the same value. This pattern works under v4 and is the one to copy in [`ui-design-system.md`](../03-design/ui-design-system.md).
6. **PrintWidth + class lists.** Long Tailwind class strings hit Prettier's `printWidth: 100` and wrap the JSX. Acceptable; the alternative (a `prettier-plugin-tailwindcss` rewrite) is out of scope for this PR.

## Decision

Lock Tailwind v4 with `tailwindcss@^4` + `@tailwindcss/postcss@^4`. Design tokens live in `src/app/globals.css` under `@theme inline`. No `tailwind.config.{js,ts}`. No `autoprefixer`. The scaffold values (`--color-background`, `--color-foreground`, `--font-sans`, `--font-mono`) are the seed; `ui-design-system.md` will add brand colours, spacing scale, focus ring, and the BM/EN-aware font stack.

## Code patterns to copy in FYP2

```css
/* Pattern 1 — design tokens via @theme inline */
/* src/app/globals.css */
@import "tailwindcss";

:root {
  --color-brand-500: oklch(63% 0.18 250);
  --color-brand-600: oklch(55% 0.18 250);
  --radius-card: 0.75rem;
}

@theme inline {
  --color-brand: var(--color-brand-500);
  --color-brand-strong: var(--color-brand-600);
  --radius-card: var(--radius-card);
}
```

```tsx
// Pattern 2 — using a token in a component
// src/components/ui/Card.tsx
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}
```

## Open questions / follow-up

- Decide whether to adopt `prettier-plugin-tailwindcss` for class-name ordering. Mostly cosmetic — defer to the UI design system spike when the component library starts.
- Confirm whether the school needs a Jawi-aware font stack. Pending P0-Q4 confirmation against real document samples; until then, Geist Sans/Mono is sufficient.

## References

- [`../../AGENTS.md`](../../AGENTS.md)
- [`../00-master-plan.md`](../00-master-plan.md) §11.3 (i18n NFR), §11.7 (UI design system).
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- https://tailwindcss.com/docs/installation/using-postcss
- https://tailwindcss.com/docs/theme
