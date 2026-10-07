import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { db, now, newId } from "@/lib/db";
import { toDateString } from "@/lib/time-utils";
import type {
  JournalEntry,
  JournalLocationRoute,
  LocationData,
} from "@/lib/db/types";
import {
  isJournalEntryComplete,
  journalEntryFieldsHaveContent,
  journalStreakAsOf,
  normalizeJournalLocationRoute,
  parseJournalLocationRoute,
  reconcileJournalDuplicatesForDate,
  serializeJournalLocationRoute,
  toJournalVideoPath,
  type JournalFields,
} from "@/lib/journal";
import {
  recordJournalRevision,
  saveJournalEntry as persistSyncedJournal,
} from "@/lib/sync/mutate-synced";
import {
  buildJournalRevision,
  hasJournalChange,
  summarizeJournalChange,
} from "@/lib/journal/old-day-edit";
import { requestOldDayEdit } from "@/lib/journal/old-day-gate";
import { deletePhotosNoLongerUsed } from "@/lib/journal/photo-cleanup";
import { describeJournalChange } from "@/components/journal/describe-journal-change";
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
  const { t } = useTranslation("journal");
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

  const syncDraftFromEntry = useCallback((entry: JournalEntry | null) => {
    const t = entry?.title ?? "";
    const tx = entry?.text_content ?? "";
    const e = entry?.day_emoji ?? "";
    const b = entry?.is_bookmarked ?? false;
    const p = toJournalVideoPath(entry?.video_path ?? "");
    const locationRoute = parseJournalLocationRoute(entry?.location);
    const vt = entry?.video_thumbnail ?? null;
    const pp = entry?.photo_paths ?? [];
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
  }, []);

  // Sync draft fields whenever the persisted entry changes (NOT on date change to avoid race conditions)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    syncDraftFromEntry(journalEntry);
  }, [journalEntry, syncDraftFromEntry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Derived on read from every complete entry, so backfilling any day heals it.
  const [journalCompletionStreak, setJournalCompletionStreak] = useState<
    number | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    void journalStreakAsOf(toDateString(currentDate)).then((streak) => {
      if (!cancelled) setJournalCompletionStreak(streak);
    });
    return () => {
      cancelled = true;
    };
  }, [journalEntry, currentDate]);

  const saveJournalEntry = useCallback(
    async (fields: JournalFields) => {
      const dateStr = toDateString(currentDate);
      const n = now();
      try {
        const existing =
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

        // Every day is editable. Changing the words or media of a day older
        // than 7 days asks first, and keeps the values it replaces. Hearting
        // and places are not revisable fields, so they never prompt.
        const change = summarizeJournalChange(existing, {
          title: fields.title,
          day_emoji: fields.day_emoji,
          text_content: fields.text_content,
          photo_paths: fields.photo_paths,
          video_path: fields.video_path,
        });
        if (hasJournalChange(change)) {
          const decision = await requestOldDayEdit(
            dateStr,
            describeJournalChange(change, t)
          );
          // "Keep editing": leave the draft as it is so nothing typed is lost.
          if (!decision.confirmed) return;
          if (decision.startsSession) {
            const revision = buildJournalRevision({
              before: existing,
              after: fields,
              id: newId(),
              at: n,
              videoThumbnail: existing?.video_thumbnail ?? null,
            });
            if (revision) await recordJournalRevision(revision);
          }
        }

        if (existing) {
          const updatedEntry: JournalEntry = {
            ...existing,
            ...fields,
            updated_at: n,
          };

          await persistSyncedJournal(updatedEntry, existing.updated_at);

          setJournalEntry(updatedEntry);
          // After the save, so a cancelled edit never deletes a photo. Photos
          // a revision still points at are kept.
          await deletePhotosNoLongerUsed(
            (existing.photo_paths ?? []).filter(
              (path) => !(fields.photo_paths ?? []).includes(path)
            )
          );
        } else {
          const entry: JournalEntry = {
            id: naturalJournalIdForDate(dateStr),
            entry_date: dateStr,
            ...fields,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await persistSyncedJournal(entry);
          setJournalEntry(entry);
        }
      } catch (error) {
        console.error("Error saving journal entry:", error);
      }
    },
    [currentDate, t]
  );

  const saveDraft = useCallback(() => {
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
  }, [saveJournalEntry, currentDate]);

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
      // state
      draftLocationRoute,
      draftLocations,
      setDraftLocationRoute: setDraftLocationRouteSynced,
      journalCompletionStreak,
      isJournalComplete: journalEntry
        ? isJournalEntryComplete(journalEntry)
        : false,
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
      draftLocationRoute,
      draftLocations,
      setDraftLocationRouteSynced,
      journalEntry,
      journalCompletionStreak,
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
