import { useState } from "react";
import { CloudOff, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDirectVideoThumbnail } from "./hooks/use-direct-video-thumbnail";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface JournalThumbnailSource {
  videoSrc: string | null;
  storedThumbnail: string | null;
}

interface JournalVideoSectionProps {
  videoSrc: string;
  thumbnail: JournalThumbnailSource | null;
  canPlay: boolean;
  onThumbnailGenerated?: (dataUrl: string | null) => void;
}

// A quiet frosted pill in the corner instead of a big disc over the picture,
// so the frame reads as a still from the day rather than a media player.
function JournalVideoPlayOverlay({ canPlay }: { canPlay: boolean }) {
  const { t } = useTranslation("journal");
  return (
    <>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent"
        aria-hidden
      />
      <span className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/35 pl-2.5 pr-3 text-[0.8125rem] font-medium text-white backdrop-blur-md">
        {canPlay ? (
          <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
        ) : (
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
        )}
        {t("versions.clip")}
      </span>
    </>
  );
}

export default function JournalVideoSection({
  videoSrc,
  thumbnail,
  canPlay,
  onThumbnailGenerated,
}: JournalVideoSectionProps) {
  const { t } = useTranslation("journal");
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);
  // Frame follows the clip: portrait phone clips stand tall, others sit wide.
  const [portrait, setPortrait] = useState(false);

  const storedThumbnail = thumbnail?.storedThumbnail ?? null;
  const videoSrcForThumb = thumbnail?.videoSrc ?? videoSrc;
  const hasVideo = videoSrcForThumb.trim().length > 0;
  // Playing state is keyed to the current source — a new video resets it.
  const playing = hasVideo && playingSrc === videoSrcForThumb;

  const { directVideoThumb, directVideoThumbError } = useDirectVideoThumbnail({
    hasDirectVideo: hasVideo,
    storedThumbnail,
    videoUrlForThumb: videoSrcForThumb,
    onThumbnailGenerated,
  });

  const handlePlayClick = () => {
    if (!canPlay) return;
    setPlayingSrc(videoSrcForThumb);
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-inset ring-foreground/5",
        portrait ? "mx-auto aspect-[4/5] max-w-[20rem]" : "aspect-video"
      )}
    >
      {hasVideo ? (
        playing ? (
          <video
            className="absolute inset-0 h-full w-full bg-black object-contain"
            src={videoSrcForThumb}
            controls
            autoPlay
          />
        ) : directVideoThumb ? (
          <Button
            type="button"
            variant="bare"
            onClick={handlePlayClick}
            className="absolute inset-0 !block h-full w-full rounded-none"
            title={
              canPlay
                ? t("archive.openVideo")
                : t("archive.gallery.clipOffline")
            }
            aria-label={
              canPlay
                ? t("archive.openVideo")
                : t("archive.gallery.clipOffline")
            }
          >
            <img
              src={directVideoThumb}
              alt=""
              onLoad={(e) =>
                setPortrait(
                  e.currentTarget.naturalHeight > e.currentTarget.naturalWidth
                )
              }
              className="absolute inset-0 h-full w-full object-cover"
            />
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </Button>
        ) : directVideoThumbError ? (
          <Button
            type="button"
            variant="bare"
            onClick={handlePlayClick}
            className="absolute inset-0 !block h-full w-full rounded-none"
            title={
              canPlay
                ? t("archive.openVideo")
                : t("archive.gallery.clipOffline")
            }
            aria-label={
              canPlay
                ? t("archive.openVideo")
                : t("archive.gallery.clipOffline")
            }
          >
            <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">
                {directVideoThumbError}
              </span>
            </div>
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </Button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-sm text-muted-foreground">
              Loading preview…
            </span>
          </div>
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="select-none text-sm text-muted-foreground">
            No video
          </span>
        </div>
      )}
    </div>
  );
}
