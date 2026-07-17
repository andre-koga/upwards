import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

function MediaLightbox({
  children,
  onClose,
  ariaLabel,
}: {
  children: ReactNode;
  onClose: () => void;
  ariaLabel: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="smIcon"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-10 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {children}
    </div>,
    document.body
  );
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
        <MediaLightbox
          ariaLabel={t("upload.photoAlt", { index: lightboxIndex + 1 })}
          onClose={() => setLightboxIndex(null)}
        >
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
        </MediaLightbox>
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
  const [videoOpen, setVideoOpen] = useState(false);

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
  const isBookmarked = Boolean(entry.is_bookmarked);

  const openDay = () => {
    try {
      sessionStorage.setItem(JOURNAL_JUMP_DATE_KEY, entry.entry_date);
    } catch {
      // ignore quota / private mode
    }
    navigate("/");
  };

  return (
    <article
      className={cn(
        "space-y-4 rounded-2xl p-3 -mx-1 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
        isBookmarked &&
          "bg-gradient-to-br from-rose-500/10 via-amber-400/5 to-transparent dark:from-rose-400/15 dark:via-amber-300/10"
      )}
    >
      {(hasVideo || photoPaths.length > 0) && (
        <div className="space-y-2">
          {hasVideo ? (
            <button
              type="button"
              className="relative block w-full overflow-hidden rounded-xl text-left"
              onClick={(e) => {
                e.stopPropagation();
                if (!isOnline || !videoSrc) return;
                setVideoOpen(true);
              }}
              aria-label={t("archive.openVideo")}
            >
              <div className="pointer-events-none">
                <JournalVideoSection
                  videoSrc={videoSrc ?? ""}
                  canPlay={false}
                  thumbnail={{
                    videoSrc: videoSrc,
                    storedThumbnail: entry.video_thumbnail,
                  }}
                />
              </div>
            </button>
          ) : null}
          <ArchivePhotoGrid photoPaths={photoPaths} />
        </div>
      )}

      {videoOpen && videoSrc ? (
        <MediaLightbox
          ariaLabel={t("archive.openVideo")}
          onClose={() => setVideoOpen(false)}
        >
          <div
            className="relative w-[min(92vw,40rem)] overflow-hidden rounded-xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              className="aspect-[2/1] w-full object-contain"
              src={videoSrc}
              controls
              autoPlay
              playsInline
            />
          </div>
        </MediaLightbox>
      ) : null}

      <button
        type="button"
        onClick={openDay}
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-left"
      >
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <span
            className={cn(
              "text-4xl leading-none",
              !entry.day_emoji && "text-muted-foreground"
            )}
            aria-hidden
          >
            {entry.day_emoji?.trim() || "🙂"}
          </span>
          <div className="flex w-fit flex-col items-center gap-1 rounded-full border border-muted px-1.5 py-3">
            <span className="font-crimson text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
              {dayNumber}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {weekday}
            </span>
          </div>
          {isBookmarked ? (
            <Heart
              className="h-3 w-3 fill-red-500 text-red-500"
              aria-label={t("bookmarkDay")}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-1.5">
          <h2 className="font-crimson text-2xl font-bold leading-snug tracking-tight">
            {entry.title?.trim() || t("untitled")}
          </h2>
          {locations.length > 0 ? (
            <p className="inline-flex min-w-0 max-w-full items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">{locationLabel}</span>
            </p>
          ) : null}
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
