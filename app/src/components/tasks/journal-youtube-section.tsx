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
  return (
    <div className="space-y-2">
      {canEdit ? (
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Paste today's YouTube vlog link…"
          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        youtubeUrl && (
          <p className="text-xs text-muted-foreground truncate">{youtubeUrl}</p>
        )
      )}
      {embedUrl && (
        <div
          className="relative w-full rounded-xl overflow-hidden"
          style={{ paddingBottom: "56.25%" }}
        >
          <iframe
            className="absolute inset-0 w-full h-full"
            src={embedUrl}
            title="Daily vlog"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
