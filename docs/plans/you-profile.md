# You, from the record

**Status:** direction, 2026-10-29. Not binding until a section is copied into
the three architecture documents.
**Replaces** `journal-first.md` (2026-10-23), which is deleted. That proposal's
week letter, noticings, experiments, and "read the week back as prose" are
withdrawn. The count-based insight and the Home digest are already gone from
the app ([`product-scope.md`](../architecture/product-scope.md) §1).

The online-only Supabase rewrite plan is deleted with it. It contradicted
[`temporal-data-sync.md`](../architecture/temporal-data-sync.md): the local
record, offline use, and conflict review stay.

---

## The flow

Three places. Nothing else is a primary tab.

| Place | Job |
|---|---|
| **Today** | Input. Habits, memos, the timer, the timeline, your order, pins, streaks, break days. This already works. |
| **Journal** | The record, for reading. Feed, calendar, map, gallery, memories, photos, places, the daily clip. Unchanged. |
| **You** | The only AI output. A visualized profile: traits and scores, drawn from the record. Not a summary of the week. |

`/home` redirects to `/you`.

---

## Thrown away

These were the uninteresting parts. Do not bring them back.

- A weekly letter, a day reading, a noticing, or an "experiment" the next letter reports on.
- The count-based insight ("50% of your intentions were met") and the no-AI digest ("worth acting on today").
- A coach voice. The model does not tell the person what to do next, and it does not scold a missed day.
- Questionnaires, check-ins, "tell me something" as a scheduled prompt, a profile percent, a goal bar.
- Filling You in by hand as the product. North star, identity words, goals, and the knowledge map are still on the page, because deleting someone's words is not a simplification. They are not the destination. The profile replaces that page when it exists. Until then the forms stay, and the profile is not faked.
- Auto-created habits, memos, sessions, or a rewritten journal.
- A chat as the interface.
- A month page that is another paragraph about the month.
- Sending photos, the clip, coordinates, or the birthday.
- The online-only rewrite: dropping Dexie, conflict review, and offline.

Order with AI on Today stays. It orders the open list. It is not a summary.

---

## What is worth building

The profile is the interesting remainder of the old proposal: the model reads
the record and says who it sounds like, and the app checks the claim before
showing it.

- **Traits and scores, drawn.** A short portrait and a few scored traits, in
  the editorial register, on the one full-bleed AI surface. A score without
  a named source is dropped ([`design-and-branding.md`](../architecture/design-and-branding.md)
  §4.3). Opening a trait shows the days, or the habit figures, it used.
- **The words are the material.** Habit counts alone do not grow a trait. A
  week of perfect logs and an empty journal stays quiet. Sending journal
  text, place names, and session notes is an explicit opt-in, off until
  chosen. Photos, video, coordinates, and the birthday stay out.
- **Corrections win.** "This isn't me" and "set this aside" outlast the next
  reading. The model does not overwrite a correction.
- **No key, or reading off.** Today and the Journal work as they do now. You
  shows the compass the person wrote, and says the profile is off. It does
  not invent traits.
- **Cadence.** Opening You does not call the model. A reading is stored and
  refreshed when the week turns or when the person asks because the record
  changed. One reading of the same fingerprint stores once.
- **Language.** The profile is written in the app's language (`en` or `pt`).
  Quotations stay in the language of the day.

The temporal rules still apply. Readings are append-only and idempotent.
The model never writes a habit, a count, a session, a journal day, or
`order_index`. Backup includes the new rows in the same change that adds
them. "Clear what the AI has learned" wipes the profile and does not touch
the journal or the tracker.

---

## Not yet

No schema and no screen in this direction until the tradeoff is written into
the binding docs first. The removal of the weekly summary is already there.
