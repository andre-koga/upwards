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
    <div className="-mr-2 flex shrink-0 items-center gap-0.5">
      {revisions && onOpenVersions ? (
        <JournalEditedNote
          summary={revisions}
          onOpen={onOpenVersions}
          className="mr-1"
        />
      ) : null}
      <Button
        variant="ghost"
        size="iconRoundMd"
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
            "h-4 w-4 transition-colors",
            journal.draftBookmarked && "fill-terracotta text-terracotta"
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="iconRoundMd"
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
