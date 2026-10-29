# UI System, Accessibility, and Responsive Layout

Status: **Required direction for future interface work**

This document defines how Upwards should evolve its component system and
desktop experience. It must be read before changing shared UI primitives,
forms, dialogs, drawers, navigation, responsive layout, accessibility behavior,
or page-level information architecture.

## Decision summary

Upwards will align its shared primitives with shadcn/ui and Radix rather than
replace the interface wholesale.

The repository already contains most of the shadcn architecture:

- Radix primitives
- Class Variance Authority variants
- The `cn()` utility using `clsx` and `tailwind-merge`
- Tailwind design tokens and CSS variables
- Lucide icons
- shadcn-derived Button, Dialog, Select, Calendar, Input, Textarea, Label,
  DropdownMenu, and Badge source files

shadcn/ui is source code copied into the repository, not a runtime component
package. Adopting it therefore means establishing an upstream baseline,
registry configuration, ownership rules, and consistent accessibility
behavior. It does not mean removing every custom component.

The target is:

1. Use shadcn/Radix primitives for generic interaction behavior.
2. Keep Upwards-specific composition and visual language.
3. Replace hand-rolled generic overlays and controls where a proven primitive
   provides better keyboard, focus, and screen-reader behavior.
4. Stay a phone app. A window wider than a phone shows a notice and a 430px
   frame with the same layout. Do not build a sidebar or a two-column page.
   **Changed 2026-10-29.** The adaptive desktop shell is withdrawn: it was a
   second information architecture for a product used on a phone.
5. Preserve the mobile PWA experience. It is the product, not a starting point.

**Quiet library (2026-10-29).** `app/src/components/quiet/` is a proposed visual
layer, shown at `/design` and not used by Today, Journal, or You. It composes
Radix the same way `components/ui` does. It does not replace those primitives.
See `design-and-branding.md` §5.1.

## Current state

### Existing shared system

Shared primitives live in `app/src/components/ui/`. The most important
customizations are:

- `button.tsx`: task, dashed, bare, and floating-navigation variants
- `dialog.tsx`: mobile visual-viewport centering, size, and overlay extensions
- `calendar.tsx`: locale, logical-day, journal, and focus behavior
- `settings-section.tsx`: product-specific settings composition
- `floating-back-button.tsx`: product-specific mobile navigation

The `app/src/components/forms/` layer composes these primitives into reusable
Upwards form behavior. It protects feature code from primitive details and is
used broadly across activity, task, journal, and settings dialogs.

These are assets to preserve, not boilerplate to delete.

### Inconsistencies

The system is only partially standardized:

- No `components.json` records the shadcn registry configuration.
- Radix imports mix the unified `radix-ui` package with individual
  `@radix-ui/react-*` packages.
- Several drawers and lightboxes implement overlay, dismissal, and positioning
  manually.
- Some forms bypass shared Input and Label primitives.
- Focus-ring styles and control sizes vary.
- Destructive button styles are repeated at feature call sites.

### Phone shell

**Updated 2026-10-29.** The desktop shell from B1b is withdrawn. The notice and
the 430px frame are back, and they are the wide-window presentation.
`components/layout/app-shell.tsx` is the phone shell:

- The document scrolls and a frosted three-tab bar (Today, Journal, You)
  sits at the bottom. There is no sidebar. Home was removed 2026-10-29.
  A window wider than 480px keeps this layout inside a 430px frame
  (`index.css`, `.mobile-frame`) under a notice. `--app-tab-bar-h` (set on `.app-shell-tabs`
  in `index.css`) is the bar's height; fixed bottom controls add it to their
  offset, so the corner back button, the Memories add
  button, and the install prompt clear it. Today has no full-width bottom bar:
  day navigation is a sticky frosted header at the top, and Projects and the
  quick memo are one small frosted dock (`TodayQuickActions`) above the tab bar,
  kept at the bottom for thumb reach (2026-10-14). Cards keep their rounded
  corners but sit in a thin side gutter on phones: `AppPageShell` and Today use
  `px-2` below `md` (the page title keeps a wider inset) and `p-4` from `md`.
  Pages should get this from `AppPageShell`, not by adding their own padding.
  While a session is running, Today shows it in the sticky header row itself
  (`RunningActivityBar`: name, clock, Stop; tapping the name opens the session).
  The date control is centered when nothing runs; with a session it tightens and
  moves to the start so the card takes the rest of the row. It keeps the
  group-colour fill and glow the running pill has always had, a deliberate
  exception recorded in `design-and-branding.md` §2.3 (2026-10-14).
