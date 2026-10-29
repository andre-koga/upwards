# Upwards Design & Branding Manifesto

**Status:** binding. Any agent or contributor changing frontend code, visual
design, copy, or information architecture must follow this document. Departures
require updating this file first and stating the product tradeoff that changed.

Related binding documents:

- [`ui-system-and-responsive-layout.md`](ui-system-and-responsive-layout.md) —
  shared primitives, adaptive shell, accessibility baseline.
- [`temporal-data-sync.md`](temporal-data-sync.md) — current-state definitions,
  daily facts, lifecycle events, idempotent sync.
- [`product-scope.md`](product-scope.md) — which features the product keeps,
  reshapes, and deliberately removed, and why.

This document governs *what things should look and feel like, and why*. The other
two govern *how data and layout behave*. When they conflict, raise it rather than
silently picking one.

---

## 1. What this product actually is

Upwards is not a note-taking app and must not be designed like one. Obsidian,
Notion, and Apple Notes already store text beautifully. The premise is narrower
and harder:

> You put the day in on Today. The Journal is where you read that record back.
> You is where it becomes a picture of you — traits, scores, a profile — and
> not a recap of the week.

Three consequences that constrain every design decision:

1. **Capture must feel satisfying, not administrative.** If logging a day feels
   like filling in a form, the data dries up and the AI has nothing to read. The
   capture surfaces get the warmth budget.
2. **The AI is the differentiator and must look like it.** It gets the one
   saturated, alive visual treatment in the product. Nothing else competes.
3. **Nothing is ever "done".** A profile revises as the record does. No surface
   may present it as a completed form, a percent, or a finished score.

### The two registers

Every surface belongs to one of two registers. Mixing them *within a screen* is
intentional and is the core of the visual identity; mixing them *within a single
component* is a bug.

| | **Editorial register** | **Instrument register** |
|---|---|---|
| Used for | Journal, memories, greeting, identity, north star, prose | Tasks, counters, timers, sessions, stats, sync, settings |
| Type | `font-display` (Newsreader) serif, large, tight tracking | `font-preview`/sans + `font-mono` (JetBrains Mono) for data |
| Numerals | Avoid; prose over numbers | `tabular-nums` always |
| Spacing | Generous, unhurried | Tight, dense, scannable |
| Shape | Soft (`1.25rem`–`1.75rem` radius) | Restrained (`0.5rem`–`0.75rem` radius) |
| Borders | Rare; rely on surface contrast | Hairline `1px` `--line` rules |
| Motion | Slow, optional | Immediate, functional |

Reflective content gets serif and room. Operational content gets monospace and
density. This contrast *is* the brand — not a warm palette alone, and not a dense
tool alone.

### Anti-goals

Do not build toward any of these, even if a single screenshot looks good:

- A marketing landing page. No hero taglines, no "make a little room for the good
  stuff" decorative filler cards, no illustrated ring flourishes as ornament.
- A grayscale developer tool. Density is not the goal; *precision where precision
  helps* is.
- A desktop layout. There is no sidebar, no two-column page, and no wider
  shell. A window wider than a phone shows a notice and the phone frame. See §6.
- A pastel, childish, or "cute" aesthetic. Specifically: no pastel color blocks
  standing in for missing photos.
- A gradient-everywhere AI-slop look. The gradient is rationed. See §4.
- A weekly summary. "You met 50% of your intentions" is a paraphrase of Today.
  It is not the product, and it does not get a screen.

---

## 2. Brand foundation

### 2.1 Voice

Plain, warm, second person, lowercase-leaning, never chirpy. The app is a
thoughtful friend who keeps good records, not a coach and not a robot.

- Write "4 things, in order", not "Your Daily Task Dashboard".
- Write "A few questions to deepen your compass, in 2 days", not "Complete your
  profile (60%)".
- Never gamify with exclamation marks, confetti language, or streak shaming.
- Name the evidence when the AI claims something: "90% of days when started
  before 10am" beats "you do better in mornings".
