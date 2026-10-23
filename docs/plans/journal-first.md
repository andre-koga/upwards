# What you keep, and what the AI reads

**Status:** proposal, 2026-10-23. Not binding.
**Revised** the same day: habit tracking and time tracking stay as things you
keep by hand. The Journal destination stays as it is. An earlier draft of
this file treated both as something to retire. That draft is withdrawn.

Merging this file records the proposal. It does not change the app, the
schema, or the three binding documents
([`product-scope.md`](../architecture/product-scope.md),
[`design-and-branding.md`](../architecture/design-and-branding.md),
[`temporal-data-sync.md`](../architecture/temporal-data-sync.md)).

A section becomes product direction only when it is accepted. Accepted
direction is written into those three documents first, and only then built.
Until then the coverage list, the compass rules, and the "never send journal
text" rule still stand.

Each open decision below is meant to be answered on its own.

---

## What is settled

Two corrections, taken as given:

1. **The Journal destination stays.** Feed, calendar, map, gallery, search,
   memories in that same record, photos, places, the daily clip, hearts,
   revisions, month and holiday banners, the birthday banner. The editor
   stays too: emoji, title, the 300-character body. Nothing in this proposal
   lengthens the entry, moves writing onto another tab, or adds a fifth view.
2. **Habit tracking and time tracking stay, kept by hand.** Checkboxes,
   counters, avoid habits, check-only activities, routines, memos, groups,
   pins, your own order, the running timer, the session timeline, manual
   time entry, streaks, break days. Today stays Today. The four tabs stay:
   Home, Today, Journal, You.

You already have two kinds of capture, and both are worth keeping. The
journal is the day in your own words. The tracker is the day as a record of
what you meant to do and where the time went. The AI does not replace either
one, and it does not maintain either one for you.

## What is still wrong

The AI never reads the words, so it cannot say anything the counts do not
already say.

- The request in `app/src/lib/ai/build-insight-payload.ts` sends habit
  figures and journal *counts*. The comment on it says the payload is never
  raw journal or task text.
- The model is instructed, in `supabase/functions/_shared/insight.ts`, to be
  "a terse habit coach" and to cite a number only when that number was one
  of the habit's own figures.
- Anything else is deleted. The fallback sentence is computed from the same
  figures ("50% of your intentions were met").

"You did this 7/7 this week" is the entire information in that request. The
tracker is allowed to show 7/7 on the habit's own row, where the number is
the record and the action is to do the thing or not. Home is not allowed to
stop there. A week in which the runs were 7/7 and the entries were all about
not sleeping is a different week from 7/7 and easy mornings, and the current
insight cannot tell them apart.

You has the right subject — who you are becoming, never finished — and the
wrong job. The flagship mock said the AI asks, listens, and updates it.
What shipped (B5b-2, 2026-10-23) says "You write this." North star, identity
words, goals, and the knowledge map are fields. A goal's only evidence is
"done 4 of the last 7 days," the same sentence again. The page cannot grow
from the journal and the tracker, because nothing reads the journal, and the
tracker is only consulted as a score.

The binding docs are right that the model must not invent
(design-and-branding §4.3). This proposal keeps that rule and changes the
evidence from "figures we handed it" to "the days it quotes, and the tracker
figures that match those days." It does not drop capture. Capture stays
covered by product-scope.

---

## The product, if the open decisions are accepted

You write the day, and you keep the habits and the timer the way you do now.
Over time the app reads the words against that record, keeps what it has
learned about you, revises it when later days disagree, and occasionally
points at one specific thing — a habit you already have, or a gap in the
writing — then tells you, from later days, whether it showed up.

You do not fill in a profile. You do not re-type your life into You. The
tracker does not become a form the model edits.

The voice stays the one in design-and-branding §2.1: a thoughtful friend who
keeps records. Plain, warm, second person, no chirp. "Fun" is recognizing
your own week, tracker and journal together. It is not a second score on top
of the streaks.

---

## Decisions

Settled rows are not questions. Open rows are.

