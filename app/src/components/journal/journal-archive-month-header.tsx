import { useTranslation } from "react-i18next";
import { getActiveLocaleTag } from "@/lib/i18n";

interface JournalArchiveMonthHeaderProps {
  year: number;
  month: number;
}

export default function JournalArchiveMonthHeader({
  year,
  month,
}: JournalArchiveMonthHeaderProps) {
  const { i18n } = useTranslation();
  const label = new Date(year, month - 1, 1).toLocaleDateString(
    getActiveLocaleTag(),
    { month: "long", year: "numeric" }
  );

  return (
    <div
      className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 py-3 backdrop-blur-sm"
      role="separator"
      aria-label={label}
    >
      <p
        className="font-crimson text-lg font-semibold tracking-tight text-foreground"
        lang={i18n.language}
      >
        {label}
      </p>
      <div className="mt-1 h-px w-full bg-border" aria-hidden />
    </div>
  );
}
