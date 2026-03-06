import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, now, newId, toDateStr } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  DailyEntry,
  ActivityPeriod,
  OneTimeTask,
  JournalEntry,
} from "@/lib/db/types";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";

import type { JournalFields } from "./tasks-page-content";

interface DailyTasksListProps {
  activities: Activity[];
  groups: ActivityGroup[];
  onRefresh: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  journalEntry: JournalEntry | null;
  journalLoading: boolean;
  canEditJournal: boolean;
  onJournalSave: (fields: JournalFields) => Promise<void>;
}

export default function DailyTasksList({
  activities,
  groups,
  currentDate,
  onDateChange,
}: DailyTasksListProps) {
  const [, setDailyEntry] = useState<DailyEntry | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [activityPeriods, setActivityPeriods] = useState<ActivityPeriod[]>([]);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(
    null,
  );
  const [, setTick] = useState(0);
  const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTask[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [popMonth, setPopMonth] = useState(currentDate.getMonth());
  const [popDay, setPopDay] = useState(currentDate.getDate());
  const [popYear, setPopYear] = useState(currentDate.getFullYear());

  const today = new Date();
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const YEARS = Array.from(
    { length: today.getFullYear() - 2020 + 1 },
    (_, i) => 2020 + i,
  );
  const daysInPopMonth = (() => {
    const maxDay = new Date(popYear, popMonth + 1, 0).getDate();
    const isCurrentMonthYear =
      popYear === today.getFullYear() && popMonth === today.getMonth();
    return isCurrentMonthYear ? Math.min(maxDay, today.getDate()) : maxDay;
  })();

  const handleDatePopoverOpen = (open: boolean) => {
    if (open) {
      setPopMonth(currentDate.getMonth());
      setPopDay(currentDate.getDate());
      setPopYear(currentDate.getFullYear());
    }
    setDatePopoverOpen(open);
  };

  const applyDateSelection = () => {
    const clampedDay = Math.min(popDay, daysInPopMonth);
    onDateChange(new Date(popYear, popMonth, clampedDay));
    setDatePopoverOpen(false);
  };

  const dateString = toDateStr(currentDate);

  useEffect(() => {
    loadDailyEntry();
    loadActivityPeriods();
    loadOneTimeTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  useEffect(() => {
    if (!currentActivityId) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentActivityId]);

  const loadDailyEntry = async () => {
    try {
      setLoading(true);
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();

      setDailyEntry(entry || null);
      setTaskCounts((entry?.task_counts as Record<string, number>) || {});
      setCurrentActivityId(entry?.current_activity_id || null);
    } catch (error) {
      console.error("Error loading daily entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityPeriods = async () => {
    try {
      const entry = await db.dailyEntries
        .where("date")
        .equals(dateString)
        .filter((e) => !e.deleted_at)
        .first();

      if (!entry) {
        setActivityPeriods([]);
        return;
      }

      const periods = await db.activityPeriods
        .where("daily_entry_id")
        .equals(entry.id)
        .filter((p) => !p.deleted_at)
        .sortBy("start_time");

      setActivityPeriods(periods);
    } catch (error) {
      console.error("Error loading activity periods:", error);
    }
  };

  const loadOneTimeTasks = async () => {
    try {
      const tasks = await db.oneTimeTasks
        .where("date")
        .equals(dateString)
        .filter((t) => !t.deleted_at)
        .sortBy("created_at");
      setOneTimeTasks(tasks);
    } catch (error) {
      console.error("Error loading one-time tasks:", error);
    }
  };

  const getOrCreateDailyEntry = useCallback(async (): Promise<DailyEntry> => {
    const existing = await db.dailyEntries
      .where("date")
      .equals(dateString)
      .filter((e) => !e.deleted_at)
      .first();
    if (existing) return existing;

    const n = now();
    const newEntry: DailyEntry = {
      id: newId(),
      date: dateString,
      task_counts: {},
      current_activity_id: null,
      created_at: n,
      updated_at: n,
      synced_at: null,
      deleted_at: null,
    };
    await db.dailyEntries.add(newEntry);
    setDailyEntry(newEntry);
    return newEntry;
  }, [dateString]);

  const createOneTimeTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      setAddingTask(true);
      const n = now();
      const task: OneTimeTask = {
        id: newId(),
        date: dateString,
        title: newTaskTitle.trim(),
        is_completed: false,
        order_index: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      };
      await db.oneTimeTasks.add(task);
      setOneTimeTasks((prev) => [...prev, task]);
      setNewTaskTitle("");
      setShowAddTask(false);
    } catch (error) {
      console.error("Error creating one-time task:", error);
    } finally {
      setAddingTask(false);
    }
  };

  const toggleOneTimeTask = async (task: OneTimeTask) => {
    const newVal = !task.is_completed;
    setOneTimeTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: newVal } : t)),
    );
    await db.oneTimeTasks.update(task.id, {
      is_completed: newVal,
      updated_at: now(),
    });
  };

  const deleteOneTimeTask = async (taskId: string) => {
    setOneTimeTasks((prev) => prev.filter((t) => t.id !== taskId));
    await db.oneTimeTasks.delete(taskId);
  };

  const calculateActivityTime = (activityId: string): number => {
    const periods = activityPeriods.filter((p) => p.activity_id === activityId);
    return periods.reduce((total, period) => {
      const start = new Date(period.start_time).getTime();
      const end = period.end_time
        ? new Date(period.end_time).getTime()
        : Date.now();
      return total + (end - start);
    }, 0);
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const handleStartActivity = async (activityId: string) => {
    if (currentActivityId === activityId) return;

    try {
      const n = now();
      const entry = await getOrCreateDailyEntry();

      if (currentActivityId) {
        const currentPeriod = await db.activityPeriods
          .where("daily_entry_id")
          .equals(entry.id)
          .filter((p) => !p.end_time && !p.deleted_at)
          .first();
        if (currentPeriod) {
          await db.activityPeriods.update(currentPeriod.id, {
            end_time: n,
            updated_at: n,
          });
        }
      }

      const newPeriod: ActivityPeriod = {
        id: newId(),
        daily_entry_id: entry.id,
        activity_id: activityId,
        start_time: n,
        end_time: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      };
      await db.activityPeriods.add(newPeriod);
      await db.dailyEntries.update(entry.id, {
        current_activity_id: activityId,
        updated_at: n,
      });

      setCurrentActivityId(activityId);
      await loadActivityPeriods();
    } catch (error) {
      console.error("Error switching activity:", error);
    }
  };

  const incrementTask = async (activityId: string, target: number) => {
    try {
      const current = taskCounts[activityId] || 0;
      const next = current >= target ? 0 : current + 1;
      const newCounts = { ...taskCounts };
      if (next === 0) {
        delete newCounts[activityId];
      } else {
        newCounts[activityId] = next;
      }
      setTaskCounts(newCounts);

      const entry = await getOrCreateDailyEntry();
      await db.dailyEntries.update(entry.id, {
        task_counts: newCounts,
        updated_at: now(),
      });
    } catch (error) {
      console.error("Error updating task count:", error);
      loadDailyEntry();
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  const isToday = dateString === toDateStr(new Date());

  const shouldShowActivity = (activity: Activity) => {
    if (activity.created_at) {
      const creationDay = new Date(activity.created_at);
      creationDay.setHours(0, 0, 0, 0);
      const viewDay = new Date(currentDate);
      viewDay.setHours(0, 0, 0, 0);
      if (viewDay < creationDay) return false;
    }

    const routine = activity.routine || "daily";
    if (routine === "anytime") return true;
    if (routine === "never") return true;
    if (routine === "daily") return true;

    if (routine.startsWith("weekly:")) {
      const days = routine.split(":")[1].split(",").map(Number);
      return days.includes(currentDate.getDay());
    }

    if (routine.startsWith("monthly:")) {
      return currentDate.getDate() === parseInt(routine.split(":")[1]);
    }

    if (routine.startsWith("custom:")) {
      const parts = routine.split(":");
      const interval = parseInt(parts[1]);
      const unit = parts[2];
      if (!activity.created_at) return false;

      const creationDate = new Date(activity.created_at);
      creationDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(currentDate);
      checkDate.setHours(0, 0, 0, 0);

      if (unit === "days") {
        const daysDiff = Math.floor(
          (checkDate.getTime() - creationDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return daysDiff >= 0 && daysDiff % interval === 0;
      } else if (unit === "weeks") {
        const daysDiff = Math.floor(
          (checkDate.getTime() - creationDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const weeksDiff = Math.floor(daysDiff / 7);
        return (
          daysDiff >= 0 && weeksDiff % interval === 0 && daysDiff % 7 === 0
        );
      } else if (unit === "months") {
        const monthsDiff =
          (checkDate.getFullYear() - creationDate.getFullYear()) * 12 +
          (checkDate.getMonth() - creationDate.getMonth());
        return (
          monthsDiff >= 0 &&
          monthsDiff % interval === 0 &&
          checkDate.getDate() === creationDate.getDate()
        );
      }
      return false;
    }

    return true;
  };

  const dailyActivities = activities.filter(shouldShowActivity);

  const getGroupColor = (activity: Activity): string => {
    const group = groups.find((g) => g.id === activity.group_id);
    return group?.color || "#cccccc";
  };

  const isTaskComplete = (activity: Activity) =>
    (taskCounts[activity.id] || 0) >= (activity.completion_target ?? 1);

  const nonNeverTasksCount = dailyActivities.filter(
    (a) => a.routine !== "never",
  ).length;
  const completedNonNeverTasksCount = dailyActivities.filter(
    (a) => a.routine !== "never" && isTaskComplete(a),
  ).length;
  const completionRate =
    nonNeverTasksCount === 0
      ? 0
      : Math.round((completedNonNeverTasksCount / nonNeverTasksCount) * 100);

  return (
    <div className="flex flex-col">
      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeDate(-1)}
          className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1">
          <Popover open={datePopoverOpen} onOpenChange={handleDatePopoverOpen}>
            <PopoverTrigger asChild>
              <button className="font-semibold text-sm hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent">
                {currentDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-3" align="center">
              <Select
                value={String(popMonth)}
                onValueChange={(v) => {
                  const m = Number(v);
                  setPopMonth(m);
                  setPopDay((d) =>
                    Math.min(d, new Date(popYear, m + 1, 0).getDate()),
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => {
                    const disabled =
                      popYear === today.getFullYear() && i > today.getMonth();
                    return (
                      <SelectItem key={i} value={String(i)} disabled={disabled}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select
                value={String(popDay)}
                onValueChange={(v) => setPopDay(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInPopMonth }, (_, i) => i + 1).map(
                    (d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Select
                value={String(popYear)}
                onValueChange={(v) => {
                  const y = Number(v);
                  setPopYear(y);
                  setPopDay((d) =>
                    Math.min(d, new Date(y, popMonth + 1, 0).getDate()),
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={applyDateSelection}>
                Go
              </Button>
            </PopoverContent>
          </Popover>

          {!isToday && (
            <button
              onClick={() => onDateChange(new Date())}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Go to today"
              title="Go to today"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-30"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {dailyActivities.length > 0 && (
        <p className="text-xs text-muted-foreground text-right mb-2">
          {completedNonNeverTasksCount} / {nonNeverTasksCount} ({completionRate}
          %)
        </p>
      )}

      <div className="space-y-2 mt-4 flex-1">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </p>
        )}
        {!loading && dailyActivities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No daily activities yet. Create some activities to track!
          </p>
        )}
        {!loading &&
          dailyActivities.map((activity) => {
            const timeSpent = calculateActivityTime(activity.id);
            const isCurrentActivity = currentActivityId === activity.id;
            const isNeverTask = activity.routine === "never";
            const target = activity.completion_target ?? 1;
            const count = taskCounts[activity.id] || 0;
            const isComplete = count >= target;

            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent"
              >
                {isNeverTask ? (
                  <div
                    onClick={
                      isToday
                        ? () => incrementTask(activity.id, target)
                        : undefined
                    }
                    className={`flex items-center justify-center w-4 h-4 rounded border border-destructive ${
                      isToday ? "cursor-pointer" : "cursor-default opacity-60"
                    } ${isComplete ? "bg-destructive" : "bg-transparent"}`}
                    role={isToday ? "button" : undefined}
                    tabIndex={isToday ? 0 : undefined}
                    onKeyDown={
                      isToday
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              incrementTask(activity.id, target);
                            }
                          }
                        : undefined
                    }
                  >
                    {isComplete && (
                      <X className="h-3 w-3 text-destructive-foreground" />
                    )}
                  </div>
                ) : target <= 1 ? (
                  <button
                    onClick={
                      isToday
                        ? () => incrementTask(activity.id, target)
                        : undefined
                    }
                    disabled={!isToday}
                    className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
                      isComplete
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-muted-foreground text-muted-foreground"
                    } disabled:opacity-60 disabled:cursor-default`}
                    title={
                      isToday
                        ? isComplete
                          ? "Mark incomplete"
                          : "Mark complete"
                        : undefined
                    }
                  >
                    {isComplete && <Check className="h-3 w-3" />}
                  </button>
                ) : (
                  <button
                    onClick={
                      isToday
                        ? () => incrementTask(activity.id, target)
                        : undefined
                    }
                    disabled={!isToday}
                    className={`flex items-center justify-center min-w-[2.75rem] h-6 rounded-full text-xs font-semibold px-2 border transition-colors ${
                      isComplete
                        ? "bg-primary text-primary-foreground border-primary"
                        : count > 0
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "border-muted-foreground text-muted-foreground"
                    } disabled:opacity-60 disabled:cursor-default`}
                    title={
                      isToday
                        ? `${count} / ${target} — click to increment`
                        : `${count} / ${target}`
                    }
                  >
                    {count}/{target}
                  </button>
                )}
                <label
                  className={`flex items-center gap-2 flex-1 ${
                    isToday && !isNeverTask
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                  onClick={
                    isToday && !isNeverTask
                      ? () => incrementTask(activity.id, target)
                      : undefined
                  }
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getGroupColor(activity) }}
                  />
                  <span
                    className={
                      isComplete ? "line-through text-muted-foreground" : ""
                    }
                  >
                    {activity.name}
                  </span>
                </label>
                {timeSpent > 0 && (
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full font-mono">
                    {formatTime(timeSpent)}
                  </span>
                )}
                {isToday && (
                  <Button
                    size="sm"
                    variant={isCurrentActivity ? "default" : "ghost"}
                    onClick={() => handleStartActivity(activity.id)}
                    title={
                      isCurrentActivity
                        ? "Stop this activity"
                        : "Start this activity"
                    }
                  >
                    {isCurrentActivity ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
      </div>

      {oneTimeTasks.length > 0 && (
        <div className="space-y-2 mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            One-time Tasks
          </p>
          {oneTimeTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent"
            >
              <button
                onClick={isToday ? () => toggleOneTimeTask(task) : undefined}
                disabled={!isToday}
                className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
                  task.is_completed
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-muted-foreground text-muted-foreground"
                } disabled:opacity-60 disabled:cursor-default`}
                title={
                  isToday
                    ? task.is_completed
                      ? "Mark incomplete"
                      : "Mark complete"
                    : undefined
                }
              >
                {task.is_completed && <Check className="h-3 w-3" />}
              </button>
              <label
                onClick={isToday ? () => toggleOneTimeTask(task) : undefined}
                className={`flex-1 text-sm ${
                  task.is_completed ? "line-through text-muted-foreground" : ""
                } ${isToday ? "cursor-pointer" : "cursor-default"}`}
              >
                {task.title}
              </label>
              {isToday && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteOneTimeTask(task.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {isToday && showAddTask && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-20"
          onClick={() => setShowAddTask(false)}
        >
          <div
            className="bg-background border rounded-xl shadow-xl p-4 mx-4 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-3">New one-time task</p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createOneTimeTask();
                  if (e.key === "Escape") setShowAddTask(false);
                }}
                placeholder="Task title…"
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={createOneTimeTask}
                disabled={addingTask || !newTaskTitle.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {isToday && (
        <button
          onClick={() => setShowAddTask((v) => !v)}
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          {showAddTask ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
