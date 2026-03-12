import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { isActiveGroup, isActiveActivity } from "@/lib/activity-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatTimerDisplay } from "@/lib/activity-utils";

interface AssignActivityDialogProps {
  periodId: string;
  intervalMs: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AssignActivityDialog({
  periodId,
  intervalMs,
  open,
  onOpenChange,
  onSuccess,
}: AssignActivityDialogProps) {
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    const g = await db.activityGroups
      .filter((grp) => isActiveGroup(grp))
      .sortBy("created_at");
    setGroups(g);
    if (g.length > 0) {
      setSelectedGroupId(g[0].id);
    } else {
      setSelectedGroupId("");
    }
  }, []);

  const loadActivities = useCallback(async (groupId: string) => {
    if (!groupId) {
      setActivities([]);
      return;
    }
    const a = await db.activities
      .filter((act) => act.group_id === groupId && isActiveActivity(act))
      .sortBy("created_at");
    setActivities(a);
    setSelectedActivityId(a.length > 0 ? a[0].id : "");
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedGroupId("");
      setSelectedActivityId("");
      setError(null);
      void loadGroups();
    }
  }, [open, loadGroups]);

  useEffect(() => {
    if (open && selectedGroupId) {
      void loadActivities(selectedGroupId);
    }
  }, [open, selectedGroupId, loadActivities]);

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedActivityId("");
    void loadActivities(groupId);
  };

  const handleSave = async () => {
    if (!selectedActivityId) {
      setError("Please select an activity.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await db.activityPeriods.update(periodId, {
        activity_id: selectedActivityId,
        updated_at: now(),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Error assigning activity:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign activity</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This session has no activity. Choose a group and activity to fix it.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span
              className="text-sm font-medium tabular-nums"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              {formatTimerDisplay(intervalMs)}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Group</label>
            <Select
              value={selectedGroupId}
              onValueChange={handleGroupChange}
              disabled={groups.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: g.color || DEFAULT_GROUP_COLOR,
                      }}
                    />
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Activity</label>
            <Select
              value={selectedActivityId}
              onValueChange={setSelectedActivityId}
              disabled={activities.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedActivityId}>
            {saving ? "Saving…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
