import { Play } from "lucide-react";

/** Returns "#000" or "#fff" — whichever has better WCAG contrast against the given hex color. */
function getContrastColor(hex: string): "#000000" | "#ffffff" {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Linearise sRGB channels
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // WCAG: use black when the bg is light enough
  return L > 0.179 ? "#000000" : "#ffffff";
}

export interface GroupPillProps {
  name: string;
  color: string;
  onClick?: () => void;
  /** When true, renders as a non-interactive div instead of a button */
  readOnly?: boolean;
  className?: string;
}

export default function GroupPill({
  name,
  color,
  onClick,
  readOnly = false,
  className = "",
}: GroupPillProps) {
  const iconColor = getContrastColor(color);
  const inner = (
    <>
      <span className="flex-1 text-left font-medium truncate px-4 text-sm">
        {name || (
          <span className="text-muted-foreground/50 font-normal">
            Group name…
          </span>
        )}
      </span>
      {/* Gradient fade from play button colour to transparent */}
      <div
        className="absolute inset-y-0 right-0.5 w-full my-0.5 pointer-events-none rounded-r-full"
        style={{
          background: `linear-gradient(to left, ${color}, transparent 25%)`,
        }}
      />
      <div
        className="h-9 w-16 rounded-full flex items-center justify-center flex-shrink-0 mr-0.5 relative"
        style={{ backgroundColor: color }}
      >
        <Play
          className="h-3.5 w-3.5 translate-x-px"
          style={{ color: iconColor, fill: iconColor }}
        />
      </div>
    </>
  );

  const base =
    "relative flex items-center border border-border rounded-full overflow-hidden h-11 " +
    className;

  if (readOnly) {
    return <div className={base}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={base + " hover:bg-accent transition-colors w-full"}
    >
      {inner}
    </button>
  );
}
