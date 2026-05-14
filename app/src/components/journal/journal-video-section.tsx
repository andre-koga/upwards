import { useState } from "react";
import { CloudOff } from "lucide-react";
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

function JournalVideoPlayOverlay({ canPlay }: { canPlay: boolean }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20">
        {canPlay ? (
          <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <CloudOff className="h-6 w-6 text-white/80" />
        )}
      </span>
    </span>
  );
}

export default function JournalVideoSection({
  videoSrc,
  thumbnail,
  canPlay,
  onThumbnailGenerated,
}: JournalVideoSectionProps) {
  const [playing, setPlaying] = useState(false);

  const storedThumbnail = thumbnail?.storedThumbnail ?? null;
  const videoSrcForThumb = thumbnail?.videoSrc ?? videoSrc;
  const hasVideo = videoSrcForThumb.trim().length > 0;

  const { directVideoThumb, directVideoThumbError } = useDirectVideoThumbnail({
    hasDirectVideo: hasVideo,
    storedThumbnail,
    videoUrlForThumb: videoSrcForThumb,
    onThumbnailGenerated,
  });

  const handlePlayClick = () => {
    if (!canPlay) return;
    setPlaying(true);
  };

  return (
    <div className={cn("relative aspect-[2/1] w-full bg-muted")}>
      {hasVideo ? (
        playing ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={videoSrcForThumb}
            controls
            autoPlay
          />
        ) : directVideoThumb ? (
          <Button
            type="button"
            variant="bare"
            onClick={handlePlayClick}
            className="!block absolute inset-0 h-full w-full rounded-none"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <img
              src={directVideoThumb}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </Button>
        ) : directVideoThumbError ? (
          <Button
            type="button"
            variant="bare"
            onClick={handlePlayClick}
            className="!block absolute inset-0 h-full w-full rounded-none"
            title={canPlay ? "Play video" : "Offline – connect to play"}
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
