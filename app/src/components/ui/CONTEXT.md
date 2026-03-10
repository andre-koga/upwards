# components/ui

**Shared UI primitives.**

## Purpose

Reusable, low-level components. Radix-based where possible.

## Structure

- **Radix:** `button`, `card`, `input`, `label`, `checkbox`, `select`, `popover`, `dropdown-menu`, `alert-dialog`, `textarea`, `calendar`
- **Custom:** `pill`, `badge`, `archived-item-list`, `floating-back-button`, `form-page-layout`

## Conventions

- Use `cn()` from `@/lib/utils` for class merging.
- Use `class-variance-authority` for variants (e.g. `Button`).
- Keep components presentational; no business logic in UI primitives.
- Use `getContrastColor` from `@/lib/color-utils` for text-on-color contrast.
