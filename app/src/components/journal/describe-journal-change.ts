import type { TFunction } from "i18next";
import type { JournalChangeSummary } from "@/lib/journal/old-day-edit";

/** "Title changed, text removed and 2 photos added" in the active language. */
export function describeJournalChange(
  summary: JournalChangeSummary,
  t: TFunction
): string {
  const parts: string[] = [];
  const field = (
    key: "title" | "emoji" | "text" | "video",
    change: JournalChangeSummary["title"]
  ) => {
    if (change) parts.push(t(`oldDay.change.${key}.${change}`));
  };
  field("title", summary.title);
  field("emoji", summary.emoji);
  field("text", summary.text);
  field("video", summary.video);
  if (summary.photosAdded > 0) {
    parts.push(t("oldDay.change.photosAdded", { count: summary.photosAdded }));
  }
  if (summary.photosRemoved > 0) {
    parts.push(
      t("oldDay.change.photosRemoved", { count: summary.photosRemoved })
    );
  }
  return new Intl.ListFormat(t("oldDay.listLocale"), {
    style: "long",
    type: "conjunction",
  }).format(parts);
}
