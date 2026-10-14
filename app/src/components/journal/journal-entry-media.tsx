import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { JournalEntry, LocationData } from "@/lib/db/types";
import JournalLocationMapPicker from "@/components/journal/journal-location-map-picker";
import JournalVideoSection from "@/components/journal/journal-video-section";
import MediaLightbox from "@/components/journal/media-lightbox";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getJournalVideoPlaybackUrl } from "@/lib/journal";
import { useAccountSettings } from "@/lib/use-account-settings";

/**
 * A day's clip as its poster, opening a player. Shown only when the daily clip
 * is on and the day has one. Shared by the feed card and the reader.
 */
export function JournalEntryClip({
  entry,
}: {
  entry: Pick<JournalEntry, "video_path" | "video_thumbnail">;
}) {
  const { t } = useTranslation("journal");
  const isOnline = useOnlineStatus();
  const clipEnabled = useAccountSettings().dailyClip === true;
  const [open, setOpen] = useState(false);

  const videoSrc = entry.video_path
    ? getJournalVideoPlaybackUrl(entry.video_path)
    : null;
  if (!clipEnabled || !(videoSrc || entry.video_thumbnail)) return null;

  return (
    <>
      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-lg text-left"
        onClick={(e) => {
          e.stopPropagation();
          if (!isOnline || !videoSrc) return;
          setOpen(true);
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

      <MediaLightbox
        open={open && Boolean(videoSrc)}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
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
    </>
  );
}

/** A day's places as chips; any of them opens the day's map. */
export function JournalEntryPlaces({
  locations,
  className,
}: {
  locations: LocationData[];
  className?: string;
}) {
  const { t } = useTranslation("journal");
  const [mapOpen, setMapOpen] = useState(false);
  if (locations.length === 0) return null;

  return (
    <>
      <div className={className ?? "flex flex-wrap gap-1.5"}>
        {locations.map((loc, index) => (
          <Button
            key={`${index}-${loc.displayName}-${loc.lat ?? ""}-${loc.lon ?? ""}`}
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setMapOpen(true);
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
      <JournalLocationMapPicker
        locations={locations}
        showPreview={false}
        fullscreenOpen={mapOpen}
        onFullscreenOpenChange={setMapOpen}
      />
    </>
  );
}
