/**
 * SRP: Today page divider bar — detected location display and quick edit action.
 */
import { Heart, Pencil } from "lucide-react";
import type { UseJournalEntryReturn } from "@/components/tasks/hooks/use-journal-entry";

type Journal = UseJournalEntryReturn;

interface TasksJournalMetaBarProps {
  journal: Journal;
  onEditRequest: () => void;
}

export default function TasksJournalMetaBar({
  journal,
  onEditRequest,
}: TasksJournalMetaBarProps) {
  return (
    <div className="relative flex justify-end py-3">
      <button
        type="button"
        onClick={() => {
          const next = !journal.draftBookmarked;
          journal.setDraftBookmarked(next);
          journal.saveBookmark(next);
        }}
        className={`pointer-events-auto flex items-center gap-1.5 text-muted-foreground transition-colors ${
          journal.draftBookmarked ? "" : "hover:text-foreground"
        }`}
        title={
          journal.draftBookmarked ? "Remove bookmark" : "Bookmark this day"
        }
      >
        <Heart
          className={`h-4 w-4 ${journal.draftBookmarked ? "text-red-500" : ""}`}
          fill={journal.draftBookmarked ? "currentColor" : "none"}
        />
      </button>
      <button
        type="button"
        onClick={onEditRequest}
        disabled={!journal.canEditJournal}
        className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-70"
        title="Edit journal"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