- Always offer the exit: "Skip anytime — nothing here is required."
- Never imply the self-model is finished. "It's never finished" is on-brand.

### 2.2 Wordmark

`upwards`, lowercase, `font-display`, tight tracking (`-0.03em`), beside a leaf
glyph in a rounded square of `--green`. Never all-caps, never with a tagline in
product chrome.

### 2.3 Palette

Warm paper, not white. Defined once as CSS custom properties in
`app/src/index.css` and consumed by name through Tailwind (`bg-paper`,
`text-ink`, `border-line`) - never re-hardcode these values in components.

**Mechanism.** Each token is stored as an HSL channel triplet (`43 100% 99%`),
exactly like the shadcn variables, so opacity modifiers work (`bg-paper/70` is
the frosted-glass recipe; a hex variable cannot do this in Tailwind 3). The
shadcn semantic variables (`--background`, `--foreground`, `--border`,
`--primary`, `--muted`, ...) are **mapped onto** this palette rather than
replaced, so every existing shared primitive takes the brand without a rewrite.

**Naming.** The brand tokens live beside the shadcn ones, so two names that the
original table used would have collided and are renamed:

| Brand role | Token | shadcn variable it feeds |
|---|---|---|
| Page background | `--canvas` | `--background` |
| Raised card surface | `--paper` | `--card`, `--popover` |
| Recessed block | `--canvas-deep` | `--muted`, `--secondary`, `--accent` |
| Primary text | `--ink` | `--foreground` |
| Secondary text | `--ink-muted` (was `--muted`) | `--muted-foreground` |
| Tertiary text, shortcut chips | `--ink-faint` (was `--faint`) | - |
| Hairlines and rules | `--line` | `--border` |
| Switch track (control borders use `--line`) | `--line-strong` | `--input` |
| Active nav, positive fill | `--sage` | - |
| Brand, primary action | `--green` | `--primary`, `--ring` |
| Pressed state, text on sage | `--green-deep` | - |
| Attention fill (now, pinned, due) | `--terracotta` | - |
| Attention text | `--terracotta-text` | - |
| AI accent, warning fill | `--gold` | - |
| Warning text | `--gold-text` | - |
| Fourth categorical color (fill only) | `--lavender` | - |
| Destructive | `--destructive` | `--destructive` |

**Values (light).** Canvas `#f4efe6`, paper `#fffdf8`, canvas-deep `#eee6d7`,
line `#e4dccf`, ink `#2c231b` (warm brown-black, not green), sage `#e1ebe1`, green `#3f6656`, green-deep
`#28453a`. Fills keep the original brand values. **Text roles are darker than
the first draft** because the draft failed this document's own contrast rule
(measured, WCAG): `--ink-muted` `#60574d` (was `#6e776f`, 4.05 on canvas and 3.74
on canvas-deep), `--ink-faint` `#6b645b` (was `#9aa199`, 2.3-2.6),
`--terracotta-text` `#9c4a34` and `--gold-text` `#7d5a12` (the fill colors are
3.2 and 2.5 as text). **One border strength everywhere (changed 2026-10-14).** Controls (text
inputs, textareas, selects, the calendar field, outlined and dashed buttons,
chips, toggle buttons, the unchecked task circle) and containers (cards,
sections, dividers, tooltips) all draw their edge with the same `--line`
hairline, as `border-border`. The earlier rule gave text inputs the stronger
`--line-strong` for 3:1 contrast and left buttons on the hairline; that put two
edge brightnesses side by side in one form, and when it was made uniform at the
strong value it read as too loud. **Tradeoff accepted:** a text input's edge is
now below WCAG 1.4.11's 3:1 non-text contrast. Inputs are identified by their
label, placeholder and the 2px focus ring (which stays at full contrast), not by
their edge alone. `--line-strong` and `--input` remain as tokens (the unchecked
switch track uses `--input`) but no component border uses them. If a contrast
audit requires the stronger edge back, change `--border`-on-controls in one
place (`border-border` in `components/ui/*` and `forms/styles.ts`), not per
component. Disabled controls keep the hairline on a muted fill.
Lavender is a categorical fill only: it is below 4.5 as text on canvas-deep.

