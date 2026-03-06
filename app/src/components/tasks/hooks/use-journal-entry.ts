import { useState, useCallback, useEffect, useRef } from "react";
import { db, toDateStr, now, newId } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";

export interface JournalFields {
    title: string | null;
    text_content: string | null;
    day_emoji: string | null;
    is_bookmarked: boolean;
    youtube_url: string | null;
}

export interface JournalDraft {
    title: string;
    text: string;
    emoji: string;
    bookmarked: boolean;
    youtubeUrl: string;
}

export function useJournalEntry(currentDate: Date) {
    const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
    const [draftTitle, setDraftTitle] = useState("");
    const [draftText, setDraftText] = useState("");
    const [draftEmoji, setDraftEmoji] = useState("");
    const [draftBookmarked, setDraftBookmarked] = useState(false);
    const [draftYoutubeUrl, setDraftYoutubeUrl] = useState("");
    const [emojiInput, setEmojiInput] = useState("");
    const [showEmojiInput, setShowEmojiInput] = useState(false);

    // Ref so blur-save handlers always read the latest draft without stale closures
    const draftRef = useRef<JournalDraft>({
        title: "",
        text: "",
        emoji: "",
        bookmarked: false,
        youtubeUrl: "",
    });

    const loadJournalEntry = useCallback(async () => {
        const dateStr = toDateStr(currentDate);
        try {
            setJournalEntry(null);
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

    // Sync draft fields whenever the persisted entry or date changes
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const t = journalEntry?.title ?? "";
        const tx = journalEntry?.text_content ?? "";
        const e = journalEntry?.day_emoji ?? "";
        const b = journalEntry?.is_bookmarked ?? false;
        const y = journalEntry?.youtube_url ?? "";
        setDraftTitle(t);
        setDraftText(tx);
        setDraftEmoji(e);
        setDraftBookmarked(b);
        setDraftYoutubeUrl(y);
        setEmojiInput(e);
        draftRef.current = { title: t, text: tx, emoji: e, bookmarked: b, youtubeUrl: y };
    }, [journalEntry, currentDate]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const canEditJournal = (() => {
        const todayMidnight = new Date(toDateStr(new Date()) + "T00:00:00");
        const entryMidnight = new Date(toDateStr(currentDate) + "T00:00:00");
        const diffDays = Math.floor(
            (todayMidnight.getTime() - entryMidnight.getTime()) / (1000 * 60 * 60 * 24),
        );
        return diffDays <= 1;
    })();

    const saveJournalEntry = useCallback(
        async (fields: JournalFields) => {
            const dateStr = toDateStr(currentDate);
            const n = now();
            try {
                const existing = await db.journalEntries
                    .where("entry_date")
                    .equals(dateStr)
                    .filter((e) => !e.deleted_at)
                    .first();

                if (existing) {
                    await db.journalEntries.update(existing.id, { ...fields, updated_at: n });
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

    const saveDraft = useCallback(() => {
        if (!canEditJournal) return;
        const r = draftRef.current;
        void saveJournalEntry({
            title: r.title || null,
            text_content: r.text || null,
            day_emoji: r.emoji || null,
            is_bookmarked: r.bookmarked,
            youtube_url: r.youtubeUrl || null,
        });
    }, [canEditJournal, saveJournalEntry]);

    return {
        // state
        draftTitle, setDraftTitle,
        draftText, setDraftText,
        draftEmoji, setDraftEmoji,
        draftBookmarked, setDraftBookmarked,
        draftYoutubeUrl, setDraftYoutubeUrl,
        emojiInput, setEmojiInput,
        showEmojiInput, setShowEmojiInput,
        draftRef,
        canEditJournal,
        // actions
        loadJournalEntry,
        saveDraft,
    };
}
