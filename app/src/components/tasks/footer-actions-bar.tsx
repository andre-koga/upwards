import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  CircleCheckBig,
  ExternalLink,
  FileText,
  Folder,
  Github,
  History,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "@/lib/db/types";
import { formatDateShort, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AddTaskModal from "./add-task-modal";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import FeedbackDialog from "./feedback-dialog";
import {
  hasUnreadWhatsNewRelease,
  markWhatsNewSeen,
} from "@/lib/whats-new-read";

interface FooterActionsBarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
  loadJournalMeta: () => Promise<void>;
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

export default function FooterActionsBar({
  currentDate,
  onDateChange,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
  currentActivityId,
  activities,
  getActivityDrawerElapsedMs,
  onStartActivity,
  onStopActivity,
  onAddManualActivityPeriod,
  onAddQuickMemo,
  onTasksDataChanged,
}: FooterActionsBarProps) {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pathsDrawerOpen, setPathsDrawerOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [hasUnreadWhatsNew, setHasUnreadWhatsNew] = useState(
    hasUnreadWhatsNewRelease
  );
  const { bottomInset } = useVisualViewportLayout();
  const isSelectedToday =
    toDateString(currentDate) === getEffectiveToday();
  const shortDate = currentDate.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  useEffect(() => {
    if (pathsDrawerOpen) {
      setHasUnreadWhatsNew(hasUnreadWhatsNewRelease());
    }
  }, [pathsDrawerOpen]);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] transition-all",
          pathsDrawerOpen && "pointer-events-auto bg-black/50 backdrop-blur-sm",
          !pathsDrawerOpen && "pointer-events-none bg-transparent backdrop-blur-0"
        )}
        onClick={() => setPathsDrawerOpen(false)}
      />

      <div
        className={`fixed inset-x-0 z-[70] transition-transform duration-300 ease-out ${
          pathsDrawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ bottom: bottomInset }}
      >
        <div className="rounded-t-2xl border-t border-border bg-background px-4 pb-8 pt-3 shadow-xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="relative h-11 w-full justify-start rounded-xl"
              onClick={() => {
                markWhatsNewSeen();
                setHasUnreadWhatsNew(false);
                setPathsDrawerOpen(false);
                navigate("/whats-new");
              }}
              title={
                hasUnreadWhatsNew ? t("whatsNewUnread") : t("whatsNew")
              }
              aria-label={
                hasUnreadWhatsNew ? t("whatsNewUnread") : t("whatsNew")
              }
            >
              <History className="h-4 w-4" />
              {t("whatsNew")}
              {hasUnreadWhatsNew ? (
                <span
                  className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500 ring-2 ring-background"
                  aria-hidden
                />
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start rounded-xl"
              onClick={() => {
                setPathsDrawerOpen(false);
                setFeedbackDialogOpen(true);
              }}
            >
              <MessageSquare className="h-4 w-4" />
              {t("feedback")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start rounded-xl"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/logs");
              }}
              title={t("viewErrorLogs")}
              aria-label={t("viewErrorLogs")}
            >
              <FileText className="h-4 w-4" />
              {t("errorLogs")}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl p-0"
              asChild
            >
              <a
                href="https://github.com/andre-koga/upwards"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPathsDrawerOpen(false)}
                title={t("githubSource")}
                aria-label={t("githubSource")}
                className="flex h-11 w-full items-center justify-between gap-2 px-4"
              >
                <span className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  {t("github")}
                </span>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </a>
            </Button>
          </div>

          <div className="my-2" role="separator" aria-hidden />

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[4.5rem] flex-1 flex-col gap-1.5 rounded-xl py-6 text-sm font-semibold"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/stats");
              }}
            >
              <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
              {t("stats")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[4.5rem] flex-1 flex-col gap-1.5 rounded-xl py-6 text-sm font-semibold"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/friends");
              }}
            >
              <Users className="h-5 w-5 shrink-0 text-blue-500" />
              {t("friends")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[4.5rem] flex-1 flex-col gap-1.5 rounded-xl py-6 text-sm font-semibold"
              onClick={() => {
                setPathsDrawerOpen(false);
                navigate("/settings");
              }}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {t("settings")}
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
          className="h-10 w-10 rounded-full border-border bg-background shadow-lg"
          onClick={() => setPathsDrawerOpen((v) => !v)}
          title={t("openMoreActions")}
          aria-label={t("openMoreActions")}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="mr-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 rounded-full border px-3 shadow-lg",
              isSelectedToday && ""
            )}
            onClick={() => setCalendarOpen(true)}
            title={t("pickDate")}
            aria-label={t("pickDate")}
          >
            <span className="font-semibold text-foreground">{shortDate}</span>
          </Button>
        </div>
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
          triggerClassName="z-[60] h-12 w-12 shadow-lg rounded-full px-0"
        />

        <AddTaskModal
          onAdd={onAddQuickMemo}
          icon={CircleCheckBig}
          triggerTitle={t("addQuickMemo")}
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
      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />
    </>
  );
}
