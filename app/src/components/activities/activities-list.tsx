import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ActivityNavMenu from "@/components/activities/activity-nav-menu";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";

export default function ActivitiesList() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [g, a] = await Promise.all([
        db.activityGroups
          .filter((g) => !g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
        db.activities
          .filter((a) => !a.is_archived && !a.deleted_at)
          .sortBy("created_at"),
      ]);
      setGroups(g);
      setActivities(a);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getActivitiesCount = (groupId: string) =>
    activities.filter((a) => a.group_id === groupId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">Activity Groups</h1>
            <p className="text-muted-foreground">
              Organize your activities into groups
            </p>
          </div>

          <button
            onClick={() => navigate("/activities/new")}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm mb-6"
          >
            <span>New Group</span>
            <Plus className="h-4 w-4 shrink-0" />
          </button>

          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No activity groups yet. Create your first group to get
                  started!
                </p>
                <Button onClick={() => navigate("/activities/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => navigate(`/activities/${group.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
                      style={{ backgroundColor: group.color || "#000" }}
                    >
                      {group.emoji || ""}
                    </div>
                    <span className="font-medium truncate">{group.name}</span>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {getActivitiesCount(group.id)}{" "}
                      {getActivitiesCount(group.id) === 1
                        ? "activity"
                        : "activities"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/activities/${group.id}/edit`);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ActivityNavMenu />
    </>
  );
}
