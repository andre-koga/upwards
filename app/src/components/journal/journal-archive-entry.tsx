import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Heart, MapPin, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JournalArchiveEntryProps {
  entry: JournalEntry;
  holiday: string | null;
}

function ArchivePhotoGrid({ photoPaths }: { photoPaths: string[] }) {
  const { t } = useTranslation("journal");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pathsKey, setPathsKey] = useState(() => photoPaths.join("\0"));
  const nextPathsKey = photoPaths.join("\0");
  if (pathsKey !== nextPathsKey) {
    setPathsKey(nextPathsKey);
    setLightboxIndex(null);
  }

  if (photoPaths.length === 0) return null;

  const cols =
    photoPaths.length === 1
      ? "grid-cols-1"
      : photoPaths.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <>
      <div className={cn("mt-3 grid gap-2", cols)}>
        {photoPaths.map((path, index) => {
          const url = getJournalPhotoUrl(path);
          return (
            <button
              key={path}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(index);
              }}
              className="relative aspect-square overflow-hidden rounded-lg bg-muted"
              aria-label={t("upload.photoAlt", { index: index + 1 })}
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {lightboxIndex !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxIndex(null);
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="smIcon"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 z-10 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
            aria-label={t("archive.closePhoto")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          <div
            className="relative flex max-h-[90dvh] max-w-[90dvw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const url = getJournalPhotoUrl(photoPaths[lightboxIndex]);
              return url ? (
                <img
                  src={url}
                  alt={t("upload.photoAlt", { index: lightboxIndex + 1 })}
                  className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
                  draggable={false}
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {t("archive.photoUnavailable")}
                </div>
              );
            })()}
          </div>

          {photoPaths.length > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="smIcon"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (i) =>
                      ((i ?? 0) - 1 + photoPaths.length) % photoPaths.length
                  );
                }}
                className="absolute left-3 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                aria-label={t("archive.previousPhoto")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="smIcon"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (i) => ((i ?? 0) + 1) % photoPaths.length
                  );
                }}
                className="absolute right-3 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                aria-label={t("archive.nextPhoto")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-white">
                {lightboxIndex + 1} / {photoPaths.length}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
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
        className="group w-full space-y-2 text-left"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-crimson text-lg font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
            {dayNumber}
          </span>
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
            <Heart
              className="h-3.5 w-3.5 fill-red-500 text-red-500"
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
              <p className="mt-1 whitespace-pre-wrap font-crimson text-[15px] leading-relaxed text-muted-foreground">
                {entry.text_content}
              </p>
            ) : null}
          </div>
        </div>

        {(locations.length > 0 ||
          (entry.is_journal_complete &&
            typeof entry.journal_completion_streak === "number")) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
      </button>

      {hasVideo ? (
        <div className="mt-3 overflow-hidden rounded-xl">
          <JournalVideoSection
            videoSrc={videoSrc ?? ""}
            canPlay={isOnline && Boolean(videoSrc)}
            thumbnail={{
              videoSrc: videoSrc,
              storedThumbnail: entry.video_thumbnail,
            }}
          />
        </div>
      ) : null}

      <ArchivePhotoGrid photoPaths={photoPaths} />
    </article>
  );
}
