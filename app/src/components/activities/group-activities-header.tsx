import type { ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GroupActivitiesHeaderProps {
  group: ActivityGroup;
  isArchived: boolean | null;
  activityCount: number;
  onEditGroup: () => void;
  onToggleArchiveGroup: () => void;
}

export default function GroupActivitiesHeader({
  group,
  isArchived,
  activityCount,
  onEditGroup,
  onToggleArchiveGroup,
}: GroupActivitiesHeaderProps) {
  return (
    <div className="relative h-40 w-full">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${group.color || DEFAULT_GROUP_COLOR} 0%, transparent 100%)`,
        }}
      />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-b from-transparent to-background" />

      <div className="absolute -bottom-3 left-1/2 w-full -translate-x-1/2 px-4 text-center">
        {isArchived && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Archived
          </p>
        )}
        <h1 className="text-3xl font-bold">{group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activityCount} {activityCount === 1 ? "activity" : "activities"}
        </p>
      </div>

      <div className="absolute -bottom-12 right-3 z-20">
        <Button
          type="button"
          variant="outline"
          size="smIcon"
          onClick={onToggleArchiveGroup}
          className="h-7 w-7 rounded-full border-muted bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
          title={isArchived ? "Unarchive group" : "Archive group"}
        >
          {isArchived ? (
            <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>

      <div className="absolute -bottom-4 right-3 z-20">
        <Button
          type="button"
          variant="outline"
          size="smIcon"
          onClick={onEditGroup}
          className="h-7 w-7 rounded-full border-muted bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
          title="Edit group"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