**Values (dark).** Neutrals are warm brown-black, not green-grey. Canvas `#191715`, paper `#211f1c`,
canvas-deep `#141210`, line `#37332f`, line-strong `#8a8075`, ink `#ede8de`,
ink-muted `#b6afa5`, ink-faint `#979087`, sage `#2b362f`, green `#86b39d`
(lighter, so it reads on dark), green-deep `#cfe3d8` (text on sage), terracotta
`#e08f72`, gold `#d9b25a`, lavender `#b3abd0`. Text roles are 5.2 or higher on
every surface; the primary button is `#0f1d17` on green (7.4).

Contrast is checked by a unit test (`palette-contrast.test.ts`) that reads the
CSS, so a future edit to a token that breaks a pairing fails CI.

Group/category colors are **user data**, not theme tokens. Render them as small
dots, 2px bars, or tinted backgrounds at ~15% alpha. Never fill a whole card with
a user's group color.
**One exception (2026-10-14): the running-session bar.** While a timer runs,
Today shows a card in its sticky header row, beside the date control, filled with that group's color and a soft
glow of the same color, with text chosen for contrast (`getContrastColor`). It is
the only live, time-critical surface in the app, and the color is what makes a
running timer unmistakable from across the room. On an installed iPhone the
glow is clipped to that header row, so it cannot smear into the status band.
The tradeoff accepted: one
saturated, user-colored surface, only while a session runs, and never in a list
or on any content card. It does not use the AI gradient.

The app ships **System / Light / Dark** and nothing else. The nine named color
palettes were removed deliberately ([`product-scope.md`](product-scope.md) §1):
the brand is one palette, and the AI gradient only reads as special against it.
Do not add user-selectable palettes or accent colors back. Every surface must
work in light and dark: never hardcode a hex where a theme token exists, and
never assume a light background.

### 2.4 Type scale

| Role | Family | Size |
|---|---|---|
| Page title (editorial) | `font-display` | `clamp(1.9rem, 4vw, 2.5rem)`, `leading-[1.05]`, `tracking-[-0.03em]` |
| AI headline | `font-display` | `clamp(1.7rem, 4.4vw, 2.5rem)`, `leading-[1.12]` |
| Card heading | `font-display` | `1.125rem`–`1.25rem` |
| Body | sans | `0.875rem`, `leading-6` |
| Secondary body | sans | `0.75rem`, `leading-5` |
| Micro-label | `font-mono` | `0.64rem`, uppercase, `tracking-[0.14em]`, `--ink-faint` |
| Data value | `font-mono` | `1.25rem`+, `tabular-nums` |
| Keyboard chip | `font-mono` | `0.6rem` |

Micro-labels in monospace uppercase are a signature element. Use them for section
labels and metadata. Never use them for body copy.

### 2.5 Shape, depth, texture

- Radii: editorial `1.25rem`–`1.75rem`; instrument `0.5rem`–`0.75rem`; pills
  fully round. Never mix three radii in one component.
- Shadows are for *floating* things only (nav, sheets, the AI hero). Content
  cards use `--line` borders, not shadows.
- **Frosted glass** is reserved for floating and sticky chrome (bottom nav,
  sticky headers, toolbars, sheets) and for AI surfaces. On an installed
  iPhone the Today header is opaque paper instead: iOS 26.1 and 27 sample a
  frosted top bar and paint a blur over the notch and the date row. Recipe:
  `backdrop-blur-xl` + a translucent surface (`bg-paper/70`) + a
  hairline top highlight (`border-white/40`) + a subtle grain overlay. Content
  cards stay opaque paper — glass on everything destroys legibility and reads
  cheap.
- Grain/texture: a low-opacity (≤4%) noise layer is allowed on glass and on the
  AI gradient to avoid a flat digital look. Never on text.

---

