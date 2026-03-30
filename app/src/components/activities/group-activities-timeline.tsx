import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import ActivityTimelineItem from "@/components/tasks/activity-timeline-item";
import { formatTimerDisplay } from "@/lib/activity";
import { formatWeekdayShortDate, toDateString } from "@/lib/time-utils";
import { Loader2 } from "lucide-react";
import SessionDetailsDialog from "@/components/activities/session-details-dialog";

interface GroupActivitiesTimelineProps {
  groupId: string;
  groupName: string;
  groupColor: string;
}

interface DaySession {
  id: string;
  activityId: string;
  activityName: string;
  groupColor: string;
  intervalMs: number;
  groupId: string;
}

interface DayData {
  date: string;
  dateStr: string;
  sessions: DaySession[];
  totalMs: number;
}

const DAYS_PER_PAGE = 7;
const INITIAL_DAYS = 14;

export default function GroupActivitiesTimeline({
  groupId,
  groupName,
  groupColor,
}: GroupActivitiesTimelineProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [dayDataList, setDayDataList] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [daysLoaded, setDaysLoaded] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadDaysData = useCallback(
    async (startDaysAgo: number, endDaysAgo: number) => {
      const activities = await db.activities
        .filter((a) => a.group_id === groupId && !a.deleted_at)
        .toArray();

      if (activities.length === 0) {
        return [];
      }

      const activityIds = activities.map((a) => a.id);
      const activityMap = new Map(activities.map((a) => [a.id, a]));

      const days: DayData[] = [];

      for (let daysAgo = startDaysAgo; daysAgo < endDaysAgo; daysAgo++) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const dateString = toDateString(date);

        const dailyEntry = await db.dailyEntries
          .filter((e) => e.date === dateString && !e.deleted_at)
          .first();

        if (!dailyEntry) continue;

        const periods = await db.activityPeriods
          .filter(
            (p) =>
              p.daily_entry_id === dailyEntry.id &&
              !p.deleted_at &&
              p.end_time !== null &&
              activityIds.includes(p.activity_id)
          )
          .toArray();

        if (periods.length === 0) continue;

        const sessions: DaySession[] = periods.map((p) => {
          const activity = activityMap.get(p.activity_id);
          const startTime = new Date(p.start_time).getTime();
          const endTime = p.end_time
            ? new Date(p.end_time).getTime()
            : startTime;
          const intervalMs = Math.max(0, endTime - startTime);

          return {
            id: p.id,
            activityId: p.activity_id,
            activityName: activity?.name ?? groupName ?? "Unknown",
            groupColor: groupColor,
            intervalMs,
            groupId,
          };
        });

        sessions.sort((a, b) => {
          const periodA = periods.find((p) => p.id === a.id);
          const periodB = periods.find((p) => p.id === b.id);
          if (!periodA || !periodB) return 0;
          return (
            new Date(periodA.start_time).getTime() -
            new Date(periodB.start_time).getTime()
          );
        });

        const totalMs = sessions.reduce((sum, s) => sum + s.intervalMs, 0);

        days.push({
          date: dateString,
          dateStr: formatWeekdayShortDate(date),
          sessions,
          totalMs,
        });
      }

      return days;
    },
    [groupId, groupName, groupColor]
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const days = await loadDaysData(0, INITIAL_DAYS);
      setDayDataList(days);
      setDaysLoaded(INITIAL_DAYS);
      setHasMore(days.length === INITIAL_DAYS);
    } catch (error) {
      console.error("Error loading timeline data:", error);
    } finally {
      setLoading(false);
    }
  }, [loadDaysData]);

  const loadMoreDays = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const newDays = await loadDaysData(
        daysLoaded,
        daysLoaded + DAYS_PER_PAGE
      );

      if (newDays.length === 0) {
        setHasMore(false);
      } else {
        setDayDataList((prev) => [...prev, ...newDays]);
        setDaysLoaded((prev) => prev + DAYS_PER_PAGE);
      }
    } catch (error) {
      console.error("Error loading more days:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadDaysData, daysLoaded, loadingMore, hasMore]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMoreDays();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMoreDays, loadingMore, hasMore]);

  const handleTimelineClick = useCallback((sessionId: string) => {
    setEditingSessionId(sessionId);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading timeline...</p>
      </div>
    );
  }

  if (dayDataList.length === 0) {
    return (
      <div className="px-4 py-8">
        <p className="text-center text-sm text-muted-foreground">
          No activity history yet for this group.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activity History
            </p>
          </div>

          <div className="space-y-6">
            {dayDataList.map((day) => (
              <div key={day.date} className="space-y-2">
                {/* Date label */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {day.dateStr}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimerDisplay(day.totalMs)}
                  </span>
                </div>

                {/* Sessions for this day, latest first */}
                <div className="space-y-1 pl-3">
                  {day.sessions
                    .sort((a, b) => a.intervalMs - b.intervalMs)
                    .map((session) => (
                      <ActivityTimelineItem
                        key={session.id}
                        activityName={session.activityName}
                        groupColor={session.groupColor}
                        intervalMs={session.intervalMs}
                        activityId={session.activityId}
                        onClick={() => handleTimelineClick(session.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Loading more indicator */}
          {hasMore && (
            <div
              ref={observerTarget}
              className="flex items-center justify-center py-6"
            >
              {loadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && dayDataList.length > 0 && (
            <div className="py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No more activity history
              </p>
            </div>
          )}
        </div>
      </div>

      {editingSessionId && (
        <SessionDetailsDialog
          groupId={groupId}
          sessionId={editingSessionId}
          open={editingSessionId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingSessionId(null);
            }
          }}
          onSessionUpdated={() => {
            void loadInitialData();
          }}
        />
      )}
    </>
  );
}
