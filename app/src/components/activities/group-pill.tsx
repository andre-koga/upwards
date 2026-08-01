import { ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GroupPillProps {
  name: string;
  color: string;
  onActionClick?: () => void;
  onNameClick?: () => void;
  /** Opens group stats when clicking the pill name area. */
  onStatsClick?: () => void;
  onSettingsClick?: () => void;
  nameTitle?: string;
  nameAriaLabel?: string;
  className?: string;
}

export default function GroupPill({
  name,
  color,
  onActionClick,
  onNameClick,
  onStatsClick,
  onSettingsClick,
  nameTitle,
  nameAriaLabel,
  className = "",
}: GroupPillProps) {
  const actionLabel = "Start";
  const handleNameClick = onStatsClick ?? onNameClick;
  const resolvedNameTitle =
    nameTitle ?? (onStatsClick ? "View group stats" : "Edit group");
  const resolvedNameAriaLabel =
    nameAriaLabel ?? (onStatsClick ? "View group stats" : "Edit group");

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
            onClick={handleNameClick}
            title={resolvedNameTitle}
            aria-label={resolvedNameAriaLabel}
            className={`h-full min-w-0 flex-1 justify-start gap-2.5 truncate rounded-none py-2 pl-4 text-left text-sm font-medium shadow-none ${
              onSettingsClick ? "pr-0" : "pr-4"
            }`}
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
          {onSettingsClick && (
            <Button
              type="button"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onSettingsClick();
              }}
              title="Group settings"
              aria-label="Group settings"
              className="h-full w-10 shrink-0 justify-start rounded-none px-0 pl-2.5 pr-3.5 text-muted-foreground shadow-none hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
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
