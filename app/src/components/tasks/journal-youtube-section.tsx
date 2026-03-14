/**
 * SRP: Renders the journal video section with URL editing and optional uploads.
 */
import { useRef, useState } from "react";
import { Loader2, Pencil, Upload, X } from "lucide-react";
import { InputPromptDialog } from "@/components/ui/input-prompt-dialog";
import {
  JournalVideoUploadError,
  uploadJournalVideo,
} from "@/lib/journal-video-storage";

interface JournalYoutubeSectionProps {
  canEdit: boolean;
  youtubeUrl: string;
  embedUrl: string | null;
  entryDate: string;
  canUpload: boolean;
  onChange: (url: string) => void;
  onBlur: () => void;
}

function getVideoId(embedUrl: string): string | null {
  const match = embedUrl.match(/embed\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function JournalYoutubeSection({
  canEdit,
  youtubeUrl,
  embedUrl,
  entryDate,
  canUpload,
  onChange,
  onBlur,
}: JournalYoutubeSectionProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset player when video changes
  const videoId = embedUrl ? getVideoId(embedUrl) : null;
  const hasDirectVideo = !videoId && youtubeUrl.trim().length > 0;

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
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full"
            title="Play video"
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
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 transition-colors group-hover:bg-black/80">
                <svg viewBox="0 0 24 24" fill="white" className="h-7 w-7">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )
      ) : hasDirectVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={youtubeUrl}
          controls
        />
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
            className="flex h-7 w-7 items-center justify-center rounded-full border border-muted bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
            title="Set video"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <InputPromptDialog
            open={open}
            onOpenChange={handleOpen}
            title="YouTube URL"
            value={draft}
            onChange={setDraft}
            onConfirm={handleSave}
            confirmLabel="Save"
            placeholder="https://youtu.be/…"
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
