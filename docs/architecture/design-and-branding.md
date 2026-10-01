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

> You put your life in carefully — days, habits, time, words, places, photos —
> and the app reads it back against who you said you wanted to become, then tells
> you what to actually do about it.

Three consequences that constrain every design decision:

1. **Capture must feel satisfying, not administrative.** If logging a day feels
   like filling in a form, the data dries up and the AI has nothing to read. The
   capture surfaces get the warmth budget.
2. **The AI is the differentiator and must look like it.** It gets the one
   saturated, alive visual treatment in the product. Nothing else competes.
3. **Nothing is ever "done".** Identity, goals, and self-knowledge evolve. No
   surface may present the user's self-model as a completed form.

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
- A phone frame centered on a desktop monitor. See §6.
- A pastel, childish, or "cute" aesthetic. Specifically: no pastel color blocks
  standing in for missing photos.
- A gradient-everywhere AI-slop look. The gradient is rationed. See §4.

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

Warm paper, not white. Defined once as CSS custom properties and consumed by
name — never re-hardcode these hexes in components.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#21332c` | Primary text |
| `--muted` | `#6e776f` | Secondary text |
| `--faint` | `#9aa199` | Tertiary text, disabled, shortcut chips |
| `--paper` | `#fffdf8` | Raised card surface |
| `--canvas` | `#f4efe6` | Page background |
| `--canvas-deep` | `#eee6d7` | Recessed/secondary blocks |
| `--line` | `#e4dccf` | Hairline borders and rules |
| `--sage` | `#e1ebe1` | Active nav, positive fills |
| `--green` | `#3f6656` | Brand, primary action |
| `--green-deep` | `#28453a` | Pressed states, text on light |
| `--terracotta` | `#c36e52` | Attention, "now", pinned, due |
| `--gold` | `#c99a3f` | AI accent sparkle, warnings |
| `--lavender` | `#8d84a9` | Fourth categorical color |

Group/category colors are **user data**, not theme tokens. Render them as small
dots, 2px bars, or tinted backgrounds at ~15% alpha. Never fill a whole card with
a user's group color.

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
| Micro-label | `font-mono` | `0.64rem`, uppercase, `tracking-[0.14em]`, `--faint` |
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
  sticky headers, toolbars, sheets) and for AI surfaces. Recipe:
  `backdrop-blur-xl` + a translucent surface (`bg-[var(--paper)]/70`) + a
  hairline top highlight (`border-white/40`) + a subtle grain overlay. Content
  cards stay opaque paper — glass on everything destroys legibility and reads
  cheap.
- Grain/texture: a low-opacity (≤4%) noise layer is allowed on glass and on the
  AI gradient to avoid a flat digital look. Never on text.

---

## 3. Information architecture

### 3.1 Journal and Memories are one thing

A memory is a journal entry whose date is imprecise. The data model makes this
explicit: `Memory` is `{text_content, photo_paths, time_label}` with **no date**,
while `JournalEntry` carries `entry_date`. They must be presented as one
continuous record with a **date precision** dimension:

- `exact` — a specific day (today's journal).
- `approximate` — a free-text period in the user's own words ("when I was six",
  "around COVID"), optionally anchored to a year or range for sorting.

Do not build separate Journal and Memories destinations. One archive, one search,
one browse surface, entries sorted by best-known date with imprecise entries
grouped at their anchor.

### 3.2 Canonical navigation

Four primary destinations. This is a hard cap on the mobile tab bar.

| Tab | Purpose | Register |
|---|---|---|
| **Home** | AI digest: insight, recommendations, what to do now | AI + instrument |
| **Today** | Capture and act: tasks, counters, timers, sessions, day navigation | Instrument, with an editorial header |
| **Journal** | The record: entries (exact + approximate), browse, search, media | Editorial |
| **You** | The compass: identity, north star, goals, strategies, check-ins | Editorial + AI |

Everything else is secondary and reached from a profile/overflow menu or `⌘K`:
Projects/groups, Settings (appearance, language, day-reset, holiday calendars,
daily clip, automatic location, account, sync, AI key, backup), Sync issues,
What's new, Feedback, and About (version, error logs, source link).

There is no task-order screen. Today's order comes from the AI, with a reason on
each task, and the user overrides it by pinning.

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
  via long-press, edit/archive/delete, carry-forward of incomplete memos.
- **AI ordering with a reason per task**, and **pinning** as the manual override.

**Time tracking** (full rule set in [`product-scope.md`](product-scope.md) §2.2)
- Start/stop with a **live running pill** (group color, elapsed clock, STOP).
- One session at a time; a session belongs to the day it starts; sub-5s
  sessions without a note are discarded.
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
- Archive → restore → permanent delete for groups, activities, and memos, with
  append-only status events so historical days render with the right definitions.

