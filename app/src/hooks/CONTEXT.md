# src/hooks

**Page-level hooks** — routing, loading page data, redirects.

## Purpose

These hooks are used by **multiple pages** or are tied to **route params**. They are not feature-specific.

## Hooks

| Hook             | Purpose                                      | Used by                                           |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| `use-group-page` | Load group by `groupId`, redirect if missing | `group.tsx`, `edit-group.tsx`, `new-activity.tsx` |

## When to add here

- Hook is used by 2+ pages
- Hook is primarily about routing/params (e.g. loading entity by URL id)
- Hook is not tied to a single feature (tasks, activities, settings)

## When NOT to add here

- Hook is only used by one feature → use `components/<feature>/hooks/`
- Hook is global (auth, etc.) → use `lib/` or colocate with feature
