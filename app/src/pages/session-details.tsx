import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { db } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  DailyEntry,
} from "@/lib/db/types";

interface SessionDetails {
  group: ActivityGroup;
  activity: Activity;
  period: ActivityPeriod;
  entry: DailyEntry | undefined;
}

function formatDate(date: string | undefined): string {
  if (!date) return "-";
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, (month || 1) - 1, day || 1);
  return localDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoTime: string | null): string {
  if (!isoTime) return "-";
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SessionDetailsPage() {
  const { groupId, sessionId } = useParams<{
    groupId: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<SessionDetails | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!groupId || !sessionId) {
        navigate("/");
        return;
      }

      const [group, period] = await Promise.all([
        db.activityGroups.get(groupId),
        db.activityPeriods.get(sessionId),
      ]);

      if (!group || group.deleted_at || !period || period.deleted_at) {
        navigate(`/activities/${groupId}`);
        return;
      }

      const activity = await db.activities.get(period.activity_id);
      if (!activity || activity.deleted_at || activity.group_id !== group.id) {
        navigate(`/activities/${groupId}`);
        return;
      }

      const entry = await db.dailyEntries.get(period.daily_entry_id);

      setDetails({
        group,
        activity,
        period,
        entry,
      });
      setLoading(false);
    };

    void load();
  }, [groupId, sessionId, navigate]);

  const backPath = useMemo(() => {
    if (!groupId) return "/";
    return `/activities/${groupId}`;
  }, [groupId]);

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (!details) return null;

  return (
    <div className="px-4 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Session Details</h1>

        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Group</span>
            <span className="text-sm font-medium">{details.group.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Activity</span>
            <span className="text-sm font-medium">{details.activity.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="text-sm font-medium">
              {formatDate(details.entry?.date)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Start Time</span>
            <span className="text-sm font-medium">
              {formatTime(details.period.start_time)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">End Time</span>
            <span className="text-sm font-medium">
              {formatTime(details.period.end_time)}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate(backPath)}
        className="fixed bottom-6 left-6 z-50 h-10 w-10 border border-border flex items-center justify-center rounded-full bg-background shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Back"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
