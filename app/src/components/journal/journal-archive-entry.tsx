import { useEffect, useState } from "react";
import { Bookmark, Flame, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import {
  getJournalPhotoUrl,
  getJournalVideoPlaybackUrl,
} from "@/lib/journal";
import { JOURNAL_JUMP_DATE_KEY } from "@/lib/journal/archive";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import JournalVideoSection from "@/components/journal/journal-video-section";
import JournalPhotoStack from "@/components/journal/journal-photo-stack";
import { cn } from "@/lib/utils";

interface JournalArchiveEntryProps {
  entry: JournalEntry;
  holiday: string | null;
}

export default function JournalArchiveEntry({
  entry,
  holiday,
}: JournalArchiveEntryProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const date = fromDateString(entry.entry_date);
  const dayNumber = date.getDate();
  const weekday = date.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "long",
  });

  const videoSrc = entry.video_path
    ? getJournalVideoPlaybackUrl(entry.video_path)
    : null;
  const photoPaths = entry.photo_paths ?? [];
  const hasVideo = Boolean(videoSrc || entry.video_thumbnail);
  const locations = entry.location?.locations ?? [];
  const locationLabel = locations.map((l) => l.displayName).join(" → ");

  const openDay = () => {
    try {
      sessionStorage.setItem(JOURNAL_JUMP_DATE_KEY, entry.entry_date);
    } catch {
      // ignore quota / private mode
    }
    navigate("/");
  };

  return (
    <article className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
      <button
        type="button"
        onClick={openDay}
        className="group flex w-full items-start gap-3 text-left"
      >
        <div className="flex w-12 shrink-0 flex-col items-center pt-0.5">
          <span className="font-crimson text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
            {dayNumber}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1 pb-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm capitalize text-muted-foreground">
              {weekday}
            </span>
            {holiday ? (
              <>
                <span className="text-muted-foreground/50" aria-hidden>
                  ·
                </span>
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  {holiday}
                </span>
              </>
            ) : null}
            {entry.is_bookmarked ? (
              <Bookmark
                className="h-3.5 w-3.5 fill-current text-amber-500"
                aria-label={t("bookmarkDay")}
              />
            ) : null}
          </div>

          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-2xl",
                !entry.day_emoji && "text-muted-foreground"
              )}
              aria-hidden
            >
              {entry.day_emoji?.trim() || "🙂"}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-crimson text-xl font-bold leading-snug">
                {entry.title?.trim() || t("untitled")}
              </h2>
              {entry.text_content?.trim() ? (
                <p className="mt-1 whitespace-pre-wrap font-crimson text-sm leading-relaxed text-muted-foreground">
                  {entry.text_content}
                </p>
              ) : null}
            </div>
          </div>

          {(locations.length > 0 ||
            (entry.is_journal_complete &&
              typeof entry.journal_completion_streak === "number")) && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
              {locations.length > 0 ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 break-words">{locationLabel}</span>
                </span>
              ) : null}
              {entry.is_journal_complete &&
              typeof entry.journal_completion_streak === "number" ? (
                <span
                  className="inline-flex items-center gap-0.5 tabular-nums"
                  title={t("journalStreak", {
                    count: entry.journal_completion_streak,
                  })}
                >
                  <Flame className="h-3 w-3 shrink-0" />
                  {entry.journal_completion_streak}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </button>

      {(hasVideo || photoPaths.length > 0) && (
        <div className="relative mt-3 overflow-hidden rounded-xl">
          {hasVideo ? (
            <JournalVideoSection
              videoSrc={videoSrc ?? ""}
              canPlay={isOnline && Boolean(videoSrc)}
              thumbnail={{
                videoSrc: videoSrc,
                storedThumbnail: entry.video_thumbnail,
              }}
            />
          ) : photoPaths[0] && getJournalPhotoUrl(photoPaths[0]) ? (
            <div className="relative aspect-[2/1] w-full bg-muted">
              <img
                src={getJournalPhotoUrl(photoPaths[0])!}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : null}

          {photoPaths.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 right-3 z-10">
              <div className="pointer-events-auto">
                <JournalPhotoStack photoPaths={photoPaths} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
