/**
 * SRP: Renders the journal video section with URL editing, optional uploads, and a consistent thumbnail facade.
 */
import { useEffect, useRef, useState } from "react";
import { CloudOff, Loader2, Pencil, Upload, X } from "lucide-react";
import { InputPromptDialog } from "@/components/ui/input-prompt-dialog";
import {
  JournalVideoUploadError,
  uploadJournalVideo,
} from "@/lib/journal-video-storage";

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
  thumbnail: JournalThumbnailSource | null;
  canPlay: boolean;
  onThumbnailGenerated?: (dataUrl: string) => void;
  onChange: (url: string) => void;
  onBlur: () => void;
}

function getVideoId(embedUrl: string): string | null {
  const match = embedUrl.match(/embed\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function JournalVideoSection({
  canEdit,
  youtubeUrl,
  embedUrl,
  entryDate,
  canUpload,
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
  const [, setUploadError] = useState<string | null>(null);
  const [directVideoThumb, setDirectVideoThumb] = useState<string | null>(null);
  const [directVideoThumbError, setDirectVideoThumbError] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const storedThumbnail = thumbnail?.storedThumbnail ?? null;
  const videoUrlForThumb = thumbnail?.videoUrl ?? youtubeUrl;
  const videoId =
    thumbnail?.youtubeVideoId ?? (embedUrl ? getVideoId(embedUrl) : null);
  const hasDirectVideo = !videoId && videoUrlForThumb.trim().length > 0;

  // Generate a thumbnail for direct-uploaded videos to avoid device-specific HUD differences.
  useEffect(() => {
    if (!hasDirectVideo) {
      setDirectVideoThumb(null);
      setDirectVideoThumbError(null);
      return;
    }

    // If we already have a stored thumbnail, use it and skip regeneration
    if (storedThumbnail) {
      setDirectVideoThumb(storedThumbnail);
      setDirectVideoThumbError(null);
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.src = videoUrlForThumb;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    const handleLoadedData = () => {
      if (cancelled) return;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      try {
        const url = canvas.toDataURL("image/jpeg", 0.6);
        setDirectVideoThumb(url);
        setDirectVideoThumbError(null);
        onThumbnailGenerated?.(url);
      } catch (err) {
        console.error("Failed to create video thumbnail", err);
        setDirectVideoThumbError("Preview unavailable");
      }
    };

    const handleError = () => {
      if (cancelled) return;
      setDirectVideoThumb(null);
      setDirectVideoThumbError("Preview unavailable");
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      video.src = "";
    };
  }, [hasDirectVideo, storedThumbnail, videoUrlForThumb, onThumbnailGenerated]);

  const handleOpen = (next: boolean) => {
    if (next) setDraft(youtubeUrl);
    setOpen(next);
  };

  const handleSave = () => {
    onChange(draft);
    onBlur();
    setOpen(false);
    setPlaying(false);
  };

  const handleClear = () => {
    onChange("");
    onBlur();
    setOpen(false);
    setPlaying(false);
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
      // Reset the input so the same file can be selected again if needed
      const input = event.target;
      if (input) {
        input.value = "";
      }
    }
  };

  return (
    <div
      className="relative w-full bg-muted"
      style={{ paddingBottom: "56.25%" }}
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
          /* Thumbnail facade — shows only the thumbnail + play button */
          <button
            onClick={() => {
              if (!canPlay) return;
              setPlaying(true);
            }}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <img
              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              onError={(e) => {
                // fall back to hqdefault if maxres isn't available
                (e.currentTarget as HTMLImageElement).src =
                  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              }}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Play button */}
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
            onClick={() => {
              if (!canPlay) return;
              setPlaying(true);
            }}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <img
              src={directVideoThumb}
              alt="Video thumbnail"
              className="absolute inset-0 h-full w-full object-cover"
            />
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
          </button>
        ) : directVideoThumbError ? (
          <button
            onClick={() => {
              if (!canPlay) return;
              setPlaying(true);
            }}
            className="group absolute inset-0 h-full w-full"
            title={canPlay ? "Play video" : "Offline – connect to play"}
          >
            <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground/60">
                {directVideoThumbError}
              </span>
            </div>
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

      {/* Bottom fade into background */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-1/5 bg-gradient-to-b from-transparent to-background" />

      {canEdit && (
        <div className="absolute -bottom-4 right-3 z-20 flex items-center gap-2">
          {canUpload && (
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
                disabled={uploading}
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
          <button
            onClick={() => handleOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-muted bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
            title="Set video"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <InputPromptDialog
            open={open}
            onOpenChange={handleOpen}
            title="Video URL"
            value={draft}
            onChange={setDraft}
            onConfirm={handleSave}
            confirmLabel="Save"
            placeholder="https://..."
            inputType="url"
            secondaryAction={
              youtubeUrl
                ? {
                    label: (
                      <>
                        <X className="h-3 w-3" />
                        Clear
                      </>
                    ),
                    onClick: handleClear,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
