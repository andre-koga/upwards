# The journal is the input

**Status:** proposal, 2026-10-23. Not binding.

Merging this file records the proposal. It does not change the app, the
schema, or the three binding documents
([`product-scope.md`](../architecture/product-scope.md),
[`design-and-branding.md`](../architecture/design-and-branding.md),
[`temporal-data-sync.md`](../architecture/temporal-data-sync.md)).

A section becomes product direction only when it is accepted. Accepted
direction is written into those three documents first, and only then built.
Until then the coverage list, the compass rules, and the "never send journal
text" rule still stand.

Each decision below is meant to be answered on its own. A later one does not
smuggle in an earlier one you rejected.

---

## What is wrong

The app asks you to maintain a life-admin system — habits, counters, timers,
memos, order, pins, goals, identity words, notes to yourself — and then pays
an AI to describe that system back to you.

The description cannot be anything but dry. Home's insight is built that way
on purpose:

- The request in `app/src/lib/ai/build-insight-payload.ts` sends counts only.
  The comment on it says the payload is never raw journal or task text.
- The model is instructed, in `supabase/functions/_shared/insight.ts`, to be
  "a terse habit coach" and to cite a number only when that number was one of
  the habit's own figures.
- Anything else is deleted before you see it. The fallback sentence is
  computed from the same figures ("50% of your intentions were met").

"You did this 7/7 this week" is not a weak version of the insight. It is the
entire information in the request. A better prompt cannot find a person in a
table of counts.

The You tab has the right subject — who you are becoming, never finished —
and the wrong job. The flagship mock said the AI asks, listens, and updates
it. What shipped (B5b-2, 2026-10-23) says the opposite in the page subtitle:
"You write this." North star, identity words, goals, and the knowledge map
are fields. A goal's only evidence is "done 4 of the last 7 days," which is
the same 7/7 sentence again. Check-ins and "what works for you" were
postponed. The page cannot grow while you only write the journal, because
nothing reads the journal.

Two promises in the current docs fight this pivot, and both were right for
the tracker:

1. Capture is many things (design-and-branding §1 and §3.4): days, habits,
   time, words, places, photos.
2. The model must not invent, so it may only talk about aggregates it was
   handed (§4.3, "Never fabricate").

The proposal keeps the second promise and changes what "evidence" is. It
drops the first.

---

## The product, if this is accepted

You write the day. Over time the app reads the days back as a person, keeps
what it has learned, revises it when later days disagree, and occasionally
asks you to try one specific thing — then tells you, from later days,
whether that thing showed up.

You do not set up habits, rank tasks, score goals, or fill in a profile.
The reading is the product. The journal is how it gets material.

The voice stays the one in design-and-branding §2.1: a thoughtful friend who
keeps records. Plain, warm, second person, no coach, no chirp, no score.
"Fun" is the feeling of being read accurately. It is not points, flames, or
a dashboard.

---

## Decisions

Answer these. "Hold" means leave it out of the first build.