| | Proposal | Standing |
|---|---|---|
| **D1** | Journal stays as it is. Habits, memos, and time tracking stay as hand capture on Today. | Settled. |
| **D2** | Leave the body at 300 characters. A longer entry is a separate question, asked only if real letters are too thin to be worth reading. | Settled, by D1. |
| **D3** | Sending journal text to your own model is what makes the reading possible, behind an explicit opt-in. Photos, video, coordinates, and the birthday field are not sent. Session notes are prose and follow the same switch: off, they stay on the device; on, they go with the day's words. Habit names and the figures Today already computes can keep being sent as they are now. | Open. Rejecting it stops the reading. The tracker and the journal stay either way. |
| **D4** | Four tabs stay. Today is not folded into the Journal. | Settled, by D1. |
| **D5** | The tracker is not frozen and not deleted. | Settled, by D1. |
| **D6** | You is maintained by the model from the journal, read against the tracker. You can correct, pin, or set aside. You are not asked to fill it in. Habits stay on Today; the model does not turn a thread into a new habit. | Open. Rejecting it keeps the forms, and the model only suggests beside them. |
| **D7** | No questionnaires, no "tell me something" box, no scheduled check-in. A prompt may appear on an empty journal day; it is one line, dismissible, and it only writes into the journal if you use it. | Open. |
| **D8** | At most one open experiment at a time. It points at something already yours: a habit, a time of day, or a gap in the writing. The next letter reports what later days did. It never creates a habit, a memo, or a session. | Open. |
| **D9** | Home and You do not lead with a compliance rate. A number appears there as the evidence for a claim, next to the days and the tracker figures it came from. Streaks, flames, targets, and "done today" stay on Today, where they are the record. | Open. |
| **D10** | With no key, or with reading turned off, Journal and Today work as they do now, including the current count-based insight. You shows only what you have pinned, and says the reading is off. Nothing invents a portrait. | Open. |
| **D11** | The letter is judged on your own weeks before it replaces the count-based insight, and before You loses its forms. Today is not the thing at risk in that judgment. | Open. |
| **D12** | The model writes in the app's language (`en` or `pt`). Quotations stay in the language of the day. | Open. |

---

## What you do

Unchanged:

- The journal, as the Journal destination and the day editor already are.
- Today: habits of every type, memos, the timer, the timeline, order, pins,
  break days, streaks.
- Account, sync, backup, conflict review, English and Português, appearance.

The new gesture, and the only one this proposal adds, is correcting the
reading when it is wrong: this thread is not me, stop watching this, this
word stays. That is maintenance of the model's mistakes, not a second diary.

---

## What the AI is for

