import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Local agent worktrees (Claude Code): each worktree has its own checkout
    // under .claude/worktrees/* and brings its own .next build cache. ESLint
    // would otherwise traverse those and surface thousands of generated-code
    // warnings unrelated to the active branch.
    ".claude/**",
    "supabase/migrations/**",
  ]),
]);

export default eslintConfig;
