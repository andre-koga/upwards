import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import ActivityFormPage from "@/components/activities/activity-form-page";

export default function NewActivityPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ActivityGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      navigate("/activities");
      return;
    }
    db.activityGroups.get(groupId).then((g) => {
      if (!g || g.deleted_at) {
        navigate("/activities");
        return;
      }
      setGroup(g);
      setLoading(false);
    });
  }, [groupId, navigate]);

  if (loading)
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (!group) return null;

  return <ActivityFormPage group={group} />;
}
