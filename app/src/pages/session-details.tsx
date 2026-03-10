import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useSessionDetails } from "@/hooks/use-session-details";
import {
  formatDate,
  shiftDate,
  shiftTimeByMinutes,
  startOfDay,
  timeToSeconds,
} from "@/lib/date-utils";

export default function SessionDetailsPage() {
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
    <div className="px-4 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Session Details</h1>
          <button
            onClick={handleDelete}
            className="h-8 px-2 gap-1 flex items-center justify-center rounded-full bg-background border hover:bg-destructive/20 border-destructive hover:text-destructive-foreground transition-colors"
            title="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs pt-0.5">Delete</span>
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Group</span>
            <span className="text-sm font-medium">{details.group.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="px-2 py-1 w-36 rounded-md hover:bg-accent transition-colors">
                    {formatDate(selectedDate)}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-2 rounded-2xl overflow-hidden data-[side=bottom]:translate-y-0 data-[side=top]:translate-y-0 data-[side=left]:translate-x-0 data-[side=right]:translate-x-0">
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
                </PopoverContent>
              </Popover>
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
                className="h-9 border-0 shadow-none w-36 bg-transparent mx-0 px-0 focus-visible:ring-0 focus-visible:outline-none"
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
                className="h-9 border-0 mx-0 px-0 w-36 shadow-none bg-transparent focus-visible:ring-0 focus-visible:outline-none"
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
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      </div>

      <FloatingBackButton onClick={() => navigate(backPath)} title="Back" />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
