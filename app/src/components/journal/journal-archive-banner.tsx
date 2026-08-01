import { cn } from "@/lib/utils";

type BannerVariant = "month" | "holiday";

interface JournalArchiveBannerProps {
  variant: BannerVariant;
  label: string;
  /** 1–12 when variant is month — picks the seasonal banner image. */
  month?: number;
  className?: string;
}

const MONTH_IMAGES: Record<number, string> = {
  1: "/journal-months/month-01.jpg",
  2: "/journal-months/month-02.jpg",
  3: "/journal-months/month-03.jpg",
  4: "/journal-months/month-04.jpg",
  5: "/journal-months/month-05.jpg",
  6: "/journal-months/month-06.jpg",
  7: "/journal-months/month-07.jpg",
  8: "/journal-months/month-08.jpg",
  9: "/journal-months/month-09.jpg",
  10: "/journal-months/month-10.jpg",
  11: "/journal-months/month-11.jpg",
  12: "/journal-months/month-12.jpg",
};

export default function JournalArchiveBanner({
  variant,
  label,
  month,
  className,
}: JournalArchiveBannerProps) {
  const imageSrc =
    variant === "month" && month != null ? MONTH_IMAGES[month] : undefined;

  if (variant === "month" && imageSrc) {
    return (
      <div
        className={cn("relative overflow-hidden rounded-3xl", className)}
        role="separator"
        aria-label={label}
      >
        <img
          src={imageSrc}
          alt=""
          className="aspect-[3.2/1] w-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/15"
          aria-hidden
        />
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center font-crimson text-xl font-semibold tracking-tight text-white drop-shadow-sm">
          {label}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-amber-100 px-4 py-3 text-center text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
        className
      )}
      role="separator"
      aria-label={label}
    >
      <p className="font-crimson text-base font-semibold tracking-tight">
        {label}
      </p>
    </div>
  );
}
