import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GroupPillProps {
  name: string;
  color: string;
  onActionClick?: () => void;
  onNameClick?: () => void;
  nameTitle?: string;
  nameAriaLabel?: string;
  className?: string;
}

export default function GroupPill({
  name,
  color,
  onActionClick,
  onNameClick,
  nameTitle = "Edit group",
  nameAriaLabel = "Edit group",
  className = "",
}: GroupPillProps) {
  const actionLabel = "Start";

  const base =
    "relative flex items-stretch gap-2 rounded-full overflow-hidden h-10 " +
    className;

  return (
    <div className={base}>
      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onNameClick}
          title={nameTitle}
          aria-label={nameAriaLabel}
          className="h-full flex-1 justify-start gap-2.5 truncate rounded-full px-4 text-left text-sm font-medium shadow-none"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {name || (
            <span className="font-normal text-muted-foreground">Name…</span>
          )}
        </Button>
        {onActionClick ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onActionClick}
            className="relative h-full shrink-0 gap-1.5 rounded-full px-4 font-semibold shadow-none"
          >
            <span>{actionLabel}</span>
            <ChevronRight className="h-4 w-4 flex-shrink-0 translate-x-px" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
