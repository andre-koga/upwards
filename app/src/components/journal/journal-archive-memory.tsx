import { History, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Memory } from "@/lib/db/types";
import JournalArchivePhotoGrid from "@/components/journal/journal-archive-photos";
import { Button } from "@/components/ui/button";

interface JournalArchiveMemoryProps {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onTrash: (memory: Memory) => void;
}

/**
 * A memory in the record: an entry whose date is approximate. It is the same
 * editorial card as a day, but the left rail shows a mark instead of a day
 * number and the border is dashed, because the "when" is the person's own words
 * ("when I was six"), not a date.
 */
export default function JournalArchiveMemory({
  memory,
  onEdit,
  onTrash,
}: JournalArchiveMemoryProps) {
  const { t } = useTranslation("journal", { keyPrefix: "archive.memory" });
  const label = memory.time_label?.trim();
  const text = memory.text_content?.trim();
  const photoPaths = memory.photo_paths ?? [];

  return (
    <article
      data-journal-memory-id={memory.id}
      className="py-1 duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 pt-2">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <History className="size-4" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("kicker")}
          </span>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-dashed border-border">
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => onEdit(memory)}
              className="min-w-0 flex-1 space-y-1 px-3 py-2.5 text-left"
              aria-label={t("editNamed", { label: label || t("untitled") })}
            >
              <h2 className="font-crimson text-2xl font-bold leading-snug tracking-tight">
                {label || t("untitled")}
              </h2>
              {text ? (
                <p className="whitespace-pre-wrap font-crimson text-base leading-relaxed text-muted-foreground">
                  {text}
                </p>
              ) : null}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="smIcon"
              onClick={() => onTrash(memory)}
              className="mr-1 mt-1.5 shrink-0 text-muted-foreground"
              title={t("trash")}
              aria-label={t("trash")}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>

          {photoPaths.length > 0 ? (
            <div className="px-3 pb-2.5">
              <JournalArchivePhotoGrid photoPaths={photoPaths} />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
