import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { db, now } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function compareActivities(left: Activity, right: Activity): number {
  const leftOrder =
    typeof left.order_index === "number"
      ? left.order_index
      : Number.POSITIVE_INFINITY;
  const rightOrder =
    typeof right.order_index === "number"
      ? right.order_index
      : Number.POSITIVE_INFINITY;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return (
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export default function TaskOrderPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const all = await db.activities
        .filter((activity) => !activity.is_archived && !activity.deleted_at)
        .toArray();

      const reorderable = all
        .filter(
          (activity) =>
            activity.routine !== "anytime" && activity.routine !== "never",
        )
        .sort(compareActivities);

      setActivities(reorderable);
    } catch (error) {
      console.error("Error loading activities for task ordering:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const canMove = useMemo(
    () => ({
      hasItems: activities.length > 0,
      isBusy: loading || saving,
    }),
    [activities.length, loading, saving],
  );

  const persistOrder = useCallback(async (nextActivities: Activity[]) => {
    const updatedAt = now();

    await db.transaction("rw", db.activities, async () => {
      await Promise.all(
        nextActivities.map((activity, index) =>
          db.activities.update(activity.id, {
            order_index: index,
            updated_at: updatedAt,
          }),
        ),
      );
    });
  }, []);

  const moveItem = useCallback(
    async (index: number, direction: "up" | "down") => {
      if (canMove.isBusy || !canMove.hasItems) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= activities.length) return;

      const next = activities.slice();
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);

      setActivities(next);
      setSaving(true);

      try {
        await persistOrder(next);
      } catch (error) {
        console.error("Error saving task order:", error);
        await loadActivities();
      } finally {
        setSaving(false);
      }
    },
    [
      activities,
      canMove.hasItems,
      canMove.isBusy,
      loadActivities,
      persistOrder,
    ],
  );

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Task Order</h1>
        <p className="text-muted-foreground">
          Reorder scheduled tasks shown on the home page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Daily Task Sorting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground">
              Loading activities...
            </p>
          )}

          {!loading && activities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No scheduled activities available to reorder.
            </p>
          )}

          {!loading &&
            activities.map((activity, index) => (
              <div
                key={activity.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{activity.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void moveItem(index, "up")}
                    disabled={saving || index === 0}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void moveItem(index, "down")}
                    disabled={saving || index === activities.length - 1}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

          {saving && (
            <p className="text-xs text-muted-foreground">Saving order...</p>
          )}
        </CardContent>
      </Card>

      <Link
        to="/settings"
        className="fixed bottom-6 left-6 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-background border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Back to Settings"
      >
        <X className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
