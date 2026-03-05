"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import ActivityNavMenu from "@/components/activities/activity-nav-menu";

type ActivityGroup = Tables<"activity_groups">;
type Activity = Tables<"activities">;

interface ActivitiesListProps {
  userId: string;
}

export default function ActivitiesList({ userId }: ActivitiesListProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [groupsData, activitiesData] = await Promise.all([
        supabase
          .from("activity_groups")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: true }),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: true }),
      ]);

      if (groupsData.error) throw groupsData.error;
      if (activitiesData.error) throw activitiesData.error;

      setGroups(groupsData.data || []);
      setActivities(activitiesData.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getActivitiesCount = (groupId: string) => {
    return activities.filter((a) => a.group_id === groupId).length;
  };

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
            onClick={() => router.push("/activities/new")}
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
                <Button onClick={() => router.push("/activities/new")}>
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
                  onClick={() => router.push(`/activities/${group.id}`)}
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
                      router.push(`/activities/${group.id}/edit`);
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

      {/* Fixed nav — sits above bottom nav */}
      <ActivityNavMenu />
    </>
  );
}
