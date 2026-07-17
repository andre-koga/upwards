import { cn } from "@/lib/utils";

type BannerVariant = "year" | "month" | "holiday";

interface JournalArchiveBannerProps {
  variant: BannerVariant;
  label: string;
  className?: string;
}

const VARIANT_STYLES: Record<BannerVariant, string> = {
  year: "bg-foreground text-background",
  month: "bg-muted text-foreground",
  holiday:
    "bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
};

const VARIANT_TEXT: Record<BannerVariant, string> = {
  year: "font-crimson text-2xl font-bold tracking-tight",
  month: "font-crimson text-xl font-semibold tracking-tight",
  holiday: "font-crimson text-base font-semibold tracking-tight",
};

export default function JournalArchiveBanner({
  variant,
  label,
  className,
}: JournalArchiveBannerProps) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-center",
        VARIANT_STYLES[variant],
        className
      )}
      role="separator"
      aria-label={label}
    >
      <p className={VARIANT_TEXT[variant]}>{label}</p>
    </div>
  );
}