- There is no `md` shell. On a wide window the phone frame
  (`transform: translateZ(0)`) is the containing block, and overlays portal
  into `#mobile-frame` rather than covering the monitor. The tab bar and the
  corner back button stay.
- Pages are one column. The Journal's `lg:` reader rail and Settings' `lg:`
  panel rail do not apply, because those breakpoints never match. Bottom
  sheets stay sheets.
- `⌘/Ctrl+K` opens a command palette (a Dialog with a combobox/listbox; filter
  logic in `lib/navigation/filter-commands.ts`). It covers destinations, send
  feedback, and appearance, and, from two characters typed, the journal record:
  days and memories that match, newest first (B3c). Memos, activities and
  sessions join once each has a destination that can open one item.
  `⌘/Ctrl+1`-`3` open the tabs and are ignored while a dialog is open.
- Destinations and which tab owns a route live in `lib/navigation/destinations.ts`.
  The "You" tab opens Settings until the compass (B5) exists.
- The primary nav is a `<nav>` landmark, the active item has
  `aria-current="page"`, a skip link precedes the content, and the content pane
  is `<main id="main-content">`.

## Component ownership model

Shared components belong to one of three layers.

### Layer 1: accessible primitives

Location: `app/src/components/ui/`

Purpose:

- Semantics
- Keyboard interaction
- Focus management
- ARIA relationships
- Portals and dismissal
- Design tokens and variants

Prefer current shadcn registry source backed by Radix for generic components
such as:

- Button
- Input, Textarea, Label
- Dialog and AlertDialog
- Sheet
- Select
- DropdownMenu
- Tooltip
- Popover
- Calendar
- Tabs
- Table
- Alert
- Badge
- Separator
- Skeleton

Only add primitives that the product uses. Do not install the entire registry
for hypothetical future needs.

Upwards-specific variants may live in this layer when they are reused and
represent one stable interaction pattern. The existing task and floating button
variants are examples.

### Layer 2: product patterns

Locations include:

- `app/src/components/forms/`
- `app/src/components/layout/`
- Other deliberately shared feature-pattern directories

Purpose:

- FormDialog and field composition
- ResponsivePanel behavior
- Page headers and breadcrumbs
- Navigation shells
- Empty/loading/error states
- Date controls
- Conflict and status presentation

These components compose primitives and encode Upwards behavior. They should
not reimplement focus trapping, keyboard dismissal, or control semantics.

### Layer 3: feature components

Feature components own product workflows and content. They use shared
primitives and patterns rather than adding local versions of generic buttons,
inputs, dialogs, sheets, tooltips, or menus.

Custom controls remain appropriate when no standard primitive represents the
interaction. The time dial, journal media presentation, map picker, task
completion controls, and data visualizations are examples. They must still
meet the same accessibility and responsive requirements.

## shadcn alignment policy

### Preserve

Do not replace these with unmodified registry files:

- Button's Upwards-specific variants and sizes
- Dialog's visual-viewport and overlay extensions
- Calendar's locale, logical-day, and journal behavior
- The FormDialog and shared form-field layer
- SettingsSection
- Product navigation and task controls

When syncing a registry component, inspect the upstream diff and reapply
documented product extensions deliberately. Never use a CLI overwrite flag
against customized files without reviewing the diff.

### Adapt

Thin primitives such as Input, Textarea, Label, Select, and DropdownMenu should
track the current shadcn/Radix implementation where practical. Normalize Radix
imports as a dedicated migration rather than carrying two styles indefinitely.

Add a Vite-compatible `components.json` before using the CLI. It must point to
the existing aliases, Tailwind configuration, global CSS, and
`app/src/components/ui` directory. Initialization must not overwrite existing
tokens or primitives.

### Replace

Replace hand-rolled generic behavior incrementally:

- Bottom/top drawers should use Sheet or a shared ResponsivePanel.
- Portal lightboxes should use Dialog where modal semantics apply.
- Destructive confirmations should use AlertDialog.
- Raw form controls should use Input, Label, and shared form patterns.
- Generic status/error presentation should use Alert.
- Generic hover/focus hints should use Tooltip with keyboard support.

Replacement is justified by better behavior, not merely by matching a registry.

## Accessibility requirements

