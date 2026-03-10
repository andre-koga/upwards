import { useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JournalYoutubeSectionProps {
  canEdit: boolean;
  youtubeUrl: string;
  embedUrl: string | null;
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
  onChange,
  onBlur,
}: JournalYoutubeSectionProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Reset player when video changes
  const videoId = embedUrl ? getVideoId(embedUrl) : null;

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
        <div className="absolute -bottom-4 right-3 z-20">
          <Dialog open={open} onOpenChange={handleOpen}>
            <button
              onClick={() => handleOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-muted bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
              title="Set video URL"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <DialogContent size="sm" className="w-80 p-4">
              <DialogHeader>
                <DialogTitle>YouTube URL</DialogTitle>
              </DialogHeader>
              <input
                autoFocus
                type="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleOpen(false);
                }}
                placeholder="https://youtu.be/…"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                {youtubeUrl && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
