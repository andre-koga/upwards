import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { db, now } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type {
  JournalEntry,
  JournalLocationRoute,
  LocationData,
} from "@/lib/db/types";
import {
  getCompletionMetadata,
  isJournalCalendarDateEditable,
  journalEntryFieldsHaveContent,
  normalizeJournalLocationRoute,
  parseJournalLocationRoute,
  propagateJournalCompletionStreaksAfterSave,
  reconcileJournalDuplicatesForDate,
  serializeJournalLocationRoute,
  toJournalVideoPath,
  type JournalFields,
} from "@/lib/journal";
import { saveJournalEntry as persistSyncedJournal } from "@/lib/sync/mutate-synced";
import { naturalJournalIdForDate } from "@/lib/sync/natural-ids";

export type { JournalLocationRoute, LocationData, JournalFields };

export interface JournalDraft {
  title: string;
  text: string;
  emoji: string;
  bookmarked: boolean;
  videoPath: string;
  locationRoute: JournalLocationRoute;
  videoThumbnail: string | null;
  photoPaths: string[];
}

const EMPTY_LOCATION_ROUTE: JournalLocationRoute = {
  locations: [],
};

export function useJournalEntry(currentDate: Date) {
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");
  const [draftBookmarked, setDraftBookmarked] = useState(false);
  const [draftVideoPath, setDraftVideoPath] = useState("");
  const [draftLocationRoute, setDraftLocationRoute] =
    useState<JournalLocationRoute>(EMPTY_LOCATION_ROUTE);
  const [draftPhotoPaths, setDraftPhotoPaths] = useState<string[]>([]);

  // Ref so blur-save handlers always read the latest draft without stale closures
  const draftRef = useRef<JournalDraft>({
    title: "",
    text: "",
    emoji: "",
    bookmarked: false,
    videoPath: "",
    locationRoute: EMPTY_LOCATION_ROUTE,
    videoThumbnail: null,
    photoPaths: [],
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
          setDraftLocationRoute(EMPTY_LOCATION_ROUTE);
          setDraftPhotoPaths([]);
          draftRef.current = {
            title: "",
            text: "",
            emoji: "",
            bookmarked: false,
            videoPath: "",
            locationRoute: EMPTY_LOCATION_ROUTE,
            videoThumbnail: null,
            photoPaths: [],
          };
        }

        const entries = await db.journalEntries
          .where("entry_date")
          .equals(dateStr)
          .filter((e) => !e.deleted_at)
          .toArray();
        const entry =
          entries.length > 1
            ? await reconcileJournalDuplicatesForDate(dateStr, {
                suppressSync: true,
              })
            : (entries[0] ?? null);
        setJournalEntry(entry);
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
    const locationRoute = parseJournalLocationRoute(journalEntry?.location);
    const vt = journalEntry?.video_thumbnail ?? null;
    const pp = journalEntry?.photo_paths ?? [];
    setDraftTitle(t);
    setDraftText(tx);
    setDraftEmoji(e);
    setDraftBookmarked(b);
    setDraftVideoPath(p);
    setDraftLocationRoute(locationRoute);
    setDraftPhotoPaths(pp);
    draftRef.current = {
      title: t,
      text: tx,
      emoji: e,
      bookmarked: b,
      videoPath: p,
      locationRoute,
      videoThumbnail: vt,
      photoPaths: pp,
    };
  }, [journalEntry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canEditJournal = isJournalCalendarDateEditable(currentDate);

  const saveJournalEntry = useCallback(
    async (fields: JournalFields) => {
      const dateStr = toDateString(currentDate);
      const n = now();
      try {
        let existing =
          (await reconcileJournalDuplicatesForDate(dateStr, {
            suppressSync: true,
          })) ?? undefined;

        if (
          !existing &&
          !journalEntryFieldsHaveContent({
            title: fields.title,
            text_content: fields.text_content,
            day_emoji: fields.day_emoji,
            video_path: fields.video_path,
            photo_paths: fields.photo_paths,
            location: fields.location,
            is_bookmarked: fields.is_bookmarked,
          })
        ) {
          return;
        }

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

          await persistSyncedJournal(updatedEntry, existing.updated_at);

          setJournalEntry(updatedEntry);
          await propagateJournalCompletionStreaksAfterSave(dateStr);
        } else {
          const entry: JournalEntry = {
            id: naturalJournalIdForDate(dateStr),
            entry_date: dateStr,
            ...fields,
            ...completionMeta,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await persistSyncedJournal(entry);
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
      location: serializeJournalLocationRoute(r.locationRoute),
      video_thumbnail: r.videoThumbnail || null,
      photo_paths: r.photoPaths.length > 0 ? r.photoPaths : null,
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
        location: serializeJournalLocationRoute(r.locationRoute),
        video_thumbnail: r.videoThumbnail || null,
        photo_paths: r.photoPaths.length > 0 ? r.photoPaths : null,
      });
    },
    [saveJournalEntry, currentDate]
  );

  // Save only the location field — works for any day
  const saveLocationRoute = useCallback(
    (route: JournalLocationRoute | null) => {
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
        location: serializeJournalLocationRoute(route),
        video_thumbnail: r.videoThumbnail || null,
        photo_paths: r.photoPaths.length > 0 ? r.photoPaths : null,
      });
    },
    [saveJournalEntry, currentDate]
  );

  const persistedLocationRoute = useMemo(
    () => parseJournalLocationRoute(journalEntry?.location),
    [journalEntry]
  );
  const draftLocations = draftLocationRoute.locations;

  /**
   * Single mutation channel for draft fields: keeps React state and the
   * save-time ref (draftRef) in sync so callers never write draftRef directly.
   */
  const updateDraft = useCallback((patch: Partial<JournalDraft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    if (patch.title !== undefined) setDraftTitle(patch.title);
    if (patch.text !== undefined) setDraftText(patch.text);
    if (patch.emoji !== undefined) setDraftEmoji(patch.emoji);
    if (patch.bookmarked !== undefined) setDraftBookmarked(patch.bookmarked);
    if (patch.videoPath !== undefined) setDraftVideoPath(patch.videoPath);
    if (patch.locationRoute !== undefined) {
      setDraftLocationRoute(normalizeJournalLocationRoute(patch.locationRoute));
    }
    if (patch.photoPaths !== undefined) setDraftPhotoPaths(patch.photoPaths);
  }, []);

  const setDraftTitleSynced = useCallback(
    (title: string) => updateDraft({ title }),
    [updateDraft]
  );
  const setDraftTextSynced = useCallback(
    (text: string) => updateDraft({ text }),
    [updateDraft]
  );
  const setDraftEmojiSynced = useCallback(
    (emoji: string) => updateDraft({ emoji }),
    [updateDraft]
  );
  const setDraftBookmarkedSynced = useCallback(
    (bookmarked: boolean) => updateDraft({ bookmarked }),
    [updateDraft]
  );
  const setDraftVideoPathSynced = useCallback(
    (videoPath: string) => updateDraft({ videoPath }),
    [updateDraft]
  );
  const setDraftPhotoPathsSynced = useCallback(
    (photoPaths: string[]) => updateDraft({ photoPaths }),
    [updateDraft]
  );
  const setDraftLocationRouteSynced = useCallback(
    (locationRoute: JournalLocationRoute) => updateDraft({ locationRoute }),
    [updateDraft]
  );

  return useMemo(
    () => ({
      // state
      draftTitle,
      setDraftTitle: setDraftTitleSynced,
      draftText,
      setDraftText: setDraftTextSynced,
      draftEmoji,
      setDraftEmoji: setDraftEmojiSynced,
      draftBookmarked,
      setDraftBookmarked: setDraftBookmarkedSynced,
      draftVideoPath,
      setDraftVideoPath: setDraftVideoPathSynced,
      draftPhotoPaths,
      setDraftPhotoPaths: setDraftPhotoPathsSynced,
      draftRef,
      canEditJournal,
      // state
      draftLocationRoute,
      draftLocations,
      setDraftLocationRoute: setDraftLocationRouteSynced,
      journalCompletionStreak: journalEntry?.journal_completion_streak ?? null,
      journalEntryNumber: journalEntry?.journal_entry_number ?? null,
      isJournalComplete: !!journalEntry?.is_journal_complete,
      videoThumbnail: journalEntry?.video_thumbnail ?? null,
      /** Parsed `journalEntries.location`; updates with `journalEntry` (not one effect behind draft state). */
      persistedLocationRoute,
      persistedLocations: persistedLocationRoute.locations,
      // actions
      loadJournalEntry,
      saveDraft,
      saveBookmark,
      saveLocationRoute,
      updateDraft,
    }),
    [
      draftTitle,
      setDraftTitleSynced,
      draftText,
      setDraftTextSynced,
      draftEmoji,
      setDraftEmojiSynced,
      draftBookmarked,
      setDraftBookmarkedSynced,
      draftVideoPath,
      setDraftVideoPathSynced,
      draftPhotoPaths,
      setDraftPhotoPathsSynced,
      canEditJournal,
      draftLocationRoute,
      draftLocations,
      setDraftLocationRouteSynced,
      journalEntry,
      persistedLocationRoute,
      loadJournalEntry,
      saveDraft,
      saveBookmark,
      saveLocationRoute,
      updateDraft,
    ]
  );
}

export type UseJournalEntryReturn = ReturnType<typeof useJournalEntry>;