Accessibility is a release requirement for shared UI migrations.

### Semantics and labeling

- Every form control has a persistent accessible label.
- Placeholder text is not a label.
- Every modal has an accessible title; descriptions are present when context is
  not obvious.
- Icon-only controls have an `aria-label`; `title` alone is insufficient.
- Avoid nested interactive elements.
- Use landmarks for application navigation and main content.
- Status and synchronization changes use suitable live regions without
  repeatedly interrupting screen-reader users.

### Keyboard and focus

- Dialogs and sheets trap focus, close with Escape when safe, and restore focus
  to their trigger.
- Every pointer or touch gesture has a visible keyboard-accessible equivalent.
- Swipe day navigation also has previous/next controls and arrow-key behavior.
- Long-press actions also have explicit buttons or menus.
- Charts expose keyboard-focusable data or an equivalent accessible summary.
- Tooltips can be triggered by focus and remain available long enough to read.
- Focus indicators are consistent and visible against every theme.

### Dialog width

Modals are sized by `DialogContent`'s `size`, as plain classes a caller can
override with `sm:max-w-*`: on phones they run to 24px from each edge; from `sm`
`size="sm"` (the default for `FormDialog`) is up to `max-w-md` and
`size="default"` up to `max-w-xl`. Do not pin a fixed `w-80`/`w-96`, and do not
add `data-size` selectors: they out-rank a caller's override, which is why every
form modal used to be stuck at 320px (2026-10-14). Compact pickers (calendar,
time dial) opt into `sm:max-w-sm` on purpose.

### Pointer, touch, and motion

- A choice among a few options (theme, language, hemisphere, form selects) uses
  the shared `Select`; Settings wraps it as `SettingsSelect`. Do not use
  `DropdownMenu` for choosing a value: Radix opens its trigger on pointer-down,
  so a finger that lands on it to start a scroll opens the menu. `Select` opens
  a touch on release. `DropdownMenu` is for menus of actions (2026-10-14).

- Primary controls should provide approximately `44px` touch targets.
- Smaller visual controls need sufficient hit area and separation.
- Hover behavior must not be the only way to discover or invoke an action.
- Animations honor reduced-motion preferences.
- Pointer interactions must not interfere with browser zoom, text input, or
  scrolling.

### Content and visual behavior

- Text, status, and focus colors meet WCAG contrast requirements in every
  palette and theme.
- Color is not the only status signal.
- Desktop content is selectable unless selection would break a deliberate
  control interaction.
- Loading, empty, error, offline, and conflicted states receive explicit,
  consistent presentation.

Automated accessibility checks are necessary but do not replace keyboard and
screen-reader testing.

## Responsive architecture

The same routes and product concepts remain available at all viewport sizes.
Navigation chrome and information density adapt around them.

### Mobile: below `md`

Preserve the existing mobile-first experience:

- Bottom action/navigation bar
- Sheet-based projects and menu surfaces
- Compact single-column pages
- Touch swipe where useful
- Mobile visual-viewport handling
- PWA-safe area behavior. Installed iPhone apps omit
  `apple-mobile-web-app-status-bar-style`. `black-translucent` makes iOS 26.1
  and iOS 27 draw a blur over the notch and down across the top of the page,
  and `default` does not stop it. Apple's guidance is to leave the tag out so
  the status bar takes the page color. `viewport-fit=cover` stays so
  `safe-area-inset-top` is defined. While `html.ios-standalone` is set
  (home-screen iPhone/iPad only), `#ios-status-shield` — a real fixed element,
  not a pseudo — is an opaque canvas strip at least 8px tall, flush with the
  top, with no `backdrop-filter`. That is the element iOS samples, and it is
  what removes the scrim. The shell starts below the strip. Today's sticky
  header sticks to the strip on phones and to the scrollport from `md`, and on
  that install it is opaque paper: a frosted top bar is what the scrim was
  sampling. The running timer's glow is clipped to that header so it cannot
  paint into the status band. iOS reads a status-bar meta tag, if one was
  present, when the icon is added to the Home Screen; the shield applies with
  the app update. Installed iPhone apps also have
  no pull-to-refresh. `AppRefreshActions` (You tab, Cloud sync card, Sync
  issues) is the manual control: Sync now runs a sync without reloading, and
  Check for app update reloads only when a newer service worker activates.

Standardizing a drawer on Sheet must not regress keyboard appearance, safe-area
padding, touch scrolling, or the current logical-day workflows.

