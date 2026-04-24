import { useState } from "react";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import {
  Calendar,
  CircleCheckBig,
  FolderKanban,
  Menu,
  Settings,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "@/lib/db/types";
import { formatDateShort, toDateString } from "@/lib/time-utils";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AddTaskModal from "./add-task-modal";
import ActivityGroupsDrawer from "./activity-groups-drawer";

interface FooterActionsBarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
  loadJournalMeta: () => Promise<void>;
  currentActivityId: string | null;
  activities: Activity[];
  calculateActivityTotalTime: (activityId: string) => number;
  onStartActivity: (activityId: string) => void | Promise<void>;
  onStopActivity: () => void | Promise<void>;
  onAddManualActivityPeriod: (payload: {
    activityId: string;
    dateString: string;
    startIso: string;
    endIso: string;
  }) => Promise<void>;
  onAddQuickMemo: (
    title: string,
    options?: { due_date?: string | null; is_pinned?: boolean }
  ) => Promise<boolean>;
}

export default function FooterActionsBar({
  currentDate,
  onDateChange,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
  currentActivityId,
  activities,
  calculateActivityTotalTime,
  onStartActivity,
  onStopActivity,
  onAddManualActivityPeriod,
  onAddQuickMemo,
}: FooterActionsBarProps) {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pathsDrawerOpen, setPathsDrawerOpen] = useState(false);
  const { bottomInset } = useVisualViewportLayout();
  const isSelectedToday =
    toDateString(currentDate) === toDateString(new Date());
  const shortDate = formatDateShort(currentDate);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] transition-all",
          pathsDrawerOpen && "pointer-events-auto bg-black/40 backdrop-blur-sm",
          !pathsDrawerOpen &&
            "pointer-events-none bg-black/0 backdrop-blur-[0px]"
        )}
        onClick={() => setPathsDrawerOpen(false)}
      />

      <div
        className={`fixed inset-x-0 z-[70] transition-transform duration-300 ease-out ${
          pathsDrawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ bottom: bottomInset }}
      >
        <div className="rounded-t-2xl border-t border-border/50 bg-background px-4 pb-8 pt-3 shadow-xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <p className="mb-3 text-center text-sm font-semibold text-muted-foreground">
            More
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start rounded-xl"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/settings");
              }}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start rounded-xl"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/stats");
              }}
            >
              <Sparkles className="h-4 w-4" />
              Stats
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[30] h-12 border-t border-border bg-background"></div>
      <div className="fixed inset-x-2 bottom-4 z-[40] flex items-center gap-2 pb-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full border-border bg-background shadow-lg"
          onClick={() => setPathsDrawerOpen((v) => !v)}
          title="Open more actions"
          aria-label="Open more actions"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="mr-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "w-auto rounded-full border px-4 shadow-lg",
              isSelectedToday && ""
            )}
            onClick={() => setCalendarOpen(true)}
            title="Pick a date"
            aria-label="Pick a date"
          >
            <Calendar className="h-4 w-4" />
            <span className="font-semibold text-foreground">{shortDate}</span>
          </Button>
        </div>
        <ActivityGroupsDrawer
          currentActivityId={currentActivityId}
          activities={activities}
          calculateActivityTime={calculateActivityTotalTime}
          onStartActivity={onStartActivity}
          onStopActivity={onStopActivity}
          initialDate={currentDate}
          onAddManualEntry={onAddManualActivityPeriod}
          floating={false}
          triggerLabel="Projects"
          triggerTitle="Open projects"
          triggerIcon={FolderKanban}
          triggerClassName="z-[60] h-12 shadow-lg rounded-full px-6"
        />

        <AddTaskModal
          onAdd={onAddQuickMemo}
          icon={CircleCheckBig}
          triggerTitle="Add quick memo"
          floating={false}
          triggerClassName="z-[60] h-12 w-12 rounded-full px-0 shadow-lg"
        />
      </div>

      <JournalDateCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        currentDate={currentDate}
        onSelectDate={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        onCalendarOpen={loadJournalMeta}
      />
    </>
  );
}
