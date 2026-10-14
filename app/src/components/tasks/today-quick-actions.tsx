import { useTranslation } from "react-i18next";
import { CircleCheckBig, Folder } from "lucide-react";
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
 * frosted dock above the tab bar (never a second full-width bar), aligned to
 * the page column so it stays with the content on a wide pane.
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-tab-bar-h,0px)+0.75rem)] z-[var(--z-chrome)] md:bottom-4">
      <div className="mx-auto flex w-full justify-end px-4 md:max-w-2xl lg:max-w-3xl">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/85 p-1 shadow-lg backdrop-blur-md">
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
            triggerClassName="h-11 w-11 shadow-none"
          />
          <AddTaskModal
            onAdd={onAddQuickMemo}
            icon={CircleCheckBig}
            triggerTitle={t("addQuickMemo")}
            floating={false}
            triggerSize="iconRoundLg"
            triggerClassName="h-11 w-11 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