### Wide windows

Do not build a desktop layout. Past 480px the page is the phone frame
described above. Keyboard shortcuts remain the keyboard path for the same
actions. There is one set of routes.

## Overlay and responsive-panel policy

Sheets and dialogs are the overlays. Do not add a desktop inline panel as a
second presentation of the same content.

Portals target `#mobile-frame` (`lib/mobile-frame.ts`). Modal overlays,
focus containment, z-index, and scroll locking should behave consistently
whether the app is mobile, installed as a PWA, or displayed in the desktop
shell.

## Migration assessment

### Low complexity

- Add and validate `components.json`.
- Document customized primitives.
- Align Input, Textarea, Label, Select, and DropdownMenu.
- Replace raw auth inputs.
- Add missing dialog titles and control labels.
- Consolidate destructive button variants.

These changes are mostly confined to shared primitives and thin wrappers.

### Medium complexity

- Normalize Radix dependencies.
- Add Sheet and migrate notifications/menu drawers.
- Add AlertDialog and standardize destructive confirmations.
- Replace journal lightboxes with Dialog.
- Establish accessible Tooltip/Alert/status patterns.

These changes affect overlay layering, focus, and mobile visual-viewport
behavior and therefore require interaction tests.

### High complexity

- Migrate the activity/projects drawer.
- Replace the phone-frame shell with adaptive navigation and scrolling.
- Add desktop page headers, breadcrumbs, and keyboard interaction parity.
- Adapt Today, Journal, and Settings into wide layouts.

These are cross-cutting layout and information-architecture changes. They
should use feature flags or incremental route-by-route delivery.

### Retain as custom

Do not force registry replacements for:

- FormTimeField's custom dial
- Journal map and media workflows
- Task completion controls
- Upwards-specific routine and date behavior

Improve their accessibility and responsiveness in place or wrap them with
shared primitives.

## Delivery sequence

1. Establish baseline screenshots, keyboard flows, and automated accessibility
   checks for current critical paths.
2. Add `components.json` without overwriting existing source.
3. Record custom primitive extensions and normalize token/focus behavior.
4. Fix known labeling, focus, nested-control, tooltip, and target-size issues.
5. Add Sheet, AlertDialog, Alert, Tooltip, Separator, and other primitives only
   as required.
6. Migrate simple drawers and confirmations, then the projects drawer.
7. The phone shell is the shell. Steps that added a sidebar and a two-column
   page are withdrawn (2026-10-29). Do not resume them.

Do not combine primitive upgrades and a Tailwind major-version upgrade into
one unreviewable change. Do not restart the desktop shell.

## Required verification

Shared UI and responsive changes must verify:

- Phone portrait, and a wide window (notice plus the 430px frame)
- Browser zoom and text scaling
- Keyboard-only navigation
- Focus trapping, Escape behavior, and focus restoration
- Screen-reader names and status announcements
- Touch scrolling and on-screen keyboard behavior
- Reduced motion
- Light and dark (System / Light / Dark are the only appearance options; see
  `product-scope.md`)
- Route navigation and browser Back/Forward behavior
- Dialogs opened from dialogs or sheets
- Overlay stacking with notifications, projects, calendars, and media
- Today swipe plus its desktop keyboard/button equivalent
- Journal media and map interactions
- Chart tooltip and accessible-summary behavior
- Offline, syncing, error, and conflict states
- No horizontal overflow or hidden actions at intermediate widths

Add component and browser-level tests before broad primitive replacement. The
current unit suite does not cover UI behavior, so visual inspection alone is
not sufficient for a migration of this scope.

## Rules for AI agents and contributors

Before changing shared UI or responsive behavior:

1. Read this complete document.
2. Classify the component as primitive, product pattern, or feature component.
3. Check whether an existing shared primitive or pattern already owns the
   behavior.
4. Preserve documented Upwards extensions when syncing shadcn source.
5. State phone, keyboard, focus, labeling, and reduced-motion behavior.
6. Do not add a raw generic control when an existing primitive fits.
7. Do not force a shadcn component onto a genuinely product-specific
   interaction.
8. Do not add a desktop layout, a sidebar, or a breakpoint variant.
9. Do not remove phone behavior to make a wide window look like a desktop app.
10. Include accessibility and responsive verification proportional to the
    interaction risk.

An intentional departure from this direction must update this document and
explain the product tradeoff before implementation.
