import { Heart, PaintRoller, Pencil } from "lucide-react";
import type { UseJournalEntryReturn } from "@/components/journal/hooks/use-journal-entry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Journal = UseJournalEntryReturn;

interface JournalMetaBarProps {
  journal: Journal;
  onEditRequest: () => void;
}

export default function JournalMetaBar({
  journal,
  onEditRequest,
}: JournalMetaBarProps) {
  return (
    <div className="relative flex justify-end gap-2 p-4">
      <Button
        variant="ghost"
        size="smIcon"
        onClick={() => {
          const next = !journal.draftBookmarked;
          journal.setDraftBookmarked(next);
          journal.saveBookmark(next);
        }}
        className="text-muted-foreground"
        title={
          journal.draftBookmarked ? "Remove bookmark" : "Bookmark this day"
        }
      >
        <Heart
          className={cn(
            "transition-colors",
            journal.draftBookmarked && "fill-red-500 text-red-500"
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="smIcon"
        // onClick={onEditRequest}
        // disabled={!journal.canEditJournal}
        className="text-muted-foreground"
        title="Edit journal"
      >
        <PaintRoller />
      </Button>
      <Button
        variant="ghost"
        size="smIcon"
        onClick={onEditRequest}
        disabled={!journal.canEditJournal}
        className="text-muted-foreground"
        title="Edit journal"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