It keeps four kinds of knowledge. All four are revised. None is a form you
complete, and none of them writes back into a habit or a session. Each line
you see cites the days it came from, and the tracker figures it used, and
the app checks both before showing it
([How a claim is allowed on screen](#how-a-claim-is-allowed-on-screen)).

### Threads

A thread is something the days keep returning to: a person, a practice, a
place, a worry, a want. "Sleep", "your sister", "the morning walk", "money".

A thread may line up with a habit you already track. The run habit and a
thread called "running" can point at each other, so the reading can say
"the days you logged this are the days the entry was short." The link is
the model's, shown with the evidence, and you can break it. Creating that
link does not create a habit, retarget one, or change a streak.

A thread has a name, a short current reading, the first day, the latest
day, and the quotations. It can go quiet. Quiet is shown ("nothing since
3 March"). You can say a thread is wrong, or that it is really two things,
or that it should be set aside. A set-aside thread does not come back under
a new name.

### The portrait

A short paragraph and a few words for who the recent record sounds like.
This is the north star and the identity words, with the authorship flipped.

It is rewritten only when a week's reading actually changes it. The previous
paragraph is kept, so You can show "what I thought in October" beside "what
I think now". The page never presents this as finished.

If you have already written a north star or an identity word, that text is
pinned. The model may not contradict a pinned line. It may add around it.
Empty compass rows are filled by the model once there is enough material.
They are not seeded with questions.

The portrait is drawn from the words. A week of perfect habits and an empty
journal does not grow it. The letter can mention the tracker for that week
and say the writing was quiet.

### Noticings

A noticing joins two things you actually recorded. Either side can be the
journal or the tracker:

> You logged a run on four mornings. Those four entries are the short ones.
> The two long entries are both nights with no run logged.

"Run, 4 of 7" on its own is the habit row's job. It is dropped if it shows
up as the noticing. A noticing with one day behind it is not shown. A
noticing later days contradict is revised or dropped, and the drop can be
mentioned once.

"What works for you" is a noticing that has held for more than a week. It
is not a strategy you type, and it is not a percentage.

### The letter

Home's hero becomes one piece of prose for the week, in the editorial
register, on the one full-bleed AI surface. It says what the week was
about in the writing, which noticing it will stand behind, and — only when
the single experiment is earned — one thing to watch. It links each claim
to the days, and to the habit or the sessions when it used them.

It does not open with a completion rate. If the writing was thin, it says
so, names whatever threads it has, and leaves the tracker's own numbers on
Today. That state is a success.

A daily visit does not generate a new letter. Opening the app reads what
was already written. A new letter is produced when the week turns, or when
you ask because a day changed the picture. Stale is labeled, as Home
already labels a stale insight.

The count-based insight stays on screen for anyone who has not opted in
(D10), and it stays for everyone until a real letter has been judged worth
swapping in (D11).

---

## What "actionable" means

Today already has the tracker's actions: check, count, start, stop, pin,
reorder, open a session. Those stay, and the reading does not duplicate
them as its own buttons unless the claim is about that habit.

On Home and You, every claim has at least this:

1. **Open the days.** The journal at the cited dates. If the claim used a
   habit or a session, the citation says which, with the figure the app
   computed, so you can check it against Today.
2. **One experiment, when one is open.** It points at a habit you already
   have, a time of day you already log, or a gap in the writing. "The short
   entries are the run mornings. I'm watching whether a long entry shows up
   on a run day." Tapping it records a watch. It does not create a habit or
   edit one. The next letter says whether the later days held. Dismissing
   it dismisses it, and another does not appear just to fill the slot.
3. **Correct the model.** "This isn't me." "Don't link this to running."
   "Stop watching this." The correction wins over later readings.
4. **Use the prompt, or don't.** One dismissible line on an empty journal
   day, taken from the open experiment or from a real gap. Using it drops
   the line into the editor as editable text. Ignoring it writes nothing.

A metric with nothing to do about it is still cut on Home and You
(design-and-branding §4.4). "7/7" with no pattern beside it fails that test
and stays on the habit row, where the thing to do is the habit itself.
Streak flames stay on that row for the same reason: they are the tracker's
instrument, not a stat card.

Pin and "open Today" remain available when a noticing is about a specific
habit, because those actions already exist and the claim has a target. They
are not offered for a thread about a person.

---

## What you see, by surface

### Journal

Unchanged. This proposal does not add a column, a prompt style, or a new
view to it. The one optional line in D7, if accepted, sits on the empty day
editor — the capture surface that already exists — and is absent when
reading is off.

### Today

Unchanged. Habits, memos, timer, timeline, order, pins, "order with AI",
streaks, break days. The reading does not reorder the list and does not
write `order_index`. Rank-today keeps its current contract.

### Home

For someone who has opted in, and only after D11 passes: the letter, then
the single experiment if one is open. Tier-1 gradient stays rationed to
that hero. The numeric digest stops being the lead. It can remain available
as the evidence behind a claim ("show the figures"), which Home already
knows how to do.

Until then, and whenever reading is off, Home stays the Home that ships
today.

States that already exist stay: loading, offline with the last letter kept,
not configured, reading off, rate limited, provider error, stale because a
day or a logged habit changed the fingerprint, and "not enough written
yet". None of them blocks Today or the Journal.

### You

The portrait, then threads, then noticings that have held. A thread that
lines up with a habit says so, and offers the days. This page grows because
you write and you log, and the paragraph changes. It does not grow because
you filled in a form, and it does not show a progress bar.

Under D6, the manual sections (write a north star, add a word, new goal,
"tell me something", link a goal to a habit) come out. Settings, What's
new, Feedback, and Error logs stay reachable from You.

Parked and deleted compass rows stay restorable. Setting a thread aside is
still not "done".

### A month, later

Not in the first build. Once letters are good, a month can be a page: one
paragraph, the threads that moved, the places you named, the days you
hearted, and the tracker totals that the paragraph actually used ("the
studio hours sit in the second half of the month, which is when the entries
get shorter"). A bar of completion rates is not the page. It waits until
D11 passes.

---

## How it grows

The base is a sequence of readings, not a profile overwritten in place.

| After this much writing | What you get | What stays on Today, either way |
|---|---|---|
| 1–4 days with text | Thread names only. "So far: sleep, your sister." | The full tracker. |
| About two weeks | The first noticing, hedged, joining the words to the log when both exist. A letter that mostly quotes you back. | The full tracker. |
| About a month | A portrait draft. At most one experiment, if a noticing has more than one day and you have not corrected it away. | The full tracker. |
| Ongoing | The portrait changes only when a week disagrees with it. You can read the earlier version. | The full tracker. |

A week with habits logged and no journal text adds nothing to the portrait.
The letter says the writing was quiet. It may mention a tracker figure only
in that sentence, not as advice.

Early emptiness on You is copy, not a wizard. No onboarding questionnaire.
The setup prompt that already asks about location and the daily clip stays.

Cadence, so this does not call the model on every checkmark:

- Saving a journal day that has text queues one **day reading** for that
  revision. It extracts thread mentions and quotations. It does not give
  advice. Checking a habit does not queue one.
- A **week letter** runs when the week closes, or when you ask because the
  fingerprint changed. The fingerprint covers the journal texts and the
  tracker figures for those days, so a week of new sessions with the same
  words can still refresh the letter. The letter is the only place an
  experiment can be proposed.
- The portrait revises as part of the week letter, and only if the reading
  of you differs from the current paragraph.
- Opening Home, Today, or You never blocks on a request.

One open experiment is closed by the letter that follows: held, didn't show
up, or the days were about something else. Then the slot is free.

---

## How a claim is allowed on screen

"Never fabricate" stays. The evidence is the journal plus the tracker
figures the app computed. The model does not get to invent either.

A reading the model returns is untrusted. A sentence is shown only if:

- Every journal citation is a real entry date inside the request, and every
  quotation is a substring of that day's text after normalizing whitespace.
- Every tracker figure it cites was in the request for that habit or that
  day's sessions (days done, days possible, streak, minutes, target). A
  number with no source is dropped. This is the current `insight.ts` rule,
  kept for the tracker half.
- A sentence that only restates one habit's done-count, streak, or
  completion rate is dropped from Home and You. That number already lives
  on the row.
- Advice appears only in a week letter, only as the single experiment, and
  only attached to a noticing that survived the checks. The experiment
  names a habit, a session pattern, or a writing gap that was in the
  request. It does not name a habit to create.
- A claim with nothing left after the checks is dropped. A letter that
  loses its whole body becomes the thin state: threads so far, or "the
  writing was quiet," plus Today as it already is.

The prompt is a reader. It is forbidden to diagnose, to invent motives or
relationships you did not write, to say "you always", and to scold a missed
habit or a missed day. "I don't know yet" is a valid outcome and should be
common in the first month.

D11 is how tone is caught: real weeks, read by you, before Home's hero or
You's forms change. The test set includes weeks in Portuguese. The fixtures
include a week where the tracker is full and the journal is empty, and a
week where a habit's 7/7 hides a pattern in the words. The first must stay
quiet. The second must not come back as "7/7".

---

## Privacy, because the journal half breaks a promise

Home currently tells you that habit names were sent and the journal was
not. Habit names and figures are already the tracker's contract, and D1
keeps that. The journal sentence is the one this proposal changes, and only
behind a choice.

- Existing accounts: reading stays **off** until you turn it on. The screen
  says that the words of the journal, memory text, place names, and session
  notes are sent to the provider behind your own key; that photos, video,
  coordinates, and the birthday field are not; and that off leaves Journal
  and Today as they are, including the current insight.
- New accounts: the choice sits where the key is added. A key without a yes
  does not start readings.
- Off is a real off for prose. No background extract. Rank-today and the
  count-based insight keep their current payloads, which do not include
  the journal.
- The key remains write-only and bring-your-own.
- Server logs of the new function must not store the journal body or the
  session notes. The stored artifact is the reading and its citations.

The birthday column stays out of every payload, as `birthday-privacy`
already requires. If you write your age in the journal, that is the
journal.

Turning reading off stops new readings. It does not delete the base already
stored. "Clear what the AI has learned" should exist on the AI settings
panel before this ships, and it must not touch the journal, the habits, or
the sessions.

---

## Data, and what this must not reintroduce

The temporal rules still apply. This pivot does not bring back
effective-dated habit versions, hard deletion of accepted history,
non-idempotent sync, or silent last-write-wins on prose. Habit and session
rows stay on their current rules in `temporal-data-sync.md`. The model
never writes them.

Classification, if D3 and D6 are accepted:

| Thing | Class | Rule |
|---|---|---|
| Journal days, memories, revisions, photos, places | Unchanged | Still the facts. |
| Habits, groups, memos, sessions, counts | Unchanged | Still yours. The reading stores a reference and a figure it was given. It does not write `order_index`, a count, a session, or a lifecycle timestamp. |
| A day reading or a week letter | Append-only fact, union by id | Idempotent on `(entry revision)` or `(week, fingerprint)`. The fingerprint includes journal text and the tracker figures for that window. Running it twice stores one reading. |
| Portrait, thread, noticing, as currently believed | Derived, or current-state rebuilt from readings plus corrections | Later readings amend. They do not erase the reading log. |
| Your correction, pin, or set-aside | Current-state, OCC, reviewable | A model write never overwrites a field you have corrected. Two devices correcting the same card is a Sync issue, whole card, same shape as a goal today. |
| A thread's link to an existing habit | Part of the thread | A reference, like a goal's activity link today. Archiving the habit keeps the thread's words and says the habit is archived. |

One reading runs once per revision, from one place, not from every device
that opens the day. The stored reading syncs out like any other fact.

`compass_items` is not dropped in the first step. Rows you wrote become
pinned truths. Extending or replacing that table is a protocol bump and a
migration window, the same procedure as B5b. Until that window, an additive
table for readings is enough.

Backup coverage must include the new rows in the same change that adds
them. Clearing the AI base does not touch the journal or the tracker.

---

## What changes, and what does not

### Unchanged

- The Journal destination, the day editor, and the 300-character body.
- Today: every habit type, memos, groups, timer, timeline, manual entry,
  streaks, break days, pins, reorder, "done last", rank-today.
- The count-based insight, for as long as D10 and D11 say so.
- Account, sync, conflict review, backup, appearance, `en` and `pt`, the
  PWA, BYO key, the daily call cap.
- The two registers, the rationed gradient, the coverage list for capture.

### Changes, only if the open decision is accepted

- **D3.** A new opt-in. Prose can leave the device. The current insight's
  payload does not change when the switch is off.
- **D6.** You's forms come out. The page is the portrait, the threads, and
  the noticings. Compass rows you already wrote stay as pins.
- **D8, after D11.** Home's hero can become the letter. The digest stops
  leading. "7/7" remains on the habit.
- **D7.** One optional line on an empty day, easy to dismiss.
- **D9.** A goal on You no longer proves itself with "done N of the last 7
  days." The habit's week stays visible on Today. A thread may cite that
  week only as part of a joined claim.

### Known shape of the reading

- The model will not check a habit for you, and it will not notice a med
  you did not log or write down.
- A week you logged and did not write stays out of the portrait.
- Session notes, once reading is on, are part of the material. They are
  short, and they should be treated as words you wrote, not as a third
  product.

---

## Build order

No calendar estimates. Each step stops cleanly if you reject the next open
decision. No step removes Today or the Journal.

### 0. This document

No application code. You mark the open decisions. Anything accepted is
copied into the binding docs, with the tradeoff, before the step that
depends on it. D1 does not require a doc change: it keeps the current
scope.

### 1. A letter that reads the journal against the tracker

Depends on D3, D8, D10, D12.

- Opt-in on the account, default off, plus "clear the reading".
- One new function. Input: the week's entry text, place names, session
  notes, and the same habit and session figures Home can already compute.
  Output: a letter and citations. The checks above, with tests for a fake
  quote, a tracker number that was not in the request, a bare "7/7"
  sentence, a second experiment, a proposed new habit, and a payload that
  contains no prose when the opt-in is off.
- Home shows the letter beside the current insight for people who opted
  in, until D11 says it may take the hero. Everyone else sees no change.
- Portuguese and English fixtures, including an empty-journal week.

**Stop rule (D11).** You read letters from real weeks. If they are generic,
clinical, or a paraphrase of the counts, the prompt changes. You's forms
stay. The hero stays. Step 2 waits.

### 2. The base becomes visible

Depends on D6 and D7, and on step 1 passing.

- Threads, portrait, noticings stored as in the table above. A thread may
  reference an existing habit.
- You renders them. Existing compass text is pinned. The add-forms go away
  only with the scope change written into `product-scope.md` first.
- Corrections sync and survive a later reading.

### 3. Close the loop

Depends on D8.

- The open experiment, the watch, and the following letter's report.
- The one dismissible line on an empty journal day.
- When the noticing names a habit, pin and open-Today use the actions Today
  already has.

### 4. The letter takes the hero

Depends on D9 and D11.

- For people who opted in, the letter replaces the count-based hero. The
  figures remain one tap away. People who stay opted out keep the current
  Home.
- You no longer shows "done N of 7" as a goal's progress. The habit row
  still does.

### 5. The month page, and thread pages worth lingering on

After the letter has been good for a while. The fun surface. Not required
to prove the pivot.

---

## What this proposal refuses

- Retiring, freezing, or relocating habit tracking, time tracking, memos,
  groups, or the Journal destination.
- A chat as the interface.
- A check-in countdown, a profile percent, or a goal bar.
- Auto-created habits, memos, or sessions from prose.
- The model editing the journal, a count, a session, or your order.
- More than one full-bleed AI surface.
- A local word-cloud dressed up as the letter.
- Sending photos, the clip, coordinates, or the birthday field.
- Rebuilding effective-dated schedules. A thread is not a schedule.

---

## The smallest yes

Accept **D3, D8, D11, and D12**. Step 1 ships an opt-in letter beside the
current Home. Today and the Journal are untouched. You judge the letter on
your own days, including weeks where the tracker and the writing disagree.
You's forms, and the hero, wait on that judgment.
