import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Archive } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PATTERN_OPTIONS } from "@/lib/colors";
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
import {
  stopCurrentActivity,
  formatRoutineDisplay,
} from "@/lib/activity-utils";

interface GroupActivitiesContentProps {
  group: ActivityGroup;
}

export default function GroupActivitiesContent({
  group,
}: GroupActivitiesContentProps) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string | null;
  }>({ open: false, activityId: null, activityName: null });

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.activities
        .filter(
          (a) => a.group_id === group.id && !a.is_archived && !a.deleted_at,
        )
        .sortBy("created_at");
      setActivities(data);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const getPatternDisplay = (pattern: string | null) => {
    if (!pattern) return null;
    const opt = PATTERN_OPTIONS.find((p) => p.value === pattern);
    return opt?.name || pattern;
  };

  const handleArchive = async () => {
    if (!archiveDialog.activityId) return;
    try {
      await stopCurrentActivity({ activityId: archiveDialog.activityId });
      const n = now();
      await db.activities.update(archiveDialog.activityId, {
        is_archived: true,
        updated_at: n,
      });
      setArchiveDialog({ open: false, activityId: null, activityName: null });
      await loadActivities();
    } catch (error) {
      console.error("Error archiving activity:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/activities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/activities/${group.id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Group
          </Button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-lg flex-shrink-0"
            style={{ backgroundColor: group.color || "#000" }}
          />
          <div>
            <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
            <p className="text-muted-foreground">
              {activities.length}{" "}
              {activities.length === 1 ? "activity" : "activities"}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/activities/${group.id}/new`)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm mb-6"
        >
          <span>New Activity</span>
          <Plus className="h-4 w-4 shrink-0" />
        </button>

        {activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No activities yet. Create your first activity for this group!
              </p>
              <Button onClick={() => navigate(`/activities/${group.id}/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Activity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-medium truncate">{activity.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {activity.pattern && (
                      <Badge variant="secondary" className="text-xs">
                        {getPatternDisplay(activity.pattern)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {formatRoutineDisplay(activity.routine)}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      navigate(`/activities/${group.id}/edit/${activity.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setArchiveDialog({
                        open: true,
                        activityId: activity.id,
                        activityName: activity.name,
                      })
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={archiveDialog.open}
        onOpenChange={(open) =>
          !open &&
          setArchiveDialog({
            open: false,
            activityId: null,
            activityName: null,
          })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{archiveDialog.activityName}"?
              This will remove it from your active activities list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
