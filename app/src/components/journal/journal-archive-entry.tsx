import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, MapPin, X } from "lucide-react";
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
        : "grid-cols-2";

  return (
    <>
      <div className={cn("grid gap-2", cols)}>
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
              className={cn(
                "relative overflow-hidden rounded-lg bg-muted",
                photoPaths.length === 1 ? "aspect-[2/1]" : "aspect-square"
              )}
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
    weekday: "short",
  });

  const videoSrc = entry.video_path
    ? getJournalVideoPlaybackUrl(entry.video_path)
    : null;
  const photoPaths = entry.photo_paths ?? [];
  const hasVideo = Boolean(videoSrc || entry.video_thumbnail);
  const locations = entry.location?.locations ?? [];
  const locationLabel = locations.map((l) => l.displayName).join(" → ");
  const showMetaRow = locations.length > 0 || Boolean(entry.is_bookmarked);

  const openDay = () => {
    try {
      sessionStorage.setItem(JOURNAL_JUMP_DATE_KEY, entry.entry_date);
    } catch {
      // ignore quota / private mode
    }
    navigate("/");
  };

  return (
    <article className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
      {(hasVideo || photoPaths.length > 0) && (
        <div className="space-y-2">
          {hasVideo ? (
            <div className="overflow-hidden rounded-xl">
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
        </div>
      )}

      {showMetaRow ? (
        <div className="flex items-start justify-end gap-2">
          {locations.length > 0 ? (
            <p className="inline-flex min-w-0 max-w-[85%] items-start justify-end gap-1 text-right text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">{locationLabel}</span>
            </p>
          ) : null}
          {entry.is_bookmarked ? (
            <Heart
              className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500"
              aria-label={t("bookmarkDay")}
            />
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={openDay}
        className="group grid w-full grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 gap-y-1 text-left"
      >
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <span className="font-crimson text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
            {dayNumber}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {weekday}
          </span>
          <span
            className={cn(
              "mt-1 text-3xl leading-none",
              !entry.day_emoji && "text-muted-foreground"
            )}
            aria-hidden
          >
            {entry.day_emoji?.trim() || "🙂"}
          </span>
        </div>

        <div className="min-w-0 space-y-1.5">
          <h2 className="font-crimson text-2xl font-bold leading-snug tracking-tight">
            {entry.title?.trim() || t("untitled")}
          </h2>
          {entry.text_content?.trim() ? (
            <p className="whitespace-pre-wrap font-crimson text-base leading-relaxed text-muted-foreground">
              {entry.text_content}
            </p>
          ) : null}
        </div>
      </button>
    </article>
  );
}
