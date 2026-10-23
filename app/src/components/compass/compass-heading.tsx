import type { ReactNode } from "react";

/** A mono overline above an editorial block. The contrast is the point. */
export function CompassHeading({
  id,
  title,
  aside,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2
        id={id}
        className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {title}
      </h2>
      {aside}
    </div>
  );
}
