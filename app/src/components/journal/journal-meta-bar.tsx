import { Heart, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UseJournalEntryReturn } from "@/components/journal/hooks/use-journal-entry";
import JournalEditedNote from "@/components/journal/journal-edited-note";
import { Button } from "@/components/ui/button";
import type { RevisionSummary } from "@/lib/journal/revisions";
import { cn } from "@/lib/utils";

type Journal = UseJournalEntryReturn;

interface JournalMetaBarProps {
  journal: Journal;
  onEditRequest: () => void;
  /** Present when the day was changed after the fact and has earlier versions. */
  revisions?: RevisionSummary;
  onOpenVersions?: () => void;
}

export default function JournalMetaBar({
  journal,
  onEditRequest,
  revisions,
  onOpenVersions,
}: JournalMetaBarProps) {
  const { t } = useTranslation("journal");
  return (
    <div className="relative flex items-center justify-end gap-2 p-4">
      {revisions && onOpenVersions ? (
        <JournalEditedNote
          summary={revisions}
          onOpen={onOpenVersions}
          className="mr-auto"
        />
      ) : null}
      <Button
        variant="ghost"
        size="smIcon"
        onClick={() => {
          const next = !journal.draftBookmarked;
          journal.setDraftBookmarked(next);
          journal.saveBookmark(next);
        }}
        className="text-muted-foreground"
        title={journal.draftBookmarked ? t("removeBookmark") : t("bookmarkDay")}
        aria-label={
          journal.draftBookmarked ? t("removeBookmark") : t("bookmarkDay")
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
        onClick={onEditRequest}
        className="text-muted-foreground"
        title={t("editJournal")}
        aria-label={t("editJournal")}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