## 3. Information architecture

### 3.1 Journal and Memories are one thing

A memory is a journal entry about something that is hard to date. The data
model keeps them apart: `Memory` is `{text_content, photo_paths, time_label}`
plus the usual `created_at`, with **no event date**, while `JournalEntry`
carries `entry_date`. They must be presented as one continuous record in which
every item has two dates, and only one of them places it:

- A **day** is placed on `entry_date`, the day it describes.
- A **memory** is placed on **the day it was remembered**: the local calendar
  day it was written down (`created_at`). That is a fact the app knows exactly,
  so a memory is never guessed into a year, never filed under a heading, and
  never pushed to the end of the feed. Editing a memory later does not move it.
- A memory's `time_label` is the person's own words for when it *happened*
  ("when I was six", "Summer 2019"). It is the memory's title, it is searchable,
  and it is not parsed or used for placement. The label stays free text; do not
  ask for a date picker.

Do not build separate Journal and Memories destinations. One archive, one search,
one browse surface, newest first, with each memory standing on the day it
surfaced, after that day's entry if there is one.

**Why this replaced "approximate dates, anchored by year" (changed 2026-10-14).**
The earlier rule read a year out of the label and put memories after that
year's days, with unlabelled ones closing the feed. That buried them in past
years and at the end, where people rarely scroll, and it placed them by a date
the person had not given. Placing by the day they were remembered lets the record
surface memories gradually, on the day each came back, among the days it came
back on, which is how a journal is read. The cost is that memories cannot be
browsed by when they happened; that is what the label and search are for.

### 3.2 Canonical navigation

Three primary destinations. Four is a hard cap on the mobile tab bar; three
is the product. Home was the weekly summary and was removed (2026-10-29,
[`product-scope.md`](product-scope.md) §1). `/home` redirects to `/you`.

| Tab | Purpose | Register |
|---|---|---|
| **Today** | Capture and act: tasks, counters, timers, sessions, day navigation | Instrument, with an editorial header |
| **Journal** | The record: entries (exact + approximate), browse, search, media | Editorial |
| **You** | The output: a profile read from the record (traits, scores). The hand-written compass stays on this page until that profile replaces it | Editorial + AI |

Everything else is secondary and reached from a profile/overflow menu or `⌘K`:
Projects/groups, Settings (appearance, language, holiday calendars,
daily clip, automatic location, account, sync, AI key, backup), Sync issues,
What's new, Feedback, and About (version, error logs, source link). The You
tab keeps that overflow one tap away, and with it the manual Sync now /
Check for app update controls — installed iPhone apps have no
pull-to-refresh. Those controls use the instrument register; they do not
sit inside a compass section.

There is no standalone task-order screen. Today's order is the person's own
(a Reorder mode on the list itself, with up/down buttons per row), with pins on
top. "Order with AI" is an optional, temporary view on top of it with a reason on
each task; "Back to my order" returns to exactly what they set. Whether finished
habits sink is a "Done last" preference. See [`product-scope.md`](product-scope.md)
§2.11.

Timeline/sessions are **not** a separate destination — they are a view mode
inside Today, because a session belongs to a day.

### 3.3 Browsing the record

The Journal archive carries four view modes. Do not add a fifth without a
documented user need.

1. **Feed** — reverse-chronological, month and holiday banners, infinite scroll,
   full-text search, tri-state filter chips (hearted / photos / video / places).
   The video chip appears only when the daily clip is enabled.
2. **Calendar** — month grid with per-day density markers (entry dot, bookmark
   heart), drilling into a day.
3. **Map** — places plotted with zoom-aware pin clustering; a cluster filters the
   feed to those days.
4. **Gallery** — all photos and video posters by month. This is the one genuinely
   missing surface today: media is captured and then unreachable in aggregate.
   With the daily clip enabled, each month and year also offers its compilation
   here (see [`product-scope.md`](product-scope.md) §2.5).

