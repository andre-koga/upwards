import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import JournalForm from "@/components/journal/journal-form";

export default function JournalEntryPage() {
  const { date } = useParams<{ date: string }>();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  const [entry, setEntry] = useState<JournalEntry | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!date) return;
    db.journalEntries
      .where("entry_date")
      .equals(date)
      .filter((e) => !e.deleted_at)
      .first()
      .then((e) => setEntry(e ?? null));
  }, [date]);

  if (!date)
    return <div className="p-4 text-muted-foreground">Invalid date.</div>;
  if (entry === undefined)
    return <div className="p-4 text-muted-foreground">Loading...</div>;

  const canEdit = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(date + "T00:00:00");
    const diffDays = Math.floor(
      (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays <= 7;
  })();

  return (
    <div className="p-4 pb-24">
      <JournalForm
        date={date}
        existingEntry={entry}
        canEdit={canEdit}
        initialMode={editMode ? "edit" : entry ? "view" : "edit"}
      />
    </div>
  );
}
