import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useSessionDetails } from "@/components/activities/hooks/use-session-details";
import {
  formatDate,
  shiftDate,
  shiftTimeByMinutes,
  startOfDay,
  timeToSeconds,
} from "@/lib/date-utils";

export default function SessionDetailsContent() {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const {
    NONE_ACTIVITY_VALUE,
    loading,
    saving,
    error,
    details,
    groupActivities,
    selectedActivityId,
    setSelectedActivityId,
    selectedDate,
    setSelectedDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    backPath,
    navigate,
    handleDelete,
    handleSave,
    today,
  } = useSessionDetails();

  const isSelectedDateToday =
    selectedDate && today
      ? startOfDay(selectedDate).getTime() === today.getTime()
      : false;

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
    } else {
      setEndTime(newEndTime);
    }
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
    } else {
      setEndTime(newEndTime);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  if (!details) return null;

  return (
    <div className="px-4 pb-24 pt-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Session Details</h1>
          <button
            onClick={handleDelete}
            className="flex h-8 items-center justify-center gap-1 rounded-full border border-destructive bg-background px-2 transition-colors hover:bg-destructive/20 hover:text-destructive-foreground"
            title="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="pt-0.5 text-xs">Delete</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Group</span>
            <span className="text-sm font-medium">{details.group.name}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Activity</span>
            <Select
              value={selectedActivityId}
              onValueChange={setSelectedActivityId}
            >
              <SelectTrigger className="w-36 border-none text-base">
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_ACTIVITY_VALUE}>None</SelectItem>
                {groupActivities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Date</span>
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
              <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <button
                  className="w-36 rounded-md px-2 py-1 transition-colors hover:bg-accent"
                  onClick={() => setDatePickerOpen(true)}
                >
                  {formatDate(selectedDate)}
                </button>
                <DialogContent
                  size="sm"
                  className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl p-2"
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setSelectedDate(date);
                      setDatePickerOpen(false);
                    }}
                    disabled={{ after: today }}
                    captionLayout="dropdown"
                    fixedWeeks
                    className="w-full [--cell-size:3rem]"
                  />
                </DialogContent>
              </Dialog>
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
          </div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Start Time</span>
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
                onChange={(e) => handleStartTimeChange(e.target.value)}
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
                onChange={(e) => handleEndTimeChange(e.target.value)}
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
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <FloatingBackButton onClick={() => navigate(backPath)} title="Back" />

      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