`⌘K` is a **cross-entity** command palette: journal entries, memories, memos,
activities, sessions, places, settings. The two existing per-page searches cannot
see each other's data; the palette is what fixes that.

### 3.4 Feature coverage is mandatory

A redesign that silently drops a feature is a regression, not a simplification.
The product's scope is decided in [`product-scope.md`](product-scope.md): what
stays, what was reshaped, and what was deliberately removed. Every feature below
must be visibly represented. Removing one requires updating `product-scope.md`
first.

**Capture & tracking**
- Checkbox habits, **counter habits** (`count/target`, tap to increment, cycles
  to 0 when complete), **"never"/avoid habits** (log a slip; long-press clears),
  **anytime activities** (no schedule, timeable, streak-ineligible).
- **Check-only activities** (`tracks_time = false`) for things like medication:
  scheduled, countable, streaked, but with no timer. These replace recurring
  memo presets.
- Routines: daily / weekly (weekday set) / monthly (day-of-month) / custom
  interval / anytime / never.
- **Per-activity streak flame** rendered inside the checkbox or counter.
- **Break day** toggle: marks a day as a break so misses don't break streaks.
- **Memos** (one-time tasks): quick-add FAB, due date with relative labels, pin
  from the pin button at the row's far right (long-press still works as a
  shortcut), edit/archive/delete, carry-forward of incomplete memos.
- **Manual order** (Reorder mode on Today), **pinning**, a **Done last** preference,
  and **AI ordering with a reason per task** as a temporary view over the person's order.

**Time tracking** (full rule set in [`product-scope.md`](product-scope.md) §2.2)
- Start/stop with a **live running pill** (group color, elapsed clock, STOP).
- One session at a time. Days run midnight to midnight. A session that crosses
  midnight shows on both days with a quiet "from yesterday" / "continues
  tomorrow" marker, and each day totals only its share. Sub-5s sessions without
  a note are discarded.
- **Timeline**: newest-first list of the day's sessions, day total in the header,
  group-colored dots, session notes inline, ▶ "start again" on each row, and
  overlaps flagged inline.
- **Derived completions** — a "done at HH:MM" row synthesized from
  count-vs-target. Never stored as a session.
- **Session details**: reassign activity, edit start/end, edit note, delete.
- **Manual time entry** with date, start, end (both required), and note.
- **Unknown-activity repair** for orphaned sessions.

**Journal & record**
- Emoji + title (30) + text (300); completion requires all three. Answering an
  AI prompt counts.
- **Journal completion streak**, derived on read; backfilling a past day heals
  it.
- Up to **8 photos** as a "tossed pile" stack with a lightbox.
- **Daily clip** (opt-in; one per day, 10s cap, generated poster, offline state)
  and month/year compilations.
- **Places**: manual place search, max 5/day, per-day map, world map in the
  archive; automatic GPS capture is opt-in.
- Bookmark/heart via long-press (keyboard equivalent required), shown as a heart
  marker.
- **Every day is editable.** Saving a change to a day older than 7 days asks for
  confirmation naming the date, and overwritten journal content is kept as a
  restorable previous version.
- Hemisphere-aware month banners and holiday banners from user-chosen holiday
  calendars.

**Structure & lifecycle**
- Groups/projects with name + color; activities inside groups.
- Archive → restore → permanent delete for groups, activities, and memos.
  Archived and deleted items still render on days before they left, with the
  retired-activity explanation.
- The activity form asks one type question — **Habit** (scheduled, timer
  optional), **Avoid** (logs slips), **Time-only** (unscheduled, timed) —
  instead of independent routine / target / timer switches.

**Day navigation**
- Swipe left/right between days, clamped at today; date picker with entry and
  bookmark markers; retired-activity explanation on past days. Days always end
  at local midnight.

