/**
 * SRP: Renders the edit-session form inside a reusable dialog.
 */
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getActivityDisplayName } from "@/lib/activity-utils";
import {
  fromDateString,
  shiftDate,
  shiftTimeByMinutes,
  startOfDay,
  timeToSeconds,
  toDateString,
} from "@/lib/date-utils";
import { useSessionDetails } from "@/components/activities/hooks/use-session-details";
import { useCallback } from "react";

interface SessionDetailsDialogProps {
  groupId: string;
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionUpdated?: () => void;
}

export default function SessionDetailsDialog({
  groupId,
  sessionId,
  open,
  onOpenChange,
  onSessionUpdated,
}: SessionDetailsDialogProps) {
  const handleDone = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    isRunningSession,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    handleDelete,
    handleSave,
    today,
  } = useSessionDetails({
    groupId,
    sessionId: sessionId ?? undefined,
    onDone: handleDone,
    onUpdated: onSessionUpdated,
  });

  const isSelectedDateToday =
    selectedDate && today
      ? startOfDay(selectedDate).getTime() === today.getTime()
      : false;

  if (!sessionId) return null;

  const adjustStartTime = (delta: number) => {
    const newStartTime = shiftTimeByMinutes(startTime, delta);
    setStartTime(newStartTime);
    if (endTime && timeToSeconds(endTime) < timeToSeconds(newStartTime)) {
      setEndTime(newStartTime);
    }
  };

  const adjustEndTime = (delta: number) => {
    const newEndTime = shiftTimeByMinutes(endTime, delta);
    if (startTime && timeToSeconds(newEndTime) < timeToSeconds(startTime)) {
      setEndTime(startTime);
      return;
    }
    setEndTime(newEndTime);
  };

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (endTime && timeToSeconds(endTime) < timeToSeconds(newStartTime)) {
      setEndTime(newStartTime);
    }
  };

  const handleEndTimeChange = (newEndTime: string) => {
    if (startTime && timeToSeconds(newEndTime) < timeToSeconds(startTime)) {
      setEndTime(startTime);
      return;
    }
    setEndTime(newEndTime);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Session not found.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Group</span>
                <span className="text-sm font-medium">
                  {details.group.name}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Activity</span>
                <Select
                  value={selectedActivityId}
                  onValueChange={setSelectedActivityId}
                >
                  <SelectTrigger className="w-40 border-none text-base">
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_ACTIVITY_VALUE}>None</SelectItem>
                    {groupActivities.map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {getActivityDisplayName(activity, details.group)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">Date</span>
                {isRunningSession ? (
                  <span className="text-sm font-medium">
                    {toDateString(selectedDate)}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setSelectedDate((current) => shiftDate(current, -1))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="date"
                      value={toDateString(selectedDate)}
                      max={toDateString(today)}
                      onChange={(event) => {
                        if (!event.target.value) return;
                        setSelectedDate(fromDateString(event.target.value));
                      }}
                      className="h-9 w-40 border-0 bg-transparent px-0 shadow-none focus-visible:outline-none focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isSelectedDateToday}
                      onClick={() =>
                        setSelectedDate((current) => shiftDate(current, 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Start Time
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustStartTime(-5)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input
                    type="time"
                    step={1}
                    value={startTime}
                    onChange={(event) =>
                      handleStartTimeChange(event.target.value)
                    }
                    className="mx-0 h-9 w-36 border-0 bg-transparent px-0 shadow-none focus-visible:outline-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustStartTime(5)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">End Time</span>
                {isRunningSession ? (
                  <span className="text-sm italic text-muted-foreground">
                    Still running
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustEndTime(-5)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="time"
                      step={1}
                      value={endTime}
                      onChange={(event) =>
                        handleEndTimeChange(event.target.value)
                      }
                      className="mx-0 h-9 w-36 border-0 bg-transparent px-0 shadow-none focus-visible:outline-none focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustEndTime(5)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow-md transition-colors hover:bg-secondary/90 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full max-w-[12rem] rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
