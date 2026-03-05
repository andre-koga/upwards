"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import {
  Pencil,
  Plus,
  List,
  CalendarDays,
  Search,
  Bookmark,
} from "lucide-react";
import { Tables } from "@/lib/supabase/types";
import JournalCalendar from "@/components/journal/journal-calendar";

type JournalEntry = Tables<"journal_entries">;

interface JournalListProps {
  userId: string;
}

const QUALITY_EMOJIS = ["😞", "😕", "😐", "😊", "🤩"];

export default function JournalList({ userId }: JournalListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar" | "search">("list");
  const [searchText, setSearchText] = useState("");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [filterBookmark, setFilterBookmark] = useState<boolean | undefined>(
    undefined,
  );
  const [filterHasPhotos, setFilterHasPhotos] = useState<boolean | undefined>(
    undefined,
  );
  const [filterHasVideo, setFilterHasVideo] = useState<boolean | undefined>(
    undefined,
  );
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadEntries();
  }, [userId]);

  const toggleBookmark = async (entry: JournalEntry) => {
    const newVal = !entry.is_bookmarked;
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, is_bookmarked: newVal } : e,
      ),
    );
    await supabase
      .from("journal_entries")
      .update({ is_bookmarked: newVal })
      .eq("id", entry.id);
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error loading journal entries:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use local date, NOT toISOString() which is UTC and can show yesterday
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const canEdit = (entryDate: string) => {
    const todayStr = getLocalDateString();
    const today = new Date(todayStr + "T00:00:00");
    const entry = new Date(entryDate + "T00:00:00");
    const diffTime = today.getTime() - entry.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return "Today";
    } else if (date.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year:
          date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const getTodayDate = () => getLocalDateString();

  // Build an ordered list of the past 7 days (today first)
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(getLocalDateString(d));
  }

  const entryByDate = new Map(entries.map((e) => [e.entry_date, e]));

  // Entries older than 7 days
  const last7Set = new Set(last7Days);
  const olderEntries = entries.filter((e) => !last7Set.has(e.entry_date!));

  // Search & filter (used in search view)
  // Cycle: undefined → true → false → undefined
  const cycleFilter = (current: boolean | undefined): boolean | undefined => {
    if (current === undefined) return true;
    if (current === true) return false;
    return undefined;
  };

  const filtersActive =
    searchText.trim() !== "" ||
    filterQuality !== "all" ||
    filterBookmark !== undefined ||
    filterHasPhotos !== undefined ||
    filterHasVideo !== undefined;
  const applySearch = (e: JournalEntry) => {
    if (filterQuality !== "all" && e.day_quality !== Number(filterQuality))
      return false;
    if (filterBookmark === true && !e.is_bookmarked) return false;
    if (filterBookmark === false && e.is_bookmarked) return false;
    if (filterHasPhotos === true && !(e.photo_urls && e.photo_urls.length > 0))
      return false;
    if (filterHasPhotos === false && e.photo_urls && e.photo_urls.length > 0)
      return false;
    if (filterHasVideo === true && !e.video_url) return false;
    if (filterHasVideo === false && e.video_url) return false;
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
      <div className="space-y-4">
        {/* Search view */}
        {view === "search" && (
          <div className="space-y-3">
            {/* Text search */}
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

            {/* Filter dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterQuality} onValueChange={setFilterQuality}>
                <SelectTrigger className="flex-1 min-w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All qualities</SelectItem>
                  <SelectItem value="1">😞 Bad</SelectItem>
                  <SelectItem value="2">😕 Poor</SelectItem>
                  <SelectItem value="3">😐 Okay</SelectItem>
                  <SelectItem value="4">😊 Good</SelectItem>
                  <SelectItem value="5">🤩 Great</SelectItem>
                </SelectContent>
              </Select>
              {(
                [
                  {
                    label: "🔖",
                    value: filterBookmark,
                    set: setFilterBookmark,
                  },
                  {
                    label: "📷",
                    value: filterHasPhotos,
                    set: setFilterHasPhotos,
                  },
                  {
                    label: "🎥",
                    value: filterHasVideo,
                    set: setFilterHasVideo,
                  },
                ] as const
              ).map(({ label, value, set }) => (
                <button
                  key={label}
                  onClick={() => set(cycleFilter(value))}
                  className={[
                    "h-8 w-8 rounded-md border text-base flex items-center justify-center transition-colors",
                    value === undefined
                      ? "border-dashed border-muted-foreground/40 bg-background opacity-50 hover:opacity-75"
                      : value === true
                        ? "border-solid border-primary bg-primary/10"
                        : "border-solid border-destructive bg-destructive/10",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Clear */}
            {filtersActive && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setSearchText("");
                    setFilterQuality("all");
                    setFilterBookmark(undefined);
                    setFilterHasPhotos(undefined);
                    setFilterHasVideo(undefined);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results */}
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
              searchResults.map((entry) => {
                const editable = canEdit(entry.entry_date!);
                const quality = entry.day_quality || 3;
                const qualityEmoji = QUALITY_EMOJIS[quality - 1];
                const textExcerpt = entry.text_content
                  ? entry.text_content.length > 150
                    ? entry.text_content.substring(0, 150) + "..."
                    : entry.text_content
                  : "No notes";
                return (
                  <Card
                    key={entry.id}
                    className="hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => router.push(`/journal/${entry.entry_date}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex relative">
                              <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-2xl bg-background">
                                {entry.day_emoji || "📅"}
                              </div>
                              <div className="w-5 h-5 absolute -right-1 bottom-0 text-[16px] p-0 m-0 leading-none">
                                {qualityEmoji}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-lg">
                                {formatDate(entry.entry_date!)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(
                                  entry.entry_date! + "T00:00:00",
                                ).toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            </div>
                          </div>
                          {entry.title && (
                            <p className="font-medium text-base mb-1">
                              {entry.title}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {textExcerpt}
                          </p>
                          {(entry.photo_urls || entry.video_url) && (
                            <div className="flex gap-2 mt-2">
                              {entry.photo_urls && (
                                <span className="text-xs bg-secondary px-2 py-1 rounded">
                                  📷 {entry.photo_urls.length} photo
                                  {entry.photo_urls.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              {entry.video_url && (
                                <span className="text-xs bg-secondary px-2 py-1 rounded">
                                  🎥 Video
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleBookmark(entry);
                            }}
                            title={
                              entry.is_bookmarked
                                ? "Remove bookmark"
                                : "Bookmark"
                            }
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
                              onClick={(ev) => {
                                ev.stopPropagation();
                                router.push(
                                  `/journal/${entry.entry_date}?edit=true`,
                                );
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
              })}
          </div>
        )}

        {/* Calendar view */}
        {view === "calendar" && <JournalCalendar entries={entries} />}

        {view === "list" && loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading your journal entries...
          </div>
        )}

        {view === "list" && !loading && (
          <>
            {/* Past 7 days in order */}
            {last7Days.map((dateStr) => {
              const entry = entryByDate.get(dateStr);
              const label = formatDate(dateStr);

              if (!entry) {
                // Empty slot — compact add button
                return (
                  <button
                    key={dateStr}
                    onClick={() => router.push(`/journal/${dateStr}`)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
                  >
                    <span>{label}</span>
                    <Plus className="h-4 w-4 shrink-0" />
                  </button>
                );
              }

              // Existing entry card
              const editable = canEdit(entry.entry_date!);
              const quality = entry.day_quality || 3;
              const qualityEmoji = QUALITY_EMOJIS[quality - 1];
              const textExcerpt = entry.text_content
                ? entry.text_content.length > 150
                  ? entry.text_content.substring(0, 150) + "..."
                  : entry.text_content
                : "No notes";

              return (
                <Card
                  key={entry.id}
                  className="hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => router.push(`/journal/${entry.entry_date}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex relative">
                            <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-2xl bg-background">
                              {entry.day_emoji || "📅"}
                            </div>
                            <div className="w-5 h-5 absolute -right-1 bottom-0 text-[16px] p-0 m-0 leading-none">
                              {qualityEmoji}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-lg">{label}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(
                                entry.entry_date! + "T00:00:00",
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        </div>
                        {entry.title && (
                          <p className="font-medium text-base mb-1">
                            {entry.title}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {textExcerpt}
                        </p>
                        {(entry.photo_urls || entry.video_url) && (
                          <div className="flex gap-2 mt-2">
                            {entry.photo_urls && (
                              <span className="text-xs bg-secondary px-2 py-1 rounded">
                                📷 {entry.photo_urls.length} photo
                                {entry.photo_urls.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {entry.video_url && (
                              <span className="text-xs bg-secondary px-2 py-1 rounded">
                                🎥 Video
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(entry);
                          }}
                          title={
                            entry.is_bookmarked ? "Remove bookmark" : "Bookmark"
                          }
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
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/journal/${entry.entry_date}?edit=true`,
                              );
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
            })}

            {/* Older entries */}
            {olderEntries.map((entry) => {
              const quality = entry.day_quality || 3;
              const qualityEmoji = QUALITY_EMOJIS[quality - 1];
              const textExcerpt = entry.text_content
                ? entry.text_content.length > 150
                  ? entry.text_content.substring(0, 150) + "..."
                  : entry.text_content
                : "No notes";

              return (
                <Card
                  key={entry.id}
                  className="hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => router.push(`/journal/${entry.entry_date}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex relative">
                            <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-2xl bg-background">
                              {entry.day_emoji || "📅"}
                            </div>
                            <div className="w-5 h-5 absolute -right-1 bottom-0 text-[16px] p-0 m-0 leading-none">
                              {qualityEmoji}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-lg">
                              {formatDate(entry.entry_date!)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(
                                entry.entry_date! + "T00:00:00",
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        </div>
                        {entry.title && (
                          <p className="font-medium text-base mb-1">
                            {entry.title}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {textExcerpt}
                        </p>
                        {(entry.photo_urls || entry.video_url) && (
                          <div className="flex gap-2 mt-2">
                            {entry.photo_urls && (
                              <span className="text-xs bg-secondary px-2 py-1 rounded">
                                📷 {entry.photo_urls.length} photo
                                {entry.photo_urls.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {entry.video_url && (
                              <span className="text-xs bg-secondary px-2 py-1 rounded">
                                🎥 Video
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBookmark(entry);
                        }}
                        title={
                          entry.is_bookmarked ? "Remove bookmark" : "Bookmark"
                        }
                        className={`h-8 w-8 p-0 ${
                          entry.is_bookmarked
                            ? "bg-red-500/50 hover:bg-red-500/50 border-red-500/50 text-white"
                            : ""
                        }`}
                      >
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {entries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No journal entries yet. Write your first one above!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed view toggle — sits above bottom nav (h-16) */}
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
    </>
  );
}
