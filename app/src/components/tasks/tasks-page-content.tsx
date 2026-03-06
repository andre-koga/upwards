import { useState, useEffect, useCallback, useRef } from "react";
import { db, toDateStr, now as dbNow, newId } from "@/lib/db";
import type { Activity, ActivityGroup, JournalEntry } from "@/lib/db/types";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { Bookmark, BookmarkCheck } from "lucide-react";

const QUALITY_OPTIONS = [
  { value: 1, bg: "bg-red-400", label: "Bad" },
  { value: 2, bg: "bg-orange-400", label: "Poor" },
  { value: 3, bg: "bg-yellow-400", label: "Okay" },
  { value: 4, bg: "bg-green-400", label: "Good" },
  { value: 5, bg: "bg-blue-400", label: "Great" },
];

const TITLE_LIMIT = 30;
const TEXT_LIMIT = 300;

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url.trim()) return null;
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const long = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return `https://www.youtube.com/embed/${long[1]}`;
  const embed = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
  return null;
}

export interface JournalFields {
  title: string | null;
  text_content: string | null;
  day_quality: number | null;
  day_emoji: string | null;
  is_bookmarked: boolean;
  youtube_url: string | null;
}

export default function TasksPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);

  // Journal draft state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftQuality, setDraftQuality] = useState<number | null>(null);
  const [draftEmoji, setDraftEmoji] = useState("");
  const [draftBookmarked, setDraftBookmarked] = useState(false);
  const [draftYoutubeUrl, setDraftYoutubeUrl] = useState("");
  const [emojiInput, setEmojiInput] = useState("");
  const [showEmojiInput, setShowEmojiInput] = useState(false);

  // Refs for blur-save to always read latest draft values
  const draftRef = useRef({
    title: "",
    text: "",
    quality: null as number | null,
    emoji: "",
    bookmarked: false,
    youtubeUrl: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [a, g] = await Promise.all([
        db.activities
          .filter((a) => !a.is_archived && !a.deleted_at)
          .sortBy("created_at"),
        db.activityGroups
          .filter((g) => !g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
      ]);
      setActivities(a);
      setGroups(g);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJournalEntry = useCallback(async () => {
    const dateStr = toDateStr(currentDate);
    try {
      setJournalEntry(null); // clear while loading new date
      const entry = await db.journalEntries
        .where("entry_date")
        .equals(dateStr)
        .filter((e) => !e.deleted_at)
        .first();
      setJournalEntry(entry ?? null);
    } catch (error) {
      console.error("Error loading journal entry:", error);
    }
  }, [currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadJournalEntry();
  }, [loadJournalEntry]);

  // Sync draft fields whenever the journal entry or date changes
  useEffect(() => {
    const t = journalEntry?.title ?? "";
    const tx = journalEntry?.text_content ?? "";
    const q = journalEntry?.day_quality ?? null;
    const e = journalEntry?.day_emoji ?? "";
    const b = journalEntry?.is_bookmarked ?? false;
    const y = journalEntry?.youtube_url ?? "";
    setDraftTitle(t);
    setDraftText(tx);
    setDraftQuality(q);
    setDraftEmoji(e);
    setDraftBookmarked(b);
    setDraftYoutubeUrl(y);
    setEmojiInput(e);
    draftRef.current = {
      title: t,
      text: tx,
      quality: q,
      emoji: e,
      bookmarked: b,
      youtubeUrl: y,
    };
  }, [journalEntry, currentDate]);

  const canEditJournal = (() => {
    const todayMidnight = new Date(toDateStr(new Date()) + "T00:00:00");
    const entryMidnight = new Date(toDateStr(currentDate) + "T00:00:00");
    const diffDays = Math.floor(
      (todayMidnight.getTime() - entryMidnight.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return diffDays <= 1;
  })();

  // Save using the latest ref values so blur handlers never capture stale state
  const saveJournalEntry = useCallback(
    async (fields: JournalFields) => {
      const dateStr = toDateStr(currentDate);
      const n = dbNow();
      try {
        const existing = await db.journalEntries
          .where("entry_date")
          .equals(dateStr)
          .filter((e) => !e.deleted_at)
          .first();

        if (existing) {
          await db.journalEntries.update(existing.id, {
            ...fields,
            updated_at: n,
          });
          setJournalEntry({ ...existing, ...fields, updated_at: n });
        } else {
          const entry: JournalEntry = {
            id: newId(),
            entry_date: dateStr,
            ...fields,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await db.journalEntries.add(entry);
          setJournalEntry(entry);
        }
      } catch (error) {
        console.error("Error saving journal entry:", error);
      }
    },
    [currentDate],
  );

  // saveDraft always calls the latest saveJournalEntry via ref
  const saveDraft = useCallback(() => {
    if (!canEditJournal) return;
    const r = draftRef.current;
    void saveJournalEntry({
      title: r.title || null,
      text_content: r.text || null,
      day_quality: r.quality,
      day_emoji: r.emoji || null,
      is_bookmarked: r.bookmarked,
      youtube_url: r.youtubeUrl || null,
    });
  }, [canEditJournal, saveJournalEntry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(draftYoutubeUrl);

  return (
    <div className="p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* ── YouTube vlog ── */}
        <div className="space-y-2">
          {canEditJournal ? (
            <input
              type="url"
              value={draftYoutubeUrl}
              onChange={(e) => {
                setDraftYoutubeUrl(e.target.value);
                draftRef.current.youtubeUrl = e.target.value;
              }}
              onBlur={saveDraft}
              placeholder="Paste today's YouTube vlog link…"
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            draftYoutubeUrl && (
              <p className="text-xs text-muted-foreground truncate">
                {draftYoutubeUrl}
              </p>
            )
          )}
          {embedUrl && (
            <div
              className="relative w-full rounded-xl overflow-hidden"
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                className="absolute inset-0 w-full h-full"
                src={embedUrl}
                title="Daily vlog"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* ── Emoji · Bookmark · Quality ── */}
        {(canEditJournal || draftEmoji || draftQuality) && (
          <div className="flex items-center gap-3">
            {/* Emoji */}
            <div className="relative">
              {canEditJournal ? (
                showEmojiInput ? (
                  <input
                    autoFocus
                    type="text"
                    value={emojiInput}
                    onChange={(e) => setEmojiInput(e.target.value)}
                    onBlur={() => {
                      const val = emojiInput.trim().slice(0, 2);
                      setDraftEmoji(val);
                      draftRef.current.emoji = val;
                      setShowEmojiInput(false);
                      saveDraft();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="😊"
                    className="w-14 text-center text-xl border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary py-1"
                  />
                ) : (
                  <button
                    onClick={() => setShowEmojiInput(true)}
                    className="text-2xl w-10 h-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors border border-dashed border-muted-foreground/40"
                    title="Set day emoji"
                  >
                    {draftEmoji || (
                      <span className="text-sm text-muted-foreground">+😊</span>
                    )}
                  </button>
                )
              ) : (
                draftEmoji && <span className="text-2xl">{draftEmoji}</span>
              )}
            </div>

            {/* Bookmark */}
            {canEditJournal && (
              <button
                onClick={() => {
                  const next = !draftBookmarked;
                  setDraftBookmarked(next);
                  draftRef.current.bookmarked = next;
                  saveDraft();
                }}
                className={`h-9 w-9 flex items-center justify-center rounded-md transition-colors ${
                  draftBookmarked
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                title={
                  draftBookmarked ? "Remove bookmark" : "Bookmark this day"
                }
              >
                {draftBookmarked ? (
                  <BookmarkCheck className="h-5 w-5" />
                ) : (
                  <Bookmark className="h-5 w-5" />
                )}
              </button>
            )}

            {/* Quality */}
            <div className="flex items-center gap-1 ml-auto">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={!canEditJournal}
                  onClick={() => {
                    const next = draftQuality === opt.value ? null : opt.value;
                    setDraftQuality(next);
                    draftRef.current.quality = next;
                    saveDraft();
                  }}
                  title={opt.label}
                  className={`h-6 w-6 rounded-full transition-all ${opt.bg} ${
                    draftQuality === opt.value
                      ? "ring-2 ring-offset-2 ring-foreground scale-110"
                      : "opacity-40 hover:opacity-100 disabled:hover:opacity-40"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Date header ── */}
        <div className="text-center pt-2">
          <h1 className="text-5xl font-extrabold tracking-tight">
            {currentDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mt-1">
            {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
        </div>

        {/* ── Journal title ── */}
        {(canEditJournal || draftTitle) && (
          <div>
            {canEditJournal ? (
              <div className="relative">
                <input
                  type="text"
                  value={draftTitle}
                  maxLength={TITLE_LIMIT}
                  onChange={(e) => {
                    setDraftTitle(e.target.value);
                    draftRef.current.title = e.target.value;
                  }}
                  onBlur={saveDraft}
                  placeholder="Give this day a title…"
                  className="w-full text-xl font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/50 pr-12"
                />
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {draftTitle.length}/{TITLE_LIMIT}
                </span>
              </div>
            ) : (
              <p className="text-xl font-semibold">{draftTitle}</p>
            )}
          </div>
        )}

        {/* ── Text reflection ── */}
        {(canEditJournal || draftText) && (
          <div>
            {canEditJournal ? (
              <div className="relative">
                <textarea
                  value={draftText}
                  maxLength={TEXT_LIMIT}
                  rows={3}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    draftRef.current.text = e.target.value;
                  }}
                  onBlur={saveDraft}
                  placeholder="Write your thoughts for the day…"
                  className="w-full resize-none bg-transparent focus:outline-none text-sm leading-relaxed placeholder:text-muted-foreground/50"
                />
                <span className="text-xs text-muted-foreground float-right">
                  {draftText.length}/{TEXT_LIMIT}
                </span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {draftText}
              </p>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="border-t border-border pt-2" />

        {/* ── Tasks ── */}
        <DailyTasksList
          activities={activities}
          groups={groups}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />
      </div>
    </div>
  );
}
