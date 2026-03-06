import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import ActivityFormPage from "@/components/activities/activity-form-page";

export default function EditActivityPage() {
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

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group || !activity) return null;

  return <ActivityFormPage group={group} activity={activity} />;
}
