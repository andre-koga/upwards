import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { stopCurrentActivity } from "@/lib/activity-utils";
import ArchivedGroupsList from "@/components/activities/archived-groups-list";
import ArchivedActivitiesList from "@/components/activities/archived-activities-list";

export default function ArchivedItems() {
  const [archivedGroups, setArchivedGroups] = useState<ActivityGroup[]>([]);
  const [archivedActivities, setArchivedActivities] = useState<Activity[]>([]);
  const [allGroups, setAllGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "activity" | "group" | null;
    id: string | null;
  }>({ open: false, type: null, id: null });

  const loadArchivedItems = useCallback(async () => {
    try {
      setLoading(true);
      const [archivedG, archivedA, allG] = await Promise.all([
        db.activityGroups
          .filter((g) => !!g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
        db.activities
          .filter((a) => !!a.is_archived && !a.deleted_at)
          .sortBy("created_at"),
        db.activityGroups.filter((g) => !g.deleted_at).sortBy("created_at"),
      ]);
      setArchivedGroups(archivedG);
      setArchivedActivities(archivedA);
      setAllGroups(allG);
    } catch (error) {
      console.error("Error loading archived items:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchivedItems();
  }, [loadArchivedItems]);

  const handleUnarchiveGroup = async (id: string) => {
    try {
      const n = now();
      await db.activityGroups.update(id, { is_archived: false, updated_at: n });
      const activities = await db.activities
        .filter((a) => a.group_id === id && !a.deleted_at)
        .toArray();
      await Promise.all(
        activities.map((a) =>
          db.activities.update(a.id, { is_archived: false, updated_at: n }),
        ),
      );
      loadArchivedItems();
    } catch (error) {
      console.error("Error unarchiving group:", error);
    }
  };

  const handleUnarchiveActivity = async (id: string) => {
    try {
      const activity = archivedActivities.find((a) => a.id === id);
      if (!activity) return;
      const n = now();
      const group = allGroups.find((g) => g.id === activity.group_id);
      if (group?.is_archived) {
        await db.activityGroups.update(group.id, {
          is_archived: false,
          updated_at: n,
        });
      }
      await db.activities.update(id, { is_archived: false, updated_at: n });
      loadArchivedItems();
    } catch (error) {
      console.error("Error unarchiving activity:", error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.type) return;
    try {
      if (deleteDialog.type === "group") {
        await stopCurrentActivity({ groupId: deleteDialog.id });
        const activities = await db.activities
          .filter((a) => a.group_id === deleteDialog.id!)
          .toArray();
        await db.activities.bulkDelete(activities.map((a) => a.id));
        await db.activityGroups.delete(deleteDialog.id);
      } else {
        await stopCurrentActivity({ activityId: deleteDialog.id });
        await db.activities.delete(deleteDialog.id);
      }
      setDeleteDialog({ open: false, type: null, id: null });
      loadArchivedItems();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading archived items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Archived Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchivedGroupsList
            groups={archivedGroups}
            onUnarchive={handleUnarchiveGroup}
            onDelete={(id) =>
              setDeleteDialog({ open: true, type: "group", id })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Archived Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchivedActivitiesList
            activities={archivedActivities}
            allGroups={allGroups}
            onUnarchive={handleUnarchiveActivity}
            onDelete={(id) =>
              setDeleteDialog({ open: true, type: "activity", id })
            }
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently Delete{" "}
              {deleteDialog.type === "group" ? "Group" : "Activity"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{" "}
              {deleteDialog.type === "group"
                ? "group and all activities in it"
                : "activity"}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
