import { useState, useCallback, useEffect, useRef } from "react";
import { db, now, newId } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type { JournalEntry, LocationData } from "@/lib/db/types";
import { toJournalVideoPath } from "@/lib/journal";
import {
  parseLocation,
  getCompletionMetadata,
  propagateJournalCompletionStreaksAfterSave,
  type JournalFields,
} from "@/lib/journal";

export type { LocationData, JournalFields };

export interface JournalDraft {
  title: string;
  text: string;
  emoji: string;
  bookmarked: boolean;
  videoPath: string;
  location: LocationData | null;
  videoThumbnail: string | null;
}

export function useJournalEntry(currentDate: Date) {
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");
  const [draftBookmarked, setDraftBookmarked] = useState(false);
  const [draftVideoPath, setDraftVideoPath] = useState("");
  const [draftLocation, setDraftLocation] = useState<LocationData | null>(null);

  // Ref so blur-save handlers always read the latest draft without stale closures
  const draftRef = useRef<JournalDraft>({
    title: "",
    text: "",
    emoji: "",
    bookmarked: false,
    videoPath: "",
    location: null,
    videoThumbnail: null,
  });

  // Track which date the current draft is for to prevent cross-date saves
  const draftDateRef = useRef<string>("");

  const loadJournalEntry = useCallback(
    async (opts?: { background?: boolean }) => {
      const dateStr = toDateString(currentDate);
      draftDateRef.current = dateStr;
      const background = opts?.background ?? false;
      try {
        if (!background) {
          setJournalEntry(null);
          setDraftTitle("");
          setDraftText("");
          setDraftEmoji("");
          setDraftBookmarked(false);
          setDraftVideoPath("");
          setDraftLocation(null);
          draftRef.current = {
            title: "",
            text: "",
            emoji: "",
            bookmarked: false,
            videoPath: "",
            location: null,
            videoThumbnail: null,
          };
        }

        const entry = await db.journalEntries
          .where("entry_date")
          .equals(dateStr)
          .filter((e) => !e.deleted_at)
          .first();
        setJournalEntry(entry ?? null);
      } catch (error) {
        console.error("Error loading journal entry:", error);
      }
    },
    [currentDate]
  );

  // Sync draft fields whenever the persisted entry changes (NOT on date change to avoid race conditions)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const t = journalEntry?.title ?? "";
    const tx = journalEntry?.text_content ?? "";
    const e = journalEntry?.day_emoji ?? "";
    const b = journalEntry?.is_bookmarked ?? false;
    const p = toJournalVideoPath(journalEntry?.video_path ?? "");
    const l = parseLocation(journalEntry?.location);
    const vt = journalEntry?.video_thumbnail ?? null;
    setDraftTitle(t);
    setDraftText(tx);
    setDraftEmoji(e);
    setDraftBookmarked(b);
    setDraftVideoPath(p);
    setDraftLocation(l);
    draftRef.current = {
      title: t,
      text: tx,
      emoji: e,
      bookmarked: b,
      videoPath: p,
      location: l,
      videoThumbnail: vt,
    };
  }, [journalEntry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canEditJournal = (() => {
    const todayMidnight = new Date(toDateString(new Date()) + "T00:00:00");
    const entryMidnight = new Date(toDateString(currentDate) + "T00:00:00");
    const diffDays = Math.floor(
      (todayMidnight.getTime() - entryMidnight.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return diffDays >= 0 && diffDays <= 1;
  })();

  const saveJournalEntry = useCallback(
    async (fields: JournalFields) => {
      const dateStr = toDateString(currentDate);
      const n = now();
      try {
        const existing = await db.journalEntries
          .where("entry_date")
          .equals(dateStr)
          .filter((e) => !e.deleted_at)
          .first();

        const completionMeta = await getCompletionMetadata(
          dateStr,
          fields,
          existing,
          n
        );

        if (existing) {
          const updatedEntry: JournalEntry = {
            ...existing,
            ...fields,
            ...completionMeta,
            updated_at: n,
          };

          await db.journalEntries.update(existing.id, {
            ...fields,
            ...completionMeta,
            updated_at: n,
          });

          setJournalEntry(updatedEntry);
          await propagateJournalCompletionStreaksAfterSave(dateStr);
        } else {
          const entry: JournalEntry = {
            id: newId(),
            entry_date: dateStr,
            ...fields,
            ...completionMeta,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await db.journalEntries.add(entry);
          setJournalEntry(entry);
          await propagateJournalCompletionStreaksAfterSave(dateStr);
        }
      } catch (error) {
        console.error("Error saving journal entry:", error);
      }
    },
    [currentDate]
  );

  const saveDraft = useCallback(() => {
    if (!canEditJournal) return;
    // Prevent saving if the date has changed (e.g., blur event fires during navigation)
    const currentDateStr = toDateString(currentDate);
    if (draftDateRef.current !== currentDateStr) {
      return;
    }
    const r = draftRef.current;
    void saveJournalEntry({
      title: r.title || null,
      text_content: r.text || null,
      day_emoji: r.emoji || null,
      is_bookmarked: r.bookmarked,
      video_path: r.videoPath || null,
      location: r.location || null,
      video_thumbnail: r.videoThumbnail || null,
    });
  }, [canEditJournal, saveJournalEntry, currentDate]);

  // Save only the bookmarked field — works for any day, not just editable ones
  const saveBookmark = useCallback(
    (bookmarked: boolean) => {
      const currentDateStr = toDateString(currentDate);
      if (draftDateRef.current !== currentDateStr) {
        return;
      }
      const r = draftRef.current;
      void saveJournalEntry({
        title: r.title || null,
        text_content: r.text || null,
        day_emoji: r.emoji || null,
        is_bookmarked: bookmarked,
        video_path: r.videoPath || null,
        location: r.location || null,
        video_thumbnail: r.videoThumbnail || null,
      });
    },
    [saveJournalEntry, currentDate]
  );

  // Save only the location field — works for any day
  const saveLocation = useCallback(
    (location: LocationData | null) => {
      const currentDateStr = toDateString(currentDate);
      if (draftDateRef.current !== currentDateStr) {
        return;
      }
      const r = draftRef.current;
      void saveJournalEntry({
        title: r.title || null,
        text_content: r.text || null,
        day_emoji: r.emoji || null,
        is_bookmarked: r.bookmarked,
        video_path: r.videoPath || null,
        location: location || null,
        video_thumbnail: r.videoThumbnail || null,
      });
    },
    [saveJournalEntry, currentDate]
  );

  return {
    // state
    draftTitle,
    setDraftTitle,
    draftText,
    setDraftText,
    draftEmoji,
    setDraftEmoji,
    draftBookmarked,
    setDraftBookmarked,
    draftVideoPath,
    setDraftVideoPath,
    draftRef,
    canEditJournal,
    // state
    draftLocation,
    setDraftLocation,
    journalCompletionStreak: journalEntry?.journal_completion_streak ?? null,
    journalEntryNumber: journalEntry?.journal_entry_number ?? null,
    isJournalComplete: !!journalEntry?.is_journal_complete,
    videoThumbnail: journalEntry?.video_thumbnail ?? null,
    /** Parsed `journalEntries.location`; updates with `journalEntry` (not one effect behind `draftLocation`). */
    persistedLocation: parseLocation(journalEntry?.location),
    // actions
    loadJournalEntry,
    saveDraft,
    saveBookmark,
    saveLocation,
  };
}

export type UseJournalEntryReturn = ReturnType<typeof useJournalEntry>;
