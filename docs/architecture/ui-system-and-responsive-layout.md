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
4. Build a genuinely adaptive desktop shell rather than displaying the mobile
   app in a centered phone frame.
5. Preserve the existing mobile-first PWA experience.

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

### Desktop behavior

At `md`, `app/src/App.tsx` currently:

- Displays a "mobile experience" notice.
- Limits the entire app to `430px`.
- Centers the phone-shaped frame in the viewport.
- Keeps mobile drawers, floating controls, and navigation unchanged.

There is no wide-screen information architecture, persistent desktop
navigation, or `lg`/`xl` page layout. This is a viewport simulation, not desktop
support.

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

### Pointer, touch, and motion

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
- PWA-safe area behavior

Standardizing a drawer on Sheet must not regress keyboard appearance, safe-area
padding, touch scrolling, or the current logical-day workflows.

### Desktop: `md` and above

Replace the phone frame with an application shell:

- Persistent sidebar or navigation rail
- One main content scroll owner
- Fluid content column
- Stable top/page header for date controls, breadcrumbs, notifications, sync
  status, and page actions
- Mobile bottom navigation hidden
- Floating back controls replaced by breadcrumbs or page-header navigation
- Drawers promoted to inline or anchored panels where appropriate

The shell should use available width while retaining readable page-specific
maximums. Do not impose one global `430px` limit.

### Wide desktop: `lg` and above

Pages may use master-detail and multi-column layouts:

| Area | Desktop behavior |
| --- | --- |
| Today | Journal/day context and tasks/timeline in coordinated columns |
| Journal | Search/entry list plus selected-entry reader |
| Settings | Settings navigation beside the selected panel |
| Logs | Filterable, selectable table-like presentation |
| Conflicts | Issue list beside conflict details and resolution controls |

Multi-column layout must collapse cleanly when resized. Component behavior
should depend on the space it receives; container queries may be used for
chart/card density where viewport breakpoints are insufficient.

### Navigation parity

| Mobile | Desktop |
| --- | --- |
| Menu sheet | Persistent sidebar |
| Projects sheet | Inline/collapsible projects panel |
| Floating back button | Breadcrumbs or page back action |
| Swipe day change | Header controls plus arrow keys |
| Long press | Explicit action or context menu |

Desktop adaptation must not create a second set of routes or divergent product
logic. Shared route and feature state should feed both presentations.

## Overlay and responsive-panel policy

Use one shared abstraction when the same content changes presentation:

- Mobile: Sheet or full-screen Dialog
- Desktop: inline panel, anchored panel, or standard Dialog

The content and actions should be shared. Avoid rendering two independently
maintained feature implementations solely for different breakpoints.

Portals must target a deliberate application overlay root. Modal overlays,
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
7. Introduce the adaptive AppShell while keeping mobile behavior unchanged.
8. Add persistent desktop navigation and one scroll owner.
9. Adapt pages incrementally, beginning with Settings before the more
   interaction-heavy Today and Journal surfaces.
10. Remove the desktop notice and phone-frame constraint only after navigation,
    overlays, and critical routes work at desktop widths.

Do not combine primitive upgrades, Tailwind major-version upgrades, and the
desktop redesign into one unreviewable change.

## Required verification

Shared UI and responsive changes must verify:

- Phone portrait, phone landscape, tablet, narrow desktop, and wide desktop
  layouts
- Browser zoom and text scaling
- Keyboard-only navigation
- Focus trapping, Escape behavior, and focus restoration
- Screen-reader names and status announcements
- Touch scrolling and on-screen keyboard behavior
- Reduced motion
- Light, dark, and all supported color palettes
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
5. State mobile, desktop, keyboard, focus, labeling, and reduced-motion
   behavior.
6. Do not add a raw generic control when an existing primitive fits.
7. Do not force a shadcn component onto a genuinely product-specific
   interaction.
8. Do not implement desktop support by merely adding a larger max-width.
9. Do not remove mobile behavior while introducing desktop behavior.
10. Include accessibility and responsive verification proportional to the
    interaction risk.

An intentional departure from this direction must update this document and
explain the product tradeoff before implementation.
