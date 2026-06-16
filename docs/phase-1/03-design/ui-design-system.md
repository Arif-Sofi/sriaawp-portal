# UI Design System

This document specifies the semantic token palette, component inventory, and six-state convention used across the SRIAAWP Portal front-end.

---

## 1. Semantic Token Reference

All tokens are defined in `src/app/globals.css` under `:root` (light) and `.dark` (dark). The Tailwind v4 `@theme inline` block maps each to a `--color-*` CSS custom property so utility classes such as `bg-primary` and `text-primary-foreground` resolve automatically.

| Token name              | Light value | Dark value  |
|-------------------------|-------------|-------------|
| `--background`          | `#ffffff`   | `#020617`   |
| `--foreground`          | `#0f172a`   | `#e2e8f0`   |
| `--card`                | `#ffffff`   | `#0f172a`   |
| `--card-foreground`     | `#0f172a`   | `#e2e8f0`   |
| `--popover`             | `#ffffff`   | `#0f172a`   |
| `--popover-foreground`  | `#0f172a`   | `#e2e8f0`   |
| `--primary`             | `#047857`   | `#10b981`   |
| `--primary-foreground`  | `#ffffff`   | `#022c22`   |
| `--secondary`           | `#f1f5f9`   | `#1e293b`   |
| `--secondary-foreground`| `#0f172a`   | `#e2e8f0`   |
| `--muted`               | `#f1f5f9`   | `#1e293b`   |
| `--muted-foreground`    | `#64748b`   | `#94a3b8`   |
| `--accent`              | `#ecfdf5`   | `#064e3b`   |
| `--accent-foreground`   | `#065f46`   | `#d1fae5`   |
| `--destructive`         | `#dc2626`   | `#ef4444`   |
| `--destructive-foreground`| `#ffffff` | `#ffffff`   |
| `--success`             | `#16a34a`   | `#22c55e`   |
| `--success-foreground`  | `#ffffff`   | `#022c22`   |
| `--warning`             | `#d97706`   | `#f59e0b`   |
| `--warning-foreground`  | `#ffffff`   | `#1c1917`   |
| `--info`                | `#2563eb`   | `#3b82f6`   |
| `--info-foreground`     | `#ffffff`   | `#ffffff`   |
| `--border`              | `#e2e8f0`   | `#1e293b`   |
| `--input`               | `#e2e8f0`   | `#1e293b`   |
| `--ring`                | `#047857`   | `#10b981`   |

Dark mode activates automatically when the `.dark` class is present on any ancestor element. No `dark:` Tailwind variants are used in component source; both themes are served by the same utility classes because the CSS variables flip.

---

## 2. Component Inventory

| Component | Location | Purpose | Client / Server | Key props |
|-----------|----------|---------|-----------------|-----------|
| `Badge` | `ui/badge.tsx` | Semantic status pill | Server | `variant` (neutral\|primary\|success\|warning\|destructive\|info) |
| `Button` | `ui/button.tsx` | Action trigger | Server | `variant`, `size` |
| `Card` + sub-components | `ui/card.tsx` | Content container | Server | standard HTML div props |
| `Input` | `ui/input.tsx` | Single-line text entry | Server | `ComponentProps<"input">` |
| `Textarea` | `ui/textarea.tsx` | Multi-line text entry | Server | `ComponentProps<"textarea">` |
| `Select` | `ui/select.tsx` | Native dropdown | Server | `ComponentProps<"select">` |
| `Spinner` | `ui/loading.tsx` | Animated loading indicator | Server | `size` (sm\|md\|lg) |
| `Skeleton` | `ui/loading.tsx` | Placeholder content pulse | Server | `ComponentProps<"span">` |
| `EmptyState` | `ui/empty-state.tsx` | Zero-content feedback | Server | `title`, `description?`, `action?` |
| `ConflictBadge` | `ui/conflict-badge.tsx` | Timetable conflict severity indicator | Server | `kind` (HARD\|SOFT), `label?` |
| `CitationChip` | `ui/citation-chip.tsx` | RAG source reference link | Server | `label`, `ComponentProps<"button">` |
| `ChatBubble` | `ui/chat-bubble.tsx` | Chat message bubble with citation footer | Server | `role` (user\|assistant), `children`, `footer?` |
| `FileTable` | `ui/file-table.tsx` | Document list table | Server | `files[]`, `actions?`, `emptyLabel?` |
| `Dialog` | `ui/dialog.tsx` | Modal overlay | Client | `open`, `onClose`, `title?`, `description?`, `footer?` |
| `ToastProvider` / `useToast` | `ui/toast.tsx` | Ephemeral notification system | Client | `variant` (success\|destructive\|info\|warning\|neutral) |
| `Calendar` | `ui/calendar.tsx` | Month grid with event dots | Client | `month`, `events?`, `onSelectDate?` |
| `DateTimeRange` | `ui/date-time-range.tsx` | Start/end datetime picker with validation | Client | `startISO?`, `endISO?`, `onChange?`, `error?` |
| `Field` | `ui/form/field.tsx` | Form field wrapper with label + error + hint | Server | `label?`, `htmlFor?`, `error?`, `hint?` |
| `Label` | `ui/form/field.tsx` | Accessible form label | Server | `ComponentProps<"label">` |
| `FieldError` | `ui/form/field.tsx` | Inline field error message | Server | `ComponentProps<"p">` |
| `LanguageToggle` | `shared/language-toggle.tsx` | BM / EN locale switcher | Client | none (reads/writes LOCALE_COOKIE) |
| `Breadcrumbs` | `shared/breadcrumbs.tsx` | Page hierarchy navigation | Server | `items[]` ({label, href?}) |
| `Nav` | `shared/nav.tsx` | Top navigation bar with mobile collapse | Client | `brand?`, `links?`, `right?` |
| `AppShell` | `shared/app-shell.tsx` | Full-page layout wrapper | Server | `children`, `nav?`, `footer?` |

---

## 3. Six UI State Convention

Every screen or data surface in the portal must handle six states explicitly. The table below maps each state to the appropriate component primitives.

| State | Description | Component primitives |
|-------|-------------|---------------------|
| **Default** | Data loaded and ready for interaction. | Standard content components (Card, FileTable, Badge). |
| **Empty** | Fetch succeeded but the result set is zero items. | `EmptyState` with a descriptive `title` and optional `action`. `FileTable` renders `EmptyState` internally when `files` is empty. |
| **Loading** | Async operation in progress; result not yet available. | `Spinner` for full-section or button-level waits; `Skeleton` for layout-preserving placeholders. |
| **Error** | A server or network operation has failed. | `FieldError` for form-field-scoped messages; destructive `Badge` or `ConflictBadge kind="HARD"` for record-level errors; `Dialog` with destructive footer for critical failures. |
| **Success** | An operation completed without error. | Success `Badge`; `useToast` with `variant="success"` for transient confirmations. |
| **Validation** | User-supplied input violates a constraint before submission. | `Field` with `error` prop (renders `FieldError` beneath the control); `DateTimeRange` shows an inline validation message when end is not after start; `Input` with `aria-invalid` for screen-reader signalling. |

Each state must be reachable by a distinct code path and must be visually distinguishable without relying on colour alone (text labels, icons, or ARIA attributes accompany colour cues).
