import { useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface JournalYoutubeSectionProps {
  canEdit: boolean;
  youtubeUrl: string;
  embedUrl: string | null;
  onChange: (url: string) => void;
  onBlur: () => void;
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

  const handleOpen = (next: boolean) => {
    if (next) setDraft(youtubeUrl);
    setOpen(next);
  };

  const handleSave = () => {
    onChange(draft);
    onBlur();
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    onBlur();
    setOpen(false);
  };

  return (
    <div
      className="relative w-full bg-muted"
      style={{ paddingBottom: "56.25%" }}
    >
      {embedUrl ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={embedUrl}
          title="Daily vlog"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground/40 text-sm select-none">
            No video
          </span>
        </div>
      )}

      {/* Bottom fade into background */}
      <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />

      {canEdit && (
        <div className="absolute bottom-2 right-2 z-20">
          <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-background transition-colors"
                title="Set video URL"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <p className="text-sm font-medium mb-2">YouTube URL</p>
              <input
                autoFocus
                type="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="https://youtu.be/…"
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2 mt-2 justify-end">
                {youtubeUrl && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
