import { useTranslation } from "react-i18next";
import { Folder, Plus } from "lucide-react";
import type { Activity } from "@/lib/db/types";
import AddTaskModal from "./add-task-modal";
import ActivityGroupsDrawer from "./activity-groups-drawer";

interface TodayQuickActionsProps {
  currentDate: Date;
  currentActivityId: string | null;
  activities: Activity[];
  /** All-time tracked time per activity (Projects drawer). */
  getActivityDrawerElapsedMs: (activityId: string) => number;
  onStartActivity: (activityId: string) => void | Promise<void>;
  onStopActivity: () => void | Promise<void>;
  onAddManualActivityPeriod: (payload: {
    activityId: string;
    dateString: string;
    startIso: string;
    endIso: string;
    note: string | null;
  }) => Promise<void>;
  onAddQuickMemo: (
    title: string,
    options?: {
      due_date?: string | null;
      is_pinned?: boolean;
    }
  ) => Promise<boolean>;
  onTasksDataChanged?: () => void;
}

/**
 * Projects and quick memo, kept at the bottom for thumb reach. One small
 * frosted dock above the tab bar (never a second full-width bar): a quiet
 * projects icon and a labelled "Memo" button, edged with a hairline like the
 * rest of the chrome.
 */
export default function TodayQuickActions({
  currentDate,
  currentActivityId,
  activities,
  getActivityDrawerElapsedMs,
  onStartActivity,
  onStopActivity,
  onAddManualActivityPeriod,
  onAddQuickMemo,
  onTasksDataChanged,
}: TodayQuickActionsProps) {
  const { t } = useTranslation("nav");

  return (
    <div className="lift-above-tabs pointer-events-none fixed inset-x-0 z-[var(--z-floating)]">
      <div className="mx-auto flex w-full justify-end px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-foreground/10 bg-background/80 p-1 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.45)] backdrop-blur-md">
          <ActivityGroupsDrawer
            currentActivityId={currentActivityId}
            activities={activities}
            getActivityDrawerElapsedMs={getActivityDrawerElapsedMs}
            onStartActivity={onStartActivity}
            onStopActivity={onStopActivity}
            initialDate={currentDate}
            onAddManualEntry={onAddManualActivityPeriod}
            onTasksDataChanged={onTasksDataChanged}
            floating={false}
            triggerTitle={t("openProjects")}
            triggerIcon={Folder}
            triggerVariant="ghost"
            triggerSize="iconRoundLg"
            triggerClassName="h-10 w-10 text-muted-foreground shadow-none"
          />
          <AddTaskModal
            onAdd={onAddQuickMemo}
            icon={Plus}
            triggerTitle={t("addQuickMemo")}
            triggerLabel={t("quickMemoShort")}
            floating={false}
            triggerClassName="h-10 gap-0 pl-3 pr-4 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
