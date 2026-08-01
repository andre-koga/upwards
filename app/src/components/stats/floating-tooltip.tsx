import { cn } from "@/lib/utils";

export function FloatingTooltip({
  tooltip,
  visible,
}: {
  tooltip: { x: number; y: number; text: string };
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 6px))",
      }}
    >
      {tooltip.text}
    </div>
  );
}
