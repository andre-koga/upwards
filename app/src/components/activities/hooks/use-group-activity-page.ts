import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";

export function useGroupActivityPage() {
  const { groupId, activityId } = useParams<{
    groupId: string;
    activityId: string;
  }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ActivityGroup | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !activityId) {
      navigate("/activities");
      return;
    }
    Promise.all([
      db.activityGroups.get(groupId),
      db.activities.get(activityId),
    ]).then(([g, a]) => {
      if (!g || g.deleted_at || !a || a.deleted_at) {
        navigate("/activities");
        return;
      }
      setGroup(g);
      setActivity(a);
      setLoading(false);
    });
  }, [groupId, activityId, navigate]);

  return { group, activity, loading };
}