| | Proposal | If you reject it |
|---|---|---|
| **D1** | The journal record is the only thing you author. Memories stay inside that record. | Name any second input that must survive (meds, a timer, a checklist). |
| **D2** | Raise journal body text from 300 characters to 4,000. Title, emoji, photos, places, clip, and heart stay as they are. | Keep 300. The reading will be themes across captions, and it will not give advice. |
| **D3** | Sending journal text to your own model becomes the point of the AI, behind an explicit opt-in. Photos, video, coordinates, and the birthday field are not sent. | There is no reading. This proposal stops. |
| **D4** | Three primary tabs: Journal (write and reread), Home (this week's letter), You (the living base). Today, as a tracker, goes away. | Keep a tracker surface, and say what it is for. |
| **D5** | The tracker is frozen, not deleted. Old habits, sessions, memos, and groups stay readable and exportable. The UI stops creating new ones. | Keep capture working, or delete the history. Deleting history needs its own decision in `temporal-data-sync.md`. |
| **D6** | You is maintained by the model. You can correct, pin, or set aside. You are not asked to fill it in. | Keep the forms, and the model only suggests. |
| **D7** | No questionnaires, no "tell me something" box, no scheduled check-in. A prompt may appear on an empty journal day; it is one line, dismissible, and it only writes into the journal if you use it. | Keep a second way to talk to the model. |
| **D8** | At most one open experiment at a time. The next letter reports what later entries did with it. | Allow a list of suggestions. That is the current Home, and it is the dryness. |
| **D9** | No compliance charts, percentages, progress bars, or streak flames on habits. A number appears only as the evidence for a claim, next to the days it came from. | Name a stat you still want as a chart. |
| **D10** | With no key, or with reading turned off, the app is the journal and nothing pretends to be an insight. | Ask for a local, non-model fallback. It will be thinner, and it should be specified before it is built. |
| **D11** | Do not remove the tracker until you have read letters from your own weeks and they are specific. | Delete the tracker first. The app gets worse before anyone knows if the reading works. |
| **D12** | The model writes in the app's language (`en` or `pt`). Quotations stay in the language of the day. | Letters always match the journal's language, even when the chrome is the other one. |

---

## What you do

Write the journal, as now:

- One day, placed on its date. Emoji, title, text, up to 8 photos, up to 5
  places, an optional daily clip, a heart.
- Memories stay in the same record, placed on the day they were written, with
  a free-text label for when the memory happened. They are part of the
  material, not a second product.
- Every day stays editable. A confirmed edit of an old day still keeps a
  previous version.
- Search, feed, calendar, map, gallery, month and holiday banners, your own
  birthday banner, backup, sync, conflict review, English and Português.

That is the whole practice. A missed day is a missed day. Nothing else falls
behind, because nothing else is yours to maintain.

The one change to the journal itself is **D2**. Three hundred characters is a
caption. A living base built from captions can notice words that recur
("sister", "couldn't sleep", "the river"). It cannot tell a week apart from
a slogan, and it should not be allowed to give advice from that little. Four
thousand characters is a long journal entry, not a document: the editor, the
limits around it, and the editorial register stay. Title stays short. If D2
is rejected, D8 is rejected with it — no experiments from captions.

Places and photos stay on the day. The model may be told the place names you
typed, because those are words on the day. It is not sent coordinates, photo
bytes, or the clip. Seeing the pictures is a later decision with its own
cost and consent, and it is not part of this proposal.

---

## What the AI is for

It keeps four kinds of knowledge. All four are revised. None is a form you
complete. Each line you see cites the days it came from, and the app checks
the citation before showing it (see [How a claim is allowed on screen](#how-a-claim-is-allowed-on-screen)).

### Threads

A thread is something the days keep returning to: a person, a practice, a
place, a worry, a want. "Sleep", "your sister", "the morning walk", "money".

A thread has a name, a short current reading, the first day it appeared, the
latest day, and the quotations. It is not a habit. It has no target, no
schedule, and no done state. It can go quiet. Quiet is shown ("nothing since
3 March"), not punished.

You can say a thread is wrong, or that it is really two things, or that it
should be set aside. A set-aside thread does not come back under a new name.
That constraint is sent with later readings.

### The portrait

A short paragraph and a few words for who the recent record sounds like.
This is the north star and the identity words, with the authorship flipped.

It is rewritten only when a week's reading actually changes it. The previous
paragraph is kept, so You can show "what I thought in October" beside "what
I think now". The page never presents this as finished. Design-and-branding's
"nothing is ever done" stays, and it becomes true in the data rather than as
a subtitle over a form.

If you have already written a north star or an identity word, that text is
pinned. The model may not contradict a pinned line. It may add around it.
Empty compass rows, which is the likely state the day this page shipped, are
filled by the model once there is enough material. They are not seeded with
questions.

### Noticings

A noticing is a pattern with days on both sides when both sides exist:

> On the four days you mentioned a walk, you also mentioned sleeping. On the
> three days you mentioned being up late, you didn't mention a walk.

This replaces "7/7". The number is the count of cited days, printed so you
can check it, and the action is about the pattern. A noticing with one day
behind it is not shown. A noticing the later days contradict is revised or
dropped, and the drop can be mentioned once ("I was wrong about the walks").

"What works for you" is this, after it has held up for more than a week. It
is not a separate feature and it is not a strategy you type.

### The letter

Home is one piece of prose for the week, in the editorial register, on the
one full-bleed AI surface. It says what the week was actually about, which
noticing it is willing to stand behind, and — only when D8's single
experiment is earned — one thing to try or to watch. It links each claim to
the days.

It does not open with a completion rate. It does not list three tips. If the
week was thin, it says it doesn't know you well yet and names the threads it
has, without advice. That state is a success, not an empty screen to decorate.

A daily visit does not generate a new letter. Opening the app reads what was
already written. A new letter is produced when the week turns, or when you
ask for one after a day that changed the picture. Stale is labeled, as Home
already labels a stale insight.

---

## What "actionable" means

The current actions are pin a habit, open Today, and set the suggestion
aside. Those exist because the subject is a checklist. When the subject is
the journal, the actions are:

1. **Open the days.** Every claim is a link into the journal at those dates.
   If the claim is wrong, you can see the misreading immediately. This is the
   minimum action and the one every card has.
2. **One experiment.** Optional, at most one open. Examples, in the product's
   voice: "Write tomorrow morning, once, and see if the entry is one of the
   long ones." Tapping it does not create a task. It records a watch. The
   next letter must say what the later entries did. That report is the
   "result" the current insight never has, because 7/7 has no next chapter.
3. **Correct the model.** "This isn't a goal." "Don't call him my brother."
   "Stop watching this." The correction is kept and wins over later readings.
4. **Use the prompt, or don't.** On an empty day the journal may show one
   line from the open experiment or from a real gap ("you wrote about the
   visit and not about how it was"). Dismissing it dismisses it. Using it
   drops the line into the editor as editable text. Ignoring it writes
   nothing.

There is no "add to today", no generated habit, and no percentage to improve.
A metric with nothing to do about it is still cut (design-and-branding §4.4).
Under that rule, a writing streak with no decision attached does not get a
card. It can sit as a quiet count on the journal if you want continuity for
the one practice left. Habit streaks, break days, and flames go out with the
tracker.

---

## What you see, by surface

### Journal

Unchanged in structure except D2's length. Day navigation stays, because you
still move between days to write and to reread. The habit list, the running
timer, the session timeline, memos, reorder, pins, and "order with AI" are
not on it.

If D4 is accepted, the day you open to write is the Journal, not a separate
Today. The date control, the editor, and "open this day" already exist.

### Home

The letter. Under it, the single experiment if one is open, with the days it
is watching. Under that, nothing else competing: no digest of streaks, no
second AI surface. Tier-1 gradient stays rationed to this hero
(design-and-branding §4.2).

States that already exist on Home stay, renamed for the new contract:
loading, offline with the last letter kept, not configured, reading turned
off, rate limited, provider error, stale because a day changed, and "not
enough written yet". None of them blocks the Journal.

### You

The portrait, then threads, then noticings that have held. Each thread can
open into its own reading: the quotations in order, how the description
changed, the days. This is the page you grow by writing the journal. It
should feel alive because the dates move and the paragraph changes, not
because a progress bar fills.

The manual sections on the current You page (write a north star, add a word,
new goal, "tell me something") come out under D6. Settings, What's new,
Feedback, and Error logs stay reachable from You, as they are now, so the
tab does not trap those links.

Parked and deleted compass rows stay restorable. Setting aside is still not
"done".

### A month, later

Not in the first build. Once letters are good, a month can be a page: one
paragraph of what the month was about, the threads that moved, the places
you named, the days you hearted, and a way to read those days. No chart of
compliance. This is the "fun stat" — a month you recognize — and it waits
until D11 passes. Building it earlier would decorate a reading that might
still be 7/7 in prose.

---

## How it grows

The base is a sequence of readings, not a profile overwritten in place.

| After this much journal | What you get | What you do not get |
|---|---|---|
| 1–4 days with text | Thread names only. "So far: sleep, your sister." | Advice, a portrait, an experiment. |
| About two weeks | The first noticing, hedged, with the days. A letter that mostly quotes you back. | A strategy, a goal inferred and treated as yours. |
| About a month | A portrait draft. At most one experiment, if a noticing has more than one day and you have not corrected it away. | A rewrite of your character every time you open the app. |
| Ongoing | The portrait changes only when a week disagrees with it. You can read the earlier version. A dropped noticing can be admitted once. | A reset. New days amend the base; they do not replace it. |

Early emptiness is copy, not a wizard. No onboarding questionnaire. The
setup prompt that already asks about location and the daily clip stays; it
is not about the model.

Cadence, so this does not call the model on every keystroke:

- Saving a day that has text queues one **day reading** for that revision.
  It extracts thread mentions and quotations. It does not give advice.
- A **week letter** runs when the week closes, or when you ask because new
  days changed the fingerprint. It is the only place an experiment can be
  proposed.
- The portrait revises as part of the week letter, and only if the letter's
  reading of you differs from the current paragraph.
- Opening Home or You never blocks on a request. They render the last stored
  reading.

One open experiment is the loop that makes later weeks different from the
first. The letter that offered it is responsible for closing it: held, didn't
show up, or the entries were about something else. Then the slot is free.
Dismissing an experiment does not immediately spawn another.

---

## How a claim is allowed on screen

"Never fabricate" stays. The evidence changes from habit figures to the
journal.

A reading the model returns is untrusted. A sentence is shown only if:

- Every citation is a real entry date that was inside the request.
- Every quotation is a substring of that day's text, after normalizing
  whitespace. Paraphrase in the model's own sentence is allowed; a fake
  quote is not.
- Any count in the sentence matches a count computed on the device from
  those citations ("four days" must be four cited days). The model does not
  get to invent a denominator.
- Advice appears only in a week letter, only as the single experiment, and
  only attached to a noticing that survived the checks.
- A claim with nothing left after the checks is dropped. A letter that loses
  its whole body is replaced by the honest thin state, not by a generated
  filler sentence.

This is the same discipline as `insight.ts` today — drop what the source
cannot support — pointed at text instead of at `completedDays`.

The prompt is not a habit coach. It is a reader with a narrow job: what
recurred, what changed, what you actually wrote, what is still unclear.
It is forbidden to diagnose, to invent motives or relationships you did not
write, to say "you always", and to scold a missed day. "I don't know yet"
is a valid outcome and should be common in the first month.

Creepy-but-plausible is a failure even when the quotes check out. D11 is how
that is caught: real weeks, read by you, before any tracker code is removed.
The test set includes weeks in Portuguese, not only English.

---

## Privacy, because this breaks a promise

Home currently tells you that habit names were sent and the journal was not.
That sentence is load-bearing. People wrote days under it.

**D3** replaces it. The replacement has to be a choice, not a silent change
in an edge function:

- Existing accounts: reading stays **off** until you turn it on. The screen
  says that the words of the journal (and memory text, and place names) are
  sent to the provider behind your own key, that photos, video, coordinates,
  and the birthday field are not, and that off means the app is the journal.
- New accounts: the choice sits where the key is added. A key without a yes
  does not start readings.
- Off is a real off. No background extract "just in case".
- The key remains write-only and bring-your-own. The app does not gain a
  hosted model in this proposal.
- Server logs of the function must not store the journal body. The stored
  artifact is the reading (the model's output and the citations), which is
  your data and syncs like the rest.

The birthday column stays out of every payload, as `birthday-privacy` already
requires. If you write your age in the journal, you have written it in the
journal; that is different from the app attaching the settings field.

Turning reading off stops new readings. It does not delete the base already
stored. A separate "clear what the AI has learned" action should exist on
the AI settings panel before this ships, so off is not a trap.

---

## Data, and what this must not reintroduce

The temporal rules still apply. This pivot does not bring back effective-dated
habit versions, hard deletion of accepted history, non-idempotent sync, or
silent last-write-wins on prose.

Classification, if D3–D6 are accepted:

| Thing | Class | Rule |
|---|---|---|
| Journal days, memories, revisions, photos, places | Unchanged | Still the facts. |
| A day reading or a week letter | Append-only fact, union by id | Idempotent on `(entry revision)` or `(week, fingerprint of the days in it)`. Running it twice stores one reading. The text of a reading is the model's, kept so the base has a history. |
| Portrait, thread, noticing, as currently believed | Derived, or current-state rebuilt from readings plus corrections | Later readings amend. They do not erase the reading log. |
| Your correction, pin, or set-aside | Current-state, OCC, reviewable | A model write never overwrites a field you have corrected. Two devices correcting the same card is a Sync issue, whole card, same as a goal is today. |
| Old habits, sessions, memos, groups | Frozen facts | Still synced and backed up. No new rows from the UI under D5. Not sent to the model unless you later ask for that. This proposal does not. |

One reading runs once per revision, from one place, not from every device
that has the day open. Two phones must not each pay for a reading and then
conflict on it. The stored reading syncs out like any other fact.

`compass_items` is not dropped in the first step. Rows you wrote become
pinned truths. The table can be extended or replaced when the thread model
is real; that is a protocol bump and a migration window, the same procedure
as B5b, because old clients will not understand a new entity. Until that
window, an additive table for readings is enough.

Backup coverage must include the new rows in the same change that adds them.
A test that fails when a Dexie table is missing from the backup already
exists; the new stores join it.

Clearing the AI base is a tombstone or an explicit delete-with-restore of
those rows, not a silent wipe, and it does not touch the journal.

---

## What is thrown away, frozen, or kept

Thrown away means the UI and the write paths go, after D11, and the binding
docs are updated in that same change. Frozen means the rows remain.

### Freeze, then stop building

- Today as a task list: checkbox, counter, avoid, check-only, routines,
  targets, pins, reorder, "done last", AI ordering and its reasons.
- The running timer, session timeline, manual time entry, session notes.
- One-off memos.
- Groups and activity types as things you maintain.
- Home's numeric digest and the habit-keyed suggestions.
- `rank-today` and the current `generate-ai-insights` contract (counts in,
  coach sentence out). They stay in service until the letter replaces them,
  so opting out of D3 leaves the old Home working for one release, then the
  old insight is removed because its subject is gone. If D5 is rejected and
  the tracker stays, the old insight stays until something better reads the
  journal; it is not improved in place. Improving a count-based coach is how
  this stays dry.
- Habit streaks, break days, streak flames.
- Goal progress tied to "done N of 7".
- The You forms: add a word, new goal, tell me something, link a goal to a
  habit.

### Keep

- The journal record and its four browse modes, revisions, heart, photos,
  places, opt-in clip, holidays, birthday banner, day navigation.
- Memories inside that record.
- Account, offline-after-sign-in, sync, conflict review for anything you
  wrote, backup, System/Light/Dark, `en` and `pt`, the PWA.
- BYO key, the daily call cap (the numbers will change; the cap stays),
  "your key, your model" on the letter.
- The two registers, the rationed gradient, paper cards, no pastel
  placeholders, no phone frame on desktop.
- Compass rows already written, as pins.
- A quiet path to old tracking data (D5), labeled as earlier and not mixed
  into the letter.

### Known losses

Say these out loud so they are not discovered after the tracker is gone:

- Medication and other check-only routines have nowhere to live except a
  sentence in the day. The model can notice the sentence. It will not tap a
  checkbox at 7am.
- Time is no longer a measurement. "I ran" is whatever you wrote. Durations,
  overlaps, and the timeline stop.
- A week you lived and did not write is invisible. The letter must not invent
  it, and it must not scold you for it.
- People who liked the 7/7 view lose it. That is the point of D9, and it is
  still a loss.

If any of those is unacceptable, name it in the answer to D1. One surviving
structured capture is a different, smaller product than "the journal is the
only input", and it should be designed as an exception with a reason, not as
the tracker quietly remaining.

---

## Build order

No calendar estimates. Each step is shippable and stops cleanly if you reject
the next decision.

### 0. This document

No application code. You mark the decisions. Anything accepted is then copied
into the three binding docs as a scope change, with the tradeoff, before the
step that depends on it.

### 1. A letter that reads your journal

Depends on D2 (or an explicit acceptance of captions), D3, D8, D10, D12.

- Opt-in on the account, default off, plus "clear the reading".
- One new function: week letter in, verified citations out. Day readings can
  be part of this step or the next; the letter is the thing D11 judges.
- Home shows the letter to people who opted in. Everyone else keeps the
  current Home. The tracker is not touched.
- The grounding checks above, with tests: a fake quote is dropped, a count
  that does not match the citations is dropped, a second experiment is
  dropped, journal text is absent from the payload when the opt-in is off.
- Portuguese and English fixtures.

**Stop rule (D11).** You read letters from real weeks of yours. If they are
generic, clinical, or a paraphrase of "you wrote often", the prompt changes.
The tracker stays. Step 2 does not start on a bad letter.

### 2. The base becomes visible

Depends on D6 and D7, and on step 1 passing.

- Threads, portrait, noticings stored as in the table above.
- You renders them. Existing compass text is pinned. The add-forms go away
  in this step only if D6 is accepted; until the docs are updated, removing
  them is a scope change and has to land in `product-scope.md` first.
- Corrections sync and survive a later reading.
- Not enough written yet, and reading off, are both designed states.

### 3. Close the loop

Depends on D8.

- The open experiment, the watch, and the following letter's report.
- The one dismissible journal line, written only into the editor if used.
- Still no deletion of the tracker.

### 4. Retire the tracker

Depends on D1, D4, D5, and on steps 1–3 being something you want to keep.

- Update all three binding docs in the same change that removes the write
  UI. The feature-coverage list is rewritten, not silently ignored.
- Today folds into the Journal. Navigation becomes three tabs.
- New habit, session, memo, and group writes stop. Old rows remain, with a
  read-only way to see them and the existing backup.
- Migration window, protocol bump, old clients turned away, same procedure
  as the compass. Pending tracker operations already queued are still
  accepted once, so a phone that was offline does not lose a session it
  already recorded. After the window, the UI that creates them is gone.
- `rank-today` and the count-based insight are removed in this step, not
  before, and only if D5's freeze includes "the model no longer speaks about
  habits".

### 5. The month page, and thread pages that are worth lingering on

Depends on D9 and on the letter having been good for a while. This is the
surface people show each other. It is not required to prove the pivot.

---

## What this proposal refuses

So it does not drift back into the current app, or into the flagship mock's
extras:

- A chat as the interface.
- A check-in countdown, a profile percent, a goal bar, or a strategy you
  have to confirm before it "counts".
- Auto-created habits or tasks from prose.
- The model silently editing the journal.
- More than one full-bleed AI surface.
- A local word-cloud dressed up as the letter (unless D10 is rejected and a
  fallback is specified).
- Sending photos, the clip, coordinates, or the birthday field.
- Hard-deleting old tracking history as part of the pivot.
- Rebuilding effective-dated schedules for whatever replaces habits. Threads
  are not schedules.

---

## The smallest yes

If you want to try this without committing to the demolition: accept **D3,
D8, D11, and D12**, and defer D1, D4, D5, and D6. Step 1 ships a letter next
to the tracker. You judge it on your own days. Everything else waits on that
judgment.

D2 should be decided at the same time. A letter built on 300-character days
is a fair test only if you know that is the ceiling.
