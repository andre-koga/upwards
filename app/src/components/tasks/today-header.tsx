import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Folder,
  History,
  Menu,
  MessageSquare,
  Settings,
} from "lucide-react";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { getActiveLocaleTag } from "@/lib/i18n";
import type { Activity } from "@/lib/db/types";
import { toDateString, todayDateString } from "@/lib/time-utils";
import {
  hasUnreadWhatsNewRelease,
  markWhatsNewSeen,
} from "@/lib/whats-new-read";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AddTaskModal from "./add-task-modal";
import ActivityGroupsDrawer from "./activity-groups-drawer";
import FeedbackDialog from "./feedback-dialog";

interface TodayHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
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
 * Today's one piece of chrome. Day navigation and the page's actions live in a
 * sticky frosted bar at the top, so the bottom of the screen belongs to the
 * tab bar alone. Previous/next are the button equivalent of the swipe.
 */
export default function TodayHeader({
  currentDate,
  onDateChange,
  onPreviousDay,
  onNextDay,
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
}: TodayHeaderProps) {
  const { t } = useTranslation("nav");
  const { t: tToday } = useTranslation("today");
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [hasUnreadWhatsNew, setHasUnreadWhatsNew] = useState(
    hasUnreadWhatsNewRelease
  );
  const { bottomInset } = useVisualViewportLayout();

  const isSelectedToday = toDateString(currentDate) === todayDateString();
  const shortDate = currentDate.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const eyebrow = isSelectedToday
    ? t("tabs.today")
    : String(currentDate.getFullYear());

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl border-t border-border px-4 pb-8 pt-3 shadow-xl"
          style={{ bottom: bottomInset }}
        >
          <SheetTitle className="sr-only">{t("openMoreActions")}</SheetTitle>
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="relative h-11 w-full justify-start rounded-xl"
              onClick={() => {
                markWhatsNewSeen();
                setHasUnreadWhatsNew(false);
                setMenuOpen(false);
                navigate("/whats-new");
              }}
              title={hasUnreadWhatsNew ? t("whatsNewUnread") : t("whatsNew")}
              aria-label={
                hasUnreadWhatsNew ? t("whatsNewUnread") : t("whatsNew")
              }
            >
              <History className="h-4 w-4" />
              {t("whatsNew")}
              {hasUnreadWhatsNew ? (
                <span
                  className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-terracotta ring-2 ring-background"
                  aria-hidden
                />
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start rounded-xl"
              onClick={() => {
                setMenuOpen(false);
                setFeedbackOpen(true);
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
                setMenuOpen(false);
                navigate("/settings");
              }}
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Button>
          </div>
        </SheetContent>

        <header className="sticky top-0 z-[var(--z-chrome)] border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 items-center gap-1 px-3 md:px-4">
            <Button
              type="button"
              variant="ghost"
              size="iconRoundLg"
              onClick={onPreviousDay}
              title={tToday("swipe.previousDay")}
              aria-label={tToday("swipe.previousDay")}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Button>

            <h1 className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCalendarOpen(true)}
                className="h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl px-2.5"
              >
                <span className="font-mono text-[0.64rem] uppercase leading-none tracking-[0.14em] text-ink-faint">
                  {eyebrow}
                </span>
                <span className="flex items-center gap-1.5 font-display text-xl font-semibold leading-none tracking-[-0.02em]">
                  <CalendarDays
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{shortDate}</span>
                </span>
                <span className="sr-only">. {t("pickDate")}</span>
              </Button>
            </h1>

            <Button
              type="button"
              variant="ghost"
              size="iconRoundLg"
              onClick={onNextDay}
              disabled={isSelectedToday}
              title={
                isSelectedToday
                  ? tToday("swipe.alreadyToday")
                  : tToday("swipe.nextDay")
              }
              aria-label={tToday("swipe.nextDay")}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
                triggerVariant="outline"
                triggerSize="iconRoundLg"
                triggerClassName="shadow-none"
              />
              <AddTaskModal
                onAdd={onAddQuickMemo}
                icon={CircleCheckBig}
                triggerTitle={t("addQuickMemo")}
                floating={false}
                triggerSize="iconRoundLg"
                triggerClassName="shadow-none"
              />
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconRoundLg"
                  className="md:hidden"
                  onClick={() => {
                    if (!menuOpen) {
                      setHasUnreadWhatsNew(hasUnreadWhatsNewRelease());
                    }
                  }}
                  title={t("openMoreActions")}
                  aria-label={t("openMoreActions")}
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
            </div>
          </div>
        </header>
      </Sheet>

      <JournalDateCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        currentDate={currentDate}
        onSelectDate={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        onCalendarOpen={loadJournalMeta}
      />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
