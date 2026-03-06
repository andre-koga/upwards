import { Bookmark, BookmarkCheck } from "lucide-react";

interface JournalMetaRowProps {
  canEdit: boolean;
  emoji: string;
  emojiInput: string;
  showEmojiInput: boolean;
  bookmarked: boolean;
  onEmojiInputChange: (val: string) => void;
  onEmojiCommit: (val: string) => void;
  onShowEmojiInput: (show: boolean) => void;
  onBookmarkToggle: () => void;
}

export default function JournalMetaRow({
  canEdit,
  emoji,
  emojiInput,
  showEmojiInput,
  bookmarked,
  onEmojiInputChange,
  onEmojiCommit,
  onShowEmojiInput,
  onBookmarkToggle,
}: JournalMetaRowProps) {
  if (!canEdit && !emoji) return null;

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
    </div>
  );
}
