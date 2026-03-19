/**
 * SRP: Renders the journal video section with URL editing, optional uploads, and a consistent thumbnail facade.
 */
import { useState, useRef, useEffect } from "react";
import { CloudOff, Loader2, Upload } from "lucide-react";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormStack,
} from "@/components/forms";
import {
  deleteJournalVideoByUrl,
  JournalVideoUploadError,
  uploadJournalVideo,
} from "@/lib/journal-video-storage";
import { HOLD_ACTION_DELAY_MS } from "@/lib/consts";
import { getYoutubeVideoIdFromEmbed } from "@/lib/youtube-utils";
import { useDirectVideoThumbnail } from "./hooks/use-direct-video-thumbnail";

export interface JournalThumbnailSource {
  videoUrl: string | null;
  youtubeVideoId: string | null;
  storedThumbnail: string | null;
}

interface JournalVideoSectionProps {
  canEdit: boolean;
  youtubeUrl: string;
  embedUrl: string | null;
  entryDate: string;
  canUpload: boolean;
  leftControl?: React.ReactNode;
  thumbnail: JournalThumbnailSource | null;
  canPlay: boolean;
  onThumbnailGenerated?: (dataUrl: string | null) => void;
  onChange: (url: string) => void;
  onBlur: () => void;
}

function JournalVideoPlayOverlay({ canPlay }: { canPlay: boolean }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20 transition-colors group-hover:bg-black/40">
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
  canEdit,
  youtubeUrl,
  embedUrl,
  entryDate,
  canUpload,
  leftControl,
  thumbnail,
  canPlay,
  onThumbnailGenerated,
  onChange,
  onBlur,
}: JournalVideoSectionProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextPlayClickRef = useRef(false);

  const storedThumbnail = thumbnail?.storedThumbnail ?? null;
  const videoUrlForThumb = thumbnail?.videoUrl ?? youtubeUrl;
  const videoId =
    thumbnail?.youtubeVideoId ??
    (embedUrl ? getYoutubeVideoIdFromEmbed(embedUrl) : null);
  const hasDirectVideo = !videoId && videoUrlForThumb.trim().length > 0;
  const hasVideoSetup = youtubeUrl.trim().length > 0;

  const {
    directVideoThumb,
    directVideoThumbError,
    setForceThumbnailRegeneration,
    setDirectVideoThumb,
    setDirectVideoThumbError,
  } = useDirectVideoThumbnail({
    hasDirectVideo,
    storedThumbnail,
    videoUrlForThumb,
    onThumbnailGenerated,
  });

  const handleOpen = (next: boolean) => {
    if (next) setDraft(youtubeUrl);
    setOpen(next);
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleHoldStart = () => {
    if (!canEdit) return;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      suppressNextPlayClickRef.current = true;
      handleOpen(true);
    }, HOLD_ACTION_DELAY_MS);
  };

  const handleHoldEnd = () => {
    clearHoldTimer();
  };

  const handlePlayClick = () => {
    if (suppressNextPlayClickRef.current) {
      suppressNextPlayClickRef.current = false;
      return;
    }
    if (!canPlay) return;
    setPlaying(true);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current != null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const handleSave = () => {
    setForceThumbnailRegeneration(true);
    setDirectVideoThumb(null);
    setDirectVideoThumbError(null);
    onChange(draft.trim());
    onBlur();
    setOpen(false);
    setPlaying(false);
  };

  const handleClear = async () => {
    setUploadError(null);
    setClearing(true);
    try {
      await deleteJournalVideoByUrl(youtubeUrl);
      setForceThumbnailRegeneration(false);
      setDirectVideoThumb(null);
      setDirectVideoThumbError(null);
      onThumbnailGenerated?.(null);
      onChange("");
      onBlur();
      setDraft("");
      setOpen(false);
      setPlaying(false);
    } catch (error) {
      let message = "Failed to clear video.";
      if (error instanceof JournalVideoUploadError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setUploadError(message);
      console.error("Error clearing journal video:", error);
    } finally {
      setClearing(false);
    }
  };

  const handleDialogInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" && !hasVideoSetup && draft.trim().length > 0) {
      event.preventDefault();
      handleSave();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadJournalVideo(file, entryDate);
      setDraft(url);
      onChange(url);
      onBlur();
      setPlaying(false);
    } catch (error) {
      let message = "Failed to upload video.";
      if (error instanceof JournalVideoUploadError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setUploadError(message);
    } finally {
      setUploading(false);
      const input = event.target;
      if (input) input.value = "";
    }
  };

  return (
    <div
      className="relative w-full bg-muted"
      style={{ paddingBottom: "56.25%" }}
      onPointerDown={canEdit ? handleHoldStart : undefined}
      onPointerUp={canEdit ? handleHoldEnd : undefined}
      onPointerCancel={canEdit ? handleHoldEnd : undefined}
      onContextMenu={canEdit ? (e) => e.preventDefault() : undefined}
    >
      {videoId ? (
        playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title="Daily vlog"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            onClick={handlePlayClick}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <img
              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </button>
        )
      ) : hasDirectVideo ? (
        playing ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={youtubeUrl}
            controls
            autoPlay
          />
        ) : directVideoThumb ? (
          <button
            onClick={handlePlayClick}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <img
              src={directVideoThumb}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </button>
        ) : directVideoThumbError ? (
          <button
            onClick={handlePlayClick}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground/60">
                {directVideoThumbError}
              </span>
            </div>
            <JournalVideoPlayOverlay canPlay={canPlay} />
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-sm text-muted-foreground/40">
              Loading preview…
            </span>
          </div>
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="select-none text-sm text-muted-foreground/40">
            No video
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-1/5 bg-gradient-to-b from-transparent to-background" />

      {leftControl && (
        <div className="absolute -bottom-4 left-3 z-20">{leftControl}</div>
      )}

      {canEdit && (
        <div className="absolute -bottom-4 right-3 z-20 flex items-center gap-2">
          {canUpload && !hasVideoSetup && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || clearing}
                className="flex h-7 items-center justify-center rounded-full border border-muted bg-background/80 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background disabled:opacity-60"
                title="Upload video"
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-3 w-3" />
                )}
                Upload
              </button>
            </>
          )}
          <FormDialog
            open={open}
            onOpenChange={handleOpen}
            title="Video URL"
            contentClassName="w-80"
          >
            <FormStack>
              <FormField
                id="journal-video-url"
                label="Video URL"
                labelClassName="sr-only"
                value={draft}
                onChange={(event) => {
                  if (hasVideoSetup) return;
                  setDraft(event.target.value);
                }}
                onKeyDown={handleDialogInputKeyDown}
                type="url"
                readOnly={hasVideoSetup}
                placeholder="https://..."
              />
              <FormDialogActions
                onConfirm={handleSave}
                confirmLabel="Save"
                confirmDisabled={hasVideoSetup || draft.trim().length === 0}
                secondaryAction={
                  hasVideoSetup
                    ? {
                        label: "Clear",
                        onClick: handleClear,
                        disabled: clearing || uploading,
                        destructive: true,
                      }
                    : undefined
                }
              />
            </FormStack>
          </FormDialog>
        </div>
      )}
    </div>
  );
}
