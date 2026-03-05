import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, now, newId } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  List,
  CalendarDays,
  Search,
  Bookmark,
  Check,
  X,
  Pencil,
} from "lucide-react";
import JournalCalendar from "@/components/journal/journal-calendar";

// ─── constants ────────────────────────────────────────────────────────────────

const QUALITY_COLORS = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-400",
  "bg-blue-400",
];
const QUALITY_LABELS = ["Bad", "Poor", "Okay", "Good", "Great"];
const QUALITY_OPTIONS = [
  { value: 1, color: "bg-red-400", label: "Bad" },
  { value: 2, color: "bg-orange-400", label: "Poor" },
  { value: 3, color: "bg-yellow-400", label: "Okay" },
  { value: 4, color: "bg-green-400", label: "Good" },
  { value: 5, color: "bg-blue-400", label: "Great" },
];
const PAGE_SIZE = 7;

// ─── types ────────────────────────────────────────────────────────────────────

export interface EditDraft {
  emoji: string;
  title: string;
  content: string;
  quality: number | null;
  bookmarked: boolean;
}

// ─── pure helpers (module-level so they never cause remounts) ─────────────────

function getLocalDateString(d: Date = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function canEdit(entryDate: string) {
  const todayStr = getLocalDateString();
  const today = new Date(todayStr + "T00:00:00");
  const entry = new Date(entryDate + "T00:00:00");
  const diffDays = Math.floor(
    (today.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays <= 1;
}

function formatDate(dateString: string) {
  const date = new Date(dateString + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

// ─── sub-components (module-level so React never remounts them on re-render) ──

function InlineEntry({
  entry,
  onToggleBookmark,
}: {
  entry: JournalEntry;
  onToggleBookmark: (entry: JournalEntry) => void;
}) {
  const navigate = useNavigate();
  const editable = canEdit(entry.entry_date);
  const quality = entry.day_quality || 3;
  const qualityColor = QUALITY_COLORS[quality - 1];
  const qualityLabel = QUALITY_LABELS[quality - 1];

  return (
    <div className="py-6">
      {/* Date header + actions */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold leading-tight">
            {formatDate(entry.entry_date)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date(entry.entry_date + "T00:00:00").toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              },
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleBookmark(entry)}
            title={entry.is_bookmarked ? "Remove bookmark" : "Bookmark"}
            className={`h-8 w-8 p-0 ${
              entry.is_bookmarked
                ? "bg-red-500/50 hover:bg-red-500/50 hover:border-red-500/50 border-red-500/50 text-white"
                : ""
            }`}
          >
            <Bookmark className="h-4 w-4" />
          </Button>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(`/journal/${entry.entry_date}?edit=true`)
              }
              title="Edit entry"
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Emoji + quality */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center text-3xl bg-background">
            {entry.day_emoji || "📅"}
          </div>
          <div
            className={`w-4 h-4 rounded-full absolute -right-1 -bottom-1 border-2 border-background ${qualityColor}`}
          />
        </div>
        <span className="text-sm text-muted-foreground">{qualityLabel} day</span>
      </div>

      {entry.title && (
        <h3 className="text-lg font-semibold mb-2">{entry.title}</h3>
      )}

      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
        {entry.text_content ?? (
          <span className="text-muted-foreground italic">No notes</span>
        )}
      </p>

      <div className="mt-6 border-b border-border" />
    </div>
  );
}

function EditableInlineEntry({
  dateStr,
  entry,
  isActive,
  draft,
  onActivate,
  onToggleBookmark,
  onSetDraft,
}: {
  dateStr: string;
  entry?: JournalEntry;
  isActive: boolean;
  draft: EditDraft | null;
  onActivate: () => void;
  onToggleBookmark: (entry: JournalEntry) => void;
  onSetDraft: (d: EditDraft) => void;
}) {
  const quality = isActive ? draft?.quality ?? null : entry?.day_quality ?? null;
  const qualityColor = quality ? QUALITY_COLORS[quality - 1] : null;
  const qualityLabel = quality ? QUALITY_LABELS[quality - 1] : null;

  return (
    <div
      className={`py-6 transition-colors rounded-lg ${
        isActive ? "cursor-default" : "cursor-pointer hover:bg-accent/40"
      }`}
      onClick={!isActive ? onActivate : undefined}
    >
      {/* Date header + bookmark */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold leading-tight">
            {formatDate(dateStr)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {(entry || isActive) && (
          <Button
            size="sm"
            variant="outline"
            onClick={(ev) => {
              ev.stopPropagation();
              if (isActive && draft) {
                onSetDraft({ ...draft, bookmarked: !draft.bookmarked });
              } else if (entry) {
                onToggleBookmark(entry);
              }
            }}
            title={
              (isActive ? draft?.bookmarked : entry?.is_bookmarked)
                ? "Remove bookmark"
                : "Bookmark"
            }
            className={`h-8 w-8 p-0 shrink-0 ${
              (isActive ? draft?.bookmarked : entry?.is_bookmarked)
                ? "bg-red-500/50 hover:bg-red-500/50 hover:border-red-500/50 border-red-500/50 text-white"
                : ""
            }`}
          >
            <Bookmark className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Emoji + quality */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          {isActive ? (
            <Input
              type="text"
              placeholder=""
              value={draft?.emoji ?? ""}
              onClick={(ev) => ev.stopPropagation()}
              onChange={(ev) => {
                const matches = ev.target.value.match(
                  /\p{Extended_Pictographic}/gu,
                );
                if (draft)
                  onSetDraft({ ...draft, emoji: matches ? matches[0] : "" });
              }}
              className="w-14 h-14 rounded-full text-2xl text-center p-0"
            />
          ) : (
            <>
              <div className="w-14 h-14 rounded-full border-2 border-border flex items-center justify-center text-3xl bg-background">
                {entry?.day_emoji || (
                  <span className="text-muted-foreground text-xs">emoji</span>
                )}
              </div>
              {qualityColor && (
                <div
                  className={`w-4 h-4 rounded-full absolute -right-1 -bottom-1 border-2 border-background ${qualityColor}`}
                />
              )}
            </>
          )}
        </div>
        {isActive ? (
          <div className="flex gap-1.5">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (draft) onSetDraft({ ...draft, quality: opt.value });
                }}
                title={opt.label}
                className={`w-7 h-7 rounded-full transition-transform ${opt.color} ${
                  draft?.quality === opt.value
                    ? "ring-2 ring-offset-2 ring-foreground scale-110"
                    : "opacity-60 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {qualityLabel ? (
              `${qualityLabel} day`
            ) : (
              <span className="italic">Tap to add entry</span>
            )}
          </span>
        )}
      </div>

      {/* Title */}
      {isActive ? (
        <Input
          placeholder="Give your day a title…"
          value={draft?.title ?? ""}
          onClick={(ev) => ev.stopPropagation()}
          onChange={(ev) => {
            if (draft)
              onSetDraft({ ...draft, title: ev.target.value.slice(0, 30) });
          }}
          className="mb-3 w-full"
        />
      ) : (
        entry?.title && (
          <h3 className="text-lg font-semibold mb-2">{entry.title}</h3>
        )
      )}

      {/* Content */}
      {isActive ? (
        <Textarea
          placeholder="Write about your day…"
          value={draft?.content ?? ""}
          onClick={(ev) => ev.stopPropagation()}
          onChange={(ev) => {
            if (draft)
              onSetDraft({ ...draft, content: ev.target.value.slice(0, 300) });
          }}
          className="w-full min-h-[120px] resize-none"
        />
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {entry?.text_content ?? (
            <span className="text-muted-foreground italic">No notes</span>
          )}
        </p>
      )}

      <div className="mt-6 border-b border-border" />
    </div>
  );
}

function EntryCard({
  entry,
  showEdit,
  onToggleBookmark,
}: {
  entry: JournalEntry;
  showEdit?: boolean;
  onToggleBookmark: (entry: JournalEntry) => void;
}) {
  const navigate = useNavigate();
  const editable = canEdit(entry.entry_date);
  const quality = entry.day_quality || 3;
  const qualityColor = QUALITY_COLORS[quality - 1];
  const textExcerpt = entry.text_content
    ? entry.text_content.length > 150
      ? entry.text_content.substring(0, 150) + "..."
      : entry.text_content
    : "No notes";

  return (
    <Card
      className="hover:bg-accent transition-colors cursor-pointer"
      onClick={() => navigate(`/journal/${entry.entry_date}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex relative">
                <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-2xl bg-background">
                  {entry.day_emoji || "📅"}
                </div>
                <div
                  className={`w-4 h-4 rounded-full absolute -right-1 -bottom-1 border-2 border-background ${qualityColor}`}
                />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {formatDate(entry.entry_date)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(entry.entry_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                </div>
              </div>
            </div>
            {entry.title && (
              <p className="font-medium text-base mb-1">{entry.title}</p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {textExcerpt}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={(ev) => {
                ev.stopPropagation();
                onToggleBookmark(entry);
              }}
              title={entry.is_bookmarked ? "Remove bookmark" : "Bookmark"}
              className={`h-8 w-8 p-0 ${
                entry.is_bookmarked
                  ? "bg-red-500/50 hover:bg-red-500/50 hover:border-red-500/50 border-red-500/50 text-white"
                  : ""
              }`}
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            {showEdit && editable && (
              <Button
                size="sm"
                variant="outline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/journal/${entry.entry_date}?edit=true`);
                }}
                title="Edit entry"
                className="h-8 w-8 p-0 hover:border-white"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar" | "search">("list");
  const [searchText, setSearchText] = useState("");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [filterBookmark, setFilterBookmark] = useState<boolean | undefined>(
    undefined,
  );
  const [olderVisible, setOlderVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Inline editing state for today / yesterday
  const [activeEditDate, setActiveEditDate] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  // Infinite scroll
  const handleObserver = useCallback(
    (observerEntries: IntersectionObserverEntry[]) => {
      if (observerEntries[0].isIntersecting) {
        setOlderVisible((prev) => prev + PAGE_SIZE);
      }
    },
    [],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleObserver, loading]);

  const toggleBookmark = async (entry: JournalEntry) => {
    const newVal = !entry.is_bookmarked;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, is_bookmarked: newVal } : e,
      ),
    );
    await db.journalEntries.update(entry.id, {
      is_bookmarked: newVal,
      updated_at: now(),
    });
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await db.journalEntries
        .orderBy("entry_date")
        .reverse()
        .filter((e) => !e.deleted_at)
        .toArray();
      setEntries(data);
    } catch (error) {
      console.error("Error loading journal entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const activateEdit = (dateStr: string, entry?: JournalEntry) => {
    setEditDraft({
      emoji: entry?.day_emoji ?? "",
      title: entry?.title ?? "",
      content: entry?.text_content ?? "",
      quality: entry?.day_quality ?? null,
      bookmarked: entry?.is_bookmarked ?? false,
    });
    setActiveEditDate(dateStr);
  };

  const cancelEdit = () => {
    setActiveEditDate(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!activeEditDate || !editDraft) return;
    if (
      !editDraft.quality ||
      !editDraft.emoji ||
      !editDraft.title.trim() ||
      !editDraft.content.trim()
    )
      return;
    try {
      setSaving(true);
      const n = now();
      const existing = entries.find(
        (e) => e.entry_date === activeEditDate && !e.deleted_at,
      );
      if (existing) {
        await db.journalEntries.update(existing.id, {
          title: editDraft.title,
          text_content: editDraft.content || null,
          day_quality: editDraft.quality,
          day_emoji: editDraft.emoji || null,
          is_bookmarked: editDraft.bookmarked,
          updated_at: n,
        });
        setEntries((prev) =>
          prev.map((e) =>
            e.id === existing.id
              ? {
                  ...e,
                  title: editDraft.title,
                  text_content: editDraft.content || null,
                  day_quality: editDraft.quality!,
                  day_emoji: editDraft.emoji || null,
                  is_bookmarked: editDraft.bookmarked,
                  updated_at: n,
                }
              : e,
          ),
        );
      } else {
        const newEntry: JournalEntry = {
          id: newId(),
          entry_date: activeEditDate,
          title: editDraft.title,
          text_content: editDraft.content || null,
          day_quality: editDraft.quality,
          day_emoji: editDraft.emoji || null,
          is_bookmarked: editDraft.bookmarked,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.journalEntries.add(newEntry);
        setEntries((prev) => [newEntry, ...prev]);
      }
      setActiveEditDate(null);
      setEditDraft(null);
    } catch (err) {
      console.error("Error saving journal entry:", err);
    } finally {
      setSaving(false);
    }
  };

  // Derived data
  const last2Days: string[] = [];
  for (let i = 0; i < 2; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last2Days.push(getLocalDateString(d));
  }

  const entryByDate = new Map(entries.map((e) => [e.entry_date, e]));
  const last2Set = new Set(last2Days);
  const olderEntries = entries.filter((e) => !last2Set.has(e.entry_date));
  const visibleOlderEntries = olderEntries.slice(0, olderVisible);
  const hasMoreOlder = olderVisible < olderEntries.length;

  const cycleFilter = (current: boolean | undefined): boolean | undefined => {
    if (current === undefined) return true;
    if (current === true) return false;
    return undefined;
  };

  const filtersActive =
    searchText.trim() !== "" ||
    filterQuality !== "all" ||
    filterBookmark !== undefined;

  const applySearch = (e: JournalEntry) => {
    if (filterQuality !== "all" && e.day_quality !== Number(filterQuality))
      return false;
    if (filterBookmark === true && !e.is_bookmarked) return false;
    if (filterBookmark === false && e.is_bookmarked) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const inTitle = e.title?.toLowerCase().includes(q) ?? false;
      const inContent = e.text_content?.toLowerCase().includes(q) ?? false;
      const inEmoji = e.day_emoji?.toLowerCase().includes(q) ?? false;
      if (!inTitle && !inContent && !inEmoji) return false;
    }
    return true;
  };
  const searchResults = entries.filter(applySearch);

  return (
    <>
      <div className="space-y-0">
        {/* Search view */}
        {view === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by title, notes, emoji…"
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterQuality} onValueChange={setFilterQuality}>
                <SelectTrigger className="flex-1 min-w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All qualities</SelectItem>
                  <SelectItem value="1">🔴 Bad</SelectItem>
                  <SelectItem value="2">🟠 Poor</SelectItem>
                  <SelectItem value="3">🟡 Okay</SelectItem>
                  <SelectItem value="4">🟢 Good</SelectItem>
                  <SelectItem value="5">🔵 Great</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setFilterBookmark(cycleFilter(filterBookmark))}
                className={[
                  "h-8 w-8 rounded-md border text-base flex items-center justify-center transition-colors",
                  filterBookmark === undefined
                    ? "border-dashed border-muted-foreground/40 bg-background opacity-50 hover:opacity-75"
                    : filterBookmark === true
                      ? "border-solid border-primary bg-primary/10"
                      : "border-solid border-destructive bg-destructive/10",
                ].join(" ")}
                title="Filter by bookmark"
              >
                🔖
              </button>
            </div>

            {filtersActive && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setSearchText("");
                    setFilterQuality("all");
                    setFilterBookmark(undefined);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-12 text-muted-foreground">
                Loading your journal entries…
              </div>
            )}
            {!loading && !filtersActive && (
              <div className="text-center py-12 text-muted-foreground">
                Type something or use the filters above to search your entries.
              </div>
            )}
            {!loading && filtersActive && searchResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No entries match your search.
              </div>
            )}
            {!loading &&
              filtersActive &&
              searchResults.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  showEdit
                  onToggleBookmark={toggleBookmark}
                  onNavigate={navigate}
                />
              ))}
          </div>
        )}

        {/* Calendar view */}
        {view === "calendar" && <JournalCalendar entries={entries} />}

        {/* List view */}
        {view === "list" && loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading your journal entries...
          </div>
        )}

        {view === "list" && !loading && (
          <>
            {entries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No journal entries yet. Write your first one!</p>
              </div>
            )}

            {/* Today + Yesterday: inline-editable */}
            {last2Days.map((dateStr) => (
              <EditableInlineEntry
                key={dateStr}
                dateStr={dateStr}
                entry={entryByDate.get(dateStr)}
                isActive={activeEditDate === dateStr}
                draft={editDraft}
                onActivate={() => activateEdit(dateStr, entryByDate.get(dateStr))}
                onToggleBookmark={toggleBookmark}
                onSetDraft={setEditDraft}
              />
            ))}

            {/* Older entries — batched via infinite scroll */}
            {visibleOlderEntries.map((entry) => (
              <InlineEntry
                key={entry.id}
                entry={entry}
                onToggleBookmark={toggleBookmark}
                onNavigate={navigate}
              />
            ))}

            {hasMoreOlder && (
              <div
                ref={sentinelRef}
                className="py-4 text-center text-sm text-muted-foreground"
              >
                Loading more…
              </div>
            )}

            {!hasMoreOlder && olderEntries.length > 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                You've reached the beginning of your journal.
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed view toggle */}
      <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center pb-2 pointer-events-none">
        <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border shadow-lg pointer-events-auto">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === "calendar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </button>
          <button
            onClick={() => setView("search")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === "search"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>

      {/* Save / cancel bar — bottom-right, above nav */}
      {activeEditDate && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={cancelEdit}
            className="h-10 w-10 p-0 rounded-full shadow-lg"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={saveEdit}
            disabled={
              saving ||
              !editDraft?.quality ||
              !editDraft?.emoji ||
              !editDraft?.title.trim() ||
              !editDraft?.content.trim()
            }
            className="h-10 w-10 p-0 rounded-full shadow-lg"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