**System**
- Appearance: System / Light / Dark.
- Language: English and Português (Brasil).
- Account (required): sign in/up/out, password reset.
- Sync: status pill, manual retry, **conflict review** (whole-item keep this
  device's / keep the other; journal adds keep both), pending operations,
  device list.
- AI: bring-your-own OpenAI-compatible base URL + model + write-only key, test
  connection, daily call cap.
- Backup: `.zip` export (data + media, or data only) and idempotent import.
- What's new with unread dot, feedback, About (version, error logs, source),
  PWA install prompt.

**Deliberately removed** (reasons in [`product-scope.md`](product-scope.md) §1):
named color palettes, the habit-quote footer, gradient washes on hearted
entries, per-day activity pause, journal entry numbers, hidden group-default
activities, timed ⇄ untimed session conversion, end-only manual entries, guest
mode, the standalone task-order screen, the 7-day edit lock, the configurable day-reset
hour, and per-field conflict merging. Do not design for them.

---

## 4. The AI visual language

The AI is the product's reason to exist, so it gets a rationed, unmistakable
treatment. Rationed is the operative word: if every surface glows, none does.

### 4.1 The one gradient

Defined once, reused everywhere, never re-authored per surface:

```ts
aiGradient       // radial, green → teal → plum → warm amber: full-bleed AI surfaces
aiGradientLinear // linear: badges, hairline accents, 1.5px borders
```

They live as CSS variables (`--ai-gradient`, `--ai-gradient-linear`, and
`--on-ai` for the text on them) in `app/src/index.css` and are used through
`app/src/lib/ai/ai-visual.ts`. The stops are fixed colors, not theme tokens: the
surface is dark in light and dark mode alike, so its near-white text keeps its
contrast in both.

### 4.2 Intensity tiers

Match intensity to prominence. Only one tier-1 surface may be visible at a time.

- **Tier 1 — full gradient fill.** The You profile, once it is on screen.
  Large serif headline on the gradient, soft blurred color glows, glass
  buttons. At most one per screen. There is no weekly-insight hero and no
  check-in card.
- **Tier 2 — gradient edge or wash.** A `1.5px` gradient border, or a blurred
  gradient glow bleeding from a corner at ≤25% opacity. For the journal-prompt
  card, the memory throwback, the compass teaser.
- **Tier 3 — gradient badge or sparkle.** A small pill or a `Sparkles` glyph in
  `--gold` next to an AI-personalized detail: an AI-ordered task's reason, a
  curated throwback label.

### 4.3 Rules for AI surfaces

- **Always name the evidence.** A trait or a score says which days, or which
  habit figures, it came from.
- **Always allow override.** AI-ordered lists on Today need a manual order and
  a one-tap way back to it. A trait on You can be corrected or set aside.
- **Do not recap the week.** A sentence whose only content is a completion
  count, a streak, or "you did this 7 of 7" is Today's job, on the habit row.
  It is not an AI surface.
- **Always disclose cost and ownership.** "your key, your model" stays visible.
- **Never fabricate.** A number on an AI surface must be a figure the app
  computed and sent (`supabase/functions/_shared/rank-today.ts` is the current
  case). A profile claim must quote a real day or cite a real figure. Nothing
  is invented for visual effect.
- **Never block on the AI.** Every AI surface needs not-configured, offline,
  loading, stale-cache, rate-limited, and error states. The app is fully usable
  with no key. (There is no signed-out state: an account is required.)

### 4.4 Statistics must come with actions

A number alone, on Today, is decoration. A weekly bar of completion rates is
cut: the habit row already holds the count, and the thing to do is the habit.
On You, a score or a trait is the output. It names its evidence and can be
corrected. It is not a prompt to go do a habit, and it is not a recap.

---

## 5. Component and layout rules

- **Never fill a content card with a saturated brand color.** A solid green card
  with white text reads as a banner ad and fights the AI's gradient claim. Use
  `--paper` with a hairline border, or `--canvas-deep` for recessed emphasis.
  Depth comes from tone, not saturation.
- **No solid-color placeholders for missing media.** Missing photos get a neutral
  warm `--canvas-deep` field with a small muted icon — never a pastel block.
- **No decorative gradients outside AI surfaces.** Hearted entries get a heart
  marker, not a wash; banners use imagery, not gradient fills.
- **Banner imagery has one art direction.** Month and holiday banners are warm,
  natural, photographic or painterly, muted enough to sit on `--paper`, with no
  text in the image and no pastel or cartoon style.
- **Lists must be connected to their container.** A list of entries floating in
  its own white box, disconnected from the section label, reads as an
  afterthought. Bind rows to the surface with shared hairline dividers and one
  continuous container.
- **Hairline dividers, not nested boxes.** Prefer `border-b border-[var(--line)]`
  between rows over giving each row its own border and background.
- **Touch targets ≥44px** on mobile, always.
- **Every pointer interaction needs a keyboard equivalent.** Long-press to
  bookmark must also be reachable by keyboard. See the UI system document.
- **Use shared primitives.** `Button` with its documented variants (`bare`,
  `outline`, `iconRoundSm`, `iconRoundMd`), shadcn/Radix for dialogs, sheets, and
  popovers. Do not hand-roll a control that exists.
- **Non-component exports go in a separate module** from component exports, so
  React Fast Refresh keeps working (`react-refresh/only-export-components`).

---

## 6. Responsive doctrine

**Changed 2026-10-29.** The adaptive desktop shell is withdrawn. Upwards is a
phone app. A wide window does not get another layout.

The tradeoff: a monitor shows a notice and a 430px column instead of using
the width. Building a second information architecture (sidebar, two-column
Journal, desktop settings rail) cost more than it gave a product that is
used on a phone. The phone layout is the only one.

- Unprefixed Tailwind classes are the layout. `sm` and up are set past any
  real window in `tailwind.config.ts`, so a `md:` or `lg:` class does not
  apply. Do not add one to make a desktop variant.
- **Phone:** the page is the window. Single column, tab bar at the bottom,
  document scroll.
- **Wider than 480px:** a notice (`common.wideScreen`, en and pt) says the
  app is made for a phone. Under it, `#mobile-frame` is 430px wide, a
  containing block, and the same shell scrolls inside it. Overlays portal
  into that frame.
- Keyboard shortcuts stay, because they are the keyboard path for the same
  actions, not a desktop layout. Canonical set: `⌘K` palette, `⌘1`–`⌘3`
  tabs, `j/k` move, `x` complete, `p` pin, `n` new.

---

## 7. Accessibility and internationalization

- Contrast: body text ≥4.5:1, large text ≥3:1 — including on the AI gradient,
  which is why gradient surfaces use near-white `#fbf7ee` text and a scrim.
- Semantic structure: one `h1` per screen, real `<button>`/`<a>`, `aria-current`
  on active nav, `aria-pressed` on toggles, `aria-label` on icon-only controls,
  `aria-hidden` on decorative glows and dots.
- Respect `prefers-reduced-motion`; never convey state by color alone (pair the
  group dot with a name, the "now" tint with the word "now").
- **All user-visible copy goes through i18n** with namespaced keys in both `en`
  and `pt`. Hardcoded English is a defect — the audit found it in logs, backup,
  the handoff dialog, photo/video sections, and upload errors. Do not add more.
  Holiday names and banner alt text are translated too.
- Format dates, numbers, and times through the locale tag, never with hardcoded
  English 12-hour strings.

---

## 8. Checklist before shipping a frontend change

1. Which register is this surface, and is it internally consistent?
2. Does it use palette tokens, not raw hexes, and work in both light and dark?
3. If it is an AI surface: correct intensity tier, evidence named, action offered,
   override possible, all states handled?
4. If it shows a statistic: is there an adjacent interpretation and action?
5. Phone layout only, including inside the 430px frame on a wide window?
6. Glass only on floating/sticky chrome and AI surfaces?
7. Any feature displaced, hidden, or dropped — or a removed one brought back? If
   so, is `product-scope.md` updated first?
8. Keyboard path for every pointer interaction; labels on icon-only controls?
9. All new copy in `en` and `pt`?
10. `tsc`, `eslint`, and the test suite pass?
