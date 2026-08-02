import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import { getJournalPhotoUrl, getJournalVideoPlaybackUrl } from "@/lib/journal";
import { JOURNAL_JUMP_DATE_KEY } from "@/lib/journal/archive";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import { useOnlineStatus } from "@/hooks/use-online-status";
import JournalVideoSection from "@/components/journal/journal-video-section";
import MediaLightbox from "@/components/journal/media-lightbox";
import { cn } from "@/lib/utils";

interface JournalArchiveEntryProps {
  entry: JournalEntry;
}

/** Soft washes on the content panel — picked stably per bookmarked entry. */
const BOOKMARK_GRADIENTS = [
  "bg-gradient-to-br from-rose-500/15 via-amber-400/8 to-transparent dark:from-rose-400/20 dark:via-amber-300/12",
  "bg-gradient-to-bl from-sky-500/15 via-teal-400/8 to-transparent dark:from-sky-400/20 dark:via-teal-300/12",
  "bg-gradient-to-tr from-orange-500/15 via-rose-400/8 to-transparent dark:from-orange-400/20 dark:via-rose-300/12",
  "bg-gradient-to-tl from-emerald-500/15 via-lime-400/8 to-transparent dark:from-emerald-400/20 dark:via-lime-300/12",
  "bg-gradient-to-br from-fuchsia-500/15 via-pink-400/8 to-transparent dark:from-fuchsia-400/20 dark:via-pink-300/12",
  "bg-gradient-to-bl from-cyan-500/15 via-sky-400/8 to-transparent dark:from-cyan-400/20 dark:via-sky-300/12",
] as const;

function bookmarkGradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return BOOKMARK_GRADIENTS[Math.abs(hash) % BOOKMARK_GRADIENTS.length];
}

interface LightboxState {
  key: string;
  index: number;
  open: boolean;
}

function ArchivePhotoGrid({ photoPaths }: { photoPaths: string[] }) {
  const { t } = useTranslation("journal");
  const pathsKey = photoPaths.join("\0");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Derive closed state when the photo set changes instead of calling
  // setState during render or in a reset effect.
  const isStale = lightbox !== null && lightbox.key !== pathsKey;
  const lightboxOpen = lightbox !== null && !isStale && lightbox.open;
  const lightboxIndex = lightbox !== null && !isStale ? lightbox.index : 0;

  if (photoPaths.length === 0) return null;

  const previewLimit = 2;
  const previewPaths = photoPaths.slice(0, previewLimit);
  const hiddenCount = Math.max(0, photoPaths.length - previewLimit);
  const singlePreview = previewPaths.length === 1;

  const showPreviousPhoto = () =>
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (current.index - 1 + photoPaths.length) % photoPaths.length,
          }
        : current
    );

  const showNextPhoto = () =>
    setLightbox((current) =>
      current
        ? { ...current, index: (current.index + 1) % photoPaths.length }
        : current
    );

  const lightboxUrl = getJournalPhotoUrl(photoPaths[lightboxIndex]);

  return (
    <>
      <div
        className={cn("grid gap-1.5", singlePreview ? "grid-cols-1" : "grid-cols-2")}
      >
        {previewPaths.map((path, index) => {
          const url = getJournalPhotoUrl(path);
          const isOverflowTile =
            hiddenCount > 0 && index === previewPaths.length - 1;
          return (
            <button
              key={path}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Overflow tile jumps to the first hidden photo in the lightbox.
                const openIndex = isOverflowTile ? previewLimit : index;
                setLightbox({ key: pathsKey, index: openIndex, open: true });
              }}
              className={cn(
                "relative overflow-hidden rounded-lg bg-muted",
                singlePreview ? "aspect-[2/1]" : "aspect-square"
              )}
              aria-label={
                isOverflowTile
                  ? t("archive.morePhotos", { count: hiddenCount })
                  : t("upload.photoAlt", { index: index + 1 })
              }
            >
              {url ? (
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : null}
              {isOverflowTile ? (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-black/55"
                  aria-hidden
                >
                  <span className="font-crimson text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
                    +{hiddenCount}
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <MediaLightbox
        open={lightboxOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLightbox((current) =>
              current ? { ...current, open: false } : current
            );
          }
        }}
        title={t("upload.photoAlt", { index: lightboxIndex + 1 })}
        index={lightboxIndex}
        count={photoPaths.length}
        onPrevious={showPreviousPhoto}
        onNext={showNextPhoto}
        previousLabel={t("archive.previousPhoto")}
        nextLabel={t("archive.nextPhoto")}
        closeLabel={t("archive.closePhoto")}
      >
        {lightboxUrl ? (
          <img
            src={lightboxUrl}
            alt={t("upload.photoAlt", { index: lightboxIndex + 1 })}
            className="max-h-[90dvh] max-w-[90dvw] rounded-lg object-contain shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {t("archive.photoUnavailable")}
          </div>
        )}
      </MediaLightbox>
    </>
  );
}

export default function JournalArchiveEntry({
  entry,
}: JournalArchiveEntryProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [videoOpen, setVideoOpen] = useState(false);

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
  const bookmarkGradient = isBookmarked
    ? bookmarkGradientFor(entry.id || entry.entry_date)
    : null;

  const openDay = () => {
    try {
      sessionStorage.setItem(JOURNAL_JUMP_DATE_KEY, entry.entry_date);
    } catch {
      // ignore quota / private mode
    }
    navigate("/");
  };

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-1 duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 pt-1">
        <button
          type="button"
          onClick={openDay}
          className="group flex flex-col items-center gap-1 text-left"
        >
          <span className="font-crimson text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
            {dayNumber}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {weekday}
          </span>
        </button>
        <span
          className={cn(
            "text-4xl leading-none",
            !entry.day_emoji && "text-muted-foreground"
          )}
          aria-hidden
        >
          {entry.day_emoji?.trim() || "🙂"}
        </span>
        {isBookmarked ? (
          <span className="sr-only">{t("bookmarkDay")}</span>
        ) : null}
      </div>

      <div
        className={cn(
          "min-w-0 overflow-hidden rounded-xl border border-border/70",
          bookmarkGradient
        )}
      >
        <button
          type="button"
          onClick={openDay}
          className="group w-full space-y-1 px-3 py-2.5 text-left"
        >
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
        </button>

        {(hasVideo || photoPaths.length > 0) && (
          <div className="space-y-1.5 px-3 pb-2.5">
            {hasVideo ? (
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-lg text-left"
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
                    canPlay={isOnline && Boolean(videoSrc)}
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
      </div>

      <MediaLightbox
        open={videoOpen && Boolean(videoSrc)}
        onOpenChange={(open) => {
          if (!open) setVideoOpen(false);
        }}
        title={t("archive.openVideo")}
        closeLabel={t("archive.closePhoto")}
        contentClassName="max-h-full w-full max-w-[min(92vw,40rem)] overflow-hidden rounded-xl bg-black"
      >
        <video
          className="aspect-[2/1] w-full object-contain"
          src={videoSrc ?? undefined}
          controls
          autoPlay
          playsInline
        />
      </MediaLightbox>
    </article>
  );
}
