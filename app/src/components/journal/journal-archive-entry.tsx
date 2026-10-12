import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import {
  getJournalVideoPlaybackUrl,
  normalizeJournalLocationRoute,
} from "@/lib/journal";
import { JOURNAL_JUMP_DATE_KEY } from "@/lib/journal/archive";
import { fromDateString } from "@/lib/time-utils";
import { getActiveLocaleTag } from "@/lib/i18n";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAccountSettings } from "@/lib/use-account-settings";
import JournalVideoSection from "@/components/journal/journal-video-section";
import JournalLocationMapPicker from "@/components/journal/journal-location-map-picker";
import MediaLightbox from "@/components/journal/media-lightbox";
import JournalArchivePhotoGrid from "@/components/journal/journal-archive-photos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JournalArchiveEntryProps {
  entry: JournalEntry;
  /** Briefly emphasize the entry after jumping from the world map. */
  highlighted?: boolean;
}

export default function JournalArchiveEntry({
  entry,
  highlighted = false,
}: JournalArchiveEntryProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [videoOpen, setVideoOpen] = useState(false);
  const [placesMapOpen, setPlacesMapOpen] = useState(false);

  const date = fromDateString(entry.entry_date);
  const dayNumber = date.getDate();
  const weekday = date.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
  });

  const videoSrc = entry.video_path
    ? getJournalVideoPlaybackUrl(entry.video_path)
    : null;
  const photoPaths = entry.photo_paths ?? [];
  const clipEnabled = useAccountSettings().dailyClip === true;
  const hasVideo = clipEnabled && Boolean(videoSrc || entry.video_thumbnail);
  const locations = normalizeJournalLocationRoute(
    entry.location ?? { locations: [] }
  ).locations;
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
      data-journal-entry-date={entry.entry_date}
      className={cn(
        "py-1 duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
        highlighted && "rounded-xl ring-2 ring-primary/40"
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
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

        <div className="min-w-0 overflow-hidden rounded-xl border border-border/70">
          <button
            type="button"
            onClick={openDay}
            className="group w-full space-y-1 px-3 py-2.5 text-left"
          >
            <h2 className="font-crimson text-2xl font-bold leading-snug tracking-tight">
              {entry.title?.trim() || t("untitled")}
            </h2>
            {entry.text_content?.trim() ? (
              <p className="whitespace-pre-wrap font-crimson text-base leading-relaxed text-muted-foreground">
                {entry.text_content}
              </p>
            ) : null}
          </button>

          {locations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
              {locations.map((loc, index) => (
                <Button
                  key={`${index}-${loc.displayName}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlacesMapOpen(true);
                  }}
                  className="inline-flex h-6 max-w-full items-center gap-1 rounded-full px-2 text-left text-xs font-normal leading-none text-muted-foreground shadow-none"
                  title={t("locations.openFullscreenMap")}
                  aria-label={`${loc.displayName}. ${t("locations.openFullscreenMap")}`}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 truncate">{loc.displayName}</span>
                </Button>
              ))}
            </div>
          ) : null}

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
              <JournalArchivePhotoGrid photoPaths={photoPaths} />
            </div>
          )}
        </div>
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

      {locations.length > 0 ? (
        <JournalLocationMapPicker
          locations={locations}
          showPreview={false}
          fullscreenOpen={placesMapOpen}
          onFullscreenOpenChange={setPlacesMapOpen}
        />
      ) : null}
    </article>
  );
}
