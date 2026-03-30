import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  isActiveGroup,
  isActiveActivity,
  formatTimerDisplay,
} from "@/lib/activity";
import {
  FormDialog,
  FormDialogActions,
  FormField,
  FormSelectField,
  FormStack,
} from "@/components/forms";

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
      const timestamp = now();
      await db.activityPeriods.update(periodId, {
        activity_id: selectedActivityId,
        updated_at: timestamp,
        synced_at: null, // Force re-push so assignment persists after sync
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign activity"
      description="This session has no activity. Choose a group and activity to fix it."
      contentClassName="sm:max-w-md"
    >
      <FormStack>
        <FormField
          id="unknown-session-duration"
          label="Duration"
          value={formatTimerDisplay(intervalMs)}
          readOnly
          className="font-mono tabular-nums"
        />

        <FormSelectField
          id="unknown-session-group"
          label="Group"
          value={selectedGroupId}
          onValueChange={handleGroupChange}
          disabled={groups.length === 0}
          options={groups.map((group) => ({
            value: group.id,
            label: (
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: group.color || DEFAULT_GROUP_COLOR,
                  }}
                />
                {group.name}
              </span>
            ),
          }))}
          placeholder="Select group"
        />

        <FormSelectField
          id="unknown-session-activity"
          label="Activity"
          value={selectedActivityId}
          onValueChange={setSelectedActivityId}
          disabled={activities.length === 0}
          options={activities.map((activity) => ({
            value: activity.id,
            label: activity.name,
          }))}
          placeholder="Select activity"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <FormDialogActions
          onConfirm={handleSave}
          confirmLabel={saving ? "Saving..." : "Assign"}
          confirmDisabled={saving || !selectedActivityId}
          secondaryAction={{
            label: "Cancel",
            onClick: () => onOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
