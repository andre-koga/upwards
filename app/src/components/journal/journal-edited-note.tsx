import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatEditedDate } from "@/lib/journal/revisions";
import type { RevisionSummary } from "@/lib/journal/revisions";
import { cn } from "@/lib/utils";

interface JournalEditedNoteProps {
  summary: RevisionSummary;
  onOpen: () => void;
  className?: string;
}

/**
 * "Edited 2 Oct 2026" for a day that was changed after the fact, as a quiet
 * line that opens its earlier versions. Shown only when versions exist.
 */
export default function JournalEditedNote({
  summary,
  onOpen,
  className,
}: JournalEditedNoteProps) {
  const { t } = useTranslation("journal");
  const edited = t("oldDay.edited", {
    date: formatEditedDate(summary.editedAt),
  });
  const label = t("versions.open", { count: summary.count });

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onOpen}
      title={label}
      aria-label={`${edited}. ${label}`}
      className={cn(
        "h-auto min-h-11 gap-1.5 px-2 py-1 text-xs font-normal text-muted-foreground md:min-h-8",
        className
      )}
    >
      <History className="h-3 w-3 shrink-0" aria-hidden />
      <span>{edited}</span>
    </Button>
  );
}
