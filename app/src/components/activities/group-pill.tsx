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
  nameTitle,
  nameAriaLabel,
  className = "",
}: GroupPillProps) {
  const actionLabel = "Start";
  const resolvedNameTitle = nameTitle ?? "Edit group";
  const resolvedNameAriaLabel = nameAriaLabel ?? "Edit group";

  const base =
    "relative flex items-stretch gap-2 rounded-full overflow-hidden h-10 " +
    className;

  return (
    <div className={base}>
      <div className="flex w-full gap-2">
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-input bg-background">
          <Button
            type="button"
            variant="ghost"
            onClick={onNameClick}
            title={resolvedNameTitle}
            aria-label={resolvedNameAriaLabel}
            className="h-full min-w-0 flex-1 justify-start gap-2.5 truncate rounded-none py-2 pl-4 pr-4 text-left text-sm font-medium shadow-none"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              {name || (
                <span className="font-normal text-muted-foreground">Name…</span>
              )}
            </span>
          </Button>
        </div>
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