**Day navigation**
- Swipe left/right between days, clamped at today; date picker with entry and
  bookmark markers; configurable **day-reset hour**; retired-activity
  explanation on past days.

**System**
- Appearance: System / Light / Dark.
- Language: English and Português (Brasil).
- Account (required): sign in/up/out, password reset.
- Sync: status pill, manual retry, **conflict review** with per-field
  keep-mine/keep-theirs/combine, pending operations, device list.
- AI: bring-your-own OpenAI-compatible base URL + model + write-only key, test
  connection, daily call cap.
- Backup: `.zip` export (data + media, or data only) and idempotent import.
- What's new with unread dot, feedback, About (version, error logs, source),
  PWA install prompt.

**Deliberately removed** (reasons in [`product-scope.md`](product-scope.md) §1):
named color palettes, the habit-quote footer, gradient washes on hearted
entries, per-day activity pause, journal entry numbers, hidden group-default
activities, timed ⇄ untimed session conversion, end-only manual entries, guest
mode, the task-order screen, and the 7-day edit lock. Do not design for them.

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

### 4.2 Intensity tiers

Match intensity to prominence. Only one tier-1 surface may be visible at a time.

- **Tier 1 — full gradient fill.** The Home insight hero, and the Compass
  check-in card. Large serif headline on the gradient, soft blurred color glows,
  glass buttons. At most one per screen.
- **Tier 2 — gradient edge or wash.** A `1.5px` gradient border, or a blurred
  gradient glow bleeding from a corner at ≤25% opacity. For the journal-prompt
  card, the memory throwback, the compass teaser.
- **Tier 3 — gradient badge or sparkle.** A small pill or a `Sparkles` glyph in
  `--gold` next to an AI-personalized detail: an AI-ordered task's reason, a
  curated throwback label.

### 4.3 Rules for AI surfaces

- **Always name the evidence.** "Based on 7 days", "6 weeks of data: 90% vs 40%".
- **Always be actionable.** An AI surface that only states a fact is incomplete;
  attach "Add to today", "Answer now", or a prompt the user can tap.
- **Always allow override.** AI-ordered lists need manual pinning. AI prompts need
  dismissal. Check-ins need skipping.
- **Always name the goal served.** Recommendations link back to a compass goal.
- **Always disclose cost and ownership.** "your key, your model" stays visible.
- **Never fabricate.** Text on an AI surface must be derived from real aggregates
  (`app/src/lib/ai/build-insight-payload.ts`), never invented for visual effect.
- **Never block on the AI.** Every AI surface needs not-configured, offline,
  loading, stale-cache, rate-limited, and error states. The app is fully usable
  with no key. (There is no signed-out state: an account is required.)

### 4.4 Statistics must come with actions

A number alone is decoration. A weekly bar chart on its own tells the user
nothing they can do. Any statistic must be accompanied, in the same card or the
one immediately following, by an interpretation and at least one action. If there
is nothing to do about a metric, cut the metric.

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

Mobile-first is literal: unprefixed Tailwind classes describe the phone, and
`md:`/`lg:` add desktop. Never design desktop and shrink it.

- **Phone:** single column, frosted floating bottom tab bar, compact sticky
  header, no keyboard chrome.
- **Desktop (`lg:`):** a real adaptive shell — persistent sidebar with shortcut
  chips, a command bar, and a **two-column content area**: a wide primary column
  for the main object of the screen (the AI hero, the task list, the entry) and a
  narrower secondary rail for supporting context (stats, spaces, compass teaser,
  session totals). A single centered column on a wide monitor wastes the screen
  and reads as a stretched phone.
- Never re-introduce the fixed `430px` phone frame for new surfaces.
- Keyboard shortcuts are desktop-only affordances: hide chips below `lg`, but the
  underlying actions must remain reachable by keyboard at every size. Canonical
  set: `⌘K` palette, `⌘1`–`⌘4` tabs, `j/k` move, `x` complete, `p` pin, `n` new,
  `r` refresh insight.

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
5. Mobile-first at 375px, then a genuine two-column desktop at `lg`?
6. Glass only on floating/sticky chrome and AI surfaces?
7. Any feature displaced, hidden, or dropped — or a removed one brought back? If
   so, is `product-scope.md` updated first?
8. Keyboard path for every pointer interaction; labels on icon-only controls?
9. All new copy in `en` and `pt`?
10. `tsc`, `eslint`, and the test suite pass?
