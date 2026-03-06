import { Bookmark, BookmarkCheck } from "lucide-react";

const QUALITY_OPTIONS = [
  { value: 1, bg: "bg-red-400", label: "Bad" },
  { value: 2, bg: "bg-orange-400", label: "Poor" },
  { value: 3, bg: "bg-yellow-400", label: "Okay" },
  { value: 4, bg: "bg-green-400", label: "Good" },
  { value: 5, bg: "bg-blue-400", label: "Great" },
];

interface JournalMetaRowProps {
  canEdit: boolean;
  emoji: string;
  emojiInput: string;
  showEmojiInput: boolean;
  bookmarked: boolean;
  quality: number | null;
  onEmojiInputChange: (val: string) => void;
  onEmojiCommit: (val: string) => void;
  onShowEmojiInput: (show: boolean) => void;
  onBookmarkToggle: () => void;
  onQualityChange: (val: number | null) => void;
}

export default function JournalMetaRow({
  canEdit,
  emoji,
  emojiInput,
  showEmojiInput,
  bookmarked,
  quality,
  onEmojiInputChange,
  onEmojiCommit,
  onShowEmojiInput,
  onBookmarkToggle,
  onQualityChange,
}: JournalMetaRowProps) {
  if (!canEdit && !emoji && !quality) return null;

  return (
    <div className="flex items-center gap-3">
      {/* Emoji */}
      <div className="relative">
        {canEdit ? (
          showEmojiInput ? (
            <input
              autoFocus
              type="text"
              value={emojiInput}
              onChange={(e) => onEmojiInputChange(e.target.value)}
              onBlur={() => {
                onEmojiCommit(emojiInput.trim().slice(0, 2));
                onShowEmojiInput(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape")
                  e.currentTarget.blur();
              }}
              placeholder="😊"
              className="w-14 text-center text-xl border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary py-1"
            />
          ) : (
            <button
              onClick={() => onShowEmojiInput(true)}
              className="text-2xl w-10 h-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors border border-dashed border-muted-foreground/40"
              title="Set day emoji"
            >
              {emoji || (
                <span className="text-sm text-muted-foreground">+😊</span>
              )}
            </button>
          )
        ) : (
          emoji && <span className="text-2xl">{emoji}</span>
        )}
      </div>

      {/* Bookmark */}
      {canEdit && (
        <button
          onClick={onBookmarkToggle}
          className={`h-9 w-9 flex items-center justify-center rounded-md transition-colors ${
            bookmarked
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          title={bookmarked ? "Remove bookmark" : "Bookmark this day"}
        >
          {bookmarked ? (
            <BookmarkCheck className="h-5 w-5" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
      )}

      {/* Quality dots */}
      <div className="flex items-center gap-1 ml-auto">
        {QUALITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={!canEdit}
            onClick={() =>
              onQualityChange(quality === opt.value ? null : opt.value)
            }
            title={opt.label}
            className={`h-6 w-6 rounded-full transition-all ${opt.bg} ${
              quality === opt.value
                ? "ring-2 ring-offset-2 ring-foreground scale-110"
                : "opacity-40 hover:opacity-100 disabled:hover:opacity-40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
