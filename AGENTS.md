# Agent Instructions

These instructions apply to the entire repository.

- The app is a phone-only PWA. A window wider than a phone shows a notice and a
  430px frame with the same layout; do not add desktop layouts.
- All user-visible copy goes through i18n, in both `en` and `pt`.
- Use theme tokens, not raw hex colors, and make every surface work in light and
  dark mode.
- Every pointer interaction needs a keyboard equivalent; icon-only controls need
  a label.
- Sync operations must stay idempotent, and sync conflicts stay reviewable in
  the app.
- Follow the scoped rules in `.cursor/rules/` (Supabase migration workflow,
  shared UI interaction states, What's new copy).
