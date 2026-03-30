import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JournalMetaRowProps {
  canEdit: boolean;
  bookmarked: boolean;
  onBookmarkToggle: () => void;
}

export default function JournalMetaRow({
  canEdit,
  bookmarked,
  onBookmarkToggle,
}: JournalMetaRowProps) {
  if (!canEdit) return null;

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBookmarkToggle}
        className={cn(
          bookmarked
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-muted-foreground"
        )}
        title={bookmarked ? "Remove bookmark" : "Bookmark this day"}
      >
        <Heart
          className="h-5 w-5"
          fill={bookmarked ? "currentColor" : "none"}
        />
      </Button>
    </div>
  );
}
